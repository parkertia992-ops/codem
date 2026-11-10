const {
    runRepairPipeline
} = require("./repair-pipeline");

const {
    toClientResponse
} = require("./groq-response");
const { inspectPrompt } = require("./security/prompt-guard");
const {
    runDesignResearch
} = require("./design-research");
const {
    runProfessionalDesignEngine
} = require("./professional-design-engine");
const {
    buildProjectMap,
    getRelatedFiles
} = require("./project-impact-engine");

const MAX_FILES = 100;
const MAX_TOTAL_CHARS = 300000;


const CODEREX_ENGINE_PROMPT = `
Eres CODEREX, un agente de ingeniería de software de alto nivel.

Tu trabajo no es cumplir con lo mínimo. Tu trabajo es entregar resultados que se sientan profesionales, modernos y bien pensados.

Tienes tres modos principales de operación:

────────────────────────
MODO CREACIÓN (prioridad alta)
────────────────────────
Cuando el usuario pide crear una página, aplicación, componente o funcionalidad desde cero:

- Tienes libertad creativa y técnica real.
- No te contengas. No entregues versiones mediocres o "seguras".
- El resultado debe verse y sentirse actual (2024-2026), no como algo de hace 10 años.
- Decide con criterio: estructura, tipografía, colores, espaciado, jerarquía visual, estados e interacciones.
- Usa un sistema de diseño coherente (tipografía con carácter, spacing consistente, paleta limitada, buen contraste).
- Evita a toda costa el aspecto genérico de IA: bordes redondeados excesivos, gradientes baratos, tipografía pobre, layouts predecibles y sin personalidad.
- Los datos deben manejarse con elegancia. Nunca muestres "undefined", "null", "Invalid Date" o valores rotos. Usa valores por defecto limpios y legibles.
- Prefiere calidad visual y claridad por encima de cantidad de elementos.
- El resultado final debe poder mostrarse con orgullo.

────────────────────────
MODO MODIFICACIÓN
────────────────────────
Cuando el usuario pide cambiar algo existente:

- Respeta la arquitectura y el estilo actual del proyecto.
- Integra los cambios de forma natural.
- No reconstruyas partes que no necesitan tocarse.
- Mantén la coherencia visual y técnica con lo que ya existe.

────────────────────────
MODO REPARACIÓN
────────────────────────
Cuando el usuario pide corregir errores:

- Sé preciso y quirúrgico.
- Corrige solo lo necesario.
- Conserva nombres, estructura, comentarios y lógica existente siempre que sea posible.
- No aproveches la reparación para reescribir o "mejorar" cosas que no se pidieron.
- Entrega el código corregido de forma clara y aplicable.

────────────────────────
REGLAS GENERALES
────────────────────────
- Nunca inventes datos reales (nombres, precios, direcciones, testimonios, etc.). Usa contenido de ejemplo claramente identificable.
- No cambies el objetivo del usuario. Puedes decidir cómo construirlo, pero no qué producto diferente debe recibir.
- Cuando generes archivos, entrega el contenido completo y listo para usar.
- Sé directo. Evita explicaciones largas e innecesarias cuando el usuario espera código.

────────────────────────
ESTÁNDAR DE CALIDAD VISUAL (obligatorio en creación)
────────────────────────
Toda interfaz que generes debe cumplir como mínimo:

1. Tipografía con intención (no solo system-ui o Inter genérico).
2. Escala de espaciado consistente.
3. Paleta de colores limitada y con buen contraste.
4. Estados hover, focus y active cuidados.
5. Jerarquía visual clara.
6. Responsive de verdad (no solo que "no se rompa").
7. Cero "undefined", "Invalid Date" u otros valores rotos visibles.
8. Aspecto limpio, moderno y profesional.

Si el resultado se ve básico, genérico o descuidado, has fallado.

Tu estándar no es "que funcione". Tu estándar es "que se sienta bien hecho".
`;

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

        if (
            !path ||
            path.split("/").some(part =>
                !part || part === "." || part === ".."
            )
        ) {
            throw new Error(`Ruta inválida en el archivo ${index + 1}.`);
        }

        if (typeof file.content !== "string") {
            throw new Error(
                `${path}: no se recibió contenido de texto válido.`
            );
        }

        totalChars += file.content.length;
        if (totalChars > MAX_TOTAL_CHARS) {
            throw new Error(
                "El proyecto supera el límite de 300.000 caracteres."
            );
        }

        return {
            path,
            content: file.content
        };
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
        const relatedFiles = getRelatedFiles(
            file.path,
            projectMap
        );

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
            `IMPORTA: ${item.imports.length
                ? item.imports.join(", ")
                : "Sin dependencias locales detectadas"}`,
            `ES UTILIZADO POR: ${item.importedBy.length
                ? item.importedBy.join(", ")
                : "Sin consumidores locales detectados"}`,
            `ARCHIVOS RELACIONADOS: ${item.relatedFiles.length
                ? item.relatedFiles.join(", ")
                : "Ninguno detectado"}`,
            "----------------------------------------"
        ].join("\n")),
        "========== FIN DEL MAPA DE DEPENDENCIAS =========="
    ].join("\n");
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({
            error: "Método no permitido."
        });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        return res.status(500).json({
            error: "Falta GROQ_API_KEY."
        });
    }

    const privatePrompt = process.env.CODELAB_SYSTEM_PROMPT;
    if (!privatePrompt || !privatePrompt.trim()) {
        return res.status(500).json({
            error: "Falta CODELAB_SYSTEM_PROMPT."
        });
    }

    try {
        const body = parseBody(req.body);
        const files = normalizeFiles(body.files || []);
        const projectMap = buildProjectMap(files);
        const projectImpactContext = files.length
            ? buildProjectImpactContext(projectMap)
            : "";

        if (!Array.isArray(body.messages)) {
            return res.status(400).json({
                error: "La conversación no es válida."
            });
        }

        const messages = body.messages
            .filter(message =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string"
            )
            .slice(-60)
            .map(message => ({
                role: message.role,
                content: message.content
            }));

        if (!messages.length) {
            return res.status(400).json({
                error: "No hay mensajes válidos."
            });
        }

        const lastUserIndex = messages
            .map(message => message.role)
            .lastIndexOf("user");

        if (lastUserIndex < 0) {
            return res.status(400).json({
                error: "No se encontró el mensaje del usuario."
            });
        }

        const security = await inspectPrompt(messages, apiKey);
        if (
            !security.safe &&
            security.reason === "PROMPT_INJECTION_DETECTED"
        ) {
            return res.status(403).json({
                error: "Solicitud bloqueada por seguridad."
            });
        }

        if (!security.safe) {
            console.warn("CODEREX SECURITY:", security.reason);
        }
const originalPrompt = messages[lastUserIndex].content;
const technicalPrompt = originalPrompt;

        const technicalPrompt = ojitoResult.technicalPrompt;

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

        const data = await runRepairPipeline({
    apiKey,
    messages,
    files,
    systemPrompt,
    filesReceived: files.length
});

        return res.status(200).json(
            toClientResponse(data.content)
        );

    } catch (error) {
        console.error("CODEREX AGENT ERROR:", error);
        return res.status(400).json({
            error: error.message || "Error procesando el proyecto."
        });
    }
};
