"""Safe, observable NOVA tools."""
from __future__ import annotations
from pathlib import Path
from interior_render_agent import InteriorRenderAgent

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT / "generated_projects"

class AgentTool:
    name = "AgentTool"
    def run(self, message: str, emit, context=None): raise NotImplementedError

class InteriorRenderTool(AgentTool):
    name = "InteriorRenderTool"
    def run(self, message: str, emit, context=None):
        task_id = (context or {}).get("taskId", "local-render")
        return InteriorRenderAgent(ROOT).run(task_id, message, emit)

class Interior3DTool(AgentTool):
    name = "Interior3DTool"
    def run(self, message: str, emit, context=None):
        spec = {"style": "modern cafe interior", "objects": [{"type":"floor","material":"warm wood"},{"type":"wall","material":"plaster"},{"type":"counter","material":"wood + stone"},{"type":"tables","count":4},{"type":"chairs","count":12},{"type":"pendantLights","count":3},{"type":"plants","count":4}], "lighting":"warm interior lighting", "camera":"three-quarter perspective", "layers":["shell","counter","seating","lighting","material","decor"]}
        emit("tool_output", {"sceneSpec": spec}); return {"sceneSpec": spec, "summary": "Interactive 3D cafe scene ready."}, []

class BrowserAutomationTool(AgentTool):
    name = "BrowserAutomationTool"
    def run(self, message: str, emit, context=None):
        output = {"targetSite":"Vieshow Cinemas","officialUrl":"https://www.vscinemas.com.tw/","safetyMode":"stop_before_payment","automationMode":"frontend_preview","futureEngine":"playwright_ready","openOfficialSite":True,"currentStep":"review_before_payment","frontendPreview":True}
        emit("tool_output", output); emit("tool_waiting_for_user", {"reason":"Login, verification and payment require user control."})
        return output, []

class WebsiteBuilderTool(AgentTool):
    name = "WebsiteBuilderTool"
    def run(self, message: str, emit, context=None):
        model = {"projectName":"fashion-store","brandName":"ATELIER / 01","style":"premium editorial ice blue","sections":["header","hero","categories","products","lookbook","footer"],"products":[{"name":"Form Jacket","price":"NT$ 6,980","category":"Outerwear"},{"name":"Glass Knit","price":"NT$ 3,280","category":"Knitwear"},{"name":"Motion Trouser","price":"NT$ 4,680","category":"Essentials"},{"name":"Orbit Bag","price":"NT$ 3,980","category":"Accessories"}]}
        folder = PROJECT_ROOT / model["projectName"]; folder.mkdir(parents=True, exist_ok=True)
        cards = "".join(f'<article><div></div><h2>{p["name"]}</h2><p>{p["price"]}</p></article>' for p in model["products"])
        files = {
          "index.html": f'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{model["brandName"]}</title><link rel="stylesheet" href="style.css"></head><body><header><b>{model["brandName"]}</b><nav>New Arrival　Lookbook　Best Seller</nav></header><main><section class="hero"><small>FUTURE ESSENTIALS</small><h1>Wear what comes next.</h1><button>Explore collection</button></section><section class="products">{cards}</section><section class="lookbook"><h2>Engineered layers.</h2></section></main><footer>© 2026 {model["brandName"]}</footer><script src="script.js"></script></body></html>',
          "style.css": '*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial;color:#173044;background:#edf6fb}header{display:flex;justify-content:space-between;padding:24px 6vw;background:#ffffffc9}.hero{min-height:65vh;padding:15vh 8vw;background:radial-gradient(circle at 80% 20%,#9bdcff,transparent 32%)}h1{font-size:clamp(52px,9vw,118px);max-width:800px;margin:18px 0}.products{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding:7vw}.products article{padding:14px;border-radius:24px;background:#fff}.products article div{height:250px;border-radius:18px;background:linear-gradient(145deg,#d8e8f0,#688296)}.lookbook{margin:5vw;padding:10vw;color:#fff;border-radius:32px;background:#17384e}footer{padding:35px;text-align:center}@media(max-width:760px){nav{display:none}.products{grid-template-columns:1fr 1fr}}',
          "script.js": 'document.querySelector("button").addEventListener("click",()=>document.querySelector(".products").scrollIntoView({behavior:"smooth"}));'
        }
        paths=[]
        for name, content in files.items(): (folder/name).write_text(content, encoding="utf-8"); paths.append(f"generated_projects/fashion-store/{name}")
        emit("tool_output", {"siteModel":model,"files":paths,"fileContents":files}); return {"siteModel":model,"previewUrl":"/generated_projects/fashion-store/index.html","fileContents":files}, paths

class FileWorkspaceTool(AgentTool):
    name = "FileWorkspaceTool"
    def run(self, message: str, emit, context=None): return {"summary":"Workspace ready."}, []

TOOLS = {tool.name: tool for tool in (InteriorRenderTool(), Interior3DTool(), BrowserAutomationTool(), WebsiteBuilderTool(), FileWorkspaceTool())}

class ToolExecutor:
    def execute(self, name: str, message: str, emit, context=None):
        tool = TOOLS[name]; emit("tool_started", {"tool":name});
        try:
            result = tool.run(message, emit, context); emit("tool_completed", {"tool":name}); return result
        except Exception as exc:
            emit("tool_failed", {"tool":name,"error":str(exc)}); raise
