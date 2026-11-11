
const CoderexAssets = require('./coderex-assets'); // Ajusta la ruta relativa si está en otra carpeta (ej: '../coderex-assets')
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

// ... más abajo, donde tu IA termina de generar el HTML:
const codigoGeneradoPorIA = response.choices[0].message.content; // O como sea que saques el texto de la IA

// Pasamos el código por el extractor para inyectar las imágenes de Serper
const codigoFinal = await injectSerperImages(codigoGeneradoPorIA);

// Ahora sí, devuelves 'codigoFinal' al frontend
const {
    runProfessionalDesignEngine
} = require("./professional-design-engine");
const {
    buildProjectMap,
    getRelatedFiles
} = require("./project-impact-engine");

const MAX_FILES = 100;
const MAX_TOTAL_CHARS = 300000;


// 1. Importas el extractor de imágenes de Serper que creaste
const { injectSerperImages } = require('./serper-extractor');

// 2. EL PROMPT MAESTRO Y SUPERCOMPLETO
const systemPrompt = `
ROL Y OBJETIVO:
Eres Coderex, un motor de generación de páginas web profesionales de nivel experto. Tu misión es generar páginas web completas, visualmente impactantes, modernas y listas para producción en un solo intento. Cero explicaciones largas, cero código incompleto, cero elementos vacíos. Solo devuelves código.

REGLAS DE DISEÑO OBLIGATORIAS:
1. ESTÉTICA MODERNA: Prohibido usar estilos genéricos antiguos. Usa paletas de alta gama (por ejemplo, fondos oscuros elegantes como #09090b), tarjetas con efecto Glassmorphism (\`backdrop-filter: blur(16px)\`), bordes semitransparentes sutiles y sombras cuidadas.
2. TIPOGRAFÍA: Inyecta automáticamente los enlaces de Google Fonts necesarios en el <head> (usa familias modernas como 'Inter', 'Plus Jakarta Sans' o 'Outfit') y aplícalas en el CSS.
3. INTERACTIVIDAD: Ningún botón o enlace debe ser de adorno. Agrega transiciones fluidas en botones (\`transition: all 0.3s ease\`) con efectos hover (elevación y brillo). Los enlaces de navegación deben tener \`href\` funcionales.

REGLA CRÍTICA DE IMÁGENES (¡ESTRICTAMENTE OBLIGATORIO!):
PROHIBIDO inventar rutas locales de imágenes como src="marte.jpg", src="./img.png" o src="image.jpg". Si haces esto, la página se rompe y el sistema fallará.
Siempre que necesites insertar una imagen para tarjetas, secciones o contenido, DEBES generar la etiqueta <img> utilizando el atributo 'data-search' con una consulta de búsqueda detallada, y dejar el 'src' vacío.
FORMATO EXACTO QUE DEBES USAR:
<img data-search="[término de búsqueda descriptivo y detallado, ej: paisaje planeta marte 4k espacial]" src="" alt="[descripción breve]">

Para fondos de pantalla (background-image en CSS), usa URLs directas de Unsplash (ej. https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80).

ESTRUCTURA DEL ENTREGABLE:
Entrega un archivo HTML único, limpio y autocontenido (con CSS y JS dentro del mismo archivo). No uses bloques de Markdown (\`\`\`html). Devuelve ÚNICAMENTE el código puro y 100% funcional.
`;

// 3. LA FUNCIÓN PRINCIPAL DE TU API (Ejemplo para Vercel/Express)
module.exports = async (req, res) => {
  try {
    const peticionDelUsuario = req.body.prompt || req.body.message;

    // Armas los mensajes para la IA (Groq, OpenAI, etc.)
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: peticionDelUsuario }
    ];

    // AQUÍ HACES TU LLAMADA A LA IA (Ajusta fetch según tu API actual: Groq/OpenAI)
    const aiResponse = await fetch('URL_DE_TU_IA_AQUI', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tu-modelo-aqui',
        messages: messages,
      })
    });

    const data = await aiResponse.json();
    
    // 4. INTERCEPTAS EL CÓDIGO CRUDO
    // Extraes lo que escupió la IA
    const codigoBrutoIA = data.choices[0].message.content; 

    // 5. LA MAGIA: Pasas el código por Serper para rellenar los <img> vacíos
    const codigoFinal = await injectSerperImages(codigoBrutoIA);

    // 6. Devuelves el código procesado, limpio y con imágenes 4K al frontend
    res.status(200).json({ content: codigoFinal });

  } catch (error) {
    console.error("Error en la generación:", error);
    res.status(500).json({ error: "Fallo en la matriz, cabrón. Revisa los logs." });
  }
};

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
