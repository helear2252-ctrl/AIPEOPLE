import streamlit as st
import json
import os
import threading
import socket
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import custom modules
from modules.avatar_interface import AvatarInterface
from modules.ai_provider import AIProvider
from modules.memory_layer import MemoryLayer
from modules.voice import VoiceLayer
from modules.research_layer import ResearchLayer
from modules.system_status import SystemStatus

# Paths
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "avatar_settings.json")

# Initialize modules
avatar_interface = AvatarInterface(CONFIG_PATH)
memory_layer = MemoryLayer()
ai_provider = AIProvider(avatar_interface, memory_layer)
research_layer = ResearchLayer(avatar_interface)
system_status = SystemStatus()

# ==========================================================================
# FastAPI Backend Server Setup (Runs in background)
# ==========================================================================
api = FastAPI(title="NOVA AI API", description="API Backend for NOVA Digital Human")

# Enable CORS for static GitHub Pages frontend
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default_session"

class SettingsModel(BaseModel):
    project_name: str
    subtitle: str
    persona: str
    gender: str
    age: int
    hair_style: str
    hair_color: str
    face_style: str
    outfit: str
    personality: str
    speaking_style: str
    voice_enabled: bool
    search_provider: str
    search_api_key: str

@api.get("/api/settings")
def get_settings():
    return avatar_interface.load_settings()

@api.post("/api/settings")
def update_settings(settings: SettingsModel):
    try:
        # Load existing config to retain image paths
        existing_settings = avatar_interface.load_settings()
        
        # Merge new settings
        new_data = settings.dict()
        new_data["avatar_images"] = existing_settings.get("avatar_images", {
            "Female": "assets/avatar_female.png",
            "Male": "assets/avatar_male.png"
        })
        
        success = avatar_interface.save_settings(new_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save settings")
        return {"status": "success", "message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    try:
        user_msg = request.message
        session_id = request.session_id
        
        # Add to memory
        memory_layer.add_message(session_id, "user", user_msg)
        
        # Generate response
        history = memory_layer.get_history(session_id)
        response_text = ai_provider.generate_response(user_msg, history, session_id=session_id)
        
        # Add response to memory
        memory_layer.add_message(session_id, "secretary", response_text)
        
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api.get("/api/status")
def get_status():
    metrics = system_status.get_metrics()
    metrics["memory_layer_status"] = {
        "demo_mode": memory_layer.demo_mode,
        "db_type": memory_layer.db_type,
        "store_path": memory_layer.store_path
    }
    return metrics

# Port checker & Background server initiator
def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0

def run_api_server():
    uvicorn.run(api, host="127.0.0.1", port=8010, log_level="warning")

if not is_port_open(8010):
    api_thread = threading.Thread(target=run_api_server, daemon=True)
    api_thread.start()

# ==========================================================================
# Streamlit Frontend Administration Panel
# ==========================================================================

# Page Configurations
st.set_page_config(
    page_title="NOVA AI Backend Control",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Shared Styling CSS Injection for Palette Alignment
st.markdown("""
    <style>
    /* Dark Theme Alignments matching Frontend */
    .stApp {
        background-color: #030712 !important;
        color: #f8fafc !important;
    }
    div[data-testid="stSidebar"] {
        background-color: #0b0f19 !important;
        border-right: 1px solid rgba(56, 189, 248, 0.15) !important;
    }
    
    /* Input Elements styling (simulate glassmorphism) */
    input, select, textarea {
        background-color: rgba(15, 23, 42, 0.6) !important;
        color: #f8fafc !important;
        border: 1px solid rgba(56, 189, 248, 0.15) !important;
    }
    
    /* Tab Styling */
    button[data-baseweb="tab"] {
        color: #94a3b8 !important;
        font-family: 'Outfit', sans-serif !important;
        font-weight: 500 !important;
    }
    button[aria-selected="true"] {
        color: #38bdf8 !important;
        border-bottom-color: #38bdf8 !important;
    }

    /* Cards and Buttons */
    div.stButton > button {
        background-color: #38bdf8 !important;
        color: #030712 !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        border: none !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15) !important;
    }
    div.stButton > button:hover {
        box-shadow: 0 0 15px rgba(56, 189, 248, 0.45) !important;
        background-color: #e0f2fe !important;
    }
    
    /* Headers */
    h1, h2, h3 {
        font-family: 'Outfit', sans-serif !important;
        color: #f8fafc !important;
        letter-spacing: -0.5px;
    }
    .accent-header {
        color: #38bdf8;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
    }
    .metric-card {
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(56, 189, 248, 0.15);
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 0.75rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        backdrop-filter: blur(8px);
    }
    .metric-label {
        font-size: 0.7rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.8px;
    }
    .metric-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #38bdf8;
        text-shadow: 0 0 6px rgba(56, 189, 248, 0.2);
    }
    </style>
""", unsafe_allow_html=True)

# Load settings
config_data = avatar_interface.load_settings()

# Sidebar Setup
with st.sidebar:
    st.markdown("### 🤖 NOVA AI Core")
    st.markdown("<p style='font-size:0.8rem; color:#94a3b8; margin-top:-10px;'>Your Intelligent Digital Human Assistant</p>", unsafe_allow_html=True)
    st.write("---")
    
    # System status display
    st.write("📋 **System Health Status**")
    metrics = system_status.get_metrics()
    
    st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">API Status</div>
            <div class="metric-value" style="color: #10b981;">{metrics['api_status']}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">System Uptime</div>
            <div class="metric-value">{metrics['uptime_human']}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">CPU Utilization</div>
            <div class="metric-value">{metrics['cpu_percent']}%</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Memory Utilization</div>
            <div class="metric-value">{metrics['memory_percent']}%</div>
        </div>
    """, unsafe_allow_html=True)

# Main Title Area
st.markdown("<h1>NOVA AI <span class='accent-header'>Control Dashboard</span></h1>", unsafe_allow_html=True)
st.markdown("<p style='color:#94a3b8;'>Enterprise-Grade Executive Digital Secretary Central Administration</p>", unsafe_allow_html=True)

# Tabs
tab_settings, tab_chat, tab_memory, tab_architecture = st.tabs([
    "👤 Digital Human Settings", 
    "💬 Interactive Chat Console", 
    "🧠 Memory Settings",
    "🏛️ System Architecture"
])

# Tab 1: Settings
with tab_settings:
    st.subheader("Configure Secretary Parameters")
    st.write("Changes saved here are instantly synchronized with the Frontend display.")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Standard configuration text fields
        proj_name = st.text_input("Project Name", value=config_data.get("project_name", "NOVA AI"))
        subtitle = st.text_input("Subtitle", value=config_data.get("subtitle", "Your Intelligent Digital Human Assistant"))
        persona = st.text_input("Persona / Role Description", value=config_data.get("persona", "Executive Digital Secretary"))
        gender = st.selectbox("Gender Selection", ["Female", "Male"], index=0 if config_data.get("gender", "Female") == "Female" else 1)
        age = st.number_input("Avatar Age", min_value=18, max_value=80, value=config_data.get("age", 28))
        voice_enabled = st.checkbox("Voice Output Enabled", value=config_data.get("voice_enabled", True))
        
    with col2:
        hair_style = st.text_input("Hair Style Description", value=config_data.get("hair_style", "Corporate Bun"))
        hair_color = st.text_input("Hair Color", value=config_data.get("hair_color", "Dark Brown"))
        face_style = st.text_input("Facial Features Presets", value=config_data.get("face_style", "Warm Professional"))
        outfit = st.text_input("Outfit / Attire Style", value=config_data.get("outfit", "Navy Blue Blazer"))
        personality = st.text_input("Personality Attributes", value=config_data.get("personality", "Efficient, Professional, Courteous"))
        speaking_style = st.text_input("Speaking Style & Tone", value=config_data.get("speaking_style", "Clear, Formal, Reassuring"))

    st.write("---")
    st.subheader("🔍 Research Layer Settings")
    col_search1, col_search2 = st.columns(2)
    with col_search1:
        search_providers = ["Tavily", "SerpAPI", "Google", "Brave", "Bing", "Perplexity"]
        default_prov = config_data.get("search_provider", "Tavily")
        search_provider = st.selectbox("Search Provider", search_providers, index=search_providers.index(default_prov) if default_prov in search_providers else 0)
    with col_search2:
        search_api_key = st.text_input("Search API Key", type="password", value=config_data.get("search_api_key", ""), help="Leave blank to operate in Research Demo Mode.")

    if st.button("Save Configuration", use_container_width=True):
        updated_data = {
            "project_name": proj_name,
            "subtitle": subtitle,
            "persona": persona,
            "gender": gender,
            "age": age,
            "hair_style": hair_style,
            "hair_color": hair_color,
            "face_style": face_style,
            "outfit": outfit,
            "personality": personality,
            "speaking_style": speaking_style,
            "voice_enabled": voice_enabled,
            "search_provider": search_provider,
            "search_api_key": search_api_key,
            "avatar_images": config_data.get("avatar_images", {
                "Female": "assets/avatar_female.png",
                "Male": "assets/avatar_male.png"
            })
        }
        
        success = avatar_interface.save_settings(updated_data)
        if success:
            st.success("Configuration successfully written to config/avatar_settings.json! Please sync settings on your Frontend.")
        else:
            st.error("Failed to write configurations to disk.")

# Tab 2: Chat
with tab_chat:
    st.subheader("Console Interaction")
    st.write("Communicate directly with the active AI pipeline session.")
    
    # Initialize message list in Streamlit session state
    if "messages" not in st.session_state:
        st.session_state.messages = [{"role": "secretary", "content": "Hello, I am NOVA. As your Executive Digital Secretary, how may I assist you with your professional scheduling, research, or communications today?"}]
        
    # Clear session history
    if st.button("Reset Session Memory"):
        st.session_state.messages = [{"role": "secretary", "content": "Session memory cleared. Let me know how I can start fresh."}]
        memory_layer.clear_session("streamlit_session")
        st.experimental_rerun()
        
    # Render messages
    for msg in st.session_state.messages:
        role_label = "💼 NOVA" if msg["role"] == "secretary" else "👤 You"
        st.markdown(f"**{role_label}**: {msg['content']}")
        
    # Input box
    user_query = st.text_input("Message input", key="chat_console_input", label_visibility="collapsed", placeholder="Ask NOVA something...")
    
    if st.button("Send Message"):
        if user_query.strip():
            st.session_state.messages.append({"role": "user", "content": user_query})
            memory_layer.add_message("streamlit_session", "user", user_query)
            
            # Send to model pipeline
            response_text = ai_provider.generate_response(user_query, st.session_state.messages, session_id="streamlit_session")
            st.session_state.messages.append({"role": "secretary", "content": response_text})
            memory_layer.add_message("streamlit_session", "secretary", response_text)
            
            st.experimental_rerun()

# Tab 3: Memory Settings
with tab_memory:
    st.subheader("Memory Layer Administration")
    st.write("Manage short-term context states and long-term user preferences.")
    
    col_mem1, col_mem2 = st.columns(2)
    
    with col_mem1:
        st.markdown("### 🧠 Short-Term Memory (STM)")
        stm_status = memory_layer.get_stm_status("streamlit_session")
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Active Session ID</div>
            <div class="metric-value" style="font-size:1rem; color:#f8fafc;">streamlit_session</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Dialog History Count</div>
            <div class="metric-value" style="font-size:1rem; color:#38bdf8;">{stm_status['history_count']} messages</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Current Analysis Theme</div>
            <div class="metric-value" style="font-size:1rem; color:#38bdf8;">{stm_status['current_analysis_theme']}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Current Active Task</div>
            <div class="metric-value" style="font-size:1.1rem; color:#38bdf8;">{stm_status['current_task']}</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("**Recent Dialog Context Preview**")
        st.text_area("Recent User Question", value=stm_status['recent_user_question'], height=80, disabled=True)
        st.text_area("Recent NOVA Response", value=stm_status['recent_nova_response'], height=80, disabled=True)
        
        if st.button("Clear STM Session Memory", use_container_width=True):
            memory_layer.clear_session("streamlit_session")
            st.success("Short-term session memory cleared!")
            st.experimental_rerun()
            
    with col_mem2:
        st.markdown("### 💾 Long-Term Memory (LTM)")
        ltm_data = memory_layer.get_ltm_data()
        user_prefs = ltm_data.get("user_preferences", {})
        
        st.write("**Edit Stored Preferences (V1 JSON File)**")
        pref_lang = st.text_input("Learning Language Preference", value=user_prefs.get("learning_language", "Python"))
        pref_proj = st.text_input("Active Project Preference", value=user_prefs.get("project_name", "NOVA AI"))
        pref_style = st.text_input("Secretary Personality Style", value=user_prefs.get("digital_secretary_style", "Efficient, Professional, Courteous"))
        pref_avatar = st.text_input("Avatar Attenuation Preference", value=user_prefs.get("avatar_preference", "Simulation 2D Photorealistic"))
        pref_analysis = st.text_input("Markets & Stock Analysis Preference", value=user_prefs.get("preferred_analysis", "Stock Analysis & Market Intelligence"))
        pref_spec = st.text_input("Project Specification Preference", value=user_prefs.get("spec_preference", "Complete Project Specifications"))
        
        if st.button("Save LTM Preferences", use_container_width=True):
            ltm_data["user_preferences"] = {
                "learning_language": pref_lang,
                "project_name": pref_proj,
                "digital_secretary_style": pref_style,
                "avatar_preference": pref_avatar,
                "preferred_analysis": pref_analysis,
                "spec_preference": pref_spec
            }
            if memory_layer.save_ltm_data(ltm_data):
                st.success("Long-term preferences written to config/memory_store.json!")
                st.experimental_rerun()
            else:
                st.error("Failed to write memory preferences.")
                
    st.write("---")
    col_db1, col_db2 = st.columns(2)
    with col_db1:
        st.markdown("### ⚙️ Demo Memory Mode Settings")
        st.info(f"🟢 **Mode**: Demo Memory Mode is Active\n\n**Storage Mechanism**: Local File `{memory_layer.store_path}` (Auto-created)")
        
    with col_db2:
        st.markdown("### 🏛️ Future Upgrade Database Options")
        st.write("NOVA's architecture reserves pluggable interfaces for the following enterprise database adapters:")
        db_mapping = memory_layer.get_db_interface()
        for db_name, adapter_code in db_mapping.items():
            st.markdown(f"- **{db_name}**: `{adapter_code}`")

# Tab 4: Architecture
with tab_architecture:
    st.subheader("Subsystem Workflow Integration")
    st.markdown("""
    NOVA AI utilizes a decoupled, three-tier architecture design to isolate layout aesthetics, animation computation, and logical services.
    
    ```
    ┌────────────────────────┐
    │     Frontend Layer     │  ◄── HTML5 / CSS3 / Vanilla JavaScript (GitHub Pages)
    └───────────┬────────────┘
                │ Sends HTTP Queries
                ▼
    ┌────────────────────────┐
    │  Digital Human Layer   │  ◄── 2D animation controllers (blinking, breathing, micro-shifts)
    └───────────┬────────────┘
                │ Synthesizes voice & viseme sync states
                ▼
    ┌────────────────────────┐
    │     Backend Layer      │  ◄── Streamlit Control Panel & FastAPI Routing Layer (Localhost:8010)
    └───────────┬────────────┘
                │ Interacts with logic modules
                ▼
    ┌────────────────────────┐
    │  AI Cognitive Modules  │  ◄── Memory, Research Layer, AI Providers, Voice Parameters
    └────────────────────────┘
    ```
    
    - **Branding Consistency**: Both systems utilize identical naming and colors from `config/avatar_settings.json` to project a single enterprise solution product space.
    - **Real-Time Integration**: The static frontend makes HTTP calls directly to the Streamlit FastAPI server (`localhost:8010`) for unified operation.
    """)
