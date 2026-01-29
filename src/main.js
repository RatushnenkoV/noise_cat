import { AudioMonitor } from './audio/AudioMonitor.js';
import { StateMachine } from './logic/StateMachine.js';

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
    // Change image
    catImage.src = `assets/cats/${stateData.image}`;

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
