"""Run: python agent_runtime.py, then open http://127.0.0.1:8080/nova.html"""
from __future__ import annotations
import hashlib, json, logging, os, shutil, subprocess, threading, time, uuid
from pathlib import Path
from urllib.parse import urlsplit
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent_stream import AgentEventStream
from design_brief_agent import DESIGN_BRIEF_SCHEMA, DesignBriefGenerationError, detect_design_brief_cli, generateDesignBriefResult
from nova_agent_core import NovaUniversalAgentCore
from nova_runtime_config import NovaRuntimeConfig
from render_provider_factory import create_render_provider

ROOT=Path(__file__).resolve().parent; app=FastAPI(title="NOVA Backend Agent Runtime", version="1.0")
LOGGER=logging.getLogger("nova.runtime")
RENDER_TIMEOUT_SECONDS=max(480,int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS","480")))
os.environ.setdefault("NOVA_RENDER_TIMEOUT_SECONDS",str(RENDER_TIMEOUT_SECONDS))
RUNTIME_CONFIG=NovaRuntimeConfig.load()
GENERATED_ASSETS_DIR=ROOT / "generated_assets"; GENERATED_ASSETS_DIR.mkdir(parents=True,exist_ok=True)
app.add_middleware(CORSMiddleware,allow_origins=["http://127.0.0.1:8080","http://localhost:8080","http://127.0.0.1:5173","http://localhost:5173"],allow_methods=["*"],allow_headers=["*"])
stream=AgentEventStream(); orchestrator=NovaUniversalAgentCore(stream); tasks={}
class TaskRequest(BaseModel): userMessage: str; brain: str="localMock"
class DesignBriefRequest(BaseModel): userPrompt: str
class ConceptRenderRequest(BaseModel):
    brief: dict
    prompt: str
    variantName: str = "main"

def is_valid_png(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 1024:
        return False
    with path.open("rb") as file:
        return file.read(8) == b"\x89PNG\r\n\x1a\n"

@app.get("/agent/config")
def runtime_config():
    try: brief_cli=detect_design_brief_cli()
    except DesignBriefGenerationError: brief_cli={"provider":None,"command":None}
    return {"gptBrainAvailable":bool(RUNTIME_CONFIG.openai_api_key),"designBriefProvider":brief_cli["provider"],"renderTimeoutSeconds":RENDER_TIMEOUT_SECONDS,"renderProvider":RUNTIME_CONFIG.render_provider,"apiKeyExposed":False}

@app.get("/agent/design-brief/schema")
def design_brief_schema():
    try: brief_cli=detect_design_brief_cli()
    except DesignBriefGenerationError: brief_cli={"provider":None,"command":None}
    return {"provider":brief_cli["provider"],"command":brief_cli["command"],"schema":DESIGN_BRIEF_SCHEMA,"apiKeyConfigured":False}

@app.post("/agent/design-brief")
def create_design_brief(req: DesignBriefRequest):
    prompt=req.userPrompt.strip()
    if not prompt: raise HTTPException(400,"userPrompt is required")
    try:
        result=generateDesignBriefResult(prompt)
        return result
    except DesignBriefGenerationError as exc:
        raise HTTPException(503,str(exc))
    except Exception as exc:
        raise HTTPException(502,f"LLM design brief generation failed: {type(exc).__name__}")

@app.post("/agent/concept-render")
def create_concept_render(req: ConceptRenderRequest):
    if not req.prompt.strip():
        raise HTTPException(400, "prompt is required")
    codex_path = shutil.which("codex")
    if not codex_path:
        raise HTTPException(503, "Codex CLI is not available.")
    cache_key = {"brief": req.brief, "variantName": req.variantName, "promptVersion": "concept-four-angle-v1"}
    signature = hashlib.sha256(json.dumps(cache_key, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]
    output_dir = GENERATED_ASSETS_DIR / "concept_ai_renders" / signature
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_variant = "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in req.variantName.lower())[:32] or "main"
    output_name = f"concept_3d_{safe_variant}_{signature}.png"
    output_path = output_dir / output_name
    if is_valid_png(output_path):
        return {
            "provider": "codex-cli",
            "cached": True,
            "elapsedSeconds": 0,
            "imagePath": f"/generated_assets/concept_ai_renders/{signature}/{output_name}",
            "prompt": req.prompt,
            "command": ["codex", "exec", "--ephemeral", "--sandbox", "workspace-write", "-C", str(output_dir), "<prompt>"],
        }
    if output_path.exists():
        output_path.unlink()
    prompt = (
        req.prompt.strip()
        + f"\n\nSave a real raster PNG as {output_name} in the current directory. "
        "Do not create SVG, HTML, text art, a placeholder, or a markdown-only answer."
    )
    command = ["codex", "exec", "--ephemeral", "--sandbox", "workspace-write", "-C", str(output_dir), prompt]
    started = time.perf_counter()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=RENDER_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(504, f"Codex concept render timed out after {RENDER_TIMEOUT_SECONDS} seconds.") from exc
    elapsed = time.perf_counter() - started
    if completed.returncode != 0:
        message = (completed.stderr or completed.stdout or "Codex CLI failed.").strip()
        raise HTTPException(502, "Codex concept render failed: " + message.splitlines()[-1])
    if not output_path.exists():
        pngs = sorted(output_dir.glob("*.png"), key=lambda path: path.stat().st_mtime, reverse=True)
        if pngs:
            pngs[0].replace(output_path)
    if not is_valid_png(output_path):
        raise HTTPException(502, "Codex concept render completed but no PNG file was created.")
    return {
        "provider": "codex-cli",
        "cached": False,
        "elapsedSeconds": round(elapsed, 2),
        "imagePath": f"/generated_assets/concept_ai_renders/{signature}/{output_name}",
        "prompt": req.prompt,
        "command": ["codex", "exec", "--ephemeral", "--sandbox", "workspace-write", "-C", str(output_dir), "<prompt>"],
        "stdout": completed.stdout,
    }

@app.on_event("startup")
def log_render_provider_status():
    provider=create_render_provider(ROOT,RUNTIME_CONFIG.render_provider)
    health=provider.check()
    host=urlsplit(RUNTIME_CONFIG.colab_base_url).hostname or "local"
    timeout=RUNTIME_CONFIG.colab_max_poll_seconds if RUNTIME_CONFIG.render_provider=="colab" else RUNTIME_CONFIG.render_timeout_seconds
    LOGGER.info("render_provider=%s host=%s timeout=%s health=%s",provider.name,host,timeout,health.status)

@app.post("/agent/task", status_code=202)
def create_task(req: TaskRequest):
    task_id=uuid.uuid4().hex
    task={"taskId":task_id,"intent":"general_assistant","brain":req.brain,"status":"task_received","currentStep":"Task received","steps":[],"toolCalls":[],"cursor":{"x":0,"y":0,"action":"wait"},"output":{},"files":[],"renderTimeoutSeconds":RENDER_TIMEOUT_SECONDS}
    tasks[task_id]=task; stream.publish(task_id,"task_created",{"task":task})
    threading.Thread(target=orchestrator.run,args=(task,req.userMessage,req.brain),name=task_id,daemon=True).start(); return task

@app.get("/agent/task/{task_id}")
def get_task(task_id: str):
    if task_id not in tasks: raise HTTPException(404,"Task not found")
    return tasks[task_id]

@app.get("/agent/task/{task_id}/events")
def task_events(task_id: str, cursor: int=Query(0,ge=0)):
    if task_id not in tasks: raise HTTPException(404,"Task not found")
    def generate():
        current=cursor
        while True:
            events=stream.wait(task_id,current)
            if not events: yield ": keepalive\n\n"; continue
            for event in events:
                current=event["id"]+1; yield f'id: {event["id"]}\nevent: {event["type"]}\ndata: {json.dumps(event,ensure_ascii=False)}\n\n'
            if tasks[task_id]["status"] in ("completed","failed","waiting_for_user"): break
    return StreamingResponse(generate(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

app.mount("/generated_assets",StaticFiles(directory=GENERATED_ASSETS_DIR),name="generated_assets")
app.mount("/",StaticFiles(directory=ROOT,html=True),name="nova")
if __name__ == "__main__":
    import uvicorn; uvicorn.run(app,host="127.0.0.1",port=8080)
