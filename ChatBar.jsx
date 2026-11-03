/* ========================================================================== */
/* ARCHIVO: ChatBar.jsx                                                      */
/* DESCRIPCIÓN: Componente de la barra de búsqueda inferior para Codelab.     */
/* ========================================================================== */

import React from 'react';
import './chat-bar.css'; // Importamos los estilos específicos creados arriba

export default function ChatBar({ value, onChange, onSubmit }) {
    
    // Función para manejar el envío con la tecla "Enter" sin recargar
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (onSubmit) onSubmit();
        }
    };

    return (
        /* Contenedor principal inferior */
        <div className="codelab-chat-bar-container">
            {/* Caja envolvente del input y el botón */}
            <div className="codelab-chat-input-wrapper">
                
                {/* Campo de texto de la barra */}
                <input
                    type="text"
                    className="codelab-chat-input"
                    placeholder="Pregúntale a la IA sobre tu código..."
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
                />

                {/* Botón de envío con ícono de flecha */}
                <button 
                    className="codelab-chat-send-btn" 
                    onClick={onSubmit}
                    title="Enviar pregunta"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                </button>

            </div>
        </div>
    );
}