class NovaToolRouter:
    ROUTES={"interior_design":["InteriorDesignTool","FinalBeautyRenderTool","FileWorkspaceTool"],"browser_booking":["BrowserBookingTool","BrowserUseTool"],
      "website_builder":["WebsiteBuilderTool","FileWorkspaceTool"],"code_builder":["CodeBuilderTool","FileWorkspaceTool"],
      "research":["ResearchTool","BrowserUseTool"],"file_workspace":["FileWorkspaceTool"],"general_assistant":["ResearchTool"]}
    def select(self,intent:str)->list[str]: return list(self.ROUTES.get(intent,self.ROUTES["general_assistant"]))
