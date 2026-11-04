
/* ==========================================================================
   CODELAB — VOICE TRANSCRIPTION API
   Groq Whisper Large v3
   ========================================================================== */

module.exports = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido."
        });
    }

    const apiKey = (process.env.GROQ_API_KEY || "")
        .trim()
        .replace(/^Bearer\s+/i, "")
        .replace(/^["']|["']$/g, "");

    if (!apiKey) {
        return res.status(500).json({
            error: "GROQ_API_KEY no está configurada en Vercel."
        });
    }

    try {
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

        if (!contentType.includes("multipart/form-data") || !boundaryMatch) {
            return res.status(400).json({
                error: "El audio no llegó en un formato válido."
            });
        }

        const boundary = boundaryMatch[1] || boundaryMatch[2];

        // Leer el audio sin que Vercel lo convierta a JSON.
        const chunks = [];
        let totalSize = 0;
        const MAX_SIZE = 4 * 1024 * 1024;

        for await (const chunk of req) {
            totalSize += chunk.length;

            if (totalSize > MAX_SIZE) {
                return res.status(413).json({
                    error: "La grabación supera el límite de 4 MB. Graba un audio más corto."
                });
            }

            chunks.push(chunk);
        }

        const rawBody = Buffer.concat(chunks);
        const delimiter = Buffer.from(`--${boundary}`);
        const separator = Buffer.from("\r\n\r\n");

        let position = rawBody.indexOf(delimiter);
        let audioBuffer = null;
        let audioType = "audio/webm";
        let filename = "recording.webm";

        // Extraer el archivo de audio del multipart.
        while (position !== -1) {
            position += delimiter.length;

            if (rawBody.subarray(position, position + 2).toString() === "--") {
                break;
            }

            if (rawBody.subarray(position, position + 2).toString() === "\r\n") {
                position += 2;
            }

            const headerEnd = rawBody.indexOf(separator, position);

            if (headerEnd === -1) break;

            const headers = rawBody
                .subarray(position, headerEnd)
                .toString("utf8");

            const bodyStart = headerEnd + separator.length;
            const nextBoundary = rawBody.indexOf(delimiter, bodyStart);

            if (nextBoundary === -1) break;

            const bodyEnd = nextBoundary - 2;

            if (/name="audio"/i.test(headers)) {
                const filenameMatch = headers.match(/filename="([^"]*)"/i);
                const typeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

                filename = filenameMatch?.[1] || filename;
                audioType = typeMatch?.[1]?.trim() || audioType;

                audioBuffer = rawBody.subarray(bodyStart, bodyEnd);
                break;
            }

            position = nextBoundary;
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return res.status(400).json({
                error: "No se recibió ninguna grabación."
            });
        }

        // Preparar archivo para Groq.
        const formData = new FormData();

        const audioBlob = new Blob([audioBuffer], {
            type: audioType
        });

        formData.append("file", audioBlob, filename);
        formData.append("model", "whisper-large-v3");
        formData.append("language", "es");
        formData.append("response_format", "json");
        formData.append("temperature", "0");

        // Enviar audio a Whisper.
        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`
                },
                body: formData
            }
        );

        const responseText = await groqResponse.text();

        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch {
            throw new Error("Groq devolvió una respuesta inválida.");
        }

        if (!groqResponse.ok) {
            return res.status(groqResponse.status).json({
                error: responseData.error?.message ||
                    "Groq no pudo transcribir el audio."
            });
        }

        if (typeof responseData.text !== "string") {
            return res.status(502).json({
                error: "No se recibió una transcripción válida."
            });
        }

        return res.status(200).json({
            text: responseData.text,
            model: "whisper-large-v3"
        });

    } catch (error) {
        console.error("CODELAB VOICE ERROR:", error);

        return res.status(500).json({
            error: error.message ||
                "Error interno al procesar el audio."
        });
    }
};

// Desactivar el parser automático para recibir el multipart original.
module.exports.config = {
    api: {
        bodyParser: false
    }
};
