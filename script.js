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
const BACKEND_AGENT_API_BASE = window.location.origin;
const STREAMLIT_WORKBENCH_URL = "http://127.0.0.1:8501";
const VIESHOW_OFFICIAL_URL = "https://www.vscinemas.com.tw/";
const WORKBENCH_PROJECTS_STORAGE_KEY = "nova.workbench.projects.v1";
window.NOVA_WORKBENCH_DISPLAY_STATE = {
  taskType: "interior_design", phase: "idle", taskId: null, provider: null, progress: 0,
  imageUrl: null, imageLoadStatus: "idle", previewDomStatus: "idle", badge: "IDLE",
  lastEvent: null, updatedAt: null
};
const AGENT_BRAIN_MODE = "localMock";
const AGENT_PLAYBACK_SPEED = "normal";
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

function renderOperationTimeline() {
  return `<section class="operation-console workbench-task-reveal"><div class="current-operation-card"><small>CURRENT STEP</small><strong data-operation-current>Understanding request</strong><span data-operation-wait>Preparing agent brain</span><progress data-operation-progress max="100" value="0"></progress></div><div class="tool-activity-panel"><small>TOOL ACTIVITY</small><strong data-operation-tool>Selecting tools</strong><span data-operation-status>pending</span></div><div class="artifact-preview"><small>ARTIFACT</small><strong data-operation-artifact>No artifact yet</strong></div><ol class="live-operation-timeline" data-operation-timeline></ol><details class="operation-debug"><summary>Debug</summary><pre data-operation-debug>lastEvent: —</pre></details></section>`;
}

function renderRealRenderPanel() {
  return `<section class="interior-agent-process workbench-task-reveal"><strong>Agent Process</strong><span>Universal Agent Core</span><span>Tool selected</span><span>Draft generated</span><span>Render provider check</span></section>
    <section class="nova-main-result-viewer final-render-preview workbench-task-reveal" data-result-viewer="main" data-result-phase="idle" data-image-load-status="idle" aria-label="Interior main result"><div class="result-state"><strong>Understanding request</strong><span>Preparing the interior design task.</span></div></section>`;
}

function render3DDesignTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--design3d">
    ${renderWorkflowHeading("Interior Design Studio", "NOVA is creating a final proposal render while preserving the interactive construction draft.", "fa-cube")}
    ${renderOperationTimeline()}
    ${renderRealRenderPanel()}
    <details class="interior-draft-reference workbench-task-reveal"><summary>Draft reference</summary><div class="task-workflow-grid task-workflow-grid--live">
      <section class="ai-live-canvas ai-live-window design-live-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><strong>Modern Cafe · 3D Interior Viewport</strong><span>Building scene</span></div><div class="viewport-floating-hud playback-layer cafe-layer-material is-pending"><small>REQUEST</small><strong>${request}</strong><div><span>Modern cafe</span><span>Wood + metal</span><span>Warm lighting</span><span>Orbit enabled</span></div></div><div class="cafe-3d-viewport is-playback-locked" data-3d-viewport aria-label="Draggable modern cafe 3D viewport"><div class="cafe-css-fallback"><div class="cafe-room"><i class="cafe-floor playback-layer cafe-layer-shell is-pending"></i><i class="cafe-wall cafe-wall--back playback-layer cafe-layer-shell is-pending"></i><i class="cafe-wall cafe-wall--side playback-layer cafe-layer-shell is-pending"></i><div class="cafe-counter playback-layer cafe-layer-counter is-pending"></div><div class="cafe-bench playback-layer cafe-layer-seating is-pending"></div><div class="cafe-table cafe-table--one playback-layer cafe-layer-seating is-pending"></div><div class="cafe-table cafe-table--two playback-layer cafe-layer-seating is-pending"></div><div class="cafe-table cafe-table--three playback-layer cafe-layer-seating is-pending"></div><div class="cafe-pendants playback-layer cafe-layer-lighting is-pending"><i></i><i></i><i></i></div><div class="cafe-fallback-decor playback-layer cafe-layer-decor is-pending"><i></i><i></i><i></i></div></div></div><span class="viewport-drag-hint playback-layer cafe-layer-ready is-pending"><i class="fa-solid fa-arrows-rotate"></i> Drag to explore</span></div><div class="design-tool-rail playback-layer cafe-layer-shell is-pending"><b>↖</b><b>◇</b><b>◫</b><b>☼</b></div><div class="preview-ready playback-layer cafe-layer-ready is-pending"><i class="fa-solid fa-check"></i> Preview ready</div><div class="viewport-mode-bar playback-layer cafe-layer-material is-pending"><span>Perspective</span><span>Material · Modern</span><span>Lighting · Warm</span><span>Quality · High</span></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Reading interior design request</div></section>
    </div></details>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Planning", "Space shell", "Counter", "Seating", "Lighting", "Materials", "Details", "Preview ready"].map((step, index) => `<span class="ai-step" data-step-id="design3d-${index}"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderBookingTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--booking">
    ${renderWorkflowHeading("Booking Flow Agent", "NOVA is operating a booking flow and will stop safely before payment.", "fa-ticket")}
    ${renderOperationTimeline()}
    <div class="task-workflow-grid task-workflow-grid--live">
      <section class="ai-live-canvas ai-live-window booking-live-window workbench-task-reveal"><div class="ai-window-toolbar booking-layer-browser"><i></i><i></i><i></i><div class="ai-address-bar"><i class="fa-solid fa-spinner"></i><span>loading browser workspace…</span></div><span class="browser-safe-badge playback-layer booking-layer-review is-pending"><i class="fa-solid fa-shield-halved"></i> stop_before_payment</span><a class="official-site-link playback-layer booking-layer-site is-pending" href="${VIESHOW_OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">Open official site <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div><div class="booking-page"><div class="booking-site-nav playback-layer booking-layer-site is-pending"><strong>VIESHOW CINEMAS</strong><span>Movies</span><span>Cinemas</span><span>Events</span><b>Safe preview</b></div><div class="booking-brand playback-layer booking-layer-site is-pending"><i class="fa-solid fa-film"></i><strong>VIESHOW Booking Assistant</strong><span>frontend_preview · playwright_ready</span></div><div class="booking-task-chip playback-layer booking-layer-site is-pending"><i class="fa-solid fa-wand-magic-sparkles"></i>${request}</div><div class="booking-browser-grid"><div class="booking-browser-main"><div class="booking-cinema-hero playback-layer booking-layer-site is-pending"><small>TAIPEI XINYI</small><strong>Choose your next cinema experience.</strong><span>Official availability is confirmed only after opening VIESHOW.</span></div><div class="booking-form playback-layer booking-layer-search is-pending"><label data-control="theater"><span>Theater</span><b class="typed-value">台北信義威秀影城</b></label><label data-control="movie"><span>Movie</span><b class="typed-value">Movie preview</b></label><label data-control="date"><span>Date</span><b class="typed-value">Selected date</b></label><button type="button">Search sessions</button></div><div class="booking-showtimes playback-layer booking-layer-results is-pending"><button>17:10 <small>Digital</small></button><button class="is-selected">19:30 <small>Digital</small></button><button>21:50 <small>IMAX</small></button></div><div class="booking-ticket-control playback-layer booking-layer-ticket is-pending"><span>Adult ticket</span><button type="button">−</button><strong>2</strong><button type="button">＋</button><small>Preview only</small></div></div><aside class="booking-seat-preview playback-layer booking-layer-seat is-pending"><small>SCREEN</small><div>${Array.from({ length: 24 }, (_, index) => `<i class="${index === 15 || index === 16 ? "is-selected" : ""}"></i>`).join("")}</div><strong>F11 · F12 selected</strong></aside></div><div class="review-lock playback-layer booking-layer-review is-pending"><i class="fa-solid fa-shield-halved"></i><div><strong>Review before payment · User confirmation required</strong><small>No transaction executed. Continue only on the official website.</small></div></div></div><div class="booking-mode-toggle booking-mode-floating playback-layer booking-layer-review is-pending"><button type="button" class="is-active" data-workbench-action="booking-mode" data-booking-mode="safe">Safe mode</button><button type="button" data-workbench-action="booking-mode" data-booking-mode="authorized">Authorized handoff</button></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Identifying target site</div></section>
    </div>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Planning", "Browser", "Vieshow", "Search", "Sessions", "Tickets", "Seats", "Review"].map((step, index) => `<span class="ai-step" data-step-id="booking-${index}"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderDemoToCodeTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--website">
    ${renderWorkflowHeading("Website Design Studio", "NOVA is designing a live website concept from your style request.", "fa-pen-ruler")}
    ${renderOperationTimeline()}
    <div class="task-workflow-grid task-workflow-grid--live">
      <section class="ai-live-canvas ai-live-window website-live-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><strong>Website Design Canvas</strong><span>Desktop · 1440</span><button type="button" class="toolbar-action playback-layer site-layer-save is-pending" data-workbench-action="refine-design" disabled>Refine</button><button type="button" class="toolbar-action is-primary playback-layer site-layer-save is-pending" data-workbench-action="save-website-code" disabled>Save as Code</button></div><div class="website-style-toolbar playback-layer site-layer-brand is-pending"><span><i class="fa-solid fa-wand-magic-sparkles"></i>${request}</span><b>Premium glass</b><b>Ice blue</b><b>Editorial</b><b>Responsive</b></div><div class="website-builder fashion-builder"><div class="builder-nav playback-layer site-layer-header is-pending"><b>ATELIER / 01</b><span>New Arrival</span><span>Lookbook</span><span>Best Seller</span><button>Shop now</button></div><div class="builder-hero playback-layer site-layer-hero is-pending"><small>FUTURE ESSENTIALS · 2026</small><strong>Wear what comes next.</strong><p>Precision silhouettes for a new generation.</p><button>Explore collection</button></div><div class="fashion-categories playback-layer site-layer-categories is-pending"><span>Outerwear</span><span>Knitwear</span><span>Essentials</span><span>Accessories</span></div><div class="builder-products">${[["Form Jacket","NT$ 6,980"],["Glass Knit","NT$ 3,280"],["Motion Trouser","NT$ 4,680"],["Vector Coat","NT$ 8,800"],["Core Tee","NT$ 1,980"],["Orbit Bag","NT$ 3,980"]].map(([name,price],index) => `<article class="playback-layer site-layer-products is-pending" style="--product-order:${index}"><i style="--product-tone:${index}"></i><b>${name}</b><span>${price}</span></article>`).join("")}</div><div class="fashion-lookbook playback-layer site-layer-footer is-pending"><article><small>LOOKBOOK / 01</small><strong>Engineered layers</strong></article><article><small>NEW ARRIVAL</small><strong>Quiet utility</strong></article></div><footer class="fashion-footer playback-layer site-layer-footer is-pending"><strong>ATELIER / 01</strong><span>New Arrival</span><span>Lookbook</span><span>Best Seller</span><small>© 2026</small></footer><div class="responsive-blocks playback-layer site-layer-footer is-pending"><i></i><i></i><i></i></div></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Parsing fashion store request</div></section>
    </div>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Planning", "Brand", "Header", "Hero", "Categories", "Products", "Lookbook", "Preview ready"].map((step, index) => `<span class="ai-step" data-step-id="demoToCode-${index}"><i></i>${step}</span>`).join("")}</div>
  </div>`;
}

function renderDefaultWorkbenchTask(userMessage) {
  const request = escapeWorkbenchText(userMessage);
  return `<div class="task-workflow task-workflow--default">
    ${renderWorkflowHeading("NOVA Workspace", "NOVA is preparing your workspace and organizing the current request.", "fa-wand-magic-sparkles")}
    ${renderOperationTimeline()}
    <section class="ai-live-canvas ai-live-window default-agent-window workbench-task-reveal"><div class="ai-window-toolbar"><i></i><i></i><i></i><strong>Agent Execution Workspace</strong><span>localMock · backend_proxy_required</span></div><div class="default-agent-request"><small>CURRENT REQUEST</small><h4 id="workbench-current-task">${request}</h4></div><div class="default-agent-plan"><span class="playback-layer default-layer-plan is-pending"><i>01</i>Understand request</span><span class="playback-layer default-layer-plan is-pending"><i>02</i>Create execution plan</span><span class="playback-layer default-layer-tools is-pending"><i>03</i>Select tools</span><span class="playback-layer default-layer-output is-pending"><i>04</i>Prepare output</span></div><span class="ai-cursor" aria-hidden="true"></span><div class="ai-action-bubble">Understanding your request</div></section>
    <div class="ai-step-timeline workflow-progress workbench-task-reveal">${["Received", "Planning", "Selecting tools", "Preparing output"].map((step, index) => `<span class="ai-step" data-step-id="default-${index}"><i></i>${step}</span>`).join("")}</div>
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
    this.revealedLayers = new Set();
    this.layers = {};
    this.materials = {};
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

    ["shell", "counter", "seating", "lighting", "material", "decor"].forEach((name) => {
      const group = new THREE.Group();
      group.name = `cafe-layer-${name}`;
      group.visible = false;
      group.scale.setScalar(0.001);
      this.layers[name] = group;
      this.cafeRoot.add(group);
    });

    const materials = {
      floor: new THREE.MeshStandardMaterial({ color: 0x6f5540, roughness: 0.72 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xd8c9b7, roughness: 0.88 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x563929, roughness: 0.62 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xaca79d, roughness: 0.38 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x20262a, metalness: 0.72, roughness: 0.3 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x9d7457, roughness: 0.82 }),
      green: new THREE.MeshStandardMaterial({ color: 0x496b50, roughness: 0.78 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xa9d6e8, transparent: true, opacity: 0.32, roughness: 0.12, metalness: 0.08 })
    };
    this.materials = materials;
    [materials.wood, materials.stone, materials.metal, materials.fabric, materials.glass].forEach((material) => { material.wireframe = true; });
    const addToLayer = (object, layerName) => { this.layers[layerName]?.add(object); return object; };
    const box = (size, position, material, layerName = "decor") => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; return addToLayer(mesh, layerName);
    };
    box([10, 0.18, 7], [0, -0.1, 0], materials.floor, "shell");
    box([10, 5.2, 0.16], [0, 2.5, -3.45], materials.wall, "shell");
    box([0.16, 5.2, 7], [-4.95, 2.5, 0], materials.wall, "shell");
    box([5.7, 1.05, 1.15], [1.5, 0.55, -2.35], materials.wood, "counter");
    box([5.9, 0.18, 1.35], [1.5, 1.15, -2.35], materials.stone, "counter");
    box([4.8, 0.12, 0.55], [1.3, 2.35, -3.25], materials.wood, "counter");
    box([4.8, 0.12, 0.55], [1.3, 3.15, -3.25], materials.wood, "counter");
    box([1.1, 0.72, 0.62], [1.4, 1.62, -2.85], materials.metal, "counter");
    box([0.7, 0.22, 0.7], [1.4, 2.08, -2.82], materials.stone, "counter");
    box([0.12, 0.65, 0.12], [1.05, 1.62, -2.42], materials.metal, "counter");
    box([0.12, 0.65, 0.12], [1.75, 1.62, -2.42], materials.metal, "counter");
    box([0.18, 0.35, 0.18], [2.45, 1.43, -2.55], materials.glass, "material");
    box([3.5, 0.62, 0.75], [-3.65, 0.55, -1.1], materials.fabric, "seating");
    box([3.5, 1.05, 0.18], [-4.42, 1.05, -1.1], materials.fabric, "seating");
    [[-2.8,2.3],[-1.5,2.3]].forEach(([x,y]) => box([0.82,1.05,0.08],[x,y,-3.32],materials.metal,"decor"));
    box([6.5,0.08,0.08],[0,4.75,.4],materials.metal,"lighting");
    box([2.8,2.3,0.08],[3.45,2.2,-3.3],materials.glass,"material");

    const addTable = (x, z) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 32), materials.wood);
      top.position.set(x, 0.82, z); top.castShadow = true; addToLayer(top, "seating");
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.78, 16), materials.metal);
      leg.position.set(x, 0.4, z); addToLayer(leg, "seating");
      [[-.9,0],[.9,0],[0,-.9]].forEach(([dx,dz]) => {
        box([0.52,0.12,0.52],[x+dx,0.48,z+dz],materials.fabric,"seating");
        box([0.08,0.46,0.08],[x+dx,0.23,z+dz],materials.metal,"seating");
        box([0.52,0.62,0.1],[x+dx,0.78,z+dz-.2],materials.fabric,"seating");
      });
    };
    addTable(-2.5, 1.5); addTable(0, 1.35); addTable(2.55, 1.45);
    [[-4.1,-2.6],[4.2,-2.7]].forEach(([x,z]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,.55,18), materials.stone); pot.position.set(x,.28,z); addToLayer(pot,"decor");
      for (let index=0; index<5; index+=1) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(.24,14,10),materials.green); leaf.scale.set(.55,1.7,.38); leaf.position.set(x+(index-2)*.1,.8+Math.abs(index-2)*.12,z); leaf.rotation.z=(index-2)*.35; addToLayer(leaf,"decor"); }
    });
    [-2.3, 0, 2.3].forEach((x) => {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.25,8), materials.metal);
      cable.position.set(x,4.35,-.4); addToLayer(cable,"lighting");
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.38,0.42,24,1,true), materials.metal);
      shade.position.set(x,3.7,-.4); shade.rotation.x = Math.PI; addToLayer(shade,"lighting");
      const light = new THREE.PointLight(0xffc784,1.8,5); light.position.set(x,3.5,-.4); light.castShadow = true; addToLayer(light,"lighting");
    });
    [-2.4,-.8,.8,2.4].forEach((x) => {
      const fixture = box([0.22,0.16,0.28],[x,4.62,.4],materials.metal,"lighting");
      fixture.rotation.x = -.3;
      const spot = new THREE.SpotLight(0xffe2b7,1.2,7,Math.PI/7,.45,1.4); spot.position.set(x,4.5,.45); spot.target.position.set(x,0,0); addToLayer(spot,"lighting"); addToLayer(spot.target,"lighting");
    });
    this.scene.add(new THREE.HemisphereLight(0xcbe9ff, 0x38291f, 1.8));
    const key = new THREE.DirectionalLight(0xffe2be, 2.2); key.position.set(5,8,6); key.castShadow = true; this.scene.add(key);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.viewport.classList.add("has-webgl");
    this.revealedLayers.forEach((name) => this.revealLayer(name));
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

  revealLayer(name) {
    this.revealedLayers.add(name);
    if (name === "material") {
      Object.values(this.materials).forEach((material) => { material.wireframe = false; material.needsUpdate = true; });
    }
    const group = this.layers[name];
    if (!group) return;
    group.visible = true;
    if (window.gsap) window.gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.62, ease: "power3.out" });
    else group.scale.setScalar(1);
  }

  applySceneSpec(spec) {
    this.sceneSpec = spec;
    const counts = Object.fromEntries((spec?.objects || []).map((item) => [item.type, item.count]));
    const hud = this.viewport.parentElement?.querySelector(".viewport-floating-hud div");
    if (hud) hud.innerHTML = `<span>${escapeWorkbenchText(spec.style || "Interior")}</span><span>${counts.tables || 0} tables</span><span>${counts.chairs || 0} chairs</span><span>${escapeWorkbenchText(spec.lighting || "Lighting")}</span>`;
    return spec;
  }

  setStage(index) {
    this.viewport.dataset.renderStage = String(index);
    const layer = [null, "shell", "counter", "seating", "lighting", "material", "decor"][index];
    if (layer) this.revealLayer(layer);
  }

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
    this.steps = ["open_official_site", "select_theater", "select_movie", "select_session", "select_seats", "request_user_confirmation"];
  }
  openOfficialSite() { window.open(this.officialUrl, "_blank", "noopener,noreferrer"); }
  previewAutomation(step) { this.currentStep = Math.max(0, Math.min(Number(step) || 0, this.steps.length - 1)); return { step: this.steps[this.currentStep], mode: this.mode, safetyMode: this.safetyMode }; }
  requestUserConfirmation() { return { status: "waiting_for_user", reason: "Payment, login, or verification requires user confirmation." }; }
}

class WebsiteBuildEngine {
  constructor() { this.status = "idle"; this.model = null; }
  parseStylePrompt(userMessage) {
    const prompt = String(userMessage || "");
    const normalized = prompt.toLowerCase();
    return {
      prompt,
      direction: normalized.includes("潮") ? "streetwear" : normalized.includes("極簡") ? "minimal" : "premium_technology",
      glass: /玻璃|glass|apple|openai/.test(normalized),
      palette: /黑|dark|潮/.test(normalized) ? "graphite" : "ice_blue",
      density: normalized.includes("極簡") ? "airy" : "editorial"
    };
  }
  generateSiteModel(userMessage) {
    const style = this.parseStylePrompt(userMessage);
    return {
      brand: "ATELIER / 01",
      style,
      navigation: ["New Arrival", "Lookbook", "Best Seller"],
      hero: { eyebrow: "FUTURE ESSENTIALS · 2026", title: "Wear what comes next.", body: "Precision silhouettes for a new generation.", cta: "Explore collection" },
      categories: ["Outerwear", "Knitwear", "Essentials", "Accessories"],
      products: [["Form Jacket", "NT$ 6,980"], ["Glass Knit", "NT$ 3,280"], ["Motion Trouser", "NT$ 4,680"], ["Vector Coat", "NT$ 8,800"], ["Core Tee", "NT$ 1,980"], ["Orbit Bag", "NT$ 3,980"]]
    };
  }
  renderLiveWebsitePreview(userMessage) { this.model = this.generateSiteModel(userMessage); this.status = "preview_ready"; return this.model; }
  enableRefineDesign(changes = {}) { this.model = { ...(this.model || this.generateSiteModel("")), ...changes }; this.status = "refining"; return this.model; }
  saveAsCode(userMessage) {
    const model = this.model || this.generateSiteModel(userMessage);
    const products = model.products.map(([name, price], index) => `<article><div class="product-art product-art-${index + 1}"></div><h2>${name}</h2><p>${price}</p></article>`).join("");
    const navigation = model.navigation.map((item) => `<a href="#collection">${item}</a>`).join("");
    return {
      "index.html": `<!doctype html>\n<html lang="zh-Hant">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${model.brand}</title><link rel="stylesheet" href="style.css"></head>\n<body><header class="nav"><strong>${model.brand}</strong><nav>${navigation}</nav><button>Shop now</button></header><main><section class="hero"><p>${model.hero.eyebrow}</p><h1>${model.hero.title}</h1><span>${model.hero.body}</span><button>${model.hero.cta}</button></section><section id="collection" class="products">${products}</section><section class="lookbook"><p>LOOKBOOK / 01</p><h2>Engineered layers for moving cities.</h2></section></main><footer>${model.brand} · New Arrival · Best Seller · © 2026</footer><script src="script.js"><\/script></body></html>`,
      "style.css": `:root{font-family:Inter,Arial,sans-serif;color:#102030;background:#eef5f9}*{box-sizing:border-box}body{margin:0}.nav{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:28px;padding:20px 5vw;background:#ffffffb8;backdrop-filter:blur(24px)}.nav strong{margin-right:auto}.nav nav{display:flex;gap:20px}.nav a{color:inherit;text-decoration:none}.nav button,.hero button{padding:12px 20px;border:0;border-radius:999px;color:#fff;background:#167fc9}.hero{min-height:68vh;padding:14vh 8vw;background:radial-gradient(circle at 78% 24%,#a5dcf7,transparent 32%),linear-gradient(135deg,#fff,#dcebf4)}.hero p{letter-spacing:.16em}.hero h1{max-width:760px;margin:18px 0;font-size:clamp(52px,9vw,120px);line-height:.86}.hero span{display:block;max-width:480px;margin-bottom:26px}.products{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:60px 5vw}.products article{padding:16px;border:1px solid #fff;border-radius:28px;background:#ffffff8c;box-shadow:0 24px 70px #1e4a6820}.product-art{height:300px;border-radius:20px;background:linear-gradient(145deg,#c6d9e5,#637b8c);position:relative}.product-art:before{content:"";position:absolute;left:50%;top:16%;width:42%;height:64%;border-radius:38% 38% 18% 18%;background:#f2f5f7;transform:translateX(-50%);box-shadow:0 18px 34px #20384828}.product-art-2:before,.product-art-5:before{background:#304452}.product-art-4:before{height:72%;background:#a9b9c2}.lookbook{margin:20px 5vw 70px;padding:9vw;border-radius:36px;color:#fff;background:linear-gradient(135deg,#122637,#49738e)}.lookbook h2{max-width:680px;font-size:clamp(36px,6vw,78px)}footer{display:flex;justify-content:center;padding:32px;background:#102030;color:#dbeaf2}@media(max-width:760px){.nav nav{display:none}.products{grid-template-columns:1fr}.product-art{height:240px}}`,
      "script.js": `document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>document.querySelector('#collection')?.scrollIntoView({behavior:'smooth'})));`,
      "assets/README.md": `Generated by NOVA Website Design Studio.\nMode: frontend_preview\nDesign request: ${String(userMessage || "").replace(/[\r\n]+/g, " ").slice(0, 180)}`
    };
  }
  writeToFilesWorkspace(fileWorkspace, projectName, userMessage) { return fileWorkspace.createProject(projectName, this.saveAsCode(userMessage)); }
  start(request) { this.status = "executing"; this.model = this.generateSiteModel(request); return { request, status: this.status, preview: "fashion_store" }; }
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

async function startBackendAgentTask(userMessage, brain = "localMock") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1600);
  try {
    const response = await fetch(`${BACKEND_AGENT_API_BASE}/agent/task`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, brain }), signal: controller.signal
    });
    if (!response.ok) throw new Error(`Backend Agent Runtime returned HTTP ${response.status}`);
    return response.json();
  } finally { window.clearTimeout(timeout); }
}

function subscribeAgentEvents(taskId, onEvent, onOffline) {
  const source = new EventSource(`${BACKEND_AGENT_API_BASE}/agent/task/${encodeURIComponent(taskId)}/events`);
  const types = ["task_created", "agent_brain_started", "brain_provider_selected", "brain_fallback_used", "intent_detected", "plan_created", "step_started", "step_progress", "step_completed", "tool_selected", "tool_started", "tool_stdout", "tool_stderr", "tool_progress", "tool_output", "tool_completed", "tool_observation", "artifact_created", "browser_action_started", "browser_action_completed", "computer_action_started", "computer_action_completed", "render_provider_check_started", "render_provider_available", "render_workflow_missing", "render_job_submitted", "render_queue_waiting", "render_sampling_progress", "render_collecting_output", "render_image_saved", "render_prompt_created", "beauty_render_started", "beauty_render_progress", "collecting_output", "beauty_render_ready", "beauty_render_blocked", "beauty_render_completed", "beauty_render_failed", "safety_confirmation_required", "waiting_for_user", "tool_waiting_for_user", "preview_ready", "task_completed", "task_failed", "step_updated"];
  source.novaTaskId = taskId;
  source.novaCloseReason = null;
  source.novaTerminalObserved = false;
  types.forEach((type) => source.addEventListener(type, (message) => {
    if (["universal_agent_completed", "waiting_for_user", "universal_agent_failed", "task_completed", "tool_waiting_for_user", "tool_failed"].includes(type)) source.novaTerminalObserved = true;
    onEvent(JSON.parse(message.data));
  }));
  source.onerror = () => {
    const expectedClose = Boolean(source.novaCloseReason || source.novaTerminalObserved);
    source.close();
    if (!expectedClose) onOffline?.(new Error("Backend Agent Runtime event stream disconnected."));
  };
  return source;
}

function applyAgentEvent(event) { window.avatarController?.applyBackendAgentEvent(event); }
function updateWorkbenchFromAgentState(state) { window.avatarController?.updateWorkbenchFromAgentState(state); }
window.startBackendAgentTask = startBackendAgentTask;
window.subscribeAgentEvents = subscribeAgentEvents;
window.applyAgentEvent = applyAgentEvent;
window.updateWorkbenchFromAgentState = updateWorkbenchFromAgentState;

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
    this.agentPlaybackQueue = [];
    this.agentPlaybackStepIndex = -1;
    this.agentPlaybackActive = false;
    this.agentPlaybackProfile = null;
    this.backendEventSource = null;
    this.backendTaskId = null;
    this.pendingWorkbenchImageUrl = null;
    this.pendingRenderTaskCompletion = null;
    window.NOVA_WORKBENCH_DISPLAY_STATE = { taskType:"interior_design", phase:"idle", taskId:null, provider:null, progress:0, imageUrl:null, imageLoadStatus:"idle", previewDomStatus:"idle", badge:"IDLE", lastEvent:null, updatedAt:null };
    this.backendRuntimeOnline = null;
    this.backendLifecycleState = "backend_offline";
    this.backendTerminalHandled = false;
    this.beautyRenderTimeoutId = null;
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
    return this.websiteBuildEngine.writeToFilesWorkspace(this.fileWorkspaceEngine, "fashion-store", request);
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
      const panel = action.closest(".booking-live-window");
      panel?.querySelectorAll("[data-booking-mode]").forEach((button) => button.classList.toggle("is-active", button === action));
      const title = panel?.querySelector(".review-lock strong");
      const detail = panel?.querySelector(".review-lock small");
      const authorized = action.dataset.bookingMode === "authorized";
      if (title) title.textContent = authorized ? "Ready for official handoff" : "Payment protected";
      if (detail) detail.textContent = authorized ? "Continue manually on VIESHOW after confirmation" : "No transaction executed";
    }
    if (type === "refine-design") {
      this.websiteBuildEngine.enableRefineDesign({ refinedAt: new Date().toISOString() });
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
    this.agentCloseButton.addEventListener("click", () => this.returnToNova());
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
  setAgentStatus(status, message = "") { if (this.currentWorkbenchTaskType === "design3d") return; const node = this.workbenchTaskCanvas.querySelector("[data-agent-status]"); if (node) node.textContent = message || status.replaceAll("_", " "); this.agentStatusLabel.textContent = status.replaceAll("_", " ").toUpperCase(); }

  getMainResultViewer() { return this.workbenchTaskCanvas.querySelector("[data-result-viewer='main']"); }

  renderMainResultViewer(phase, payload = {}) {
    const viewer = this.getMainResultViewer();
    if (!viewer) return;
    viewer.dataset.resultPhase = phase;
    const states = {
      idle: ["Understanding request", "Preparing the interior design task."],
      plan_created: ["Plan created", "NOVA created the interior design execution plan."],
      provider_checking: ["Checking render provider", "Connecting to local ComfyUI provider."],
      provider_ready: ["Render provider ready", "Local ComfyUI provider is available."],
      render_submitted: ["Render job submitted", "Workflow submitted to ComfyUI."],
      rendering: ["Rendering image", "Sampling final image in ComfyUI."],
      collecting_output: ["Collecting output", "Retrieving final image from ComfyUI."],
      image_loading: ["Loading final image", "Waiting for final_render.png to load into the viewer."],
      image_failed: ["Result failed", payload.message || "The final image could not be displayed."],
      failed: ["Result failed", payload.message || "The result could not be displayed."],
      timeout: ["Result failed", payload.message || "The render timed out."]
    };
    if (phase === "final_image" && payload.imageElement) {
      const image = payload.imageElement; image.className = "beauty-render-image"; image.alt = "Final render";
      viewer.replaceChildren(image); viewer.dataset.imageLoadStatus = "loaded"; return;
    }
    const [title, detail] = states[phase] || states.idle;
    const state = document.createElement("div"); state.className = `result-state${["image_failed", "failed", "timeout"].includes(phase) ? " result-state--error" : ""}`;
    const strong = document.createElement("strong"); strong.textContent = title;
    const span = document.createElement("span"); span.textContent = detail;
    state.append(strong, span);
    if (phase === "rendering") { const small = document.createElement("small"); small.textContent = `${window.NOVA_WORKBENCH_DISPLAY_STATE.progress}%`; state.append(small); }
    viewer.replaceChildren(state);
  }

  setWorkbenchDisplayPhase(phase, payload = {}) {
    const allowed = ["idle", "plan_created", "provider_checking", "provider_ready", "render_submitted", "rendering", "collecting_output", "image_loading", "final_image", "image_failed", "failed", "timeout"];
    if (!allowed.includes(phase)) return;
    const previous = window.NOVA_WORKBENCH_DISPLAY_STATE;
    const candidateUrl = payload.imageUrl || payload.finalRenderUrl || (typeof payload.artifact === "string" && payload.artifact.startsWith("/generated_assets/") ? payload.artifact : null);
    const rawProgress = Number(payload.progress ?? previous.progress ?? 0);
    const progress = rawProgress <= 1 ? Math.round(rawProgress * 100) : Math.round(rawProgress);
    const badgeMap = { idle:"IDLE", plan_created:"PLAN CREATED", provider_checking:"CHECKING PROVIDER", provider_ready:"PROVIDER READY", render_submitted:"RENDER SUBMITTED", rendering:"RENDERING", collecting_output:"COLLECTING OUTPUT", image_loading:"LOADING IMAGE", final_image:"DONE", image_failed:"IMAGE FAILED", failed:"FAILED", timeout:"TIMEOUT" };
    const imageLoadStatus = phase === "final_image" ? "loaded" : phase === "image_loading" ? "loading" : phase === "image_failed" ? "error" : previous.imageLoadStatus;
    const previewDomStatus = phase === "final_image" ? "visible" : phase === "image_loading" ? "loading" : ["image_failed", "failed", "timeout"].includes(phase) ? "error" : previous.previewDomStatus;
    window.NOVA_WORKBENCH_DISPLAY_STATE = { ...previous, phase, taskId:this.backendTaskId || previous.taskId, provider:payload.provider || payload.renderProvider || previous.provider, progress, imageUrl:candidateUrl || previous.imageUrl, imageLoadStatus, previewDomStatus, badge:badgeMap[phase], lastEvent:payload.eventType || payload.lastEvent || phase, updatedAt:new Date().toISOString() };
    const viewer = this.getMainResultViewer(); if (viewer) { viewer.dataset.resultPhase = phase; viewer.dataset.imageLoadStatus = imageLoadStatus; }
    this.renderMainResultViewer(phase, payload);
    const badge = this.workbenchTaskCanvas.querySelector("[data-agent-status]"); if (badge) badge.textContent = badgeMap[phase];
    this.agentStatusLabel.textContent = badgeMap[phase];
    const current = this.workbenchTaskCanvas.querySelector("[data-operation-current]"); if (current) current.textContent = badgeMap[phase];
    const timelineMap = { idle:["understanding-request","Understanding request"], plan_created:["planning-room-layout","Planning room layout"], provider_checking:["checking-render-provider","Checking render provider"], provider_ready:["checking-render-provider","Checking render provider"], render_submitted:["submitting-render-job","Submitting render job"], rendering:["rendering-image","Rendering image"], collecting_output:["collecting-output","Collecting output"], image_loading:["loading-final-image","Loading final image"], final_image:["final-render-ready","Final image ready"], image_failed:["loading-final-image","Loading final image"], failed:["final-render-ready","Final image ready"], timeout:["final-render-ready","Final image ready"] };
    const [stepId, title] = timelineMap[phase]; this.updateOperationTimeline(`display_${phase}`, { stepId, title, visibleAction:title, status:phase === "final_image" ? "completed" : ["image_failed","failed","timeout"].includes(phase) ? "failed" : "running", progress:progress / 100 });
    window.NOVA_DEBUG_RENDER_STATE = { imageLoadStatus, previewDomStatus, renderStatus:phase, imageUrl:window.NOVA_WORKBENCH_DISPLAY_STATE.imageUrl };
    this.updateBeautyRenderDebug({ renderStatus:phase, imageLoadStatus, progress, imageUrl:window.NOVA_WORKBENCH_DISPLAY_STATE.imageUrl, lastEvent:window.NOVA_WORKBENCH_DISPLAY_STATE.lastEvent });
    if (phase === "image_loading" && candidateUrl?.startsWith("/generated_assets/interior_renders/") && candidateUrl.endsWith("/final_render.png") && this.pendingWorkbenchImageUrl !== candidateUrl) {
      this.pendingWorkbenchImageUrl = candidateUrl;
      const image = new Image();
      image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? this.setWorkbenchDisplayPhase("final_image", { imageUrl:candidateUrl, imageElement:image, progress:100, eventType:"image_load_completed" }) : this.setWorkbenchDisplayPhase("image_failed", { imageUrl:candidateUrl, message:"Final image has invalid dimensions.", eventType:"image_load_failed" });
      image.onerror = () => this.setWorkbenchDisplayPhase("image_failed", { imageUrl:candidateUrl, message:"Final image failed to load.", eventType:"image_load_failed" });
      image.src = candidateUrl;
    }
    if (phase === "final_image") { this.clearBeautyRenderTimeout(); this.backendTerminalHandled = true; this.backendLifecycleState = "backend_completed"; this.closeAgentEventSource("final_image_loaded"); this.restoreWorkbenchControls("completed"); }
  }

  async startAgentTaskRuntime(task, taskType) {
    this.agentLogs = [];
    this.closeAgentEventSource("new_task");
    this.backendTerminalHandled = false;
    this.backendLifecycleState = "backend_connected";
    try {
      const state = await startBackendAgentTask(task);
      this.handleBackendTaskCreated(state, task);
      this.backendEventSource = subscribeAgentEvents(state.taskId, (event) => this.handleBackendAgentEvent(event), (error) => {
        if (!this.backendTerminalHandled) this.handleBackendRuntimeOffline(error, taskType, task);
      });
      if (taskType === "design3d") this.startBeautyRenderTimeout();
      return state;
    } catch (error) {
      this.handleBackendRuntimeOffline(error, taskType, task);
      return this.agentOrchestrator.startTask(task, this.getAgentIntent(taskType));
    }
  }

  handleBackendTaskCreated(state, task) {
    this.backendRuntimeOnline = true;
    this.backendLifecycleState = "backend_running";
    this.backendTaskId = state.taskId;
    this.agentOrchestrator.state = state;
    this.agentPlaybackActive = true;
    this.setServiceStatus(this.fastApiWorkbenchStatus, "Runtime online", "online");
    this.agentTaskDesc.innerText = `Task: ${task} · BACKEND AGENT`;
    if (this.currentWorkbenchTaskType === "design3d") this.setWorkbenchDisplayPhase("idle", { eventType:"task_created" });
    else this.agentStatusLabel.textContent = "RUNNING";
    this.appendAgentLog(`Backend task created · ${state.taskId.slice(0, 8)}`);
  }

  closeAgentEventSource(reason = "intentional") {
    const source = this.backendEventSource;
    if (!source) return;
    source.novaCloseReason = reason;
    source.onerror = null;
    source.close();
    this.backendEventSource = null;
  }

  handleBackendRuntimeOffline(error, taskType, task) {
    if (this.backendTerminalHandled || ["backend_completed", "backend_waiting_for_user", "backend_failed"].includes(this.backendLifecycleState)) return;
    this.closeAgentEventSource("network_error");
    this.backendLifecycleState = "backend_offline";
    this.appendAgentLog(error?.message || "Backend Agent Runtime unavailable");
    if (taskType === "design3d") this.showBeautyRenderTerminalState({ title: "Backend Offline", provider: "BackendOffline", message: "Render Provider Unavailable" });
    this.activateLocalAgentFallback(taskType, task);
  }

  activateLocalAgentFallback(taskType, task) {
    if (this.backendRuntimeOnline === false && this.agentPlaybackActive) return;
    this.backendRuntimeOnline = false;
    this.backendLifecycleState = "local_fallback";
    this.setServiceStatus(this.fastApiWorkbenchStatus, "Offline", "offline");
    this.agentStatusLabel.textContent = "LOCAL PREVIEW";
    this.appendAgentLog("Backend Agent Runtime offline · Running local preview mode");
    if (!this.agentPlaybackActive) this.startAgentPlayback(taskType, task);
  }

  handleBackendAgentEvent(event) {
    const payload = event.data || {};
    const state = payload.task || this.agentOrchestrator.state;
    if (state) this.agentOrchestrator.state = state;
    this.updateOperationTimeline(event.type, payload);
    const renderActivityEvents = ["render_provider_available", "beauty_render_started", "beauty_render_progress", "collecting_output", "beauty_render_ready", "beauty_render_completed"];
    if (renderActivityEvents.includes(event.type)) this.startBeautyRenderTimeout();
    this.updateBeautyRenderDebug({ lastEvent: event.type, ...(payload || {}) });
    this.updateWorkbenchFromAgentState(state);
    if (event.type === "universal_agent_started") this.setAgentStatus("running", "Universal Agent started");
    if (event.type === "intent_detected") this.appendAgentLog(`Intent detected · ${payload.intent}`);
    if (event.type === "tool_selected") {
      const selected = payload.tools?.[0]?.name || state?.toolCalls?.[0]?.name;
      if (selected) this.updateToolChip(selected, "selected");
      this.appendAgentLog(`Tool selected · ${(payload.tools || []).map((tool) => tool.name).join(", ")}`);
    }
    if (event.type === "tool_started") {
      this.updateToolChip(payload.tool, "running");
      this.setAgentStatus("using_tool", `Using ${payload.tool}`);
    }
    if (event.type === "tool_progress") this.setAgentStatus("tool_progress", `${payload.tool} · ${Math.round((payload.progress || 0) * 100)}%`);
    if (event.type === "observation_received") this.appendAgentLog(`Observation · ${payload.observation?.summary || "Result received"}`);
    if (event.type === "fix_started") this.appendAgentLog(`Fix started · ${payload.error || payload.tool}`);
    if (event.type === "output_ready") this.appendAgentLog("Output ready");
    if (event.type === "render_prompt_created") this.appendAgentLog("Final render prompt created");
    if (event.type === "render_provider_check_started") this.appendAgentLog("Render provider check started");
    if (event.type === "render_provider_available") this.appendAgentLog(`Render provider available · ${payload.provider}`);
    if (event.type === "render_provider_unavailable") this.appendAgentLog("Production render provider unavailable");
    if (event.type === "render_workflow_missing") this.appendAgentLog("ComfyUI connected, workflow missing");
    if (event.type === "beauty_render_started") this.setAgentStatus("using_tool", "Rendering in ComfyUI");
    if (event.type === "beauty_render_progress") {
      const progress = Math.round((payload.progress || 0) * 100);
      this.setAgentStatus("tool_progress", progress >= 100 ? "Collecting final image" : `Final render · ${progress}%`);
      if (progress >= 100) this.showBeautyRenderCollecting(payload);
    }
    if (event.type === "collecting_output") this.showBeautyRenderCollecting(payload);
    if (["beauty_render_ready", "beauty_render_completed"].includes(event.type) || (event.type === "render_image_saved" && (payload.finalRenderUrl?.startsWith("/generated_assets/") || payload.artifact?.startsWith?.("/generated_assets/")))) this.showFinalBeautyRender(payload);
    if (event.type === "beauty_render_blocked") { this.clearBeautyRenderTimeout(); this.showRenderProviderRequired(payload); }
    if (event.type === "beauty_render_failed") {
      this.clearBeautyRenderTimeout();
      this.appendAgentLog(`Beauty render unavailable · ${payload.error || "unknown error"}`);
      this.showBeautyRenderTerminalState({ title: "Render Failed", provider: "RenderProviderRequired", message: payload.error || "Production render failed" });
      this.restoreWorkbenchControls("failed");
    }
    if (event.type === "plan_created") this.appendAgentLog(`Plan ready · ${(state.steps || []).length} steps`);
    if (event.type === "step_updated") {
      const definition = this.getAgentPlaybackDefinition(this.currentWorkbenchTaskType);
      const visualStep = definition.steps[payload.index];
      if (visualStep) {
        this.updateAgentBubble(payload.step.label);
        this.revealWorkspaceLayer(visualStep.layer);
        this.moveCursorTo(visualStep.target); this.clickCursorTarget(visualStep.target);
      }
      this.appendAgentLog(payload.step.label);
    }
    if (event.type === "tool_output" && payload.sceneSpec) this.design3DEngine?.applySceneSpec?.(payload.sceneSpec);
    if (event.type === "tool_output" && payload.fileContents) this.importBackendWebsiteProject(payload.fileContents);
    if (event.type === "waiting_for_user" || event.type === "tool_waiting_for_user") this.handleBackendTaskWaitingForUser(state);
    if (event.type === "preview_ready" && state?.status === "waiting_for_user") this.handleBackendTaskWaitingForUser(state);
    if (event.type === "universal_agent_completed" || event.type === "task_completed") this.handleBackendTaskCompleted(state);
    if (event.type === "task_failed") this.handleBackendTaskFailed(payload.debug?.error || state?.output?.error || "Agent task failed.");
    if (this.currentWorkbenchTaskType === "design3d") {
      const phaseByEvent = { task_created:"idle", plan_created:"plan_created", render_provider_check_started:"provider_checking", render_provider_available:"provider_ready", render_job_submitted:"render_submitted", beauty_render_started:"rendering", render_queue_waiting:"rendering", render_sampling_progress:"rendering", beauty_render_progress:"rendering", render_collecting_output:"collecting_output", collecting_output:"collecting_output", render_image_saved:"image_loading", beauty_render_ready:"image_loading", beauty_render_completed:"image_loading", beauty_render_failed:"failed", task_failed:"failed", render_timeout:"timeout" };
      const phase = phaseByEvent[event.type];
      if (phase) this.setWorkbenchDisplayPhase(phase, { ...payload, eventType:event.type });
    }
  }

  updateOperationTimeline(type, payload = {}) {
    const root = this.workbenchTaskCanvas.querySelector(".operation-console");
    if (!root) return;
    const list = root.querySelector("[data-operation-timeline]");
    const stepMap = {
      agent_brain_started: ["understanding-request", "Understanding request"],
      intent_detected: ["planning-room-layout", "Planning room layout"], plan_created: ["planning-room-layout", "Planning room layout"],
      tool_selected: ["selecting-tools", "Selecting tools"],
      tool_output: ["generating-draft", "Generating draft"],
      render_provider_check_started: ["checking-render-provider", "Checking render provider"], render_provider_available: ["checking-render-provider", "Checking render provider"],
      render_job_submitted: ["submitting-render-job", "Submitting render job"], render_queue_waiting: ["submitting-render-job", "Submitting render job"],
      beauty_render_progress: ["rendering-image", "Rendering image"], render_sampling_progress: ["rendering-image", "Rendering image"],
      collecting_output: ["collecting-output", "Collecting output"], render_collecting_output: ["collecting-output", "Collecting output"],
      beauty_render_ready: ["loading-final-image", "Loading final image"], beauty_render_completed: ["loading-final-image", "Loading final image"], render_image_saved: ["loading-final-image", "Loading final image"], task_completed: ["loading-final-image", "Loading final image"], image_load_started: ["loading-final-image", "Loading final image"],
      image_load_completed: ["final-render-ready", "Final render ready"]
    };
    if (this.currentWorkbenchTaskType === "design3d" && !stepMap[type] && !type.startsWith("display_")) return;
    const [stepId, stableTitle] = stepMap[type] || [payload.stepId || type, payload.title || type.replaceAll("_", " ")];
    let item = list?.querySelector(`[data-step-id="${stepId}"]`);
    if (!item) { item = document.createElement("li"); item.dataset.stepId = stepId; list?.append(item); }
    item.className = `is-${payload.status || "running"}`;
    item.innerHTML = `<i></i><div><strong>${escapeWorkbenchText(stableTitle)}</strong><span>${escapeWorkbenchText(payload.visibleAction || payload.message || "Operation updated")}</span></div><small>${escapeWorkbenchText(payload.tool || payload.status || "running")}</small>`;
    const current = root.querySelector("[data-operation-current]"); const wait = root.querySelector("[data-operation-wait]"); const tool = root.querySelector("[data-operation-tool]"); const status = root.querySelector("[data-operation-status]"); const progress = root.querySelector("[data-operation-progress]"); const artifact = root.querySelector("[data-operation-artifact]");
    if (current) current.textContent = stableTitle;
    if (wait) wait.textContent = payload.visibleAction || payload.reason || "Operation updated";
    if (tool && payload.tool) tool.textContent = payload.tool;
    if (status) status.textContent = payload.status || "running";
    if (progress) progress.value = Math.round((payload.progress || 0) * 100);
    const artifactValue = Array.isArray(payload.artifact) ? payload.artifact.at(-1) : payload.artifact;
    if (artifact && artifactValue) artifact.textContent = String(artifactValue);
    const debug = root.querySelector("[data-operation-debug]"); if (debug) debug.textContent = `lastEvent: ${type}\ntaskId: ${payload.taskId || this.backendTaskId || "—"}\nstepId: ${payload.stepId || "—"}\nstatus: ${payload.status || "running"}\nprogress: ${Math.round((payload.progress || 0) * 100)}`;
  }

  applyBackendAgentEvent(event) { this.handleBackendAgentEvent(event); }

  showFinalBeautyRender(payload) {
    const imageUrl = payload.finalRenderUrl || (typeof payload.artifact === "string" ? payload.artifact : "");
    this.setWorkbenchDisplayPhase("image_loading", { ...payload, imageUrl, eventType:"image_load_started" });
  }

  showBeautyRenderCollecting(payload = {}) {
    this.setWorkbenchDisplayPhase("collecting_output", { ...payload, eventType:"collecting_output" });
  }

  updateBeautyRenderDebug(values = {}) {
    const panel = this.workbenchTaskCanvas.querySelector(".final-beauty-render");
    const node = panel?.querySelector("[data-render-debug]");
    if (!panel || !node) return;
    this.beautyRenderDebug = { timeoutSeconds: 540, finalRenderExists: false, ...this.beautyRenderDebug, ...values };
    node.textContent = ["providerStatus", "renderStatus", "imageLoadStatus", "lastEvent", "progress", "timeoutSeconds", "promptId", "imageUrl", "outputPath", "finalRenderExists"]
      .map((key) => `${key}: ${this.beautyRenderDebug[key] ?? "—"}`).join("\n");
  }

  clearBeautyRenderTimeout() {
    if (!this.beautyRenderTimeoutId) return;
    window.clearTimeout(this.beautyRenderTimeoutId);
    this.beautyRenderTimeoutId = null;
  }

  startBeautyRenderTimeout() {
    this.clearBeautyRenderTimeout();
    this.beautyRenderTimeoutId = window.setTimeout(async () => {
      const panel = this.workbenchTaskCanvas.querySelector(".final-beauty-render");
      if (panel?.dataset.renderStatus === "ready") return;
      const imageUrl = this.backendTaskId ? `/generated_assets/interior_renders/${this.backendTaskId}/final_render.png` : "";
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl, { method: "HEAD", cache: "no-store" });
          if (response.ok) { this.showFinalBeautyRender({ finalRenderUrl: imageUrl, renderProvider: "ComfyUIRenderProvider", renderMessage: "Final Render Ready" }); return; }
        } catch (_) { /* The ready event may still arrive after this recoverable UI timeout. */ }
      }
      this.appendAgentLog("Final render timed out after 540 seconds");
      this.showBeautyRenderTerminalState({ title: "Render Timeout", provider: "ComfyUIRenderProvider", message: "Final render did not complete within 540 seconds" });
      this.restoreWorkbenchControls("failed");
    }, 540000);
  }

  showBeautyRenderTerminalState({ title, provider, message, detail = "3D Draft remains available" }) {
    this.setWorkbenchDisplayPhase(title === "Render Timeout" ? "timeout" : "failed", { provider, message, detail, eventType:title === "Render Timeout" ? "render_timeout" : "task_failed" });
  }

  showBeautyRenderImageError(imageUrl) {
    this.appendAgentLog(`Final render image failed to load · ${imageUrl}`);
    this.setWorkbenchDisplayPhase("image_failed", { imageUrl, message:"Final render image could not be loaded", eventType:"image_load_failed" });
    this.restoreWorkbenchControls("failed");
  }

  showRenderProviderRequired(payload) {
    this.showBeautyRenderTerminalState({
      title: payload.renderStatus === "provider_ready_but_workflow_missing" ? "Workflow Missing" : "Render Provider Required",
      provider: "RenderProviderRequired",
      message: payload.renderMessage || "Production render provider not connected",
      detail: payload.renderPromptSummary || "Production raster render target prepared"
    });
  }

  handleBackendTaskCompleted(state) {
    if (this.backendTerminalHandled) return;
    if (this.currentWorkbenchTaskType === "design3d") {
      this.pendingRenderTaskCompletion = state;
      if (state?.output?.renderStatus && state.output.renderStatus !== "ready") this.setWorkbenchDisplayPhase("failed", { message:state.output.renderMessage, eventType:"task_failed" });
      if (window.NOVA_WORKBENCH_DISPLAY_STATE.phase === "final_image") { this.backendTerminalHandled = true; this.backendLifecycleState = "backend_completed"; this.closeAgentEventSource("task_completed"); this.restoreWorkbenchControls("completed"); }
      return;
    }
    if (state?.output?.renderStatus && state.output.renderStatus !== "ready") {
      this.backendTerminalHandled = true;
      this.backendLifecycleState = "backend_completed";
      this.closeAgentEventSource("render_provider_required");
      this.showRenderProviderRequired(state.output);
      this.agentStatusLabel.textContent = "RENDER PROVIDER REQUIRED";
      this.setAgentStatus("render_provider_required", state.output.renderMessage || "Render Provider Required");
      this.restoreWorkbenchControls("completed");
      hasCompletedFirstTask = true;
      this.hasCompletedFirstTask = true;
      return;
    }
    this.backendTerminalHandled = true;
    this.backendLifecycleState = "backend_completed";
    this.closeAgentEventSource("task_completed");
    this.completeAgentPlayback({ status: "preview_ready", tool: state?.toolCalls?.[0]?.name });
    this.agentStatusLabel.textContent = "DONE";
    this.restoreWorkbenchControls("completed");
    hasCompletedFirstTask = true;
    this.hasCompletedFirstTask = true;
  }

  handleBackendTaskWaitingForUser(state) {
    if (this.backendLifecycleState === "backend_waiting_for_user") return;
    this.backendTerminalHandled = true;
    this.backendLifecycleState = "backend_waiting_for_user";
    this.closeAgentEventSource("waiting_for_user");
    this.agentStatusLabel.textContent = "WAITING FOR USER";
    this.setAgentStatus("waiting_for_user", "Waiting for user confirmation");
    this.updateToolChip(state?.toolCalls?.[0]?.name || "BrowserAutomationTool", "waiting_for_user");
    this.appendAgentLog("Waiting for user · stopped before protected action");
    this.restoreWorkbenchControls("waiting_for_user");
  }

  handleBackendTaskFailed(error) {
    if (this.currentWorkbenchTaskType === "design3d") { this.setWorkbenchDisplayPhase("failed", { message:error, eventType:"task_failed" }); this.restoreWorkbenchControls("failed"); return; }
    if (this.backendLifecycleState === "backend_failed") return;
    this.backendTerminalHandled = true;
    this.backendLifecycleState = "backend_failed";
    this.closeAgentEventSource("task_failed");
    this.agentStatusLabel.textContent = "FAILED";
    this.agentStatusBadge.classList.add("is-error");
    this.agentErrorText.textContent = String(error || "Agent task failed.");
    this.agentErrorText.hidden = false;
    this.restoreWorkbenchControls("failed");
  }

  restoreWorkbenchControls(status) {
    isAgentRunning = false;
    this.isBusy = false;
    this.agentCompletionInProgress = false;
    this.agentCloseButton.hidden = false;
    this.agentCloseButton.disabled = false;
    this.agentCloseButton.textContent = "Return to NOVA";
    this.setInputsDisabled(false);
    if (status === "waiting_for_user") {
      this.workbenchTaskCanvas.querySelectorAll(".official-site-link, [data-workbench-action='save-website-code'], [data-booking-mode]").forEach((control) => { control.disabled = false; });
    }
  }

  resetAgentRunState() {
    this.clearBeautyRenderTimeout();
    this.closeAgentEventSource("reset");
    this.clearAgentStatusPolling();
    this.clearWorkbenchTaskAnimation();
    this.backendTerminalHandled = false;
    this.backendRuntimeOnline = null;
    this.backendLifecycleState = "backend_offline";
    this.backendTaskId = null;
    this.agentOrchestrator.state = null;
    this.agentPlaybackActive = false;
    this.agentPlaybackQueue = [];
    this.agentPlaybackStepIndex = -1;
    isAgentRunning = false;
    this.isBusy = false;
  }

  prepareForNextAgentTask() {
    this.resetAgentRunState();
    this.agentCompletionText.hidden = true;
    this.agentErrorText.hidden = true;
    this.agentStatusBadge.classList.remove("is-error");
    this.agentCloseButton.hidden = true;
    document.body.classList.remove("agent-overlay-preparing", "agent-overlay-open", "agent-overlay-closing");
  }

  updateWorkbenchFromAgentState(state) {
    if (!state) return;
    if (this.currentWorkbenchTaskType !== "design3d") this.setAgentStatus(state.status, state.currentStep || state.status);
    if (state.cursor) this.moveAgentCursor(state.cursor.x, state.cursor.y);
    state.steps?.forEach((step, index) => this.updateStepStatus(`${this.currentWorkbenchTaskType}-${index + 1}`, step.status === "done" ? "done" : step.status));
    const activeTool = state.toolCalls?.[0];
    if (activeTool) this.updateToolChip(activeTool.name, state.status);
  }

  importBackendWebsiteProject(fileContents) {
    if (!fileContents || this.generatedProjects.some((item) => item.id === `backend-${this.backendTaskId}`)) return;
    const project = { id: `backend-${this.backendTaskId}`, name: "fashion-store", createdAt: new Date().toISOString(), files: fileContents };
    this.generatedProjects = [project, ...this.generatedProjects.filter((item) => item.name !== project.name)];
    this.persistGeneratedProjects();
    this.renderFiles(Object.keys(fileContents));
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
  }

  clearWorkbenchTaskAnimation() {
    if (this.workbenchTaskTimeline) {
      this.workbenchTaskTimeline.kill();
      this.workbenchTaskTimeline = null;
    }
    this.workbenchTaskTimers.forEach((timer) => clearTimeout(timer));
    this.workbenchTaskTimers = [];
    this.agentPlaybackQueue = [];
    this.agentPlaybackStepIndex = -1;
    this.agentPlaybackActive = false;
  }

  destroyCapabilityEngines() {
    this.design3DEngine?.destroy();
    this.design3DEngine = null;
    this.toolExecutor.unregister("Interior3DEngine");
  }

  resetAgentPlayback() {
    this.workbenchTaskTimers.forEach((timer) => clearTimeout(timer));
    this.workbenchTaskTimers = [];
    this.agentPlaybackQueue = [];
    this.agentPlaybackStepIndex = -1;
    this.agentPlaybackActive = false;
    const root = this.workbenchTaskCanvas.querySelector(".task-workflow");
    root?.classList.remove("is-ready", "is-complete");
    root?.querySelectorAll(".playback-layer").forEach((layer) => {
      layer.classList.remove("is-building", "is-visible", "is-complete", "is-highlighted", "is-agent-target");
      layer.classList.add("is-pending");
    });
    root?.querySelectorAll(".ai-step").forEach((step) => step.classList.remove("is-active", "is-complete"));
  }

  getAgentPlaybackDefinition(taskType) {
    const definitions = {
      design3d: {
        tool: "Interior3DEngine",
        planning: "Reading interior design request",
        completeStatus: "done",
        steps: [
          { layer: "cafe-layer-shell", target: { x: 30, y: 58 }, message: "Building spatial shell" },
          { layer: "cafe-layer-counter", target: { x: 66, y: 47 }, message: "Adding cafe counter and back bar" },
          { layer: "cafe-layer-seating", target: { x: 44, y: 66 }, message: "Arranging seating layout" },
          { layer: "cafe-layer-lighting", target: { x: 52, y: 28 }, message: "Applying warm lighting" },
          { layer: "cafe-layer-material", target: ".viewport-floating-hud", message: "Applying material palette" },
          { layer: "cafe-layer-decor", target: { x: 18, y: 50 }, message: "Adding interior details" },
          { layer: "cafe-layer-ready", target: ".viewport-drag-hint", message: "3D preview ready · drag to rotate", final: true }
        ]
      },
      booking: {
        tool: "BrowserAutomationEngine",
        planning: "Identifying target site",
        completeStatus: "waiting_for_user",
        steps: [
          { layer: "booking-layer-browser", target: ".ai-address-bar", message: "Opening browser workspace" },
          { layer: "booking-layer-site", target: ".official-site-link", message: "Loading Vieshow Cinemas safe preview" },
          { layer: "booking-layer-search", target: '[data-control="theater"]', message: "Searching available sessions" },
          { layer: "booking-layer-results", target: ".booking-showtimes .is-selected", message: "Selecting the 19:30 session" },
          { layer: "booking-layer-ticket", target: ".booking-ticket-control strong", message: "Selecting two adult tickets" },
          { layer: "booking-layer-seat", target: ".booking-seat-preview i.is-selected", message: "Choosing seats F11 and F12" },
          { layer: "booking-layer-review", target: ".review-lock", message: "Review before payment · confirmation required", final: true }
        ]
      },
      demoToCode: {
        tool: "WebsiteBuildEngine",
        planning: "Parsing fashion store request",
        completeStatus: "preview_ready",
        steps: [
          { layer: "site-layer-brand", target: ".website-style-toolbar", message: "Defining brand, color, and type direction" },
          { layer: "site-layer-header", target: ".builder-nav", message: "Building logo and navigation" },
          { layer: "site-layer-hero", target: ".builder-hero", message: "Composing hero and primary CTA" },
          { layer: "site-layer-categories", target: ".fashion-categories", message: "Adding collection categories" },
          { layer: "site-layer-products", target: ".builder-products article", message: "Generating six fashion products" },
          { layer: "site-layer-footer", target: ".fashion-lookbook", message: "Adding lookbook and footer" },
          { layer: "site-layer-save", target: '[data-workbench-action="save-website-code"]', message: "Website preview ready · code export enabled", final: true }
        ]
      },
      default: {
        tool: "AgentOrchestrator",
        planning: "Understanding your request",
        completeStatus: "preview_ready",
        steps: [
          { layer: "default-layer-plan", target: { x: 26, y: 44 }, message: "Creating execution plan" },
          { layer: "default-layer-tools", target: { x: 52, y: 58 }, message: "Selecting available tools" },
          { layer: "default-layer-output", target: { x: 76, y: 70 }, message: "Preparing output preview", final: true }
        ]
      }
    };
    return definitions[taskType] || definitions.default;
  }

  startAgentPlayback(taskType, userMessage) {
    this.resetAgentPlayback();
    const root = this.workbenchTaskCanvas.querySelector(".task-workflow");
    if (!root) return;
    const profiles = { slow: { start: 700, interval: 1650 }, normal: { start: 600, interval: 1100 }, fast: { start: 400, interval: 700 } };
    this.agentPlaybackProfile = profiles[AGENT_PLAYBACK_SPEED] || profiles.normal;
    const definition = this.getAgentPlaybackDefinition(taskType);
    this.agentPlaybackActive = true;
    this.updateAgentBubble(definition.planning);
    this.updateToolChip(definition.tool, "pending");
    this.updateStepStatus(`${taskType}-0`, "running");
    this.setAgentStatus("planning", "Agent planning");
    this.appendAgentLog(`Agent received task · ${String(userMessage || "").slice(0, 72)}`);
    definition.steps.forEach((step, index) => this.queueAgentStep({ ...step, id: `${taskType}-${index + 1}`, tool: definition.tool, completeStatus: definition.completeStatus }));
    const selectionTimer = window.setTimeout(() => {
      if (!this.agentPlaybackActive) return;
      this.updateToolChip(definition.tool, "selected");
      this.setAgentStatus("using_tool", `Selected ${definition.tool}`);
      this.appendAgentLog(`Selected engine · ${definition.tool}`);
    }, 300);
    const startTimer = window.setTimeout(() => this.runNextAgentStep(), this.agentPlaybackProfile.start);
    this.workbenchTaskTimers.push(selectionTimer, startTimer);
  }

  queueAgentStep(step) { this.agentPlaybackQueue.push(step); return step; }

  runNextAgentStep() {
    if (!this.agentPlaybackActive) return;
    const step = this.agentPlaybackQueue.shift();
    if (!step) return this.completeAgentPlayback({ status: "preview_ready" });
    const previousStepId = this.agentPlaybackStepIndex < 0
      ? `${this.currentWorkbenchTaskType}-0`
      : `${this.currentWorkbenchTaskType}-${this.agentPlaybackStepIndex + 1}`;
    this.updateStepStatus(previousStepId, "done");
    this.agentPlaybackStepIndex += 1;
    this.updateStepStatus(step.id, "running");
    this.updateAgentBubble(step.message);
    this.updateToolChip(step.tool, step.final ? step.completeStatus : "using_tool");
    this.setAgentStatus(step.final ? step.completeStatus : "using_tool", step.message);
    if (step.layer) this.revealWorkspaceLayer(step.layer);
    this.moveAgentCursorToTarget(step.target);
    this.clickAgentTarget(step.target);
    this.appendAgentLog(step.message);
    if (this.currentWorkbenchTaskType === "booking") this.browserAutomationEngine.previewAutomation(this.agentPlaybackStepIndex);
    if (this.currentWorkbenchTaskType === "demoToCode" && this.agentPlaybackStepIndex === 0) this.websiteBuildEngine.start(this.currentWorkbenchRequest);
    if (step.final) {
      const timer = window.setTimeout(() => this.completeAgentPlayback({ status: step.completeStatus, tool: step.tool, stepId: step.id }), 520);
      this.workbenchTaskTimers.push(timer);
      return;
    }
    const timer = window.setTimeout(() => this.runNextAgentStep(), this.agentPlaybackProfile.interval);
    this.workbenchTaskTimers.push(timer);
  }

  revealWorkspaceLayer(layerName) {
    const layers = Array.from(this.workbenchTaskCanvas.querySelectorAll(`.${layerName}`));
    layers.forEach((layer, index) => {
      layer.classList.remove("is-pending");
      layer.classList.add("is-building");
      const revealTimer = window.setTimeout(() => {
        layer.classList.add("is-visible");
        const completeTimer = window.setTimeout(() => { layer.classList.remove("is-building"); layer.classList.add("is-complete"); }, 460);
        this.workbenchTaskTimers.push(completeTimer);
      }, layerName === "site-layer-products" ? index * 105 : index * 45);
      this.workbenchTaskTimers.push(revealTimer);
    });
    if (layerName.startsWith("cafe-layer-")) this.design3DEngine?.revealLayer(layerName.replace("cafe-layer-", ""));
    if (layerName === "booking-layer-browser") {
      const address = this.workbenchTaskCanvas.querySelector(".ai-address-bar span");
      if (address) address.textContent = "opening secure preview…";
    }
    if (layerName === "booking-layer-site") {
      const address = this.workbenchTaskCanvas.querySelector(".ai-address-bar");
      if (address) address.innerHTML = '<i class="fa-solid fa-lock"></i><span>vscinemas.com.tw · NOVA Safe Preview</span>';
    }
    if (layerName === "cafe-layer-ready") this.workbenchTaskCanvas.querySelector("[data-3d-viewport]")?.classList.remove("is-playback-locked");
    if (layerName === "site-layer-save") this.workbenchTaskCanvas.querySelectorAll(".site-layer-save").forEach((button) => { button.disabled = false; });
  }

  moveAgentCursorToTarget(targetName) { if (targetName) this.moveCursorTo(targetName); }
  clickAgentTarget(targetName) { if (targetName) this.clickCursorTarget(targetName); }
  updateToolChip(toolName, status) { this.updateToolCall(toolName, status); }

  updateStepStatus(stepId, status) {
    const step = this.workbenchTaskCanvas.querySelector(`[data-step-id="${stepId}"]`);
    if (!step) return;
    step.classList.toggle("is-active", status === "running");
    step.classList.toggle("is-complete", status === "done" || status === "complete");
    step.dataset.status = status;
  }

  completeAgentPlayback(result = {}) {
    if (!this.agentPlaybackActive) return;
    this.agentPlaybackActive = false;
    const lastStep = this.workbenchTaskCanvas.querySelector(".ai-step.is-active");
    lastStep?.classList.remove("is-active");
    lastStep?.classList.add("is-complete");
    const root = this.workbenchTaskCanvas.querySelector(".task-workflow");
    root?.classList.add("is-ready", "is-complete");
    if (this.currentWorkbenchTaskType === "demoToCode") this.websiteBuildEngine.markPreviewReady();
    if (this.currentWorkbenchTaskType === "booking") {
      const confirmation = this.browserAutomationEngine.requestUserConfirmation();
      this.setAgentStatus(confirmation.status, "Waiting for user confirmation");
      this.updateToolChip("BrowserAutomationEngine", "waiting_for_user");
    } else {
      this.setAgentStatus(result.status || "preview_ready", result.status === "done" ? "Preview ready" : "Output preview ready");
      if (result.tool) this.updateToolChip(result.tool, result.status || "done");
    }
    this.appendAgentLog("Agent playback complete");
    if (this.backendLifecycleState === "local_fallback") {
      this.backendTerminalHandled = true;
      this.agentStatusLabel.textContent = result.status === "waiting_for_user" ? "WAITING FOR USER" : "PREVIEW READY";
      this.restoreWorkbenchControls(result.status === "waiting_for_user" ? "waiting_for_user" : "completed");
    }
  }

  runWorkbenchTaskAnimation(taskType) { this.startAgentPlayback(taskType, this.currentWorkbenchRequest); }

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

    this.prepareForNextAgentTask();
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

    this.agentStatusBadge.classList.remove("is-error");
    this.agentStatusLabel.innerText = "AGENT PLANNING";
    this.logFlowEvent("agent:start", { requestId, transport: "sse", fallback: "local_preview" });
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
    this.closeAgentEventSource("overlay_closed");
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

  async returnToNova() {
    if (this.agentOverlay.classList.contains("is-closing")) return;
    const completedRun = ["backend_completed", "backend_waiting_for_user", "local_fallback"].includes(this.backendLifecycleState);
    this.clear041WorkbenchCue();
    this.closeAgentEventSource("return_to_nova");
    await this.hideAgentOverlay();
    if (completedRun) {
      hasCompletedFirstTask = true;
      this.hasCompletedFirstTask = true;
    }
    const recoveryState = hasCompletedFirstTask ? AVATAR_STATES.FINAL_LOOP_043 : AVATAR_STATES.INITIAL_LOOP_040;
    this.resetAgentRunState();
    this.agentErrorText.hidden = true;
    this.agentCompletionText.hidden = true;
    this.agentCloseButton.hidden = true;
    document.body.classList.remove("agent-overlay-preparing", "agent-overlay-open", "agent-overlay-closing");
    this.setInputsDisabled(false);
    this.chatInput.focus();
    if (this.videoAvailable) await this.playState(recoveryState, { loop: true });
  }

  async closeAgentOverlayAfterError() {
    await this.returnToNova();
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
