/* ==========================================================================
   CODELAB — GROQ API PROXY
   La API Key permanece exclusivamente en el servidor.
   ========================================================================== */

exports.handler = async (event) => {
    const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
    };

    // Solo aceptar POST
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: "Método no permitido."
            })
        };
    }

    try {
        // Comprobar credenciales del servidor
       const apiKey = (process.env.GROQ_API_KEY || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: "GROQ_API_KEY no está configurada en Netlify."
                })
            };
        }

        // Validar solicitud
        let body;

        try {
            body = JSON.parse(event.body || "{}");
        } catch {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "El cuerpo de la solicitud no contiene JSON válido."
                })
            };
        }

        const {
            messages,
            model,
            max_tokens,
            temperature
        } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Debes proporcionar un historial de mensajes válido."
                })
            };
        }

        const selectedModel = model || "openai/gpt-oss-120b";

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
                    messages,
                    max_completion_tokens: Number(max_tokens) || 2048,
                    ...(Number.isFinite(Number(temperature))
                        ? { temperature: Number(temperature) }
                        : {})
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
            return {
                statusCode: groqResponse.status,
                headers,
                body: JSON.stringify({
                    error:
                        responseData.error?.message ||
                        "Error al comunicarse con Groq.",
                    type: responseData.error?.type || null,
                    code: responseData.error?.code || null
                })
            };
        }

        // Comprobar que exista una respuesta
        if (
            !responseData.choices ||
            !responseData.choices[0]?.message
        ) {
            return {
                statusCode: 502,
                headers,
                body: JSON.stringify({
                    error: "Groq no devolvió una respuesta utilizable."
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error("CODELAB GROQ PROXY ERROR:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "Error interno al procesar la solicitud."
            })
        };
    }
};
