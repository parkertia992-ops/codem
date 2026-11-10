// coderex-assets.js - Catálogo abierto de recursos profesionales para Coderex
const CODEREX_ASSETS = {
  // Acceso masivo a tipografías modernas de Google Fonts
  fonts: [
    { name: 'Inter', family: "'Inter', sans-serif", import: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap' },
    { name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", import: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' },
    { name: 'Outfit', family: "'Outfit', sans-serif", import: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap' },
    { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", import: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap' },
    { name: 'Syne', family: "'Syne', sans-serif", import: 'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap' },
    { name: 'Fira Code', family: "'Fira Code', monospace", import: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&display=swap' }
  ],

  // Animaciones profesionales fluidas en CSS nativo
  animations: {
    fadeInUp: 'animation: coderexFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    glassCard: 'background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08);',
    smoothHover: 'transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
    keyframes: `
      @keyframes coderexFadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
  },

  // Generador inteligente de imágenes de stock automáticas (para que el usuario nunca tenga que poner nada)
  getRandomImage(category = 'technology') {
    const collections = {
      technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      abstract: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      workspace: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80',
      minimal: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80'
    };
    return collections[category] || collections.technology;
  },

  // Inyector maestro que se le pasa al System Prompt de tu IA
  getSystemInstructions() {
    return `
      REGLAS DE DISEÑO PROFESIONAL OBLIGATORIAS:
      1. Nunca dejes una página plana o genérica estilo Bootstrap antiguo. Usa siempre fondos oscuros elegantes (#09090b o similares), tarjetas con efecto Glassmorphism (transparencias con blur), y sombras cuidadas.
      2. Inyecta automáticamente los enlaces de Google Fonts necesarios y usa fuentes modernas (como Inter o Plus Jakarta Sans).
      3. Añade transiciones suaves y micro-animaciones en botones y tarjetas (hover effects con elevación y sutiles brillos).
      4. SIEMPRE incluye imágenes de relleno de alta calidad usando URLs reales de Unsplash (como ${this.getRandomImage('technology')}) cuando el diseño lo requiera, para que la página jamás luzca vacía o incompleta. El usuario NUNCA debe configurar imágenes manualmente.
    `;
  }
};

module.exports = CODEREX_ASSETS;
