from nova_agent_types import Observation

class ObservationEngine:
    def success(self, tool:str, result:dict, files:list[str])->Observation:
        return Observation(tool, True, result.get("summary") or result.get("currentStep") or f"{tool} produced output.", result, files)
    def failure(self, tool:str, error:Exception)->Observation: return Observation(tool, False, f"{tool} failed.", error=str(error))
    def needs_fix(self, observation:Observation)->bool: return not observation.ok
