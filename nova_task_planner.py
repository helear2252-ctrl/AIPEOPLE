from nova_agent_types import AgentPlan, Intent

class NovaTaskPlanner:
    def detect_intent(self, message:str)->str:
        value=message.lower()
        rules=((Intent.INTERIOR_DESIGN,("室內","咖啡廳","3d 圖","3d圖","interior")),
               (Intent.BROWSER_BOOKING,("訂票","影城","電影票","booking","cinema","vieshow","威秀")),
               (Intent.WEBSITE_BUILDER,("網站","網頁","website","web site")),
               (Intent.CODE_BUILDER,("寫程式","程式碼","code","debug","api")),
               (Intent.RESEARCH,("查資料","研究","research","搜尋","調查")),
               (Intent.FILE_WORKSPACE,("檔案","文件","workspace","folder")))
        for intent, terms in rules:
            if any(term in value for term in terms): return intent.value
        return Intent.GENERAL_ASSISTANT.value
    def create_plan(self,message:str,intent:str,tools:list[str])->AgentPlan:
        steps={
          "interior_design":["Analyze design brief","Build spatial shell","Place furniture","Apply lighting and materials","Prepare 3D draft"],
          "browser_booking":["Identify official cinema","Find sessions","Select ticket options","Prepare seat review","Stop before payment"],
          "website_builder":["Define site direction","Build page structure","Create visual system","Write project files","Prepare preview"],
          "code_builder":["Understand requirements","Inspect workspace","Implement code","Validate output"],
          "research":["Define research scope","Collect sources","Compare evidence","Synthesize findings"],
          "file_workspace":["Inspect workspace","Plan file operations","Apply safe changes","Verify artifacts"],
          "general_assistant":["Understand request","Create approach","Produce response","Review result"]}[intent]
        return AgentPlan(intent,steps,tools,message)
