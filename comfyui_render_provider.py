"""ComfyUI provider with explicit workflow-template gating."""
from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from PIL import Image, ImageStat

from render_provider_base import RenderProviderBase, RenderRequest, RenderResult


class ComfyUIRenderProvider(RenderProviderBase):
    name = "ComfyUIRenderProvider"
    is_production = True

    def __init__(self, root: Path, url: str | None = None, workflow_template: str | None = None):
        self.root = root
        self.url = (url or os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")).rstrip("/")
        configured = workflow_template or os.getenv("COMFYUI_WORKFLOW_TEMPLATE", "")
        self.workflow_template = Path(configured).expanduser() if configured else root / "comfyui_workflows" / "interior_sd15_lowvram.json"
        self.fallback_workflow_template = root / "comfyui_workflows" / "interior_sd15_minimal_stable.json"
        self.render_timeout_seconds = max(480, int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS", "480")))

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

    def loadWorkflowTemplate(self, path: Path | None = None) -> dict | None:
        selected = path or self.workflow_template
        if not selected or not selected.is_file(): return None
        return json.loads(selected.read_text(encoding="utf-8"))

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

    def _queue_contains(self, queue: dict, prompt_id: str) -> bool:
        return any(str(item[1] if isinstance(item, list) and len(item) > 1 else item.get("prompt_id", "") if isinstance(item, dict) else "") == prompt_id
                   for key in ("queue_running", "queue_pending") for item in queue.get(key, []))

    def pollQueueStatus(self, prompt_id: str, emit, timeout_seconds: int | None = None) -> dict:
        timeout_seconds = timeout_seconds or self.render_timeout_seconds
        deadline = time.monotonic() + timeout_seconds
        last_progress_emit = 0.0
        while time.monotonic() < deadline:
            history = self._request(f"/history/{prompt_id}", timeout=10)
            if history.get(prompt_id): return history[prompt_id]
            queue = self._request("/queue", timeout=10)
            now = time.monotonic()
            if self._queue_contains(queue, prompt_id) and now - last_progress_emit >= 5:
                elapsed = timeout_seconds - max(0, deadline - now)
                progress = min(.95, .18 + (elapsed / timeout_seconds) * .77)
                emit("beauty_render_progress", {"progress": progress, "stage": "rendering", "promptId": prompt_id, "provider": self.name})
                last_progress_emit = now
            time.sleep(1)
        history = self._request(f"/history/{prompt_id}", timeout=15)
        if history.get(prompt_id): return history[prompt_id]
        queue = self._request("/queue", timeout=15)
        if self._queue_contains(queue, prompt_id):
            emit("collecting_output", {"progress": 1, "stage": "collecting_output", "promptId": prompt_id, "provider": self.name})
            grace_deadline = time.monotonic() + 60
            while time.monotonic() < grace_deadline:
                history = self._request(f"/history/{prompt_id}", timeout=15)
                if history.get(prompt_id): return history[prompt_id]
                time.sleep(1)
        raise TimeoutError(f"ComfyUI render timed out after {timeout_seconds} seconds")

    def collectOutputImages(self, history_record: dict) -> list[dict]:
        return [image for output in history_record.get("outputs", {}).values() for image in output.get("images", [])]

    def saveFinalRender(self, request: RenderRequest, image: dict) -> str:
        query = urllib.parse.urlencode({"filename": image["filename"], "subfolder": image.get("subfolder", ""), "type": image.get("type", "output")})
        output_dir = self.root / "generated_assets" / "interior_renders" / request.task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        destination = output_dir / "final_render.png"
        with urllib.request.urlopen(self.url + "/view?" + query, timeout=60) as response: destination.write_bytes(response.read())
        return "generated_assets/interior_renders/" + request.task_id + "/final_render.png"

    def validateOutputImage(self, path: Path) -> dict:
        stats = {"exists": path.is_file(), "fileSize": path.stat().st_size if path.is_file() else 0,
                 "imageSize": [0, 0], "mean": [0.0, 0.0, 0.0], "extrema": [[0, 0], [0, 0], [0, 0]],
                 "isAllBlack": False, "isAllWhite": False, "isSingleColor": False, "hasNonFinite": False,
                 "canOpen": False, "valid": False}
        if not stats["exists"]: return stats
        try:
            with Image.open(path) as source:
                image = source.convert("RGB"); image.load()
                stats["canOpen"] = True; stats["imageSize"] = [image.width, image.height]
                stats["mean"] = [float(value) for value in ImageStat.Stat(image).mean]
                stats["extrema"] = [[int(low), int(high)] for low, high in image.getextrema()]
                stats["hasNonFinite"] = not all(math.isfinite(value) for value in stats["mean"])
                stats["isAllBlack"] = all(pair == [0, 0] for pair in stats["extrema"])
                stats["isAllWhite"] = all(pair == [255, 255] for pair in stats["extrema"])
                stats["isSingleColor"] = all(low == high for low, high in stats["extrema"])
                stats["valid"] = bool(stats["fileSize"] > 10 * 1024 and image.width > 0 and image.height > 0
                                      and not stats["isAllBlack"] and not stats["isAllWhite"]
                                      and not stats["isSingleColor"] and not stats["hasNonFinite"])
        except Exception as exc:
            stats["openError"] = f"{type(exc).__name__}: {exc}"
        return stats

    def _workflow_debug(self, graph: dict) -> dict:
        by_type = {node.get("class_type"): node for node in graph.values() if isinstance(node, dict)}
        sampler = by_type.get("KSampler", {}).get("inputs", {})
        latent = by_type.get("EmptyLatentImage", {}).get("inputs", {})
        checkpoint = by_type.get("CheckpointLoaderSimple", {}).get("inputs", {})
        return {"seed": sampler.get("seed"), "steps": sampler.get("steps"), "cfg": sampler.get("cfg"),
                "sampler": sampler.get("sampler_name"), "scheduler": sampler.get("scheduler"), "denoise": sampler.get("denoise"),
                "latentWidth": latent.get("width"), "latentHeight": latent.get("height"), "checkpointName": checkpoint.get("ckpt_name")}

    def _history_errors(self, record: dict) -> list:
        status = record.get("status", {})
        errors = [] if status.get("status_str") == "success" else [status]
        errors.extend(message for message in status.get("messages", []) if message and "error" in str(message[0]).lower())
        return errors

    def _write_debug_report(self, request: RenderRequest, report: dict):
        output_dir = self.root / "generated_assets" / "interior_renders" / request.task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "render_debug_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    def _render_attempt(self, request: RenderRequest, workflow_path: Path, emit, fallback_used: bool) -> tuple[RenderResult, dict]:
        workflow = self.loadWorkflowTemplate(workflow_path)
        if workflow is None:
            result = self.returnProviderResult("failed", "ComfyUI fallback workflow is missing.", metadata={"reason": "workflow_missing"})
            return result, {"taskId": request.task_id, "workflowPath": str(workflow_path), "fallbackUsed": fallback_used,
                            "imageStats": {"valid": False}, "historyErrors": ["workflow_missing"]}
        graph = self._inject(workflow.get("prompt", workflow), request)
        checkpoint = self._checkpoint_name()
        if not checkpoint:
            result = self.returnProviderResult("failed", "No ComfyUI checkpoint is available.", metadata={"reason": "checkpoint_missing"})
            return result, {"taskId": request.task_id, "workflowPath": str(workflow_path), "fallbackUsed": fallback_used,
                            "imageStats": {"valid": False}, "historyErrors": ["checkpoint_missing"]}
        graph = self._replace_checkpoint(graph, checkpoint)
        emit("render_queue_waiting", {"progress": 0, "stage": "workflow_loaded", "visibleAction": f"ComfyUI workflow loaded: {workflow_path.name}", "fallbackUsed": fallback_used})
        emit("render_queue_waiting", {"progress": .05, "stage": "checkpoint_loaded", "visibleAction": "Checkpoint loaded", "fallbackUsed": fallback_used})
        prompt_id = self.submitRenderJob(graph, uuid.uuid4().hex)
        emit("render_job_submitted", {"progress": .1, "promptId": prompt_id, "visibleAction": "Render job submitted to ComfyUI", "fallbackUsed": fallback_used})
        emit("render_queue_waiting", {"progress": .12, "promptId": prompt_id, "visibleAction": "Waiting in ComfyUI queue", "fallbackUsed": fallback_used})
        emit("beauty_render_progress", {"progress": .18, "stage": "workflow_submitted", "promptId": prompt_id, "provider": self.name, "fallbackUsed": fallback_used})
        record = self.pollQueueStatus(prompt_id, emit)
        candidates = [(str(node_id), image) for node_id, output in record.get("outputs", {}).items() for image in output.get("images", [])]
        workflow_values = self._workflow_debug(graph)
        if not candidates:
            report = {"taskId": request.task_id, "promptId": prompt_id, "workflowPath": str(workflow_path), "fallbackUsed": fallback_used,
                      "selectedOutputNode": None, "selectedOutputFilename": None, "selectedOutputPath": None,
                      "positivePrompt": request.prompt, "negativePrompt": request.negative_prompt, **workflow_values,
                      "comfyuiHistoryStatus": record.get("status", {}), "historyErrors": self._history_errors(record), "imageStats": {"valid": False}}
            return self.returnProviderResult("failed", "ComfyUI completed without an image output.", metadata={"promptId": prompt_id, "reason": "missing_output"}), report
        output_node, selected = candidates[0]
        emit("collecting_output", {"progress": 1, "stage": "collecting_output", "promptId": prompt_id, "provider": self.name, "fallbackUsed": fallback_used})
        relative_path = self.saveFinalRender(request, selected)
        absolute_path = self.root / relative_path
        image_stats = self.validateOutputImage(absolute_path)
        report = {"taskId": request.task_id, "promptId": prompt_id, "workflowPath": str(workflow_path), "fallbackUsed": fallback_used,
                  "selectedOutputNode": output_node, "selectedOutputFilename": selected.get("filename"),
                  "selectedOutputSubfolder": selected.get("subfolder", ""), "selectedOutputType": selected.get("type", "output"),
                  "selectedOutputPath": relative_path, "fileSize": image_stats["fileSize"], "imageSize": image_stats["imageSize"],
                  "meanRGB": image_stats["mean"], "extrema": image_stats["extrema"], "isAllBlack": image_stats["isAllBlack"],
                  "isAllWhite": image_stats["isAllWhite"], "isSingleColor": image_stats["isSingleColor"],
                  "positivePrompt": request.prompt, "negativePrompt": request.negative_prompt, **workflow_values,
                  "comfyuiHistoryStatus": record.get("status", {}), "historyErrors": self._history_errors(record), "imageStats": image_stats}
        if not image_stats["valid"]:
            reason = "invalid_black_output" if image_stats["isAllBlack"] else "invalid_image_output"
            message = "ComfyUI returned success, but the generated image is all black or invalid."
            return self.returnProviderResult("failed", message, metadata={"promptId": prompt_id, "reason": reason, "imageStats": image_stats, "fallbackUsed": fallback_used}), report
        emit("render_image_saved", {"progress": 1, "promptId": prompt_id, "artifact": relative_path, "visibleAction": "Saved validated final_render.png", "fallbackUsed": fallback_used})
        return self.returnProviderResult("ready", "Final Render Ready", relative_path,
                                         {"promptId": prompt_id, "imageStats": image_stats, "fallbackUsed": fallback_used}), report

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
        primary_result, primary_report = self._render_attempt(request, self.workflow_template, emit, False)
        attempts = [primary_report]
        result, final_report = primary_result, primary_report
        if primary_result.metadata.get("reason") == "invalid_black_output":
            fallback_request = RenderRequest(request.task_id,
                "bright modern cafe interior, warm lighting, wood tables, large windows, realistic photo, interior design, high detail, clean composition",
                "black image, blank image, dark, empty, low quality, blurry, broken, artifacts, underexposed", width=512, height=512)
            emit("beauty_render_progress", {"progress": 0, "stage": "invalid_black_output_fallback", "provider": self.name, "fallbackUsed": True})
            fallback_result, fallback_report = self._render_attempt(fallback_request, self.fallback_workflow_template, emit, True)
            attempts.append(fallback_report); result, final_report = fallback_result, fallback_report
            if fallback_result.status != "ready":
                result = self.returnProviderResult("failed", "ComfyUI environment failure.", metadata={
                    "promptId": fallback_result.metadata.get("promptId"), "reason": "comfyui_environment_failure",
                    "imageStats": fallback_result.metadata.get("imageStats", {}), "fallbackUsed": True})
        debug_report = {**final_report, "attempts": attempts, "resultStatus": result.status,
                        "reason": result.metadata.get("reason"), "fallbackUsed": result.metadata.get("fallbackUsed", False)}
        self._write_debug_report(request, debug_report)
        result.metadata["debugReportPath"] = f"generated_assets/interior_renders/{request.task_id}/render_debug_report.json"
        return result

    def _replace_checkpoint(self, value, checkpoint: str):
        if isinstance(value, dict): return {key: self._replace_checkpoint(item, checkpoint) for key, item in value.items()}
        if isinstance(value, list): return [self._replace_checkpoint(item, checkpoint) for item in value]
        return checkpoint if value == "{{CHECKPOINT_NAME}}" else value
