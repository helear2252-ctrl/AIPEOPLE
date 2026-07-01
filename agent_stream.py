"""Thread-safe event history used by SSE and future transports."""
from __future__ import annotations
from threading import Condition
from time import time

class AgentEventStream:
    def __init__(self): self.events, self.condition = {}, Condition()
    def publish(self, task_id: str, event_type: str, data: dict) -> dict:
        with self.condition:
            event = {"id": len(self.events.setdefault(task_id, [])), "type": event_type, "at": time(), "data": data}
            self.events[task_id].append(event); self.condition.notify_all(); return event
    def since(self, task_id: str, cursor: int) -> list[dict]:
        with self.condition: return list(self.events.get(task_id, [])[cursor:])
    def wait(self, task_id: str, cursor: int, timeout: float = 15) -> list[dict]:
        with self.condition:
            if len(self.events.get(task_id, [])) <= cursor: self.condition.wait(timeout)
            return list(self.events.get(task_id, [])[cursor:])
