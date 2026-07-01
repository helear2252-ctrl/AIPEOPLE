"""InteriorRenderAgent turns a design request into an observable render job."""
from __future__ import annotations

import json
from pathlib import Path
from interior_render_provider import ComfyUIRenderProvider, LocalMockRenderProvider


class InteriorRenderAgent:
    def __init__(self, project_root: Path): self.project_root = project_root

    def build_prompts(self, request: str) -> tuple[str, str]:
        prompt = ("Modern cafe interior design, warm wood and stone counter, large floor-to-ceiling windows, "
                  "natural sunlight, cozy sofa seating, sculptural wood tables and chairs, abundant indoor plants, "
                  "warm pendant lights, premium plaster walls, glass and brushed metal details, minimal luxury, "
                  "realistic architectural visualization, high-end interior render, wide angle, cinematic lighting, "
                  "soft shadows, atmospheric depth, premium materials, 16:9 composition. User request: " + request)
        negative = "low quality, cartoon, low-poly, blocky geometry, toy model, flat lighting, messy layout, distorted furniture, text, watermark, blurry"
        return prompt, negative

    def select_provider(self):
        comfy = ComfyUIRenderProvider(); availability = comfy.detectAvailability()
        if availability.get("available") and availability.get("status") != "provider_ready_but_workflow_missing": return comfy, availability
        return LocalMockRenderProvider(), {"available": True, "status": "production render provider not connected", "comfyUI": availability}

    def run(self, task_id: str, request: str, emit) -> tuple[dict, list[str]]:
        prompt, negative = self.build_prompts(request)
        base = {"taskId": task_id, "intent": "interior_render", "outputs": []}
        emit("render_task_created", {**base, "provider": None, "status": "analyzing", "message": "Analyzing interior design request", "progress": 8})
        emit("render_prompt_created", {**base, "provider": None, "status": "prompt_ready", "message": "Visual prompt and negative prompt ready", "progress": 22, "prompt": prompt, "negativePrompt": negative, "promptSummary": "Modern cafe · warm wood · stone · glass · indoor plants · cinematic daylight"})
        provider, availability = self.select_provider()
        emit("render_provider_selected", {**base, "provider": provider.name, "status": "provider_selected", "message": availability["status"], "progress": 34, "availability": availability})
        output_dir = Path("generated_assets") / "interior_renders" / task_id
        emit("render_started", {**base, "provider": provider.name, "status": "rendering", "message": "Rendering modern cafe concept", "progress": 45})
        def progress(value, message): emit("render_progress", {**base, "provider": provider.name, "status": "rendering", "message": message, "progress": value})
        try:
            outputs = provider.render({"prompt": prompt, "negativePrompt": negative, "request": request}, self.project_root / output_dir, progress)
            # Provider URLs are made project-root relative for StaticFiles.
            for item in outputs: item["url"] = item["url"].replace(f"/{self.project_root.as_posix()}/", "/").replace("//", "/")
            metadata = {"taskId": task_id, "intent": "interior_render", "provider": provider.name, "providerStatus": availability, "prompt": prompt, "negativePrompt": negative, "outputs": outputs}
            metadata_path = self.project_root / output_dir / "render_metadata.json"
            metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
            emit("render_preview_ready", {**base, "provider": provider.name, "status": "preview_ready", "message": "Multi-view interior preview ready", "progress": 92, "outputs": outputs})
            emit("render_completed", {**base, "provider": provider.name, "status": "completed", "message": "Interior render completed", "progress": 100, "outputs": outputs})
            files = [str((output_dir / Path(item["url"]).name).as_posix()) for item in outputs] + [str((output_dir / "render_metadata.json").as_posix())]
            return {"renderJob": metadata, "renderOutputs": outputs, "summary": "High-fidelity local architectural visualization preview ready."}, files
        except Exception as exc:
            emit("render_failed", {**base, "provider": provider.name, "status": "failed", "message": str(exc), "progress": 0})
            raise
