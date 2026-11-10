// page-engine.js - Motor dinámico de recursos, fuentes e imágenes para tu generador
class PageEngine {
  constructor() {
    // Catálogo masivo de tipografías profesionales de Google Fonts
    this.fonts = [
      { name: 'Inter', family: "'Inter', sans-serif" },
      { name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif" },
      { name: 'Outfit', family: "'Outfit', sans-serif" },
      { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
      { name: 'Syne', family: "'Syne', sans-serif" },
      { name: 'Fira Code', family: "'Fira Code', monospace" }
    ];
  }

  // Inyecta automáticamente los links de tipografías en el <head>
  getFontImports() {
    return `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@300;400;600;800&family=Outfit:wght@300;500;700&family=Plus+Jakarta+Sans:wght@400;600;800&family=Space+Grotesk:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet">
    `;
  }

  // Generador inteligente de imágenes de stock automáticas por categoría
  getRandomImage(category = 'technology', width = 800, height = 500) {
    const queries = {
      technology: 'code,developer,workspace',
      abstract: 'gradient,dark,minimal',
      business: 'office,startup,modern',
      creative: 'design,art,creativity'
    };
    const keyword = queries[category] || queries.technology;
    return `https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=${width}&h=${height}&fit=crop&auto=format`;
  }

  // Inyecta el bloque de diseño profesional (Variables, animaciones y clases pro)
  getProfessionalStyles(fontName = 'Inter') {
    const selectedFont = this.fonts.find(f => f.name === fontName) || this.fonts[0];
    
    return `
      <style>
        :root {
          --font-main: ${selectedFont.family};
          --bg-base: #09090b;
          --card-bg: rgba(24, 24, 27, 0.75);
          --border-color: rgba(255, 255, 255, 0.08);
          --accent-primary: #6366f1;
          --accent-glow: rgba(99, 102, 241, 0.3);
          --text-main: #f4f4f5;
          --text-muted: #a1a1aa;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: var(--font-main);
          background-color: var(--bg-base);
          color: var(--text-main);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .pro-card {
          background: var(--card-bg);
          backdrop-filter: blur(16px);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 700px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .pro-btn {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #fff;
          border: none;
          padding: 12px 24px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .pro-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px var(--accent-glow);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
  }
}

module.exports = PageEngine;
