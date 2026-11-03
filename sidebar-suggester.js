
/* ==========================================================================
   CODELAB — SIDEBAR SUGGESTER
   IA independiente de sugerencias mediante Groq GPT-OSS 20B.
   Comparte el historial real de conversación con la IA principal.
   ========================================================================== */

class CodelabDynamicSidebar {
    constructor() {
        this.isOpen = false;
        this.isLoading = false;
        this.requestId = 0;

        this.initUI();
    }

    initUI() {
        // Evitar crear dos barras si el archivo se carga más de una vez.
        if (document.getElementById("codelab-menu-toggle")) return;

        const inputWrapper = document.querySelector(
            ".codelab-chat-input-wrapper"
        );

        const inputField = document.getElementById("codelabInput");

        if (!inputWrapper || !inputField) {
            console.error("CODELAB: No se encontró la barra principal.");
            return;
        }

        // Botón de tres rayitas.
        const menuBtn = document.createElement("button");

        menuBtn.id = "codelab-menu-toggle";
        menuBtn.type = "button";
        menuBtn.innerHTML = "☰";
        menuBtn.title = "Sugerencias inteligentes";
        menuBtn.setAttribute("aria-label", "Abrir sugerencias");
        menuBtn.setAttribute("aria-expanded", "false");

        Object.assign(menuBtn.style, {
            position: "relative",
            flex: "0 0 38px",
            width: "38px",
            height: "38px",
            backgroundColor: "#000000",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "19px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "8px"
        });

        // Colocar las tres rayitas dentro de la barra existente.
        inputWrapper.insertBefore(menuBtn, inputField);

        // Panel lateral de sugerencias.
        const sidebar = document.createElement("aside");

        sidebar.id = "codelab-sidebar-panel";

        Object.assign(sidebar.style, {
            position: "fixed",
            top: "0",
            left: "-320px",
            width: "300px",
            height: "100%",
            backgroundColor: "#11111b",
            borderRight: "1px solid #313244",
            boxShadow: "4px 0 20px rgba(0,0,0,0.5)",
            zIndex: "2000",
            transition: "left 0.3s ease",
            padding: "20px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            color: "#cdd6f4",
            fontFamily: "inherit"
        });

        sidebar.innerHTML = `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:20px;
                border-bottom:1px solid #313244;
                padding-bottom:12px;
            ">
                <h3 style="
                    margin:0;
                    font-size:15px;
                    color:#89b4fa;
                ">Mejoras sugeridas</h3>

                <button
                    id="codelab-sidebar-close"
                    type="button"
                    aria-label="Cerrar sugerencias"
                    style="
                        background:none;
                        border:none;
                        color:#a6adc8;
                        font-size:18px;
                        cursor:pointer;
                    "
                >✕</button>
            </div>

            <div
                id="codelab-suggestions-container"
                style="
                    display:flex;
                    flex-direction:column;
                    gap:10px;
                    overflow-y:auto;
                "
            >
                <p style="
                    font-size:12px;
                    color:#a6adc8;
                    text-align:center;
                    margin-top:20px;
                ">
                    Abre las sugerencias para analizar tu proyecto.
                </p>
            </div>
        `;

        document.body.appendChild(sidebar);

        // Estilos exclusivos de las sugerencias.
        const styleSheet = document.createElement("style");

        styleSheet.textContent = `
            .codelab-dynamic-chip {
                background-color: #1e1e2e;
                color: #cdd6f4;
                border: 1px solid #313244;
                padding: 10px 12px;
                border-radius: 8px;
                text-align: left;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                line-height: 1.5;
            }

            .codelab-dynamic-chip:hover {
                background-color: #313244;
                border-color: #89b4fa;
                color: #ffffff;
            }

            .codelab-dynamic-chip:disabled {
                opacity: 0.5;
                cursor: wait;
            }
        `;

        document.head.appendChild(styleSheet);

        // Abrir y cerrar el panel.
        menuBtn.addEventListener("click", () => {
            this.toggleSidebar(sidebar, menuBtn);

            if (this.isOpen) {
                this.generarSugerenciasConGroq();
            }
        });

        sidebar.querySelector("#codelab-sidebar-close")
            .addEventListener("click", () => {
                this.toggleSidebar(sidebar, menuBtn);
            });
    }

    toggleSidebar(sidebar, menuBtn) {
        this.isOpen = !this.isOpen;

        sidebar.style.left = this.isOpen ? "0" : "-320px";

        menuBtn.setAttribute(
            "aria-expanded",
            String(this.isOpen)
        );
    }

    // Obtener la conversación real de la IA principal.
    extraerContextoActual() {
        if (typeof window.codelabGetChatMemory !== "function") {
            throw new Error(
                "La conexión con la memoria principal todavía no está disponible."
            );
        }

        const conversation = window.codelabGetChatMemory();

        if (!Array.isArray(conversation) || conversation.length === 0) {
            return [];
        }

        return conversation;
    }

    // Consultar GPT-OSS 20B para generar propuestas.
    async generarSugerenciasConGroq() {
        const container = document.getElementById(
            "codelab-suggestions-container"
        );

        if (!container || this.isLoading) return;

        this.isLoading = true;

        const currentRequest = ++this.requestId;

        container.innerHTML = `
            <p style="
                font-size:12px;
                color:#a6adc8;
                text-align:center;
                margin-top:20px;
            ">
                Analizando el código y la conversación...
            </p>
        `;

        try {
            const conversation = this.extraerContextoActual();

            if (conversation.length === 0) {
                container.innerHTML = `
                    <p style="font-size:12px;color:#a6adc8;">
                        Todavía no hay suficiente conversación para
                        generar sugerencias.
                    </p>
                `;
                return;
            }

            const systemPrompt = `
Eres el analista de mejoras de CodeLab.

Tu función es analizar un proyecto de programación utilizando
EXCLUSIVAMENTE el historial de conversación que recibes.

Debes identificar qué está construyendo el usuario, qué funciones
ya existen, qué cambios se han realizado, qué problemas se han
mencionado y qué decisiones ha tomado.

REGLAS OBLIGATORIAS:

1. No presupongas qué tipo de aplicación está construyendo.
2. No uses una lista fija de funciones o categorías.
3. No sugieras funciones que ya existan en el proyecto.
4. No repitas ideas que el usuario ya haya rechazado.
5. No contradigas las instrucciones anteriores del usuario.
6. No inventes tecnologías, archivos o funcionalidades existentes.
7. Busca oportunidades reales de mejora que tengan relación
   directa con el proyecto.
8. No sugieras cambios innecesarios solamente para completar
   una cantidad.
9. Prioriza propuestas concretas, útiles y técnicamente coherentes.
10. No modifiques código ni ejecutes acciones.

Genera entre 1 y 3 sugerencias, únicamente cuando el historial
proporcione información suficiente.

Cada sugerencia debe ser una propuesta breve que explique qué
se podría añadir o mejorar.

Devuelve exclusivamente un objeto JSON con esta estructura:

{
  "suggestions": [
    "Añadir ...",
    "Incorporar ..."
  ]
}

No incluyas Markdown ni explicaciones fuera del JSON.
`;

            const response = await fetch("/api/groq-proxy", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-20b",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        ...conversation,
                        {
                            role: "user",
                            content:
                                "Analiza el estado actual del proyecto y " +
                                "propón mejoras que todavía no estén implementadas."
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 500
                })
            });

            // Leer la respuesta sin asumir que siempre será JSON.
            const responseText = await response.text();

            let data;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    "El servidor devolvió una respuesta que no es JSON."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.error || `Error HTTP ${response.status}`
                );
            }

            const generatedText =
                data.choices?.[0]?.message?.content;

            if (typeof generatedText !== "string") {
                throw new Error(
                    "GPT-OSS 20B no devolvió contenido válido."
                );
            }

            // Limpiar posibles bloques Markdown.
            const cleanText = generatedText
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            let parsed;

            try {
                parsed = JSON.parse(cleanText);
            } catch {
                throw new Error(
                    "La IA no devolvió el formato de sugerencias esperado."
                );
            }

            const rawSuggestions = Array.isArray(parsed)
                ? parsed
                : parsed.suggestions;

            if (!Array.isArray(rawSuggestions)) {
                throw new Error(
                    "La respuesta no contiene una lista de sugerencias."
                );
            }

            const suggestions = [
                ...new Set(
                    rawSuggestions
                        .filter(item => typeof item === "string")
                        .map(item => item.trim())
                        .filter(item => item.length > 0)
                )
            ].slice(0, 3);

            if (currentRequest !== this.requestId) return;

            this.renderizarSugerencias(suggestions, container);

        } catch (error) {
            console.error(
                "CODELAB SUGGESTER ERROR:",
                error
            );

            if (currentRequest === this.requestId) {
                container.innerHTML = `
                    <p style="
                        font-size:12px;
                        color:#f38ba8;
                        text-align:center;
                    ">
                        No se pudieron generar las sugerencias.
                        ${this.escapeHTML(error.message)}
                    </p>
                `;
            }

        } finally {
            this.isLoading = false;
        }
    }

    // Mostrar las propuestas generadas por la IA.
    renderizarSugerencias(suggestions, container) {
        container.innerHTML = "";

        if (suggestions.length === 0) {
            container.innerHTML = `
                <p style="font-size:12px;color:#a6adc8;">
                    No se detectaron mejoras necesarias por ahora.
                </p>
            `;
            return;
        }

        suggestions.forEach(suggestion => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "codelab-dynamic-chip";
            button.textContent = `💡 ${suggestion}`;

            button.addEventListener("click", () => {
                const inputField = document.getElementById(
                    "codelabInput"
                );

                if (!inputField) return;

                // Colocar la propuesta en el campo, sin enviarla.
                inputField.value = suggestion;

                inputField.dispatchEvent(
                    new Event("input", { bubbles: true })
                );

                inputField.focus();

                const sidebar = document.getElementById(
                    "codelab-sidebar-panel"
                );

                const menuBtn = document.getElementById(
                    "codelab-menu-toggle"
                );

                if (sidebar && menuBtn && this.isOpen) {
                    this.toggleSidebar(sidebar, menuBtn);
                }
            });

            container.appendChild(button);
        });
    }

    // Evitar insertar contenido HTML procedente de una respuesta externa.
    escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }
}

// Inicializar cuando el documento esté preparado.
document.addEventListener("DOMContentLoaded", () => {
    window.codelabSidebar = new CodelabDynamicSidebar();
});
