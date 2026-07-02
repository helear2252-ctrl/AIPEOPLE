from agent_tools import BrowserAutomationTool, FileWorkspaceTool, Interior3DTool, WebsiteBuilderTool
from final_beauty_render_tool import FinalBeautyRenderTool
from nova_agent_types import ToolDescriptor

class PlaceholderTool:
    def __init__(self,name): self.name=name
    def run(self,message,emit): return {"summary":f"{self.name} is registered as a placeholder.","placeholder":True},[]
class PassiveTool:
    def __init__(self,name,summary): self.name,self.summary=name,summary
    def run(self,message,emit): return {"summary":self.summary},[]

class NovaToolRegistry:
    def __init__(self):
        interior=Interior3DTool(); beauty=FinalBeautyRenderTool(); booking=BrowserAutomationTool(); website=WebsiteBuilderTool(); workspace=FileWorkspaceTool()
        self._tools={"InteriorDesignTool":interior,"Interior3DTool":interior,"BrowserBookingTool":booking,
          "BrowserAutomationTool":booking,"WebsiteBuilderTool":website,"FileWorkspaceTool":workspace,"FinalBeautyRenderTool":beauty,
          "CodeBuilderTool":PassiveTool("CodeBuilderTool","Code implementation plan ready."),
          "ResearchTool":PassiveTool("ResearchTool","Research synthesis ready."),
          "ComputerUseTool":PlaceholderTool("ComputerUseTool"),"BrowserUseTool":PlaceholderTool("BrowserUseTool"),"RenderTool":PlaceholderTool("RenderTool")}
        self._descriptors={
          "InteriorDesignTool":ToolDescriptor("InteriorDesignTool","Create spatial specifications and interactive 3D drafts."),
          "Interior3DTool":ToolDescriptor("Interior3DTool","Existing NOVA interactive 3D engine."),
          "FinalBeautyRenderTool":ToolDescriptor("FinalBeautyRenderTool","Create a premium final interior proposal render using a local fallback provider."),
          "BrowserBookingTool":ToolDescriptor("BrowserBookingTool","Prepare cinema booking up to protected actions.",True,"high"),
          "BrowserAutomationTool":ToolDescriptor("BrowserAutomationTool","Existing NOVA browser automation engine.",True,"high"),
          "WebsiteBuilderTool":ToolDescriptor("WebsiteBuilderTool","Generate complete website project files."),
          "CodeBuilderTool":ToolDescriptor("CodeBuilderTool","Plan and produce source code.",False,"medium"),
          "ResearchTool":ToolDescriptor("ResearchTool","Collect and synthesize information."),
          "FileWorkspaceTool":ToolDescriptor("FileWorkspaceTool","Read and write within the NOVA workspace.",False,"medium"),
          "ComputerUseTool":ToolDescriptor("ComputerUseTool","Operate a user computer with confirmation boundaries.",True,"high","placeholder"),
          "BrowserUseTool":ToolDescriptor("BrowserUseTool","Navigate browser pages with confirmation boundaries.",True,"medium","placeholder"),
          "RenderTool":ToolDescriptor("RenderTool","Render visual artifacts from structured specifications.",False,"safe","placeholder")}
    def get(self,name):
        if name not in self._tools: raise KeyError(f"Tool not registered: {name}")
        return self._tools[name]
    def describe(self,name)->dict: return self._descriptors[name].to_dict()
    def catalog(self)->list[dict]: return [value.to_dict() for value in self._descriptors.values()]
