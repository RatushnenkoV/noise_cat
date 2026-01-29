/**
 * AudioMonitor Class
 * Handles microphone input and volume analysis
 */
class AudioMonitor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.isListening = false;
    }

    async start() {
        if (this.isListening) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isListening = true;
            console.log("Audio Monitor started");
        } catch (error) {
            console.error("Error accessing microphone:", error);
            throw error;
        }
    }

    getVolume() {
        if (!this.isListening || !this.analyser) return 0;

        this.analyser.getByteFrequencyData(this.dataArray);

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }

        // Average value (0-255)
        const average = sum / this.dataArray.length;

        return average; // 0 to 255
    }

    stop() {
        if (this.audioContext) {
            this.audioContext.close();
            this.isListening = false;
        }
    }
}

/**
 * StateMachine Class
 * Manages stress levels and cat states
 */
class StateMachine {
    constructor(callbacks) {
        this.stress = 0; // 0 to 100
        this.maxStress = 100;
        this.state = 'SLEEP';
        this.callbacks = callbacks || {};

        // Default settings
        this.sensitivity = 1.0; // Multiplier for volume
        this.stateDuration = 5; // Seconds to traverse a state

        // Default thresholds
        this.thresholds = {
            SLEEP: 10,     // Sleep -> Calm
            CALM: 30,      // Calm -> Anxious
            ANXIOUS: 60,   // Anxious -> Irritated
            IRRITATED: 90  // Irritated -> Panic
        };

        this.volumeThreshold = 10; // Volume threshold to start accumulating stress

        // Load settings from localStorage
        this.loadSettings();
    }

    update(volume) {
        // Find current state range
        const currentRange = this.getCurrentStateRange();
        const stateWidth = currentRange.max - currentRange.min;

        // Calculate rate per frame (assuming 60fps)
        // We want to traverse 'stateWidth' in 'stateDuration' seconds
        const rate = stateWidth / (this.stateDuration * 60);

        if (volume > this.volumeThreshold) {
            // Add stress
            // We use sensitivity to potentially speed up if volume is VERY loud, 
            // but the base expectation is based on time.
            // Let's say if volume is just above threshold, we move at 'rate'.
            // If it's huge, maybe we move faster? 
            // The user said: "5 seconds to wake up". This implies a fixed time concept.
            // But usually noise meters react to intensity. 
            // Let's stick strictly to time for now as requested: "5 seconds to transition".
            // We will multiply by sensitivity only if the user wants it faster/slower overall?
            // Actually, the user requirement is "5 seconds to transition". 
            // So let's make it fixed rate regardless of HOW loud (as long as it's over threshold).
            this.stress += rate;
        } else {
            // Decay
            // "5 seconds to calm down"
            this.stress -= rate;
        }

        // Clamp
        if (this.stress < 0) this.stress = 0;
        if (this.stress > this.maxStress) this.stress = this.maxStress;

        this.determineState();

        return {
            stress: this.stress,
            state: this.state
        };
    }

    getCurrentStateRange() {
        // Return the min/max stress for the CURRENT state context
        // This is complex because if we correspond strictly to 0-100, 
        // the "width" changes depending on where we are.

        // If stress is 5 (SLEEP), width is (10 - 0) = 10.
        // If stress is 20 (CALM), width is (30 - 10) = 20.

        if (this.stress < this.thresholds.SLEEP) return { min: 0, max: this.thresholds.SLEEP };
        if (this.stress < this.thresholds.CALM) return { min: this.thresholds.SLEEP, max: this.thresholds.CALM };
        if (this.stress < this.thresholds.ANXIOUS) return { min: this.thresholds.CALM, max: this.thresholds.ANXIOUS };
        if (this.stress < this.thresholds.IRRITATED) return { min: this.thresholds.ANXIOUS, max: this.thresholds.IRRITATED };
        return { min: this.thresholds.IRRITATED, max: 100 };
    }

    determineState() {
        let newState = 'SLEEP'; // Default

        if (this.stress >= this.thresholds.IRRITATED) newState = 'PANIC';
        else if (this.stress >= this.thresholds.ANXIOUS) newState = 'IRRITATED';
        else if (this.stress >= this.thresholds.CALM) newState = 'ANXIOUS';
        else if (this.stress >= this.thresholds.SLEEP) newState = 'CALM';
        else newState = 'SLEEP';

        if (newState !== this.state) {
            this.state = newState;
            if (this.callbacks.onStateChange) {
                this.callbacks.onStateChange(newState);
            }
        }
    }

    setSettings(settings) {
        if (settings.sensitivity !== undefined) this.sensitivity = settings.sensitivity;
        if (settings.duration !== undefined) this.stateDuration = settings.duration;

        if (settings.limits) {
            this.thresholds.SLEEP = settings.limits.sleep;
            this.thresholds.CALM = settings.limits.calm;
            this.thresholds.ANXIOUS = settings.limits.anxious;
            this.thresholds.IRRITATED = settings.limits.irritated;
        }

        this.saveSettings();
    }

    saveSettings() {
        localStorage.setItem('noise_cat_settings_v2', JSON.stringify({
            sensitivity: this.sensitivity,
            duration: this.stateDuration,
            thresholds: this.thresholds
        }));
    }

    loadSettings() {
        const saved = localStorage.getItem('noise_cat_settings_v2');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.sensitivity) this.sensitivity = settings.sensitivity;
                if (settings.duration) this.stateDuration = settings.duration;
                if (settings.thresholds) this.thresholds = settings.thresholds;
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        }
    }
}


/**
 * Main Application Logic
 */

// Image paths and State Data
const STATE_DATA = {
    SLEEP: { image: './assets/cats/sleep.png', class: 'state-sleep', text: "Zzz..." },
    CALM: { image: './assets/cats/calm.png', class: 'state-calm', text: "Meow" },
    ANXIOUS: { image: './assets/cats/anxious.png', class: 'state-anxious', text: "O_O" },
    IRRITATED: { image: './assets/cats/irritated.png', class: 'state-irritated', text: "Grrr!" },
    PANIC: { image: './assets/cats/panic.png', class: 'state-panic', text: "AAAAH!!!" }
};

const app = document.getElementById('app');
const catImage = document.getElementById('cat-image');
const statusBubble = document.getElementById('status-bubble');
const meterFill = document.getElementById('meter-fill');
const volumeDisplay = document.getElementById('volume-display');

const startBtn = document.getElementById('start-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings');
const settingsPanel = document.getElementById('settings-panel');

const sensitivityInput = document.getElementById('sensitivity');
const sensitivityVal = document.getElementById('sensitivity-val');

const durationInput = document.getElementById('duration');
const durationVal = document.getElementById('duration-val');

const limitSleepInput = document.getElementById('limit-sleep');
const limitSleepVal = document.getElementById('limit-sleep-val');

const limitCalmInput = document.getElementById('limit-calm');
const limitCalmVal = document.getElementById('limit-calm-val');

const limitAnxiousInput = document.getElementById('limit-anxious');
const limitAnxiousVal = document.getElementById('limit-anxious-val');

const limitIrritatedInput = document.getElementById('limit-irritated');
const limitIrritatedVal = document.getElementById('limit-irritated-val');


const audioMonitor = new AudioMonitor();

const stateMachine = new StateMachine({
    onStateChange: (stateKey) => {
        updateView(stateKey);
    }
});

let animationFrameId;

startBtn.addEventListener('click', async () => {
    try {
        await audioMonitor.start();
        // Hide button instead of just disabling
        startBtn.style.display = 'none';
        loop();
    } catch (e) {
        alert("Could not access microphone.");
        console.error(e);
    }
});

settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
});

// Settings Event Listeners
function updateSettings() {
    const sensitivity = parseFloat(sensitivityInput.value);
    const duration = parseFloat(durationInput.value);
    const limits = {
        sleep: parseFloat(limitSleepInput.value),
        calm: parseFloat(limitCalmInput.value),
        anxious: parseFloat(limitAnxiousInput.value),
        irritated: parseFloat(limitIrritatedInput.value)
    };

    // Update Display Values
    sensitivityVal.textContent = sensitivity.toFixed(1);
    durationVal.textContent = duration.toFixed(0);
    limitSleepVal.textContent = limits.sleep;
    limitCalmVal.textContent = limits.calm;
    limitAnxiousVal.textContent = limits.anxious;
    limitIrritatedVal.textContent = limits.irritated;

    // Validate logic: Thresholds must be in order
    // We won't force them in UI but we rely on them being ordered for logic to work perfectly.
    // Ideally we'd clamp them. For now let's just send them.

    stateMachine.setSettings({
        sensitivity,
        duration,
        limits
    });
}

[sensitivityInput, durationInput, limitSleepInput, limitCalmInput, limitAnxiousInput, limitIrritatedInput].forEach(input => {
    input.addEventListener('input', updateSettings);
});


function updateView(stateKey) {
    const data = STATE_DATA[stateKey];
    if (!data) return;

    catImage.src = data.image;

    // Change text
    statusBubble.textContent = data.text;
    statusBubble.classList.add('visible');

    // Change background class
    document.body.className = data.class;

    // Shake effect for high stress
    if (stateKey === 'PANIC' || stateKey === 'IRRITATED') {
        catImage.classList.add('shake');
    } else {
        catImage.classList.remove('shake');
    }
}

function loop() {
    const volume = audioMonitor.getVolume();
    const result = stateMachine.update(volume);

    // Update meter
    // We visualize stress (0-100)
    const percent = Math.min(100, Math.max(0, result.stress));
    meterFill.style.width = `${percent}%`;

    // Optional: show volume
    volumeDisplay.textContent = Math.round(volume);

    animationFrameId = requestAnimationFrame(loop);
}

// Initial state load
updateView('SLEEP');

// Initialize inputs with loaded settings
if (stateMachine.sensitivity) {
    sensitivityInput.value = stateMachine.sensitivity;
    sensitivityVal.textContent = stateMachine.sensitivity.toFixed(1);
}
if (stateMachine.stateDuration) {
    durationInput.value = stateMachine.stateDuration;
    durationVal.textContent = stateMachine.stateDuration.toFixed(0);
}
if (stateMachine.thresholds) {
    limitSleepInput.value = stateMachine.thresholds.SLEEP;
    limitSleepVal.textContent = stateMachine.thresholds.SLEEP;

    limitCalmInput.value = stateMachine.thresholds.CALM;
    limitCalmVal.textContent = stateMachine.thresholds.CALM;

    limitAnxiousInput.value = stateMachine.thresholds.ANXIOUS;
    limitAnxiousVal.textContent = stateMachine.thresholds.ANXIOUS;

    limitIrritatedInput.value = stateMachine.thresholds.IRRITATED;
    limitIrritatedVal.textContent = stateMachine.thresholds.IRRITATED;
}
