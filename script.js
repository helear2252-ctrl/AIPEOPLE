/**
 * NOVA AI - Frontend Avatar Control Engine (script.js)
 * Implements a state-machine driven digital human secretary.
 */

class AvatarController {
  constructor() {
    // Default fallback configurations
    this.config = {
      brand_name: "NOVA AI",
      hero_title: "NOVA AI",
      hero_subtitle: "Your Intelligent Digital Human Assistant",
      hero_description: "Experience a next-generation AI assistant with natural conversation, voice interaction, and digital human presentation.",
      primary_color: "#0f172a",
      secondary_color: "#1e293b",
      accent_color: "#38bdf8",
      avatar_name: "NOVA",
      avatar_role: "Executive Digital Secretary",
      default_state: "Idle_Working",
      demo_mode: true,
      video_paths: {
        Idle_Working: "assets/avatar/nova_typing_loop.mp4",
        Turn_To_User: "assets/avatar/nova_turn_to_user.mp4",
        Talking: "assets/avatar/nova_talk_loop.mp4",
        Return_To_Desk: "assets/avatar/nova_turn_back.mp4",
        Fallback: "assets/avatar/nova_working_placeholder.png"
      }
    };

    this.currentState = "Idle_Working";
    this.videoExists = false;
    this.imageFallbackExists = false;
    this.isTransitioning = false;

    // DOM Elements
    this.videoElement = document.getElementById("avatar-video");
    this.videoWrapper = document.getElementById("video-wrapper");
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
  }

  /**
   * Initializes the controller, loads settings, verifies assets, and starts the Idle state.
   */
  async init() {
    console.log("[NOVA Engine] Initializing Avatar Controller...");

    // 1. Try to fetch JSON configuration (handles direct file:// loading failure gracefully)
    try {
      const response = await fetch("config/avatar_settings.json");
      if (response.ok) {
        const remoteConfig = await response.json();
        this.config = { ...this.config, ...remoteConfig };
        console.log("[NOVA Engine] Loaded settings from JSON config.");
      }
    } catch (e) {
      console.warn("[NOVA Engine] Could not fetch config JSON. Using built-in settings.", e);
    }

    // Apply configuration branding texts
    document.title = `${this.config.brand_name} - ${this.config.hero_subtitle}`;
    const heroTitleEl = document.getElementById("hero-title");
    const heroSubtitleEl = document.getElementById("hero-subtitle");
    const heroDescEl = document.getElementById("hero-description");
    
    if (heroTitleEl) heroTitleEl.innerText = this.config.brand_name;
    if (heroSubtitleEl) heroSubtitleEl.innerText = this.config.hero_subtitle;
    if (heroDescEl) heroDescEl.innerText = this.config.hero_description;

    // Apply theme variables dynamically from settings config
    document.documentElement.style.setProperty("--primary-color", this.config.primary_color);
    document.documentElement.style.setProperty("--secondary-color", this.config.secondary_color);
    document.documentElement.style.setProperty("--accent-color", this.config.accent_color);

    // 2. Verify availability of video files
    const mainVideoPath = this.config.video_paths.Idle_Working;
    this.videoExists = await this.checkVideoExists(mainVideoPath);
    console.log(`[NOVA Engine] Video assets check: ${this.videoExists ? "FOUND" : "NOT FOUND"}`);

    // 3. Verify availability of fallback image
    const imagePath = this.config.video_paths.Fallback;
    this.imageFallbackExists = await this.checkImageExists(imagePath);
    console.log(`[NOVA Engine] Fallback image check: ${this.imageFallbackExists ? "FOUND" : "NOT FOUND"}`);

    // 4. Setup fallback visual hierarchy
    if (this.videoExists) {
      this.videoWrapper.style.display = "flex";
      this.imageFallbackContainer.style.display = "none";
      this.cssFallbackContainer.style.display = "none";
      this.videoElement.style.display = "block";
    } else {
      this.videoWrapper.style.display = "none";
      this.videoElement.style.display = "none";
      if (this.imageFallbackExists) {
        this.imageFallbackContainer.style.display = "flex";
        this.cssFallbackContainer.style.display = "none";
      } else {
        // Fallback Level 2: Pure CSS Animated Workspace
        this.imageFallbackContainer.style.display = "none";
        this.cssFallbackContainer.style.display = "flex";
      }
    }

    // 5. Bind User Actions
    this.btnSend.addEventListener("click", () => this.handleSendMessageFlow());
    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessageFlow();
      }
    });
    this.btnClear.addEventListener("click", () => this.clearChat());

    // 6. Enter initial state
    this.setState("Idle_Working");
  }

  /**
   * Helper to verify if a video resource is loadable on browser.
   */
  checkVideoExists(src) {
    return new Promise((resolve) => {
      const tempVideo = document.createElement("video");
      tempVideo.src = src;
      tempVideo.onloadedmetadata = () => {
        resolve(true);
      };
      tempVideo.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Helper to verify if an image resource is loadable.
   */
  checkImageExists(src) {
    return new Promise((resolve) => {
      const tempImg = new Image();
      tempImg.src = src;
      tempImg.onload = () => resolve(true);
      tempImg.onerror = () => resolve(false);
    });
  }

  /**
   * State Machine Manager
   */
  setState(state) {
    console.log(`[State Machine] Transitioning: ${this.currentState} -> ${state}`);
    this.currentState = state;

    // Update Status Badge visually
    switch (state) {
      case "Idle_Working":
        this.statusText.innerText = "Idle Working";
        this.statusBadge.style.boxShadow = "0 0 10px rgba(56, 189, 248, 0.25)";
        this.statusBadge.style.background = "rgba(56, 189, 248, 0.1)";
        this.statusBadge.style.color = "var(--accent-color)";
        this.playWorking();
        break;
      case "Turn_To_User":
        this.statusText.innerText = "Focusing User";
        this.statusBadge.style.boxShadow = "0 0 10px rgba(251, 191, 36, 0.25)";
        this.statusBadge.style.background = "rgba(251, 191, 36, 0.1)";
        this.statusBadge.style.color = "#fbbf24";
        this.playTurnToUser();
        break;
      case "Talking":
        this.statusText.innerText = "Speaking";
        this.statusBadge.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.4)";
        this.statusBadge.style.background = "rgba(16, 185, 129, 0.1)";
        this.statusBadge.style.color = "#10b981";
        this.playTalking();
        break;
      case "Return_To_Desk":
        this.statusText.innerText = "Returning to Work";
        this.statusBadge.style.boxShadow = "0 0 10px rgba(148, 163, 184, 0.2)";
        this.statusBadge.style.background = "rgba(148, 163, 184, 0.08)";
        this.statusBadge.style.color = "#94a3b8";
        this.playReturnToDesk();
        break;
    }
  }

  /* Playback handlers */

  playWorking() {
    if (this.videoExists) {
      this.videoElement.src = this.config.video_paths.Idle_Working;
      this.videoElement.loop = true;
      this.videoElement.play().catch(e => console.log("Video play error: ", e));
    } else {
      this.showFallbackAvatar();
    }
  }

  playTurnToUser() {
    if (this.videoExists) {
      this.videoElement.src = this.config.video_paths.Turn_To_User;
      this.videoElement.loop = false;
      this.videoElement.play().catch(e => console.log("Video play error: ", e));
      
      // Auto transition to Talking when this clip ends
      this.videoElement.onended = () => {
        this.videoElement.onended = null;
        this.setState("Talking");
      };
    } else {
      // Direct state jump in fallback mode
      setTimeout(() => {
        this.setState("Talking");
      }, 500);
    }
  }

  playTalking() {
    if (this.videoExists) {
      this.videoElement.src = this.config.video_paths.Talking;
      this.videoElement.loop = true;
      this.videoElement.play().catch(e => console.log("Video play error: ", e));
    } else {
      this.showFallbackAvatar();
    }
  }

  playReturnToDesk() {
    if (this.videoExists) {
      this.videoElement.src = this.config.video_paths.Return_To_Desk;
      this.videoElement.loop = false;
      this.videoElement.play().catch(e => console.log("Video play error: ", e));

      // Auto transition to Idle_Working when return clip ends
      this.videoElement.onended = () => {
        this.videoElement.onended = null;
        this.setState("Idle_Working");
      };
    } else {
      setTimeout(() => {
        this.setState("Idle_Working");
      }, 500);
    }
  }

  /**
   * Action: Handles Fallback visuals safely based on verified files.
   */
  showFallbackAvatar() {
    if (this.imageFallbackExists) {
      this.imageFallbackContainer.style.display = "flex";
      this.cssFallbackContainer.style.display = "none";
    } else {
      this.imageFallbackContainer.style.display = "none";
      this.cssFallbackContainer.style.display = "flex";
    }
  }

  /**
   * Interactive messaging flow
   */
  handleSendMessageFlow() {
    const text = this.chatInput.value.trim();
    if (!text || this.isTransitioning) return;

    this.chatInput.value = "";
    this.handleUserMessage(text);
  }

  handleUserMessage(message) {
    this.isTransitioning = true;
    
    // Disable inputs during state machine flow execution
    this.chatInput.disabled = true;
    this.btnSend.disabled = true;

    // 1. Output message to chat window
    this.appendMessage("user", message);

    // 2. Wait for current Idle cycle to complete naturally
    if (this.currentState === "Idle_Working" && this.videoExists) {
      console.log("[NOVA Engine] Waiting for active typing loop to end cycle...");
      this.statusText.innerText = "Finishing Work Task...";
      
      // Stop looping of current video, wait for ended event to switch
      this.videoElement.loop = false;
      this.videoElement.onended = () => {
        this.videoElement.onended = null;
        this.setState("Turn_To_User");
      };
    } else {
      // In Fallback mode, transition immediately
      this.setState("Turn_To_User");
    }
  }

  /**
   * AI response handler with typing subtitles and voice sync layout.
   */
  demoAIReply(userMessage) {
    const replyText = "我是 NOVA AI，目前正在 Demo Mode。未來我可以整合 Gemini、OpenAI、語音、嘴型同步與真人數位人動畫。";
    
    // Show subtitles overlay
    this.subtitlesOverlay.style.display = "block";
    this.subtitleText.innerText = "";
    
    let index = 0;
    const typingSpeed = 100; // ms per character
    
    const typewriter = setInterval(() => {
      this.subtitleText.innerText += replyText.charAt(index);
      index++;
      
      // Auto scroll chat box down to align with focus
      this.chatHistory.scrollTop = this.chatHistory.scrollHeight;

      if (index >= replyText.length) {
        clearInterval(typewriter);
        
        // Finalize speech response after a brief pause
        setTimeout(() => {
          this.subtitlesOverlay.style.display = "none";
          this.appendMessage("assistant", replyText);
          
          // Re-enable inputs
          this.chatInput.disabled = false;
          this.btnSend.disabled = false;
          this.isTransitioning = false;

          // Transition back to desk
          this.setState("Return_To_Desk");
        }, 1200);
      }
    }, typingSpeed);
  }

  /**
   * Append message bubbles to container.
   */
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

    // Trigger AI response after state triggers Talking
    if (sender === "user") {
      // Monitor if state has reached Talking, if so run response
      const checkStateInterval = setInterval(() => {
        if (this.currentState === "Talking") {
          clearInterval(checkStateInterval);
          this.demoAIReply(text);
        }
      }, 100);
    }
  }

  /**
   * Action: Clears conversational context.
   */
  clearChat() {
    this.chatHistory.innerHTML = "";
    const introMsg = `哈囉！我是您的智慧數位助理 ${this.config.avatar_name}。請在下方輸入任何訊息，我會為您進行展示。`;
    this.appendMessage("assistant", introMsg);
    
    // Force reset avatar to Idle
    if (this.currentState !== "Idle_Working") {
      this.videoElement.onended = null;
      this.isTransitioning = false;
      this.chatInput.disabled = false;
      this.btnSend.disabled = false;
      this.subtitlesOverlay.style.display = "none";
      this.setState("Idle_Working");
    }
    console.log("[NOVA Engine] Chat history and states cleared.");
  }

  /* Reserved integrations hooks */

  connectTTS() {
    console.log("[Future Hook] connectTTS: TTS provider endpoints will be registered here.");
  }

  connectLipSync() {
    console.log("[Future Hook] connectLipSync: LipSync engine and audio timing frames will align here.");
  }

  connectGemini() {
    console.log("[Future Hook] connectGemini: Initializing Gemini Chat completion streams.");
  }

  connectOpenAI() {
    console.log("[Future Hook] connectOpenAI: Initializing OpenAI GPT-4 completion streams.");
  }

  connectLivePortrait() {
    console.log("[Future Hook] connectLivePortrait: LivePortrait driving layers initialized.");
  }

  connectWav2Lip() {
    console.log("[Future Hook] connectWav2Lip: Wav2Lip backend worker node mapped.");
  }
}

// Instantiate and start engine
document.addEventListener("DOMContentLoaded", () => {
  const controller = new AvatarController();
  controller.init();
});
