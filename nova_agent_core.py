"""NOVA Universal Agent Core v2 with safe brain fallback and public timeline events."""
from time import sleep
from gpt_brain_adapter import GPTBrainAdapter
from nova_agent_timeline import NovaAgentTimeline
from nova_observation import ObservationEngine
from nova_safety_guard import NovaSafetyGuard
from nova_task_planner import NovaTaskPlanner
from nova_tool_registry import NovaToolRegistry
from nova_tool_router import NovaToolRouter
from nova_workspace import NovaWorkspace

class NovaUniversalAgentCore:
    def __init__(self,stream):
        self.stream=stream; self.planner=NovaTaskPlanner(); self.registry=NovaToolRegistry(); self.router=NovaToolRouter(); self.observer=ObservationEngine(); self.safety=NovaSafetyGuard(); self.workspace=NovaWorkspace()
    def run(self,task,message,brain_name="localMock"):
        timeline=NovaAgentTimeline(self.stream,task); emit=timeline.emit
        try:
            task.update(status="task_received",currentStep="Understanding request"); emit("agent_brain_started",{"visibleAction":"Understanding the user's goal and constraints"})
            brain=GPTBrainAdapter(self.registry,self.planner,self.router)
            try:
                brain_plan=brain.plan(message); emit("brain_provider_selected",{"visibleAction":"GPT Brain selected","debug":{"provider":"GPTBrainAdapter"}})
            except Exception as exc:
                brain_plan=brain.fallback(message); emit("brain_fallback_used",{"status":"completed","visibleAction":"GPT Brain unavailable; deterministic fallback selected","debug":{"reason":type(exc).__name__}})
            intent=brain_plan["intent"]; names=[n for n in brain_plan.get("selectedTools",[]) if n in self.registry._descriptors] or self.router.select(intent)
            task.update(intent=intent,brain=brain_plan["brainProvider"],status="intent_detected",currentStep="Intent detected"); emit("intent_detected",{"intent":intent,"status":"completed","visibleAction":f"Intent detected: {intent}"})
            plan=self.planner.create_plan(message,intent,names); task["steps"]=[{"id":f"step_{i:03d}","label":label,"visibleAction":label,"status":"pending"} for i,label in enumerate(plan.steps,1)]
            task.update(status="plan_created",currentStep="Plan created"); emit("plan_created",{"plan":brain_plan,"status":"completed","visibleAction":f"Created {len(task['steps'])} visible operation steps"})
            task["toolCalls"]=[{**self.registry.describe(name),"visibleDescription":self.registry.describe(name)["capability"],"status":"selected"} for name in names]
            emit("tool_selected",{"tools":task["toolCalls"],"status":"completed","visibleAction":"Selected tools: "+", ".join(names)})
            decision=self.safety.inspect(message)
            if not decision.allowed: task.update(status="waiting_for_user",currentStep=decision.reason); emit("safety_confirmation_required",decision.to_dict()); emit("waiting_for_user",decision.to_dict()); return
            outputs={}; files=[]; observations=[]; executable=[n for n in names if self.registry.describe(n)["status"]=="available"]
            for tool_index,tool_name in enumerate(executable):
                step=task["steps"][min(tool_index,len(task["steps"])-1)]; step["status"]="running"; task["currentStep"]=step["id"]
                emit("step_started",{"stepId":step["id"],"title":step["label"],"visibleAction":step["visibleAction"],"tool":tool_name})
                call=next(x for x in task["toolCalls"] if x["name"]==tool_name); call["status"]="running"; emit("tool_started",{"stepId":step["id"],"tool":tool_name,"visibleAction":f"Running {tool_name}"})
                try:
                    def tool_emit(kind,payload):
                        if kind!="tool_waiting_for_user":
                            emit(kind,payload)
                            aliases={"tool_output":"artifact_created","beauty_render_progress":"render_sampling_progress","collecting_output":"render_collecting_output","beauty_render_ready":"render_image_saved"}
                            if kind in aliases: emit(aliases[kind],payload)
                    result,generated=self.registry.get(tool_name).run(message,tool_emit); observation=self.observer.success(tool_name,result,generated); call["status"]="completed"
                except Exception as exc: observation=self.observer.failure(tool_name,exc); call["status"]="failed"
                observations.append(observation.to_dict()); outputs.update(observation.result); files.extend(observation.files)
                emit("tool_observation",{"stepId":step["id"],"tool":tool_name,"status":"completed" if observation.ok else "failed","visibleAction":observation.summary,"artifact":observation.files})
                step["status"]="done"; emit("step_completed",{"stepId":step["id"],"tool":tool_name,"status":"completed","progress":round((tool_index+1)/max(1,len(executable)),2),"visibleAction":step["label"]})
                emit("step_updated",{"step":step,"index":tool_index});
                if not observation.ok: raise RuntimeError(observation.error)
            for step in task["steps"]:
                if step["status"]=="pending": step["status"]="done"; emit("step_started",{"stepId":step["id"],"visibleAction":step["label"]}); emit("step_completed",{"stepId":step["id"],"status":"completed","progress":1,"visibleAction":step["label"]})
            task.update(status="output_ready",output={**outputs,"observations":observations},files=files,currentStep="Output ready"); emit("artifact_created",{"status":"completed","artifact":files,"visibleAction":f"Prepared {len(files)} artifacts"}); emit("preview_ready",{"output":task["output"],"files":files,"status":"completed"})
            decision=self.safety.after_observation(outputs)
            if not decision.allowed: task.update(status="waiting_for_user",currentStep=decision.reason); emit("safety_confirmation_required",decision.to_dict()); emit("waiting_for_user",decision.to_dict()); return
            task.update(status="completed",currentStep="Completed"); emit("task_completed",{"output":task["output"],"files":files,"status":"completed","progress":1,"visibleAction":"Task completed"})
        except Exception as exc:
            task.update(status="failed",currentStep="Failed",output={"error":str(exc)}); emit("task_failed",{"status":"failed","visibleAction":"Task failed","debug":{"error":str(exc)}})
