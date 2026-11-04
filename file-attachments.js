"use strict";

(() => {
    const SUPPORTED_EXTENSIONS = new Set([
        "js", "jsx", "ts", "tsx",
        "html", "css", "scss",
        "json", "md", "txt",
        "py", "java", "php",
        "sql", "xml", "yaml", "yml",
        "vue", "svelte", "sh",
        "env.example"
    ]);

    const MAX_FILES = 80;
    const MAX_FILE_SIZE = 200000;
    const MAX_TOTAL_SIZE = 1200000;

    let selectedFiles = [];
    let projectAnalysis = "";
    let isAnalyzing = false;

    function getExtension(name) {
        return name.toLowerCase().split(".").pop();
    }

    function isSupported(file) {
        return SUPPORTED_EXTENSIONS.has(getExtension(file.name));
    }

    function createInterface() {
        const wrapper = document.querySelector(
            ".codelab-chat-input-wrapper"
        );

        if (!wrapper || document.getElementById("codelabFilesButton")) {
            return;
        }

        const button = document.createElement("button");
        button.id = "codelabFilesButton";
        button.type = "button";
        button.className = "codelab-files-button";
        button.textContent = "Adjuntar proyecto";
        button.title = "Seleccionar archivos del proyecto";

        const input = document.createElement("input");
        input.id = "codelabFilesInput";
        input.type = "file";
        input.multiple = true;
        input.webkitdirectory = true;
        input.hidden = true;

        const status = document.createElement("div");
        status.id = "codelabFilesStatus";
        status.className = "codelab-files-status";

        wrapper.insertBefore(button, wrapper.firstChild);
        wrapper.appendChild(input);

        const container = document.querySelector(
            ".codelab-chat-bar-container"
        );

        container.appendChild(status);

        button.addEventListener("click", () => {
            input.click();
        });

        input.addEventListener("change", async () => {
            await processFiles(Array.from(input.files || []));
            input.value = "";
        });
    }

    function showStatus(message, type = "") {
        const status = document.getElementById(
            "codelabFilesStatus"
        );

        if (!status) return;

        status.textContent = message;
        status.dataset.state = type;
    }

    async function processFiles(files) {
        if (!files.length) return;

        if (files.length > MAX_FILES) {
            showStatus(`Máximo ${MAX_FILES} archivos.`);
            return;
        }

        const validFiles = files.filter(isSupported);

        if (!validFiles.length) {
            showStatus("No se encontraron archivos compatibles.");
            return;
        }

        let totalSize = 0;

        for (const file of validFiles) {
            if (file.size > MAX_FILE_SIZE) {
                showStatus(
                    `${file.name} supera el límite de tamaño.`
                );
                return;
            }

            totalSize += file.size;
        }

        if (totalSize > MAX_TOTAL_SIZE) {
            showStatus("El proyecto supera el tamaño permitido.");
            return;
        }

        selectedFiles = validFiles;

        projectAnalysis = "";
        isAnalyzing = true;

        showStatus(
            `Leyendo ${validFiles.length} archivos...`,
            "loading"
        );

        try {
            const contents = await Promise.all(
                validFiles.map(async file => ({
                    name: file.webkitRelativePath || file.name,
                    content: await file.text()
                }))
            );

            showStatus("Qwen está analizando el proyecto...", "loading");

            const response = await fetch("/api/file-analyzer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    files: contents
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "No se pudo analizar el proyecto."
                );
            }

            projectAnalysis = data.analysis;

            showStatus(
                `${data.files.length} archivos analizados correctamente.`,
                "success"
            );

        } catch (error) {
            projectAnalysis = "";

            showStatus(
                error.message || "Error al analizar los archivos.",
                "error"
            );

        } finally {
            isAnalyzing = false;
        }
    }

    function attachAnalysisToMessage() {
        const input = document.getElementById("codelabInput");

        if (!input || !projectAnalysis || isAnalyzing) {
            return;
        }

        if (input.dataset.analysisAttached === "true") {
            return;
        }

        const originalMessage = input.value.trim();

        if (!originalMessage) return;

        input.value = `
CONTEXTO DEL PROYECTO ANALIZADO POR QWEN 3.8 27B:

${projectAnalysis}

SOLICITUD DEL USUARIO:

${originalMessage}
        `.trim();

        input.dataset.analysisAttached = "true";

        queueMicrotask(() => {
            input.dataset.analysisAttached = "false";
        });
    }

    function connectToChat() {
        const sendButton = document.getElementById("codelabSendBtn");
        const input = document.getElementById("codelabInput");

        if (!sendButton || !input) return;

        sendButton.addEventListener(
            "click",
            attachAnalysisToMessage,
            true
        );

        input.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter" && !event.shiftKey) {
                    attachAnalysisToMessage();
                }
            },
            true
        );
    }

    function initialize() {
        createInterface();
        connectToChat();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    window.codelabFileAnalyzer = {
        getAnalysis: () => projectAnalysis,
        getSelectedFiles: () => selectedFiles.map(file => file.name),
        isAnalyzing: () => isAnalyzing
    };
})();
