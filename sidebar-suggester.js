/* ========================================================================== */
/* ARCHIVO: sidebar-suggester.js (Sugerencias dinámicas generadas por Groq)     */
/* ========================================================================== */

class CodelabDynamicSidebar {
    constructor() {
        this.isOpen = false;
        this.initUI();
    }

    initUI() {
        const menuBtn = document.createElement('button');
        menuBtn.id = 'codelab-menu-toggle';
        menuBtn.innerHTML = '☰';
        menuBtn.title = 'Preguntas sugeridas';
        
        Object.assign(menuBtn.style, {
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: '1000',
            backgroundColor: '#1e1e2e',
            color: '#cdd6f4',
            border: '1px solid #313244',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '18px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.2s ease'
        });

        menuBtn.onmouseover = () => menuBtn.style.backgroundColor = '#313244';
        menuBtn.onmouseout = () => menuBtn.style.backgroundColor = '#1e1e2e';

        const sidebar = document.createElement('div');
        sidebar.id = 'codelab-sidebar-panel';
        Object.assign(sidebar.style, {
            position: 'fixed',
            top: '0',
            left: '-320px',
            width: '300px',
            height: '100%',
            backgroundColor: '#11111b',
            borderRight: '1px solid #313244',
            boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
            zIndex: '999',
            transition: 'left 0.3s ease',
            padding: '20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            color: '#cdd6f4',
            fontFamily: 'inherit'
        });

        sidebar.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #313244; padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 15px; color: #89b4fa;">Preguntas sugeridas</h3>
                <button id="codelab-sidebar-close" style="background: none; border: none; color: #a6adc8; font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <div id="codelab-suggestions-container" style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto;">
                <p style="font-size: 12px; color: #a6adc8; text-align: center; margin-top: 20px;">Analizando proyecto...</p>
            </div>
        `;

        document.body.appendChild(menuBtn);
        document.body.appendChild(sidebar);

        const styleSheet = document.createElement('style');
        styleSheet.innerHTML = `
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
            }
            .codelab-dynamic-chip:hover {
                background-color: #313244;
                border-color: #89b4fa;
                color: #ffffff;
            }
        `;
        document.head.appendChild(styleSheet);

        menuBtn.onclick = () => {
            this.toggleSidebar(sidebar);
            if (this.isOpen) {
                this.generarPreguntasConGroq();
            }
        };
        sidebar.querySelector('#codelab-sidebar-close').onclick = () => this.toggleSidebar(sidebar);
    }

    toggleSidebar(sidebar) {
        this.isOpen = !this.isOpen;
        sidebar.style.left = this.isOpen ? '0' : '-320px';
    }

    extraerContextoActual() {
        const burbujasChat = document.querySelectorAll('.codelab-bubble-ai, .codelab-code-content, p');
        let contextoAcumulado = "";
        if (burbujasChat.length > 0) {
            const ultimosElementos = Array.from(burbujasChat).slice(-6);
            contextoAcumulado = ultimosElementos.map(el => el.innerText).join("\n");
        }
        return contextoAcumulado.trim() || "Proyecto web en desarrollo.";
    }

    async generarPreguntasConGroq() {
        const container = document.getElementById('codelab-suggestions-container');
        container.innerHTML = `<p style="font-size: 12px; color: #a6adc8; text-align: center; margin-top: 20px;">Generando sugerencias inteligentes...</p>`;

        const contextoActual = this.extraerContextoActual();

        try {
            const response = await fetch("/.netlify/functions/groq-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-oss-20b",
                    messages: [
                        {
                            role: "system",
                            content: "Eres un asistente de arquitectura de software. Analiza el contexto del chat provisto y genera exactamente 3 preguntas o acciones cortas y directas que el usuario podría querer hacer a continuación para mejorar, auditar o continuar su código. Devuelve ÚNICAMENTE un array JSON plano de strings con las 3 preguntas, sin formato extra de markdown ni explicaciones."
                        },
                        {
                            role: "user",
                            content: `Contexto actual del proyecto:\n${contextoActual}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 300
                })
            });

            if (!response.ok) throw new Error("Error al conectar");

            const data = await response.json();
            const textResponse = data.choices[0].message.content.trim();
            
            let preguntas = [];
            try {
                const jsonClean = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                preguntas = JSON.parse(jsonClean);
            } catch (e) {
                preguntas = textResponse.split('\n').filter(p => p.trim().length > 5).slice(0, 3);
            }

            container.innerHTML = "";
            if (preguntas.length === 0) {
                container.innerHTML = `<p style="font-size: 12px; color: #a6adc8;">No hay sugerencias disponibles por ahora.</p>`;
                return;
            }

            preguntas.forEach(pregunta => {
                const btn = document.createElement('button');
                btn.className = 'codelab-dynamic-chip';
                btn.innerText = `💡 ${pregunta.replace(/^[0-9#\-\.\*]\s*/, '')}`;
                btn.onclick = () => {
                    const inputField = document.getElementById('codelabInput');
                    if (inputField) {
                        inputField.value = pregunta;
                        inputField.focus();
                    }
                    this.toggleSidebar(document.getElementById('codelab-sidebar-panel'));
                };
                container.appendChild(btn);
            });

        } catch (error) {
            container.innerHTML = `<p style="font-size: 12px; color: #f38ba8; text-align: center;">El servicio de asistencia se encuentra temporalmente ocupado optimizando recursos. Por favor, intente de nuevo en unos segundos.</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.codelabSidebar = new CodelabDynamicSidebar();
});
