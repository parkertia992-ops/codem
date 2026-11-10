/**
 * professional-design-engine.js
 * Motor de diseño profesional para Coderex.
 * Eleva la calidad visual, la creatividad y la coherencia de las webs generadas.
 */

const { searchWeb, searchImages } = require("./serper-client");
const { buildDesignContext } = require("./design-reference-extractor");

// ──────────────────────────────────────────────
// 1. Perfiles estéticos de alta calidad
// ──────────────────────────────────────────────
const AESTHETIC_PROFILES = {
  "saas-premium": {
    name: "SaaS Premium / Minimal Dark",
    keywords: ["clean", "premium", "dark mode", "subtle gradients", "excellent typography", "generous whitespace"],
    references: ["linear.app", "vercel.com", "raycast.com", "arc.net", "resend.com", "cal.com"],
    principles: [
      "Tipografía excepcional (Inter, Geist, SF Pro, Satoshi)",
      "Espaciado generoso y ritmo vertical claro",
      "Sombras suaves y profundidad sutil",
      "Bordes sutiles o sin bordes",
      "Estados hover y focus muy refinados",
      "Jerarquía tipográfica fuerte (display + body + caption)"
    ]
  },
  "creative-bold": {
    name: "Creativo / Bold / Editorial",
    keywords: ["bold typography", "strong contrast", "asymmetric layout", "editorial", "expressive"],
    references: ["framer.com", "stripe.com", "notion.so", "pitch.com", "webflow.com"],
    principles: [
      "Tipografía con carácter (no solo Inter)",
      "Contraste fuerte y uso intencional del color",
      "Layouts asimétricos o con grid creativo",
      "Animaciones sutiles pero con personalidad",
      "Imágenes o ilustraciones con peso visual"
    ]
  },
  "elegant-light": {
    name: "Elegante / Light / Refined",
    keywords: ["elegant", "light", "refined", "soft shadows", "high-end", "luxury"],
    references: ["apple.com", "linear.app", "craft.do", "superhuman.com", "mirror.xyz"],
    principles: [
      "Paleta limitada y sofisticada",
      "Mucho aire (whitespace)",
      "Tipografía elegante y legible",
      "Detalles de micro-interacción",
      "Sensación de producto premium"
    ]
  },
  "dashboard-pro": {
    name: "Dashboard / Productividad profesional",
    keywords: ["dense but clean", "data-focused", "professional", "clear hierarchy", "usable"],
    references: ["linear.app", "height.app", "notion.so", "attio.com", "plain.com"],
    principles: [
      "Densidad de información bien gestionada",
      "Jerarquía visual clara en tablas y listas",
      "Colores semánticos consistentes",
      "Navegación lateral o superior muy clara",
      "Estados vacíos y loading bien diseñados"
    ]
  },
  "landing-conversion": {
    name: "Landing de alta conversión",
    keywords: ["conversion focused", "clear hierarchy", "strong CTA", "social proof", "benefit driven"],
    references: ["stripe.com", "vercel.com", "raycast.com", "cal.com", "resend.com"],
    principles: [
      "Hero con mensaje ultra claro",
      "CTA principal dominante",
      "Secciones con ritmo visual",
      "Prueba social bien integrada",
      "Tipografía grande y legible en móvil"
    ]
  }
};

// ──────────────────────────────────────────────
// 2. Detección de perfil según el prompt
// ──────────────────────────────────────────────
function detectAestheticProfile(prompt = "") {
  const lower = prompt.toLowerCase();

  if (/\b(dashboard|admin|panel|crm|saas|productividad|workspace)\b/.test(lower)) {
    return AESTHETIC_PROFILES["dashboard-pro"];
  }
  if (/\b(landing|página de aterrizaje|conversion|vender|producto|startup)\b/.test(lower)) {
    return AESTHETIC_PROFILES["landing-conversion"];
  }
  if (/\b(creativo|bold|editorial|agencia|portfolio artístico|expresivo)\b/.test(lower)) {
    return AESTHETIC_PROFILES["creative-bold"];
  }
  if (/\b(elegante|luxury|premium light|sofisticado|minimal light)\b/.test(lower)) {
    return AESTHETIC_PROFILES["elegant-light"];
  }

  // Por defecto: SaaS Premium (el más profesional y actual)
  return AESTHETIC_PROFILES["saas-premium"];
}

// ──────────────────────────────────────────────
// 3. Construcción de consultas inteligentes
// ──────────────────────────────────────────────
function buildSmartQueries(prompt, profile) {
  const base = prompt.replace(/\b(crea|crear|diseña|diseñar|hazme|genera|generar)\b/gi, "").trim();

  const webQuery = `${base} ${profile.keywords.join(" ")} website UI design ${profile.references.slice(0, 3).join(" OR ")}`;
  const imageQuery = `${base} modern website interface ${profile.name} design inspiration high quality`;

  return { webQuery, imageQuery };
}

// ──────────────────────────────────────────────
// 4. Design Brief profesional (el corazón del módulo)
// ──────────────────────────────────────────────
function buildProfessionalDesignBrief(prompt, profile, externalContext = "") {
  const lines = [
    "══════════════════════════════════════════════════",
    "PROFESSIONAL DESIGN BRIEF — CODEREX",
    "══════════════════════════════════════════════════",
    "",
    `PERFIL VISUAL SELECCIONADO: ${profile.name}`,
    "",
    "OBJETIVO:",
    "Generar una interfaz de nivel profesional, moderna y coherente.",
    "Evitar a toda costa el aspecto genérico de las IAs (bordes redondos excesivos,",
    "gradientes baratos, tipografía pobre, poco contraste, layout predecible).",
    "",
    "PRINCIPIOS OBLIGATORIOS:",
    ...profile.principles.map((p, i) => `${i + 1}. ${p}`),
    "",
    "DIRECCIÓN CREATIVA:",
    `- Keywords visuales: ${profile.keywords.join(", ")}`,
    `- Sitios de referencia prioritarios: ${profile.references.join(", ")}`,
    "",
    "REGLAS DE CALIDAD (anti-genérico):",
    "• Tipografía: usa al menos una fuente con carácter. Evita solo system-ui o Inter genérico.",
    "• Espaciado: usa un sistema de spacing consistente (4/8/12/16/24/32/48/64).",
    "• Color: define una paleta limitada (1-2 colores principales + neutrales + semánticos).",
    "• Contraste: asegúrate de que el texto sea legible (WCAG AA mínimo).",
    "• Jerarquía: el título principal debe dominar visualmente.",
    "• Micro-interacciones: hover, focus y estados activos deben sentirse premium.",
    "• Responsive: el diseño debe verse excelente en móvil, no solo 'funcionar'.",
    "• No uses emojis como iconos principales. Prefiere SVG o iconos de calidad.",
    "• Evita fondos con gradientes agresivos o efectos de glassmorphism mal aplicados.",
    "",
    "ESTRUCTURA RECOMENDADA (adaptable):",
    "1. Header limpio y funcional",
    "2. Hero con mensaje claro + CTA fuerte",
    "3. Secciones con ritmo visual (alternancia de densidad)",
    "4. Componentes bien definidos (cards, botones, inputs)",
    "5. Footer o cierre con propósito",
    "",
  ];

  if (externalContext) {
    lines.push(
      "REFERENCIAS EXTERNAS OBTENIDAS:",
      externalContext,
      ""
    );
  }

  lines.push(
    "INSTRUCCIÓN FINAL AL MODELO:",
    "Prioriza la calidad visual, la coherencia y el gusto por encima de la cantidad de elementos.",
    "Es mejor una página más simple pero con excelente ejecución, que una página cargada y genérica.",
    "══════════════════════════════════════════════════"
  );

  return lines.join("\n");
}

// ──────────────────────────────────────────────
// 5. Función principal exportada
// ──────────────────────────────────────────────
async function runProfessionalDesignEngine({ prompt, apiKey }) {
  if (!prompt || typeof prompt !== "string") {
    return "";
  }

  // Solo activamos el motor en peticiones de diseño/creación
  const isDesign = /\b(crea|crear|diseña|diseñar|construye|construir|genera|generar|mejora|rediseña|rediseñar|interfaz|interfaces|página web|pagina web|sitio web|landing|dashboard|frontend|web app|aplicación web|diseño visual|estilo visual|hazme una|haz una)\b/i.test(prompt);

  if (!isDesign) {
    return "";
  }

  const profile = detectAestheticProfile(prompt);
  let externalContext = "";

  // Intentamos obtener referencias reales si hay API key
  if (apiKey) {
    try {
      const { webQuery, imageQuery } = buildSmartQueries(prompt, profile);

      const [webResults, imageResults] = await Promise.all([
        searchWeb(apiKey, webQuery),
        searchImages(apiKey, imageQuery)
      ]);

      externalContext = buildDesignContext(webResults, imageResults);
    } catch (err) {
      console.warn("PROFESSIONAL DESIGN ENGINE: error al obtener referencias externas →", err.message);
      // Continuamos sin referencias externas, el brief sigue siendo fuerte
    }
  } else {
    console.warn("PROFESSIONAL DESIGN ENGINE: SERPER_API_KEY no configurada. Usando solo perfil interno.");
  }

  // Generamos el Design Brief completo
  const brief = buildProfessionalDesignBrief(prompt, profile, externalContext);

  return brief;
}

module.exports = {
  runProfessionalDesignEngine,
  detectAestheticProfile,
  AESTHETIC_PROFILES
};
