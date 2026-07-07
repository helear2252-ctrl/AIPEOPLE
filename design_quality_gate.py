"""Quality checks for professional design presentation assets."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent


class DesignQualityGateTool:
    name = "DesignQualityGateTool"

    def __init__(self, root: Path | None = None):
        self.root = (root or ROOT).resolve()

    def _resolve(self, path: str) -> Path:
        target = (self.root / path).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError("Design asset path escapes NOVA root")
        return target

    def _read_manifest(self) -> dict:
        path = self._resolve("assets/designs/cafe_pro/manifest.json")
        if not path.is_file():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _image_status(self, key: str, path: str | None) -> dict:
        if not path:
            return {"key": key, "path": "", "exists": False, "canOpen": False, "validSize": False}
        target = self._resolve(path)
        status = {"key": key, "path": path, "exists": target.is_file(), "canOpen": False, "validSize": False, "width": 0, "height": 0}
        if not target.is_file():
            return status
        try:
            with Image.open(target) as image:
                image.verify()
            with Image.open(target) as image:
                status.update(canOpen=True, width=image.width, height=image.height, validSize=image.width > 0 and image.height > 0)
        except Exception as exc:
            status["error"] = f"{type(exc).__name__}: {exc}"
        return status

    def check(self) -> dict:
        manifest = self._read_manifest()
        renders = manifest.get("renders", {})
        image_results = {
            "hero": self._image_status("hero", renders.get("hero")),
            "interior": self._image_status("interior", renders.get("interior")),
            "exterior": self._image_status("exterior", renders.get("exterior")),
            "detail": self._image_status("detail", renders.get("detail")),
        }
        usable = [key for key in ("hero", "interior", "exterior") if image_results[key]["canOpen"] and image_results[key]["validSize"]]
        plan_exists = bool(manifest.get("plans", {}).get("floor") and self._resolve(manifest["plans"]["floor"]).is_file())
        model_exists = bool(manifest.get("model", {}).get("glb") and self._resolve(manifest["model"]["glb"]).is_file())
        orbit_pattern = manifest.get("orbit", {}).get("pattern", "")
        orbit_first = self._resolve(orbit_pattern.replace("####", "0001")) if orbit_pattern else None
        orbit_exists = bool(orbit_first and orbit_first.is_file())
        if image_results["hero"]["canOpen"] and image_results["hero"]["validSize"] and plan_exists and model_exists and orbit_exists:
            status = "passed"
        elif usable:
            status = "warning"
        else:
            status = "failed"
        return {
            "qualityStatus": status,
            "passed": status == "passed",
            "warning": status == "warning",
            "failed": status == "failed",
            "usableRenderCount": len(usable),
            "usableRenders": usable,
            "missingOptionalAssets": {
                "plan": not plan_exists,
                "model": not model_exists,
                "orbit": not orbit_exists,
            },
            "details": image_results,
        }

    def run(self, _message: str, emit):
        result = self.check()
        emit("design_quality_checked", {"tool": self.name, "status": result["qualityStatus"], "quality": result, "visibleAction": "Checked professional design presentation assets"})
        return {"qualityStatus": result["qualityStatus"], "designQuality": result, "usingPrimitiveFallback": False}, []
