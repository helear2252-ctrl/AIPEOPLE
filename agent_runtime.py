"""Run: python agent_runtime.py, then open http://127.0.0.1:8080/nova.html"""
from __future__ import annotations
import json, threading, uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agent_stream import AgentEventStream
from agent_orchestrator import AgentOrchestrator

ROOT=Path(__file__).resolve().parent; app=FastAPI(title="NOVA Backend Agent Runtime", version="1.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://127.0.0.1:8080","http://localhost:8080"],allow_methods=["*"],allow_headers=["*"])
stream=AgentEventStream(); orchestrator=AgentOrchestrator(stream); tasks={}
class TaskRequest(BaseModel): userMessage: str; brain: str="localMock"

@app.post("/agent/task", status_code=202)
def create_task(req: TaskRequest):
    task_id=uuid.uuid4().hex
    task={"taskId":task_id,"intent":"default","brain":req.brain,"status":"planning","currentStep":"Planning task","steps":[],"toolCalls":[],"cursor":{"x":0,"y":0,"action":"wait"},"output":{},"files":[]}
    tasks[task_id]=task; stream.publish(task_id,"task_created",{"task":task})
    threading.Thread(target=orchestrator.run,args=(task,req.userMessage,req.brain),daemon=True).start(); return task

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

INTERIOR_STUDIO_DIR=ROOT/"interior-studio"/"dist"
if INTERIOR_STUDIO_DIR.is_dir():
    app.mount("/interior-studio",StaticFiles(directory=INTERIOR_STUDIO_DIR,html=True),name="interior-studio")
app.mount("/",StaticFiles(directory=ROOT,html=True),name="nova")
if __name__ == "__main__":
    import uvicorn; uvicorn.run(app,host="127.0.0.1",port=8080)
