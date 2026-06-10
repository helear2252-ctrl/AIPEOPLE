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
    avatar_images: {
        Female: "assets/nova_avatar.png",
        Male: "assets/avatar_male.png"
    }
};

const BACKEND_BASE_URL = "";
let isBackendOnline = false;
let isSpeaking = false;
let speechUtterance = null;
let lipSyncInterval = null;

// DOM Elements
const backendStatusBadge = document.getElementById("backend-status-badge");
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
 * Simulates a single blink action (fast shut, fast open)
 */
function triggerBlink() {
    if (isSpeaking) return; // Skip blink during speech transitions occasionally
    
    eyeLeft.classList.add("blink");
    eyeRight.classList.add("blink");
    
    setTimeout(() => {
        eyeLeft.classList.remove("blink");
        eyeRight.classList.remove("blink");
    }, 120); // Blink duration 120ms
}

/**
 * Dynamic Eye Blinking Engine (random intervals between 3s and 6s)
 */
function startBlinkEngine() {
    const minDelay = 3000;
    const maxDelay = 6000;
    
    function scheduleNextBlink() {
        const nextDelay = Math.random() * (maxDelay - minDelay) + minDelay;
        setTimeout(() => {
            triggerBlink();
            scheduleNextBlink();
        }, nextDelay);
    }
    scheduleNextBlink();
}

/**
 * Posture Shifting & Micro-movements (slight rotation & shift to look lifelike)
 */
function startPostureShiftEngine() {
    setInterval(() => {
        if (isSpeaking) return; // Keep posture focused during speech
        
        // Micro scale, rotation (within 0.6 deg) and translation (within 1.5px)
        const angle = (Math.random() * 0.8 - 0.4).toFixed(2);
        const shiftX = (Math.random() * 2 - 1).toFixed(1);
        const shiftY = (Math.random() * 1.5 - 0.75).toFixed(1);
        
        avatarImg.style.transform = `rotate(${angle}deg) translate(${shiftX}px, ${shiftY}px)`;
    }, 3000);
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
    speechWaves.classList.add("active");
    updateAvatarState("SPEAKING");
    
    // The speaking nod animation is driven smoothly inside the requestAnimationFrame loop in real time.
}

function stopLipSyncAnimation() {
    if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
    }
    
    // mouthOverlay.classList.remove("speaking"); // Disabled for B-level upgrade
    // mouthOverlay.style.height = "0px"; // Disabled for B-level upgrade
    speechWaves.classList.remove("active");
    updateAvatarState("IDLE");
}

/**
 * Updates HUD state text and colors
 */
function updateAvatarState(state) {
    avatarState.className = "hud-item state-badge " + state.toLowerCase();
    stateText.textContent = state;
}

// ==========================================================================
// Speech Synthesis Subsystem (Web Speech API)
// ==========================================================================

function speakResponse(text) {
    if (!systemSettings.voice_enabled) return;
    
    // Stop any current voice output
    window.speechSynthesis.cancel();
    stopLipSyncAnimation();
    
    // Clean text from Markdown elements for cleaner reading
    const cleanText = text.replace(/[*#`_\-]/g, "").substring(0, 300); // safety cap
    
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
        isSpeaking = false;
        stopLipSyncAnimation();
    };
    
    speechUtterance.onerror = () => {
        isSpeaking = false;
        stopLipSyncAnimation();
    };
    
    window.speechSynthesis.speak(speechUtterance);
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
    
    // Set avatar photo
    const imagePath = systemSettings.gender === "Female" ? 
        systemSettings.avatar_images.Female : systemSettings.avatar_images.Male;
    avatarImg.src = imagePath;
    
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
    
    // Change state to Listening / Thinking
    updateAvatarState("LISTENING");
    
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
                speakResponse(data.response);
            } else {
                appendMessage("secretary", "I encountered a communication error with my backend cognitive modules.");
                updateAvatarState("IDLE");
            }
        } catch (error) {
            appendMessage("secretary", "My backend services appear to have disconnected. Reverting to local operations.");
            simulateLocalResponse(text);
        }
    } else {
        // Run simulated response after a realistic delay (800ms)
        setTimeout(() => {
            simulateLocalResponse(text);
        }, 800);
    }
}

/**
 * Client-side simulation of NOVA when no standalone API is running
 */
function simulateLocalResponse(text) {
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
    speakResponse(reply);
}

// ==========================================================================
// Initialization & Events
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Initial UI apply
    applySettingsUI();
    
    // Start animation engines
    startBlinkEngine();
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
            window.speechSynthesis.cancel();
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
        triggerBlink(); // micro eye blink to show interaction
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
if (window.speechSynthesis.onvoiceschanged !== undefined) {
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
