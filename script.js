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

const VIDEO_PATHS = Object.freeze({
  INITIAL_LOOP_040: "assets/avatar/AIPEOPLE/040.mp4",
  FIRST_ACK_041: "assets/avatar/AIPEOPLE/041.mp4",
  COMPLETE_TRANSITION_042: "assets/avatar/AIPEOPLE/042.mp4",
  FINAL_LOOP_043: "assets/avatar/AIPEOPLE/043.mp4",
  Fallback: "assets/avatar/nova_working_placeholder.png"
});

// Legacy rollback references only. These files are intentionally not used by Phase 0.7.
// 027: assets/avatar/AIPEOPLE/027.mp4
// 026: assets/avatar/AIPEOPLE/026.mp4
// 030: assets/avatar/AIPEOPLE/030.mp4

const AGENT_API_BASE = "http://127.0.0.1:8787";
const STREAMLIT_WORKBENCH_URL = "http://127.0.0.1:8501";
const FIRST_ACK_MIN_DURATION_MS = 6000;
const MOCK_COMPLETION_HOLD_MS = 1000;
const COMPLETION_TEXT = "已幫你完成，還有需要幫你做什麼嗎？";

let hasCompletedFirstTask = false;
let isAgentRunning = false;
let agentStatusPollTimer = null;

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
    this.agentTaskDesc = document.getElementById("agent-overlay-task-desc");
    this.agentStatusLabel = document.getElementById("agent-overlay-status-label");
    this.agentIframe = document.getElementById("agent-workbench-frame");
    this.agentCompletionText = document.getElementById("agent-completion-message");
    this.agentErrorText = document.getElementById("agent-error-message");
    this.agentStreamlitNotice = document.getElementById("agent-streamlit-notice");
    this.agentCloseButton = document.getElementById("agent-overlay-close");
    this.agentFooter = document.getElementById("agent-overlay-footer");
    this.agentPollInFlight = false;
    this.agentCompletionInProgress = false;

    this.crossfade = new CrossfadeController(this.videoA, this.videoB, this.config.crossfade_ms);
  }

  async init() {
    console.info("[NOVA Phase 0.7] Initializing local 040-043 mock flow.");
    this.applyBranding();
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
        const ackStartedAt = performance.now();
        this.logFlowEvent("first-ack:started", { requestId, video: ackVideo.currentSrc });
        await this.wait(FIRST_ACK_MIN_DURATION_MS);
        if (!this.isCurrentRequest(requestId)) return;
        this.logFlowEvent("first-ack:minimum-met", {
          requestId,
          elapsedMs: Math.round(performance.now() - ackStartedAt)
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
    this.checkStreamlitAvailability();

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
      isAgentRunning = false;
      this.showAgentError(
        "FastAPI mock server is not running.\nPlease start localhost:8787 first."
      );
    }
  }

  showAgentOverlay(task) {
    this.agentCompletionInProgress = false;
    this.agentTaskDesc.innerText = `Task: ${task} · MOCK`;
    this.agentStatusLabel.innerText = "INITIALIZING";
    this.agentCompletionText.hidden = true;
    this.agentErrorText.hidden = true;
    this.agentStreamlitNotice.hidden = true;
    this.agentCloseButton.hidden = true;
    this.agentIframe.src = STREAMLIT_WORKBENCH_URL;
    document.body.classList.add("agent-overlay-open");

    this.agentOverlay.classList.remove("ready", "is-completing", "is-closing");
    this.agentOverlay.classList.add("is-active", "opening");
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (!this.agentOverlay.classList.contains("is-active")) return;
        this.agentOverlay.classList.remove("opening");
        this.agentOverlay.classList.add("ready");
      }, 600);
    });
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
      this.agentStreamlitNotice.hidden = true;
    } catch (error) {
      console.warn("[NOVA Agent] Streamlit workbench may be unavailable.", error);
      this.agentStreamlitNotice.hidden = false;
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
    this.agentCompletionText.hidden = true;
    this.agentErrorText.innerText = message;
    this.agentErrorText.hidden = false;
    this.agentCloseButton.hidden = false;
    this.clearAgentStatusPolling();
  }

  async hideAgentOverlay() {
    this.agentOverlay.classList.add("is-closing");
    await this.wait(600);
    this.agentOverlay.classList.remove("is-active", "ready", "opening", "is-completing");
    await this.wait(500);
    this.agentOverlay.classList.remove("is-closing");
    document.body.classList.remove("agent-overlay-open");
    this.agentIframe.src = "about:blank";
  }

  async closeAgentOverlayAfterError() {
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
