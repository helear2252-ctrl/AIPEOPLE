"""Demo final-render fallback used only when explicitly enabled for interviews."""
from __future__ import annotations

import shutil
from pathlib import Path

from render_provider_base import RenderProviderBase, RenderRequest, RenderResult


class DemoRenderFallbackProvider(RenderProviderBase):
    name = "DemoRenderFallbackProvider"
    source_image = Path("assets/demo/phase2c_demo_fallback_render.png")

    def __init__(self, root: Path, *, original_provider: str = "ColabRenderProvider", original_reason: str = "unknown"):
        self.root = root
        self.original_provider = original_provider
        self.original_reason = original_reason

    def check(self) -> RenderResult:
        path = self.root / self.source_image
        stats = self.validate_output_image(path)
        status = "available" if stats.get("valid") else "unavailable"
        return self.make_result(status, "Demo fallback image is available." if stats.get("valid") else "Demo fallback image is invalid.", metadata={"imageStats": stats})

    def render(self, request: RenderRequest, emit) -> RenderResult:
        source = self.root / self.source_image
        output_dir = self.root / "generated_assets" / "interior_renders" / request.task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "final_render.png"
        shutil.copyfile(source, output_path)
        image_stats = self.validate_output_image(output_path)
        relative_path = f"generated_assets/interior_renders/{request.task_id}/final_render.png"
        metadata = {
            "fallbackUsed": True,
            "fallbackMode": "demo",
            "originalProvider": self.original_provider,
            "originalReason": self.original_reason,
            "sourceImage": self.source_image.as_posix(),
            "imageStats": image_stats,
        }
        if not image_stats.get("valid"):
            return self.make_result("failed", "Demo fallback image is invalid.", metadata=metadata)
        emit("render_image_saved", {"provider": self.name, "progress": 1, "artifact": relative_path, "visibleAction": "Saved demo fallback final_render.png", "fallbackUsed": True})
        return self.make_result("ready", "Demo Fallback Render Ready", relative_path, metadata)
