
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const CORRECTION_PROMPT = `
Eres CoderX Correction, un revisor y corrector de sintaxis
de código generado.

Tu única función es revisar los archivos recibidos y corregir
errores de sintaxis antes de que sean entregados.

REVISA:
- JavaScript.
- TypeScript.
- JSX.
- TSX.
- Estructuras incompletas.
- Llaves, paréntesis y corchetes incorrectos.
- Bloques y funciones mal cerrados.
- Declaraciones sintácticamente inválidas.
- Expresiones y estructuras mal formadas.
- Etiquetas JSX incorrectas o incompletas.

REGLAS:
1. Conserva la funcionalidad original.
2. No cambies la arquitectura.
3. No elimines funciones.
4. No inventes componentes, variables ni dependencias.
5. No realices refactorizaciones.
6. No cambies el diseño ni los estilos por preferencias.
7. No corrijas problemas lógicos, visuales o de tipos que no sean
   errores de sintaxis.
8. Conserva los comentarios existentes.
9. Si un archivo no tiene errores sintácticos, devuelve
   exactamente su contenido original.
10. Corrige todos los errores sintácticos que encuentres.
11. Devuelve el contenido completo de cada archivo.
12. No omitas archivos.
13. No cambies las rutas originales.

FORMATO DE RESPUESTA:

Devuelve exclusivamente JSON válido:

{
  "files": [
    {
      "path": "ruta/archivo.tsx",
      "content": "contenido completo del archivo",
      "has_syntax_errors": false,
      "errors": []
    }
  ]
}

Si encuentras errores, corrígelos en content.
has_syntax_errors debe indicar si todavía quedan errores
después de tu corrección.

No incluyas explicaciones fuera del JSON.
`;

const VERIFICATION_PROMPT = `
Eres el verificador final de CoderX Correction.

Recibirás archivos que ya pasaron por una primera revisión.

Realiza una segunda inspección independiente de su sintaxis.

Comprueba especialmente:
- Llaves, paréntesis y corchetes.
- Funciones y bloques incompletos.
- Declaraciones inválidas.
- Estructuras JSX y TSX mal formadas.
- Errores sintácticos introducidos durante la corrección.

Si encuentras errores:
- Corrígelos.
- Devuelve el archivo completo.
- No cambies funcionalidades ni arquitectura.

Si no encuentras errores:
- Conserva exactamente el contenido recibido.

No revises preferencias de estilo, lógica, diseño ni calidad
general del código.

Devuelve exclusivamente JSON válido:

{
  "files": [
    {
      "path": "ruta/archivo.tsx",
      "content": "contenido completo del archivo",
      "has_syntax_errors": false,
      "errors": []
    }
  ]
}

Incluye todos los archivos recibidos.
`;

function parseModelJSON(content) {
    if (typeof content !== "string" || !content.trim()) {
        throw new Error(
            "CoderX Correction recibió una respuesta vacía."
        );
    }

    const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start < 0 || end <= start) {
            throw new Error(
                "CoderX Correction recibió JSON inválido."
            );
        }

        return JSON.parse(
            cleaned.slice(start, end + 1)
        );
    }
}

async function callCorrectionModel(apiKey, systemPrompt, files) {
    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0,
            max_completion_tokens: 16384,
            response_format: {
                type: "json_object"
            },
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        files: files.map(file => ({
                            path: file.path,
                            content: file.new_text
                        }))
                    })
                }
            ]
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error?.message ||
            `CoderX Correction recibió HTTP ${response.status}.`
        );
    }

    const content = data.choices?.[0]?.message?.content;

    return parseModelJSON(content);
}

function validateReviewedFiles(result, originalFiles) {
    if (
        !result ||
        !Array.isArray(result.files) ||
        result.files.length !== originalFiles.length
    ) {
        throw new Error(
            "CoderX Correction devolvió una lista incompleta de archivos."
        );
    }

    const originalMap = new Map(
        originalFiles.map(file => [file.path, file])
    );

    const receivedPaths = new Set();

    return result.files.map(file => {
        if (
            !file ||
            typeof file.path !== "string" ||
            typeof file.content !== "string" ||
            typeof file.has_syntax_errors !== "boolean" ||
            !Array.isArray(file.errors)
        ) {
            throw new Error(
                "CoderX Correction devolvió un archivo con formato inválido."
            );
        }

        if (
            !originalMap.has(file.path) ||
            receivedPaths.has(file.path)
        ) {
            throw new Error(
                `CoderX Correction devolvió una ruta inesperada: ${file.path}`
            );
        }

        receivedPaths.add(file.path);

        const original = originalMap.get(file.path);

        return {
            path: file.path,
            new_text: file.content,
            has_syntax_errors: file.has_syntax_errors,
            errors: file.errors,
            original_text: original.new_text
        };
    });
}

async function correctGeneratedFiles({ apiKey, changes }) {
    if (!apiKey) {
        throw new Error("Falta GROQ_API_KEY.");
    }

    if (!Array.isArray(changes)) {
        throw new Error(
            "CoderX Correction no recibió archivos válidos."
        );
    }

    if (changes.length === 0) {
        return {
            success: true,
            changes: [],
            validation: {
                totalFiles: 0,
                validFiles: 0,
                invalidFiles: 0,
                repairedFiles: 0,
                results: []
            }
        };
    }

    for (const file of changes) {
        if (
            !file ||
            typeof file.path !== "string" ||
            typeof file.new_text !== "string"
        ) {
            throw new Error(
                "CoderX Correction recibió un archivo inválido."
            );
        }
    }

    const uniquePaths = new Set(
        changes.map(file => file.path)
    );

    if (uniquePaths.size !== changes.length) {
        throw new Error(
            "CoderX Correction recibió rutas duplicadas."
        );
    }

    // PRIMERA REVISIÓN Y CORRECCIÓN.

    const firstResponse = await callCorrectionModel(
        apiKey,
        CORRECTION_PROMPT,
        changes
    );

    const firstReview = validateReviewedFiles(
        firstResponse,
        changes
    );

    // SEGUNDA REVISIÓN INDEPENDIENTE.

    const secondResponse = await callCorrectionModel(
        apiKey,
        VERIFICATION_PROMPT,
        firstReview.map(file => ({
            path: file.path,
            new_text: file.new_text
        }))
    );

    const secondReview = validateReviewedFiles(
        secondResponse,
        firstReview.map(file => ({
            path: file.path,
            new_text: file.new_text
        }))
    );

    const remainingErrors = secondReview.filter(
        file => file.has_syntax_errors
    );

    if (remainingErrors.length > 0) {
        throw new Error(
            "CoderX Correction no pudo completar la corrección sintáctica de: " +
            remainingErrors.map(file => file.path).join(", ")
        );
    }

    const originalMap = new Map(
        changes.map(file => [file.path, file.new_text])
    );

    const results = secondReview.map(file => {
        const originalContent = originalMap.get(file.path);

        return {
            path: file.path,
            new_text: file.new_text
        };
    });

    const repairedFiles = results.filter(
        file => file.new_text !== originalMap.get(file.path)
    ).length;

    return {
        success: true,

        changes: results,

        validation: {
            totalFiles: results.length,
            validFiles: results.length,
            invalidFiles: 0,
            repairedFiles,

            results: results.map(file => ({
                path: file.path,
                valid: true,
                repaired:
                    file.new_text !== originalMap.get(file.path),
                errors: []
            }))
        }
    };
}

module.exports = {
    correctGeneratedFiles
};
