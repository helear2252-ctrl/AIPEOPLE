class NovaToolRouter:
    ROUTES={"interior_design":["ProfessionalAssetPipelineTool","DesignQualityGateTool"],"browser_booking":["BrowserBookingTool","BrowserUseAdapter"],
      "website_builder":["WebsiteBuilderTool","FileWorkspaceTool"],"code_builder":["CodeBuilderTool","FileWorkspaceTool"],
      "research":["ResearchTool","BrowserUseAdapter"],"file_workspace":["FileWorkspaceTool"],"general_assistant":["ResearchTool"]}
    def select(self,intent:str)->list[str]: return list(self.ROUTES.get(intent,self.ROUTES["general_assistant"]))
