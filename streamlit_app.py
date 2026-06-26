import streamlit as st
import requests
import time

st.set_page_config(
    page_title="NOVA Agent Workbench",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom premium styling and default UI hiding
st.markdown("""
<style>
/* Hide default Streamlit headers, footers and sidebars */
#MainMenu {visibility: hidden;}
header {visibility: hidden;}
footer {visibility: hidden;}
div[data-testid="stDecoration"] {display: none;}
div[data-testid="stSidebar"] {display: none;}

/* Modern dark mode styling override */
.stApp {
    background-color: #0f172a;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
}
.report-card {
    background: rgba(30, 41, 59, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
}
.log-container {
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
    height: 350px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 13px;
}
.log-entry {
    margin-bottom: 8px;
    line-height: 1.4;
}
.log-timestamp {
    color: #64748b;
}
.log-source {
    color: #38bdf8;
    font-weight: bold;
}
.log-message {
    color: #cbd5e1;
}
.log-level-error {
    color: #f43f5e;
}
.log-level-warning {
    color: #fbbf24;
}
</style>
""", unsafe_allow_html=True)

API_URL = "http://127.0.0.1:8787"

def fetch_data(endpoint):
    try:
        response = requests.get(f"{API_URL}{endpoint}", timeout=2)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    return None

# Fetch current state
status_data = fetch_data("/api/agent/status")

if not status_data:
    st.error("Cannot connect to FastAPI control server on port 8787.")
    time.sleep(2)
    st.rerun()

session_id = status_data.get("session_id")
task_name = status_data.get("task", "No Active Task")
status = status_data.get("status", "idle")
error_message = status_data.get("error_message")
output_file = status_data.get("output_file")

# Render header
st.markdown(f"### 🤖 NOVA Agent Workstation <span style='font-size: 14px; color: #64748b;'>Session: {session_id or 'N/A'}</span>", unsafe_allow_html=True)

# Build status badge
status_colors = {
    "idle": "#64748b",
    "running": "#38bdf8",
    "completed": "#10b981",
    "error": "#ef4444",
    "missing_api_key": "#fbbf24"
}
badge_color = status_colors.get(status, "#64748b")
st.markdown(f"""
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
    <div><strong>Task:</strong> {task_name}</div>
    <div style="margin-left: auto; background: {badge_color}22; border: 1px solid {badge_color}; color: {badge_color}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
        {status}
    </div>
</div>
""", unsafe_allow_html=True)

if status == "missing_api_key":
    st.warning(f"⚠️ **Missing API Keys:** {error_message or 'Please configure GEMINI_API_KEY or OPENAI_API_KEY in the environment.'}")
elif status == "error":
    st.error(f"❌ **Task Failed:** {error_message or 'An unexpected error occurred.'}")

# Layout
col1, col2 = st.columns([1.3, 1])

with col1:
    st.subheader("🖥️ Live Browser View")
    
    # Try fetching cursor coordinates
    cursor = fetch_data("/api/agent/cursor") or {"x": 50.0, "y": 50.0, "action": "none"}
    x_pct = cursor.get("x", 50.0)
    y_pct = cursor.get("y", 50.0)
    action = cursor.get("action", "none")
    
    # Render browser view with virtual cursor overlay
    cursor_html = f"""
    <div style="position: relative; width: 100%; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; background: #020617; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <img src="{API_URL}/api/agent/screenshot?t={time.time()}" style="width: 100%; height: auto; display: block;" />
        <!-- Virtual Cursor -->
        <div style="position: absolute; left: {x_pct}%; top: {y_pct}%; transform: translate(-50%, -50%); pointer-events: none; z-index: 999;">
    """
    
    if action == "click":
        cursor_html += """
            <div class="cursor-ripple"></div>
            <span style="font-size: 24px;">🎯</span>
        """
    elif action == "type":
        cursor_html += """
            <div class="cursor-typing-glow"></div>
            <span style="font-size: 24px;">⌨️</span>
        """
    else:
        cursor_html += """
            <span style="font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">🖱️</span>
        """
        
    cursor_html += """
        </div>
    </div>
    <style>
    .cursor-ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 10px;
        height: 10px;
        background: rgba(56, 189, 248, 0.4);
        border: 2px solid #38bdf8;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        animation: ripple-anim 0.8s ease-out infinite;
    }
    .cursor-typing-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 28px;
        height: 28px;
        background: rgba(234, 179, 8, 0.25);
        border: 2px solid #eab308;
        border-radius: 6px;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 12px #eab308;
        animation: pulse-anim 1s infinite alternate;
    }
    @keyframes ripple-anim {
        0% { width: 10px; height: 10px; opacity: 1; }
        100% { width: 60px; height: 60px; opacity: 0; }
    }
    @keyframes pulse-anim {
        0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
    }
    </style>
    """
    st.components.v1.html(cursor_html, height=520, scrolling=False)

with col2:
    st.subheader("📜 Agent Loop Activity Logs")
    logs = fetch_data("/api/agent/logs") or []
    
    log_content = ""
    for log in reversed(logs): # Show newest logs first or sorted
        ts = log.get("timestamp", "")
        src = log.get("source", "")
        msg = log.get("message", "")
        lvl = log.get("level", "info")
        
        lvl_class = f"log-level-{lvl}" if lvl in ["warning", "error"] else ""
        
        log_content += f"""
        <div class="log-entry">
            <span class="log-timestamp">[{ts}]</span>
            <span class="log-source">[{src}]</span>:
            <span class="log-message {lvl_class}">{msg}</span>
        </div>
        """
        
    st.markdown(f"""
    <div class="log-container">
        {log_content if log_content else "<div style='color: #64748b; font-style: italic;'>Waiting for log entries...</div>"}
    </div>
    """, unsafe_allow_html=True)
    
    if status == "completed" and output_file:
        st.subheader("📄 Generated Markdown Report")
        output_data = fetch_data("/api/agent/output")
        if output_data:
            content = output_data.get("content", "")
            path = output_data.get("path", "")
            st.info(f"💾 **Output Path:** `{path}`")
            with st.expander("Preview Report Summary", expanded=True):
                st.markdown(content)

# Continuous auto-refresh while the agent is running
if status == "running":
    time.sleep(1)
    st.rerun()
