const { runRepairPipeline } = require("./repair-pipeline");
const { toClientResponse } = require("./groq-response");
const { inspectPrompt } = require("./security/prompt-guard");
const { runDesignResearch } = require("./design-research");
const { runProfessionalDesignEngine } = require("./professional-design-engine");
const { buildProjectMap, getRelatedFiles } = require("./project-impact-engine");

// 1. IMPORTAMOS EL EXTRACTOR DE SERPER (Limpio, sin basura flotando)
const { injectSerperImages } = require('./serper-extractor');

const MAX_FILES = 100;
const MAX_TOTAL_CHARS = 300000;

// 2. EL PROMPT MAESTRO INTEGRADO COMO CONSTANTE GLOBAL
const CODEREX_ENGINE_PROMPT = `
REGLAS DE DISEÑO OBLIGATORIAS:
1. ESTÉTICA MODERNA: Prohibido usar estilos genéricos antiguos. Usa paletas oscuras de alta gama (ej. #09090b), tarjetas con efecto Glassmorphism (\`backdrop-filter: blur(16px)\`), y sombras cuidadas.
2. TIPOGRAFÍA: Inyecta automáticamente los enlaces de Google Fonts (como 'Inter', 'Plus Jakarta Sans') en el <head> y aplícalas.
3. INTERACTIVIDAD: Agrega transiciones (\`transition: all 0.3s ease\`) y efectos hover en los botones.

REGLA CRÍTICA DE IMÁGENES (¡ESTRICTAMENTE OBLIGATORIO!):
PROHIBIDO inventar rutas locales de imágenes como src="marte.jpg". Si lo haces, la página se rompe.
Siempre que necesites insertar una imagen para tarjetas o contenido, DEBES generar la etiqueta <img> utilizando el atributo 'data-search' con una consulta detallada y dejar el 'src' vacío.
FORMATO EXACTO: <img data-search="[término de búsqueda, ej: planeta marte 4k]" src="https://placeholder.coderex/img.jpg" alt="[descripción]">
PROHIBIDO usar Markdown ![...](...), PROHIBIDO pegar URLs sueltas como texto, PROHIBIDO usar <a href="...imagen...">. Solo <img>.
PROHIBIDO envolver el HTML en ```html o en <pre><code>.

FONDOS DE PANTALLA (HERO SECTIONS): Para el background-image del CSS, USA SIEMPRE ESTA URL EXACTA de Unsplash para la temática espacial:
background-image: url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80');

ESTRUCTURA: Devuelve un HTML único, limpio y autocontenido.
`;

// TUS FUNCIONES INTACTAS
function getApiKey() {
    return (process.env.GROQ_API_KEY || "")
        .trim()
        .replace(/^Bearer\s+/i, "")
        .replace(/^["']|["']$/g, "");
}

function parseBody(body) {
    if (typeof body === "string") {
        return JSON.parse(body);
    }
    return body || {};
}

function normalizeFiles(files) {
    if (!Array.isArray(files)) {
        throw new Error("La lista de archivos no es válida.");
    }
    if (files.length > MAX_FILES) {
        throw new Error(`Máximo ${MAX_FILES} archivos por solicitud.`);
    }

    let totalChars = 0;

    return files.map((file, index) => {
        if (!file || typeof file !== "object") {
            throw new Error(`Archivo ${index + 1} inválido.`);
        }

        const path = String(file.path || file.name || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

        if (!path || path.split("/").some(part => !part || part === "." || part === "..")) {
            throw new Error(`Ruta inválida en el archivo ${index + 1}.`);
        }

        if (typeof file.content !== "string") {
            throw new Error(`${path}: no se recibió contenido de texto válido.`);
        }

        totalChars += file.content.length;
        if (totalChars > MAX_TOTAL_CHARS) {
            throw new Error("El proyecto supera el límite de 300.000 caracteres.");
        }

        return { path, content: file.content };
    });
}

function buildProjectContext(files) {
    return files.map((file, index) => [
        `========== ARCHIVO ${index + 1} ==========`,
        `RUTA ORIGINAL: ${file.path}`,
        "CONTENIDO ORIGINAL:",
        file.content,
        `========== FIN DEL ARCHIVO ${index + 1} ==========`
    ].join("\n")).join("\n\n");
}

function buildProjectImpactContext(projectMap) {
    const relations = [];
    for (const file of projectMap.values()) {
        const relatedFiles = getRelatedFiles(file.path, projectMap);
        relations.push({
            path: file.path,
            imports: file.imports,
            importedBy: file.importedBy,
            relatedFiles
        });
    }

    return [
        "========== MAPA DE DEPENDENCIAS DEL PROYECTO ==========",
        `TOTAL DE ARCHIVOS INDEXADOS: ${projectMap.size}`,
        "",
        ...relations.map(item => [
            `ARCHIVO: ${item.path}`,
            `IMPORTA: ${item.imports.length ? item.imports.join(", ") : "Sin dependencias locales detectadas"}`,
            `ES UTILIZADO POR: ${item.importedBy.length ? item.importedBy.join(", ") : "Sin consumidores locales detectados"}`,
            `ARCHIVOS RELACIONADOS: ${item.relatedFiles.length ? item.relatedFiles.join(", ") : "Ninguno detectado"}`,
            "----------------------------------------"
        ].join("\n")),
        "========== FIN DEL MAPA DE DEPENDENCIAS =========="
    ].join("\n");
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Método no permitido." });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        return res.status(500).json({ error: "Falta GROQ_API_KEY." });
    }

    const privatePrompt = process.env.CODELAB_SYSTEM_PROMPT;
    if (!privatePrompt || !privatePrompt.trim()) {
        return res.status(500).json({ error: "Falta CODELAB_SYSTEM_PROMPT." });
    }

    try {
        const body = parseBody(req.body);
        const files = normalizeFiles(body.files || []);
        const projectMap = buildProjectMap(files);
        const projectImpactContext = files.length ? buildProjectImpactContext(projectMap) : "";

        if (!Array.isArray(body.messages)) {
            return res.status(400).json({ error: "La conversación no es válida." });
        }

        const messages = body.messages
            .filter(message => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
            .slice(-60)
            .map(message => ({ role: message.role, content: message.content }));

        if (!messages.length) {
            return res.status(400).json({ error: "No hay mensajes válidos." });
        }

        const lastUserIndex = messages.map(message => message.role).lastIndexOf("user");

        if (lastUserIndex < 0) {
            return res.status(400).json({ error: "No se encontró el mensaje del usuario." });
        }

        const security = await inspectPrompt(messages, apiKey);
        if (!security.safe && security.reason === "PROMPT_INJECTION_DETECTED") {
            return res.status(403).json({ error: "Solicitud bloqueada por seguridad." });
        }

        if (!security.safe) {
            console.warn("CODEREX SECURITY:", security.reason);
        }
        
        const originalPrompt = messages[lastUserIndex].content;
        const technicalPrompt = originalPrompt; // Corregí el error de sintaxis que tenías aquí declarando esto dos veces

        // ──────────────────────────────────────────────
        // MOTOR DE DISEÑO PROFESIONAL
        // ──────────────────────────────────────────────
        let designContext = "";

        try {
            designContext = await runProfessionalDesignEngine({
                prompt: originalPrompt,
                apiKey: process.env.SERPER_API_KEY
            });
        } catch (err) {
            console.warn("PROFESSIONAL DESIGN ENGINE falló, usando fallback:", err.message);
            designContext = await runDesignResearch({
                prompt: originalPrompt,
                apiKey: process.env.SERPER_API_KEY
            });
        }

        if (designContext) {
            messages[lastUserIndex].content += "\n\n" + designContext;
        }

        if (files.length) {
            messages[lastUserIndex].content +=
                "\n\n" +
                projectImpactContext +
                "\n\nARCHIVOS ORIGINALES DEL PROYECTO:\n\n" +
                buildProjectContext(files);
        }

        const systemPrompt = `${privatePrompt}\n\n${CODEREX_ENGINE_PROMPT}`;

        // 3. TÚ LLAMAS A TU PIPELINE DE GROQ AQUÍ
        const data = await runRepairPipeline({
            apiKey,
            messages,
            files,
            systemPrompt,
            filesReceived: files.length
        });

        // 4. AQUÍ ESTÁ LA CIRUGÍA FINAL:
        // 'data.content' trae la respuesta cruda de tu pipeline. La pasamos por Serper:
        const codigoFinalConImagenes = await injectSerperImages(data.content);

        // Y le devuelves eso a tu frontend usando tu función toClientResponse
        return res.status(200).json(
            toClientResponse(codigoFinalConImagenes)
        );

    } catch (error) {
        console.error("CODEREX AGENT ERROR:", error);
        return res.status(400).json({
            error: error.message || "Error procesando el proyecto."
        });
    }
};
