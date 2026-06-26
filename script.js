/**
 * NOVA AI - Avatar playback controller
 * Uses a dual video layer system with opacity crossfades.
 */

const AVATAR_STATES = {
  INTRO_HD: "INTRO_HD",
  WAITING_HD: "WAITING_HD",
  ACK_TASK: "ACK_TASK",
  AGENT_PENDING_REVEAL: "AGENT_PENDING_REVEAL",
  AGENT_WORKBENCH: "AGENT_WORKBENCH",
  WAITING_USER_APPROVAL: "WAITING_USER_APPROVAL",
  AGENT_SAVING: "AGENT_SAVING",
  RETURN_TO_WORK: "RETURN_TO_WORK",
  LISTENING: "LISTENING"
};

const INTRO_ONCE_SRC = "assets/avatar/AIPEOPLE/027.mp4";
const WAITING_SRC = "assets/avatar/AIPEOPLE/026.mp4";
const ACK_TASK_SRC = "assets/avatar/AIPEOPLE/ACK_FROM_026.mp4";
const RETURN_TO_WORK_SRC = "assets/avatar/AIPEOPLE/RETURN_TO_026.mp4";
let introPlayed = false;

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

    await this.prepareVideo(next, src, options);
    if (typeof options.beforeSwitch === "function") {
      options.beforeSwitch(next);
    }

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

    const currentSrcAttr = video.getAttribute("src");
    const isSameSrc = (currentSrcAttr === src) || 
                      (video.src && (new URL(video.src, window.location.href).href === new URL(src, window.location.href).href));

    if (!isSameSrc) {
      video.src = src;
      video.load();
      await this.waitUntilReady(video);
    }

    try {
      video.currentTime = 0;
    } catch (error) {
      console.warn("[NOVA Engine] Unable to reset video time.", error);
    }
    await this.safePlay(video);
    await this.waitForFirstFrame(video);
  }

  waitUntilReady(video) {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let timeoutId;
      const cleanup = () => {
        clearTimeout(timeoutId);
        video.removeEventListener("canplaythrough", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("error", handleError);
      };
      const handleReady = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        console.warn(`[NOVA Engine] Video canplay failed or timed out: ${video.currentSrc || video.src}`);
        resolve();
      };

      video.addEventListener("canplaythrough", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });
      timeoutId = setTimeout(handleReady, 3000);
    });
  }

  waitForFirstFrame(video) {
    if (typeof video.requestVideoFrameCallback !== "function") {
      return this.waitUntilReady(video);
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(resolveFrame, 3000);
      const callbackId = video.requestVideoFrameCallback(resolveFrame);

      function resolveFrame() {
        clearTimeout(timeoutId);
        if (typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(callbackId);
        }
        resolve();
      }
    });
  }

  waitForEnded(video) {
    if (video.ended) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      video.onended = () => {
        video.onended = null;
        resolve();
      };
    });
  }

  async safePlay(video) {
    try {
      await video.play();
    } catch (error) {
      console.warn("[NOVA Engine] Video play was blocked or interrupted.", error);
    }
  }

  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      demo_mode: true,
      video_paths: {
        INTRO_HD: INTRO_ONCE_SRC,
        WAITING_HD: WAITING_SRC,
        ACK_TASK: ACK_TASK_SRC,
        RETURN_TO_WORK: RETURN_TO_WORK_SRC,
        Fallback: "assets/avatar/nova_working_placeholder.png"
      },
      crossfade_ms: 450
    };

    this.currentState = AVATAR_STATES.WAITING_HD;
    this.videoAvailable = false;
    this.imageFallbackExists = false;
    this.isBusy = false;
    this.currentRequestId = 0;
    this.activeRequestId = 0;
    this.debugFlowEvents = [];
    this.debugRequestStartedAt = 0;

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
    this.debugPanel = null;
    this.debugStateText = null;
    this.debugVideoText = null;

    // Agent overlay elements
    this.agentOverlay = document.getElementById("agent-overlay");
    this.agentIframe = document.getElementById("agent-workbench-iframe");
    this.agentTaskDesc = document.getElementById("agent-overlay-task-desc");
    this.agentStatusLabel = document.getElementById("agent-overlay-status-label");
    this.agentFooter = document.getElementById("agent-overlay-footer");
    this.btnAgentClose = document.getElementById("btn-agent-close");
    this.btnAgentRetry = document.getElementById("btn-agent-retry");
    this.btnAgentApprove = document.getElementById("btn-agent-approve");
    this.btnAgentReadjust = document.getElementById("btn-agent-readjust");
    
    this.pollingInterval = null;
    this.currentTaskName = "";
    
    // Timing and reveal control properties
    this.ackRevealTimer = null;
    this.overlayRevealAllowed = false;
    this.overlayShown = false;
    this.pendingAgentStatus = "";
    this.pendingAgentResult = null;

    this.crossfade = new CrossfadeController(this.videoA, this.videoB, this.config.crossfade_ms);
  }

  async init() {
    console.log("[NOVA Engine] Initializing HD Avatar Controller...");
    await this.loadOptionalConfig();
    this.applyBranding();

    this.videoAvailable = await this.verifyRequiredVideos();
    this.imageFallbackExists = this.videoAvailable ? false : await this.checkImageExists(this.config.video_paths.Fallback);
    this.setupVisualMode();
    this.bindEvents();
    this.initDebugPanel();

    if (this.videoAvailable) {
      await this.playIntroThenWaiting();
    } else {
      this.showFallbackAvatar();
      this.updateStatus(AVATAR_STATES.WAITING_HD);
    }
  }

  async loadOptionalConfig() {
    try {
      const response = await fetch("config/avatar_settings.json");
      if (!response.ok) return;

      const remoteConfig = await response.json();
      const { video_paths: ignoredVideoPaths, ...safeConfig } = remoteConfig;
      this.config = { ...this.config, ...safeConfig };
    } catch (error) {
      console.warn("[NOVA Engine] Using built-in avatar settings.", error);
    }
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

  async verifyRequiredVideos() {
    // Check if optional sliced files exist, otherwise fallback to 030.mp4
    const hasAckSlice = await this.checkVideoExists(this.config.video_paths.ACK_TASK);
    if (!hasAckSlice) {
      console.warn("[NOVA Engine] ACK_FROM_026.mp4 missing, falling back to 030.mp4");
      this.config.video_paths.ACK_TASK = "assets/avatar/AIPEOPLE/030.mp4";
    }
    
    const hasReturnSlice = await this.checkVideoExists(this.config.video_paths.RETURN_TO_WORK);
    if (!hasReturnSlice) {
      const hasReturnToWork34 = await this.checkVideoExists("assets/avatar/AIPEOPLE/034_RETURN_TO_WORK.mp4");
      if (hasReturnToWork34) {
        console.warn("[NOVA Engine] RETURN_TO_026.mp4 missing, falling back to 034_RETURN_TO_WORK.mp4");
        this.config.video_paths.RETURN_TO_WORK = "assets/avatar/AIPEOPLE/034_RETURN_TO_WORK.mp4";
      } else {
        console.warn("[NOVA Engine] RETURN_TO_026.mp4 and 034_RETURN_TO_WORK.mp4 missing, falling back to 030.mp4");
        this.config.video_paths.RETURN_TO_WORK = "assets/avatar/AIPEOPLE/030.mp4";
      }
    }

    const requiredStates = [
      AVATAR_STATES.INTRO_HD,
      AVATAR_STATES.WAITING_HD,
      AVATAR_STATES.ACK_TASK,
      AVATAR_STATES.RETURN_TO_WORK
    ];

    const results = await Promise.all(requiredStates.map((state) => this.checkVideoExists(this.config.video_paths[state])));
    const allFound = results.every(Boolean);
    console.log(`[NOVA Engine] HD video assets check: ${allFound ? "FOUND" : "INCOMPLETE"}`);
    return allFound;
  }

  checkVideoExists(src) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = src;
      video.onloadedmetadata = () => resolve(true);
      video.onerror = () => resolve(false);
    });
  }

  checkImageExists(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
  }

  setupVisualMode() {
    this.videoWrapper.style.display = this.videoAvailable ? "block" : "none";
    this.imageFallbackContainer.style.display = "none";
    this.cssFallbackContainer.style.display = "none";
  }

  bindEvents() {
    this.btnSend.addEventListener("click", () => this.handleSendMessageFlow());
    this.chatInput.addEventListener("focus", () => this.enterListeningState());
    this.chatInput.addEventListener("input", () => this.enterListeningState());
    this.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.handleSendMessageFlow();
      }
    });
    this.btnClear.addEventListener("click", () => this.clearChat());
    
    // Bind overlay buttons
    this.btnAgentClose.addEventListener("click", () => this.closeAgentOverlay());
    this.btnAgentRetry.addEventListener("click", () => this.retryAgentTask());
    this.btnAgentApprove.addEventListener("click", () => this.approveAgentResult());
    this.btnAgentReadjust.addEventListener("click", () => this.readjustAgentTask());
  }

  async handleSendMessageFlow() {
    const message = this.chatInput.value.trim();
    if (!message || this.isBusy) return;

    this.chatInput.value = "";
    this.currentTaskName = message;
    this.isBusy = true;
    this.setInputsDisabled(true);
    this.appendMessage("user", message);

    this.logFlowEvent("request:start", {
      fromState: this.currentState,
      toState: "ACK_TASK"
    });

    // Reset overlay tracking flags
    this.overlayRevealAllowed = false;
    this.overlayShown = false;
    this.pendingAgentStatus = "";
    this.pendingAgentResult = null;
    this.updateStatus(AVATAR_STATES.ACK_TASK);

    // 1. Preload Streamlit iframe immediately
    this.preloadAgentWorkbenchIframe();

    try {
      // 2. Send start task to FastAPI immediately
      let startResult = null;
      try {
        const response = await fetch("http://localhost:8787/api/agent/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: message })
        });
        startResult = await response.json();
      } catch (err) {
        console.error("[NOVA Agent] FastAPI start call failed:", err);
      }

      // 3. Play ACK_TASK (030.mp4) transition once
      if (this.videoAvailable) {
        await this.playState(AVATAR_STATES.ACK_TASK, { loop: false });
      }

      // 4. Force 8 seconds delay (8000ms) before showing overlay
      const ACK_MIN_PLAY_MS = 8000;
      if (this.ackRevealTimer) clearTimeout(this.ackRevealTimer);
      
      this.ackRevealTimer = setTimeout(() => {
        this.overlayRevealAllowed = true;
        this.showAgentOverlay();
      }, ACK_MIN_PLAY_MS);

      // 5. Start polling status immediately
      this.startPollingStatus();

    } catch (error) {
      console.error("[NOVA Engine] Conversation flow failed.", error);
      this.appendMessage("assistant", "Failed to initialize Agent Workbench. Please make sure FastAPI backend is running on port 8787.");
      this.isBusy = false;
      this.setInputsDisabled(false);
      this.updateStatus(AVATAR_STATES.WAITING_HD);
      await this.enterWaiting();
    }
  }

  preloadAgentWorkbenchIframe() {
    if (!this.agentIframe.src || this.agentIframe.src === "about:blank" || this.agentIframe.src === window.location.href) {
      this.agentIframe.src = "http://localhost:8501";
      console.log("[NOVA Engine] Workbench iframe preloading initiated.");
    }
  }

  showAgentOverlay() {
    if (this.overlayShown || !this.overlayRevealAllowed) return;
    this.overlayShown = true;
    this.revealTime = Date.now();
    
    if (this.ackRevealTimer) clearTimeout(this.ackRevealTimer);
    
    // Open Agent Overlay
    this.agentTaskDesc.innerText = `Task: ${this.currentTaskName}`;
    
    // Ensure preloaded src is active
    this.preloadAgentWorkbenchIframe();
    
    // Add classes for visual flow animations
    this.agentOverlay.classList.remove("ready");
    this.agentOverlay.classList.add("is-active", "opening");
    this.agentFooter.style.display = "none";
    
    // Once transition completes (600ms), add ready class for heavy glows/blur
    setTimeout(() => {
      if (!this.agentOverlay.classList.contains("is-active")) return;
      this.agentOverlay.classList.remove("opening");
      this.agentOverlay.classList.add("ready");
    }, 600);
    
    // Apply pending agent status if any has completed/errored early
    if (this.pendingAgentResult) {
      this.applyPendingAgentResult();
    } else {
      this.agentStatusLabel.innerText = "WORKING";
      this.updateStatus(AVATAR_STATES.AGENT_WORKBENCH);
    }
  }

  applyPendingAgentResult() {
    const data = this.pendingAgentResult;
    const status = data.status;
    this.agentStatusLabel.innerText = "PREPARING";
    this.updateStatus(AVATAR_STATES.AGENT_PENDING_REVEAL);
    
    if (status === "completed") {
      this.handleAgentCompletedState(data);
    } else {
      this.handleAgentFailedState(data);
    }
  }

  startPollingStatus() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch("http://localhost:8787/api/agent/status");
        if (!response.ok) return;
        const data = await response.json();
        
        const status = data.status;
        
        if (status === "completed") {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
          
          if (!this.overlayShown) {
            this.pendingAgentStatus = status;
            this.pendingAgentResult = data;
            console.log("[NOVA Engine] Task completed early, caching result.");
          } else {
            this.handleAgentCompletedState(data);
          }
        } else if (status === "missing_api_key" || status === "error") {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
          
          if (!this.overlayShown) {
            this.pendingAgentStatus = status;
            this.pendingAgentResult = data;
            console.log("[NOVA Engine] Task stopped early with code: " + status);
          } else {
            this.handleAgentFailedState(data);
          }
        } else {
          if (!this.overlayShown) {
            this.pendingAgentStatus = status;
            this.pendingAgentResult = data;
          } else {
            this.agentStatusLabel.innerText = status.toUpperCase();
          }
        }
      } catch (err) {
        console.error("[NOVA Agent] Polling failed:", err);
      }
    }, 1000);
  }

  handleAgentCompletedState(data) {
    if (!this.agentOverlay.classList.contains("is-active")) return;

    const elapsed = Date.now() - this.revealTime;
    const remaining = 600 - elapsed;
    if (remaining > 0) {
      setTimeout(() => this.handleAgentCompletedState(data), remaining);
      return;
    }
    
    this.agentStatusLabel.innerText = "PREVIEW READY";
    this.updateStatus(AVATAR_STATES.WAITING_USER_APPROVAL);
    
    this.agentFooter.style.display = "flex";
    this.btnAgentApprove.style.display = "inline-block";
    this.btnAgentReadjust.style.display = "inline-block";
    this.btnAgentClose.style.display = "none";
    this.btnAgentRetry.style.display = "none";
    
    this.appendMessage("assistant", "已完成初步結果，請確認是否滿意。");
  }

  handleAgentFailedState(data) {
    if (!this.agentOverlay.classList.contains("is-active")) return;

    const elapsed = Date.now() - this.revealTime;
    const remaining = 600 - elapsed;
    if (remaining > 0) {
      setTimeout(() => this.handleAgentFailedState(data), remaining);
      return;
    }
    
    const status = data.status;
    this.agentStatusLabel.innerText = status === "missing_api_key" ? "MISSING API KEY" : "ERROR";
    
    this.agentFooter.style.display = "flex";
    this.btnAgentApprove.style.display = "none";
    this.btnAgentReadjust.style.display = "none";
    this.btnAgentClose.style.display = "inline-block";
    this.btnAgentRetry.style.display = status === "error" ? "inline-block" : "none";
    
    this.appendMessage("assistant", `Agent execution stopped: ${status.toUpperCase()}. Details: ${data.error_message || ""}`);
  }

  async approveAgentResult() {
    this.agentStatusLabel.innerText = "SAVING...";
    this.updateStatus(AVATAR_STATES.AGENT_SAVING);
    this.btnAgentApprove.disabled = true;
    this.btnAgentReadjust.disabled = true;
    
    setTimeout(async () => {
      this.agentStatusLabel.innerText = "SAVED";
      
      setTimeout(async () => {
        this.btnAgentApprove.disabled = false;
        this.btnAgentReadjust.disabled = false;
        
        // Hide overlay with smooth closing transitions
        this.agentOverlay.classList.remove("is-active", "ready", "opening");
        this.agentIframe.src = "";
        
        // Wait for overlay transition to finish (e.g. 500ms)
        await this.wait(500);
        
        // Play RETURN_TO_WORK transition once
        if (this.videoAvailable) {
          const video = await this.playState(AVATAR_STATES.RETURN_TO_WORK, { loop: false });
          await this.crossfade.waitForEnded(video);
        } else {
          this.updateStatus(AVATAR_STATES.RETURN_TO_WORK);
        }
        
        await this.enterWaiting();
        
        this.isBusy = false;
        this.setInputsDisabled(false);
      }, 1000);
    }, 1000);
  }

  readjustAgentTask() {
    alert("重新調整功能將於下一版開放");
  }

  async closeAgentOverlay() {
    this.agentOverlay.classList.remove("is-active", "ready", "opening");
    this.agentIframe.src = "";
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.ackRevealTimer) clearTimeout(this.ackRevealTimer);
    
    try {
      await fetch("http://localhost:8787/api/agent/stop", { method: "POST" });
    } catch (e) {}

    // Wait for overlay transition to finish (e.g. 500ms)
    await this.wait(500);

    if (this.videoAvailable) {
      const video = await this.playState(AVATAR_STATES.RETURN_TO_WORK, { loop: false });
      await this.crossfade.waitForEnded(video);
    }
    await this.enterWaiting();

    this.isBusy = false;
    this.setInputsDisabled(false);
  }

  async retryAgentTask() {
    this.agentFooter.style.display = "none";
    this.btnAgentRetry.style.display = "none";
    this.btnAgentApprove.style.display = "none";
    this.btnAgentReadjust.style.display = "none";
    
    this.overlayRevealAllowed = true;
    this.overlayShown = true;
    this.pendingAgentStatus = "running";
    this.pendingAgentResult = null;
    this.agentStatusLabel.innerText = "WORKING";
    this.updateStatus(AVATAR_STATES.AGENT_WORKBENCH);
    
    // Refresh Streamlit UI
    this.agentIframe.src = "http://localhost:8501";

    try {
      await fetch("http://localhost:8787/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: this.currentTaskName })
      });
    } catch (e) {
      console.error("[NOVA Agent] Retry start call failed:", e);
    }

    this.startPollingStatus();
  }

  async playIntroThenWaiting() {
    if (introPlayed) {
      await this.enterWaiting(this.currentRequestId);
      return;
    }
    introPlayed = true;
    await this.playState(AVATAR_STATES.INTRO_HD, { loop: false, initial: true });
    await this.crossfade.waitForEnded(this.crossfade.activeVideo);
    await this.enterWaiting(this.currentRequestId);
  }

  async playState(state, options = {}) {
    const src = options.videoUrlOverride ?? this.config.video_paths[state];
    const loop = Boolean(options.loop);
    const duration = options.duration ?? this.config.crossfade_ms;
    const previousState = this.currentState;
    const activeVideo = this.crossfade.activeVideo;

    this.logFlowEvent("playState:start", {
      fromState: previousState,
      toState: state,
      fromVideo: activeVideo.currentSrc || activeVideo.getAttribute("src") || "",
      toVideo: src,
      crossfadeMs: options.initial ? 0 : duration,
      requestId: this.activeRequestId,
      videoCurrentTime: activeVideo.currentTime
    });

    this.updateDebugPanel(state, src);
    this.updateStatus(state);

    const compensateTalkStart = state === AVATAR_STATES.ACK_TASK && previousState === AVATAR_STATES.WAITING_HD;
    const effectiveDuration = compensateTalkStart ? 0 : duration;
    const video = options.initial
      ? await this.crossfade.showInitial(src, { loop })
      : await this.crossfade.crossfadeTo(src, {
          loop,
          duration: effectiveDuration,
          beforeSwitch: null
        });

    this.updateDebugPanel(state, video.getAttribute("src") || src);
    this.logFlowEvent("playState:ready", {
      fromState: previousState,
      toState: state,
      fromVideo: activeVideo.currentSrc || activeVideo.getAttribute("src") || "",
      toVideo: video.currentSrc || video.getAttribute("src") || src,
      crossfadeMs: options.initial ? 0 : duration,
      requestId: this.activeRequestId,
      videoCurrentTime: video.currentTime
    });
    return video;
  }

  fadeVideoBrightness(video, startBrightness, durationMs) {
    const startedAt = performance.now();
    const step = () => {
      const progress = Math.min((performance.now() - startedAt) / durationMs, 1);
      const brightness = startBrightness + (1 - startBrightness) * progress;
      video.style.filter = `brightness(${brightness.toFixed(3)})`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        video.style.filter = "brightness(1)";
      }
    };
    video.style.filter = `brightness(${startBrightness})`;
    requestAnimationFrame(step);
  }

  async enterWaiting(requestId = this.currentRequestId) {
    if (!this.videoAvailable) {
      this.showFallbackAvatar();
      this.updateStatus(AVATAR_STATES.WAITING_HD);
      return;
    }
    await this.playState(AVATAR_STATES.WAITING_HD, { loop: true });
  }

  enterListeningState() {
    if (this.isBusy || !this.videoAvailable) return;
    if (this.currentState === AVATAR_STATES.INTRO_HD || this.currentState === AVATAR_STATES.WAITING_HD || this.currentState === AVATAR_STATES.LISTENING) {
      this.updateStatus(AVATAR_STATES.LISTENING);
    }
  }

  updateStatus(state) {
    const previousState = this.currentState;
    this.currentState = state;
    this.logFlowEvent("state:update", {
      fromState: previousState,
      toState: state,
      requestId: this.activeRequestId
    });

    const styles = {
      [AVATAR_STATES.INTRO_HD]: ["Starting", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.WAITING_HD]: ["Working", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.LISTENING]: ["Listening", "rgba(125, 211, 252, 0.1)", "#7dd3fc", "0 0 10px rgba(125, 211, 252, 0.25)"],
      [AVATAR_STATES.ACK_TASK]: ["Ack Task", "rgba(16, 185, 129, 0.1)", "#10b981", "0 0 12px rgba(16, 185, 129, 0.4)"],
      [AVATAR_STATES.AGENT_PENDING_REVEAL]: ["Preparing", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.AGENT_WORKBENCH]: ["Agent Live", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.WAITING_USER_APPROVAL]: ["Reviewing", "rgba(251, 191, 36, 0.1)", "#fbbf24", "0 0 12px rgba(251, 191, 36, 0.4)"],
      [AVATAR_STATES.AGENT_SAVING]: ["Saving", "rgba(16, 185, 129, 0.1)", "#10b981", "0 0 12px rgba(16, 185, 129, 0.4)"],
      [AVATAR_STATES.RETURN_TO_WORK]: ["Returning", "rgba(148, 163, 184, 0.08)", "#94a3b8", "0 0 10px rgba(148, 163, 184, 0.2)"]
    };

    const [label, background, color, shadow] = styles[state] || styles[AVATAR_STATES.WAITING_HD];
    this.statusText.innerText = label;
    this.statusBadge.style.background = background;
    this.statusBadge.style.color = color;
    this.statusBadge.style.boxShadow = shadow;
    if (this.debugStateText) {
      this.debugStateText.innerText = state;
    }
  }

  logFlowEvent(type, details = {}) {
    const now = performance.now();
    const activeVideo = this.crossfade ? this.crossfade.activeVideo : null;
    const event = {
      type,
      timestamp: Number(now.toFixed(2)),
      requestElapsedMs: this.debugRequestStartedAt ? Number((now - this.debugRequestStartedAt).toFixed(2)) : null,
      fromState: details.fromState || this.currentState,
      toState: details.toState || this.currentState,
      fromVideo: details.fromVideo || (activeVideo ? activeVideo.currentSrc || activeVideo.getAttribute("src") || "" : ""),
      toVideo: details.toVideo || "",
      crossfadeMs: details.crossfadeMs ?? null,
      requestId: details.requestId ?? this.activeRequestId,
      videoCurrentTime: Number((details.videoCurrentTime ?? activeVideo?.currentTime ?? 0).toFixed(3))
    };
    this.debugFlowEvents.push(event);
    if (this.debugFlowEvents.length > 300) this.debugFlowEvents.shift();
    console.debug("[NOVA Flow]", event);
  }

  initDebugPanel() {
    if (this.debugPanel) return;

    const panel = document.createElement("div");
    panel.id = "avatar-debug-panel";
    panel.style.cssText = [
      "position:fixed",
      "left:16px",
      "bottom:16px",
      "z-index:80",
      "max-width:min(420px,calc(100vw - 32px))",
      "padding:10px 12px",
      "border:1px solid rgba(125,211,252,0.45)",
      "border-radius:10px",
      "background:rgba(3,7,18,0.72)",
      "backdrop-filter:blur(12px)",
      "-webkit-backdrop-filter:blur(12px)",
      "color:#e0f2fe",
      "font:12px/1.45 Consolas, Monaco, monospace",
      "box-shadow:0 12px 32px rgba(0,0,0,0.32)",
      "pointer-events:none"
    ].join(";");

    panel.innerHTML = [
      "<div style=\"font-weight:700;color:#7dd3fc;margin-bottom:4px;\">NOVA DEBUG</div>",
      "<div>State: <span id=\"avatar-debug-state\">-</span></div>",
      "<div>Video: <span id=\"avatar-debug-video\">-</span></div>"
    ].join("");

    document.body.appendChild(panel);
    this.debugPanel = panel;
    this.debugStateText = document.getElementById("avatar-debug-state");
    this.debugVideoText = document.getElementById("avatar-debug-video");
    this.updateDebugPanel(this.currentState, this.getActiveVideoPath());
  }

  updateDebugPanel(state, videoPath) {
    if (!this.debugStateText || !this.debugVideoText) return;

    this.debugStateText.innerText = state || "-";
    this.debugVideoText.innerText = this.getFileName(videoPath || this.getActiveVideoPath());
  }

  getActiveVideoPath() {
    const activeVideo = document.querySelector(".avatar-video-layer.is-active");
    return activeVideo ? activeVideo.getAttribute("src") : "";
  }

  getFileName(path) {
    if (!path) return "-";
    return path.split("/").pop() || path;
  }

  showDemoReply(replyText) {
    this.appendMessage("assistant", replyText);
    this.subtitlesOverlay.style.display = "block";
    this.subtitleText.innerText = replyText;

    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      this.subtitlesOverlay.style.display = "none";
    }, 2800);
  }

  appendMessage(sender, text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const senderDiv = document.createElement("div");
    senderDiv.className = "message-sender";
    senderDiv.innerText = sender === "user" ? "You" : this.config.avatar_name;

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.innerText = text;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);
    this.chatHistory.appendChild(messageDiv);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  clearChat() {
    this.chatHistory.innerHTML = "";
    this.appendMessage("assistant", "Cleared. NOVA is ready for a new demo message.");
    this.subtitlesOverlay.style.display = "none";
  }

  showFallbackAvatar() {
    this.videoWrapper.style.display = "none";
    if (this.imageFallbackExists) {
      this.imageFallbackContainer.style.display = "flex";
      this.cssFallbackContainer.style.display = "none";
    } else {
      this.imageFallbackContainer.style.display = "none";
      this.cssFallbackContainer.style.display = "flex";
    }
  }

  setInputsDisabled(disabled) {
    this.chatInput.disabled = disabled;
    this.btnSend.disabled = disabled;
  }

  isCurrentRequest(requestId) {
    return requestId === this.activeRequestId;
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  waitForRequest(ms, requestId) {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        resolve(this.isCurrentRequest(requestId));
      }, ms);
    });
  }

  estimateSpeakingDuration(replyText) {
    const byLength = Math.max(1800, Math.min(6500, replyText.length * 45));
    return byLength;
  }

  connectGemini() {
    console.log("[Future Hook] connectGemini: Initializing Gemini chat streams.");
  }

  connectTTS() {
    console.log("[Future Hook] connectTTS: TTS provider endpoints will be registered here.");
  }

  connectLipSync() {
    console.log("[Future Hook] connectLipSync: LipSync engine and audio timing frames will align here.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.avatarController = new AvatarController();
  window.avatarController.init();
});
