"""NOVA Universal Agent Core v1 lifecycle."""
from time import sleep
from nova_observation import ObservationEngine
from nova_safety_guard import NovaSafetyGuard
from nova_task_planner import NovaTaskPlanner
from nova_tool_registry import NovaToolRegistry
from nova_tool_router import NovaToolRouter
from nova_workspace import NovaWorkspace

class NovaUniversalAgentCore:
    def __init__(self,stream):
        self.stream=stream; self.planner=NovaTaskPlanner(); self.registry=NovaToolRegistry(); self.router=NovaToolRouter()
        self.observer=ObservationEngine(); self.safety=NovaSafetyGuard(); self.workspace=NovaWorkspace()
    def run(self,task:dict,message:str,brain_name:str="localMock"):
        def emit(kind,payload=None):
            data=dict(payload or {}); data.setdefault("task",task); self.stream.publish(task["taskId"],kind,data)
        try:
            task.update(status="task_received",currentStep="Task received"); emit("universal_agent_started",{"message":message})
            intent=self.planner.detect_intent(message); task.update(intent=intent,status="intent_detected",currentStep="Intent detected")
            emit("intent_detected",{"intent":intent})
            names=self.router.select(intent); plan=self.planner.create_plan(message,intent,names)
            task.update(status="plan_created",currentStep="Plan created",brain=brain_name,
              steps=[{"id":f"step-{i+1}","label":label,"status":"pending"} for i,label in enumerate(plan.steps)])
            emit("plan_created",{"plan":plan.to_dict()})
            task["toolCalls"]=[{**self.registry.describe(name),"status":"selected"} for name in names]
            task.update(status="tool_selected",currentStep="Tools selected"); emit("tool_selected",{"tools":task["toolCalls"]})
            initial_decision=self.safety.inspect(message)
            if not initial_decision.allowed:
                task.update(status="waiting_for_user",currentStep=initial_decision.reason)
                emit("waiting_for_user",{"reason":initial_decision.reason,"action":initial_decision.action}); return
            outputs={}; files=[]; observations=[]
            executable=[name for name in names if self.registry.describe(name)["status"]=="available"]
            for tool_name in executable:
                call=next(item for item in task["toolCalls"] if item["name"]==tool_name); call["status"]="running"
                task.update(status="tool_started",currentStep=f"Using {tool_name}")
                emit("tool_started",{"tool":tool_name,"descriptor":self.registry.describe(tool_name)})
                for index,step in enumerate(task["steps"]):
                    if index and task["steps"][index-1]["status"]=="running": task["steps"][index-1]["status"]="done"
                    step["status"]="running"; task["currentStep"]=step["id"]; progress=round((index+1)/len(task["steps"]),2)
                    emit("tool_progress",{"tool":tool_name,"progress":progress,"step":step,"index":index})
                    emit("step_updated",{"step":step,"index":index}); sleep(.08)
                try:
                    def tool_emit(kind,payload):
                        # Legacy booking announced its guard internally. The Core
                        # owns the canonical waiting transition after observation.
                        if kind != "tool_waiting_for_user": emit(kind,payload)
                    result,generated=self.registry.get(tool_name).run(message,tool_emit)
                    observation=self.observer.success(tool_name,result,generated); call["status"]="completed"
                except Exception as exc:
                    observation=self.observer.failure(tool_name,exc); call["status"]="failed"
                observations.append(observation.to_dict()); outputs.update(observation.result); files.extend(observation.files)
                task.update(status="observation_received",output=outputs,files=files)
                emit("observation_received",{"observation":observation.to_dict()})
                if self.observer.needs_fix(observation):
                    task["status"]="fix_if_needed"; emit("fix_started",{"tool":tool_name,"error":observation.error}); raise RuntimeError(observation.error)
            if task["steps"]: task["steps"][-1]["status"]="done"
            task.update(status="output_ready",output={**outputs,"observations":observations},files=files,currentStep="Output ready")
            emit("output_ready",{"output":task["output"],"files":files}); emit("preview_ready",{"output":task["output"],"files":files})
            decision=self.safety.after_observation(outputs)
            if not decision.allowed:
                task.update(status="waiting_for_user",currentStep=decision.reason)
                emit("waiting_for_user",{"reason":decision.reason,"action":decision.action})
                emit("tool_waiting_for_user",{"reason":decision.reason,"action":decision.action}); return
            task.update(status="completed",currentStep="Completed")
            emit("universal_agent_completed",{"output":task["output"],"files":files}); emit("task_completed",{"output":task["output"],"files":files})
        except Exception as exc:
            task.update(status="failed",currentStep="Failed",output={"error":str(exc)})
            emit("universal_agent_failed",{"error":str(exc)}); emit("tool_failed",{"error":str(exc)})
