"""Environment-selected render provider construction."""
from __future__ import annotations

import os
from pathlib import Path

from colab_render_provider import ColabRenderProvider
from comfyui_render_provider import ComfyUIRenderProvider


class RenderProviderConfigurationError(ValueError):
    pass


def create_render_provider(root: Path, provider_name: str | None = None):
    selected = (provider_name or os.getenv("NOVA_RENDER_PROVIDER", "comfyui")).strip().lower()
    if selected == "comfyui": return ComfyUIRenderProvider(root)
    if selected == "colab": return ColabRenderProvider(root)
    raise RenderProviderConfigurationError(f"Unsupported NOVA_RENDER_PROVIDER: {selected or '<empty>'}")
