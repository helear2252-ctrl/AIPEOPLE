"""Environment-only NOVA runtime configuration."""
from dataclasses import dataclass
import os

@dataclass(frozen=True)
class NovaRuntimeConfig:
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    render_timeout_seconds: int = 480
    render_provider: str = "comfyui"
    colab_base_url: str = ""
    colab_connect_timeout_seconds: float = 5
    colab_read_timeout_seconds: float = 30
    colab_poll_interval_seconds: float = 2
    colab_max_poll_seconds: float = 480

    @classmethod
    def load(cls):
        return cls(os.getenv("OPENAI_API_KEY", ""), os.getenv("NOVA_OPENAI_MODEL", "gpt-4.1-mini"),
                   max(480, int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS", "480"))),
                   os.getenv("NOVA_RENDER_PROVIDER", "comfyui").strip().lower(),
                   os.getenv("NOVA_COLAB_BASE_URL", "").strip(),
                   float(os.getenv("NOVA_COLAB_CONNECT_TIMEOUT_SECONDS", "5")),
                   float(os.getenv("NOVA_COLAB_READ_TIMEOUT_SECONDS", "30")),
                   float(os.getenv("NOVA_COLAB_POLL_INTERVAL_SECONDS", "2")),
                   float(os.getenv("NOVA_COLAB_MAX_POLL_SECONDS", "480")))

