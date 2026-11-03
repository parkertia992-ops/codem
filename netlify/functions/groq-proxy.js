/* ========================================================================== */
/* ARCHIVO: netlify/functions/groq-proxy.js                                   */
/* DESCRIPCIÓN: Función serverless para ocultar la API Key de Groq en Netlify */
/* ========================================================================== */

exports.handler = async function(event, context) {
    // Solo permitimos peticiones POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
    }

    try {
        const { messages, model, max_tokens, temperature } = JSON.parse(event.body);

        // La API Key se lee de forma segura desde las variables de entorno de Netlify
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: "Falta configurar la variable de entorno GROQ_API_KEY en Netlify." }) 
            };
        }

        // Petición privada a Groq desde el servidor de Netlify
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: model || "gpt-oss-120b",
                messages: messages,
                temperature: temperature || 0.7,
                max_tokens: max_tokens || 2048
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            return { statusCode: response.status, body: errorData };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Error interno en el servidor: " + error.message }) 
        };
    }
};
