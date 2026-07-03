from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

@dataclass
class AgentTimelineEvent:
    eventType: str; taskId: str; stepId: str = ""; title: str = ""; visibleAction: str = ""
    tool: str = ""; status: str = "running"; progress: float = 0; timestamp: str = ""
    artifact: Any = None; debug: dict = field(default_factory=dict)
    def to_dict(self):
        if not self.timestamp: self.timestamp = datetime.now(timezone.utc).isoformat()
        return asdict(self)

