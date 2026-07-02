"""ComfyUI provider with explicit workflow-template gating."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from render_provider_base import RenderProviderBase, RenderRequest, RenderResult


class ComfyUIRenderProvider(RenderProviderBase):
    name = "ComfyUIRenderProvider"
    is_production = True

    def __init__(self, root: Path, url: str | None = None, workflow_template: str | None = None):
        self.root = root
        self.url = (url or os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")).rstrip("/")
        configured = workflow_template or os.getenv("COMFYUI_WORKFLOW_TEMPLATE", "")
        self.workflow_template = Path(configured).expanduser() if configured else root / "comfyui_workflows" / "interior_sd15_lowvram.json"

    def _request(self, path: str, data: dict | None = None, timeout: float = 3):
        body = json.dumps(data).encode("utf-8") if data is not None else None
        request = urllib.request.Request(self.url + path, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read()
            return json.loads(payload.decode("utf-8")) if payload else {}

    def detectAvailability(self) -> dict:
        try:
            stats = self._request("/system_stats", timeout=1.2)
            queue = self._request("/queue", timeout=1.2)
            object_info = self._request("/object_info", timeout=3)
        except (OSError, urllib.error.URLError, TimeoutError, ValueError) as exc:
            return {"provider": self.name, "available": False, "reason": "comfyui_unreachable", "url": self.url, "error": type(exc).__name__}
        required_nodes = {"CheckpointLoaderSimple", "CLIPTextEncode", "KSampler", "VAEDecode", "SaveImage"}
        missing_nodes = sorted(required_nodes.difference(object_info))
        return {"provider": self.name, "available": not missing_nodes, "reason": "available" if not missing_nodes else "required_nodes_missing",
                "url": self.url, "systemStats": bool(stats), "queueApi": isinstance(queue, dict), "outputApi": "SaveImage" in object_info,
                "missingNodes": missing_nodes}

    def loadWorkflowTemplate(self) -> dict | None:
        if not self.workflow_template or not self.workflow_template.is_file(): return None
        return json.loads(self.workflow_template.read_text(encoding="utf-8"))

    def buildPrompt(self, userPrompt: str, roomSchema: dict | None = None) -> str:
        schema = json.dumps(roomSchema or {}, ensure_ascii=False)
        return f"{userPrompt}. Room schema: {schema}" if roomSchema else userPrompt

    def buildNegativePrompt(self) -> str:
        return "low-poly, blocky geometry, toy model, cartoon, flat lighting, plastic material, poor composition, distorted furniture, blurry, watermark, text, messy layout, low quality"

    def _checkpoint_name(self) -> str | None:
        configured = os.getenv("COMFYUI_CHECKPOINT", "").strip()
        if configured: return configured
        info = self._request("/object_info/CheckpointLoaderSimple", timeout=5)
        node = info.get("CheckpointLoaderSimple", {})
        values = node.get("input", {}).get("required", {}).get("ckpt_name", [[]])[0]
        return values[0] if values else None

    def submitRenderJob(self, workflow: dict, client_id: str) -> str:
        submitted = self._request("/prompt", {"prompt": workflow, "client_id": client_id}, timeout=10)
        prompt_id = submitted.get("prompt_id")
        if not prompt_id: raise RuntimeError("ComfyUI did not return a prompt id")
        return prompt_id

    def pollQueueStatus(self, prompt_id: str, timeout_seconds: int = 300) -> dict:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            history = self._request(f"/history/{prompt_id}", timeout=10)
            if history.get(prompt_id): return history[prompt_id]
            time.sleep(1)
        raise TimeoutError("ComfyUI render timed out")

    def collectOutputImages(self, history_record: dict) -> list[dict]:
        return [image for output in history_record.get("outputs", {}).values() for image in output.get("images", [])]

    def saveFinalRender(self, request: RenderRequest, image: dict) -> str:
        query = urllib.parse.urlencode({"filename": image["filename"], "subfolder": image.get("subfolder", ""), "type": image.get("type", "output")})
        output_dir = self.root / "generated_assets" / "interior_renders" / request.task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        destination = output_dir / "final_render.png"
        with urllib.request.urlopen(self.url + "/view?" + query, timeout=60) as response: destination.write_bytes(response.read())
        return "generated_assets/interior_renders/" + request.task_id + "/final_render.png"

    def returnProviderResult(self, status: str, message: str, image_path: str | None = None, metadata: dict | None = None) -> RenderResult:
        return RenderResult(self.name, status, message, image_path, metadata or {})

    def check(self) -> RenderResult:
        availability = self.detectAvailability()
        if not availability["available"]:
            return self.returnProviderResult("unavailable", "ComfyUI is not reachable." if availability["reason"] == "comfyui_unreachable" else "ComfyUI required nodes are missing.", metadata=availability)
        if self.loadWorkflowTemplate() is None:
            return RenderResult(self.name, "provider_ready_but_workflow_missing", "ComfyUI connected, workflow missing.", metadata={"url": self.url})
        return RenderResult(self.name, "available", "ComfyUI and workflow template are ready.", metadata={"url": self.url, "workflow": str(self.workflow_template)})

    def _inject(self, value, request: RenderRequest):
        replacements = {"{{POSITIVE_PROMPT}}": request.prompt, "{{NEGATIVE_PROMPT}}": request.negative_prompt,
                        "{{WIDTH}}": request.width, "{{HEIGHT}}": request.height}
        if isinstance(value, dict): return {key: self._inject(item, request) for key, item in value.items()}
        if isinstance(value, list): return [self._inject(item, request) for item in value]
        if isinstance(value, str): return replacements.get(value, value.replace("{{POSITIVE_PROMPT}}", request.prompt).replace("{{NEGATIVE_PROMPT}}", request.negative_prompt))
        return value

    def render(self, request: RenderRequest, emit) -> RenderResult:
        check = self.check()
        if check.status != "available": return check
        workflow = self.loadWorkflowTemplate()
        graph = workflow.get("prompt", workflow)
        graph = self._inject(graph, request)
        checkpoint = self._checkpoint_name()
        if not checkpoint: return self.returnProviderResult("failed", "No ComfyUI checkpoint is available.")
        graph = self._replace_checkpoint(graph, checkpoint)
        client_id = uuid.uuid4().hex
        prompt_id = self.submitRenderJob(graph, client_id)
        emit("beauty_render_progress", {"progress": .18, "stage": "workflow_submitted", "provider": self.name})
        record = self.pollQueueStatus(prompt_id)
        images = self.collectOutputImages(record)
        if not images: return RenderResult(self.name, "failed", "ComfyUI completed without an image output.", metadata={"promptId": prompt_id})
        path = self.saveFinalRender(request, images[0])
        return self.returnProviderResult("ready", "Final Render Ready", path, {"promptId": prompt_id})

    def _replace_checkpoint(self, value, checkpoint: str):
        if isinstance(value, dict): return {key: self._replace_checkpoint(item, checkpoint) for key, item in value.items()}
        if isinstance(value, list): return [self._replace_checkpoint(item, checkpoint) for item in value]
        return checkpoint if value == "{{CHECKPOINT_NAME}}" else value
