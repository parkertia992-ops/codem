
/* ==========================================================================
   CODELAB — VOICE INPUT
   Captura de micrófono y transcripción mediante Whisper Large v3.
   ========================================================================== */

class CodelabVoiceInput {
    constructor() {
        this.recorder = null;
        this.stream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isProcessing = false;

        this.init();
    }

    init() {
        if (document.getElementById("codelab-voice-button")) return;

        const wrapper = document.querySelector(
            ".codelab-chat-input-wrapper"
        );

        const sendButton = document.querySelector(
            ".codelab-chat-send-btn"
        );

        const input = document.getElementById("codelabInput");

        if (!wrapper || !sendButton || !input) {
            console.error("CODELAB VOICE: No se encontró la barra principal.");
            return;
        }

        // Crear botón del micrófono.
        this.button = document.createElement("button");

        this.button.id = "codelab-voice-button";
        this.button.type = "button";
        this.button.className = "codelab-voice-button";
        this.button.title = "Dictar mensaje";
        this.button.setAttribute("aria-label", "Iniciar dictado");

        this.button.innerHTML = `
            <svg viewBox="0 0 24 24"
                width="21"
                height="21"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3"></rect>
                <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
                <path d="M12 19v3"></path>
            </svg>
        `;

        wrapper.insertBefore(this.button, sendButton);

        this.button.addEventListener("click", () => {
            if (this.isProcessing) return;

            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });
    }

    async startRecording() {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Tu navegador no permite acceder al micrófono. Utiliza HTTPS y un navegador compatible."
                );
            }

            if (!window.MediaRecorder) {
                throw new Error(
                    "Tu navegador no admite grabación de audio."
                );
            }

            // Solicitar acceso al micrófono del dispositivo.
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const formats = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4",
                "audio/ogg;codecs=opus"
            ];

            const mimeType = formats.find(type =>
                MediaRecorder.isTypeSupported(type)
            );

            this.recorder = mimeType
                ? new MediaRecorder(this.stream, { mimeType })
                : new MediaRecorder(this.stream);

            this.audioChunks = [];

            this.recorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.recorder.onstop = () => {
                const audioType = this.recorder.mimeType ||
                    "audio/webm";

                const audioBlob = new Blob(this.audioChunks, {
                    type: audioType
                });

                this.releaseMicrophone();
                this.transcribeAudio(audioBlob);
            };

            this.recorder.onerror = () => {
                this.releaseMicrophone();

                this.isRecording = false;
                this.updateButton();

                this.showError("Se produjo un error al grabar el audio.");
            };

            this.recorder.start();

            this.isRecording = true;
            this.updateButton();

        } catch (error) {
            this.releaseMicrophone();

            this.isRecording = false;
            this.updateButton();

            console.error("CODELAB MICROPHONE ERROR:", error);

            this.showError(
                error.message ||
                "No se pudo acceder al micrófono."
            );
        }
    }

    stopRecording() {
        if (!this.recorder || this.recorder.state !== "recording") {
            return;
        }

        this.isRecording = false;
        this.isProcessing = true;

        this.updateButton();

        this.recorder.stop();
    }

    async transcribeAudio(audioBlob) {
        try {
            if (!audioBlob || audioBlob.size === 0) {
                throw new Error("La grabación está vacía.");
            }

            if (audioBlob.size > 4 * 1024 * 1024) {
                throw new Error(
                    "El audio supera los 4 MB. Intenta una grabación más corta."
                );
            }

            this.isProcessing = true;
            this.updateButton();

            const extension = this.getExtension(audioBlob.type);

            const formData = new FormData();

            formData.append(
                "audio",
                audioBlob,
                `codelab-recording.${extension}`
            );

            const response = await fetch("/api/transcribe", {
                method: "POST",
                body: formData
            });

            const responseText = await response.text();

            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    "El servidor devolvió una respuesta inválida."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.error || `Error HTTP ${response.status}`
                );
            }

            if (typeof data.text !== "string" || !data.text.trim()) {
                throw new Error(
                    "No se detectó voz en la grabación."
                );
            }

            this.insertTranscript(data.text);

        } catch (error) {
            console.error("CODELAB TRANSCRIPTION ERROR:", error);
            this.showError(error.message);

        } finally {
            this.isProcessing = false;
            this.updateButton();
        }
    }

    getExtension(mimeType) {
        if (mimeType.includes("mp4")) return "mp4";
        if (mimeType.includes("ogg")) return "ogg";
        if (mimeType.includes("wav")) return "wav";

        return "webm";
    }

    insertTranscript(text) {
        const input = document.getElementById("codelabInput");

        if (!input) {
            throw new Error("No se encontró la barra de escritura.");
        }

        const existingText = input.value;

        const separator = existingText.length > 0
            ? (existingText.endsWith("\n") ? "" : "\n")
            : "";

        input.value = existingText + separator + text.trim();

        input.dispatchEvent(
            new Event("input", { bubbles: true })
        );

        input.focus();
    }

    releaseMicrophone() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    updateButton() {
        if (!this.button) return;

        this.button.classList.toggle(
            "is-recording",
            this.isRecording
        );

        this.button.classList.toggle(
            "is-processing",
            this.isProcessing
        );

        if (this.isRecording) {
            this.button.title = "Detener grabación";
            this.button.setAttribute("aria-label", "Detener grabación");
        } else if (this.isProcessing) {
            this.button.title = "Transcribiendo audio...";
            this.button.setAttribute("aria-label", "Transcribiendo audio");
        } else {
            this.button.title = "Dictar mensaje";
            this.button.setAttribute("aria-label", "Iniciar dictado");
        }

        this.button.disabled = this.isProcessing;
    }

    showError(message) {
        console.error("CODELAB VOICE:", message);

        alert(`CodeLab — Voz a texto:\n${message}`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.codelabVoiceInput = new CodelabVoiceInput();
});
