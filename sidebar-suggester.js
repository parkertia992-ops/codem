/* ========================================================================== */
/* ARCHIVO: sidebar-suggester.js (Módulo con lectura de contexto y delegación) */
/* ========================================================================== */

class CodelabSidebarManager {
    constructor() {
        this.isOpen = false;
        this.initUI();
    }

    // Inyecta el menú lateral de tres rayitas y los botones de acción experta
    initUI() {
        // Botón flotante de tres rayitas (Menú)
        const menuBtn = document.createElement('button');
        menuBtn.id = 'codelab-menu-toggle';
        menuBtn.innerHTML = '☰';
        menuBtn.title = 'Panel de Asistencia y Directivas 20B';
        
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

        // Panel lateral (Drawer)
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
                <h3 style="margin: 0; font-size: 15px; color: #89b4fa;">Optimizador Contextual (20B)</h3>
                <button id="codelab-sidebar-close" style="background: none; border: none; color: #a6adc8; font-size: 18px; cursor: pointer;">✕</button>
            </div>
            <p style="font-size: 12px; color: #a6adc8; line-height: 1.4; margin-bottom: 16px;">
                Este módulo analiza el código y la conversación actual para inyectar mejoras precisas al núcleo (120B):
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="codelab-suggestion-chip" data-action="cyber">
                    🛡️ Añadir Ciberseguridad al código actual
                </button>
                <button class="codelab-suggestion-chip" data-action="performance">
                    ⚡ Optimizar rendimiento y modularidad
                </button>
                <button class="codelab-suggestion-chip" data-action="ui">
                    🔘 Integrar componente UI adicional
                </button>
            </div>
        `;

        document.body.appendChild(menuBtn);
        document.body.appendChild(sidebar);

        // Estilos limpios para los botones internos del menú
        const styleSheet = document.createElement('style');
        styleSheet.innerHTML = `
            .codelab-suggestion-chip {
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
            .codelab-suggestion-chip:hover {
                background-color: #313244;
                border-color: #89b4fa;
                color: #ffffff;
            }
        `;
        document.head.appendChild(styleSheet);

        // Eventos de apertura/cierre
        menuBtn.onclick = () => this.toggleSidebar(sidebar);
        sidebar.querySelector('#codelab-sidebar-close').onclick = () => this.toggleSidebar(sidebar);

        // Capturar la selección y extraer el contexto real de la conversación
        sidebar.querySelectorAll('.codelab-suggestion-chip').forEach(btn => {
            btn.onclick = (e) => {
                const actionType = e.currentTarget.getAttribute('data-action');
                this.procesarConContextoYDelegar(actionType);
                this.toggleSidebar(sidebar);
            };
        });
    }

    toggleSidebar(sidebar) {
        this.isOpen = !this.isOpen;
        sidebar.style.left = this.isOpen ? '0' : '-320px';
    }

    // Lee lo que está pasando en pantalla/conversación para pasárselo ordenado al modelo
    extraerContextoActual() {
        // Recoge los últimos mensajes o bloques de código visibles en tu chat actual
        const burbujasChat = document.querySelectorAll('.codelab-bubble-ai, .codelab-code-content, p');
        let contextoAcumulado = "";

        if (burbujasChat.length > 0) {
            // Extraemos los fragmentos recientes para que el modelo sepa de qué hablamos
            const ultimosElementos = Array.from(burbujasChat).slice(-5);
            contextoAcumulado = ultimosElementos.map(el => el.innerText).join("\n");
        }
        return contextoAcumulado.trim() || "Contexto base del proyecto Codelab.";
    }

    // Construye la orden inteligente combinando la opción elegida + el contexto real de la charla
    procesarConContextoYDelegar(actionType) {
        const contextoChat = this.extraerContextoActual();
        let ordenEspecifica = "";

        switch(actionType) {
            case 'cyber':
                ordenEspecifica = `Teniendo en cuenta el siguiente contexto y código del proyecto:\n"""\n${contextoChat}\n"""\nPor favor, aplica estrictas capas de ciberseguridad, sanitización de datos y blindaje contra vulnerabilidades directamente sobre esta base.`;
                break;
            case 'performance':
                ordenEspecifica = `Analizando el contexto actual del proyecto:\n"""\n${contextoChat}\n"""\nOptimiza la arquitectura, reduce acoplamientos y mejora el rendimiento general del código manteniendo la estructura limpia.`;
                break;
            case 'ui':
                ordenEspecifica = `Basado en la interfaz actual descrita en el contexto:\n"""\n${contextoChat}\n"""\nDiseña e integra un nuevo componente interactivo con estilos limpios y modulares adaptados a este diseño.`;
                break;
        }

        // Inyecta la orden estructurada en el campo de texto del chat principal de forma limpia
        const inputField = document.querySelector('textarea, input[type="text"]');
        if (inputField) {
            inputField.value = ordenEspecifica;
            inputField.focus();
            
            // Opcional: Mostrar una notificación elegante al usuario de que el contexto fue capturado con éxito
            console.log("[Asistente 20B]: Contexto extraído y orden canalizada hacia el núcleo 120B con éxito.");
        }
    }
}

// Inicializar el módulo al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    window.codelabSidebar = new CodelabSidebarManager();
});
