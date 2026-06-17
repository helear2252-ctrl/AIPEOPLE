/**
 * NOVA AI - Avatar playback controller
 * Uses a dual video layer system with opacity crossfades.
 */

const AVATAR_STATES = {
  WORK_LOOP: "WorkLoop",
  ATTENTION_INTRO: "AttentionIntro",
  TALK_LOOP: "TalkLoop",
  RETURN_TO_WORK: "ReturnToWork"
};

class CrossfadeController {
  constructor(videoA, videoB, defaultDuration = 250) {
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
        WorkLoop: "assets/avatar/final_web/nova_work_loop.mp4",
        AttentionIntro: "assets/avatar/final_web/nova_turn_to_user.mp4",
        TalkLoop: "assets/avatar/final_web/nova_talk_loop_v2.mp4",
        ReturnToWork: "assets/avatar/final_web/nova_return_to_work.mp4",
        Fallback: "assets/avatar/nova_working_placeholder.png"
      },
      crossfade_ms: {
        WorkLoopToAttentionIntro: 250,
        AttentionIntroToTalkLoop: 220,
        TalkLoopToReturnToWork: 250,
        ReturnToWorkToWorkLoop: 250
      }
    };

    this.currentState = AVATAR_STATES.WORK_LOOP;
    this.videoAvailable = false;
    this.imageFallbackExists = false;
    this.isBusy = false;
    this.replyTimer = null;

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

    this.crossfade = new CrossfadeController(this.videoA, this.videoB, 250);
  }

  async init() {
    console.log("[NOVA Engine] Initializing Avatar Controller...");
    await this.loadOptionalConfig();
    this.applyBranding();

    this.videoAvailable = await this.verifyRequiredVideos();
    this.imageFallbackExists = await this.checkImageExists(this.config.video_paths.Fallback);
    this.setupVisualMode();
    this.bindEvents();
    this.initDebugPanel();

    if (this.videoAvailable) {
      await this.enterWorkLoop(false);
    } else {
      this.showFallbackAvatar();
      this.updateStatus(AVATAR_STATES.WORK_LOOP);
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
    const checks = [
      this.config.video_paths.WorkLoop,
      this.config.video_paths.AttentionIntro,
      this.config.video_paths.TalkLoop,
      this.config.video_paths.ReturnToWork
    ];

    const results = await Promise.all(checks.map((src) => this.checkVideoExists(src)));
    const allFound = results.every(Boolean);
    console.log(`[NOVA Engine] Video assets check: ${allFound ? "FOUND" : "INCOMPLETE"}`);
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

    this.isBusy = true;
    this.chatInput.value = "";
    this.setInputsDisabled(true);
    this.appendMessage("user", message);

    try {
      await this.runDemoConversation(message);
    } catch (error) {
      console.error("[NOVA Engine] Conversation flow failed.", error);
      this.appendMessage("assistant", "Demo 流程發生播放中斷，已回到工作狀態。");
      await this.enterWorkLoop(true);
    } finally {
      this.setInputsDisabled(false);
      this.isBusy = false;
    }
  }

  async runDemoConversation(userMessage) {
    if (!this.videoAvailable) {
      this.updateStatus(AVATAR_STATES.TALK_LOOP);
      this.showDemoReply(userMessage);
      await this.wait(3000);
      this.updateStatus(AVATAR_STATES.WORK_LOOP);
      return;
    }

    await this.waitForWorkLoopCycle();
    await this.playOneShot(AVATAR_STATES.ATTENTION_INTRO, this.config.video_paths.AttentionIntro, this.config.crossfade_ms.WorkLoopToAttentionIntro);
    await this.enterTalkLoop();
    this.showDemoReply(userMessage);
    await this.wait(3000);
    await this.playOneShot(AVATAR_STATES.RETURN_TO_WORK, this.config.video_paths.ReturnToWork, this.config.crossfade_ms.TalkLoopToReturnToWork);
    await this.enterWorkLoop(true);
  }

  async waitForWorkLoopCycle() {
    if (this.currentState !== AVATAR_STATES.WORK_LOOP) return;

    this.statusText.innerText = "Finishing Work Loop";
    const active = this.crossfade.activeVideo;
    active.loop = false;

    if (active.readyState < HTMLMediaElement.HAVE_METADATA) {
      await this.wait(500);
      return;
    }

    await this.crossfade.waitForEnded(active);
  }

  async playOneShot(state, src, fadeMs) {
    const fromState = this.currentState;
    this.logVideoTransition(fromState, state, src, false);
    this.updateDebugPanel(state, src);
    this.updateStatus(state);
    const video = await this.crossfade.crossfadeTo(src, { loop: false, duration: fadeMs });
    this.updateDebugPanel(state, video.getAttribute("src") || src);
    await this.crossfade.waitForEnded(video);
  }

  async enterTalkLoop() {
    const fromState = this.currentState;
    const src = this.config.video_paths.TalkLoop;
    this.logVideoTransition(fromState, AVATAR_STATES.TALK_LOOP, src, true);
    this.updateDebugPanel(AVATAR_STATES.TALK_LOOP, src);
    this.updateStatus(AVATAR_STATES.TALK_LOOP);
    const video = await this.crossfade.crossfadeTo(src, {
      loop: true,
      duration: this.config.crossfade_ms.AttentionIntroToTalkLoop
    });
    this.updateDebugPanel(AVATAR_STATES.TALK_LOOP, video.getAttribute("src") || src);
  }

  async enterWorkLoop(withFade) {
    const fromState = this.currentState;
    const src = this.config.video_paths.WorkLoop;
    this.logVideoTransition(fromState, AVATAR_STATES.WORK_LOOP, src, true);
    this.updateDebugPanel(AVATAR_STATES.WORK_LOOP, src);
    this.updateStatus(AVATAR_STATES.WORK_LOOP);
    if (!this.videoAvailable) {
      this.showFallbackAvatar();
      return;
    }

    if (withFade) {
      const video = await this.crossfade.crossfadeTo(src, {
        loop: true,
        duration: this.config.crossfade_ms.ReturnToWorkToWorkLoop
      });
      this.updateDebugPanel(AVATAR_STATES.WORK_LOOP, video.getAttribute("src") || src);
    } else {
      const video = await this.crossfade.showInitial(src, { loop: true });
      this.updateDebugPanel(AVATAR_STATES.WORK_LOOP, video.getAttribute("src") || src);
    }
  }

  updateStatus(state) {
    this.currentState = state;

    const styles = {
      [AVATAR_STATES.WORK_LOOP]: ["Idle Working", "rgba(56, 189, 248, 0.1)", "var(--accent-color)", "0 0 10px rgba(56, 189, 248, 0.25)"],
      [AVATAR_STATES.ATTENTION_INTRO]: ["Attention", "rgba(251, 191, 36, 0.1)", "#fbbf24", "0 0 10px rgba(251, 191, 36, 0.25)"],
      [AVATAR_STATES.TALK_LOOP]: ["Speaking", "rgba(16, 185, 129, 0.1)", "#10b981", "0 0 12px rgba(16, 185, 129, 0.4)"],
      [AVATAR_STATES.RETURN_TO_WORK]: ["Returning to Work", "rgba(148, 163, 184, 0.08)", "#94a3b8", "0 0 10px rgba(148, 163, 184, 0.2)"]
    };

    const [label, background, color, shadow] = styles[state];
    this.statusText.innerText = label;
    this.statusBadge.style.background = background;
    this.statusBadge.style.color = color;
    this.statusBadge.style.boxShadow = shadow;
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

  logVideoTransition(fromState, toState, videoPath, loop) {
    console.log("[NOVA Debug] Video transition", {
      fromState,
      toState,
      videoPath,
      loop
    });
  }

  getActiveVideoPath() {
    const activeVideo = document.querySelector(".avatar-video-layer.is-active");
    return activeVideo ? activeVideo.getAttribute("src") : "";
  }

  getFileName(path) {
    if (!path) return "-";
    return path.split("/").pop() || path;
  }

  showDemoReply(userMessage) {
    const replyText = `收到：「${userMessage}」。這是 NOVA 的 Demo 回覆，完整 Gemini、TTS 與 LipSync 可接在保留的介面上。`;
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
    this.appendMessage("assistant", "您好，我是 NOVA。請輸入訊息開始 Demo 對話。");
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

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
