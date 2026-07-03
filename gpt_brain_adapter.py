"""GPT planning adapter. Emits visible summaries only; never requests private reasoning."""
import json, urllib.request
from nova_runtime_config import NovaRuntimeConfig

class GPTBrainAdapter:
    name = "GPTBrainAdapter"
    def __init__(self, registry, planner, router, config=None): self.registry, self.planner, self.router, self.config = registry, planner, router, config or NovaRuntimeConfig.load()
    @property
    def available(self): return bool(self.config.openai_api_key)
    def plan(self, user_prompt):
        if not self.available: raise RuntimeError("openai_api_key_unavailable")
        schema = {"brainProvider":self.name,"intent":"general_assistant","confidence":0.0,"plan":[],"selectedTools":[],"safetyLevel":"safe","requiresUserConfirmation":False}
        prompt = "Return JSON only. Classify and plan with short visible operation summaries, never chain-of-thought. Available tools: " + json.dumps(self.registry.catalog()) + "\nUser: " + user_prompt
        body = json.dumps({"model":self.config.openai_model,"messages":[{"role":"system","content":"You are NOVA's safe task planner. Output only the requested public JSON plan."},{"role":"user","content":prompt}],"response_format":{"type":"json_object"}}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", body, {"Authorization":"Bearer "+self.config.openai_api_key,"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=45) as response: result=json.loads(response.read())
        value=json.loads(result["choices"][0]["message"]["content"]); schema.update(value); return schema
    def fallback(self, user_prompt):
        intent=self.planner.detect_intent(user_prompt); tools=self.router.select(intent); plan=self.planner.create_plan(user_prompt,intent,tools)
        return {"brainProvider":"DeterministicFallback","intent":intent,"confidence":1.0,"plan":[{"stepId":f"step_{i:03d}","title":s,"visibleAction":s,"tool":None,"status":"pending"} for i,s in enumerate(plan.steps,1)],"selectedTools":tools,"safetyLevel":"safe","requiresUserConfirmation":False}

