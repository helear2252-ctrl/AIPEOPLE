"""Professional design asset pipeline for NOVA interior design tasks."""
from __future__ import annotations

import json
from pathlib import Path

from design_quality_gate import DesignQualityGateTool
from interior_design_brief import DesignBrief, DesignPresentationPayload


ROOT = Path(__file__).resolve().parent


class ProfessionalAssetPipelineTool:
    name = "ProfessionalAssetPipelineTool"

    def __init__(self, root: Path | None = None):
        self.root = (root or ROOT).resolve()
        self.manifest_relative = "assets/designs/cafe_pro/manifest.json"

    def _resolve(self, path: str) -> Path:
        target = (self.root / path).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError("Design asset path escapes NOVA root")
        return target

    def _exists(self, path: str | None) -> bool:
        return bool(path and self._resolve(path).is_file())

    def _read_manifest(self) -> dict:
        path = self._resolve(self.manifest_relative)
        if not path.is_file():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _brief_from_prompt(self, prompt: str) -> DesignBrief:
        text = prompt.lower()
        space_type = "cafe" if any(term in text for term in ("cafe", "coffee", "咖啡")) else "interior"
        style = "professional cafe proposal" if space_type == "cafe" else "professional interior proposal"
        mood = "warm premium" if any(term in text for term in ("warm", "cozy", "溫暖", "暖")) else "premium"
        return DesignBrief(
            project_type="interior_design",
            space_type=space_type,
            style=style,
            mood=mood,
            required_outputs=["render", "interior", "exterior", "plan", "model", "orbit"],
            user_prompt=prompt,
            fallback_strategy="Use installed professional render assets when live render or GLB tools are unavailable.",
        )

    def inspect_assets(self, prompt: str = "") -> dict:
        manifest = self._read_manifest()
        plans = manifest.get("plans", {})
        model = manifest.get("model", {})
        renders = manifest.get("renders", {})
        orbit = manifest.get("orbit", {})
        orbit_pattern = orbit.get("pattern", "")
        orbit_first = orbit_pattern.replace("####", "0001") if orbit_pattern else ""
        assets = {
            "plan": self._exists(plans.get("floor")),
            "model": self._exists(model.get("glb")),
            "hero": self._exists(renders.get("hero")),
            "interior": self._exists(renders.get("interior")),
            "exterior": self._exists(renders.get("exterior")),
            "detail": self._exists(renders.get("detail")),
            "orbit": self._exists(orbit_first),
        }
        available_views = []
        if assets["hero"]:
            available_views.append("render")
        if assets["interior"]:
            available_views.append("interior")
        if assets["exterior"]:
            available_views.append("exterior")
        if assets["plan"]:
            available_views.append("plan")
        if assets["model"]:
            available_views.append("model")
        if assets["orbit"]:
            available_views.append("orbit")
        if assets["hero"]:
            default_view = "render"
        elif assets["plan"]:
            default_view = "plan"
        elif assets["model"]:
            default_view = "model"
        else:
            default_view = "pending"
        missing_assets = []
        checks = {
            "plans.floor": plans.get("floor"),
            "model.glb": model.get("glb"),
            "renders.hero": renders.get("hero"),
            "renders.interior": renders.get("interior"),
            "renders.exterior": renders.get("exterior"),
            "renders.detail": renders.get("detail"),
            "orbit.frame_0001": orbit_first,
        }
        for key, path in checks.items():
            if not self._exists(path):
                missing_assets.append(key)
        quality = DesignQualityGateTool(self.root).check()
        payload = DesignPresentationPayload(
            presentationReady=bool(assets["hero"]),
            assetManifestUrl=f"/{self.manifest_relative}",
            defaultView=default_view,
            availableViews=available_views,
            missingAssets=missing_assets,
            fallbackUsed=not (assets["model"] and assets["orbit"]),
            provider=self.name,
            qualityStatus=quality["qualityStatus"],
            usingPrimitiveFallback=False,
            details={
                "brief": self._brief_from_prompt(prompt).to_dict(),
                "assetStatus": assets,
                "manifestExists": self._resolve(self.manifest_relative).is_file(),
                "quality": quality,
            },
        )
        return payload.to_dict()

    def run(self, message: str, emit):
        emit("professional_asset_check_started", {"tool": self.name, "visibleAction": "Checking installed professional interior design assets"})
        payload = self.inspect_assets(message)
        event = "professional_asset_ready" if payload["presentationReady"] else "professional_asset_pending"
        emit(event, {"tool": self.name, "status": "completed" if payload["presentationReady"] else "pending", "presentation": payload, "visibleAction": "Professional presentation assets are ready" if payload["presentationReady"] else "Professional presentation assets are pending"})
        emit("presentation_ready", {"tool": self.name, "presentationReady": payload["presentationReady"], "assetManifestUrl": payload["assetManifestUrl"], "defaultView": payload["defaultView"], "availableViews": payload["availableViews"], "missingAssets": payload["missingAssets"], "provider": self.name, "qualityStatus": payload["qualityStatus"], "visibleAction": "Prepared professional design presentation payload"})
        return payload, [payload["assetManifestUrl"].lstrip("/")] if self._resolve(self.manifest_relative).is_file() else []
