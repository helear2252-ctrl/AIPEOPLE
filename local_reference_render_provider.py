"""Honest reference-board fallback; it never claims to be a final render."""
from __future__ import annotations

from pathlib import Path

from render_provider_base import RenderProviderBase, RenderRequest, RenderResult


class LocalReferenceRenderProvider(RenderProviderBase):
    name = "LocalReferenceRenderProvider"

    def __init__(self, root: Path): self.root = root

    def check(self) -> RenderResult:
        return RenderResult(self.name, "render_provider_required", "Reference-grade preview mode. Production render provider not connected.")

    def render(self, request: RenderRequest, emit) -> RenderResult:
        return RenderResult(self.name, "render_provider_required", "Production render provider not connected.", metadata={
            "mode": "reference-grade preview mode",
            "camera": "3/4 top-down isometric cutaway",
            "materials": ["cream upholstery", "light oak", "white marble", "black metal"],
            "renderTarget": "high-end interior design magazine quality raster image",
        })


class RenderProviderNotConnected(RenderProviderBase):
    name = "RenderProviderNotConnected"
    def check(self): return RenderResult(self.name, "render_provider_required", "Render Provider Not Connected")
    def render(self, request, emit): return self.check()
