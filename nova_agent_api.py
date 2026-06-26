import os
import uuid
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NOVA Agent Control API", version="1.0.0")

# Enable CORS for local cross-origin communications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskStartRequest(BaseModel):
    task: str

class AgentSessionManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.session_id: Optional[str] = None
        self.task: str = ""
        self.status: str = "idle"  # idle, running, completed, error, missing_api_key
        self.logs: List[Dict[str, Any]] = []
        self.screenshot_path: Optional[str] = None
        self.cursor: Dict[str, Any] = {"x": 50.0, "y": 50.0, "action": "none"}
        self.output_file: Optional[str] = None
        self.error_message: Optional[str] = None
        self.cancel_requested: bool = False
        self.runner_thread: Optional[threading.Thread] = None

    def start_task(self, task: str) -> Dict[str, Any]:
        with self.lock:
            if self.status == "running":
                return {
                    "success": False,
                    "message": "Agent is already running another task.",
                    "session_id": self.session_id
                }
            
            # Reset session state
            self.session_id = str(uuid.uuid4())
            self.task = task
            self.status = "running"
            self.logs = []
            self.screenshot_path = None
            self.cursor = {"x": 50.0, "y": 50.0, "action": "none"}
            self.output_file = None
            self.error_message = None
            self.cancel_requested = False
            
            self.add_log("System", f"Starting new agent task: {task}", "info")
            
            # Import runner inline to avoid circular dependencies
            from nova_agent_runner import run_agent_loop
            self.runner_thread = threading.Thread(
                target=run_agent_loop,
                args=(self.task, self.session_id, self),
                daemon=True
            )
            self.runner_thread.start()
            
            return {
                "success": True,
                "session_id": self.session_id,
                "status": self.status
            }

    def stop_task(self) -> Dict[str, Any]:
        with self.lock:
            if self.status != "running":
                return {"success": False, "message": "No running task to stop."}
            self.cancel_requested = True
            self.add_log("System", "Cancellation requested by user.", "warning")
            return {"success": True, "message": "Cancellation request sent to agent."}

    def add_log(self, source: str, message: str, level: str = "info"):
        self.logs.append({
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "source": source,
            "message": message,
            "level": level
        })

    def update_state(self, status: str = None, screenshot_path: str = None, cursor: Dict[str, Any] = None, output_file: str = None, error_message: str = None):
        with self.lock:
            if status:
                self.status = status
            if screenshot_path:
                self.screenshot_path = screenshot_path
            if cursor:
                self.cursor = cursor
            if output_file:
                self.output_file = output_file
            if error_message:
                self.error_message = error_message

manager = AgentSessionManager()

@app.post("/api/agent/start")
def start_agent(request: TaskStartRequest):
    result = manager.start_task(request.task)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/agent/stop")
def stop_agent():
    result = manager.stop_task()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/agent/status")
def get_status():
    return {
        "session_id": manager.session_id,
        "task": manager.task,
        "status": manager.status,
        "error_message": manager.error_message,
        "output_file": manager.output_file,
    }

@app.get("/api/agent/screenshot")
def get_screenshot():
    if manager.screenshot_path and os.path.exists(manager.screenshot_path):
        return FileResponse(manager.screenshot_path, media_type="image/png")
    
    # Fallback to default placeholder image
    fallback_path = "assets/avatar/nova_working_placeholder.png"
    if os.path.exists(fallback_path):
        return FileResponse(fallback_path, media_type="image/png")
        
    raise HTTPException(status_code=404, detail="Screenshot not available yet")

@app.get("/api/agent/cursor")
def get_cursor():
    return manager.cursor

@app.get("/api/agent/logs")
def get_logs():
    return manager.logs

@app.get("/api/agent/output")
def get_output():
    if not manager.output_file or not os.path.exists(manager.output_file):
        raise HTTPException(status_code=404, detail="Output file not found")
    
    try:
        with open(manager.output_file, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read output file: {e}")
    
    return {
        "path": manager.output_file,
        "content": content
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("nova_agent_api:app", host="127.0.0.1", port=8787, reload=False)
