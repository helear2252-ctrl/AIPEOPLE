"""NOVA Agent API — Phase A1 local mock server only.

This module deliberately performs no LLM calls, browser automation, screenshots,
or text-to-speech generation. It exposes the API contract needed by later UI
phases while keeping every response explicit about mock mode.
"""

from __future__ import annotations

import asyncio
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Final

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel


SERVICE_NAME: Final = "NOVA Agent API"
MODE: Final = "mock"
COMPLETION_TEXT: Final = "已幫你完成，還有需要幫你做什麼嗎？"
OUTPUT_DIRECTORY: Final = os.path.join(
    os.path.expanduser("~"), "Desktop", "NOVA_Output"
)
OUTPUT_PATH: Final = os.path.join(OUTPUT_DIRECTORY, "mock_nova_task.md")
OUTPUT_CONTENT: Final = """This is MOCK output.
No real LLM Agent was executed.
No Playwright browser automation was executed.
No Google TTS audio was generated.
"""
ALLOWED_STATUSES: Final = {
    "idle",
    "running",
    "completed",
    "error",
    "missing_api_key",
    "stopped",
}
INITIAL_CURSOR: Final = {"x": 50, "y": 50, "clicking": False}


class UTF8JSONResponse(JSONResponse):
    """Keep non-ASCII JSON readable in Windows PowerShell 5 clients."""

    media_type = "application/json; charset=utf-8"


app = FastAPI(
    title=SERVICE_NAME,
    version="A1-mock",
    default_response_class=UTF8JSONResponse,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class TaskStartRequest(BaseModel):
    """A nullable default lets the endpoint return the required HTTP 400."""

    task: str | None = None


def utc_now() -> str:
    """Return a JSON-friendly UTC timestamp."""

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def make_initial_state() -> dict[str, Any]:
    return {
        "session_id": None,
        "task_text": "",
        "status": "idle",
        "started_at": None,
        "completed_at": None,
        "logs": [],
        "cursor": dict(INITIAL_CURSOR),
        "output_path": OUTPUT_PATH,
        "screenshot_status": "unavailable",
        "mode": MODE,
        "tts_status": "unavailable",
    }


mock_state: dict[str, Any] = make_initial_state()
state_lock = threading.RLock()
background_task: asyncio.Task[None] | None = None


@app.exception_handler(HTTPException)
async def http_exception_as_utf8_json(
    _request: Request, exc: HTTPException
) -> UTF8JSONResponse:
    return UTF8JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


def add_mock_log(message: str) -> None:
    """Append a structured log that cannot be mistaken for a real Agent log."""

    mock_state["logs"].append(
        {
            "timestamp": utc_now(),
            "mode": MODE,
            "message": message,
        }
    )


def set_status(status: str) -> None:
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"Unsupported NOVA mock status: {status}")
    mock_state["status"] = status


def create_mock_output() -> None:
    """Create only the explicit Phase A1 mock artifact."""

    os.makedirs(OUTPUT_DIRECTORY, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as output_file:
        output_file.write(OUTPUT_CONTENT)


async def run_mock_task(session_id: str) -> None:
    """Advance one session through clearly labeled mock steps in ~5.4 seconds."""

    steps = (
        (1.0, "Mock initializing NOVA Agent Workbench"),
        (1.1, "Mock preparing browser panel"),
        (1.2, "Mock simulating controlled agent steps"),
        (1.1, "Mock saving output"),
        (1.0, "Mock completed"),
    )

    try:
        for delay_seconds, message in steps:
            await asyncio.sleep(delay_seconds)
            with state_lock:
                if (
                    mock_state["session_id"] != session_id
                    or mock_state["status"] != "running"
                ):
                    return
                add_mock_log(message)

        with state_lock:
            if (
                mock_state["session_id"] == session_id
                and mock_state["status"] == "running"
            ):
                set_status("completed")
                mock_state["completed_at"] = utc_now()
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # Defensive guard: a mock failure must not stop Uvicorn.
        with state_lock:
            if mock_state["session_id"] == session_id:
                set_status("error")
                mock_state["completed_at"] = utc_now()
                add_mock_log(f"Mock error: {type(exc).__name__}")


@app.get("/")
async def service_root() -> dict[str, str]:
    return {"service": SERVICE_NAME, "mode": MODE, "status": "ok"}


@app.post("/api/agent/start")
async def start_agent(request: TaskStartRequest | None = None) -> dict[str, Any]:
    global background_task

    task_text = (request.task if request else "") or ""
    task_text = task_text.strip()
    if not task_text:
        raise HTTPException(status_code=400, detail="Task is required.")

    with state_lock:
        if mock_state["status"] == "running":
            return {
                "already_running": True,
                "session_id": mock_state["session_id"],
                "status": mock_state["status"],
                "mode": MODE,
            }

        session_id = str(uuid.uuid4())
        mock_state.update(
            {
                "session_id": session_id,
                "task_text": task_text,
                "status": "running",
                "started_at": utc_now(),
                "completed_at": None,
                "logs": [],
                "cursor": dict(INITIAL_CURSOR),
                "output_path": OUTPUT_PATH,
                "screenshot_status": "unavailable",
                "mode": MODE,
                "tts_status": "unavailable",
            }
        )
        add_mock_log("Mock task received")

        try:
            create_mock_output()
        except OSError as exc:
            set_status("error")
            mock_state["completed_at"] = utc_now()
            add_mock_log(f"Mock output creation failed: {type(exc).__name__}")
            raise HTTPException(
                status_code=500, detail="Unable to create the mock output file."
            ) from exc

        background_task = asyncio.create_task(run_mock_task(session_id))

        return {
            "already_running": False,
            "session_id": session_id,
            "status": mock_state["status"],
            "mode": MODE,
        }


@app.get("/api/agent/status")
async def get_status() -> dict[str, Any]:
    with state_lock:
        return {
            "status": mock_state["status"],
            "session_id": mock_state["session_id"],
            "task": mock_state["task_text"],
            "started_at": mock_state["started_at"],
            "completed_at": mock_state["completed_at"],
            "mode": MODE,
        }


@app.get("/api/agent/logs")
async def get_logs() -> dict[str, list[dict[str, Any]]]:
    with state_lock:
        return {"logs": [dict(log_entry) for log_entry in mock_state["logs"]]}


@app.get("/api/agent/cursor")
async def get_cursor() -> dict[str, Any]:
    with state_lock:
        return dict(mock_state["cursor"])


@app.get("/api/agent/output")
async def get_output() -> dict[str, Any]:
    with state_lock:
        output_path = mock_state["output_path"]
    return {"output_path": output_path, "exists": os.path.isfile(output_path)}


@app.get("/api/agent/screenshot")
async def get_screenshot() -> dict[str, Any]:
    return {
        "available": False,
        "mode": MODE,
        "message": "Screenshot is not available in Phase A1 mock server.",
    }


@app.post("/api/agent/stop")
async def stop_agent() -> dict[str, Any]:
    with state_lock:
        if mock_state["status"] == "running":
            set_status("stopped")
            mock_state["completed_at"] = utc_now()
            add_mock_log("Mock task stopped by user")
        return {
            "status": mock_state["status"],
            "session_id": mock_state["session_id"],
            "mode": MODE,
        }


@app.get("/api/agent/tts/status")
async def get_tts_status() -> dict[str, Any]:
    credential_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    credential_exists = bool(credential_path) and os.path.isfile(credential_path)
    return {
        "available": False,
        "mode": MODE,
        "provider": "google-cloud-text-to-speech",
        "credential_exists": credential_exists,
        "message": "Google Cloud TTS is not configured in Phase A1.",
    }


@app.post("/api/agent/tts/completion")
async def create_completion_tts() -> dict[str, Any]:
    return {
        "played": False,
        "audio_url": None,
        "text": COMPLETION_TEXT,
        "mode": MODE,
        "message": "Google Cloud TTS is not configured yet.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("nova_agent_api:app", host="127.0.0.1", port=8787, reload=False)
