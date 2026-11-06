
/* ==========================================================================
   CODELAB — GROQ API PROXY
   VERCEL SERVERLESS FUNCTION
   La API Key permanece exclusivamente en el servidor.
   ========================================================================== */

const { inspectPrompt } = require("./security/prompt-guard");
const {
    extractGroqContent,
    toClientResponse
} = require("./groq-response");
const { interpretPrompt } = require("./ojito");

module.exports = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");

    // Solo aceptar POST
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido."
        });
    }

    try {
        // Obtener y limpiar la API Key
        const apiKey = (process.env.GROQ_API_KEY || "")
  .trim()
  .replace(/^Bearer\s+/i, "")
  .replace(/^["']|["']$/g, "");

        if (!apiKey) {
            return res.status(500).json({
                error: "GROQ_API_KEY no está configurada en Vercel."
            });
        }

        // Leer el cuerpo de la solicitud
        let body;

        try {
            body = typeof req.body === "string"
                ? JSON.parse(req.body || "{}")
                : (req.body || {});
        } catch {
            return res.status(400).json({
                error: "El cuerpo de la solicitud no contiene JSON válido."
            });
        }

        const { messages, type } = body;

        // Validar tipo de solicitud
        if (!["main", "suggestions"].includes(type)) {
            return res.status(400).json({
                error: "Tipo de solicitud no válido."
            });
        }

        // Obtener prompt privado
        const systemPrompt = type === "main"
            ? process.env.CODELAB_SYSTEM_PROMPT
            : process.env.CODELAB_SUGGESTER_PROMPT;

        if (!systemPrompt) {
            return res.status(500).json({
                error: "El prompt privado no está configurado en Vercel."
            });
        }

        // Seleccionar modelo
        const selectedModel = type === "main"
            ? "openai/gpt-oss-120b"
            : "openai/gpt-oss-20b";

        // Validar historial
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "Debes proporcionar un historial de mensajes válido."
            });
        }

        const safeMessages = messages
            .filter(message =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string"
            )
            .slice(-60);

        if (safeMessages.length === 0) {
            return res.status(400).json({
                error: "El historial no contiene mensajes válidos."
            });
        }

        // Inspección de seguridad
        let securityResult;

        try {
            securityResult = await inspectPrompt(
                safeMessages,
                apiKey
            );
        } catch (securityError) {
            console.error(
                "CODELAB SECURITY ERROR:",
                securityError.message
            );

            securityResult = {
                safe: false,
                reason: "SECURITY_CHECK_FAILED"
            };
        }

        // Bloquear amenazas detectadas explícitamente
        if (
            securityResult &&
            securityResult.reason === "PROMPT_INJECTION_DETECTED"
        ) {
            return res.status(403).json({
                error: "Solicitud bloqueada por el sistema de seguridad.",
                code: "PROMPT_INJECTION_DETECTED"
            });
        }

        // Registrar fallos técnicos sin detener el chat
        if (!securityResult || !securityResult.safe) {
            console.error(
                "CODELAB SECURITY WARNING:",
                securityResult?.reason || "UNKNOWN_SECURITY_ERROR"
            );
        }
        // OJITO: INTERPRETACIÓN INTERNA PARA EL MODELO PRINCIPAL

        let technicalPrompt = "";

        if (type === "main") {
            const lastUserIndex = safeMessages
                .map(message => message.role)
                .lastIndexOf("user");

            if (lastUserIndex < 0) {
                return res.status(400).json({
                    error: "No se encontró una petición del usuario."
                });
            }

            const ojitoResult = await interpretPrompt(
                safeMessages[lastUserIndex].content,
                {
                    conversationContext: JSON.stringify(
                        safeMessages.slice(0, lastUserIndex)
                    ),
                    projectContext: body.projectContext || ""
                }
            );

            technicalPrompt = ojitoResult.technicalPrompt;
        }
        // Solicitud privada a Groq
        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: selectedModel,
                   messages: [
    {
        role: "system",
        content: type === "main"
            ? [
                systemPrompt,
                "ESPECIFICACIÓN TÉCNICA PREPARADA POR OJITO:",
                technicalPrompt,
                "La petición original del usuario se conserva en la conversación."
            ].join("\n\n")
            : systemPrompt
    },
    ...safeMessages
],
                    max_completion_tokens: type === "main" ? 2048 : 500,
                    temperature: type === "main" ? 0.7 : 0.3
                })
            }
        );

        const responseText = await groqResponse.text();

        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = {
                error: {
                    message: "Groq devolvió una respuesta no válida."
                }
            };
        }

        // Devolver errores reales de Groq
        if (!groqResponse.ok) {
            return res.status(groqResponse.status).json({
                error:
                    responseData.error?.message ||
                    "Error al comunicarse con Groq.",
                type: responseData.error?.type || null,
                code: responseData.error?.code || null
            });
        }

        // Comprobar respuesta
        if (
            !responseData.choices ||
            !responseData.choices[0]?.message
        ) {
            return res.status(502).json({
                error: "Groq no devolvió una respuesta utilizable."
            });
        }

        return res.status(200).json(
    toClientResponse(extractGroqContent(responseData))
);

    } catch (error) {
        console.error("CODELAB GROQ PROXY ERROR:", error);

        return res.status(500).json({
            error: "Error interno al procesar la solicitud."
        });
    }
};
