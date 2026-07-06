"""Provider contracts for NOVA Interior Real Render Pipeline v1."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Callable

from image_quality_gate import ImageQualityGate


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
    is_remote = False

    @abstractmethod
    def check(self) -> RenderResult: ...

    @abstractmethod
    def render(self, request: RenderRequest, emit: Callable) -> RenderResult: ...

    def validate_output_image(self, path) -> dict:
        return ImageQualityGate.validate(path)

    def make_result(self, status: str, message: str, image_path: str | None = None, metadata: dict | None = None) -> RenderResult:
        return RenderResult(self.name, status, message, image_path, metadata or {})
