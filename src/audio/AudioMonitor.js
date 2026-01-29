export class AudioMonitor {
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

        // Normalize to 0-1 range roughly, but return raw average for tuning if needed
        return average; // 0 to 255
    }

    stop() {
        if (this.audioContext) {
            this.audioContext.close();
            this.isListening = false;
        }
    }
}
