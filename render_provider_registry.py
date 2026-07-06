"""Priority selection for production and reference render providers."""
from pathlib import Path

from local_reference_render_provider import LocalReferenceRenderProvider, RenderProviderNotConnected
from render_provider_factory import create_render_provider


class RenderProviderRegistry:
    def __init__(self, root: Path):
        self.provider = create_render_provider(root)
        self.providers = [self.provider, LocalReferenceRenderProvider(root), RenderProviderNotConnected()]

    def select(self, emit):
        emit("render_provider_check_started", {"providers": [provider.name for provider in self.providers]})
        provider = self.provider
        status = provider.check()
        if status.status == "available":
            emit("render_provider_available", status.to_dict()); return provider, status
        if status.status == "provider_ready_but_workflow_missing":
            emit("render_provider_available", status.to_dict()); emit("render_workflow_missing", status.to_dict()); return provider, status
        emit("render_provider_unavailable", status.to_dict())
        if provider.name == "ColabRenderProvider": return provider, status
        reference = self.providers[1]
        return reference, status
