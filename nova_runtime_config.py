"""Environment-only NOVA runtime configuration."""
from dataclasses import dataclass
import os

@dataclass(frozen=True)
class NovaRuntimeConfig:
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    render_timeout_seconds: int = 480

    @classmethod
    def load(cls):
        return cls(os.getenv("OPENAI_API_KEY", ""), os.getenv("NOVA_OPENAI_MODEL", "gpt-4.1-mini"),
                   max(480, int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS", "480"))))

