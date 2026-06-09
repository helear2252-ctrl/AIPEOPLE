# NOVA AI - Your Intelligent Digital Human Assistant (V1 Skeleton)

NOVA AI is a modular, enterprise-grade **Executive Digital Secretary** system built with a decoupled three-layer architecture.

## 🏛️ System Architecture

1. **Frontend Layer (GitHub Pages / Static Site)**:
   - High-fidelity corporate landing page and Digital Human Workspace interface.
   - Built using **HTML5, CSS3, and Vanilla JavaScript** with premium slate-dark and sky-blue aesthetics.
   - Integrates with the Backend APIs to update avatar settings, send chats, and sync voices.

2. **Digital Human Layer (2D Animation Engine)**:
   - Runs directly on the frontend using JS and CSS animations.
   - Core functions:
     - **Breathing**: Smooth scaling and vertical offsets.
     - **Blinking**: Randomized eyelid animations (3s - 6s intervals) matching skin tone configurations.
     - **Posture Shifting**: Micro-movements (subtle head/torso rotations and offsets) to simulate a lifelike state.
     - **Lip Sync**: Real-time mouth width/height warp animations synchronized with audio speech synthesis output.

3. **Backend Layer (Streamlit Control Panel)**:
   - Admin console built in **Streamlit** to update settings dynamically, review hardware usage metrics, and interact with the chatbot.
   - V1 Streamlit Cloud deployment runs as a pure Streamlit app. A standalone FastAPI service is reserved for a future independent deployment if live static-frontend APIs are needed.
   - Core modules handle AI Provider generation, session memories, web research indexing, and system hardware status readings.

---

## 📁 File Structure

```text
nova-ai/
├── config/
│   ├── avatar_settings.json     # Shared configuration (names, styling, genders, personas)
│   └── memory_store.json        # Long-Term memory local store (auto-created)
├── assets/
│   ├── avatar_female.png        # Photorealistic female secretary avatar (base frame)
│   └── avatar_male.png          # Photorealistic male secretary avatar (base frame)
├── modules/
│   ├── __init__.py
│   ├── ai_provider.py           # Context-aware response styling
│   ├── memory_layer.py          # Short-Term and Long-Term Memory Layer V1 (unified)
│   ├── memory.py                # Legacy context tracking wrapper (re-exports memory_layer)
│   ├── voice.py                 # Text-To-Speech settings
│   ├── research_layer.py        # Web search query engine
│   └── system_status.py         # Hardware resources collector
├── index.html                   # Workspace landing page
├── style.css                    # Premium glassmorphic stylesheets
├── script.js                    # Digital Human blink/breathe/speech engine
├── app.py                       # Pure Streamlit Cloud control panel
├── requirements.txt             # Python packages
└── README.md                    # Setup and guide doc
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9 or higher.
- A modern web browser.

### 2. Install Dependencies
Run the following command in your terminal to install the python packages:
```bash
pip install -r requirements.txt
```

### 3. Run the Streamlit Control Panel
Start the Streamlit panel:
```bash
streamlit run app.py --server.port 8510
```
- Streamlit Admin dashboard: `http://localhost:8510`

V1 does not start a FastAPI server from Streamlit. The previous `localhost:8010` API is reserved for a future standalone `api_server.py` deployment.

### 4. Run the Frontend
You can run the frontend by opening the static `index.html` file in your browser:
- Double click `index.html` or run a local static server (e.g. `npx live-server` or VS Code Live Server extension).
- In V1 Streamlit Cloud deployment, the static frontend can remain in offline demo mode or show the backend as disconnected. A live API for GitHub Pages should be deployed separately in a future FastAPI service.

---

## 🎨 Branding & Alignment Guidelines
To preserve the premium corporate aesthetic:
- **Project Colors**: Slate Dark (`#0f172a`, `#1e293b`), Sky Blue accents (`#38bdf8`), and Sky highlights (`#e0f2fe`).
- **Forbidden Styles**: Q-version, Anime, Cartoon, Stylized characters, Low Poly.
- **Branding Uniformity**: Settings like Project Name, Persona description, and Subtitles are driven by `config/avatar_settings.json` to keep Streamlit and GitHub Pages looking like the exact same product.

---

## 🌐 Deployment Guidelines

### 1. GitHub Pages (Static Frontend)
Since the Frontend Layer is pure static HTML/CSS/JS, it can be deployed on serverless hosting like GitHub Pages:
1. Create a public repository on GitHub.
2. Commit and push the static files to the repository:
   - `index.html`
   - `style.css`
   - `script.js`
   - `assets/` (contains avatar image assets)
   - `config/` (contains configuration files)
3. Go to **Settings** > **Pages** of your repository.
4. Select `Deploy from a branch` and set the source branch (e.g. `main` or `master`) and directory (`/root`).
5. Click Save. Your frontend will be available at `https://<username>.github.io/<repo-name>/`.
*Note: In offline mode, the page simulates response parameters and memory registers locally via web scripts, keeping users engaged without backend services.*

### 2. Streamlit Cloud (Backend Control Panel)
To deploy the administration console to Streamlit Community Cloud:
1. Push the complete codebase to a GitHub repository (including `app.py`, `requirements.txt`, `config/`, and `modules/`).
2. Log into [Streamlit Share](https://share.streamlit.io/).
3. Click **New App**, select your repository, branch, and specify the main file path as `app.py`.
4. Deploy the app. Your administration console will run as a pure Streamlit app on Streamlit's server infrastructure.

Streamlit Cloud does not start or expose a separate `localhost:8010` FastAPI server for this V1 deployment. If the static GitHub Pages frontend later needs live API endpoints, deploy that API separately and point the frontend to the public API URL.
