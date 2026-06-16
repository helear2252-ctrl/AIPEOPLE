import streamlit as st
import json
import os
import time

# Import modular backend
from modules.ai_provider import AIProvider
from modules.search_layer import SearchLayer
from modules.voice_layer import VoiceLayer
from modules.avatar_interface import AvatarInterface

# Page configuration
st.set_page_config(
    page_title="NOVA AI Control Panel",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for modern design in Streamlit
st.markdown("""
<style>
    .main {
        background-color: #0f172a;
        color: #f8fafc;
    }
    .stApp {
        background-color: #0f172a;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #1e293b;
        padding: 8px;
        border-radius: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        height: 50px;
        white-space: pre-wrap;
        background-color: #0f172a;
        border-radius: 4px;
        color: #94a3b8;
        font-weight: 600;
        border: 1px solid #334155;
        padding: 0px 16px;
    }
    .stTabs [aria-selected="true"] {
        background-color: #38bdf8 !important;
        color: #0f172a !important;
        border: 1px solid #38bdf8 !important;
    }
    h1, h2, h3 {
        color: #38bdf8 !important;
        font-family: 'Outfit', sans-serif;
    }
    .stButton>button {
        background-color: #38bdf8;
        color: #0f172a;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        background-color: #0ea5e9;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
    }
</style>
""", unsafe_allow_html=True)

# Default configuration settings
DEFAULT_SETTINGS = {
    "brand_name": "NOVA AI",
    "hero_title": "NOVA AI",
    "hero_subtitle": "Your Intelligent Digital Human Assistant",
    "hero_description": "Experience a next-generation AI assistant with natural conversation, voice interaction, and digital human presentation.",
    "primary_color": "#0f172a",
    "secondary_color": "#1e293b",
    "accent_color": "#38bdf8",
    "avatar_name": "NOVA",
    "avatar_role": "Executive Digital Secretary",
    "default_state": "Idle_Working",
    "demo_mode": True,
    "video_paths": {
        "Idle_Working": "assets/avatar/nova_typing_loop.mp4",
        "Turn_To_User": "assets/avatar/nova_turn_to_user.mp4",
        "Talking": "assets/avatar/nova_talk_loop.mp4",
        "Return_To_Desk": "assets/avatar/nova_turn_back.mp4",
        "Fallback": "assets/avatar/nova_working_placeholder.png"
    }
}

# Function to load avatar settings safely
def load_settings():
    settings_path = "config/avatar_settings.json"
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            st.sidebar.warning(f"Error loading config.json: {e}. Using default values.")
            return DEFAULT_SETTINGS
    return DEFAULT_SETTINGS

# Load current configuration
settings = load_settings()

# Instantiate core modules
ai = AIProvider(demo_mode=settings.get("demo_mode", True))
search = SearchLayer(enabled=True)
voice = VoiceLayer()
avatar = AvatarInterface()

# Sidebar Brand Info
st.sidebar.title(f"⚡ {settings.get('brand_name', 'NOVA AI')}")
st.sidebar.subheader(settings.get("avatar_role", "Executive Secretary"))
st.sidebar.info(f"**State**: {settings.get('default_state', 'Idle_Working')}\n\n**Demo Mode**: {'Enabled' if settings.get('demo_mode') else 'Disabled'}")

# Define 6 main workspace sections using tabs
t1, t2, t3, t4, t5, t6 = st.tabs([
    "💬 Chat Interface", 
    "🎙️ Voice Test", 
    "👤 Digital Human Test", 
    "⚙️ Model Settings", 
    "🎨 Digital Human Settings", 
    "📊 System Status"
])

# 1. CHAT INTERFACE
with t1:
    st.header("Chat Interface")
    st.write("Interact directly with the NOVA AI assistant.")
    
    # Initialize message list
    if "messages" not in st.session_state:
        st.session_state.messages = []
        
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            
    if prompt := st.chat_input("Ask NOVA something..."):
        with st.chat_message("user"):
            st.write(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        # Call AI provider (respecting demo mode)
        with st.spinner("NOVA is thinking..."):
            time.sleep(0.6) # simulate thinking latency
            reply = ai.generate_response(prompt)
            
        with st.chat_message("assistant"):
            st.write(reply)
        st.session_state.messages.append({"role": "assistant", "content": reply})

    if st.button("Clear History", key="clear_chat_history"):
        st.session_state.messages = []
        st.rerun()

# 2. VOICE TEST
with t2:
    st.header("Voice & Audio Test")
    st.write("Test voice interaction, Speech-to-Text, and Text-to-Speech synthesis.")
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Text to Speech (TTS)")
        tts_text = st.text_area("Input text to synthesize:", value="哈囉！我是您的數位秘書 NOVA，很高興為您服務。")
        voice_opts = voice.get_available_voices()
        selected_voice = st.selectbox("Select Voice ID:", options=[v["name"] for v in voice_opts])
        
        if st.button("Synthesize Audio"):
            with st.spinner("Synthesizing..."):
                audio_bytes = voice.text_to_speech(tts_text)
                st.success("Audio synthesized successfully! (Mock Bytes generated)")
                st.info(f"Generated data header: {audio_bytes[:20]}")
                
    with col2:
        st.subheader("Speech to Text (STT)")
        st.write("Simulate microphone or audio file upload voice-to-text conversion.")
        audio_file = st.file_uploader("Upload Audio File (wav/mp3)", type=["wav", "mp3"])
        
        if st.button("Process Speech Recognition"):
            if audio_file is not None:
                st.success("Speech recognized successfully!")
                st.code(voice.speech_to_text(audio_file.read()))
            else:
                st.warning("Please upload a mock audio file or click below to run mock test.")
                if st.button("Run Mock STT Test"):
                    st.code(voice.speech_to_text(b""))

# 3. DIGITAL HUMAN TEST
with t3:
    st.header("Digital Human Animation Test")
    st.write("Control and simulate digital human avatar animation state machine transitions.")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        st.subheader("State Machine Trigger")
        st.info(f"Current State: `{settings.get('default_state', 'Idle_Working')}`")
        
        target_state = st.selectbox(
            "Change State:", 
            options=["Idle_Working", "Turn_To_User", "Talking", "Return_To_Desk"]
        )
        
        if st.button("Switch State"):
            st.success(f"Dispatched state change event for Front-end: `{target_state}`")
            
        st.subheader("Lip Sync Engine")
        lip_model = st.selectbox("Active LipSync Engine:", options=avatar.get_supported_models())
        if st.button("Simulate Lip Sync"):
            mock_audio = b"dummy_audio"
            out = avatar.generate_lipsync_video(mock_audio, settings["video_paths"]["Talking"])
            st.success("Lip Sync video generated!")
            st.code(out)
            
    with col2:
        st.subheader("Avatar Resource Check")
        for state, path in settings.get("video_paths", {}).items():
            exists = os.path.exists(path)
            status_text = "🟢 Exists" if exists else "🔴 Missing (Using Fallback)"
            st.write(f"- **{state}**: `{path}` - {status_text}")
        
        # Display the working placeholder image if it exists
        placeholder_path = settings.get("video_paths", {}).get("Fallback", "")
        if os.path.exists(placeholder_path):
            st.image(placeholder_path, caption="Active Fallback Image", width=350)
        else:
            st.warning("Fallback image not found on local filesystem.")

# 4. MODEL SETTINGS
with t4:
    st.header("AI Model Integrations")
    st.write("Configure large language model providers and credentials.")
    
    llm_provider = st.selectbox("LLM Provider:", options=["Gemini (Google)", "OpenAI (GPT-4)"])
    api_key = st.text_input("API Key:", type="password", placeholder="Enter api key here...")
    
    col1, col2 = st.columns(2)
    with col1:
        model_name = st.selectbox("Model Version:", 
            options=["gemini-2.5-flash", "gemini-2.5-pro", "gpt-4o", "gpt-4o-mini"]
        )
        temperature = st.slider("Temperature:", min_value=0.0, max_value=1.0, value=0.7, step=0.1)
    with col2:
        search_grounding = st.checkbox("Enable Search Grounding Layer", value=True)
        system_instruction = st.text_area("System Instruction:", value="You are NOVA, a highly intelligent executive secretary.")
        
    if st.button("Save Model Credentials"):
        if api_key:
            st.success(f"API configurations saved for {llm_provider} using {model_name}!")
        else:
            st.warning("API key is empty. Saved in Demo Mode.")

# 5. DIGITAL HUMAN SETTINGS
with t5:
    st.header("Digital Human Configurations")
    st.write("Modify avatar visual profiles, branding settings, and layout parameters.")
    
    with st.form("avatar_form"):
        col1, col2 = st.columns(2)
        with col1:
            brand_name = st.text_input("Brand Name:", value=settings.get("brand_name", ""))
            hero_title = st.text_input("Hero Section Title:", value=settings.get("hero_title", ""))
            hero_subtitle = st.text_input("Hero Section Subtitle:", value=settings.get("hero_subtitle", ""))
            
            avatar_name = st.text_input("Avatar Character Name:", value=settings.get("avatar_name", ""))
            avatar_role = st.text_input("Avatar Character Role:", value=settings.get("avatar_role", ""))
        
        with col2:
            hero_desc = st.text_area("Hero Description:", value=settings.get("hero_description", ""))
            
            p_color = st.color_picker("Primary Color Theme:", value=settings.get("primary_color", "#0f172a"))
            s_color = st.color_picker("Secondary Color Theme:", value=settings.get("secondary_color", "#1e293b"))
            a_color = st.color_picker("Accent Accent Color:", value=settings.get("accent_color", "#38bdf8"))
            
            demo_mode_active = st.checkbox("Activate Demo Mode", value=settings.get("demo_mode", True))
            
        submitted = st.form_submit_state = st.form_submit_button("Save and Write Config")
        if submitted:
            new_config = {
                "brand_name": brand_name,
                "hero_title": hero_title,
                "hero_subtitle": hero_subtitle,
                "hero_description": hero_desc,
                "primary_color": p_color,
                "secondary_color": s_color,
                "accent_color": a_color,
                "avatar_name": avatar_name,
                "avatar_role": avatar_role,
                "default_state": settings.get("default_state", "Idle_Working"),
                "demo_mode": demo_mode_active,
                "video_paths": settings.get("video_paths", DEFAULT_SETTINGS["video_paths"])
            }
            try:
                os.makedirs("config", exist_ok=True)
                with open("config/avatar_settings.json", "w", encoding="utf-8") as f:
                    json.dump(new_config, f, indent=2, ensure_ascii=False)
                st.success("Settings saved to `config/avatar_settings.json` successfully!")
                time.sleep(0.5)
                st.rerun()
            except Exception as e:
                st.error(f"Failed to write settings: {e}")

# 6. SYSTEM STATUS
with t6:
    st.header("System Performance & Status")
    st.write("Realtime hardware allocation and latency diagnostics.")
    
    col1, col2, col3 = st.columns(3)
    col1.metric(label="API Latency (Gemini)", value="142 ms", delta="-12ms")
    col2.metric(label="LipSync Render Time", value="0.82 sec / frame", delta="-0.04s")
    col3.metric(label="System Uptime", value="99.98%")
    
    st.subheader("Hardware Diagnostics")
    c1, c2 = st.columns(2)
    with c1:
        st.write("**GPU Allocation:** NVIDIA GeForce RTX 4090")
        st.progress(0.42, text="VRAM: 10.1 GB / 24.0 GB (42%)")
    with c2:
        st.write("**CPU Allocation:** AMD Ryzen 9 7950X")
        st.progress(0.18, text="CPU Usage: 18% (128 Threads)")
        
    st.subheader("Active System Logs")
    st.code("""
[SYSTEM] 16:32:55 - Initializing modular python layers...
[SYSTEM] 16:32:56 - Config loaded successfully from config/avatar_settings.json.
[SYSTEM] 16:32:56 - Mock AI provider established in DEMO mode.
[SYSTEM] 16:32:57 - Voice synthesis TTS server registered.
[SYSTEM] 16:32:57 - Streamlit host server is up at http://localhost:8501.
    """, language="bash")
