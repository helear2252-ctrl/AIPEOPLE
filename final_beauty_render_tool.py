"""NOVA Interior Real Render Pipeline v1 orchestration tool."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from demo_render_fallback_provider import DemoRenderFallbackProvider
from render_provider_base import RenderRequest
from render_provider_registry import RenderProviderRegistry

ROOT = Path(__file__).resolve().parent
POSITIVE_PROMPT = "Isometric cutaway interior render of a warm minimal luxury cafe interior, open seating area connected to counter and dining zone, cream sofa, light oak wood flooring, white marble service counter, black metal frame glass partition, warm ambient lighting, soft shadows, realistic architectural visualization, premium furniture, detailed materials, high-end interior design magazine quality, clean composition, 3/4 top-down view, cinematic global illumination, 16:9"
NEGATIVE_PROMPT = "low-poly, blocky geometry, toy model, cartoon, flat lighting, plastic material, poor composition, distorted furniture, blurry, watermark, text, messy layout, low quality, bad perspective, deformed architecture"


class FinalBeautyRenderTool:
    name = "FinalBeautyRenderTool"

    def __init__(self): self.providers = RenderProviderRegistry(ROOT)

    def _write_json(self, path: Path, value: dict):
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")

    def _demo_fallback_enabled(self) -> bool:
        return os.getenv("NOVA_RENDER_FALLBACK_MODE", "off").strip().lower() == "demo"

    def _apply_demo_fallback(self, request: RenderRequest, result, emit):
        if not self._demo_fallback_enabled() or result.status not in {"failed", "render_timeout"}:
            return result
        reason = result.metadata.get("reason") or result.status
        fallback = DemoRenderFallbackProvider(ROOT, original_provider=result.provider, original_reason=reason)
        emit("beauty_render_progress", {"provider": fallback.name, "progress": 1, "stage": "demo_fallback", "visibleAction": "Using demo fallback final render", "fallbackUsed": True})
        fallback_result = fallback.render(request, emit)
        if fallback_result.status == "ready":
            fallback_result.metadata["fallbackSourceStatus"] = result.status
            fallback_result.metadata["fallbackSourceMessage"] = result.message
        return fallback_result

    def run(self, message: str, emit):
        task_id = threading.current_thread().name
        output_dir = ROOT / "generated_assets" / "interior_renders" / task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        request = RenderRequest(task_id, POSITIVE_PROMPT + f". Client brief: {message}", NEGATIVE_PROMPT, width=640, height=384)
        prompt_data = {"taskId": task_id, "prompt": request.prompt, "negativePrompt": request.negative_prompt, "width": request.width, "height": request.height}
        self._write_json(output_dir / "render_prompt.json", prompt_data)
        emit("render_prompt_created", {"tool": self.name, **prompt_data})
        provider, check = self.providers.select(emit)
        provider_data = {**check.to_dict(), "checkedAt": datetime.now(timezone.utc).isoformat()}
        self._write_json(output_dir / "provider_status.json", provider_data)
        relative_root = f"generated_assets/interior_renders/{task_id}"
        base_files = [f"{relative_root}/render_prompt.json", f"{relative_root}/provider_status.json"]

        if check.status == "provider_ready_but_workflow_missing":
            result = check
        elif check.status != "available" and provider.is_remote:
            result = provider.make_result("failed", check.message, metadata={**check.metadata, "reason": check.metadata.get("reason", "REMOTE_PROVIDER_UNAVAILABLE")})
        elif check.status == "available":
            emit("beauty_render_started", {"tool": self.name, "provider": provider.name})
            try:
                result = provider.render(request, emit)
            except TimeoutError as exc:
                final_path = output_dir / "final_render.png"
                image_stats = provider.validate_output_image(final_path)
                if image_stats.get("valid"):
                    result = provider.make_result("ready", "Final Render Ready", f"{relative_root}/final_render.png",
                                                  {"recoveredAfterTimeout": True, "imageStats": image_stats})
                else:
                    result = provider.make_result("render_timeout", str(exc), metadata={
                        "reason": "render_timeout", "timeoutSeconds": max(480, int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS", "480"))),
                        "imageStats": image_stats
                    })
        else:
            result = provider.render(request, emit)

        result = self._apply_demo_fallback(request, result, emit)

        metadata = {"taskId": task_id, "provider": result.provider, "status": result.status, "message": result.message,
                    "imagePath": result.image_path, "providerMetadata": result.metadata, "isFinalRender": result.status == "ready" and bool(result.image_path)}
        self._write_json(output_dir / "render_metadata.json", metadata)
        files = [*base_files, f"{relative_root}/render_metadata.json"]
        output = {"summary": result.message, "renderStatus": result.status, "renderProvider": result.provider,
                  "renderMessage": result.message, "renderPrompt": request.prompt, "negativePrompt": request.negative_prompt,
                  "renderPromptSummary": "3/4 top-down warm minimal luxury interior · cream · oak · marble · black metal",
                  "renderMetadataUrl": f"/{relative_root}/render_metadata.json", "isFinalRender": metadata["isFinalRender"]}
        debug_report_path = result.metadata.get("debugReportPath")
        if debug_report_path:
            output["renderDebugReportUrl"] = "/" + debug_report_path
            files.append(debug_report_path)
        if result.status == "ready" and result.image_path:
            output["finalRenderUrl"] = "/" + result.image_path
            files.append(result.image_path)
            emit("beauty_render_ready", output); emit("beauty_render_completed", output)
        elif result.status == "render_timeout":
            emit("beauty_render_failed", {**output, "reason": "render_timeout", "error": result.message})
            raise RuntimeError(result.message)
        elif result.status == "failed":
            failed = {**output, "reason": result.metadata.get("reason"), "message": result.message, "error": result.message,
                      "imageStats": result.metadata.get("imageStats", {}), "fallbackUsed": result.metadata.get("fallbackUsed", False)}
            emit("beauty_render_failed", failed)
            raise RuntimeError(result.message)
        else:
            required = {**output, "actions": ["Connect ComfyUI", "Use SDXL / Flux", "Use Blender Render", "Continue with Draft only"]}
            self._write_json(output_dir / "render_provider_required.json", required)
            files.append(f"{relative_root}/render_provider_required.json")
            emit("beauty_render_blocked", required)
        return output, files
