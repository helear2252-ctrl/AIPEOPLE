"""Priority selection for production and reference render providers."""
from pathlib import Path

from comfyui_render_provider import ComfyUIRenderProvider
from local_reference_render_provider import LocalReferenceRenderProvider, RenderProviderNotConnected


class RenderProviderRegistry:
    def __init__(self, root: Path):
        self.providers = [ComfyUIRenderProvider(root), LocalReferenceRenderProvider(root), RenderProviderNotConnected()]

    def select(self, emit):
        emit("render_provider_check_started", {"providers": [provider.name for provider in self.providers]})
        comfy = self.providers[0]
        status = comfy.check()
        if status.status == "available":
            emit("render_provider_available", status.to_dict()); return comfy, status
        if status.status == "provider_ready_but_workflow_missing":
            emit("render_provider_available", status.to_dict()); emit("render_workflow_missing", status.to_dict()); return comfy, status
        emit("render_provider_unavailable", status.to_dict())
        reference = self.providers[1]
        return reference, status
