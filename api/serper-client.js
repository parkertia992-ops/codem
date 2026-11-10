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

// ESTA ES LA FUNCIÓN NUEVA QUE FALTA PARA INYECTAR LAS IMÁGENES AL HTML
async function injectSerperImages(htmlString) {
    // Si no hay API key configurada, regresamos el HTML sin tocar
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn("Falta SERPER_API_KEY, no se inyectarán imágenes.");
        return htmlString;
    }

    const regex = /<img[^>]+data-search=["']([^"']+)["'][^>]*>/g;
    let finalHtml = htmlString;
    const matches = [...htmlString.matchAll(regex)];

    for (const match of matches) {
        const fullTag = match[0];
        const searchQuery = match[1];

        try {
            // Usamos la función searchImages que ya tenías armada
            const data = await searchImages(apiKey, searchQuery);
            let imageUrl = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80";

            if (data.images && data.images.length > 0) {
                imageUrl = data.images[0].imageUrl;
            }

            let newTag = fullTag;
            if (newTag.includes('src=')) {
                newTag = newTag.replace(/src=["'][^"']*["']/, `src="${imageUrl}"`);
            } else {
                newTag = newTag.replace('<img', `<img src="${imageUrl}"`);
            }

            finalHtml = finalHtml.replace(fullTag, newTag);

        } catch (error) {
            console.error(`Error buscando imagen para "${searchQuery}":`, error.message);
        }
    }

    return finalHtml;
}

module.exports = {
    searchWeb,
    searchImages,
    injectSerperImages // AHORA SÍ ESTAMOS EXPORTANDO LA FUNCIÓN CORRECTA
};
