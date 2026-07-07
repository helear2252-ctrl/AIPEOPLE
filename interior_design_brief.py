"""Typed contracts for NOVA professional interior design presentations."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class DesignBrief:
    project_type: str
    space_type: str
    style: str
    mood: str
    required_outputs: list[str]
    user_prompt: str
    fallback_strategy: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DesignPresentationPayload:
    presentationReady: bool
    assetManifestUrl: str
    defaultView: str
    availableViews: list[str]
    missingAssets: list[str]
    fallbackUsed: bool
    provider: str
    qualityStatus: str
    usingPrimitiveFallback: bool = False
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)
