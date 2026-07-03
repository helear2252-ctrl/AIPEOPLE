from dataclasses import asdict, dataclass, field

@dataclass
class ToolObservation:
    tool: str; status: str; summary: str; artifacts: list[str] = field(default_factory=list); debug: dict = field(default_factory=dict)
    def to_dict(self): return asdict(self)

