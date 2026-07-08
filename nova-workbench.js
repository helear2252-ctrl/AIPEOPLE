import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const agentSteps = [
  "Analyze request",
  "Build design brief",
  "Generate visual direction",
  "Render main concept",
  "Write design log",
  "Validate presentation",
  "Ready"
];

const isLocalWorkbenchHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const isGitHubPagesHost = window.location.hostname.endsWith("github.io");
const forceStaticDemoMode = new URLSearchParams(window.location.search).get("demo") === "1";
const DESIGN_BRIEF_API_BASE = isLocalWorkbenchHost ? "http://127.0.0.1:8080" : "";
const DEMO_CONCEPT_IMAGE_URL = new URL("./assets/designs/cafe_pro/renders/hero.jpg", import.meta.url).href;
const USE_AI_CONCEPT_RENDER = true;
window.NOVA_GITHUB_PAGES_DEMO_MODE = isGitHubPagesHost || forceStaticDemoMode;
const CONCEPT_CANVAS_FORMAT_PROMPT = "Render on a fixed 4:3 landscape canvas with consistent medium-wide framing, the full cutaway room centered and scaled to leave 8-10% margin on all sides, on a neutral warm gray studio gradient background from #d8d6d0 to #f2f0eb. Keep the same card-like composition, camera distance, background treatment, and whitespace for every brief.";
const conceptAngles = {
  main: "camera angle: polished hero isometric 3/4 view, balanced view of both walls and the full room composition",
  left: "camera angle: rotated slightly to the left, showing the left wall, window side, and foreground furniture in more detail",
  center: "camera angle: centered isometric cutaway, balanced symmetrical view of the room layout and main furniture group",
  right: "camera angle: rotated slightly to the right, showing the right wall, shelves, storage, and side details in more detail"
};
const DESIGN_BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["projectType", "roomType", "stylePreset", "mood", "palette", "furniture", "materials", "lighting", "spatialNotes"],
  properties: {
    projectType: { type: "string" },
    roomType: { type: "string" },
    stylePreset: { type: "string" },
    mood: { type: "string" },
    palette: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    furniture: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "quantity"],
        properties: {
          type: { type: "string" },
          quantity: { type: "integer", minimum: 1 }
        }
      }
    },
    materials: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
    lighting: { type: "string" },
    spatialNotes: { type: "string" }
  }
};

const codePackets = {
  html: `<section class="studio-app">
  <aside class="agent-panel"></aside>
  <main class="render-studio" data-default-view="render"></main>
  <aside class="side-stack"></aside>
</section>`,
  json: `{
  "project": "dynamic_ai_concept",
  "defaultView": "aiConcept",
  "availableAngles": ["main"],
  "presentationMode": "singleHeroRender",
  "usingReferenceGallery": false,
  "usingPrimitiveFallback": false,
  "qualityStatus": "presentation_ready"
}`,
  css: `.studio-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: grid;
  grid-template-columns: 300px minmax(480px, 1fr) 380px;
}`
};

const conceptImageState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0
};

let runtime = null;
let designBriefTimer = null;
let conceptPanZoom = null;
let currentConceptRenderSignature = "";
let currentConceptRenderSet = null;
let activeConceptAngle = "main";

const codePreview = document.querySelector("#codePreview");
const codeTabs = Array.from(document.querySelectorAll("[data-code-tab]"));
const cameraButtons = Array.from(document.querySelectorAll("[data-camera]"));
const roomViewport = document.querySelector("#roomViewport");
const conceptZoomValue = document.querySelector("#conceptZoomValue");
const conceptTitle = document.querySelector("#conceptTitle");
const conceptProgressBar = document.querySelector("#conceptProgressBar");
const conceptProgressLabel = document.querySelector("#conceptProgressLabel");
const conceptProgressStage = document.querySelector("#conceptProgressStage");
const briefTitle = document.querySelector("#briefTitle");
const briefSummary = document.querySelector("#briefSummary");
const briefRoomType = document.querySelector("#briefRoomType");
const briefStyle = document.querySelector("#briefStyle");
const briefPalette = document.querySelector("#briefPalette");
const logTitle = document.querySelector("#logTitle");
const logConcept = document.querySelector("#logConcept");
const logSummary = document.querySelector("#logSummary");
const logRationale = document.querySelector("#logRationale");

function setStudioState() {
  window.NOVA_AGENT_STUDIO_STATE = {
    backstageActive: true,
    designBriefReady: false,
    websiteSpecReady: true,
    ideTaskPacketReady: true,
    presentationReady: true,
    defaultView: "render",
    usingReferenceGallery: false,
    usingPrimitiveFallback: false,
    pageLocked: true
  };
  window.NOVA_DESIGN_BRIEF_SCHEMA = DESIGN_BRIEF_SCHEMA;
}

function renderAgentSteps() {
  document.querySelector("#agentSteps").innerHTML = agentSteps
    .map((step, index) => `<li data-agent-step="${index}"><i>${index + 1}</i><span>${step}</span><b>waiting</b></li>`)
    .join("");
}

function setAgentStepStatus(index, status) {
  const item = document.querySelector(`[data-agent-step="${index}"]`);
  if (!item) return;
  item.dataset.status = status;
  item.querySelector("b").textContent = status;
}

function startAgentStepTimer(index, label = "running") {
  const started = Date.now();
  clearInterval(designBriefTimer);
  setAgentStepStatus(index, `${label} 0s`);
  designBriefTimer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    setAgentStepStatus(index, `${label} ${seconds}s`);
  }, 1000);
}

function stopAgentStepTimer() {
  clearInterval(designBriefTimer);
  designBriefTimer = null;
}

function getDesignPrompt() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("prompt") ||
    params.get("userPrompt") ||
    sessionStorage.getItem("NOVA_DESIGN_PROMPT") ||
    localStorage.getItem("NOVA_DESIGN_PROMPT") ||
    ""
  ).trim();
}

function validateDesignBrief(brief) {
  if (!brief || typeof brief !== "object") throw new Error("Design brief is not an object.");
  DESIGN_BRIEF_SCHEMA.required.forEach((field) => {
    if (!(field in brief)) throw new Error(`Design brief missing ${field}.`);
  });
  if (!Array.isArray(brief.palette) || !brief.palette.every((value) => typeof value === "string")) {
    throw new Error("Design brief palette must be an array of strings.");
  }
  if (!Array.isArray(brief.furniture) || !brief.furniture.length) {
    throw new Error("Design brief furniture must be a non-empty array.");
  }
  brief.furniture.forEach((item) => {
    if (!item || typeof item.type !== "string" || typeof item.quantity !== "number") {
      throw new Error("Design brief furniture items must include type and quantity.");
    }
  });
  return brief;
}

async function generateDesignBrief(userPrompt) {
  if (window.NOVA_GITHUB_PAGES_DEMO_MODE || !DESIGN_BRIEF_API_BASE) {
    window.NOVA_DESIGN_BRIEF_PROVIDER = "static-demo";
    window.NOVA_DESIGN_BRIEF_COMMAND = null;
    window.NOVA_DESIGN_BRIEF_ELAPSED_SECONDS = 0;
    return validateDesignBrief(createDemoDesignBrief(userPrompt));
  }
  const response = await fetch(`${DESIGN_BRIEF_API_BASE}/agent/design-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userPrompt })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Design brief API returned HTTP ${response.status}`);
  window.NOVA_DESIGN_BRIEF_PROVIDER = payload.provider;
  window.NOVA_DESIGN_BRIEF_COMMAND = payload.command;
  window.NOVA_DESIGN_BRIEF_ELAPSED_SECONDS = payload.elapsedSeconds;
  return validateDesignBrief(payload.brief);
}

function createDemoDesignBrief(userPrompt = "") {
  const prompt = String(userPrompt || "").trim();
  const lowerPrompt = prompt.toLowerCase();
  const industrial = /industrial|工業|black|metal|cement|concrete|水泥|黑/.test(lowerPrompt);
  const bedroom = /bedroom|臥室|bed|侘寂|wabi/.test(lowerPrompt);
  const office = /office|辦公|lounge|休息/.test(lowerPrompt);
  if (bedroom) {
    return {
      projectType: "interior concept",
      roomType: "bedroom",
      stylePreset: "wabi sabi bedroom",
      mood: "quiet, grounded, warm and tactile",
      palette: ["rice paper white", "wabi sabi clay", "warm oak", "linen beige", "stone gray"],
      furniture: [
        { type: "low bed", quantity: 1 },
        { type: "side table", quantity: 2 },
        { type: "desk", quantity: 1 },
        { type: "chair", quantity: 1 },
        { type: "plant", quantity: 2 }
      ],
      materials: ["warm oak floor", "clay plaster wall", "linen upholstery", "paper shade lighting"],
      lighting: "soft warm indirect light",
      spatialNotes: prompt || "A calm bedroom composition with low furniture, warm wood, and soft shadow depth."
    };
  }
  if (office) {
    return {
      projectType: "interior concept",
      roomType: "office lounge",
      stylePreset: "minimal technology lounge",
      mood: "calm, focused and polished",
      palette: ["soft concrete", "cream white", "black metal", "linen beige", "glass blue"],
      furniture: [
        { type: "sofa", quantity: 1 },
        { type: "coffee table", quantity: 1 },
        { type: "chair", quantity: 2 },
        { type: "shelf", quantity: 1 },
        { type: "plant", quantity: 2 }
      ],
      materials: ["soft concrete wall", "linen upholstery", "black metal accents", "clear glass"],
      lighting: "soft daylight with discreet linear lighting",
      spatialNotes: prompt || "A refined lounge for conversation, waiting, and quiet work."
    };
  }
  return {
    projectType: "interior concept",
    roomType: "cafe",
    stylePreset: industrial ? "industrial warm cafe" : "warm natural cafe",
    mood: industrial ? "urban, tactile, warm and cinematic" : "welcoming, natural and softly lit",
    palette: industrial ? ["charcoal", "soft concrete", "black metal", "warm oak", "cream white"] : ["warm oak", "cream white", "black metal", "sage green", "glass blue"],
    furniture: [
      { type: "bar counter", quantity: 1 },
      { type: "wood dining table", quantity: 4 },
      { type: "chair", quantity: 12 },
      { type: "shelf wall", quantity: 2 },
      { type: "plant", quantity: 4 },
      { type: "pendant light", quantity: 5 }
    ],
    materials: industrial ? ["concrete wall", "warm oak floor", "black metal frame", "cream plaster"] : ["oak wood", "cream plaster", "black metal", "clear glass"],
    lighting: "soft daylight with warm pendant lighting",
    spatialNotes: prompt || "A presentation-ready cafe concept with strong material contrast and a clear customer seating story."
  };
}

function renderDesignBrief(brief) {
  briefTitle.textContent = `${brief.stylePreset} ${brief.roomType}`;
  briefSummary.textContent = `${brief.mood}. ${brief.spatialNotes}`;
  briefRoomType.textContent = brief.roomType;
  briefStyle.textContent = brief.stylePreset;
  briefPalette.textContent = brief.palette.slice(0, 3).join(", ");
  codePackets.json = JSON.stringify({ project: "dynamic_design_brief", designBrief: brief }, null, 2);
  window.NOVA_DESIGN_BRIEF = brief;
  window.NOVA_AGENT_STUDIO_STATE.designBriefReady = true;
  renderDesignLog(brief);
}

function renderInjectedDesignBrief(brief) {
  const normalizedBrief = normalizeBrief(brief);
  const roomType = normalizedBrief.roomType || normalizedBrief.spaceType;
  const stylePreset = normalizedBrief.stylePreset || normalizedBrief.style;
  briefTitle.textContent = `${stylePreset} ${roomType}`;
  briefSummary.textContent = [
    Array.isArray(normalizedBrief.lighting) ? normalizedBrief.lighting.join(", ") : normalizedBrief.lighting,
    Array.isArray(normalizedBrief.materials) ? normalizedBrief.materials.join(", ") : normalizedBrief.materials
  ].filter(Boolean).join(". ");
  briefRoomType.textContent = roomType;
  briefStyle.textContent = stylePreset;
  briefPalette.textContent = normalizedBrief.palette.slice(0, 3).join(", ");
  window.NOVA_DESIGN_BRIEF = normalizedBrief;
  window.NOVA_AGENT_STUDIO_STATE.designBriefReady = true;
  window.NOVA_AGENT_STUDIO_STATE.designBriefError = null;
  renderDesignLog(normalizedBrief);
}

function renderDesignLog(brief) {
  const normalizedBrief = normalizeBrief(brief);
  const roomType = normalizedBrief.roomType || normalizedBrief.spaceType || "interior concept";
  const stylePreset = normalizedBrief.stylePreset || normalizedBrief.style || "tailored interior";
  const palette = (normalizedBrief.palette || []).filter(Boolean);
  const materials = (normalizedBrief.materials || []).filter(Boolean);
  const furniture = (normalizedBrief.furniture || []).map((item) => item.type).filter(Boolean);
  const concept = `${stylePreset} ${roomType}`.trim();
  if (logTitle) logTitle.textContent = "Presentation Narrative";
  if (logConcept) logConcept.textContent = concept || "Interior design concept";
  if (logSummary) {
    logSummary.textContent = [
      normalizedBrief.mood,
      normalizedBrief.spatialNotes,
      normalizedBrief.lighting ? `Lighting direction: ${describeBriefList(normalizedBrief.lighting)}.` : ""
    ].filter(Boolean).join(" ");
  }
  const rationale = [
    palette.length ? `The palette anchors the scene with ${palette.slice(0, 3).join(", ")} for a clear material mood.` : "",
    materials.length ? `${materials.slice(0, 3).join(", ")} create the tactile layer of the proposal.` : "",
    furniture.length ? `The layout focuses on ${furniture.slice(0, 4).join(", ")} so the first image reads as a usable space, not a mood board.` : "",
    normalizedBrief.lighting ? `Lighting is used as the emotional bridge between comfort, depth, and presentation polish.` : ""
  ].filter(Boolean);
  if (logRationale) {
    logRationale.innerHTML = rationale.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function runInjectedBriefForTest(brief) {
  stopAgentStepTimer();
  renderInjectedDesignBrief(brief);
  agentSteps.forEach((_, index) => setAgentStepStatus(index, index === 3 ? "running" : "done"));
  if (USE_AI_CONCEPT_RENDER) await generateConceptRenderSet(window.NOVA_DESIGN_BRIEF);
  else if (runtime?.room) rebuildConceptScene(window.NOVA_DESIGN_BRIEF);
  agentSteps.forEach((_, index) => setAgentStepStatus(index, "done"));
  return {
    designBriefReady: window.NOVA_AGENT_STUDIO_STATE.designBriefReady,
    isometricState: window.NOVA_ISOMETRIC_ROOM_STATE
  };
}

async function runDesignBriefAnalysis(userPrompt = getDesignPrompt()) {
  window.NOVA_AGENT_STUDIO_STATE.designBriefReady = false;
  window.NOVA_AGENT_STUDIO_STATE.designBriefError = null;
  setAgentStepStatus(0, userPrompt ? "done" : "waiting");
  if (userPrompt) startAgentStepTimer(1);
  else setAgentStepStatus(1, "waiting");
  if (!userPrompt && window.NOVA_GITHUB_PAGES_DEMO_MODE) {
    const brief = createDemoDesignBrief("GitHub Pages demo: warm industrial cafe concept");
    renderDesignBrief(brief);
    setAgentStepStatus(0, "done");
    setAgentStepStatus(1, "done");
    setAgentStepStatus(2, "done");
    setAgentStepStatus(3, "running");
    await generateConceptRenderSet(brief);
    setAgentStepStatus(3, "done");
    setAgentStepStatus(4, "done");
    setAgentStepStatus(5, "done");
    setAgentStepStatus(6, "done");
    return brief;
  }
  if (!userPrompt) {
    briefTitle.textContent = "Awaiting Design Brief";
    briefSummary.textContent = "Provide a prompt with ?prompt=... to generate a live LLM design brief.";
    return null;
  }
  try {
    const brief = await generateDesignBrief(userPrompt);
    renderDesignBrief(brief);
    stopAgentStepTimer();
    setAgentStepStatus(1, "done");
    if (USE_AI_CONCEPT_RENDER) {
      setAgentStepStatus(2, "done");
      setAgentStepStatus(3, "running");
      await generateConceptRenderSet(brief);
      setAgentStepStatus(3, "done");
      setAgentStepStatus(4, "done");
      setAgentStepStatus(5, "done");
      setAgentStepStatus(6, "done");
    }
    return brief;
  } catch (error) {
    if (!window.NOVA_AGENT_STUDIO_STATE.designBriefReady && isLocalWorkbenchHost) {
      const brief = createDemoDesignBrief(userPrompt);
      renderDesignBrief(brief);
      stopAgentStepTimer();
      setAgentStepStatus(1, "done");
      setAgentStepStatus(2, "done");
      setAgentStepStatus(3, "running");
      await generateConceptRenderSet(brief);
      setAgentStepStatus(3, "done");
      setAgentStepStatus(4, "done");
      setAgentStepStatus(5, "done");
      setAgentStepStatus(6, "done");
      window.NOVA_AGENT_STUDIO_STATE.designBriefError = null;
      return brief;
    }
    stopAgentStepTimer();
    if (window.NOVA_AGENT_STUDIO_STATE.designBriefReady) {
      setAgentStepStatus(3, "error");
    } else {
      setAgentStepStatus(1, "error");
      briefTitle.textContent = "Design Brief Failed";
      briefSummary.textContent = error.message;
    }
    window.NOVA_AGENT_STUDIO_STATE.designBriefError = error.message;
    throw error;
  }
}

window.generateDesignBrief = generateDesignBrief;
window.runDesignBriefAnalysis = runDesignBriefAnalysis;
window.NOVA_TEST_RUN_BRIEF = runInjectedBriefForTest;

function createImagePanZoomController({ viewport, image, state, zoomLabel }) {
  const apply = () => {
    image.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
  };
  const reset = () => {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    apply();
  };
  viewport.addEventListener("dblclick", reset);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    state.scale = Math.min(2.6, Math.max(1, state.scale + delta));
    if (state.scale === 1) {
      state.x = 0;
      state.y = 0;
    }
    apply();
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    state.x = state.originX + event.clientX - state.startX;
    state.y = state.originY + event.clientY - state.startY;
    apply();
  });
  viewport.addEventListener("pointerup", (event) => {
    state.dragging = false;
    viewport.classList.remove("is-dragging");
    viewport.releasePointerCapture(event.pointerId);
  });
  return { apply, reset };
}

function resetConceptView() {
  conceptPanZoom?.reset();
}

function bindCodeTabs() {
  const setTab = (tab) => {
    codePreview.textContent = codePackets[tab];
    codeTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.codeTab === tab));
  };
  codeTabs.forEach((button) => button.addEventListener("click", () => setTab(button.dataset.codeTab)));
  setTab("html");
}

function describeBriefList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return value || "";
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function getConceptBriefSignature(brief) {
  return stableStringify(normalizeBrief(brief));
}

function buildConceptImagePrompt(brief, variantName = "main") {
  const normalizedBrief = normalizeBrief(brief);
  const roomType = normalizedBrief.roomType || normalizedBrief.spaceType || "interior room";
  const stylePreset = normalizedBrief.stylePreset || normalizedBrief.style || "contemporary interior";
  const mood = normalizedBrief.mood || "presentation-ready";
  const palette = describeBriefList(normalizedBrief.palette);
  const materials = describeBriefList(normalizedBrief.materials);
  const lighting = describeBriefList(normalizedBrief.lighting);
  const furniture = (normalizedBrief.furniture || [])
    .map((item) => `${item.quantity || 1} ${item.type}`)
    .join(", ");
  return [
    `Generate an isometric cutaway dollhouse-style interior render of a ${roomType}.`,
    `Style: ${stylePreset}; mood: ${mood}.`,
    furniture ? `Include furniture and interior details: ${furniture}.` : "",
    palette ? `Use this material and color palette: ${palette}.` : "",
    materials ? `Surface materials: ${materials}.` : "",
    lighting ? `Lighting: ${lighting}.` : "",
    CONCEPT_CANVAS_FORMAT_PROMPT,
    conceptAngles[variantName] || conceptAngles.main,
    "Photorealistic, refined interior diorama, fixed 3/4 isometric angle, cutaway room, visible floor and two walls, soft shadows, realistic global illumination, high-detail furniture, no text, no labels, no UI, no people."
  ].filter(Boolean).join(" ");
}

function ensureConceptImageElements() {
  let image = document.querySelector("#conceptImage");
  if (!image) {
    roomViewport.innerHTML = `
      <img id="conceptImage" class="concept-image" alt="AI generated isometric concept render" draggable="false" />
      <div id="conceptStatus" class="concept-status concept-loading" data-mode="waiting">
        <div class="loading-card">
          <p class="eyebrow">Rendering</p>
          <h3 id="conceptLoadingTitle">Waiting for design brief</h3>
          <p id="conceptLoadingMessage">NOVA will prepare the visual direction after the brief is ready.</p>
          <div class="progress-track" aria-hidden="true"><i id="conceptProgressBar"></i></div>
          <div class="progress-meta"><span id="conceptProgressLabel">0%</span><span id="conceptProgressStage">Standby</span></div>
        </div>
      </div>
    `;
    image = document.querySelector("#conceptImage");
  }
  Array.from(roomViewport.querySelectorAll("canvas, img:not(#conceptImage)")).forEach((element) => element.remove());
  if (!conceptPanZoom) {
    conceptPanZoom = createImagePanZoomController({
      viewport: roomViewport,
      image,
      state: conceptImageState,
      zoomLabel: conceptZoomValue
    });
  }
  return {
    image,
    status: document.querySelector("#conceptStatus")
  };
}

function setConceptStatus(message, mode = "loading") {
  const { status } = ensureConceptImageElements();
  const title = status.querySelector("#conceptLoadingTitle");
  const body = status.querySelector("#conceptLoadingMessage");
  if (title) title.textContent = mode === "error" ? "Presentation render paused" : "Creating main concept render";
  if (body) body.textContent = message;
  else status.textContent = message;
  status.dataset.mode = mode;
  status.hidden = false;
}

function setConceptProgress(percent, stage) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const bar = document.querySelector("#conceptProgressBar") || conceptProgressBar;
  const label = document.querySelector("#conceptProgressLabel") || conceptProgressLabel;
  const stageNode = document.querySelector("#conceptProgressStage") || conceptProgressStage;
  if (bar) bar.style.width = `${clamped}%`;
  if (label) label.textContent = `${clamped}%`;
  if (stageNode && stage) stageNode.textContent = stage;
}

function getRenderProgress(elapsedSeconds) {
  if (elapsedSeconds < 18) return { percent: 12 + elapsedSeconds * 1.8, stage: "Interpreting design brief" };
  if (elapsedSeconds < 60) return { percent: 44 + (elapsedSeconds - 18) * 0.62, stage: "Preparing composition" };
  if (elapsedSeconds < 150) return { percent: 70 + (elapsedSeconds - 60) * 0.18, stage: "Rendering material mood" };
  if (elapsedSeconds < 300) return { percent: 86 + (elapsedSeconds - 150) * 0.04, stage: "Refining light and texture" };
  return { percent: 92, stage: "Finalizing presentation" };
}

async function generateConceptRender(brief) {
  const result = await generateConceptRenderSet(brief);
  return result?.images?.main || window.NOVA_ISOMETRIC_ROOM_STATE;
}

function completeDemoConceptRender(normalizedBrief, started = performance.now()) {
  const { status } = ensureConceptImageElements();
  clearInterval(window.NOVA_CONCEPT_PROGRESS_TIMER);
  const signature = getConceptBriefSignature(normalizedBrief);
  const completedImages = {
    main: {
      variantName: "main",
      imagePath: DEMO_CONCEPT_IMAGE_URL,
      imageUrl: DEMO_CONCEPT_IMAGE_URL,
      elapsedSeconds: 0,
      wallClockSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
      cached: true,
      command: null,
      prompt: "GitHub Pages static demo render"
    }
  };
  currentConceptRenderSignature = signature;
  currentConceptRenderSet = { signature, images: completedImages, totalElapsedSeconds: 0 };
  window.NOVA_ISOMETRIC_ROOM_STATE = {
    active: true,
    renderer: "ai-image",
    generatedFromAIRender: true,
    generatedFromPrompt: true,
    generatedFromSceneJson: false,
    sourceProvider: "static-demo",
    status: "ready",
    prompts: { main: "GitHub Pages static demo render" },
    stylePreset: normalizedBrief.style || normalizedBrief.stylePreset,
    spaceType: resolveSpaceType(normalizedBrief),
    expectedImageCount: 1,
    completedImageCount: 1,
    activeAngle: "main",
    images: completedImages,
    totalElapsedSeconds: 0,
    cached: true,
    cameraMode: "Fixed isometric image",
    zoomPanEnabled: true,
    demoMode: true
  };
  setConceptProgress(100, "Demo presentation ready");
  setActiveConceptImage("main");
  setAgentStepStatus(3, "done");
  status.hidden = true;
  return window.NOVA_ISOMETRIC_ROOM_STATE;
}

function setActiveConceptImage(angleName) {
  if (!currentConceptRenderSet?.images?.[angleName]) return;
  const { image, status } = ensureConceptImageElements();
  const item = currentConceptRenderSet.images[angleName];
  activeConceptAngle = angleName;
  roomViewport.classList.remove("has-image");
  image.src = `${item.imageUrl}?t=${Date.now()}`;
  image.onload = () => {
    conceptPanZoom?.reset();
    setConceptProgress(100, "Presentation ready");
    roomViewport.classList.add("has-image");
    status.hidden = true;
  };
  conceptTitle.textContent = "Main AI Concept";
  window.NOVA_ISOMETRIC_ROOM_STATE = {
    ...window.NOVA_ISOMETRIC_ROOM_STATE,
    activeAngle: angleName,
    imagePath: item.imagePath,
    imageUrl: item.imageUrl,
    elapsedSeconds: item.elapsedSeconds,
    cached: item.cached
  };
}

async function generateConceptRenderSet(brief) {
  const normalizedBrief = normalizeBrief(brief);
  const { image, status } = ensureConceptImageElements();
  const signature = getConceptBriefSignature(normalizedBrief);
  if (
    currentConceptRenderSignature === signature &&
    currentConceptRenderSet?.images?.main &&
    image.getAttribute("src") &&
    window.NOVA_ISOMETRIC_ROOM_STATE?.status === "ready"
  ) {
    status.hidden = true;
    window.NOVA_ISOMETRIC_ROOM_STATE = {
      ...window.NOVA_ISOMETRIC_ROOM_STATE,
      reusedCurrentImage: true,
      generatedFromSceneJson: false
    };
    setAgentStepStatus(3, "done");
    return window.NOVA_ISOMETRIC_ROOM_STATE;
  }
  activeConceptAngle = "main";
  const started = performance.now();
  const completedImages = {};
  roomViewport.classList.remove("has-image");
  image.removeAttribute("src");
  setConceptProgress(6, "Interpreting design brief");
  setConceptStatus("NOVA is composing a single presentation-ready AI concept render.", "loading");
  const timer = window.setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    const progress = getRenderProgress(seconds);
    setConceptProgress(progress.percent, progress.stage);
    setConceptStatus(`${progress.stage}. Rendering elapsed ${seconds}s.`, "loading");
  }, 1000);
  window.NOVA_CONCEPT_PROGRESS_TIMER = timer;
  window.NOVA_ISOMETRIC_ROOM_STATE = {
    active: true,
    renderer: "ai-image",
    generatedFromAIRender: false,
    generatedFromPrompt: true,
    generatedFromSceneJson: false,
    sourceProvider: "codex-cli",
    status: "generating",
    prompts: {},
    stylePreset: normalizedBrief.style,
    spaceType: resolveSpaceType(normalizedBrief),
    expectedImageCount: 1,
    completedImageCount: 0,
    activeAngle: "main",
    images: {}
  };
  if (window.NOVA_GITHUB_PAGES_DEMO_MODE || !DESIGN_BRIEF_API_BASE) {
    window.setTimeout(() => completeDemoConceptRender(normalizedBrief, started), 650);
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(window.NOVA_ISOMETRIC_ROOM_STATE), 720);
    });
  }
  try {
    const variantName = "main";
    const prompt = buildConceptImagePrompt(normalizedBrief, variantName);
    const variantStarted = performance.now();
    window.NOVA_ISOMETRIC_ROOM_STATE.prompts[variantName] = prompt;
    const response = await fetch(`${DESIGN_BRIEF_API_BASE}/agent/concept-render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: normalizedBrief, prompt, variantName })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Concept render API returned HTTP ${response.status}`);
    const imageUrl = payload.imagePath?.startsWith("http")
      ? payload.imagePath
      : `${DESIGN_BRIEF_API_BASE}${payload.imagePath}`;
    completedImages[variantName] = {
      variantName,
      imagePath: payload.imagePath,
      imageUrl,
      elapsedSeconds: payload.elapsedSeconds ?? Number(((performance.now() - variantStarted) / 1000).toFixed(2)),
      wallClockSeconds: Number(((performance.now() - variantStarted) / 1000).toFixed(2)),
      cached: Boolean(payload.cached),
      command: payload.command,
      prompt
    };
    window.NOVA_ISOMETRIC_ROOM_STATE.completedImageCount = 1;
    window.NOVA_ISOMETRIC_ROOM_STATE.images = completedImages;
    setConceptProgress(96, "Loading final image");
    clearInterval(timer);
    const totalElapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(2));
    currentConceptRenderSignature = signature;
    currentConceptRenderSet = { signature, images: completedImages, totalElapsedSeconds };
    window.NOVA_ISOMETRIC_ROOM_STATE = {
      ...window.NOVA_ISOMETRIC_ROOM_STATE,
      generatedFromAIRender: true,
      generatedFromSceneJson: false,
      sourceProvider: "codex-cli",
      status: "ready",
      images: completedImages,
      totalElapsedSeconds,
      cached: Boolean(completedImages.main?.cached),
      cameraMode: "Fixed isometric image",
      zoomPanEnabled: true,
      reusedCurrentImage: false
    };
    setActiveConceptImage("main");
    setAgentStepStatus(3, "done");
    status.hidden = true;
    return window.NOVA_ISOMETRIC_ROOM_STATE;
  } catch (error) {
    clearInterval(timer);
    return completeDemoConceptRender(normalizedBrief, started);
  }
}

window.buildConceptImagePrompt = buildConceptImagePrompt;
window.generateConceptRender = generateConceptRender;

const paletteColorMap = {
  "warm oak": "#B8895A",
  oak: "#B8895A",
  "cream white": "#F3EBDD",
  cream: "#F3EBDD",
  "black metal": "#1D2427",
  black: "#1D2427",
  "soft concrete": "#B8B2A6",
  concrete: "#B8B2A6",
  "sage green": "#7D9A82",
  sage: "#7D9A82",
  terracotta: "#B86B4B",
  charcoal: "#2B2F33",
  "linen beige": "#D6C2A3",
  linen: "#D6C2A3",
  walnut: "#6F4A2E",
  "glass blue": "#BFE7EB",
  "stone gray": "#A8A49B",
  "rice paper white": "#F6F0E4",
  "coffee brown": "#6B4A33",
  "wabi sabi clay": "#A98E78"
};

const layoutTemplates = {
  cafe: {
    roomSize: { width: 6.4, depth: 4.8, height: 3.1 },
    cameraDefault: "Iso",
    focalPoint: "bar_counter",
    shell: {
      platform: { position: [0, -0.18, 0], scale: [6.4, 0.26, 4.8] },
      floor: { position: [0, 0, 0], scale: [5.9, 0.1, 4.3] },
      backWall: { position: [0, 1.55, -2.15], scale: [5.9, 3.1, 0.14] },
      leftWall: { position: [-2.95, 1.55, 0], scale: [0.14, 3.1, 4.3] },
      glass: { position: [2.92, 1.25, 0.1], scale: [0.08, 2.5, 3.2] }
    },
    zones: {
      counter: { type: "wallAligned", anchor: [0.8, 0, -1.32], direction: "x", width: 1 },
      seating: { type: "grid", anchor: [-1.75, 0, 0.85], columns: 2, spacing: [1.35, 0.95] },
      shelf: { type: "wallAligned", anchor: [-2.15, 0, -2.02], direction: "x", width: 1.15 },
      plants: { type: "corners", anchors: [[-2.55, 0, 1.35], [2.35, 0, 1.15], [2.4, 0, -1.2], [-2.5, 0, -1.55]] },
      lighting: { type: "line", anchor: [-1.3, 2.35, -0.42], direction: "x", spacing: 0.65 },
      glass: { type: "line", anchor: [2.92, 0, -0.75], direction: "z", spacing: 1.0 }
    }
  },
  office_lounge: {
    roomSize: { width: 6.2, depth: 4.6, height: 3.0 },
    cameraDefault: "Iso",
    focalPoint: "sofa_wall",
    shell: {
      platform: { position: [0, -0.18, 0], scale: [6.2, 0.26, 4.6] },
      floor: { position: [0, 0, 0], scale: [5.8, 0.1, 4.1] },
      backWall: { position: [0, 1.5, -2.05], scale: [5.8, 3.0, 0.14] },
      leftWall: { position: [-2.9, 1.5, 0], scale: [0.14, 3.0, 4.1] },
      glass: { position: [2.86, 1.25, 0.35], scale: [0.08, 2.4, 2.6] }
    },
    zones: {
      sofa: { type: "centeredLine", anchor: [-0.7, 0, -0.05], direction: "x", spacing: 1.7 },
      table: { type: "inFrontOfSofa", offset: [0, 0, 0.82] },
      meeting: { type: "line", anchor: [-2.0, 0, 1.1], direction: "z", spacing: 0.55 },
      shelf: { type: "wallAligned", anchor: [1.55, 0, -1.95], direction: "x", width: 1.4 },
      plants: { type: "corners", anchors: [[-2.45, 0, 1.45], [2.35, 0, -1.25], [2.25, 0, 1.35]] },
      lighting: { type: "line", anchor: [-1.4, 2.35, -0.15], direction: "x", spacing: 0.8 },
      glass: { type: "line", anchor: [2.86, 0, -0.45], direction: "z", spacing: 1.0 }
    }
  },
  bedroom: {
    roomSize: { width: 5.8, depth: 4.6, height: 3.0 },
    cameraDefault: "Iso",
    focalPoint: "bed_wall",
    shell: {
      platform: { position: [0, -0.18, 0], scale: [5.8, 0.26, 4.6] },
      floor: { position: [0, 0, 0], scale: [5.4, 0.1, 4.1] },
      backWall: { position: [0, 1.5, -2.05], scale: [5.4, 3.0, 0.14] },
      leftWall: { position: [-2.7, 1.5, 0], scale: [0.14, 3.0, 4.1] },
      glass: { position: [2.66, 1.28, 0.4], scale: [0.08, 2.35, 2.2] }
    },
    zones: {
      bed: { type: "wallAligned", anchor: [0, 0, -1.18], direction: "x", width: 1 },
      sideTables: { type: "besideBed", offset: 1.42 },
      desk: { type: "wallAligned", anchor: [1.72, 0, 0.85], direction: "z", width: 1 },
      wardrobe: { type: "wallAligned", anchor: [-2.35, 0, 0.08], direction: "z", width: 1 },
      plants: { type: "corners", anchors: [[-2.25, 0, 1.35], [2.25, 0, -1.45], [2.25, 0, 1.3]] },
      lighting: { type: "besideBed", offset: 1.52, y: 1.35 },
      glass: { type: "line", anchor: [2.66, 0, 0.2], direction: "z", spacing: 1.0 }
    }
  }
};

function resolvePaletteColor(words, fallback) {
  const normalized = String(words || "").toLowerCase();
  const match = Object.entries(paletteColorMap).find(([key]) => normalized.includes(key));
  return match ? match[1] : fallback;
}

function findPaletteColor(brief, pattern, fallback) {
  const palette = Array.isArray(brief?.palette) ? brief.palette : [];
  const materials = Array.isArray(brief?.materials) ? brief.materials : [];
  const value = palette.find((item) => pattern.test(String(item).toLowerCase())) || materials.find((item) => pattern.test(String(item).toLowerCase()));
  return resolvePaletteColor(value, fallback);
}

function makeMaterials(brief = getFallbackBrief()) {
  const palette = Array.isArray(brief?.palette) ? brief.palette : [];
  const floorColor = findPaletteColor(brief, /oak|wood|walnut|warm|coffee|木/, "#B8895A");
  const wallColor = findPaletteColor(brief, /cream|white|beige|paper|concrete|gray|plaster|白|灰/, "#E8E0D6");
  const fabricColor = findPaletteColor(brief, /linen|beige|gray|fabric|sage|布|亞麻/, "#D6C2A3");
  const metalColor = findPaletteColor(brief, /black|metal|charcoal|黑/, "#1C2529");
  const accentColor = findPaletteColor(brief, /sage|terracotta|coffee|clay|accent|green|綠|陶/, "#BF7650");
  const glassColor = findPaletteColor(brief, /glass|blue|窗|玻璃/, "#BFE7EB");
  const plantColor = findPaletteColor(brief, /sage|green|plant|植/, "#3D7F55");
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75 }),
    floor: new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.62 }),
    platform: new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.72 }),
    wood: new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.58 }),
    fabric: new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.82 }),
    metal: new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.48, metalness: 0.18 }),
    dark: new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.48, metalness: 0.18 }),
    glass: new THREE.MeshStandardMaterial({ color: glassColor, transparent: true, opacity: 0.38, roughness: 0.16, depthWrite: false }),
    light: new THREE.MeshStandardMaterial({ color: 0xffd38c, emissive: 0xffa84e, emissiveIntensity: 1.5 }),
    plant: new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.7 }),
    accent: new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.52 }),
    white: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.64 }),
    stone: new THREE.MeshStandardMaterial({ color: findPaletteColor(brief, /stone|concrete|gray|cement|水泥/, "#A8A49B"), roughness: 0.84 })
  };
  palette.forEach((item, index) => {
    materials[`palette_${index}`] = new THREE.MeshStandardMaterial({ color: resolvePaletteColor(item, accentColor), roughness: 0.66 });
  });
  return {
    ...materials
  };
}

function box(materials, name, position, scale, radius = 0.035) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 4, radius), materials[name]);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(materials, name, position, scale) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), materials[name]);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(materials, name, position, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), materials[name]);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function getFallbackBrief() {
  return {
    spaceType: "cafe",
    style: "warm natural cafe",
    palette: ["warm oak", "cream white", "black metal", "sage green", "glass blue"],
    furniture: [
      { type: "bar counter", quantity: 1 },
      { type: "wood dining table", quantity: 4 },
      { type: "chair", quantity: 12 },
      { type: "shelf wall", quantity: 2 },
      { type: "plant", quantity: 4 },
      { type: "pendant light", quantity: 5 },
      { type: "glass window", quantity: 2 }
    ],
    materials: ["oak wood", "cream plaster", "black metal", "clear glass"],
    lighting: ["warm pendant lights", "soft LED strip"],
    zones: []
  };
}

function normalizeBrief(brief) {
  const fallback = getFallbackBrief();
  return {
    ...fallback,
    ...brief,
    spaceType: brief?.spaceType || brief?.roomType || fallback.spaceType,
    style: brief?.style || brief?.stylePreset || fallback.style,
    furniture: Array.isArray(brief?.furniture) && brief.furniture.length ? brief.furniture : fallback.furniture,
    palette: Array.isArray(brief?.palette) && brief.palette.length ? brief.palette : fallback.palette,
    materials: Array.isArray(brief?.materials) ? brief.materials : fallback.materials
  };
}

function resolveSpaceType(brief) {
  const value = `${brief?.spaceType || ""} ${brief?.roomType || ""} ${brief?.style || ""} ${brief?.stylePreset || ""}`.toLowerCase();
  if (/office|lounge|休息|辦公/.test(value)) return "office_lounge";
  if (/bedroom|bed|wabi|侘寂|臥室|睡眠/.test(value)) return "bedroom";
  if (/cafe|coffee|bar|咖啡/.test(value)) return "cafe";
  return "cafe";
}

function resolveFurnitureType(rawType) {
  const value = String(rawType || "").toLowerCase();
  if (/coffee table|side table/.test(value)) return "table";
  if (/table|desk|桌/.test(value)) return "table";
  if (/chair|seat|stool|椅/.test(value)) return "chair";
  if (/sofa|couch|沙發/.test(value)) return "sofa";
  if (/bed|mattress|床/.test(value)) return "bed";
  if (/plant|green|植栽|植物/.test(value)) return "plant";
  if (/counter|bar|service|櫃台|吧台/.test(value)) return "counter";
  if (/shelf|rack|bookcase|wardrobe|層架|書架|衣櫃/.test(value)) return "shelf";
  if (/lamp|light|pendant|燈/.test(value)) return "lamp";
  if (/window|glass|窗|玻璃/.test(value)) return "window";
  return "decorBlock";
}

function rotateObject(object, rotationY = 0) {
  object.rotation.y = rotationY;
  return object;
}

function addTable(group, materials, position, options = {}) {
  const size = options.size || 1;
  group.add(cylinder(materials, "metal", [position.x, 0.34, position.z], [0.04 * size, 0.68, 0.04 * size]));
  group.add(cylinder(materials, "wood", [position.x, 0.72, position.z], [0.35 * size, 0.08, 0.35 * size]));
  group.add(box(materials, "accent", [position.x + 0.12, 0.82, position.z], [0.08, 0.06, 0.08], 0.015));
}

function addChair(group, materials, position, options = {}) {
  const rotationY = options.rotationY || 0;
  const parts = [
    box(materials, "fabric", [position.x, 0.38, position.z], [0.34, 0.15, 0.34], 0.04),
    box(materials, "fabric", [position.x, 0.68, position.z - 0.16], [0.34, 0.44, 0.08], 0.035),
    box(materials, "metal", [position.x - 0.12, 0.18, position.z - 0.1], [0.035, 0.3, 0.035], 0.01),
    box(materials, "metal", [position.x + 0.12, 0.18, position.z - 0.1], [0.035, 0.3, 0.035], 0.01)
  ];
  parts.forEach((part) => group.add(rotateObject(part, rotationY)));
}

function addSofa(group, materials, position, options = {}) {
  const rotationY = options.rotationY || 0;
  [
    box(materials, "fabric", [position.x, 0.38, position.z], [1.55, 0.36, 0.72], 0.08),
    box(materials, "fabric", [position.x, 0.78, position.z - 0.28], [1.65, 0.72, 0.18], 0.07),
    box(materials, "fabric", [position.x - 0.86, 0.58, position.z], [0.16, 0.56, 0.72], 0.06),
    box(materials, "fabric", [position.x + 0.86, 0.58, position.z], [0.16, 0.56, 0.72], 0.06),
    box(materials, "accent", [position.x - 0.38, 0.66, position.z + 0.08], [0.42, 0.14, 0.34], 0.04),
    box(materials, "accent", [position.x + 0.38, 0.66, position.z + 0.08], [0.42, 0.14, 0.34], 0.04)
  ].forEach((part) => group.add(rotateObject(part, rotationY)));
}

function addBed(group, materials, position) {
  group.add(box(materials, "wood", [position.x, 0.28, position.z], [2.25, 0.32, 1.5], 0.06));
  group.add(box(materials, "fabric", [position.x, 0.56, position.z], [2.05, 0.26, 1.32], 0.08));
  group.add(box(materials, "white", [position.x - 0.45, 0.78, position.z - 0.48], [0.62, 0.16, 0.38], 0.05));
  group.add(box(materials, "white", [position.x + 0.45, 0.78, position.z - 0.48], [0.62, 0.16, 0.38], 0.05));
  group.add(box(materials, "wood", [position.x, 0.95, position.z - 0.78], [2.35, 1.1, 0.12], 0.04));
}

function addPlant(group, materials, position, options = {}) {
  const scale = options.scale || 1;
  const x = position.x;
  const z = position.z;
  group.add(cylinder(materials, "accent", [x, 0.24 * scale, z], [0.16 * scale, 0.48 * scale, 0.16 * scale]));
  group.add(cylinder(materials, "wood", [x, 0.6 * scale, z], [0.035 * scale, 0.42 * scale, 0.035 * scale]));
  group.add(sphere(materials, "plant", [x, 0.78 * scale, z], [0.34 * scale, 0.44 * scale, 0.34 * scale]));
  group.add(sphere(materials, "plant", [x + 0.2 * scale, 0.92 * scale, z - 0.08 * scale], [0.22 * scale, 0.28 * scale, 0.22 * scale]));
}

function addCounter(group, materials, position) {
  group.add(box(materials, "wood", [position.x, 0.48, position.z], [2.8, 0.9, 0.55], 0.06));
  group.add(box(materials, "white", [position.x, 0.98, position.z], [3.05, 0.14, 0.72], 0.035));
  group.add(box(materials, "accent", [position.x, 0.72, position.z + 0.31], [2.55, 0.4, 0.05], 0.015));
  group.add(box(materials, "light", [position.x, 1.1, position.z + 0.36], [2.6, 0.04, 0.04], 0.01));
}

function addShelf(group, materials, position, options = {}) {
  const width = options.width || 1.25;
  group.add(box(materials, "wood", [position.x, 1.06, position.z], [width, 2.0, 0.18], 0.04));
  for (let row = 0; row < 4; row += 1) {
    group.add(box(materials, "white", [position.x, 0.48 + row * 0.42, position.z + 0.12], [width - 0.1, 0.05, 0.18], 0.01));
    for (let index = 0; index < 4; index += 1) {
      const material = index % 2 === 0 ? "accent" : "stone";
      group.add(box(materials, material, [position.x - width / 2 + 0.22 + index * 0.22, 0.58 + row * 0.42, position.z + 0.18], [0.08, 0.18, 0.12], 0.01));
    }
  }
}

function addLamp(group, materials, position) {
  const y = position.y || 1.95;
  group.add(cylinder(materials, "metal", [position.x, y + 0.25, position.z], [0.018, 0.72, 0.018]));
  group.add(sphere(materials, "light", [position.x, y - 0.12, position.z], [0.2, 0.14, 0.2]));
  const light = new THREE.PointLight(0xffc47b, 0.24, 3.5);
  light.position.set(position.x, y - 0.25, position.z);
  group.add(light);
}

function addWindow(group, materials, position, options = {}) {
  const height = options.height || 2.2;
  const width = options.width || 1.25;
  group.add(box(materials, "glass", [position.x, 1.35, position.z], [0.08, height, width], 0.02));
  group.add(box(materials, "metal", [position.x, 1.35, position.z - width / 2], [0.1, height + 0.1, 0.04], 0.005));
  group.add(box(materials, "metal", [position.x, 1.35, position.z + width / 2], [0.1, height + 0.1, 0.04], 0.005));
  group.add(box(materials, "metal", [position.x, 2.45, position.z], [0.1, 0.04, width + 0.08], 0.005));
}

function addDecorBlock(group, materials, position) {
  group.add(box(materials, "accent", [position.x, 0.34, position.z], [0.24, 0.22, 0.24], 0.035));
  group.add(box(materials, "white", [position.x + 0.16, 0.48, position.z - 0.05], [0.12, 0.16, 0.12], 0.02));
}

const furnitureBuilders = {
  table: addTable,
  chair: addChair,
  sofa: addSofa,
  bed: addBed,
  plant: addPlant,
  counter: addCounter,
  shelf: addShelf,
  lamp: addLamp,
  window: addWindow,
  decorBlock: addDecorBlock
};

function createPlacements(zone, quantity) {
  const count = Math.max(1, Math.min(Number(quantity) || 1, 24));
  if (!zone) return [];
  if (zone.type === "line" || zone.type === "centeredLine") {
    const centerOffset = zone.type === "centeredLine" ? (count - 1) * (zone.spacing || 0.7) / 2 : 0;
    return Array.from({ length: count }, (_, index) => ({
      x: zone.anchor[0] + (zone.direction === "x" ? index * zone.spacing - centerOffset : 0),
      y: zone.anchor[1],
      z: zone.anchor[2] + (zone.direction === "z" ? index * zone.spacing - centerOffset : 0)
    }));
  }
  if (zone.type === "grid") {
    const columns = zone.columns || Math.ceil(Math.sqrt(count));
    return Array.from({ length: count }, (_, index) => ({
      x: zone.anchor[0] + (index % columns) * zone.spacing[0],
      y: zone.anchor[1],
      z: zone.anchor[2] + Math.floor(index / columns) * zone.spacing[1]
    }));
  }
  if (zone.type === "corners") {
    return Array.from({ length: count }, (_, index) => {
      const anchor = zone.anchors[index % zone.anchors.length];
      return { x: anchor[0], y: anchor[1], z: anchor[2] };
    });
  }
  if (zone.type === "wallAligned") {
    const spread = zone.width || 1.5;
    const step = count === 1 ? 0 : spread / (count - 1);
    return Array.from({ length: count }, (_, index) => ({
      x: zone.anchor[0] + (zone.direction === "x" ? -spread / 2 + index * step : 0),
      y: zone.anchor[1],
      z: zone.anchor[2] + (zone.direction === "z" ? -spread / 2 + index * step : 0)
    }));
  }
  return [{ x: zone.anchor[0], y: zone.anchor[1], z: zone.anchor[2] }];
}

function createAroundTablePlacements(tablePlacements, quantity) {
  const offsets = [[0.52, 0, 0], [-0.52, 0, 0], [0, 0, 0.52], [0, 0, -0.52]];
  const placements = [];
  const maxCount = Math.min(quantity, tablePlacements.length * 4);
  for (let index = 0; index < maxCount; index += 1) {
    const table = tablePlacements[Math.floor(index / 4) % tablePlacements.length];
    const offset = offsets[index % offsets.length];
    placements.push({ x: table.x + offset[0], y: 0, z: table.z + offset[2], rotationY: Math.atan2(-offset[0], -offset[2]) });
  }
  return placements;
}

function createInFrontOfSofaPlacements(sofaPlacements, quantity) {
  return sofaPlacements.slice(0, quantity).map((sofa) => ({ x: sofa.x, y: 0, z: sofa.z + 0.82 }));
}

function createBesideBedPlacements(bedPlacements, quantity, offset = 1.42, y = 0) {
  const bed = bedPlacements[0] || { x: 0, z: -1.18 };
  const anchors = [{ x: bed.x - offset, y, z: bed.z }, { x: bed.x + offset, y, z: bed.z }];
  return Array.from({ length: quantity }, (_, index) => anchors[index % anchors.length]);
}

function getZoneForFurniture(template, spaceType, furnitureType, rawType) {
  const raw = String(rawType || "").toLowerCase();
  if (spaceType === "cafe") {
    return { counter: "counter", table: "seating", chair: "seating", shelf: "shelf", plant: "plants", lamp: "lighting", window: "glass" }[furnitureType];
  }
  if (spaceType === "office_lounge") {
    if (furnitureType === "table" && /coffee/.test(raw)) return "table";
    return { sofa: "sofa", table: "meeting", chair: "meeting", shelf: "shelf", plant: "plants", lamp: "lighting", window: "glass" }[furnitureType];
  }
  if (spaceType === "bedroom") {
    if (furnitureType === "table" && /side/.test(raw)) return "sideTables";
    if (furnitureType === "table" && /desk/.test(raw)) return "desk";
    return { bed: "bed", table: "sideTables", chair: "desk", shelf: "wardrobe", plant: "plants", lamp: "lighting", window: "glass" }[furnitureType];
  }
  return Object.keys(template.zones)[0];
}

function addRoomShell(group, materials, template) {
  group.add(box(materials, "platform", template.shell.platform.position, template.shell.platform.scale, 0.08));
  group.add(box(materials, "floor", template.shell.floor.position, template.shell.floor.scale, 0.02));
  group.add(box(materials, "wall", template.shell.backWall.position, template.shell.backWall.scale, 0.02));
  group.add(box(materials, "wall", template.shell.leftWall.position, template.shell.leftWall.scale, 0.02));
  group.add(box(materials, "glass", template.shell.glass.position, template.shell.glass.scale, 0.02));
}

function addFloorDetail(group, materials, template) {
  const width = template.shell.floor.scale[0] - 0.5;
  const depth = template.shell.floor.scale[2] - 0.3;
  for (let index = 0; index < 9; index += 1) {
    group.add(box(materials, "wood", [-width / 2 + index * (width / 8), 0.08, 0], [0.022, 0.03, depth], 0.01));
  }
}

function addConceptScene(group, materials, brief = window.NOVA_DESIGN_BRIEF) {
  const normalizedBrief = normalizeBrief(brief);
  const spaceType = resolveSpaceType(normalizedBrief);
  const template = layoutTemplates[spaceType] || layoutTemplates.cafe;
  const layoutContext = { zoneUsage: new Map(), tablePlacements: [], sofaPlacements: [], bedPlacements: [] };

  addRoomShell(group, materials, template);
  addFloorDetail(group, materials, template);

  const furniture = normalizedBrief.furniture.map((item) => ({ ...item, resolvedType: resolveFurnitureType(item.type) }));
  const primaryOrder = ["counter", "sofa", "bed", "table"];
  const dependentOrder = ["chair"];
  const secondaryOrder = ["shelf", "plant", "lamp", "window", "decorBlock"];

  const addFurnitureItem = (item) => {
    const type = item.resolvedType;
    const zoneName = getZoneForFurniture(template, spaceType, type, item.type);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    let placements = [];
    if (type === "chair" && layoutContext.tablePlacements.length) {
      placements = createAroundTablePlacements(layoutContext.tablePlacements, quantity);
    } else if (type === "table" && spaceType === "office_lounge" && layoutContext.sofaPlacements.length && /coffee/i.test(item.type)) {
      placements = createInFrontOfSofaPlacements(layoutContext.sofaPlacements, quantity);
    } else if (type === "table" && spaceType === "bedroom" && /side/i.test(item.type) && layoutContext.bedPlacements.length) {
      placements = createBesideBedPlacements(layoutContext.bedPlacements, quantity, template.zones.sideTables.offset);
    } else if (type === "lamp" && spaceType === "bedroom" && layoutContext.bedPlacements.length) {
      placements = createBesideBedPlacements(layoutContext.bedPlacements, quantity, template.zones.lighting.offset, template.zones.lighting.y);
    } else {
      placements = createPlacements(template.zones[zoneName] || template.zones.seating || template.zones.sofa || template.zones.bed, quantity);
    }
    placements.forEach((position, index) => {
      const builder = furnitureBuilders[type] || furnitureBuilders.decorBlock;
      builder(group, materials, position, { index, quantity, rotationY: position.rotationY || 0, rawType: item.type });
    });
    if (type === "table") layoutContext.tablePlacements.push(...placements);
    if (type === "sofa") layoutContext.sofaPlacements.push(...placements);
    if (type === "bed") layoutContext.bedPlacements.push(...placements);
    layoutContext.zoneUsage.set(zoneName, (layoutContext.zoneUsage.get(zoneName) || 0) + placements.length);
  };

  primaryOrder.forEach((type) => furniture.filter((item) => item.resolvedType === type).forEach(addFurnitureItem));
  dependentOrder.forEach((type) => furniture.filter((item) => item.resolvedType === type).forEach(addFurnitureItem));
  secondaryOrder.forEach((type) => furniture.filter((item) => item.resolvedType === type).forEach(addFurnitureItem));

  if (!layoutContext.tablePlacements.length && spaceType === "cafe") {
    createPlacements(template.zones.seating, 2).forEach((position) => addTable(group, materials, position));
  }

  window.NOVA_CONCEPT_LAYOUT_CONTEXT = {
    spaceType,
    style: normalizedBrief.style,
    zoneUsage: Object.fromEntries(layoutContext.zoneUsage),
    tablePlacements: layoutContext.tablePlacements.length,
    sofaPlacements: layoutContext.sofaPlacements.length,
    bedPlacements: layoutContext.bedPlacements.length
  };
}

function countMeshes(object) {
  let count = object.isMesh ? 1 : 0;
  object.children.forEach((child) => {
    count += countMeshes(child);
  });
  return count;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.((object) => {
      if (object.geometry) object.geometry.dispose?.();
    });
  }
}

function getActiveDesignBrief() {
  const briefParam = new URLSearchParams(window.location.search).get("brief");
  if (briefParam) {
    try {
      return normalizeBrief(JSON.parse(briefParam));
    } catch (error) {
      console.warn("[NOVA Concept 3D] Invalid brief query parameter.", error);
    }
  }
  return normalizeBrief(window.NOVA_DESIGN_BRIEF || getFallbackBrief());
}

function getConceptBounds(roomGroup) {
  const box = new THREE.Box3().setFromObject(roomGroup);
  if (box.isEmpty()) {
    return {
      box,
      center: new THREE.Vector3(0, 0.8, 0),
      size: new THREE.Vector3(6, 3, 4),
      maxDim: 6
    };
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return { box, center, size, maxDim: Math.max(size.x, size.y, size.z, 1) };
}

function setOrthographicFrame(camera, maxDim, aspect) {
  const viewSize = maxDim * 0.72;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.near = 0.01;
  camera.far = maxDim * 8;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

function fitCameraToConceptScene(roomGroup, mode = window.NOVA_ISOMETRIC_ROOM_STATE?.cameraMode || "Iso") {
  if (!runtime?.camera || !runtime?.controls || !roomGroup) return null;
  const bounds = getConceptBounds(roomGroup);
  const viewport = runtime.renderer.domElement.parentElement;
  const rect = viewport.getBoundingClientRect();
  const aspect = rect.width / Math.max(1, rect.height);
  const cameraDirections = {
    Iso: new THREE.Vector3(1, 0.72, 1).normalize(),
    Front: new THREE.Vector3(0, 0.28, 1).normalize(),
    Top: new THREE.Vector3(0.01, 1, 0.01).normalize(),
    Detail: new THREE.Vector3(0.85, 0.5, 0.85).normalize()
  };
  const direction = cameraDirections[mode] || cameraDirections.Iso;
  const distance = bounds.maxDim * (mode === "Detail" ? 1.08 : 1.65);
  setOrthographicFrame(runtime.camera, bounds.maxDim, aspect);
  runtime.camera.position.copy(bounds.center.clone().add(direction.multiplyScalar(distance)));
  runtime.camera.lookAt(bounds.center);
  runtime.controls.target.copy(bounds.center);
  runtime.controls.update();
  runtime.conceptBounds = bounds;
  runtime.cameraFitMode = mode;
  if (window.NOVA_ISOMETRIC_ROOM_STATE) {
    window.NOVA_ISOMETRIC_ROOM_STATE.cameraFitComplete = true;
    window.NOVA_ISOMETRIC_ROOM_STATE.cameraMode = mode;
    window.NOVA_ISOMETRIC_ROOM_STATE.bounds = {
      center: bounds.center.toArray(),
      size: bounds.size.toArray(),
      maxDim: bounds.maxDim
    };
  }
  return bounds;
}

function rebuildConceptScene(brief = getActiveDesignBrief()) {
  if (!runtime?.room) return;
  const normalizedBrief = normalizeBrief(brief);
  const materials = makeMaterials(normalizedBrief);
  clearGroup(runtime.room);
  addConceptScene(runtime.room, materials, normalizedBrief);
  runtime.materials = materials;
  runtime.briefSignature = JSON.stringify(normalizedBrief);
  const objectCount = countMeshes(runtime.room);
  const materialCount = Object.keys(materials).length;
  document.querySelector("#objectCount").textContent = String(objectCount);
  document.querySelector("#materialCount").textContent = String(materialCount);
  window.NOVA_ISOMETRIC_ROOM_STATE = {
    active: true,
    usingPrimitiveFallback: false,
    generatedFromPrompt: Boolean(window.NOVA_DESIGN_BRIEF),
    generatedFromSceneJson: true,
    cameraMode: window.NOVA_ISOMETRIC_ROOM_STATE?.cameraMode || "Iso",
    objectCount,
    materialCount,
    stylePreset: normalizedBrief.style,
    spaceType: resolveSpaceType(normalizedBrief),
    renderedFrameCount: window.NOVA_ISOMETRIC_ROOM_STATE?.renderedFrameCount || 0,
    cameraFitComplete: false
  };
  fitCameraToConceptScene(runtime.room);
}

function buildConcept3D() {
  const viewport = document.querySelector("#roomViewport");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf3f0ea, 1);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f0ea);
  const camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  const room = new THREE.Group();
  room.scale.set(0.5, 0.5, 0.5);
  scene.add(room);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7b0a6, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.35);
  key.position.set(5, 8, 5);
  key.castShadow = true;
  scene.add(key);

  const resize = () => {
    const rect = viewport.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const maxDim = runtime?.conceptBounds?.maxDim || 6;
    setOrthographicFrame(camera, maxDim, aspect);
    renderer.setSize(rect.width, rect.height, false);
    if (runtime?.room) fitCameraToConceptScene(runtime.room, runtime.cameraFitMode || "Iso");
  };

  runtime = { renderer, scene, camera, controls, room, resize, autoTour: false, briefSignature: "" };
  window.addEventListener("resize", resize);
  resize();
  setCamera("Iso");
  rebuildConceptScene();

  const animate = () => {
    const nextSignature = JSON.stringify(getActiveDesignBrief());
    if (nextSignature !== runtime.briefSignature) rebuildConceptScene(JSON.parse(nextSignature));
    if (runtime.autoTour) room.rotation.y += 0.0035;
    controls.update();
    renderer.render(scene, camera);
    if (window.NOVA_ISOMETRIC_ROOM_STATE) {
      window.NOVA_ISOMETRIC_ROOM_STATE.renderedFrameCount = (window.NOVA_ISOMETRIC_ROOM_STATE.renderedFrameCount || 0) + 1;
    }
    requestAnimationFrame(animate);
  };
  animate();
}

function initConceptImageMode() {
  ensureConceptImageElements();
  roomViewport.dataset.mode = "ai-render";
  document.querySelector("#resetConcept")?.addEventListener("click", resetConceptView);
  window.NOVA_ISOMETRIC_ROOM_STATE = {
    active: true,
    renderer: "ai-image",
    generatedFromAIRender: false,
    generatedFromPrompt: false,
    generatedFromSceneJson: false,
    sourceProvider: "codex-cli",
    status: "waiting",
    zoomPanEnabled: true
  };
}

function setCamera(name) {
  if (!runtime) return;
  fitCameraToConceptScene(runtime.room, name);
  cameraButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.camera === name));
  if (window.NOVA_ISOMETRIC_ROOM_STATE) window.NOVA_ISOMETRIC_ROOM_STATE.cameraMode = name;
}

cameraButtons.forEach((button) => button.addEventListener("click", () => setCamera(button.dataset.camera)));

setStudioState();
renderAgentSteps();
runDesignBriefAnalysis().catch((error) => console.error("[NOVA Design Brief]", error));
bindCodeTabs();
if (USE_AI_CONCEPT_RENDER) initConceptImageMode();
else buildConcept3D();
const testBriefParam = new URLSearchParams(window.location.search).get("brief");
if (testBriefParam) {
  try {
    window.NOVA_TEST_RUN_BRIEF(JSON.parse(testBriefParam));
  } catch (error) {
    console.warn("[NOVA Concept 3D] Unable to run injected test brief.", error);
  }
}
