"""Provider contracts for NOVA Interior Real Render Pipeline v1."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Callable


@dataclass
class RenderRequest:
    task_id: str
    prompt: str
    negative_prompt: str
    width: int = 1344
    height: int = 768


@dataclass
class RenderResult:
    provider: str
    status: str
    message: str
    image_path: str | None = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class RenderProviderBase(ABC):
    name = "RenderProviderBase"
    is_production = False

    @abstractmethod
    def check(self) -> RenderResult: ...

    @abstractmethod
    def render(self, request: RenderRequest, emit: Callable) -> RenderResult: ...
