from nova_agent_types import AgentPlan, Intent

class NovaTaskPlanner:
    def detect_intent(self, message:str)->str:
        value=message.lower()
        rules=((Intent.INTERIOR_DESIGN,("室內","設計","3d","interior")),(Intent.BROWSER_BOOKING,("訂票","電影票","影城","booking","cinema","vieshow","威秀")),(Intent.WEBSITE_BUILDER,("網站","網頁","website","web site")),(Intent.CODE_BUILDER,("程式","修復","code","debug","api")),(Intent.RESEARCH,("研究","搜尋","research","查資料")),(Intent.FILE_WORKSPACE,("檔案","資料夾","workspace","folder")))
        for intent, terms in rules:
            if any(term in value for term in terms): return intent.value
        return Intent.GENERAL_ASSISTANT.value
    def create_plan(self,message:str,intent:str,tools:list[str])->AgentPlan:
        steps={"interior_design":["Analyze design brief","Generate room schema and draft","Load ComfyUI workflow","Render and collect final image","Display artifacts"],"browser_booking":["Search movie","Select theater","Select showtime","Select seat","Stop before payment"],"website_builder":["Define site direction","Build page structure","Generate project files","Prepare preview","Wait for save or export"],"code_builder":["Understand requirements","Inspect workspace","Implement code","Run tests"],"research":["Define research scope","Collect sources","Compare evidence","Synthesize findings"],"file_workspace":["Inspect workspace","Plan safe operations","Apply changes","Verify artifacts"],"general_assistant":["Understand request","Create approach","Produce response","Review result"]}[intent]
        return AgentPlan(intent,steps,tools,message)
