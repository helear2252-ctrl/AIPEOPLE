"""Shared contracts for NOVA Universal Agent Core v1."""
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

class Intent(str, Enum):
    INTERIOR_DESIGN="interior_design"; BROWSER_BOOKING="browser_booking"; WEBSITE_BUILDER="website_builder"
    CODE_BUILDER="code_builder"; RESEARCH="research"; FILE_WORKSPACE="file_workspace"; GENERAL_ASSISTANT="general_assistant"

class AgentStatus(str, Enum):
    TASK_RECEIVED="task_received"; INTENT_DETECTED="intent_detected"; PLAN_CREATED="plan_created"
    TOOL_SELECTED="tool_selected"; TOOL_STARTED="tool_started"; TOOL_PROGRESS="tool_progress"
    OBSERVATION_RECEIVED="observation_received"; FIX_IF_NEEDED="fix_if_needed"; OUTPUT_READY="output_ready"
    WAITING_FOR_USER="waiting_for_user"; COMPLETED="completed"; FAILED="failed"

@dataclass(frozen=True)
class ToolDescriptor:
    name: str; capability: str; requiresUserConfirmation: bool=False; dangerLevel: str="safe"; status: str="available"
    def to_dict(self)->dict[str,Any]: return asdict(self)

@dataclass
class AgentPlan:
    intent: str; steps: list[str]; tools: list[str]; goal: str
    def to_dict(self)->dict[str,Any]: return asdict(self)

@dataclass
class Observation:
    tool: str; ok: bool; summary: str; result: dict[str,Any]=field(default_factory=dict)
    files: list[str]=field(default_factory=list); error: str|None=None
    def to_dict(self)->dict[str,Any]: return asdict(self)
