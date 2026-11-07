const SERPER_URL = "https://google.serper.dev";

async function requestSerper(endpoint, apiKey, query) {
    if (!apiKey) {
        throw new Error("Falta SERPER_API_KEY.");
    }

    const response = await fetch(`${SERPER_URL}/${endpoint}`, {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            q: query,
            num: 6,
            gl: "ec",
            hl: "es"
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message || `Error de Serper: ${response.status}`
        );
    }

    return data;
}

async function searchWeb(apiKey, query) {
    return requestSerper("search", apiKey, query);
}

async function searchImages(apiKey, query) {
    return requestSerper("images", apiKey, query);
}

module.exports = {
    searchWeb,
    searchImages
};
