"""Phase A2 NOVA Streamlit workbench: read-only FastAPI mock telemetry."""

from __future__ import annotations

import html
from typing import Any

import requests
import streamlit as st


API_BASE = "http://127.0.0.1:8787"
FASTAPI_START_COMMAND = (
    r".\.venv\Scripts\python.exe -m uvicorn nova_agent_api:app "
    r"--host 127.0.0.1 --port 8787 --reload"
)
COMPLETION_TEXT = "已幫你完成，還有需要幫你做什麼嗎？"
GET_ENDPOINTS = {
    "status": "/api/agent/status",
    "logs": "/api/agent/logs",
    "cursor": "/api/agent/cursor",
    "output": "/api/agent/output",
    "screenshot": "/api/agent/screenshot",
    "tts": "/api/agent/tts/status",
}


st.set_page_config(
    page_title="NOVA Agent Workbench · Mock",
    page_icon="◈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
<style>
#MainMenu {visibility: hidden;}
header {visibility: hidden;}
footer {visibility: hidden;}
.block-container {padding-top: 1rem; padding-bottom: 1rem; max-width: 1400px;}
.stApp {
  color: #e6f5ff;
  background: radial-gradient(circle at 15% 0%, #0c3156 0, transparent 35%), #050914;
}
.nova-header, .nova-card {
  border: 1px solid rgba(56,189,248,.34);
  border-radius: 16px;
  background: rgba(7,17,35,.91);
  box-shadow: 0 16px 38px rgba(0,0,0,.25), 0 0 25px rgba(56,189,248,.08);
}
.nova-header {padding: 1.2rem 1.35rem; margin-bottom: 1rem;}
.nova-header h1 {margin: .3rem 0; color: #f0f9ff; font-size: clamp(1.8rem,4vw,2.8rem);}
.nova-header p, .muted {color: #8ca2bf;}
.kicker, .card-title {color: #67e8f9; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;}
.mock-chip {
  display: inline-block; margin-top: .75rem; padding: .38rem .68rem;
  border: 1px solid rgba(251,191,36,.44); border-radius: 999px;
  color: #fbbf24; background: rgba(251,191,36,.08); font-size: .75rem; font-weight: 800;
}
.nova-card {padding: 1rem; min-height: 100%;}
.card-title {margin-bottom: .75rem;}
.status-badge {display:inline-flex; padding:.35rem .65rem; border:1px solid currentColor; border-radius:999px; font-weight:800; text-transform:uppercase;}
.idle,.stopped {color:#94a3b8}.running {color:#38bdf8}.completed {color:#34d399}.error,.missing_api_key {color:#fb7185}
.data-grid {display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.6rem; margin-top:.8rem;}
.data-cell {padding:.65rem; border-radius:9px; background:rgba(15,31,53,.68); overflow-wrap:anywhere;}
.label {display:block; color:#8ca2bf; font-size:.68rem; text-transform:uppercase;}
.value {display:block; margin-top:.18rem; color:#e0f2fe; font: .8rem ui-monospace,Consolas,monospace;}
.browser {
  min-height:210px; display:grid; place-items:center; padding:1rem; text-align:center;
  border:1px dashed rgba(56,189,248,.42); border-radius:11px; background:#060f1e;
}
.cursor-stage {
  position:relative; min-height:170px; overflow:hidden; border:1px solid rgba(56,189,248,.25); border-radius:11px;
  background-image:linear-gradient(rgba(56,189,248,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.07) 1px,transparent 1px); background-size:24px 24px;
}
.cursor {position:absolute; width:18px; height:18px; transform:translate(-50%,-50%) rotate(-35deg); border:2px solid white; border-radius:70% 20% 70% 20%; background:#38bdf8; box-shadow:0 0 18px #38bdf8;}
.log-list {max-height:320px; overflow:auto;}
.log {margin:.45rem 0; padding:.6rem .7rem; border-left:2px solid #38bdf8; border-radius:7px; background:rgba(15,31,53,.65);}
.log small {color:#8ca2bf}.log div {color:#dbeafe}
.offline {padding:1.1rem; border:1px solid rgba(251,113,133,.45); border-radius:13px; background:rgba(66,15,32,.25); color:#fecdd3;}
@media(max-width:760px){.data-grid{grid-template-columns:1fr}}
</style>
""",
    unsafe_allow_html=True,
)


def safe(value: Any, fallback: str = "—") -> str:
    if value is None or value == "":
        return fallback
    return html.escape(str(value))


def fetch_api(path: str) -> tuple[dict[str, Any] | None, str | None]:
    """GET one endpoint; this display layer never mutates Agent state."""

    try:
        response = requests.get(f"{API_BASE}{path}", timeout=1.5)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return None, "Unexpected response type"
        return payload, None
    except (requests.RequestException, ValueError) as exc:
        return None, f"{type(exc).__name__}: {exc}"


def cell(label: str, value: Any) -> str:
    return (
        '<div class="data-cell">'
        f'<span class="label">{html.escape(label)}</span>'
        f'<span class="value">{safe(value)}</span></div>'
    )


def card(title: str, body: str) -> None:
    st.markdown(
        f'<section class="nova-card"><div class="card-title">{html.escape(title)}</div>{body}</section>',
        unsafe_allow_html=True,
    )


def render_header() -> None:
    st.markdown(
        """
<section class="nova-header">
  <div class="kicker">NOVA CONTROL SURFACE / PHASE A2</div>
  <h1>NOVA Agent Workbench</h1>
  <p>Read-only telemetry from the local FastAPI mock server.</p>
  <div class="mock-chip">MOCK MODE · DISPLAY ONLY</div>
</section>
<p class="muted">No real LLM Agent is running. · No Playwright browser is running. · No Google TTS is configured.</p>
""",
        unsafe_allow_html=True,
    )


def render_offline() -> None:
    st.markdown(
        """
<div class="offline"><strong>FastAPI mock server is not running.</strong><br>
Please start http://127.0.0.1:8787 first.</div>
""",
        unsafe_allow_html=True,
    )
    st.code(FASTAPI_START_COMMAND, language="powershell")


def render_status(status: dict[str, Any]) -> None:
    state = str(status.get("status", "idle")).lower()
    css_state = state if state in {
        "idle", "running", "completed", "stopped", "error", "missing_api_key"
    } else "idle"
    fields = "".join(
        [
            cell("Session ID", status.get("session_id")),
            cell("Task", status.get("task")),
            cell("Started", status.get("started_at")),
            cell("Completed", status.get("completed_at")),
            cell("Mode", status.get("mode", "mock")),
        ]
    )
    card(
        "01 / Task status",
        f'<span class="status-badge {css_state}">{safe(state)}</span>'
        f'<div class="data-grid">{fields}</div>',
    )


def render_browser(screenshot: dict[str, Any]) -> None:
    card(
        "02 / Mock browser preview",
        """
<div class="browser"><div><strong>Browser preview is not available in Phase A2.</strong><br>
<span class="muted">Real Playwright screenshots will be added in a later phase.</span></div></div>
"""
        + '<div class="data-grid">'
        + cell("Available", screenshot.get("available", False))
        + cell("Message", screenshot.get("message"))
        + "</div>",
    )


def render_cursor(cursor: dict[str, Any]) -> None:
    try:
        x = max(0.0, min(100.0, float(cursor.get("x", 50))))
        y = max(0.0, min(100.0, float(cursor.get("y", 50))))
    except (TypeError, ValueError):
        x, y = 50.0, 50.0
    clicking = bool(cursor.get("clicking", False))
    card(
        "03 / Mock cursor telemetry",
        f'<div class="cursor-stage"><div class="cursor" style="left:{x:.1f}%;top:{y:.1f}%;"></div></div>'
        f'<p class="muted">MOCK CURSOR · x={x:.1f} · y={y:.1f} · clicking={str(clicking).lower()}</p>',
    )


def render_logs(payload: dict[str, Any]) -> None:
    logs = payload.get("logs") or []
    if not logs:
        body = '<div class="log"><div>No logs yet.</div></div>'
    else:
        entries: list[str] = []
        for entry in reversed(logs):
            if isinstance(entry, dict):
                timestamp = safe(entry.get("timestamp"))
                message = safe(entry.get("message"), "Mock log")
            else:
                timestamp, message = "—", safe(entry)
            entries.append(
                f'<div class="log"><small>{timestamp} · MOCK</small><div>{message}</div></div>'
            )
        body = "".join(entries)
    card("04 / Mock activity logs · newest first", f'<div class="log-list">{body}</div>')


def render_output(output: dict[str, Any]) -> None:
    exists = bool(output.get("exists", False))
    note = "Mock output file exists." if exists else "Mock output file has not been created yet."
    card(
        "05 / Output artifact",
        '<div class="data-grid">'
        + cell("Output path", output.get("output_path"))
        + cell("Exists", exists)
        + f'</div><p class="muted">{html.escape(note)}</p>',
    )


def render_tts(tts: dict[str, Any]) -> None:
    fields = "".join(
        [
            cell("Available", tts.get("available", False)),
            cell("Provider", tts.get("provider")),
            cell("Credential exists", tts.get("credential_exists", False)),
            cell("Message", tts.get("message")),
        ]
    )
    card(
        "06 / Completion voice requirement",
        f'<div class="data-grid">{fields}</div>'
        f'<p class="muted"><strong>完成語音正式句子：</strong><br>{html.escape(COMPLETION_TEXT)}</p>'
        '<div class="mock-chip">Google Cloud TTS is not active in this phase.</div>',
    )


def render_dashboard() -> None:
    status, status_error = fetch_api(GET_ENDPOINTS["status"])
    if status_error or status is None:
        render_offline()
        return

    payloads: dict[str, dict[str, Any]] = {"status": status}
    endpoint_errors: list[str] = []
    for name, path in GET_ENDPOINTS.items():
        if name == "status":
            continue
        payload, error = fetch_api(path)
        payloads[name] = payload or {}
        if error:
            endpoint_errors.append(f"{name}: {error}")

    if endpoint_errors:
        st.warning("Some mock telemetry is unavailable: " + " | ".join(endpoint_errors))

    left, right = st.columns([1.05, 1.45], gap="large")
    with left:
        render_status(payloads["status"])
        st.write("")
        render_cursor(payloads["cursor"])
    with right:
        render_browser(payloads["screenshot"])
        st.write("")
        render_logs(payloads["logs"])

    st.write("")
    output_column, tts_column = st.columns(2, gap="large")
    with output_column:
        render_output(payloads["output"])
    with tts_column:
        render_tts(payloads["tts"])


render_header()
if st.button("Refresh status", help="Read the FastAPI mock telemetry again."):
    st.rerun()

# Streamlit 1.58 provides fragment auto-refresh without an external package.
if hasattr(st, "fragment"):
    st.fragment(run_every="2s")(render_dashboard)()
else:
    render_dashboard()
    st.caption("Automatic refresh is unavailable. Use Refresh status.")
