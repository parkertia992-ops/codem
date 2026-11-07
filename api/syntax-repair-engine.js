
const ts = require("typescript");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

const MAX_REPAIR_ATTEMPTS = 3;

const SUPPORTED_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs"
];

function getScriptKind(filePath) {
    const extension = filePath.split(".").pop().toLowerCase();

    switch (extension) {
        case "tsx":
            return ts.ScriptKind.TSX;

        case "jsx":
            return ts.ScriptKind.JSX;

        case "js":
        case "mjs":
        case "cjs":
            return ts.ScriptKind.JS;

        default:
            return ts.ScriptKind.TS;
    }
}

function isSupportedFile(filePath) {
    return SUPPORTED_EXTENSIONS.some(extension =>
        filePath.toLowerCase().endsWith(extension)
    );
}

function validateSyntax(filePath, content) {
    if (typeof content !== "string") {
        return {
            valid: false,
            errors: ["El contenido del archivo no es texto."]
        };
    }

    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath)
    );

    const diagnostics = sourceFile.parseDiagnostics || [];

    const errors = diagnostics.map(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            "\n"
        );

        if (!diagnostic.file || diagnostic.start === undefined) {
            return message;
        }

        const position = diagnostic.file.getLineAndCharacterOfPosition(
            diagnostic.start
        );

        return `Línea ${position.line + 1}, columna ${position.character + 1}: ${message}`;
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

function extractCode(content) {
    const text = String(content || "").trim();

    const match = text.match(
        /^```(?:javascript|js|typescript|ts|jsx|tsx)?\s*\n([\s\S]*?)\n```$/i
    );

    return match ? match[1].trim() : text;
}

async function requestSyntaxRepair({
    apiKey,
    filePath,
    code,
    errors,
    attempt
}) {
    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `
Eres un motor especializado exclusivamente en reparación de sintaxis.

Tu trabajo consiste en corregir errores sintácticos del código recibido.

REGLAS OBLIGATORIAS:

1. Corrige los errores sintácticos indicados.
2. Conserva la funcionalidad y la intención original.
3. No elimines funcionalidades para hacer desaparecer errores.
4. No inventes componentes, funciones, variables ni dependencias.
5. No cambies la arquitectura del proyecto.
6. No reescribas código que no necesite modificaciones.
7. Conserva los imports, exports y nombres originales.
8. Respeta JavaScript, TypeScript, JSX o TSX según corresponda.
9. No agregues explicaciones.
10. No utilices bloques Markdown.

RESPUESTA:

Devuelve exclusivamente el contenido completo del archivo corregido.
`
                },
                {
                    role: "user",
                    content: `
ARCHIVO:
${filePath}

INTENTO:
${attempt} de ${MAX_REPAIR_ATTEMPTS}

ERRORES DETECTADOS POR EL ANALIZADOR:
${errors.map((error, index) => `${index + 1}. ${error}`).join("\n")}

CÓDIGO ORIGINAL:
${code}
`
                }
            ],
            temperature: 0.1,
            max_completion_tokens: 12000
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error?.message ||
            `Groq respondió con HTTP ${response.status}.`
        );
    }

    const repairedCode = data.choices?.[0]?.message?.content;

    if (
        typeof repairedCode !== "string" ||
        !repairedCode.trim()
    ) {
        throw new Error(
            "El modelo no devolvió código corregido."
        );
    }

    return extractCode(repairedCode);
}

async function repairSingleFile({
    apiKey,
    filePath,
    content
}) {
    let currentCode = content;

    let validation = validateSyntax(
        filePath,
        currentCode
    );

    if (validation.valid) {
        return {
            path: filePath,
            content: currentCode,
            valid: true,
            repaired: false,
            attempts: 0,
            errors: []
        };
    }

    for (
        let attempt = 1;
        attempt <= MAX_REPAIR_ATTEMPTS;
        attempt++
    ) {
        const repairedCode = await requestSyntaxRepair({
            apiKey,
            filePath,
            code: currentCode,
            errors: validation.errors,
            attempt
        });

        const nextValidation = validateSyntax(
            filePath,
            repairedCode
        );

        currentCode = repairedCode;
        validation = nextValidation;

        if (validation.valid) {
            return {
                path: filePath,
                content: currentCode,
                valid: true,
                repaired: true,
                attempts: attempt,
                errors: []
            };
        }
    }

    return {
        path: filePath,
        content: currentCode,
        valid: false,
        repaired: false,
        attempts: MAX_REPAIR_ATTEMPTS,
        errors: validation.errors
    };
}

async function repairSyntaxErrors({
    apiKey,
    changes
}) {
    if (!apiKey) {
        throw new Error("Falta GROQ_API_KEY.");
    }

    if (!Array.isArray(changes)) {
        throw new Error(
            "Se esperaba una lista de cambios."
        );
    }

    const results = [];

    const updatedChanges = changes.map(change => ({
        ...change
    }));

    for (let index = 0; index < updatedChanges.length; index++) {
        const change = updatedChanges[index];

        if (
            typeof change.path !== "string" ||
            typeof change.new_text !== "string" ||
            !isSupportedFile(change.path)
        ) {
            continue;
        }

        const result = await repairSingleFile({
            apiKey,
            filePath: change.path,
            content: change.new_text
        });

        results.push(result);

        if (result.valid && result.repaired) {
            updatedChanges[index].new_text = result.content;
        }
    }

    return {
        success: results.every(result => result.valid),
        changes: updatedChanges,
        validation: {
            totalFiles: results.length,
            validFiles: results.filter(result => result.valid).length,
            invalidFiles: results.filter(result => !result.valid).length,
            repairedFiles: results.filter(result => result.repaired).length,
            results
        }
    };
}

module.exports = {
    repairSyntaxErrors,
    validateSyntax
};
