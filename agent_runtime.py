"""Run: python agent_runtime.py, then open http://127.0.0.1:8080/nova.html"""
from __future__ import annotations
import json, os, threading, uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent_stream import AgentEventStream
from nova_agent_core import NovaUniversalAgentCore
from nova_runtime_config import NovaRuntimeConfig

ROOT=Path(__file__).resolve().parent; app=FastAPI(title="NOVA Backend Agent Runtime", version="1.0")
RENDER_TIMEOUT_SECONDS=max(480,int(os.getenv("NOVA_RENDER_TIMEOUT_SECONDS","480")))
os.environ.setdefault("NOVA_RENDER_TIMEOUT_SECONDS",str(RENDER_TIMEOUT_SECONDS))
RUNTIME_CONFIG=NovaRuntimeConfig.load()
GENERATED_ASSETS_DIR=ROOT / "generated_assets"; GENERATED_ASSETS_DIR.mkdir(parents=True,exist_ok=True)
app.add_middleware(CORSMiddleware,allow_origins=["http://127.0.0.1:8080","http://localhost:8080"],allow_methods=["*"],allow_headers=["*"])
stream=AgentEventStream(); orchestrator=NovaUniversalAgentCore(stream); tasks={}
class TaskRequest(BaseModel): userMessage: str; brain: str="localMock"

@app.get("/agent/config")
def runtime_config():
    return {"gptBrainAvailable":bool(RUNTIME_CONFIG.openai_api_key),"renderTimeoutSeconds":RENDER_TIMEOUT_SECONDS,"apiKeyExposed":False}

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
