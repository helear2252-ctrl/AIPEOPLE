from __future__ import annotations
from time import sleep
from agent_brain import get_brain
from agent_tools import ToolExecutor

class AgentOrchestrator:
    def __init__(self, stream): self.stream, self.executor = stream, ToolExecutor()
    def run(self, task: dict, message: str, brain_name: str):
        def emit(kind, payload):
            if "task" not in payload: payload = {**payload, "task": task}
            self.stream.publish(task["taskId"], kind, payload)
        try:
            brain = get_brain(brain_name); plan = brain.planTask(message)
            task.update(intent=plan["intent"], brain=plan["brain"], steps=[{"id":f"step-{i+1}","label":label,"status":"pending"} for i,label in enumerate(plan["steps"])], toolCalls=[{"name":n,"status":"selected"} for n in plan["tools"]])
            emit("plan_created", {"plan":plan}); task["status"]="executing"
            outputs, files = {}, []
            tool_name = plan["tools"][0]
            for index, step in enumerate(task["steps"]):
                if index: task["steps"][index-1]["status"]="done"
                step["status"]="running"; task["status"]="using_tool"; task["currentStep"]=step["id"]
                task["cursor"]={"x":18+index*10,"y":35+(index%3)*14,"action":"click"}
                emit("step_updated", {"step":step,"index":index}); emit("tool_progress", {"tool":tool_name,"progress":round((index+1)/len(task["steps"]),2)}); sleep(.28)
            result, generated = self.executor.execute(tool_name, message, emit); outputs.update(result); files.extend(generated)
            task["steps"][-1]["status"]="done"; task["output"]=outputs; task["files"]=files
            task["status"] = "waiting_for_user" if plan["intent"] == "browser_booking" else "preview_ready"
            emit("preview_ready", {"output":outputs,"files":files})
            if task["status"] != "waiting_for_user": task["status"]="completed"; emit("task_completed", {"output":outputs,"files":files})
        except Exception as exc:
            task["status"]="failed"; task["output"]={"error":str(exc)}; emit("tool_failed", {"error":str(exc)})
