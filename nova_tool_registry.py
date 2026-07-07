from agent_tools import BrowserAutomationTool, FileWorkspaceTool, Interior3DTool, WebsiteBuilderTool
from design_asset_pipeline import ProfessionalAssetPipelineTool
from design_quality_gate import DesignQualityGateTool
from final_beauty_render_tool import FinalBeautyRenderTool
from nova_agent_types import ToolDescriptor
from browser_use_adapter import BrowserUseAdapter
from computer_use_adapter import ComputerUseAdapter
from codex_adapter import CodexAdapter
from nova_runtime_config import NovaRuntimeConfig

class PlaceholderTool:
    def __init__(self,name): self.name=name
    def run(self,message,emit): return {"summary":f"{self.name} is registered as a placeholder.","placeholder":True},[]
class PassiveTool:
    def __init__(self,name,summary): self.name,self.summary=name,summary
    def run(self,message,emit): return {"summary":self.summary},[]

class NovaToolRegistry:
    def __init__(self):
        interior=Interior3DTool(); beauty=FinalBeautyRenderTool(); booking=BrowserAutomationTool(); website=WebsiteBuilderTool(); workspace=FileWorkspaceTool(); pipeline=ProfessionalAssetPipelineTool(); quality=DesignQualityGateTool()
        self._tools={"InteriorDesignTool":interior,"Interior3DTool":interior,"BrowserBookingTool":booking,
          "BrowserAutomationTool":booking,"WebsiteBuilderTool":website,"FileWorkspaceTool":workspace,"FinalBeautyRenderTool":beauty,
          "ProfessionalAssetPipelineTool":pipeline,"DesignQualityGateTool":quality,
          "CodeBuilderTool":PassiveTool("CodeBuilderTool","Code implementation plan ready."),
          "ResearchTool":PassiveTool("ResearchTool","Research synthesis ready."),
          "GPTBrainAdapter":PlaceholderTool("GPTBrainAdapter"),"CodexAdapter":CodexAdapter(),"BrowserUseAdapter":BrowserUseAdapter(),"ComputerUseAdapter":ComputerUseAdapter(),"ComfyUIRenderProvider":PlaceholderTool("ComfyUIRenderProvider"),"GitTool":PlaceholderTool("GitTool"),"ComputerUseTool":PlaceholderTool("ComputerUseTool"),"BrowserUseTool":PlaceholderTool("BrowserUseTool"),"RenderTool":PlaceholderTool("RenderTool")}
        self._descriptors={
          "InteriorDesignTool":ToolDescriptor("InteriorDesignTool","Create spatial specifications and interactive 3D drafts."),
          "Interior3DTool":ToolDescriptor("Interior3DTool","Existing NOVA interactive 3D engine."),
          "ProfessionalAssetPipelineTool":ToolDescriptor("ProfessionalAssetPipelineTool","Inspect installed professional design assets and prepare a presentation payload."),
          "DesignQualityGateTool":ToolDescriptor("DesignQualityGateTool","Validate professional render assets and report presentation quality."),
          "FinalBeautyRenderTool":ToolDescriptor("FinalBeautyRenderTool","Create a premium final interior proposal render using a local fallback provider."),
          "BrowserBookingTool":ToolDescriptor("BrowserBookingTool","Prepare cinema booking up to protected actions.",True,"high"),
          "BrowserAutomationTool":ToolDescriptor("BrowserAutomationTool","Existing NOVA browser automation engine.",True,"high"),
          "WebsiteBuilderTool":ToolDescriptor("WebsiteBuilderTool","Generate complete website project files."),
          "CodeBuilderTool":ToolDescriptor("CodeBuilderTool","Plan and produce source code.",False,"medium"),
          "ResearchTool":ToolDescriptor("ResearchTool","Collect and synthesize information."),
          "FileWorkspaceTool":ToolDescriptor("FileWorkspaceTool","Read and write within the NOVA workspace.",False,"medium"),
          "ComputerUseTool":ToolDescriptor("ComputerUseTool","Operate a user computer with confirmation boundaries.",True,"high","placeholder"),
          "BrowserUseTool":ToolDescriptor("BrowserUseTool","Navigate browser pages with confirmation boundaries.",True,"medium","placeholder"),
          "RenderTool":ToolDescriptor("RenderTool","Render visual artifacts from structured specifications.",False,"safe","placeholder"),
          "GPTBrainAdapter":ToolDescriptor("GPTBrainAdapter","Plan tasks with GPT or deterministic fallback.",False,"safe","available" if NovaRuntimeConfig.load().openai_api_key else "unavailable"),
          "CodexAdapter":ToolDescriptor("CodexAdapter","Inspect, patch, and test code under safety controls.",True,"medium","available" if CodexAdapter().detect_codex_cli() else "unavailable"),
          "BrowserUseAdapter":ToolDescriptor("BrowserUseAdapter","Safely inspect browser pages and stop before protected actions.",True,"medium","placeholder"),
          "ComputerUseAdapter":ToolDescriptor("ComputerUseAdapter","Safely operate local tools under user control.",True,"high","placeholder"),
          "ComfyUIRenderProvider":ToolDescriptor("ComfyUIRenderProvider","Submit and collect ComfyUI render jobs."),
          "GitTool":ToolDescriptor("GitTool","Perform approved version-control operations.",True,"high","placeholder")}
    def get(self,name):
        if name not in self._tools: raise KeyError(f"Tool not registered: {name}")
        return self._tools[name]
    def describe(self,name)->dict:
        value=self._descriptors[name].to_dict(); value["visibleDescription"]=value["capability"]; return value
    def catalog(self)->list[dict]: return [self.describe(name) for name in self._descriptors]
