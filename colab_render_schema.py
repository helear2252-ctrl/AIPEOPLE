"""Strict contracts for NOVA remote render providers."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, ClassVar


REMOTE_JOB_STATUSES = frozenset({"queued", "loading_model", "sampling", "decoding", "saving", "completed", "failed", "cancelled"})


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_mapping(value: Any, label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def require_status(value: Any) -> str:
    if value not in REMOTE_JOB_STATUSES:
        raise ValueError(f"invalid remote render status: {value!r}")
    return str(value)


@dataclass(frozen=True)
class RenderProviderHealth:
    provider: str
    available: bool
    gpu_available: bool
    model_loaded: bool
    detail: str = ""
    checked_at: str = field(default_factory=utc_now)

    @classmethod
    def from_dict(cls, value: dict) -> "RenderProviderHealth":
        data = require_mapping(value, "health")
        return cls(str(data.get("provider", "ColabRenderProvider")), bool(data["available"]), bool(data["gpu_available"]), bool(data["model_loaded"]), str(data.get("detail", "")), str(data.get("checked_at") or utc_now()))

    def to_dict(self) -> dict: return asdict(self)


@dataclass(frozen=True)
class RemoteRenderRequest:
    task_id: str
    prompt: str
    negative_prompt: str
    width: int
    height: int
    steps: int = 30
    guidance_scale: float = 7.0
    seed: int = -1
    style: str = "interior"
    project_type: str = "interior_design"
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.task_id or not self.prompt: raise ValueError("task_id and prompt are required")
        if self.width <= 0 or self.height <= 0 or self.steps <= 0: raise ValueError("render dimensions and steps must be positive")

    def to_dict(self) -> dict: return asdict(self)


@dataclass(frozen=True)
class RemoteRenderJob:
    job_id: str
    task_id: str
    status: str
    created_at: str

    def __post_init__(self): require_status(self.status)

    @classmethod
    def from_dict(cls, value: dict) -> "RemoteRenderJob":
        data = require_mapping(value, "job")
        return cls(str(data["job_id"]), str(data["task_id"]), require_status(data["status"]), str(data.get("created_at") or utc_now()))

    def to_dict(self) -> dict: return asdict(self)


@dataclass(frozen=True)
class RemoteRenderProgress:
    job_id: str
    status: str
    progress: float = 0.0
    current_step: str = ""
    preview_url: str | None = None
    result_url: str | None = None
    error: str | None = None

    def __post_init__(self):
        require_status(self.status)
        if not 0 <= self.progress <= 1: raise ValueError("progress must be between 0 and 1")

    @classmethod
    def from_dict(cls, value: dict) -> "RemoteRenderProgress":
        data = require_mapping(value, "progress")
        return cls(str(data["job_id"]), require_status(data["status"]), float(data.get("progress", 0)), str(data.get("current_step", "")), data.get("preview_url"), data.get("result_url"), data.get("error"))

    def to_dict(self) -> dict: return asdict(self)


@dataclass
class RemoteRenderResult:
    job_id: str
    task_id: str
    status: str
    image_url: str | None = None
    image_bytes: bytes | None = field(default=None, repr=False)
    local_artifact_path: str | None = None
    width: int = 0
    height: int = 0
    seed: int = -1
    metadata: dict = field(default_factory=dict)

    def __post_init__(self): require_status(self.status)

    @classmethod
    def from_dict(cls, value: dict) -> "RemoteRenderResult":
        data = require_mapping(value, "result")
        return cls(str(data["job_id"]), str(data["task_id"]), require_status(data["status"]), data.get("image_url"), None, data.get("local_artifact_path"), int(data.get("width", 0)), int(data.get("height", 0)), int(data.get("seed", -1)), require_mapping(data.get("metadata", {}), "result.metadata"))

    def to_dict(self) -> dict:
        value = asdict(self)
        value.pop("image_bytes", None)
        return value


@dataclass(frozen=True)
class RemoteRenderFailure:
    provider: str
    code: str
    message: str
    retryable: bool = False
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict: return asdict(self)

