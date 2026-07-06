from pathlib import Path

import pytest

from colab_render_provider import ColabRenderProvider
from comfyui_render_provider import ComfyUIRenderProvider
from render_provider_factory import RenderProviderConfigurationError, create_render_provider


def test_factory_selects_comfyui_and_preserves_local_provider(tmp_path):
    provider=create_render_provider(tmp_path,"comfyui")
    assert isinstance(provider,ComfyUIRenderProvider) and provider.workflow_template.name=="interior_sd15_lowvram.json"


def test_factory_selects_colab(tmp_path):
    assert isinstance(create_render_provider(tmp_path,"colab"),ColabRenderProvider)


def test_factory_rejects_unknown_provider(tmp_path):
    with pytest.raises(RenderProviderConfigurationError): create_render_provider(tmp_path,"mystery")
