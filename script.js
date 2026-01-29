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
        this.transitionTime = 3; // Seconds to calm down from max stress
        this.decay = 100 / (3 * 60); // Default decay based on 3s
        this.threshold = 10; // Volume threshold to start accumulating stress

        // Load settings from localStorage
        this.loadSettings();

        this.states = {
            SLEEP: { min: 0, image: 'sleep.png', class: 'state-sleep', text: "Zzz..." },
            CALM: { min: 10, image: 'calm.png', class: 'state-calm', text: "Meow" },
            ANXIOUS: { min: 30, image: 'anxious.png', class: 'state-anxious', text: "O_O" },
            IRRITATED: { min: 60, image: 'irritated.png', class: 'state-irritated', text: "Grrr!" },
            PANIC: { min: 90, image: 'panic.png', class: 'state-panic', text: "AAAAH!!!" }
        };
    }

    update(volume) {
        // volume is 0-255 roughly (average from AudioMonitor)

        if (volume > this.threshold) {
            // Add stress based on volume excess and sensitivity
            // Dampened significantly: * 0.005 instead of 0.05
            // This makes it take longer to get angry
            const addedStress = (volume - this.threshold) * this.sensitivity * 0.005;
            this.stress += addedStress;
        } else {
            // Decay
            this.stress -= this.decay;
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

    determineState() {
        let newState = this.state;

        if (this.stress >= 90) newState = 'PANIC';
        else if (this.stress >= 60) newState = 'IRRITATED';
        else if (this.stress >= 30) newState = 'ANXIOUS';
        else if (this.stress >= 10) newState = 'CALM';
        else newState = 'SLEEP';

        if (newState !== this.state) {
            this.state = newState;
            if (this.callbacks.onStateChange) {
                this.callbacks.onStateChange(this.states[this.state]);
            }
        }
    }

    setSettings(sensitivity, transitionTime) {
        this.sensitivity = sensitivity;
        this.transitionTime = transitionTime;
        // Calculate decay to drop from 100 to 0 in transitionTime seconds (assuming 60fps)
        this.decay = this.maxStress / (Math.max(0.1, this.transitionTime) * 60);

        // Save to localStorage
        localStorage.setItem('noise_cat_settings', JSON.stringify({
            sensitivity: this.sensitivity,
            transitionTime: this.transitionTime
        }));
    }

    loadSettings() {
        const saved = localStorage.getItem('noise_cat_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.sensitivity) this.sensitivity = settings.sensitivity;
                if (settings.transitionTime) this.transitionTime = settings.transitionTime;

                // Recalculate decay
                this.decay = this.maxStress / (Math.max(0.1, this.transitionTime) * 60);
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        }
    }
}

/**
 * Main Application Logic
 */

// Image paths
const stateImages = {
    SLEEP: './assets/cats/sleep.png',
    CALM: './assets/cats/calm.png',
    ANXIOUS: './assets/cats/anxious.png',
    IRRITATED: './assets/cats/irritated.png',
    PANIC: './assets/cats/panic.png'
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
const decayInput = document.getElementById('decay');
const sensitivityVal = document.getElementById('sensitivity-val');
const decayVal = document.getElementById('decay-val');

const audioMonitor = new AudioMonitor();

const stateMachine = new StateMachine({
    onStateChange: (stateData) => {
        updateView(stateData);
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

sensitivityInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sensitivityVal.textContent = val.toFixed(1);
    stateMachine.setSettings(val, parseFloat(decayInput.value));
});

decayInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    decayVal.textContent = val.toFixed(0);
    stateMachine.setSettings(parseFloat(sensitivityInput.value), val);
});

function updateView(stateData) {
    const currentStateKey = stateMachine.state;
    catImage.src = stateImages[currentStateKey];

    // Change text
    statusBubble.textContent = stateData.text;
    statusBubble.classList.add('visible');

    // Change background class
    document.body.className = stateData.class;

    // Shake effect for high stress
    if (stateData.class === 'state-panic' || stateData.class === 'state-irritated') {
        catImage.classList.add('shake');
    } else {
        catImage.classList.remove('shake');
    }
}

function loop() {
    const volume = audioMonitor.getVolume();
    const result = stateMachine.update(volume);

    // Update meter
    const percent = Math.min(100, Math.max(0, (volume / 255) * 100 * 3)); // *3 to make it more visible
    meterFill.style.width = `${percent}%`;
    volumeDisplay.textContent = Math.round(volume);

    animationFrameId = requestAnimationFrame(loop);
}

// Initial state load
updateView(stateMachine.states.SLEEP);

// Initialize inputs with loaded settings
if (stateMachine.sensitivity) {
    sensitivityInput.value = stateMachine.sensitivity;
    sensitivityVal.textContent = stateMachine.sensitivity.toFixed(1);
}
if (stateMachine.transitionTime) {
    decayInput.value = stateMachine.transitionTime;
    decayVal.textContent = stateMachine.transitionTime.toFixed(0);
}
