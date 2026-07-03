from nova_agent_event_schema import AgentTimelineEvent

class NovaAgentTimeline:
    def __init__(self, stream, task): self.stream, self.task = stream, task
    def emit(self, event_type, payload=None):
        data = dict(payload or {}); data.setdefault("task", self.task)
        event = AgentTimelineEvent(event_type, self.task["taskId"], str(data.get("stepId", "")),
            data.get("title", event_type.replace("_", " ").title()), data.get("visibleAction", data.get("message", "")),
            data.get("tool", ""), data.get("status", "running"), data.get("progress", 0),
            artifact=data.get("artifact"), debug=data.get("debug", {})).to_dict()
        data.update(event)
        return self.stream.publish(self.task["taskId"], event_type, data)

