import streamlit as st
import json
import os
import time

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
# Streamlit Frontend Administration Panel
# ==========================================================================

# Page Configurations
st.set_page_config(
    page_title="NOVA AI Backend Control",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Shared Styling CSS Injection for Palette Alignment.
# Keep this CSS limited to visible Streamlit widgets and NOVA classes only.
st.markdown("""
    <style>
    section[data-testid="stSidebar"] {
        background-color: #0b0f19 !important;
        border-right: 1px solid rgba(56, 189, 248, 0.15) !important;
    }
    
    .stTextInput input,
    .stNumberInput input,
    .stTextArea textarea,
    .stSelectbox [data-baseweb="select"] {
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
    
    .nova-heading {
        font-family: 'Outfit', sans-serif !important;
        color: #f8fafc !important;
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0 0 0.25rem;
    }
    .accent-header {
        color: #38bdf8;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
    }
    .nova-caption {
        color: #94a3b8;
        margin-top: -0.25rem;
    }
    </style>
""", unsafe_allow_html=True)

# Load settings
config_data = avatar_interface.load_settings()

# Sidebar Setup
with st.sidebar:
    st.markdown("### 🤖 NOVA AI Core")
    st.caption("Your Intelligent Digital Human Assistant")
    st.write("---")
    
    # System status display
    st.write("📋 **System Health Status**")
    metrics = system_status.get_metrics()
    
    st.metric("API Status", metrics["api_status"])
    st.metric("System Uptime", metrics["uptime_human"])
    st.metric("CPU Utilization", f"{metrics['cpu_percent']}%")
    st.metric("Memory Utilization", f"{metrics['memory_percent']}%")

# Main Title Area
st.markdown(
    '<div class="nova-heading">NOVA AI <span class="accent-header">Control Dashboard</span></div>',
    unsafe_allow_html=True,
)
st.markdown(
    '<div class="nova-caption">Enterprise-Grade Executive Digital Secretary Central Administration</div>',
    unsafe_allow_html=True,
)

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
        st.metric("Active Session ID", "streamlit_session")
        st.metric("Dialog History Count", f"{stm_status['history_count']} messages")
        st.metric("Current Analysis Theme", stm_status["current_analysis_theme"])
        st.metric("Current Active Task", stm_status["current_task"])
        
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
    │     Backend Layer      │  ◄── Streamlit Cloud Control Panel
    └───────────┬────────────┘
                │ Interacts with logic modules
                ▼
    ┌────────────────────────┐
    │  AI Cognitive Modules  │  ◄── Memory, Research Layer, AI Providers, Voice Parameters
    └────────────────────────┘
    ```
    
    - **Branding Consistency**: Both systems utilize identical naming and colors from `config/avatar_settings.json` to project a single enterprise solution product space.
    - **Cloud Deployment**: V1 Streamlit Cloud deployment runs as a pure Streamlit control panel. The static frontend remains in offline demo mode until a future standalone API service is deployed.
    """)
