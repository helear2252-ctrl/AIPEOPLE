/**
 * NOVA AI - Avatar playback controller
 * Uses a dual video layer system with opacity crossfades.
 */

const AVATAR_STATES = {
  INTRO_HD: "INTRO_HD",
  WAITING_HD: "WAITING_HD",
  ACKNOWLEDGE_HD: "ACKNOWLEDGE_HD",
  PROCESSING_HD: "PROCESSING_HD",
  THINKING_HD: "THINKING_HD",
  TALKING_A_HD: "TALKING_A_HD",
  TALKING_B_HD: "TALKING_B_HD",
  FINISH_HD: "FINISH_HD",
  LISTENING: "LISTENING"
};

class CrossfadeController {
  constructor(videoA, videoB, defaultDuration = 200) {
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
    previous.removeAttribute("src");
    previous.load();

    this.activeIndex = 1 - this.activeIndex;
    return next;
  }

  async prepareVideo(video, src, options = {}) {
    video.onended = null;
    video.loop = Boolean(options.loop);
    video.muted = true;
    video.playsInline = true;

    if (video.getAttribute("src") !== src) {
      video.src = src;
    }

    video.load();
    await this.waitUntilReady(video);
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
        INTRO_HD: "assets/avatar/final_hd/INTRO_HD.mp4",
        WAITING_HD: "assets/avatar/final_hd/WAITING_HD.mp4",
        ACKNOWLEDGE_HD: "assets/avatar/final_hd/ACKNOWLEDGE_HD.mp4",
        PROCESSING_HD: "assets/avatar/final_hd/PROCESSING_HD.mp4",
        THINKING_HD: "assets/avatar/final_hd/THINKING_HD.mp4",
        TALKING_A_HD: "assets/avatar/final_hd/TALKING_A_HD.mp4",
        TALKING_B_HD: "assets/avatar/final_hd/TALKING_B_HD.mp4",
        FINISH_HD: "assets/avatar/final_hd/FINISH_HD.mp4",
        Fallback: "assets/avatar/nova_working_placeholder.png"
      },
      crossfade_ms: 200,
      acknowledge_ms: 1000,
      processing_min_ms: 2200,
      thinking_threshold_ms: 3000,
      finish_ms: 2000,
      reply_latency_ms: 1800,
      long_reply_chars: 90
    };

    this.currentState = AVATAR_STATES.WAITING_HD;
    this.videoAvailable = false;
    this.imageFallbackExists = false;
    this.isBusy = false;
    this.replyTimer = null;
    this.currentRequestId = 0;
    this.activeRequestId = 0;
    this.isWaitingForResponse = false;
    this.responseReady = false;
    this.thinkingTimer = null;
    this.thinkingTransition = null;
    this.replyCount = 0;
    this.nextTalkingVariant = AVATAR_STATES.TALKING_A_HD;

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
    const requiredStates = [
      AVATAR_STATES.INTRO_HD,
      AVATAR_STATES.WAITING_HD,
      AVATAR_STATES.ACKNOWLEDGE_HD,
      AVATAR_STATES.PROCESSING_HD,
      AVATAR_STATES.THINKING_HD,
      AVATAR_STATES.TALKING_A_HD,
      AVATAR_STATES.TALKING_B_HD,
      AVATAR_STATES.FINISH_HD
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
  }

  async handleSendMessageFlow() {
    const message = this.chatInput.value.trim();
    if (!message || this.isBusy) return;

    const requestId = ++this.currentRequestId;
    this.activeRequestId = requestId;
    this.isWaitingForResponse = true;
    this.responseReady = false;
    this.clearThinkingTimer();
    this.isBusy = true;
    this.chatInput.value = "";
    this.setInputsDisabled(true);
    this.appendMessage("user", message);
    const requestStartedAt = performance.now();

    try {
      const replyPromise = this.prepareDemoReply(message, requestId).then((replyText) => {
        if (!this.isCurrentRequest(requestId)) return null;
        this.responseReady = true;
        this.isWaitingForResponse = false;
        this.clearThinkingTimer();
        return replyText;
      });

      if (this.videoAvailable) {
        await this.playAcknowledge(requestId);
        if (!this.isCurrentRequest(requestId)) return;

        await this.enterProcessing(requestId);
        if (!this.isCurrentRequest(requestId)) return;

        if (this.isWaitingForResponse && !this.responseReady) {
          this.scheduleThinkingTimer(requestId, requestStartedAt);
        }
        const replyText = await replyPromise;
        if (!this.isCurrentRequest(requestId)) return;
        if (this.thinkingTransition) await this.thinkingTransition;
        if (!replyText) return;

        await this.enterTalking(replyText, requestId);
        if (!this.isCurrentRequest(requestId)) return;

        await this.playFinishThenWaiting(requestId);
      } else {
        const replyText = await replyPromise;
        if (!this.isCurrentRequest(requestId)) return;
        this.updateStatus(AVATAR_STATES.TALKING_A_HD);
        this.showDemoReply(replyText);
        await this.waitForRequest(3000, requestId);
        this.updateStatus(AVATAR_STATES.WAITING_HD);
      }
    } catch (error) {
      console.error("[NOVA Engine] Conversation flow failed.", error);
      if (this.isCurrentRequest(requestId)) {
        this.appendMessage("assistant", "Demo response failed. Please try again.");
        this.isWaitingForResponse = false;
        this.responseReady = true;
        this.clearThinkingTimer();
        await this.enterWaiting(requestId);
      }
    } finally {
      if (this.isCurrentRequest(requestId)) {
        this.isWaitingForResponse = false;
        this.clearThinkingTimer();
        this.setInputsDisabled(false);
        this.isBusy = false;
      }
    }
  }

  prepareDemoReply(userMessage, requestId) {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (!this.isCurrentRequest(requestId)) return;
        resolve(`I heard you: "${userMessage}". This is NOVA's HD demo response flow.`);
      }, this.config.reply_latency_ms);
    });
  }

  async playIntroThenWaiting() {
    await this.playState(AVATAR_STATES.INTRO_HD, { loop: false, initial: true });
    await this.crossfade.waitForEnded(this.crossfade.activeVideo);
    await this.enterWaiting(this.currentRequestId);
  }

  async playState(state, options = {}) {
    const src = this.config.video_paths[state];
    const loop = Boolean(options.loop);
    const duration = options.duration ?? this.config.crossfade_ms;

    this.updateDebugPanel(state, src);
    this.updateStatus(state);

    const video = options.initial
      ? await this.crossfade.showInitial(src, { loop })
      : await this.crossfade.crossfadeTo(src, { loop, duration });

    this.updateDebugPanel(state, video.getAttribute("src") || src);
    return video;
  }

  async playOneShotState(state, durationMs, requestId) {
    const video = await this.playState(state, { loop: false });
    if (!this.isCurrentRequest(requestId)) return video;

    if (durationMs) {
      await this.waitForRequest(durationMs, requestId);
    } else {
      await this.crossfade.waitForEnded(video);
    }
    return video;
  }

  async enterWaiting(requestId = this.currentRequestId) {
    if (!this.videoAvailable) {
      this.showFallbackAvatar();
      this.updateStatus(AVATAR_STATES.WAITING_HD);
      return;
    }
    if (!this.isCurrentRequest(requestId)) return;
    await this.playState(AVATAR_STATES.WAITING_HD, { loop: true });
  }

  async playAcknowledge(requestId) {
    await this.playOneShotState(AVATAR_STATES.ACKNOWLEDGE_HD, this.config.acknowledge_ms, requestId);
  }

  async enterProcessing(requestId) {
    if (!this.isCurrentRequest(requestId)) return null;
    await this.playState(AVATAR_STATES.PROCESSING_HD, { loop: true });
  }

  async enterThinkingIfStillWaiting(requestId) {
    if (!this.isCurrentRequest(requestId)) return null;
    if (!this.isWaitingForResponse || this.responseReady) return null;
    await this.playState(AVATAR_STATES.THINKING_HD, { loop: true });
  }

  async enterTalking(replyText, requestId) {
    if (!this.isCurrentRequest(requestId)) return;
    const talkingState = this.chooseTalkingVariant(replyText);
    await this.playState(talkingState, { loop: true });
    if (!this.isCurrentRequest(requestId)) return;

    this.showDemoReply(replyText);
    const speakingMs = this.estimateSpeakingDuration(replyText);
    await this.waitForRequest(speakingMs, requestId);
  }

  async playFinishThenWaiting(requestId) {
    if (!this.isCurrentRequest(requestId)) return;
    await this.playOneShotState(AVATAR_STATES.FINISH_HD, this.config.finish_ms, requestId);
    if (!this.isCurrentRequest(requestId)) return;
    await this.enterWaiting(requestId);
  }

  chooseTalkingVariant(replyText = "") {
    this.replyCount += 1;
    const shouldUseB = replyText.length >= this.config.long_reply_chars || this.replyCount > 1;
    if (!shouldUseB) return AVATAR_STATES.TALKING_A_HD;

    const selected = this.nextTalkingVariant;
    this.nextTalkingVariant = selected === AVATAR_STATES.TALKING_A_HD
      ? AVATAR_STATES.TALKING_B_HD
      : AVATAR_STATES.TALKING_A_HD;
    return selected;
  }

  enterListeningState() {
    if (this.isBusy || !this.videoAvailable) return;
    if (this.currentState === AVATAR_STATES.INTRO_HD || this.currentState === AVATAR_STATES.WAITING_HD || this.currentState === AVATAR_STATES.LISTENING) {
      this.updateStatus(AVATAR_STATES.LISTENING);
    }
  }

  updateStatus(state) {
    this.currentState = state;

    const styles = {
      [AVATAR_STATES.INTRO_HD]: ["Starting", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.WAITING_HD]: ["Waiting", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.LISTENING]: ["Listening", "rgba(125, 211, 252, 0.1)", "#7dd3fc", "0 0 10px rgba(125, 211, 252, 0.25)"],
      [AVATAR_STATES.ACKNOWLEDGE_HD]: ["Acknowledged", "rgba(251, 191, 36, 0.1)", "#fbbf24", "0 0 10px rgba(251, 191, 36, 0.25)"],
      [AVATAR_STATES.PROCESSING_HD]: ["Processing", "rgba(129, 140, 248, 0.1)", "#818cf8", "0 0 10px rgba(129, 140, 248, 0.25)"],
      [AVATAR_STATES.THINKING_HD]: ["Thinking", "rgba(129, 140, 248, 0.14)", "#a5b4fc", "0 0 12px rgba(129, 140, 248, 0.35)"],
      [AVATAR_STATES.TALKING_A_HD]: ["Talking", "rgba(16, 185, 129, 0.1)", "#10b981", "0 0 12px rgba(16, 185, 129, 0.4)"],
      [AVATAR_STATES.TALKING_B_HD]: ["Talking", "rgba(16, 185, 129, 0.1)", "#10b981", "0 0 12px rgba(16, 185, 129, 0.4)"],
      [AVATAR_STATES.FINISH_HD]: ["Finishing", "rgba(148, 163, 184, 0.08)", "#94a3b8", "0 0 10px rgba(148, 163, 184, 0.2)"]
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

  clearThinkingTimer() {
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  }

  scheduleThinkingTimer(requestId, requestStartedAt) {
    this.clearThinkingTimer();
    const elapsed = performance.now() - requestStartedAt;
    const delay = Math.max(0, this.config.thinking_threshold_ms - elapsed);

    this.thinkingTimer = window.setTimeout(() => {
      this.thinkingTimer = null;
      if (!this.isCurrentRequest(requestId)) return;
      if (!this.isWaitingForResponse || this.responseReady) return;
      this.thinkingTransition = this.enterThinkingIfStillWaiting(requestId)
        .catch((error) => console.error("[NOVA Engine] Thinking transition failed.", error))
        .finally(() => {
          if (this.isCurrentRequest(requestId)) this.thinkingTransition = null;
        });
    }, delay);
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
