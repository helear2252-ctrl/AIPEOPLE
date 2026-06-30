/**
 * NOVA AI - Phase 0.7 avatar playback controller.
 * Keeps the dual-video crossfade renderer and uses a local-only mock workbench.
 */

const AVATAR_STATES = Object.freeze({
  INITIAL_LOOP_040: "INITIAL_LOOP_040",
  FIRST_ACK_041: "FIRST_ACK_041",
  AGENT_WORKBENCH: "AGENT_WORKBENCH",
  AGENT_COMPLETED_TTS: "AGENT_COMPLETED_TTS",
  COMPLETE_TRANSITION_042: "COMPLETE_TRANSITION_042",
  FINAL_LOOP_043: "FINAL_LOOP_043"
});

const runtimeBaseUrl = import.meta.env?.BASE_URL || new URL(".", import.meta.url).pathname;
const assetUrl = (path) => `${runtimeBaseUrl}${path.replace(/^\/+/, "")}`;

const VIDEO_PATHS = Object.freeze({
  INITIAL_LOOP_040: assetUrl("assets/avatar/AIPEOPLE/040.mp4"),
  FIRST_ACK_041: assetUrl("assets/avatar/AIPEOPLE/041.mp4"),
  COMPLETE_TRANSITION_042: assetUrl("assets/avatar/AIPEOPLE/042.mp4"),
  FINAL_LOOP_043: assetUrl("assets/avatar/AIPEOPLE/043.mp4"),
  Fallback: assetUrl("assets/avatar/nova_working_placeholder.png")
});

// Legacy rollback references only. These files are intentionally not used by Phase 0.7.
// 027: assets/avatar/AIPEOPLE/027.mp4
// 026: assets/avatar/AIPEOPLE/026.mp4
// 030: assets/avatar/AIPEOPLE/030.mp4

const AGENT_API_BASE = "http://127.0.0.1:8787";
const STREAMLIT_WORKBENCH_URL = "http://127.0.0.1:8501";
const VIESHOW_OFFICIAL_URL = "https://www.vscinemas.com.tw/";
const WORKBENCH_PROJECTS_STORAGE_KEY = "nova.workbench.projects.v1";
const AGENT_BRAIN_MODE = "localMock";
const FIRST_ACK_PREPARE_SECONDS = 3.2;
const FIRST_ACK_SHELL_PREPARE_SECONDS = 3.6;
const FIRST_ACK_WORKBENCH_CUE_SECONDS = 3.45;
const MOCK_COMPLETION_HOLD_MS = 1000;
const COMPLETION_TEXT = "已幫你完成，還有需要幫你做什麼嗎？";

/* ================================
WORKBENCH TASK LAYER
Handles user request detection and dynamic workbench task rendering.
================================ */

function escapeWorkbenchText(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function detectWorkbenchTaskType(userMessage) {
  const raw = String(userMessage || "");
  const text = raw.toLowerCase();

  if (["3d", "設計圖", "立體", "模型", "product render", "concept", "render"].some((keyword) => text.includes(keyword))) {
    return "design3d";
  }
  if (["訂票", "買票", "機票", "車票", "電影票", "威秀", "影城", "高鐵", "票券", "booking", "ticket", "seat", "payment"].some((keyword) => text.includes(keyword))) {
    return "booking";
  }
  if (["demo", "code", "程式碼", "網站", "設計網站", "風格", "登入頁", "ui", "landing page", "saas", "apple", "openai", "vercel", "linear", "figma", "mockup", "轉成 code", "變成 code", "存成 code", "生成 code"].some((keyword) => text.includes(keyword))) {
    return "demoToCode";
  }
  return "default";
}

function renderWorkflowHeading(title, subtitle, icon) {
  return `<header class="task-canvas-heading workbench-task-reveal">
    <span class="task-canvas-icon"><i class="fa-solid ${icon}"></i></span>
    <div><span class="task-canvas-kicker">DYNAMIC TASK CANVAS</span><h3>${title}</h3><p>${subtitle}</p></div>
    <div class="agent-runtime-hud"><span class="agent-brain-chip">BRAIN · ${AGENT_BRAIN_MODE}</span><span class="agent-tool-chip">Selecting tools</span><span class="agent-runtime-status" data-agent-status>Planning</span></div>
  </header>`;
}

function render3DDesignTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--design3d">
    ${renderWorkflowHeading("3D Concept Studio", "NOVA is actively building a product-style 3D concept from your request.", "fa-cube")}
    <div class="task-workflow-grid task-workflow-grid--live">
      <section class="workbench-card task-panel workbench-task-reveal"><span class="task-panel-label">Requirement Analysis</span><blockquote>${request}</blockquote><ul class="task-check-list"><li>Object type · Product concept</li><li>Material · Frosted glass</li><li>Lighting · Studio rim</li><li>Camera · Three-quarter</li><li>Direction · Futuristic</li></ul></section>
      <section class="ai-live-canvas ai-live-window design-live-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><strong>Modern Cafe · 3D Interior Viewport</strong><span>Drag to orbit · Live</span></div><div class="cafe-3d-viewport" data-3d-viewport aria-label="Draggable modern cafe 3D viewport"><div class="cafe-css-fallback"><div class="cafe-room"><i class="cafe-floor"></i><i class="cafe-wall cafe-wall--back"></i><i class="cafe-wall cafe-wall--side"></i><div class="cafe-counter"></div><div class="cafe-table cafe-table--one"></div><div class="cafe-table cafe-table--two"></div><div class="cafe-table cafe-table--three"></div><div class="cafe-pendants"><i></i><i></i><i></i></div></div></div><span class="viewport-drag-hint"><i class="fa-solid fa-arrows-rotate"></i> Drag to explore</span></div><div class="design-tool-rail"><b>↖</b><b>◇</b><b>◫</b><b>☼</b></div><div class="preview-ready ai-progressive" data-stage="6"><i class="fa-solid fa-check"></i> Preview ready</div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Analyzing cafe layout</div></section>
      <section class="workbench-card task-panel output-panel workbench-task-reveal"><span class="task-panel-label">Generation Controls</span><dl><div><dt>Style</dt><dd>Futuristic product</dd></div><div><dt>Material</dt><dd>Frosted glass + aluminum</dd></div><div><dt>Lighting</dt><dd>Soft studio rim</dd></div><div><dt>Camera</dt><dd>42° perspective</dd></div><div><dt>Quality</dt><dd>Preview · High</dd></div><div><dt>Status</dt><dd class="task-status-live">Rendering preview</dd></div></dl></section>
    </div>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Reading request", "Opening canvas", "Selecting style", "Building geometry", "Applying material", "Preview ready"].map((step) => `<span class="ai-step"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderBookingTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--booking">
    ${renderWorkflowHeading("Booking Flow Agent", "NOVA is operating a booking flow and will stop safely before payment.", "fa-ticket")}
    <div class="task-workflow-grid task-workflow-grid--live">
      <section class="workbench-card task-panel workbench-task-reveal"><span class="task-panel-label">Task Brief</span><p class="task-request-line">${request}</p><ul class="task-check-list"><li>Search available tickets</li><li>Compare time and price</li><li>Select preferred seat</li><li>Review traveler details</li></ul></section>
      <section class="ai-live-canvas ai-live-window booking-live-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><div class="ai-address-bar"><i class="fa-solid fa-lock"></i> vscinemas.com.tw · NOVA Safe Preview</div><a class="official-site-link" href="${VIESHOW_OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">Open official site <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div><div class="booking-page"><div class="booking-brand"><i class="fa-solid fa-film"></i><strong>VIESHOW Booking Assistant</strong><span>Safe mode · stops before payment</span></div><div class="booking-form"><label data-control="theater"><span>Theater</span><b class="typed-value ai-progressive" data-stage="1">台北信義威秀影城</b></label><label data-control="movie"><span>Movie</span><b class="typed-value ai-progressive" data-stage="2">Movie preview</b></label><label data-control="date"><span>Date</span><b class="typed-value ai-progressive" data-stage="3">Selected date</b></label><button type="button" class="ai-progressive" data-stage="3">Search sessions</button></div><div class="booking-result ai-progressive" data-stage="4"><span>19:30</span><strong>Digital · Preview</strong><b>Adult × 2</b><button type="button">Select</button></div><div class="seat-picker ai-progressive" data-stage="5"><span>F10</span><span class="is-selected">F11</span><span class="is-selected">F12</span><strong>Seats selected</strong></div><div class="review-lock ai-progressive" data-stage="6"><i class="fa-solid fa-shield-halved"></i><div><strong>Review before payment</strong><small>No transaction executed. Continue only on the official website.</small></div></div></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Opening VIESHOW safe preview</div></section>
      <section class="workbench-card task-panel safety-panel workbench-task-reveal"><span class="task-panel-label">Safety Panel</span><div class="booking-mode-toggle"><button type="button" class="is-active" data-workbench-action="booking-mode" data-booking-mode="safe">Safe mode</button><button type="button" data-workbench-action="booking-mode" data-booking-mode="authorized">Authorized handoff</button></div><div class="safety-lock"><i class="fa-solid fa-lock"></i><strong>Payment protected</strong><small>No transaction executed</small></div><ul><li>User confirmation required</li><li>Current step: Review order</li><li>Payment step is locked</li></ul></section>
    </div>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Search tickets", "Compare options", "Select time", "Choose seat", "Traveler info", "Stop before payment"].map((step) => `<span class="ai-step"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderDemoToCodeTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--website">
    ${renderWorkflowHeading("Website Design Studio", "NOVA is designing a live website concept from your style request.", "fa-pen-ruler")}
    <div class="task-workflow-grid task-workflow-grid--live">
      <section class="workbench-card task-panel workbench-task-reveal"><span class="task-panel-label">Style Request</span><p class="task-request-line">${request}</p><ul class="analysis-list"><li>Premium technology mood</li><li>Glass navigation</li><li>Focused hero hierarchy</li><li>Responsive component grid</li><li>Subtle motion language</li></ul></section>
      <section class="ai-live-canvas ai-live-window website-live-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><strong>Website Design Canvas</strong><span>Desktop · 1440</span></div><div class="website-builder fashion-builder"><div class="builder-nav ai-progressive" data-stage="1"><b>ATELIER / 01</b><span>New Arrival</span><span>Lookbook</span><span>Best Seller</span><button>Shop now</button></div><div class="builder-hero ai-progressive" data-stage="2"><small>FUTURE ESSENTIALS · 2026</small><strong>Wear what comes next.</strong><p>Precision silhouettes for a new generation.</p><button>Explore collection</button></div><div class="fashion-categories ai-progressive" data-stage="3"><span>Outerwear</span><span>Knitwear</span><span>Essentials</span><span>Accessories</span></div><div class="builder-products">${[["Form Jacket","NT$ 6,980"],["Glass Knit","NT$ 3,280"],["Motion Trouser","NT$ 4,680"],["Vector Coat","NT$ 8,800"],["Core Tee","NT$ 1,980"],["Orbit Bag","NT$ 3,980"]].map(([name,price],index) => `<article class="ai-progressive" data-stage="${index < 3 ? 4 : 5}"><i style="--product-tone:${index}"></i><b>${name}</b><span>${price}</span></article>`).join("")}</div><div class="responsive-blocks ai-progressive" data-stage="5"><i></i><i></i><i></i></div></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Reading your fashion brand request</div></section>
      <section class="workbench-card task-panel design-controls workbench-task-reveal"><span class="task-panel-label">Design Controls</span>${[["Style","Premium glass"],["Color","Ice blue"],["Layout","Editorial"],["Components","Adaptive"],["Motion","Subtle"]].map(([label,value]) => `<label><span>${label}</span><strong>${value}</strong></label>`).join("")}</section>
    </div>
    <div class="website-action-bar workbench-card workbench-task-reveal"><div><span>Live concept</span><strong>Design preview in progress</strong></div><button type="button" class="is-secondary" data-workbench-action="refine-design">Refine Design</button><button type="button" data-workbench-action="save-website-code">Save as Code</button></div>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Reading style", "Building header", "Composing hero", "Adding cards", "Responsive pass", "Design ready"].map((step) => `<span class="ai-step"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderDefaultWorkbenchTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--default">
    ${renderWorkflowHeading("NOVA Workspace", "NOVA is preparing your workspace and organizing the current request.", "fa-wand-magic-sparkles")}
    <section class="workbench-card default-request-card workbench-task-reveal"><span class="task-panel-label">Current Request</span><p id="workbench-current-task">${request}</p><div class="assistant-progress"><i></i></div><small>Preparing workspace context…</small></section>
    <div class="default-workspace-grid"><section class="workbench-card workbench-task-reveal"><span class="task-panel-label">System Overview</span><div class="overview-metrics"><div><strong>04</strong><span>Modules</span></div><div><strong>12</strong><span>Events</span></div><div><strong>03</strong><span>Outputs</span></div><div><strong>98%</strong><span>Ready</span></div></div></section><section class="workbench-card workbench-task-reveal"><span class="task-panel-label">Output Files</span><div class="placeholder-files"><span>workspace-brief.md</span><span>task-notes.json</span><span>preview.pending</span></div></section></div>
    <section class="workbench-card default-activity workbench-task-reveal"><span class="task-panel-label">Recent Activity</span><div><i></i>Request classified</div><div><i></i>Workspace initialized</div><div><i></i>Output slots prepared</div></section>
  </div>`;
}

function renderWorkbenchTask(taskType, userMessage) {
  if (taskType === "design3d") return render3DDesignTask(userMessage);
  if (taskType === "booking") return renderBookingTask(userMessage);
  if (taskType === "demoToCode") return renderDemoToCodeTask(userMessage);
  return renderDefaultWorkbenchTask(userMessage);
}

function loadOptionalGsap() {
  if (window.gsap || document.querySelector('script[data-nova-gsap]')) return;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js";
  script.async = true;
  script.dataset.novaGsap = "true";
  script.onerror = () => console.info("[NOVA UI] GSAP unavailable; CSS animation fallback is active.");
  document.head.appendChild(script);
}

let optionalThreePromise = null;
function loadOptionalThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (optionalThreePromise) return optionalThreePromise;
  optionalThreePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("Three.js load timeout")), 5000);
    script.src = "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js";
    script.async = true;
    script.dataset.novaThree = "true";
    script.onload = () => { clearTimeout(timeout); window.THREE ? resolve(window.THREE) : reject(new Error("Three.js unavailable")); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error("Three.js CDN unavailable")); };
    document.head.appendChild(script);
  });
  return optionalThreePromise;
}

/* ================================
CAPABILITY ENGINE LAYER
3D Design, Browser Automation, Website Design, and File Output engines.
================================ */

class Interior3DEngine {
  constructor(viewport) {
    this.viewport = viewport;
    this.disposed = false;
    this.rotation = { x: -0.12, y: -0.35 };
    this.targetRotation = { ...this.rotation };
    this.drag = null;
    this.frame = null;
    this.resizeObserver = null;
    this.bindPointerEvents();
    this.init();
  }

  bindPointerEvents() {
    this.onPointerDown = (event) => {
      this.drag = { x: event.clientX, y: event.clientY, rx: this.targetRotation.x, ry: this.targetRotation.y };
      this.viewport.classList.add("is-dragging");
      this.viewport.setPointerCapture?.(event.pointerId);
    };
    this.onPointerMove = (event) => {
      if (!this.drag) return;
      this.targetRotation.y = this.drag.ry + (event.clientX - this.drag.x) * 0.008;
      this.targetRotation.x = Math.max(-0.55, Math.min(0.3, this.drag.rx + (event.clientY - this.drag.y) * 0.006));
      this.viewport.style.setProperty("--cafe-rx", `${this.targetRotation.x}rad`);
      this.viewport.style.setProperty("--cafe-ry", `${this.targetRotation.y}rad`);
    };
    this.onPointerUp = () => { this.drag = null; this.viewport.classList.remove("is-dragging"); };
    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointermove", this.onPointerMove);
    this.viewport.addEventListener("pointerup", this.onPointerUp);
    this.viewport.addEventListener("pointercancel", this.onPointerUp);
  }

  async init() {
    try {
      const THREE = await loadOptionalThree();
      if (this.disposed || !this.viewport.isConnected) return;
      this.THREE = THREE;
      this.createScene();
    } catch (error) {
      console.info("[NOVA 3D] CSS cafe fallback is active.", error.message);
    }
  }

  createScene() {
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101a22);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(8, 5.8, 9);
    this.camera.lookAt(0, 1.5, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.viewport.prepend(this.renderer.domElement);
    this.cafeRoot = new THREE.Group();
    this.scene.add(this.cafeRoot);

    const materials = {
      floor: new THREE.MeshStandardMaterial({ color: 0x6f5540, roughness: 0.72 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xd8c9b7, roughness: 0.88 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x563929, roughness: 0.62 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xaca79d, roughness: 0.38 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x20262a, metalness: 0.72, roughness: 0.3 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x9d7457, roughness: 0.82 }),
      green: new THREE.MeshStandardMaterial({ color: 0x496b50, roughness: 0.78 })
    };
    const box = (size, position, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; this.cafeRoot.add(mesh); return mesh;
    };
    box([10, 0.18, 7], [0, -0.1, 0], materials.floor);
    box([10, 5.2, 0.16], [0, 2.5, -3.45], materials.wall);
    box([0.16, 5.2, 7], [-4.95, 2.5, 0], materials.wall);
    box([5.7, 1.05, 1.15], [1.5, 0.55, -2.35], materials.wood);
    box([5.9, 0.18, 1.35], [1.5, 1.15, -2.35], materials.stone);
    box([4.8, 0.12, 0.55], [1.3, 2.35, -3.25], materials.wood);
    box([4.8, 0.12, 0.55], [1.3, 3.15, -3.25], materials.wood);

    const addTable = (x, z) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 32), materials.wood);
      top.position.set(x, 0.82, z); top.castShadow = true; this.cafeRoot.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.78, 16), materials.metal);
      leg.position.set(x, 0.4, z); this.cafeRoot.add(leg);
      [[-.9,0],[.9,0],[0,-.9]].forEach(([dx,dz]) => {
        box([0.52,0.12,0.52],[x+dx,0.48,z+dz],materials.fabric);
        box([0.08,0.46,0.08],[x+dx,0.23,z+dz],materials.metal);
        box([0.52,0.62,0.1],[x+dx,0.78,z+dz-.2],materials.fabric);
      });
    };
    addTable(-2.5, 1.5); addTable(0, 1.35); addTable(2.55, 1.45);
    [[-4.1,-2.6],[4.2,-2.7]].forEach(([x,z]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,.55,18), materials.stone); pot.position.set(x,.28,z); this.cafeRoot.add(pot);
      for (let index=0; index<5; index+=1) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(.24,14,10),materials.green); leaf.scale.set(.55,1.7,.38); leaf.position.set(x+(index-2)*.1,.8+Math.abs(index-2)*.12,z); leaf.rotation.z=(index-2)*.35; this.cafeRoot.add(leaf); }
    });
    [-2.3, 0, 2.3].forEach((x) => {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.25,8), materials.metal);
      cable.position.set(x,4.35,-.4); this.cafeRoot.add(cable);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.38,0.42,24,1,true), materials.metal);
      shade.position.set(x,3.7,-.4); shade.rotation.x = Math.PI; this.cafeRoot.add(shade);
      const light = new THREE.PointLight(0xffc784,1.8,5); light.position.set(x,3.5,-.4); light.castShadow = true; this.cafeRoot.add(light);
    });
    this.scene.add(new THREE.HemisphereLight(0xcbe9ff, 0x38291f, 1.8));
    const key = new THREE.DirectionalLight(0xffe2be, 2.2); key.position.set(5,8,6); key.castShadow = true; this.scene.add(key);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.viewport.classList.add("has-webgl");
    this.renderFrame();
  }

  resize() {
    if (!this.renderer) return;
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
  }

  renderFrame() {
    if (this.disposed || !this.renderer) return;
    if (!this.drag) this.targetRotation.y += 0.0015;
    this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.08;
    this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.08;
    this.cafeRoot.rotation.x = this.rotation.x; this.cafeRoot.rotation.y = this.rotation.y;
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(() => this.renderFrame());
  }

  setStage(index) { this.viewport.dataset.renderStage = String(index); }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    if (this.scene) this.scene.traverse((object) => { object.geometry?.dispose?.(); if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose()); else object.material?.dispose?.(); });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
  }
}

class AgentBrainAdapter {
  constructor(mode) { this.mode = mode; }
  async planTask() { throw new Error("planTask() must be implemented by an Agent Brain adapter."); }
  chooseTools(plan) { return plan.tools || []; }
  generateSteps(plan) { return plan.steps || []; }
  async executeStep(step) { return { stepId: step.id, status: "completed" }; }
  summarizeResult(result) { return result; }
}

class LocalMockBrainAdapter extends AgentBrainAdapter {
  constructor() { super("localMock"); }
  async planTask(userMessage, intent) {
    const plans = {
      interior_3d_design: { tools: ["Interior3DEngine"], steps: ["Analyze interior style", "Build cafe shell", "Place counter and furniture", "Apply modern materials", "Set warm lighting", "Enable orbit preview"] },
      browser_booking: { tools: ["BrowserAutomationEngine"], steps: ["Identify official website", "Search preview sessions", "Select date and time", "Choose ticket quantity", "Select seats", "Stop before payment"] },
      website_builder: { tools: ["WebsiteBuildEngine", "FileWorkspaceEngine"], steps: ["Parse brand direction", "Build navigation", "Compose fashion hero", "Generate product catalog", "Apply responsive layout", "Wait for design approval"] },
      general_workspace: { tools: ["WorkbenchToolExecutor"], steps: ["Understand request", "Create plan", "Prepare workspace", "Generate preview"] }
    };
    return { intent, summary: userMessage, brain: this.mode, ...(plans[intent] || plans.general_workspace) };
  }
}

class LocalProxyBrainAdapter extends AgentBrainAdapter {
  constructor(mode) { super(mode); }
  async planTask(userMessage, intent) {
    const response = await fetch(`${AGENT_API_BASE}/api/agent/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: userMessage, intent, brain: this.mode }) });
    if (!response.ok) throw new Error(`${this.mode} proxy returned HTTP ${response.status}`);
    return response.json();
  }
}

class AntigravityExecutorAdapter {
  detectAvailability() { return { available: false, status: "adapter_ready", mode: "manual_connection_required" }; }
  async openProject(projectPath) { return { projectPath, status: "manual_connection_required" }; }
  async runPrompt(prompt) { return { prompt, status: "manual_connection_required" }; }
  streamEvents() { return new EventTarget(); }
  reportStatus() { return this.detectAvailability(); }
  fallbackToLocalAgent() { return new LocalMockBrainAdapter(); }
}

class BrowserAutomationEngine {
  constructor() {
    this.targetSite = "Vieshow Cinemas";
    this.officialUrl = VIESHOW_OFFICIAL_URL;
    this.mode = "frontend_preview";
    this.futureEngine = "playwright_ready";
    this.safetyMode = "stop_before_payment";
    this.currentStep = 0;
  }
  openOfficialSite() { window.open(this.officialUrl, "_blank", "noopener,noreferrer"); }
  previewAutomation(step) { this.currentStep = step; return { step, mode: this.mode, safetyMode: this.safetyMode }; }
  requestUserConfirmation() { return { status: "waiting_for_user", reason: "Payment, login, or verification requires user confirmation." }; }
}

class WebsiteBuildEngine {
  constructor() { this.status = "idle"; }
  start(request) { this.status = "executing"; return { request, status: this.status, preview: "fashion_store" }; }
  markPreviewReady() { this.status = "preview_ready"; return this.status; }
}

class FileWorkspaceEngine {
  constructor(storageKey) { this.storageKey = storageKey; }
  load() { try { const data = JSON.parse(localStorage.getItem(this.storageKey) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } }
  save(projects) { localStorage.setItem(this.storageKey, JSON.stringify(projects)); }
  createProject(name, files) { return { id: `${name}-${Date.now()}`, name, createdAt: new Date().toISOString(), files }; }
  addFile(project, path, content) { project.files[path] = content; return project; }
  renderFileTree(projects) { return projects.map((project) => ({ id: project.id, name: project.name, paths: Object.keys(project.files) })); }
  openFile(project, path) { return project?.files?.[path] ?? null; }
  previewFile(project, path) { return this.openFile(project, path); }
  downloadProject(project, downloadFile) { Object.keys(project.files).filter((path) => !path.includes("/")).forEach((path) => downloadFile(project.id, path)); }
}

class AgentToolExecutor {
  constructor() { this.tools = new Map(); }
  register(name, engine) { this.tools.set(name, engine); return this; }
  unregister(name) { this.tools.delete(name); return this; }
  has(name) { return this.tools.has(name); }
  async execute(name, method, ...args) {
    const engine = this.tools.get(name);
    if (!engine || typeof engine[method] !== "function") throw new Error(`Tool unavailable: ${name}.${method}`);
    return engine[method](...args);
  }
  report() { return Array.from(this.tools.keys()).map((name) => ({ name, status: "ready" })); }
}

class AgentStatusStream extends EventTarget {
  constructor() { super(); this.mode = "local_async"; this.connection = null; }
  publish(type, payload) { this.dispatchEvent(new CustomEvent(type, { detail: payload })); }
  connectWebSocket(url) { this.disconnect(); this.mode = "websocket"; this.connection = new WebSocket(url); this.connection.onmessage = (event) => this.publish("event", JSON.parse(event.data)); return this.connection; }
  connectSSE(url) { this.disconnect(); this.mode = "sse"; this.connection = new EventSource(url); this.connection.onmessage = (event) => this.publish("event", JSON.parse(event.data)); return this.connection; }
  connectPolling(poll, interval = 1000) { this.disconnect(); this.mode = "polling"; this.connection = window.setInterval(async () => this.publish("event", await poll()), interval); return this.connection; }
  disconnect() { if (!this.connection) return; if (typeof this.connection === "number") clearInterval(this.connection); else this.connection.close?.(); this.connection = null; }
}

class AgentOrchestrator extends EventTarget {
  constructor(brainMode = AGENT_BRAIN_MODE) {
    super();
    this.brain = brainMode === "localMock" ? new LocalMockBrainAdapter() : new LocalProxyBrainAdapter(brainMode);
    this.statusStream = new AgentStatusStream();
    this.state = null;
  }
  emit(type, detail = {}) { const payload = { ...this.state, ...detail }; this.dispatchEvent(new CustomEvent(type, { detail: payload })); this.statusStream.publish(type, payload); }
  async startTask(userMessage, intent) {
    const taskId = `nova-task-${Date.now()}`;
    this.state = { taskId, intent, brain: this.brain.mode, status: "planning", currentStep: null, steps: [], toolCalls: [], cursor: null, output: null, files: [] };
    this.emit("status", { message: "Agent is planning the task" });
    try {
      const plan = await this.brain.planTask(userMessage, intent);
      this.state.steps = this.brain.generateSteps(plan).map((label, index) => ({ id: `step-${index + 1}`, label, status: "pending" }));
      this.state.toolCalls = this.brain.chooseTools(plan).map((name) => ({ name, status: "selected" }));
      this.state.status = "executing";
      this.emit("plan", { plan });
      this.emit("status", { message: "Plan ready · executing" });
      return this.state;
    } catch (error) {
      if (this.brain.mode !== "localMock") {
        this.brain = new LocalMockBrainAdapter();
        return this.startTask(userMessage, intent);
      }
      this.state.status = "failed"; this.emit("status", { message: error.message }); throw error;
    }
  }
  advance(index, message, cursor) {
    if (!this.state) return;
    this.state.steps.forEach((step, stepIndex) => { step.status = stepIndex < index ? "completed" : stepIndex === index ? "executing" : "pending"; });
    this.state.currentStep = this.state.steps[index]?.id || null;
    this.state.status = index >= this.state.steps.length - 1 ? "preview_ready" : "using_tool";
    this.state.cursor = cursor;
    this.emit("step", { index, message });
    this.emit("status", { message });
  }
  complete(output = null, files = []) { if (!this.state) return; this.state.status = "completed"; this.state.output = output; this.state.files = files; this.emit("completed"); }
  stop() { if (!this.state) return; this.state.status = "idle"; this.emit("status", { message: "Agent stopped" }); }
}

let hasCompletedFirstTask = false;
let isAgentRunning = false;
let agentStatusPollTimer = null;

/* ================================
VIDEO STATE LAYER
Handles avatar video states, crossfade, and playback timing.
================================ */

class CrossfadeController {
  constructor(videoA, videoB, defaultDuration = 450) {
    this.layers = [videoA, videoB];
    this.activeIndex = 0;
    this.defaultDuration = defaultDuration;

    this.layers.forEach((video, index) => {
      video.classList.toggle("is-active", index === this.activeIndex);
      video.classList.toggle("is-standby", index !== this.activeIndex);
      video.muted = true;
      video.playsInline = true;
    });
  }

  get activeVideo() {
    return this.layers[this.activeIndex];
  }

  get standbyVideo() {
    return this.layers[1 - this.activeIndex];
  }

  async showInitial(src, options = {}) {
    const active = this.activeVideo;
    await this.prepareVideo(active, src, options);
    active.style.transitionDuration = "0ms";
    active.classList.add("is-active");
    active.classList.remove("is-standby");
    requestAnimationFrame(() => {
      active.style.transitionDuration = `${this.defaultDuration}ms`;
    });
    return active;
  }

  async crossfadeTo(src, options = {}) {
    const duration = options.duration ?? this.defaultDuration;
    const previous = this.activeVideo;
    const next = this.standbyVideo;

    // The standby layer is decoded and playing before the visible layer changes.
    await this.prepareVideo(next, src, options);
    previous.style.transitionDuration = `${duration}ms`;
    next.style.transitionDuration = `${duration}ms`;
    next.classList.add("is-standby");
    next.classList.remove("is-active");

    await this.nextFrame();
    next.classList.add("is-active");
    next.classList.remove("is-standby");
    previous.classList.remove("is-active");
    previous.classList.add("is-standby");

    await this.wait(duration);
    previous.pause();
    this.activeIndex = 1 - this.activeIndex;
    return next;
  }

  async prepareVideo(video, src, options = {}) {
    video.onended = null;
    video.loop = Boolean(options.loop);
    video.muted = true;
    video.playsInline = true;

    const currentSrc = video.getAttribute("src");
    const resolvedCurrent = currentSrc ? new URL(currentSrc, window.location.href).href : "";
    const resolvedNext = new URL(src, window.location.href).href;
    if (resolvedCurrent !== resolvedNext) {
      video.src = src;
      video.load();
      await this.waitUntilReady(video);
    }

    try {
      video.currentTime = 0;
    } catch (error) {
      console.warn("[NOVA Video] Unable to reset video time.", error);
    }

    await this.safePlay(video);
    await this.waitForFirstFrame(video);
  }

  waitUntilReady(video) {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let timeoutId;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeEventListener("canplaythrough", finish);
        video.removeEventListener("canplay", finish);
        video.removeEventListener("error", handleError);
        resolve();
      };
      const handleError = () => {
        console.error(`[NOVA Video] Unable to load ${video.currentSrc || video.src}`);
        finish();
      };

      video.addEventListener("canplaythrough", finish, { once: true });
      video.addEventListener("canplay", finish, { once: true });
      video.addEventListener("error", handleError, { once: true });
      timeoutId = window.setTimeout(finish, 5000);
    });
  }

  waitForFirstFrame(video) {
    if (typeof video.requestVideoFrameCallback !== "function") {
      return this.waitUntilReady(video);
    }

    return new Promise((resolve) => {
      let settled = false;
      let callbackId;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (callbackId !== undefined && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(callbackId);
        }
        resolve();
      };
      const timeoutId = window.setTimeout(finish, 3000);
      callbackId = video.requestVideoFrameCallback(finish);
    });
  }

  waitForEnded(video, maximumWaitMs = 30000) {
    if (video.ended) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeEventListener("ended", finish);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, maximumWaitMs);
      video.addEventListener("ended", finish, { once: true });
    });
  }

  async safePlay(video) {
    try {
      await video.play();
    } catch (error) {
      console.warn("[NOVA Video] Muted autoplay was interrupted.", error);
    }
  }

  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

class AvatarController {
  constructor() {
    this.config = {
      brand_name: "NOVA AI",
      hero_subtitle: "Your Intelligent Digital Human Assistant",
      hero_description: "Experience a next-generation AI assistant with natural conversation, voice interaction, and digital human presentation.",
      primary_color: "#0f172a",
      secondary_color: "#1e293b",
      accent_color: "#38bdf8",
      avatar_name: "NOVA",
      video_paths: VIDEO_PATHS,
      crossfade_ms: 450
    };

    this.currentState = AVATAR_STATES.INITIAL_LOOP_040;
    this.hasCompletedFirstTask = hasCompletedFirstTask;
    this.videoAvailable = false;
    this.imageFallbackExists = false;
    this.isBusy = false;
    this.currentTaskName = "";
    this.currentRequestId = 0;
    this.flowEvents = [];

    this.videoWrapper = document.getElementById("video-wrapper");
    this.videoA = document.getElementById("avatar-video-a");
    this.videoB = document.getElementById("avatar-video-b");
    this.imageFallbackContainer = document.getElementById("image-fallback-container");
    this.cssFallbackContainer = document.getElementById("css-fallback-container");
    this.statusBadge = document.getElementById("avatar-status-badge");
    this.statusText = document.getElementById("avatar-status-text");
    this.chatInput = document.getElementById("chat-input");
    this.btnSend = document.getElementById("btn-send");
    this.btnClear = document.getElementById("btn-clear");
    this.chatHistory = document.getElementById("chat-history");
    this.subtitlesOverlay = document.getElementById("subtitles-overlay");
    this.subtitleText = document.getElementById("subtitle-text");

    this.agentOverlay = document.getElementById("agent-overlay");
    this.agentStatusBadge = document.getElementById("agent-overlay-status");
    this.agentTaskDesc = document.getElementById("agent-overlay-task-desc");
    this.agentStatusLabel = document.getElementById("agent-overlay-status-label");
    this.agentIframe = document.getElementById("agent-workbench-frame");
    this.agentCompletionText = document.getElementById("agent-completion-message");
    this.agentErrorText = document.getElementById("agent-error-message");
    this.agentStreamlitNotice = document.getElementById("agent-streamlit-notice");
    this.agentCloseButton = document.getElementById("agent-overlay-close");
    this.agentFooter = document.getElementById("agent-overlay-footer");
    this.workbenchPanel = document.getElementById("nova-workbench");
    this.workbenchTaskCanvas = document.getElementById("workbench-task-canvas") || document.querySelector(".workbench-main");
    this.workbenchCurrentTask = document.getElementById("workbench-current-task");
    this.fastApiWorkbenchStatus = document.getElementById("fastapi-workbench-status");
    this.streamlitWorkbenchStatus = document.getElementById("streamlit-workbench-status");
    this.workbenchTabs = Array.from(document.querySelectorAll(".workbench-tab"));
    this.workbenchNavButtons = Array.from(document.querySelectorAll(".workbench-nav-button"));
    this.workbenchCards = Array.from(document.querySelectorAll(".workbench-card"));
    this.agentPollInFlight = false;
    this.agentCompletionInProgress = false;
    this.cancel041WorkbenchCue = null;
    this.currentWorkbenchTaskType = "default";
    this.workbenchTaskTimeline = null;
    this.workbenchTaskTimers = [];
    this.design3DEngine = null;
    this.currentWorkbenchRequest = "";
    this.browserAutomationEngine = new BrowserAutomationEngine();
    this.websiteBuildEngine = new WebsiteBuildEngine();
    this.fileWorkspaceEngine = new FileWorkspaceEngine(WORKBENCH_PROJECTS_STORAGE_KEY);
    this.antigravityExecutor = new AntigravityExecutorAdapter();
    this.toolExecutor = new AgentToolExecutor()
      .register("BrowserAutomationEngine", this.browserAutomationEngine)
      .register("WebsiteBuildEngine", this.websiteBuildEngine)
      .register("FileWorkspaceEngine", this.fileWorkspaceEngine)
      .register("AntigravityExecutorAdapter", this.antigravityExecutor);
    this.agentOrchestrator = new AgentOrchestrator(AGENT_BRAIN_MODE);
    this.agentLogs = [];
    this.generatedProjects = this.loadGeneratedProjects();

    this.crossfade = new CrossfadeController(this.videoA, this.videoB, this.config.crossfade_ms);
    this.bindAgentRuntimeEvents();
  }

  async init() {
    document.body.classList.remove("agent-overlay-preparing", "agent-overlay-open", "agent-overlay-closing");
    loadOptionalGsap();
    console.info("[NOVA Phase 0.7] Initializing local 040-043 mock flow.");
    this.applyBranding();
    this.configureWorkbenchChrome();
    this.bindEvents();
    this.videoAvailable = await this.verifyRequiredVideos();
    this.imageFallbackExists = this.videoAvailable
      ? false
      : await this.checkImageExists(this.config.video_paths.Fallback);
    this.setupVisualMode();

    if (!this.videoAvailable) {
      this.showFallbackAvatar();
      console.error("[NOVA Phase 0.7] Required 040-043 video assets are incomplete.");
      return;
    }

    await this.playState(AVATAR_STATES.INITIAL_LOOP_040, { loop: true, initial: true });
  }

  applyBranding() {
    document.title = `${this.config.brand_name} - ${this.config.hero_subtitle}`;
    this.setText("hero-title", this.config.brand_name);
    this.setText("hero-subtitle", this.config.hero_subtitle);
    this.setText("hero-description", this.config.hero_description);
    document.documentElement.style.setProperty("--primary-color", this.config.primary_color);
    document.documentElement.style.setProperty("--secondary-color", this.config.secondary_color);
    document.documentElement.style.setProperty("--accent-color", this.config.accent_color);
  }

  configureWorkbenchChrome() {
    const sidebar = this.workbenchPanel.querySelector(".workbench-sidebar");
    if (sidebar) {
      sidebar.innerHTML = [
        ["home", "fa-house", "Home"],
        ["tasks", "fa-rectangle-list", "Tasks"],
        ["browser", "fa-globe", "Browser"],
        ["design", "fa-pen-ruler", "Design"],
        ["files", "fa-folder", "Files"],
        ["exports", "fa-file-export", "Exports"]
      ].map(([view, icon, label], index) => `<button class="workbench-nav-button ${index === 0 ? "is-active" : ""}" type="button" data-workbench-view="${view}" aria-label="${label}"><i class="fa-solid ${icon}"></i><span>${label}</span></button>`).join("");
    }
    this.workbenchPanel.querySelector(".workbench-toolbar")?.remove();
    this.workbenchPanel.querySelector(".workbench-status-panel")?.remove();
    this.workbenchPanel.querySelector(".workbench-reflection")?.remove();
    this.workbenchTaskCanvas.id = "workbench-task-canvas";
    this.workbenchTaskCanvas.classList.add("dynamic-task-canvas");
    this.workbenchNavButtons = Array.from(this.workbenchPanel.querySelectorAll(".workbench-nav-button"));
    this.workbenchTabs = [];
    this.workbenchCards = Array.from(this.agentOverlay.querySelectorAll(".workbench-card"));
  }

  loadGeneratedProjects() {
    return this.fileWorkspaceEngine.load().filter((project) => project && project.id && project.files);
  }

  persistGeneratedProjects() {
    try { this.fileWorkspaceEngine.save(this.generatedProjects); }
    catch (error) { console.warn("[NOVA Files] Unable to persist generated project.", error); }
  }

  createWebsiteProject() {
    const request = this.currentWorkbenchRequest || "Premium fashion storefront";
    const id = `fashion-store-${Date.now()}`;
    const safeTitle = escapeWorkbenchText(request).replace(/&[^;]+;/g, "").slice(0, 80) || "Fashion Store";
    return {
      id,
      name: "fashion-store",
      createdAt: new Date().toISOString(),
      files: {
        "index.html": `<!doctype html>\n<html lang="zh-Hant">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><link rel="stylesheet" href="style.css"></head>\n<body><header class="nav"><strong>ATELIER / 01</strong><nav>New Arrival · Lookbook · Best Seller</nav></header><main><section class="hero"><p>FUTURE ESSENTIALS</p><h1>Wear what comes next.</h1><button>Explore collection</button></section><section class="products"><article>Form Jacket · NT$ 6,980</article><article>Glass Knit · NT$ 3,280</article><article>Motion Trouser · NT$ 4,680</article><article>Vector Coat · NT$ 8,800</article><article>Core Tee · NT$ 1,980</article><article>Orbit Bag · NT$ 3,980</article></section></main><script src="script.js"><\/script></body></html>`,
        "style.css": `:root{font-family:Inter,sans-serif;color:#101827;background:#eef5f9}*{box-sizing:border-box}body{margin:0}.nav{display:flex;justify-content:space-between;padding:24px 5vw}.hero{min-height:62vh;padding:10vh 8vw;background:radial-gradient(circle at 80% 20%,#bce9ff,transparent 35%),linear-gradient(135deg,#fff,#dcebf4)}h1{max-width:720px;font-size:clamp(48px,8vw,108px);line-height:.9}button{padding:14px 22px;border:0;border-radius:999px;color:white;background:#147dcc}.products{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:32px 5vw}.products article{min-height:220px;padding:24px;border:1px solid #fff;border-radius:28px;background:#ffffff8c;box-shadow:0 24px 70px #1e4a6820}@media(max-width:700px){.products{grid-template-columns:1fr}}`,
        "script.js": `document.querySelector('button')?.addEventListener('click',()=>document.querySelector('.products')?.scrollIntoView({behavior:'smooth'}));`,
        "assets/README.md": `Generated by NOVA Website Design Studio.\nDesign request: ${request.replace(/[\r\n]+/g, " ").slice(0, 180)}`
      }
    };
  }

  saveWebsiteProject() {
    this.updateToolCall("FileWorkspaceEngine", "using_tool");
    this.setAgentStatus("using_tool", "Generating code package");
    const project = this.createWebsiteProject();
    this.generatedProjects = [project, ...this.generatedProjects.filter((item) => item.name !== project.name)];
    this.persistGeneratedProjects();
    this.websiteBuildEngine.markPreviewReady();
    this.agentOrchestrator.complete({ projectId: project.id, status: "code_package_ready" }, Object.keys(project.files));
    this.renderFilesWorkspace(project.id);
  }

  renderFilesWorkspace(activeProjectId = this.generatedProjects[0]?.id) {
    this.clearWorkbenchTaskAnimation();
    this.destroyCapabilityEngines();
    const projects = this.generatedProjects;
    this.workbenchTaskCanvas.innerHTML = `<div class="files-workspace"><header class="task-canvas-heading"><span class="task-canvas-icon"><i class="fa-solid fa-folder-tree"></i></span><div><span class="task-canvas-kicker">FILE OUTPUT ENGINE</span><h3>Generated Projects</h3><p>Saveable front-end packages created by NOVA.</p></div><button type="button" class="export-folder-button" data-workbench-action="export-folder" ${projects.length ? "" : "disabled"}>Export folder</button></header><div class="files-workspace-body"><aside class="project-tree">${projects.length ? projects.map((project) => `<section class="project-node ${project.id === activeProjectId ? "is-open" : ""}"><button type="button" data-workbench-action="toggle-project" data-project-id="${project.id}"><i class="fa-solid fa-folder"></i>${project.name}/</button><div>${Object.keys(project.files).map((path) => `<button type="button" data-workbench-action="open-generated-file" data-project-id="${project.id}" data-file-path="${path}"><i class="fa-regular fa-file-code"></i>${path}</button>`).join("")}</div></section>`).join("") : `<p>No generated projects yet.<br>Use Website Design Studio, then Save as Code.</p>`}</aside><main class="file-preview"><div class="file-preview-empty"><i class="fa-solid fa-code"></i><strong>Choose a generated file</strong><span>Files stay in this browser until exported.</span></div></main></div></div>`;
    this.workbenchNavButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.workbenchView === "files"));
  }

  showGeneratedFile(projectId, path) {
    const project = this.generatedProjects.find((item) => item.id === projectId);
    const preview = this.workbenchTaskCanvas.querySelector(".file-preview");
    if (!project || !preview || !(path in project.files)) return;
    preview.innerHTML = `<header><span>${project.name}/${escapeWorkbenchText(path)}</span><button type="button" data-workbench-action="download-generated-file" data-project-id="${project.id}" data-file-path="${escapeWorkbenchText(path)}"><i class="fa-solid fa-download"></i> Download</button></header><pre><code></code></pre>`;
    preview.querySelector("code").textContent = project.files[path];
  }

  downloadGeneratedFile(projectId, path) {
    const project = this.generatedProjects.find((item) => item.id === projectId);
    if (!project || !(path in project.files)) return;
    const blob = new Blob([project.files[path]], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = path.split("/").pop(); anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async exportGeneratedFolder() {
    const project = this.generatedProjects[0];
    if (!project) return;
    if (!window.showDirectoryPicker) {
      Object.keys(project.files).filter((path) => !path.includes("/")).forEach((path) => this.downloadGeneratedFile(project.id, path));
      return;
    }
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite" });
      const folder = await root.getDirectoryHandle(project.name, { create: true });
      for (const [path, content] of Object.entries(project.files)) {
        if (path.includes("/")) continue;
        const handle = await folder.getFileHandle(path, { create: true });
        const writable = await handle.createWritable(); await writable.write(content); await writable.close();
      }
    } catch (error) {
      if (error.name !== "AbortError") console.warn("[NOVA Files] Folder export failed.", error);
    }
  }

  handleWorkbenchAction(event) {
    const action = event.target.closest("[data-workbench-action]");
    const nav = event.target.closest("[data-workbench-view]");
    if (nav) {
      this.workbenchNavButtons.forEach((button) => button.classList.toggle("is-active", button === nav));
      if (nav.dataset.workbenchView === "files" || nav.dataset.workbenchView === "exports") this.renderFilesWorkspace();
      else if (nav.dataset.workbenchView === "design" && this.currentWorkbenchRequest) this.renderCurrentWorkbenchTask(this.currentWorkbenchRequest);
      return;
    }
    if (!action) return;
    const type = action.dataset.workbenchAction;
    if (type === "save-website-code") this.saveWebsiteProject();
    if (type === "open-generated-file") this.showGeneratedFile(action.dataset.projectId, action.dataset.filePath);
    if (type === "download-generated-file") this.downloadGeneratedFile(action.dataset.projectId, action.dataset.filePath);
    if (type === "toggle-project") action.closest(".project-node")?.classList.toggle("is-open");
    if (type === "export-folder") this.exportGeneratedFolder();
    if (type === "booking-mode") {
      const panel = action.closest(".safety-panel");
      panel?.querySelectorAll("[data-booking-mode]").forEach((button) => button.classList.toggle("is-active", button === action));
      const title = panel?.querySelector(".safety-lock strong");
      const detail = panel?.querySelector(".safety-lock small");
      const authorized = action.dataset.bookingMode === "authorized";
      if (title) title.textContent = authorized ? "Ready for official handoff" : "Payment protected";
      if (detail) detail.textContent = authorized ? "Continue manually on VIESHOW after confirmation" : "No transaction executed";
    }
    if (type === "refine-design") {
      this.clearWorkbenchTaskAnimation();
      this.runWebsiteDesignWorkflowAnimation(this.workbenchTaskCanvas.querySelector(".task-workflow"));
    }
  }

  setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.innerText = text;
  }

  bindEvents() {
    this.btnSend.addEventListener("click", () => this.handleSendMessageFlow());
    this.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.handleSendMessageFlow();
      }
    });
    this.btnClear.addEventListener("click", () => this.clearChat());
    this.agentCloseButton.addEventListener("click", () => this.closeAgentOverlayAfterError());
    this.workbenchTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.workbenchTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      });
    });
    this.workbenchNavButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.workbenchNavButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      });
    });
    this.workbenchPanel.addEventListener("click", (event) => this.handleWorkbenchAction(event));
  }

  async verifyRequiredVideos() {
    const requiredStates = [
      AVATAR_STATES.INITIAL_LOOP_040,
      AVATAR_STATES.FIRST_ACK_041,
      AVATAR_STATES.COMPLETE_TRANSITION_042,
      AVATAR_STATES.FINAL_LOOP_043
    ];
    const results = await Promise.all(
      requiredStates.map((state) => this.checkVideoExists(this.config.video_paths[state]))
    );
    const allFound = results.every(Boolean);
    console.info(`[NOVA Phase 0.7] 040-043 asset check: ${allFound ? "FOUND" : "INCOMPLETE"}`);
    return allFound;
  }

  checkVideoExists(src) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      let settled = false;
      const finish = (exists) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(exists);
      };
      const timeoutId = window.setTimeout(() => finish(false), 5000);
      video.preload = "metadata";
      video.onloadedmetadata = () => finish(true);
      video.onerror = () => finish(false);
      video.src = src;
    });
  }

  checkImageExists(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = src;
    });
  }

  setupVisualMode() {
    this.videoWrapper.style.display = this.videoAvailable ? "block" : "none";
    this.imageFallbackContainer.style.display = "none";
    this.cssFallbackContainer.style.display = "none";
  }

  waitFor041WorkbenchCue(video, requestId, seconds = FIRST_ACK_WORKBENCH_CUE_SECONDS) {
    this.clear041WorkbenchCue();
    if (!video) return Promise.resolve(false);

    return new Promise((resolve) => {
      let prepared = false;
      let shellPrepared = false;
      let fired = false;

      const cleanup = () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ended", onEnded);
        if (this.cancel041WorkbenchCue === cancel) {
          this.cancel041WorkbenchCue = null;
        }
      };

      const prepare = () => {
        if (prepared || !this.isCurrentRequest(requestId)) return;
        prepared = true;
        document.body.classList.add("agent-overlay-preparing");
        this.logFlowEvent("first-ack:overlay-preparing", {
          requestId,
          currentTime: Number(video.currentTime.toFixed(2))
        });
      };

      const prepareShell = () => {
        if (shellPrepared || !this.isCurrentRequest(requestId)) return;
        shellPrepared = true;
        prepare();
        this.agentOverlay.classList.add("preparing");
      };

      const finish = (triggered) => {
        if (fired) return;
        fired = true;
        if (triggered) prepareShell();
        cleanup();
        if (!triggered) {
          document.body.classList.remove("agent-overlay-preparing");
          this.agentOverlay.classList.remove("preparing");
        }
        resolve(triggered && this.isCurrentRequest(requestId));
      };

      const fire = () => finish(true);
      const onTimeUpdate = () => {
        if (video.currentTime >= FIRST_ACK_PREPARE_SECONDS) prepare();
        if (video.currentTime >= FIRST_ACK_SHELL_PREPARE_SECONDS) prepareShell();
        if (video.currentTime >= seconds) fire();
      };
      const onEnded = () => fire();
      const cancel = () => finish(false);

      this.cancel041WorkbenchCue = cancel;
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended", onEnded, { once: true });

      onTimeUpdate();
    });
  }

  clear041WorkbenchCue() {
    if (!this.cancel041WorkbenchCue) return;
    const cancel = this.cancel041WorkbenchCue;
    this.cancel041WorkbenchCue = null;
    cancel();
  }

  bindAgentRuntimeEvents() {
    this.agentOrchestrator.addEventListener("status", (event) => {
      this.setAgentStatus(event.detail.status, event.detail.message);
      if (event.detail.message) this.appendAgentLog(event.detail.message);
    });
    this.agentOrchestrator.addEventListener("plan", (event) => {
      const tools = event.detail.toolCalls || [];
      const chip = this.workbenchTaskCanvas.querySelector(".agent-tool-chip");
      if (chip) chip.textContent = tools.map((tool) => tool.name).join(" + ") || "No tool required";
    });
    this.agentOrchestrator.addEventListener("step", (event) => this.updateCurrentStep(event.detail.currentStep, event.detail.status));
    this.agentOrchestrator.addEventListener("completed", (event) => this.renderFiles(event.detail.files || []));
  }

  getAgentIntent(taskType) {
    if (taskType === "design3d") return "interior_3d_design";
    if (taskType === "booking") return "browser_booking";
    if (taskType === "demoToCode") return "website_builder";
    return "general_workspace";
  }

  appendAgentLog(message) {
    this.agentLogs.push({ at: new Date().toISOString(), message });
    if (this.agentLogs.length > 40) this.agentLogs.shift();
    const stream = this.workbenchTaskCanvas.querySelector(".agent-log-stream");
    if (!stream) return;
    const row = document.createElement("span");
    row.textContent = message;
    stream.appendChild(row);
    while (stream.children.length > 4) stream.firstElementChild.remove();
    stream.scrollTop = stream.scrollHeight;
  }

  updateCurrentStep(stepId, status) {
    const steps = Array.from(this.workbenchTaskCanvas.querySelectorAll(".ai-step"));
    const index = this.agentOrchestrator.state?.steps.findIndex((step) => step.id === stepId) ?? -1;
    steps.forEach((step, stepIndex) => {
      step.classList.toggle("is-complete", stepIndex < index);
      step.classList.toggle("is-active", stepIndex === index && status !== "completed");
    });
  }

  updateToolCall(toolName, status = "using_tool") {
    const chip = this.workbenchTaskCanvas.querySelector(".agent-tool-chip");
    if (chip) chip.textContent = `${toolName} · ${status.replaceAll("_", " ")}`;
  }

  moveAgentCursor(x, y) {
    const cursor = this.workbenchTaskCanvas.querySelector(".ai-cursor");
    if (!cursor) return;
    cursor.style.left = `${x}%`; cursor.style.top = `${y}%`;
  }

  moveCursorTo(selectorOrPoint) {
    if (typeof selectorOrPoint === "object") return this.moveAgentCursor(selectorOrPoint.x, selectorOrPoint.y);
    const root = this.workbenchTaskCanvas.querySelector(".ai-live-window");
    const target = root?.querySelector(selectorOrPoint);
    const cursor = root?.querySelector(".ai-cursor");
    if (!target || !cursor) return;
    const rootBounds = root.getBoundingClientRect(); const bounds = target.getBoundingClientRect();
    cursor.style.left = `${((bounds.left + bounds.width / 2 - rootBounds.left) / rootBounds.width) * 100}%`;
    cursor.style.top = `${((bounds.top + bounds.height / 2 - rootBounds.top) / rootBounds.height) * 100}%`;
  }

  clickCursorTarget(selectorOrPoint) {
    const root = this.workbenchTaskCanvas.querySelector(".ai-live-window");
    const cursor = root?.querySelector(".ai-cursor");
    const target = typeof selectorOrPoint === "string" ? root?.querySelector(selectorOrPoint) : null;
    cursor?.classList.remove("is-clicking"); requestAnimationFrame(() => cursor?.classList.add("is-clicking"));
    if (target) { target.classList.add("is-agent-target"); window.setTimeout(() => target.classList.remove("is-agent-target"), 520); }
  }

  highlightAgentTarget(selector) { const target = this.workbenchTaskCanvas.querySelector(selector); target?.classList.add("is-agent-target"); return target; }
  updateAgentBubble(text) { const bubble = this.workbenchTaskCanvas.querySelector(".ai-action-bubble"); if (bubble) bubble.textContent = text; }
  completeAgentStep(stepId) { const step = this.agentOrchestrator.state?.steps.find((item) => item.id === stepId); if (step) step.status = "completed"; this.updateCurrentStep(stepId, "completed"); }
  runAgentCursorStep(step) { const point = step.cursor || { x: step.x, y: step.y }; this.updateAgentBubble(step.message); this.moveCursorTo(point); this.clickCursorTarget(step.target || point); }
  renderLivePreview(payload) { const root = this.workbenchTaskCanvas.querySelector(".task-workflow"); if (root && payload?.ready) root.classList.add("is-ready"); }
  renderFiles(files) { if (!files.length) return; this.appendAgentLog(`${files.length} output files ready`); }
  setAgentStatus(status, message = "") { const node = this.workbenchTaskCanvas.querySelector("[data-agent-status]"); if (node) node.textContent = message || status.replaceAll("_", " "); this.agentStatusLabel.textContent = status.replaceAll("_", " ").toUpperCase(); }

  async startAgentTaskRuntime(task, taskType) {
    this.agentLogs = [];
    await this.agentOrchestrator.startTask(task, this.getAgentIntent(taskType));
    const selectedTool = this.agentOrchestrator.state.toolCalls[0]?.name;
    if (selectedTool) this.updateToolCall(selectedTool, "selected");
  }

  renderCurrentWorkbenchTask(task) {
    this.clearWorkbenchTaskAnimation();
    this.destroyCapabilityEngines();
    this.currentWorkbenchRequest = task;
    this.currentWorkbenchTaskType = detectWorkbenchTaskType(task);
    this.workbenchTaskCanvas.innerHTML = renderWorkbenchTask(this.currentWorkbenchTaskType, task);
    this.workbenchTaskCanvas.querySelector(".task-workflow")?.insertAdjacentHTML("beforeend", `<div class="agent-live-console"><strong>AGENT LOG</strong><div class="agent-log-stream"></div></div>`);
    this.workbenchCurrentTask = document.getElementById("workbench-current-task");
    this.workbenchCards = Array.from(this.agentOverlay.querySelectorAll(".workbench-card"));
    if (this.currentWorkbenchTaskType === "design3d") {
      const viewport = this.workbenchTaskCanvas.querySelector("[data-3d-viewport]");
      if (viewport) {
        this.design3DEngine = new Interior3DEngine(viewport);
        this.toolExecutor.register("Interior3DEngine", this.design3DEngine);
      }
    }
    this.logFlowEvent("workbench:task-rendered", {
      taskType: this.currentWorkbenchTaskType
    });
    this.startAgentTaskRuntime(task, this.currentWorkbenchTaskType).catch((error) => console.warn("[NOVA Agent Runtime] Planning failed.", error));
    requestAnimationFrame(() => this.runWorkbenchTaskAnimation(this.currentWorkbenchTaskType));
  }

  clearWorkbenchTaskAnimation() {
    if (this.workbenchTaskTimeline) {
      this.workbenchTaskTimeline.kill();
      this.workbenchTaskTimeline = null;
    }
    this.workbenchTaskTimers.forEach((timer) => clearTimeout(timer));
    this.workbenchTaskTimers = [];
  }

  destroyCapabilityEngines() {
    this.design3DEngine?.destroy();
    this.design3DEngine = null;
    this.toolExecutor.unregister("Interior3DEngine");
  }

  applyWorkflowStage(root, index, message) {
    const bubble = root.querySelector(".ai-action-bubble");
    const steps = Array.from(root.querySelectorAll(".ai-step"));
    const progressive = Array.from(root.querySelectorAll(".ai-progressive"));
    if (bubble) bubble.textContent = message;
    steps.forEach((step, stepIndex) => {
      step.classList.toggle("is-complete", stepIndex < index);
      step.classList.toggle("is-active", stepIndex === index);
    });
    progressive.forEach((item) => {
      if (Number(item.dataset.stage || 0) <= index + 1) item.classList.add("is-visible");
    });
    this.agentOrchestrator.advance(index, message, { x: root.querySelector(".ai-cursor")?.style.left, y: root.querySelector(".ai-cursor")?.style.top });
    this.design3DEngine?.setStage(index);
    if (this.currentWorkbenchTaskType === "booking") {
      this.browserAutomationEngine.previewAutomation(index);
      if (index >= 5) {
        const confirmation = this.browserAutomationEngine.requestUserConfirmation();
        this.agentOrchestrator.state.status = confirmation.status;
        this.setAgentStatus(confirmation.status, "Review before payment · confirmation required");
      }
    }
    if (this.currentWorkbenchTaskType === "demoToCode") {
      if (index === 0) this.websiteBuildEngine.start(this.currentWorkbenchRequest);
      if (index >= 5) this.websiteBuildEngine.markPreviewReady();
    }
    if (index >= steps.length - 1) root.classList.add("is-ready");
  }

  runSimulatedWorkflow(root, sequence) {
    const cursor = root.querySelector(".ai-cursor");
    if (!cursor) return;
    if (window.gsap) {
      const timeline = window.gsap.timeline();
      sequence.forEach((stage, index) => {
        timeline.to(cursor, {
          left: `${stage.x}%`,
          top: `${stage.y}%`,
          duration: 0.34,
          ease: "power3.inOut",
          onStart: () => { this.runAgentCursorStep(stage); this.applyWorkflowStage(root, index, stage.message); }
        });
        timeline.to(cursor, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1 }, `>-0.04`);
      });
      timeline.call(() => root.classList.add("is-ready"));
      this.workbenchTaskTimeline = timeline;
      return;
    }

    sequence.forEach((stage, index) => {
      const timer = window.setTimeout(() => {
        cursor.style.left = `${stage.x}%`;
        cursor.style.top = `${stage.y}%`;
        this.runAgentCursorStep(stage);
        this.applyWorkflowStage(root, index, stage.message);
      }, index * 380);
      this.workbenchTaskTimers.push(timer);
    });
  }

  run3DDesignWorkflowAnimation(root) {
    this.runSimulatedWorkflow(root, [
      { x: 14, y: 20, message: "Reading your request" },
      { x: 22, y: 52, message: "Opening design canvas" },
      { x: 78, y: 24, message: "Selecting futuristic glass style" },
      { x: 48, y: 46, message: "Building wireframe geometry" },
      { x: 56, y: 58, message: "Applying material and lighting" },
      { x: 68, y: 44, message: "3D concept preview ready" }
    ]);
  }

  runBookingWorkflowAnimation(root) {
    this.runSimulatedWorkflow(root, [
      { x: 26, y: 28, message: "Opening booking website" },
      { x: 28, y: 42, message: "Entering departure and destination" },
      { x: 68, y: 42, message: "Selecting date and searching tickets" },
      { x: 70, y: 61, message: "Comparing ticket options" },
      { x: 55, y: 73, message: "Choosing seat and traveler details" },
      { x: 64, y: 84, message: "Reviewing safely before payment" }
    ]);
  }

  runWebsiteDesignWorkflowAnimation(root) {
    this.runSimulatedWorkflow(root, [
      { x: 18, y: 18, message: "Reading your style request" },
      { x: 72, y: 25, message: "Building glass navigation" },
      { x: 42, y: 46, message: "Composing hero hierarchy" },
      { x: 30, y: 72, message: "Adding feature components" },
      { x: 75, y: 72, message: "Applying responsive layout" },
      { x: 63, y: 52, message: "Website design preview ready" }
    ]);
  }

  runDefaultWorkflowAnimation(root) {
    const steps = Array.from(root.querySelectorAll(".workbench-task-reveal"));
    if (window.gsap) {
      this.workbenchTaskTimeline = window.gsap.fromTo(steps, { autoAlpha: 0.45 }, { autoAlpha: 1, duration: 0.3, stagger: 0.08, ease: "power2.out" });
    }
  }

  runWorkbenchTaskAnimation(taskType) {
    const root = this.workbenchTaskCanvas.querySelector(".task-workflow");
    if (!root) return;
    if (taskType === "design3d") return this.run3DDesignWorkflowAnimation(root);
    if (taskType === "booking") return this.runBookingWorkflowAnimation(root);
    if (taskType === "demoToCode") return this.runWebsiteDesignWorkflowAnimation(root);
    return this.runDefaultWorkflowAnimation(root);
  }

  animateWorkbenchOpen() {
    if (!window.gsap) return;
    const panel = this.agentOverlay.querySelector(".agent-overlay-card");
    const taskItems = this.agentOverlay.querySelectorAll(".workbench-task-reveal");
    const navItems = this.agentOverlay.querySelectorAll(".workbench-nav-button");
    window.gsap.killTweensOf([panel, ...taskItems, ...navItems]);
    window.gsap.fromTo(panel,
      { autoAlpha: 0, y: 24, scale: 0.972, filter: "blur(6px)" },
      { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.46, ease: "power3.out", clearProps: "transform,filter,opacity,visibility" }
    );
    window.gsap.fromTo(taskItems,
      { autoAlpha: 0, y: 12, scale: 0.99 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, stagger: 0.028, ease: "power3.out", clearProps: "transform,opacity,visibility", delay: 0.08 }
    );
    window.gsap.fromTo(navItems,
      { autoAlpha: 0, x: -8 },
      { autoAlpha: 1, x: 0, duration: 0.26, stagger: 0.028, ease: "power3.out", clearProps: "transform,opacity,visibility", delay: 0.08 }
    );
  }

  async handleSendMessageFlow() {
    const message = this.chatInput.value.trim();
    if (!message || isAgentRunning || this.isBusy || !this.videoAvailable) return;

    this.isBusy = true;
    this.setInputsDisabled(true);
    this.chatInput.value = "";
    this.currentTaskName = message;
    this.currentRequestId += 1;
    const requestId = this.currentRequestId;
    this.appendMessage("user", message);
    this.logFlowEvent("task:submitted", { requestId });

    try {
      if (!hasCompletedFirstTask) {
        const ackVideo = await this.playState(AVATAR_STATES.FIRST_ACK_041, { loop: true });
        this.logFlowEvent("first-ack:started", { requestId, video: ackVideo.currentSrc });
        const cueReached = await this.waitFor041WorkbenchCue(ackVideo, requestId);
        if (!cueReached || !this.isCurrentRequest(requestId)) return;
        this.logFlowEvent("first-ack:workbench-cue", {
          requestId,
          currentTime: Number(ackVideo.currentTime.toFixed(2))
        });
      }

      await this.startAgentWorkbench(message, requestId);
    } catch (error) {
      console.error("[NOVA Phase A3] Agent integration failed.", error);
      this.showAgentError("Agent mock integration failed.\nPlease return to NOVA and try again.");
    }
  }

  async startAgentWorkbench(task, requestId) {
    if (!this.isCurrentRequest(requestId) || isAgentRunning) return;
    isAgentRunning = true;
    this.showAgentOverlay(task);
    this.updateStatus(AVATAR_STATES.AGENT_WORKBENCH);

    try {
      const response = await fetch(`${AGENT_API_BASE}/api/agent/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task })
      });
      if (!response.ok) {
        throw new Error(`FastAPI start returned HTTP ${response.status}`);
      }
      const result = await response.json();
      if (!this.isCurrentRequest(requestId)) return;

      this.setServiceStatus(this.fastApiWorkbenchStatus, "Online", "online");
      this.agentStatusBadge.classList.remove("is-error");
      this.agentStatusLabel.innerText = result.status === "completed" ? "MOCK COMPLETE" : "MOCK WORKING";
      this.logFlowEvent("agent:start", {
        requestId,
        sessionId: result.session_id,
        alreadyRunning: Boolean(result.already_running)
      });

      if (result.status === "completed") {
        await this.handleAgentCompleted(requestId);
      } else {
        this.startAgentStatusPolling(requestId);
      }
    } catch (error) {
      console.warn("[NOVA Agent] FastAPI mock server is unavailable.", error);
      this.setServiceStatus(this.fastApiWorkbenchStatus, "Offline", "offline");
      isAgentRunning = false;
      this.showAgentError(
        "FastAPI mock server is not running.\nPlease start localhost:8787 first."
      );
    }
  }

  /* ================================
  UI ANIMATION LAYER
  Handles workbench overlay, GSAP animation, parallax, and glass UI.
  ================================ */

  showAgentOverlay(task) {
    this.agentCompletionInProgress = false;
    this.agentTaskDesc.innerText = `Task: ${task} · LOCAL MOCK`;
    this.agentStatusLabel.innerText = "INITIALIZING";
    this.agentStatusBadge.classList.remove("is-error");
    this.renderCurrentWorkbenchTask(task);
    this.setServiceStatus(this.fastApiWorkbenchStatus, "Checking", "checking");
    this.setServiceStatus(this.streamlitWorkbenchStatus, "Checking", "checking");
    this.agentCompletionText.hidden = true;
    this.agentErrorText.hidden = true;
    this.agentStreamlitNotice.hidden = true;
    this.agentCloseButton.hidden = true;
    this.agentIframe.src = "about:blank";
    document.body.classList.remove("agent-overlay-closing");
    document.body.classList.add("agent-overlay-preparing", "agent-overlay-open");

    this.workbenchCards.forEach((card, index) => {
      card.style.setProperty("--workbench-reveal-index", String(index));
    });
    this.agentOverlay.classList.remove("preparing", "ready", "is-completing", "is-closing");
    this.agentOverlay.classList.add("is-active", "opening");
    this.animateWorkbenchOpen();
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!this.agentOverlay.classList.contains("is-active")) return;
        this.agentOverlay.classList.add("ready");
        window.setTimeout(
          () => this.agentOverlay.classList.remove("opening"),
          480 + this.workbenchCards.length * 28
        );
      }, 80);
    });
  }

  setServiceStatus(element, label, state) {
    if (!element) return;
    element.classList.remove("is-online", "is-offline");
    if (state === "online") element.classList.add("is-online");
    if (state === "offline") element.classList.add("is-offline");
    element.innerHTML = `<i></i> ${label}`;
  }

  async checkStreamlitAvailability() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(`${STREAMLIT_WORKBENCH_URL}/_stcore/health`, {
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });
      this.setServiceStatus(this.streamlitWorkbenchStatus, "Online", "online");
      this.agentStreamlitNotice.hidden = true;
    } catch (error) {
      console.warn("[NOVA Agent] Streamlit workbench may be unavailable.", error);
      this.setServiceStatus(this.streamlitWorkbenchStatus, "Offline", "offline");
      this.agentStreamlitNotice.hidden = true;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  startAgentStatusPolling(requestId) {
    this.clearAgentStatusPolling();
    this.pollAgentStatus(requestId);
    agentStatusPollTimer = window.setInterval(() => this.pollAgentStatus(requestId), 1000);
  }

  async pollAgentStatus(requestId) {
    if (this.agentPollInFlight || !isAgentRunning || !this.isCurrentRequest(requestId)) return;
    this.agentPollInFlight = true;
    try {
      const response = await fetch(`${AGENT_API_BASE}/api/agent/status`, { cache: "no-store" });
      if (!response.ok) throw new Error(`FastAPI status returned HTTP ${response.status}`);
      const result = await response.json();
      if (!this.isCurrentRequest(requestId)) return;

      if (result.status === "running") {
        this.agentStatusLabel.innerText = "MOCK WORKING";
        return;
      }
      if (result.status === "completed") {
        this.clearAgentStatusPolling();
        await this.handleAgentCompleted(requestId);
        return;
      }
      if (["error", "missing_api_key", "stopped"].includes(result.status)) {
        this.clearAgentStatusPolling();
        isAgentRunning = false;
        this.showAgentError(`Agent mock status: ${result.status}.\nNo completion transition was played.`);
      }
    } catch (error) {
      this.clearAgentStatusPolling();
      isAgentRunning = false;
      console.warn("[NOVA Agent] Status polling failed.", error);
      this.showAgentError(
        "FastAPI mock server connection was lost.\nNo completion transition was played."
      );
    } finally {
      this.agentPollInFlight = false;
    }
  }

  clearAgentStatusPolling() {
    if (agentStatusPollTimer !== null) {
      clearInterval(agentStatusPollTimer);
      agentStatusPollTimer = null;
    }
  }

  async handleAgentCompleted(requestId) {
    if (this.agentCompletionInProgress || !this.isCurrentRequest(requestId)) return;
    this.agentCompletionInProgress = true;
    this.clearAgentStatusPolling();
    this.updateStatus(AVATAR_STATES.AGENT_COMPLETED_TTS);
    this.agentStatusLabel.innerText = "MOCK COMPLETE";
    this.agentStatusBadge.classList.remove("is-error");

    let ttsResult = null;
    try {
      const response = await fetch(`${AGENT_API_BASE}/api/agent/tts/completion`, { method: "POST" });
      if (response.ok) ttsResult = await response.json();
    } catch (error) {
      console.warn("[NOVA TTS] Mock completion endpoint was unavailable.", error);
    }
    console.info("[NOVA TTS] Completion response is mock-only; no audio playback occurred.", ttsResult);

    this.showCompletionFallback();
    await this.wait(MOCK_COMPLETION_HOLD_MS);
    if (!this.isCurrentRequest(requestId)) return;

    await this.hideAgentOverlay();
    const transitionVideo = await this.playState(AVATAR_STATES.COMPLETE_TRANSITION_042, { loop: false });
    await this.crossfade.waitForEnded(transitionVideo);
    if (!this.isCurrentRequest(requestId)) return;

    await this.playState(AVATAR_STATES.FINAL_LOOP_043, { loop: true });
    hasCompletedFirstTask = true;
    this.hasCompletedFirstTask = true;
    isAgentRunning = false;
    this.agentCompletionInProgress = false;
    this.logFlowEvent("task:complete", { requestId, hasCompletedFirstTask: true });
    this.isBusy = false;
    this.setInputsDisabled(false);
    this.chatInput.focus();
  }

  showCompletionFallback() {
    this.agentErrorText.hidden = true;
    this.agentCloseButton.hidden = true;
    this.agentCompletionText.innerText = COMPLETION_TEXT;
    this.agentCompletionText.hidden = false;
    this.agentOverlay.classList.add("is-completing");
    this.appendMessage("assistant", COMPLETION_TEXT);
    this.showSubtitle(COMPLETION_TEXT);
  }

  showAgentError(message) {
    isAgentRunning = false;
    if (!this.agentOverlay.classList.contains("is-active")) {
      this.showAgentOverlay(this.currentTaskName);
    }
    this.agentTaskDesc.innerText = `Task: ${this.currentTaskName} · LOCAL MOCK`;
    this.agentStatusLabel.innerText = "MOCK ERROR";
    this.agentStatusBadge.classList.add("is-error");
    this.setServiceStatus(this.fastApiWorkbenchStatus, "Offline", "offline");
    this.agentCompletionText.hidden = true;
    this.agentErrorText.innerText = message;
    this.agentErrorText.hidden = true;
    this.agentCloseButton.hidden = false;
    this.clearAgentStatusPolling();
  }

  async hideAgentOverlay() {
    this.clearWorkbenchTaskAnimation();
    this.destroyCapabilityEngines();
    this.agentOverlay.classList.add("is-closing");
    document.body.classList.add("agent-overlay-closing");
    document.body.classList.remove("agent-overlay-open");
    await this.wait(340);
    this.agentOverlay.classList.remove("is-active", "ready", "opening", "is-completing");
    await this.wait(340);
    this.agentOverlay.classList.remove("preparing", "is-closing");
    this.agentStatusBadge.classList.remove("is-error");
    document.body.classList.remove("agent-overlay-preparing", "agent-overlay-open", "agent-overlay-closing");
    this.agentIframe.src = "about:blank";
  }

  async closeAgentOverlayAfterError() {
    this.clear041WorkbenchCue();
    this.clearAgentStatusPolling();
    isAgentRunning = false;
    await this.hideAgentOverlay();
    const recoveryState = hasCompletedFirstTask
      ? AVATAR_STATES.FINAL_LOOP_043
      : AVATAR_STATES.INITIAL_LOOP_040;
    if (this.videoAvailable) {
      await this.playState(recoveryState, { loop: true });
    }
    this.agentErrorText.hidden = true;
    this.agentCloseButton.hidden = true;
    this.isBusy = false;
    this.setInputsDisabled(false);
    this.chatInput.focus();
  }

  async playState(state, options = {}) {
    if (state !== AVATAR_STATES.FIRST_ACK_041) {
      this.clear041WorkbenchCue();
    }
    const src = this.config.video_paths[state];
    if (!src) throw new Error(`No video configured for state ${state}`);

    const previousState = this.currentState;
    const loop = Boolean(options.loop);
    const video = options.initial
      ? await this.crossfade.showInitial(src, { loop })
      : await this.crossfade.crossfadeTo(src, { loop, duration: this.config.crossfade_ms });

    this.updateStatus(state);
    this.logFlowEvent("video:ready", {
      fromState: previousState,
      toState: state,
      video: src,
      loop
    });
    return video;
  }

  updateStatus(state) {
    this.currentState = state;
    const styles = {
      [AVATAR_STATES.INITIAL_LOOP_040]: ["Initial Standby", "#7dd3fc"],
      [AVATAR_STATES.FIRST_ACK_041]: ["Acknowledging", "#34d399"],
      [AVATAR_STATES.AGENT_WORKBENCH]: ["Mock Working", "#38bdf8"],
      [AVATAR_STATES.AGENT_COMPLETED_TTS]: ["Mock Complete", "#34d399"],
      [AVATAR_STATES.COMPLETE_TRANSITION_042]: ["Completing", "#a78bfa"],
      [AVATAR_STATES.FINAL_LOOP_043]: ["Ready", "#7dd3fc"]
    };
    const [label, color] = styles[state] || [state, "#7dd3fc"];
    this.statusText.innerText = label;
    this.statusBadge.style.color = color;
    this.statusBadge.style.background = `${color}18`;
    this.statusBadge.style.boxShadow = `0 0 12px ${color}33`;
  }

  logFlowEvent(type, details = {}) {
    const event = {
      type,
      at: Number(performance.now().toFixed(1)),
      state: this.currentState,
      requestId: this.currentRequestId,
      ...details
    };
    this.flowEvents.push(event);
    if (this.flowEvents.length > 100) this.flowEvents.shift();
    console.debug("[NOVA Flow]", event);
  }

  showSubtitle(text) {
    this.subtitleText.innerText = text;
    this.subtitlesOverlay.style.display = "block";
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = window.setTimeout(() => {
      this.subtitlesOverlay.style.display = "none";
    }, 3200);
  }

  appendMessage(sender, text) {
    const message = document.createElement("div");
    message.className = `message ${sender}-message`;

    const senderLabel = document.createElement("div");
    senderLabel.className = "message-sender";
    senderLabel.innerText = sender === "user" ? "You" : this.config.avatar_name;

    const body = document.createElement("div");
    body.className = "message-text";
    body.innerText = text;

    message.append(senderLabel, body);
    this.chatHistory.appendChild(message);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  clearChat() {
    this.chatHistory.innerHTML = "";
    this.appendMessage("assistant", "Cleared. NOVA is ready for a new mock task.");
    this.subtitlesOverlay.style.display = "none";
  }

  showFallbackAvatar() {
    this.videoWrapper.style.display = "none";
    this.imageFallbackContainer.style.display = this.imageFallbackExists ? "flex" : "none";
    this.cssFallbackContainer.style.display = this.imageFallbackExists ? "none" : "flex";
  }

  setInputsDisabled(disabled) {
    this.chatInput.disabled = disabled;
    this.btnSend.disabled = disabled;
  }

  isCurrentRequest(requestId) {
    return requestId === this.currentRequestId;
  }

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.avatarController = new AvatarController();
  window.avatarController.init();
});
