
function extractGroqContent(response) {
    const content = response?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
        throw new Error("Groq no devolvió contenido válido.");
    }

    return content;
}

function toClientResponse(content) {
    if (typeof content !== "string") {
        throw new Error("No existe contenido válido para entregar.");
    }

    return {
        content
    };
}

module.exports = {
    extractGroqContent,
    toClientResponse
};
