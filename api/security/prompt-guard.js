
const PROMPT_GUARD_MODEL = "meta-llama/llama-prompt-guard-2-86m";

const MAX_CHUNK_LENGTH = 1000;
const CHUNK_OVERLAP = 100;
const MAX_TOTAL_LENGTH = 20000;

function splitText(text) {
    const chunks = [];

    let start = 0;

    while (start < text.length) {
        const end = Math.min(
            start + MAX_CHUNK_LENGTH,
            text.length
        );

        chunks.push(text.slice(start, end));

        if (end >= text.length) break;

        start = end - CHUNK_OVERLAP;
    }

    return chunks;
}

async function classifyChunk(text, apiKey) {
    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: PROMPT_GUARD_MODEL,
                messages: [
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0,
                max_completion_tokens: 16
            })
        }
    );

   if (!response.ok) {
    const errorDetails = await response.text();

    throw new Error(
        `Prompt Guard HTTP ${response.status}: ${errorDetails.slice(0, 1000)}`
    );
}

    const data = await response.json();

    const result = data.choices?.[0]?.message?.content;

    if (typeof result !== "string") {
        throw new Error(
            "Prompt Guard devolvió una clasificación inválida."
        );
    }

    const classification = result.trim().toUpperCase();

    if (classification === "BENIGN") {
        return "BENIGN";
    }

    if (classification === "MALICIOUS") {
        return "MALICIOUS";
    }

    throw new Error(
        "Prompt Guard devolvió una etiqueta desconocida."
    );
}

async function inspectPrompt(messages, apiKey) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return {
            safe: false,
            reason: "INVALID_MESSAGES"
        };
    }

    if (!apiKey) {
        return {
            safe: false,
            reason: "MISSING_API_KEY"
        };
    }

    const userMessages = messages
    .filter(
        message =>
            message &&
            message.role === "user" &&
            typeof message.content === "string"
    )
    .slice(-1);

    if (userMessages.length === 0) {
        return {
            safe: false,
            reason: "NO_USER_MESSAGES"
        };
    }

    const combinedText = userMessages
        .map(message => message.content)
        .join("\n");

    if (combinedText.length > MAX_TOTAL_LENGTH) {
        return {
            safe: false,
            reason: "INPUT_TOO_LARGE"
        };
    }

    if (!combinedText.trim()) {
        return {
            safe: false,
            reason: "EMPTY_INPUT"
        };
    }

    const chunks = splitText(combinedText);

    try {
        for (const chunk of chunks) {
            const classification = await classifyChunk(
                chunk,
                apiKey
            );

            if (classification === "MALICIOUS") {
                return {
                    safe: false,
                    reason: "PROMPT_INJECTION_DETECTED"
                };
            }
        }

        return {
            safe: true,
            reason: null
        };

    } catch (error) {
        console.error(
            "PROMPT GUARD ERROR:",
            error.message
        );

        return {
            safe: false,
            reason: "SECURITY_CHECK_FAILED"
        };
    }
}

module.exports = {
    inspectPrompt
};
