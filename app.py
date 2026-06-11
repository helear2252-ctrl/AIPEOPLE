import streamlit as st
import base64
import html
import json
import os
import re
import time
import streamlit.components.v1 as components

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
    page_title="NOVA AI",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="collapsed",
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
    .nova-home {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(280px, 40%) minmax(420px, 60%);
        gap: 2rem;
        align-items: center;
        padding: 0.5rem 0 1.5rem;
    }
    .nova-hero-copy {
        max-width: 560px;
    }
    .nova-kicker {
        color: #38bdf8;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 0.9rem;
    }
    .nova-title {
        color: #f8fafc;
        font-size: clamp(3.8rem, 8vw, 7.6rem);
        font-weight: 800;
        line-height: 0.95;
        margin: 0;
    }
    .nova-subtitle {
        color: #38bdf8;
        font-size: clamp(1.35rem, 2.4vw, 2.25rem);
        font-weight: 650;
        margin: 1.25rem 0 1.2rem;
    }
    .nova-description {
        color: #dbeafe;
        font-size: 1.08rem;
        line-height: 1.8;
        max-width: 54ch;
        margin-bottom: 1.6rem;
    }
    .nova-principles {
        display: grid;
        gap: 0.35rem;
        margin: 0 0 1.7rem;
        color: #e0f2fe;
        font-size: 1.02rem;
        font-weight: 650;
    }
    .nova-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
    }
    .nova-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3.15rem;
        padding: 0.8rem 1rem;
        border-radius: 8px;
        border: 1px solid rgba(56, 189, 248, 0.24);
        background: rgba(15, 23, 42, 0.46);
        color: #e0f2fe !important;
        text-decoration: none !important;
        font-weight: 750;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(224, 242, 254, 0.08);
        transition: all 0.28s ease;
        backdrop-filter: blur(14px);
    }
    .nova-action.primary {
        background: linear-gradient(135deg, #38bdf8, #e0f2fe);
        color: #030712 !important;
        box-shadow: 0 0 26px rgba(56, 189, 248, 0.38);
    }
    .nova-action.subtle {
        color: #94a3b8 !important;
    }
    .nova-action:hover {
        transform: translateY(-3px);
        border-color: rgba(224, 242, 254, 0.68);
        box-shadow: 0 0 28px rgba(56, 189, 248, 0.44);
    }
    .workspace-shell {
        position: relative;
        min-height: min(820px, calc(100vh - 3rem));
        border: 1px solid rgba(56, 189, 248, 0.18);
        border-radius: 8px;
        overflow: hidden;
        background:
            radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.24), transparent 28%),
            radial-gradient(circle at 86% 38%, rgba(224, 242, 254, 0.12), transparent 30%),
            linear-gradient(155deg, rgba(8, 13, 26, 0.24), rgba(14, 24, 44, 0.92)),
            linear-gradient(180deg, #111827 0%, #030712 100%);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
    }
    .workspace-shell::before {
        content: "";
        position: absolute;
        inset: -20%;
        background: conic-gradient(from 90deg, transparent, rgba(56, 189, 248, 0.18), transparent, rgba(224, 242, 254, 0.08), transparent);
        animation: nova-glow-flow 16s linear infinite;
        opacity: 0.75;
    }
    .workspace-window {
        position: absolute;
        inset: 0 0 34%;
        background:
            linear-gradient(90deg, rgba(224, 242, 254, 0.12) 1px, transparent 1px),
            linear-gradient(rgba(224, 242, 254, 0.10) 1px, transparent 1px),
            radial-gradient(circle at 78% 34%, rgba(56, 189, 248, 0.26), transparent 20%),
            linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.45));
        background-size: 72px 72px, 72px 72px, auto, auto;
        z-index: 1;
    }
    .workspace-window::after {
        content: "";
        position: absolute;
        inset: 12% 8% 18%;
        border-left: 1px solid rgba(224, 242, 254, 0.16);
        border-right: 1px solid rgba(224, 242, 254, 0.16);
        background:
            linear-gradient(90deg, transparent 0 24%, rgba(224, 242, 254, 0.12) 24% 24.3%, transparent 24.3% 49%, rgba(224, 242, 254, 0.12) 49% 49.3%, transparent 49.3% 74%, rgba(224, 242, 254, 0.12) 74% 74.3%, transparent 74.3%),
            linear-gradient(180deg, rgba(56, 189, 248, 0.12), transparent 65%);
    }
    .city-lights {
        position: absolute;
        left: 9%;
        right: 9%;
        top: 21%;
        height: 20%;
        z-index: 2;
        background:
            repeating-linear-gradient(90deg, transparent 0 17px, rgba(56, 189, 248, 0.32) 18px 21px, transparent 22px 44px),
            linear-gradient(180deg, transparent 0 60%, rgba(15, 23, 42, 0.72) 60% 100%);
        opacity: 0.62;
    }
    .monitor {
        position: absolute;
        right: 5%;
        bottom: 20%;
        width: 35%;
        aspect-ratio: 16 / 10;
        border: 9px solid #0f172a;
        border-radius: 8px;
        background:
            linear-gradient(135deg, rgba(14, 165, 233, 0.24), rgba(15, 23, 42, 0.92)),
            repeating-linear-gradient(0deg, transparent 0 13px, rgba(56, 189, 248, 0.10) 14px);
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.35);
        z-index: 5;
    }
    .monitor::after {
        content: "";
        position: absolute;
        left: 42%;
        right: 42%;
        bottom: -56px;
        height: 56px;
        background: #0f172a;
    }
    .desk {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 25%;
        background: linear-gradient(180deg, rgba(30, 41, 59, 0.94), rgba(15, 23, 42, 1));
        border-top: 1px solid rgba(148, 163, 184, 0.25);
        z-index: 4;
    }
    .keyboard {
        position: absolute;
        right: 11%;
        bottom: 13%;
        width: 30%;
        height: 4%;
        border-radius: 6px;
        background:
            repeating-linear-gradient(90deg, rgba(224, 242, 254, 0.22) 0 7px, transparent 7px 11px),
            rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(56, 189, 248, 0.18);
        z-index: 6;
        transform: skewX(-10deg);
    }
    .notebook {
        position: absolute;
        left: 9%;
        bottom: 10%;
        width: 23%;
        height: 10%;
        border-radius: 6px;
        background: linear-gradient(135deg, #e0f2fe, #94a3b8);
        box-shadow: 0 12px 22px rgba(0, 0, 0, 0.3);
        opacity: 0.82;
        z-index: 5;
        transform: rotate(-5deg);
    }
    .coffee {
        position: absolute;
        right: 42%;
        bottom: 13%;
        width: 7%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: radial-gradient(circle, #78350f 0 32%, #e0f2fe 34% 54%, #0f172a 56% 100%);
        border: 1px solid rgba(224, 242, 254, 0.28);
        z-index: 6;
    }
    .avatar-stage {
        position: absolute;
        left: 14%;
        bottom: 11%;
        height: 78%;
        width: auto;
        max-width: 62%;
        animation: nova-breathe 5.5s ease-in-out infinite;
        transform-origin: center bottom;
        z-index: 7;
    }
    .avatar-head {
        position: relative;
        height: 100%;
        animation: nova-micro 7s ease-in-out infinite, nova-float 8s ease-in-out infinite;
    }
    .avatar-stage img {
        display: block;
        height: 100%;
        width: auto;
        filter: drop-shadow(0 28px 38px rgba(0, 0, 0, 0.48));
    }
    .blink {
        position: absolute;
        top: 30.5%;
        width: 7.5%;
        height: 2.8%;
        border-radius: 999px;
        background: rgba(31, 23, 20, 0.78);
        opacity: 0;
        animation: nova-blink 5.2s infinite;
    }
    .blink.left {
        left: 36.5%;
    }
    .blink.right {
        left: 55.5%;
    }
    .workspace-label {
        position: absolute;
        top: 1rem;
        left: 1rem;
        color: #e0f2fe;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        z-index: 8;
    }
    .status-strip {
        position: absolute;
        right: 1rem;
        top: 1rem;
        color: #94a3b8;
        font-size: 0.8rem;
        z-index: 8;
    }
    .nova-greeting {
        position: absolute;
        left: 50%;
        bottom: 3.1%;
        transform: translateX(-50%);
        width: min(76%, 520px);
        text-align: center;
        z-index: 9;
        padding: 0.85rem 1rem;
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 8px;
        background: rgba(3, 7, 18, 0.72);
        backdrop-filter: blur(14px);
        color: #e0f2fe;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
    }
    .nova-greeting strong {
        display: block;
        color: #f8fafc;
        font-size: 1rem;
    }
    .voice-wave {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        height: 26px;
        margin-top: 0.55rem;
    }
    .voice-wave span {
        width: 4px;
        height: 8px;
        border-radius: 999px;
        background: #38bdf8;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.55);
        animation: nova-wave 1.1s ease-in-out infinite;
    }
    .voice-wave span:nth-child(2) { animation-delay: 0.12s; }
    .voice-wave span:nth-child(3) { animation-delay: 0.24s; }
    .voice-wave span:nth-child(4) { animation-delay: 0.36s; }
    .voice-wave span:nth-child(5) { animation-delay: 0.48s; }
    .voice-wave span:nth-child(6) { animation-delay: 0.6s; }
    @keyframes nova-breathe {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-7px) scale(1.012); }
    }
    @keyframes nova-micro {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        35% { transform: translateX(3px) rotate(0.7deg); }
        70% { transform: translateX(-2px) rotate(-0.5deg); }
    }
    @keyframes nova-float {
        0%, 100% { filter: drop-shadow(0 28px 38px rgba(0, 0, 0, 0.48)); }
        50% { filter: drop-shadow(0 34px 46px rgba(56, 189, 248, 0.18)); }
    }
    @keyframes nova-blink {
        0%, 91%, 100% { opacity: 0; transform: scaleY(0.1); }
        93%, 95% { opacity: 1; transform: scaleY(1); }
    }
    @keyframes nova-glow-flow {
        to { transform: rotate(360deg); }
    }
    @keyframes nova-wave {
        0%, 100% { height: 7px; opacity: 0.55; }
        50% { height: 24px; opacity: 1; }
    }
    @media (max-width: 900px) {
        .nova-home {
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }
        .workspace-shell {
            min-height: 520px;
        }
        .avatar-stage {
            left: 8%;
            height: 68%;
            max-width: 70%;
        }
        .nova-actions {
            grid-template-columns: 1fr;
        }
    }
    </style>
""", unsafe_allow_html=True)

# Load settings
config_data = avatar_interface.load_settings()

def get_avatar_data_uri(settings):
    gender = settings.get("gender", "Female")
    avatar_path = settings.get("avatar_images", {}).get(gender, "assets/avatar_female.png")
    abs_avatar_path = os.path.join(os.path.dirname(__file__), avatar_path)
    with open(abs_avatar_path, "rb") as avatar_file:
        encoded = base64.b64encode(avatar_file.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"

def file_to_data_uri(relative_path):
    app_dir = os.path.dirname(__file__)
    abs_path = os.path.normpath(os.path.join(app_dir, relative_path))
    if not abs_path.startswith(app_dir) or not os.path.exists(abs_path):
        return relative_path

    ext = os.path.splitext(abs_path)[1].lower()
    mime_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    }.get(ext, "application/octet-stream")

    with open(abs_path, "rb") as asset_file:
        encoded = base64.b64encode(asset_file.read()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"

def inline_frontend_assets(content):
    def replace_asset(match):
        path = match.group(1)
        return file_to_data_uri(path)

    return re.sub(r"assets/[A-Za-z0-9_./-]+", replace_asset, content)

def build_homepage_preview_html():
    app_dir = os.path.dirname(__file__)
    index_path = os.path.join(app_dir, "index.html")
    style_path = os.path.join(app_dir, "style.css")
    script_path = os.path.join(app_dir, "script.js")

    with open(index_path, "r", encoding="utf-8") as index_file:
        page_html = index_file.read()
    with open(style_path, "r", encoding="utf-8") as style_file:
        page_css = inline_frontend_assets(style_file.read())
    with open(script_path, "r", encoding="utf-8") as script_file:
        page_js = inline_frontend_assets(script_file.read())

    page_html = re.sub(
        r'\s*<link rel="stylesheet" href="style\.css">\s*',
        f"\n<style>\n{page_css}\n</style>\n",
        page_html,
        count=1,
    )
    page_html = re.sub(
        r'\s*<script src="script\.js"></script>\s*',
        f"\n<script>\n{page_js}\n</script>\n",
        page_html,
        count=1,
    )
    return inline_frontend_assets(page_html)

if "page" not in st.session_state:
    st.session_state.page = "Home"

if st.query_params.get("view") == "admin":
    st.session_state.page = "Admin Dashboard"
if st.query_params.get("view") == "home":
    st.session_state.page = "Home"

# Sidebar Setup
with st.sidebar:
    st.markdown("### 🤖 NOVA AI Core")
    st.caption("Your Intelligent Digital Human Assistant")
    st.session_state.page = st.radio(
        "Navigation",
        ["Home", "Admin Dashboard"],
        index=0 if st.session_state.page == "Home" else 1,
    )
    st.write("---")
    
    if st.session_state.page == "Admin Dashboard":
        # System status display
        st.write("📋 **System Health Status**")
        metrics = system_status.get_metrics()
        
        st.metric("App Status", metrics["api_status"])
        st.metric("System Uptime", metrics["uptime_human"])
        st.metric("CPU Utilization", f"{metrics['cpu_percent']}%")
        st.metric("Memory Utilization", f"{metrics['memory_percent']}%")

if st.session_state.page == "Home":
    project_name = html.escape(config_data.get("project_name", "NOVA AI"))
    subtitle = html.escape(config_data.get("subtitle", "Your Intelligent Digital Human Assistant"))
    persona = html.escape(config_data.get("persona", "Executive Digital Secretary"))
    personality = html.escape(config_data.get("personality", "Efficient, Professional, Courteous"))
    avatar_src = get_avatar_data_uri(config_data)

    if st.query_params.get("view") == "portfolio":
        st.info("Portfolio is available in the static GitHub Pages frontend demo. Admin tools remain available from the sidebar.")

    st.markdown("### NOVA AI Homepage Preview")
    components.html(build_homepage_preview_html(), height=920, scrolling=True)
    st.write("---")

    st.markdown(f"""
        <div class="nova-home">
            <section class="nova-hero-copy">
                <div class="nova-kicker">{persona}</div>
                <h1 class="nova-title">{project_name}</h1>
                <div class="nova-subtitle">{subtitle}</div>
                <div class="nova-principles">
                    <span>Executive support.</span>
                    <span>Research intelligence.</span>
                    <span>Memory that understands you.</span>
                </div>
                <p class="nova-description">
                    NOVA is a next-generation Digital Human Assistant designed to help with research,
                    analysis, learning, programming and daily productivity.
                </p>
                <div class="nova-actions">
                    <a class="nova-action primary" href="?view=admin&section=chat">Start Chat</a>
                    <a class="nova-action" href="?view=admin&section=settings">Launch Assistant</a>
                    <a class="nova-action subtle" href="?view=portfolio">View Portfolio</a>
                </div>
            </section>
            <section class="workspace-shell" aria-label="Digital Human Workspace">
                <div class="workspace-window"></div>
                <div class="city-lights"></div>
                <div class="workspace-label">Digital Human Workspace</div>
                <div class="status-strip">{personality}</div>
                <div class="monitor"></div>
                <div class="desk"></div>
                <div class="keyboard"></div>
                <div class="notebook"></div>
                <div class="coffee"></div>
                <div class="avatar-stage">
                    <div class="avatar-head">
                        <img src="{avatar_src}" alt="NOVA digital human assistant">
                        <span class="blink left"></span>
                        <span class="blink right"></span>
                    </div>
                </div>
                <div class="nova-greeting">
                    <strong>Good morning, I'm NOVA.</strong>
                    <span>How can I assist you today?</span>
                    <div class="voice-wave" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                </div>
            </section>
        </div>
    """, unsafe_allow_html=True)
    st.stop()

# Main Title Area
st.markdown(
    '<div class="nova-heading">NOVA AI <span class="accent-header">Admin Dashboard</span></div>',
    unsafe_allow_html=True,
)
st.markdown(
    '<div class="nova-caption">Settings, Memory, Research, Chat, and System Status Administration</div>',
    unsafe_allow_html=True,
)

# Tabs
if st.query_params.get("section") == "chat":
    tab_chat, tab_settings, tab_memory, tab_architecture = st.tabs([
        "💬 Interactive Chat Console",
        "👤 Digital Human Settings",
        "🧠 Memory Settings",
        "🏛️ System Architecture"
    ])
else:
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
