/**
 * NOVA AI - Frontend Interactions & Digital Human Engine (script.js)
 * Implements: Blinking, Breathing, Posture Shifting, Speech Lip-Sync, and Backend Integrations
 */

// Configuration defaults (fallback in case backend is offline)
let systemSettings = {
    project_name: "NOVA AI",
    subtitle: "Your Intelligent Digital Human Assistant",
    persona: "Executive Digital Secretary",
    gender: "Female",
    age: 28,
    hair_style: "Corporate Bun",
    hair_color: "Dark Brown",
    face_style: "Warm Professional",
    outfit: "Navy Blue Blazer",
    personality: "Efficient, Professional, Courteous",
    speaking_style: "Clear, Formal, Reassuring",
    voice_enabled: true,
    avatar_engine: "image",
    avatar_static_image: "assets/liveportrait/nova/fallback/nova_idle_alpha_still_v2.png",
    avatar_idle_video: "assets/liveportrait/nova/video/nova_idle_loop.mp4",
    avatar_talking_video: "assets/liveportrait/nova/video/nova_talking_loop.mp4",
    avatar_images: {
        Female: "assets/liveportrait/nova/fallback/nova_idle_alpha_still_v2.png",
        Male: "assets/avatar_male.png"
    }
};

const BACKEND_BASE_URL = "";
let isBackendOnline = false;
let isSpeaking = false;
let speechUtterance = null;
let lipSyncInterval = null;
const supportsSpeech =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    window.speechSynthesis &&
    typeof SpeechSynthesisUtterance !== "undefined";

// DOM Elements
const backendStatusBadge = document.getElementById("backend-status-badge");
const avatarVideo = document.getElementById("avatar-video");
const avatarImg = document.getElementById("avatar-img");
const eyeLeft = document.getElementById("eye-left");
const eyeRight = document.getElementById("eye-right");
const mouthOverlay = document.getElementById("mouth-overlay");
const speechWaves = document.getElementById("speech-waves");
const avatarState = document.getElementById("avatar-state");
const stateText = document.getElementById("state-text");
const avatarWrapper = document.getElementById("avatar-wrapper");

// HUD / Metadata Elements
const hudGender = document.getElementById("hud-gender");
const hudAge = document.getElementById("hud-age");
const metaPersonality = document.getElementById("meta-personality");
const metaOutfit = document.getElementById("meta-outfit");
const metaSpeech = document.getElementById("meta-speech");
const avatarNameEl = document.getElementById("avatar-name");
const avatarRoleEl = document.getElementById("avatar-role");
const hudMemoryText = document.getElementById("hud-memory-text");

let avatarVideoMode = "idle";
let avatarVideoAvailable = Boolean(avatarVideo);
const AVATAR_NORMAL_IMAGE = "assets/liveportrait/nova/fallback/nova_idle_alpha_still_v2.png";
const INTRO_SEQUENCE_DIR = "assets/liveportrait/nova/idle_sequence";
const INTRO_SEQUENCE_PREFIX = "idle_";
const INTRO_SEQUENCE_EXT = ".png";
const INTRO_SEQUENCE_FRAME_COUNT = 342;
const INTRO_SEQUENCE_FPS = 24;
const TALKING_MOUTH_FRAMES = [
    "assets/expressions/avatar_talk_20.png",
    "assets/expressions/avatar_talk_50.png",
    "assets/expressions/avatar_talk_80.png",
    "assets/expressions/avatar_talk_50.png",
    "assets/expressions/avatar_talk_20.png"
];
const TALKING_MOUTH_FRAME_MS = 160;
const AVATAR_IMAGE_TRANSITION_MS = 220;
const AVATAR_LISTENING_IMAGE = "assets/expressions/avatar_listening_focus.png";
const AVATAR_THINKING_IMAGE = "assets/expressions/avatar_thinking.png";
const AVATAR_ANIMATION_VIDEOS = {
    LISTENING: "assets/animations/listening_loop.mp4",
    THINKING: "assets/animations/thinking_loop.mp4",
    TALKING: "assets/animations/talking_loop.mp4"
};
const NOVA_INTRO_TEXT = "您好，我是 Nova，很高興為您服務。";
const NOVA_MOCK_RESPONSE = "我正在分析您的問題，這是目前的示範回答。";
const COMPLEX_QUESTION_KEYWORDS = ["分析", "未來", "策略", "比較", "風險", "規劃", "優缺點", "怎麼做", "為什麼"];
let avatarEngine = "image";
let idleSequenceFrame = 1;
let idleSequenceTimerId = null;
let idleSequenceActive = false;
let idleSequenceAvailable = true;
let idlePreloadStarted = false;
let currentNovaState = "IDLE";
let avatarVideoFallbackState = "IDLE";
let novaStateTimerId = null;
let talkingMouthTimerId = null;
let talkingMouthFrame = 0;
let avatarImageTransitionTimerId = null;
let hasPlayedIntro = false;
let isIntroPlaying = false;
let allowAutoIntro = true;

// Hero KPI Elements
const kpiUptime = document.getElementById("kpi-uptime");
const kpiCpu = document.getElementById("kpi-cpu");
const kpiMemory = document.getElementById("kpi-memory");

// Chat Elements
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const voiceToggleBtn = document.getElementById("voice-toggle");
const settingsSyncBtn = document.getElementById("settings-sync");

// Offline timer mock simulation
let offlineUptimeSeconds = 0;
setInterval(() => {
    if (!isBackendOnline) {
        offlineUptimeSeconds++;
        const h = Math.floor(offlineUptimeSeconds / 3600);
        const m = Math.floor((offlineUptimeSeconds % 3600) / 60);
        const s = offlineUptimeSeconds % 60;
        if (kpiUptime) kpiUptime.textContent = `${h}h ${m}m ${s}s`;
    }
}, 1000);

// ==========================================================================
// Digital Human Animation Subsystem
// ==========================================================================

/**
 * Returns an idle sequence frame path such as idle_0001.png.
 */
function getIdleSequenceFramePath(frameNumber) {
    const padded = String(frameNumber).padStart(4, "0");
    return `${INTRO_SEQUENCE_DIR}/${INTRO_SEQUENCE_PREFIX}${padded}${INTRO_SEQUENCE_EXT}`;
}

function preloadIdleSequence() {
    if (idlePreloadStarted) return;
    idlePreloadStarted = true;

    for (let frame = 1; frame <= INTRO_SEQUENCE_FRAME_COUNT; frame++) {
        const image = new Image();
        image.src = getIdleSequenceFramePath(frame);
    }
}

/**
 * Stops the idle PNG sequence and optionally returns to the static fallback.
 */
function stopIdleSequence(showFallback = false) {
    idleSequenceActive = false;
    if (idleSequenceTimerId) {
        clearTimeout(idleSequenceTimerId);
        idleSequenceTimerId = null;
    }

    if (showFallback && avatarImg) {
        avatarImg.onerror = null;
        avatarImg.src = systemSettings.avatar_static_image || AVATAR_NORMAL_IMAGE;
    }
}

function startTalkingMouth() {
    if (!avatarImg) return;

    console.log("START TALKING MOUTH");
    stopTalkingMouth(false);
    talkingMouthFrame = 0;

    function showTalkingFrame() {
        avatarImg.onerror = null;
        avatarImg.src = TALKING_MOUTH_FRAMES[talkingMouthFrame];
        talkingMouthFrame = (talkingMouthFrame + 1) % TALKING_MOUTH_FRAMES.length;
    }

    setAvatarExpression(TALKING_MOUTH_FRAMES[talkingMouthFrame], true);
    talkingMouthFrame = (talkingMouthFrame + 1) % TALKING_MOUTH_FRAMES.length;
    talkingMouthTimerId = setTimeout(() => {
        showTalkingFrame();
        talkingMouthTimerId = setInterval(showTalkingFrame, TALKING_MOUTH_FRAME_MS);
    }, AVATAR_IMAGE_TRANSITION_MS);
}

function stopTalkingMouth(showFallback = false) {
    console.log("STOP TALKING MOUTH");
    if (talkingMouthTimerId) {
        clearInterval(talkingMouthTimerId);
        clearTimeout(talkingMouthTimerId);
    }
    talkingMouthTimerId = null;
    talkingMouthFrame = 0;

    if (showFallback) {
        setAvatarStillImage();
    }
}

function showIdleSequenceFrame() {
    if (!avatarImg || !idleSequenceActive || !idleSequenceAvailable) return;

    avatarImg.onerror = () => {
        idleSequenceAvailable = false;
        stopIdleSequence(true);
    };
    avatarImg.src = getIdleSequenceFramePath(idleSequenceFrame);
}

function playIntroSequenceOnce() {
    return new Promise(resolve => {
        if (!avatarImg || !idleSequenceAvailable) {
            resolve();
            return;
        }

        stopTalkingMouth(false);
        stopIdleSequence(false);
        idleSequenceActive = true;
        idleSequenceFrame = 1;

        function showNextIntroFrame() {
            if (!idleSequenceActive || !idleSequenceAvailable) {
                resolve();
                return;
            }

            avatarImg.onerror = () => {
                idleSequenceAvailable = false;
                stopIdleSequence(true);
                resolve();
            };
            avatarImg.src = getIdleSequenceFramePath(idleSequenceFrame);

            if (idleSequenceFrame >= INTRO_SEQUENCE_FRAME_COUNT) {
                idleSequenceActive = false;
                idleSequenceTimerId = null;
                resolve();
                return;
            }

            idleSequenceFrame += 1;
            idleSequenceTimerId = setTimeout(showNextIntroFrame, 1000 / INTRO_SEQUENCE_FPS);
        }

        showNextIntroFrame();
    });
}

/**
 * IDLE uses the static fallback because the 342-frame sequence is an intro speaking animation.
 */
function startIdleSequence() {
    if (!avatarImg) return;

    stopTalkingMouth(false);
    stopIdleSequence(true);
}

function clearNovaStateTimer() {
    if (novaStateTimerId) {
        clearTimeout(novaStateTimerId);
        novaStateTimerId = null;
    }
}

function setAvatarStillImage() {
    if (!avatarImg) return;
    avatarImg.onerror = null;
    avatarImg.src = systemSettings.avatar_static_image || systemSettings.avatar_images.Female || AVATAR_NORMAL_IMAGE;
}

function setAvatarExpression(imagePath, useTransition = false) {
    if (!avatarImg) return;
    if (avatarImageTransitionTimerId) {
        clearTimeout(avatarImageTransitionTimerId);
        avatarImageTransitionTimerId = null;
    }

    avatarImg.onerror = null;

    if (!useTransition || avatarImg.src.endsWith(imagePath)) {
        avatarImg.classList.remove("avatar-image-switching");
        avatarImg.src = imagePath;
        return;
    }

    avatarImg.classList.add("avatar-image-switching");
    avatarImageTransitionTimerId = setTimeout(() => {
        avatarImg.src = imagePath;
        requestAnimationFrame(() => {
            avatarImg.classList.remove("avatar-image-switching");
        });
        avatarImageTransitionTimerId = null;
    }, AVATAR_IMAGE_TRANSITION_MS / 2);
}

function setAvatarImageFallback(state) {
    const normalizedState = String(state || "IDLE").toUpperCase();

    if (avatarWrapper) {
        avatarWrapper.classList.add("video-fallback");
    }

    if (normalizedState === "LISTENING") {
        stopTalkingMouth(false);
        setAvatarExpression(AVATAR_LISTENING_IMAGE, true);
        return;
    }

    if (normalizedState === "THINKING") {
        stopTalkingMouth(false);
        setAvatarExpression(AVATAR_THINKING_IMAGE, true);
        return;
    }

    if (normalizedState === "TALKING") {
        startTalkingMouth();
        return;
    }

    stopTalkingMouth(false);
    startIdleSequence();
}

function setThinkingVideo() {
    avatarVideoFallbackState = "THINKING";
    stopTalkingMouth(false);
    stopIdleSequence(false);
    setAvatarVideoMode("thinking");
}

function setAvatarMode(state) {
    const normalizedState = String(state || "IDLE").toUpperCase();
    avatarEngine = systemSettings.avatar_engine === "video" ? "video" : "image";

    if (avatarEngine === "video" && normalizedState === "THINKING") {
        setThinkingVideo();
        return;
    }

    if (avatarEngine === "video" && normalizedState !== "IDLE") {
        avatarVideoFallbackState = normalizedState;
        stopTalkingMouth(false);
        stopIdleSequence(false);
        setAvatarVideoMode(normalizedState.toLowerCase());
        return;
    }

    if (avatarWrapper) {
        avatarWrapper.classList.add("video-fallback");
    }

    if (normalizedState === "LISTENING") {
        setAvatarImageFallback("LISTENING");
        return;
    }

    if (normalizedState === "THINKING") {
        setAvatarImageFallback("THINKING");
        return;
    }

    if (normalizedState === "TALKING") {
        setAvatarImageFallback("TALKING");
        return;
    }

    setAvatarImageFallback("IDLE");
}

function applyNovaStateClass(state) {
    if (!avatarWrapper) return;
    avatarWrapper.classList.remove(
        "nova-state-intro",
        "nova-state-idle",
        "nova-state-listening",
        "nova-state-thinking",
        "nova-state-talking"
    );
    avatarWrapper.classList.add(`nova-state-${state.toLowerCase()}`);
}

function setNovaState(state) {
    clearNovaStateTimer();
    currentNovaState = state;
    applyNovaStateClass(state);
    updateAvatarState(state);

    if (state === "IDLE") {
        console.log("ENTER IDLE");
        isSpeaking = false;
        stopTalkingMouth(false);
        if (speechWaves) speechWaves.classList.remove("active");
        setAvatarMode("IDLE");
        return;
    }

    stopIdleSequence(false);

    if (state === "LISTENING") {
        stopTalkingMouth(false);
        setAvatarMode("LISTENING");
        if (speechWaves) speechWaves.classList.remove("active");
        return;
    }

    if (state === "THINKING") {
        stopTalkingMouth(false);
        setAvatarMode("THINKING");
        if (speechWaves) speechWaves.classList.remove("active");
        return;
    }

    if (state === "INTRO") {
        stopTalkingMouth(false);
        setAvatarStillImage();
        if (speechWaves) speechWaves.classList.remove("active");
        return;
    }

    if (state === "TALKING") {
        isSpeaking = true;
        stopIdleSequence(false);
        setAvatarMode("TALKING");
        if (speechWaves) speechWaves.classList.add("active");
    }
}

function wait(ms) {
    return new Promise(resolve => {
        novaStateTimerId = setTimeout(() => {
            novaStateTimerId = null;
            resolve();
        }, ms);
    });
}

function isComplexQuestion(text) {
    return COMPLEX_QUESTION_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * Posture Shifting disabled for alpha PNG avatar stability.
 */
function startPostureShiftEngine() {
    return;
}

/**
 * Lip Sync animation simulator (varies height of mouth shape)
 */
function startLipSyncAnimation() {
    if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
    }
    
    // mouthOverlay.classList.add("speaking"); // Disabled for B-level upgrade
    if (currentNovaState === "INTRO") {
        stopIdleSequence(false);
        setAvatarStillImage();
        if (speechWaves) speechWaves.classList.add("active");
    } else {
        setNovaState("TALKING");
    }
    
    // The speaking nod animation is driven smoothly inside the requestAnimationFrame loop in real time.
}

function stopLipSyncAnimation() {
    if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
    }
    
    // mouthOverlay.classList.remove("speaking"); // Disabled for B-level upgrade
    // mouthOverlay.style.height = "0px"; // Disabled for B-level upgrade
    setNovaState("IDLE");
}

function getAvatarVideoPath(mode) {
    const normalizedMode = String(mode || "idle").toUpperCase();
    if (AVATAR_ANIMATION_VIDEOS[normalizedMode]) {
        return AVATAR_ANIMATION_VIDEOS[normalizedMode];
    }

    if (mode === "talking") {
        return systemSettings.avatar_talking_video || "assets/liveportrait/nova/video/nova_talking_loop.mp4";
    }
    return systemSettings.avatar_idle_video || "assets/liveportrait/nova/video/nova_idle_loop.mp4";
}

function enableAvatarFallback() {
    avatarVideoAvailable = false;
    setAvatarImageFallback(avatarVideoFallbackState);
}

function setAvatarVideoMode(mode) {
    if (!avatarVideo || avatarEngine === "image") {
        return;
    }

    const nextMode = ["listening", "thinking", "talking"].includes(mode) ? mode : "idle";
    const nextSrc = getAvatarVideoPath(nextMode);
    if (!nextSrc) {
        enableAvatarFallback();
        return;
    }

    const currentSrc = avatarVideo.getAttribute("src") || "";
    if (avatarVideoMode !== nextMode || currentSrc !== nextSrc) {
        avatarVideoMode = nextMode;
        avatarVideo.loop = true;
        avatarVideo.setAttribute("src", nextSrc);
        avatarVideo.load();
    }

    if (nextMode !== "idle") {
        avatarVideo.currentTime = 0;
    }

    avatarVideo.play().catch(() => {
        enableAvatarFallback();
    });
}

if (avatarVideo) {
    avatarVideo.addEventListener("error", enableAvatarFallback);
    avatarVideo.addEventListener("ended", () => {
        if (avatarVideoMode === "talking") {
            isSpeaking = false;
            setAvatarMode("IDLE");
        }
    });
    avatarVideo.addEventListener("canplay", () => {
        avatarVideoAvailable = true;
        if (avatarWrapper && avatarEngine === "video") {
            avatarWrapper.classList.remove("video-fallback");
        }
    });
}

function playAvatarTalkingOnce() {
    return;
}

window.playAvatarTalkingOnce = playAvatarTalkingOnce;

/**
 * Updates HUD state text and colors
 */
function updateAvatarState(state) {
    if (!avatarState || !stateText) return;
    avatarState.className = "hud-item state-badge " + state.toLowerCase();
    stateText.textContent = state;
}

// ==========================================================================
// Speech Synthesis Subsystem (Web Speech API)
// ==========================================================================

function finishSpeaking() {
    isSpeaking = false;
    setNovaState("IDLE");
    startIdleSequence();
}

function speakResponse(text, reason = "unknown") {
    console.log("[NOVA SPEAK]", reason);

    const isAllowedReason = reason === "intro" || reason === "user";
    if (!isAllowedReason) {
        return Promise.resolve();
    }

    if (reason === "intro" && hasPlayedIntro && !isIntroPlaying) {
        return Promise.resolve();
    }

    if (isSpeaking) {
        return Promise.resolve();
    }

    if (!systemSettings.voice_enabled) {
        finishSpeaking();
        return Promise.resolve();
    }

    isSpeaking = true;

    if (!supportsSpeech) {
        if (currentNovaState !== "INTRO") {
            setNovaState("TALKING");
        }
        return wait(1200).then(() => {
            if (reason === "intro") {
                isSpeaking = false;
            } else {
                finishSpeaking();
            }
        });
    }
    
    // Stop any current voice output
    window.speechSynthesis.cancel();
    if (currentNovaState !== "INTRO") {
        stopLipSyncAnimation();
    }

    // Clean text from Markdown elements for cleaner reading
    const cleanText = text.replace(/[*#`_\-]/g, "").substring(0, 300); // safety cap

    return new Promise(resolve => {
        speechUtterance = new SpeechSynthesisUtterance(cleanText);

        // Try to assign a voice matching the configured gender
        const voices = window.speechSynthesis.getVoices();
        let preferredVoice = null;

        // Select standard English voices based on settings
        if (systemSettings.gender === "Female") {
            preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Zira") || (v.lang.startsWith("en") && v.name.toLowerCase().includes("female")));
        } else {
            preferredVoice = voices.find(v => v.name.includes("Google UK English Male") || v.name.includes("David") || (v.lang.startsWith("en") && v.name.toLowerCase().includes("male")));
        }

        if (preferredVoice) {
            speechUtterance.voice = preferredVoice;
        }

        speechUtterance.rate = 1.05; // natural professional speed
        speechUtterance.pitch = systemSettings.gender === "Female" ? 1.1 : 0.95;

        speechUtterance.onstart = () => {
            isSpeaking = true;
            startLipSyncAnimation();
        };

        speechUtterance.onend = () => {
            if (reason === "intro") {
                isSpeaking = false;
            } else {
                finishSpeaking();
            }
            resolve();
        };

        speechUtterance.onerror = () => {
            if (reason === "intro") {
                isSpeaking = false;
            } else {
                finishSpeaking();
            }
            resolve();
        };

        window.speechSynthesis.speak(speechUtterance);
    });
}

// ==========================================================================
// Backend Integration & Synchronization
// ==========================================================================

/**
 * Synchronize settings UI elements with settings object
 */
function applySettingsUI() {
    hudGender.textContent = systemSettings.gender;
    hudAge.textContent = systemSettings.age;
    metaPersonality.textContent = systemSettings.personality;
    metaOutfit.textContent = systemSettings.outfit;
    metaSpeech.textContent = systemSettings.speaking_style;
    
    avatarNameEl.textContent = systemSettings.project_name;
    avatarRoleEl.textContent = systemSettings.persona;
    
    if (!idleSequenceActive && avatarImg) {
        const imagePath = systemSettings.gender === "Female" ? 
            (systemSettings.avatar_static_image || systemSettings.avatar_images.Female) : systemSettings.avatar_images.Male;
        avatarImg.src = imagePath;
    }

    avatarEngine = systemSettings.avatar_engine === "video" ? "video" : "image";

    if (systemSettings.gender === "Female" && avatarEngine === "video") {
        avatarVideoAvailable = Boolean(avatarVideo);
        if (avatarWrapper) {
            avatarWrapper.classList.remove("video-fallback");
        }
        setAvatarMode(isSpeaking ? "TALKING" : currentNovaState);
    } else if (!idleSequenceActive) {
        enableAvatarFallback();
    }
    
    // Adjust colors slightly for gender skin tones for the eyelids blink overlays
    if (systemSettings.gender === "Female") {
        eyeLeft.style.background = "#a9775a";
        eyeRight.style.background = "#a9775a";
    } else {
        eyeLeft.style.background = "#c69677";
        eyeRight.style.background = "#c69677";
    }
}

/**
 * Pull config settings from an optional standalone API
 */
async function fetchBackendSettings() {
    if (!BACKEND_BASE_URL) {
        isBackendOnline = false;
        backendStatusBadge.className = "status-indicator";
        backendStatusBadge.innerHTML = `<span class="dot"></span> Offline Demo Mode`;
        applySettingsUI();
        simulateOfflineMetrics();
        return;
    }

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/settings`);
        if (response.ok) {
            const data = await response.json();
            systemSettings = data;
            isBackendOnline = true;
            backendStatusBadge.className = "status-indicator online";
            backendStatusBadge.innerHTML = `<span class="dot"></span> API: Connected`;
            applySettingsUI();
            fetchSystemMetrics();
        }
    } catch (err) {
        isBackendOnline = false;
        backendStatusBadge.className = "status-indicator";
        backendStatusBadge.innerHTML = `<span class="dot"></span> Backend: Offline (Simulation)`;
        applySettingsUI();
        simulateOfflineMetrics();
    }
}

/**
 * Fetch live system status readings from an optional standalone API
 */
async function fetchSystemMetrics() {
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/status`);
        if (response.ok) {
            const data = await response.json();
            if (kpiUptime) kpiUptime.textContent = data.uptime_human;
            if (kpiCpu) kpiCpu.textContent = `${data.cpu_percent.toFixed(1)}%`;
            if (kpiMemory) kpiMemory.textContent = `${data.memory_percent.toFixed(1)}%`;
            if (data.memory_layer_status) {
                const modeLabel = data.memory_layer_status.demo_mode ? "Demo" : "Active";
                const typeLabel = data.memory_layer_status.db_type === "JSON Local File" ? "JSON" : "DB";
                hudMemoryText.textContent = `Memory: ${modeLabel} (${typeLabel})`;
            }
        }
    } catch (err) {
        simulateOfflineMetrics();
    }
}

/**
 * Generate logical mock values when backend is offline
 */
function simulateOfflineMetrics() {
    // Fake cpu loads between 1% and 5%
    const cpuMock = (Math.random() * 4 + 1).toFixed(1);
    if (kpiCpu) kpiCpu.textContent = `${cpuMock}%`;
    if (kpiMemory) kpiMemory.textContent = "12.8%";
    hudMemoryText.textContent = "Memory: Offline (Sim)";
}

// ==========================================================================
// Chat Subsystem & Interface Logic
// ==========================================================================

function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${sender}`;
    
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const iconClass = sender === "user" ? "fa-user" : "fa-user-tie";
    
    // Format memory and research reasoning traces elegantly
    let formattedText = text;
    formattedText = formattedText.replace(/\*(🧠|🔍) \[Reasoning: (.*?)\]\*/g, (match, icon, content) => {
        const isMemory = icon === "🧠";
        const borderCol = isMemory ? "#c084fc" : "#38bdf8";
        const bgCol = isMemory ? "rgba(168, 85, 247, 0.08)" : "rgba(56, 189, 248, 0.08)";
        const textCol = isMemory ? "#c084fc" : "#38bdf8";
        return `<div class="reasoning-bubble" style="border-left: 2px solid ${borderCol}; background: ${bgCol}; padding: 0.4rem 0.6rem; border-radius: 4px; margin-bottom: 0.6rem; font-size: 0.78rem; color: ${textCol}; font-style: italic; display: flex; align-items: center; gap: 6px;"><span style="font-size:0.9rem;">${icon}</span> <span>${content}</span></div>`;
    });
    
    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${formattedText}</div>
            <span class="message-time">${timeString}</span>
        </div>
    `;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Handle form submissions & communicate with Backend API
 */
async function handleChatSubmit(text) {
    if (!text.trim()) return;
    
    appendMessage("user", text);
    setNovaState("LISTENING");
    await wait(500);

    if (isComplexQuestion(text)) {
        setNovaState("THINKING");
        appendMessage("secretary", "Nova 正在思考中...");
        await wait(1500);
    }
    
    if (isBackendOnline) {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });
            
            if (response.ok) {
                const data = await response.json();
                appendMessage("secretary", data.response);
                await speakResponse(data.response, "user");
            } else {
                appendMessage("secretary", "I encountered a communication error with my backend cognitive modules.");
                setNovaState("IDLE");
            }
        } catch (error) {
            appendMessage("secretary", "My backend services appear to have disconnected. Reverting to local operations.");
            await simulateLocalResponse(text);
        }
    } else {
        await simulateLocalResponse(text);
    }
}

/**
 * Client-side simulation of NOVA when no standalone API is running
 */
async function simulateLocalResponse(text) {
    // Future backend/API/AI integration point: replace this local mock after Streamlit or API chat is connected.
    const mockReply = NOVA_MOCK_RESPONSE;
    appendMessage("secretary", mockReply);
    await speakResponse(mockReply, "user");
    return;

    const lower = text.toLowerCase();
    let reply = "";
    
    // Check simulated memory first
    if (lower.includes("python") && (lower.includes("learn") || lower.includes("study"))) {
        reply = "*🧠 [Reasoning: Query matches cached context in Local Offline Memory. Suppressing external research...]*\n\nBased on my internal memory registers, I recall that you are currently learning Python. As your Executive Digital Secretary, I will prioritize this remembered preference for our active operations.";
    } else if (lower.includes("project") || lower.includes("developing") || lower.includes("spec")) {
        reply = "*🧠 [Reasoning: Query matches cached context in Local Offline Memory. Suppressing external research...]*\n\nBased on my internal memory registers, I recall that you are developing the NOVA AI project and prefer complete project specifications. As your Executive Digital Secretary, I will prioritize this remembered preference for our active operations.";
    } else if (lower.includes("style") || lower.includes("avatar") || lower.includes("persona") || lower.includes("human")) {
        reply = "*🧠 [Reasoning: Query matches cached context in Local Offline Memory. Suppressing external research...]*\n\nBased on my internal memory registers, I recall that you prefer a professional digital secretary style and a simulation 2d photorealistic digital human avatar. As your Executive Digital Secretary, I will prioritize this remembered preference for our active operations.";
    } else if (lower.includes("stock") || lower.includes("finance") || lower.includes("market")) {
        reply = "*🧠 [Reasoning: Query matches cached context in Local Offline Memory. Suppressing external research...]*\n\nBased on my internal memory registers, I recall that your preferred analysis focus is stock analysis & market intelligence. As your Executive Digital Secretary, I will prioritize this remembered preference for our active operations.";
    } else if (lower.includes("hello") || lower.includes("hi ") || lower.includes("greet")) {
        reply = "Hello! I am NOVA, your Executive Digital Secretary. I am running in local simulation mode. To unlock my full memory and research capabilities, please start my backend Streamlit server.";
    } else if (lower.includes("config") || lower.includes("status")) {
        reply = `My active configurations are: Persona: ${systemSettings.persona}, Gender: ${systemSettings.gender}, Style: ${systemSettings.outfit}, Tone: ${systemSettings.speaking_style}. Settings are synchronized from config/avatar_settings.json.`;
    } else if (lower.includes("schedule") || lower.includes("calendar")) {
        reply = "Looking up your schedules... Daily Briefing scheduled for 9:00 AM, Board meeting at 2:00 PM, and Client dinner at 7:00 PM. Note: This schedule is simulated since the live backend is currently offline.";
    } else if (lower.includes("research") || lower.includes("market")) {
        reply = "Market Research Simulation: Enterprise-grade digital assistants are experiencing a 45% CAGR. Main adoption drivers are workflow scheduling and automated email synthesis. Connect the Streamlit app to fetch actual web indices.";
    } else {
        reply = `I have received your request: "${text}". I am ready to process it. As soon as the Streamlit Backend Layer is fully connected, I will utilize advanced neural models to respond.`;
    }
    
    appendMessage("secretary", reply);
    speakResponse(reply, "legacy");
}

async function playIntroOnce() {
    if (hasPlayedIntro || isIntroPlaying || !allowAutoIntro) return;

    console.log("INTRO START");
    hasPlayedIntro = true;
    isIntroPlaying = true;
    allowAutoIntro = false;
    setNovaState("INTRO");
    try {
        await Promise.all([
            playIntroSequenceOnce(),
            speakResponse(NOVA_INTRO_TEXT, "intro")
        ]);
    } finally {
        console.log("INTRO END");
        isIntroPlaying = false;
        stopTalkingMouth(false);
        stopIdleSequence(true);
        setNovaState("IDLE");
        startIdleSequence();
    }
}

// ==========================================================================
// Initialization & Events
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Initial UI apply
    applySettingsUI();
    preloadIdleSequence();
    
    // Start animation engines
    playIntroOnce();
    startPostureShiftEngine();
    
    // Connect to backend
    fetchBackendSettings();
    setInterval(fetchBackendSettings, 5000); // Check status every 5s
    
    // Form submission
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = chatInput.value;
        chatInput.value = "";
        handleChatSubmit(msg);
    });
    
    // Voice toggle
    voiceToggleBtn.addEventListener("click", () => {
        systemSettings.voice_enabled = !systemSettings.voice_enabled;
        if (!systemSettings.voice_enabled) {
            if (supportsSpeech) {
                window.speechSynthesis.cancel();
            }
            stopLipSyncAnimation();
            voiceToggleBtn.classList.add("muted");
            voiceToggleBtn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
        } else {
            voiceToggleBtn.classList.remove("muted");
            voiceToggleBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
        }
    });
    
    // Manual sync button
    settingsSyncBtn.addEventListener("click", () => {
        fetchBackendSettings();
    });

    // Preset buttons clicks
    document.querySelectorAll(".quick-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const text = btn.getAttribute("data-text");
            handleChatSubmit(text);
        });
    });

    // In-page section switching without URL hashes or scroll jumps
    const sections = document.querySelectorAll(".page-section");
    const navLinks = document.querySelectorAll(".nav-link");
    const sectionControls = document.querySelectorAll("[data-section], a[href^='#']");

    function showSection(sectionId) {
        sections.forEach(section => {
            section.classList.toggle("active-section", section.id === sectionId);
        });

        navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.section === sectionId);
        });
    }

    sectionControls.forEach(control => {
        control.addEventListener("click", (event) => {
            const hashTarget = control.getAttribute("href");
            const target = control.dataset.section || (hashTarget && hashTarget.startsWith("#") ? hashTarget.slice(1) : "");

            if (!target) return;
            const sectionExists = Array.from(sections).some(section => section.id === target);
            if (!sectionExists) return;

            event.preventDefault();
            showSection(target);
        });
    });

    showSection("home");
});

// Necessary voice list load listener for Chrome speech synthesis
if (supportsSpeech && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
        // reload/reset preferred voice if speech synthesis is triggered
    };
}

// ==========================================================================
// Parallax Mouse-Following Subsystem (lerp-interpolated variables)
// ==========================================================================
(() => {
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let currentBounce = 0; // smooth vertical nodding offset
    let speakingTime = 0; // accumulated time for sine-wave oscillation
    const lerpFactor = 0.08; // smooth deceleration lag

    document.addEventListener("mousemove", (e) => {
        // Compute normalized coordinates relative to center (-0.5 to 0.5)
        const normX = (e.clientX / window.innerWidth) - 0.5;
        const normY = (e.clientY / window.innerHeight) - 0.5;
        
        targetX = normX;
        targetY = normY;
    });

    function renderParallax() {
        // Interpolate current values towards targets
        currentX += (targetX - currentX) * lerpFactor;
        currentY += (targetY - currentY) * lerpFactor;
        
        // Calculate smooth, low-frequency speaking nod
        let nodRot = 0;
        if (isSpeaking) {
            speakingTime += 0.06; // Slow nodding frequency (about 1 cycle per second)
            // Oscillate vertical offset very subtly (between 0.0px and 0.3px)
            const targetBounce = (Math.sin(speakingTime) + 0.5) * 0.2;
            currentBounce += (targetBounce - currentBounce) * 0.08;
            // Add a matching, extremely tiny rotation oscillation (-0.05deg to 0.05deg)
            nodRot = Math.sin(speakingTime) * 0.05;
        } else {
            speakingTime = 0;
            // Smoothly return nod offset to 0 when idle
            currentBounce += (0 - currentBounce) * 0.08;
        }
        
        // Parallax multipliers (tuned to be very subtle and premium)
        const bgX = -currentX * 12; // shifts opposite to mouse
        const bgY = -currentY * 12;
        
        const charX = currentX * 18; // shifts with mouse
        const charY = currentY * 6;
        const charRotate = currentX * 0.8 + nodRot; // rotates slightly, adding speaking nod rotation
        
        const fgX = currentX * 25; // foreground UI items shift more dynamically
        const fgY = currentY * 15;
        
        // Write values to CSS Custom Variables
        document.documentElement.style.setProperty('--mouse-x', `${charX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${charY}px`);
        document.documentElement.style.setProperty('--mouse-rot', `${charRotate}deg`);
        
        document.documentElement.style.setProperty('--mouse-bg-x', `${bgX}px`);
        document.documentElement.style.setProperty('--mouse-bg-y', `${bgY}px`);
        
        document.documentElement.style.setProperty('--mouse-fg-x', `${fgX}px`);
        document.documentElement.style.setProperty('--mouse-fg-y', `${fgY}px`);
        
        document.documentElement.style.setProperty('--head-bounce', `${currentBounce}px`);
        
        requestAnimationFrame(renderParallax);
    }
    
    // Start animation loop
    requestAnimationFrame(renderParallax);
})();
