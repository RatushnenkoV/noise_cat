export class StateMachine {
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
            // Example: volume 50, threshold 10 -> diff 40. * sensitivity 1.0 = +0.4 stress roughly?
            // Need to calibrate. 60fps * 0.5 = 30 stress/sec. That's fast.
            // Let's divide by a frame factor.
            const addedStress = (volume - this.threshold) * this.sensitivity * 0.05;
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

        // Find the highest state range we are in
        // Iterate keys in reverse order of min value to find the highest match?
        // Actually specific ranges:
        if (this.stress >= 90) newState = 'PANIC';
        else if (this.stress >= 60) newState = 'IRRITATED';
        else if (this.stress >= 30) newState = 'ANXIOUS';
        else if (this.stress >= 10) newState = 'CALM';
        else newState = 'SLEEP';

        // Hysteresis allows smooth transitions, but here we just use ranges on the accumulator.
        // If state changed, callback
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
        // decay per frame = 100 / (seconds * 60)
        this.decay = this.maxStress / (Math.max(0.1, this.transitionTime) * 60);
    }
}
