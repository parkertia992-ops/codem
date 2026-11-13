
// api/serper-extractor.js
// Busca imágenes reales y reemplaza los src vacíos generados por la IA.

const SERPER_URL = "https://google.serper.dev/images";

async function injectSerperImages(htmlString) {
    if (typeof htmlString !== "string") {
        throw new Error("El contenido HTML no es válido.");
    }

    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
        throw new Error("Falta configurar SERPER_API_KEY en Vercel.");
    }

    const regex = /<img\b[^>]*>/gi;

    const matches = [...htmlString.matchAll(regex)];

    let finalHtml = htmlString;

    // Evita repetir búsquedas cuando varias imágenes usan la misma consulta.
    const imageCache = new Map();

    for (const match of matches) {
    const originalTag = match[0];
    const searchQuery = (originalTag.match(/data-search=["']([^"']+)["']/i)?.[1] || originalTag.match(/alt=["']([^"']+)["']/i)?.[1] || "").trim();

    if (!searchQuery) continue;
    if (/src=["']https?:\/\//i.test(originalTag)) continue;

        try {
            let imageUrl = imageCache.get(searchQuery);

            if (!imageUrl) {
                const response = await fetch(SERPER_URL, {
                    method: "POST",
                    headers: {
                        "X-API-KEY": apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        q: searchQuery,
                        num: 5
                    })
                });

                if (!response.ok) {
                    throw new Error(
                        `Serper respondió HTTP ${response.status}`
                    );
                }

                const data = await response.json();

                // Seleccionamos una URL HTTPS válida.
                const image = (data.images || []).find(item => {
                    try {
                        const url = new URL(item.imageUrl);
                        return url.protocol === "https:";
                    } catch {
                        return false;
                    }
                });

                if (!image) {
                    console.warn("No se encontraron imágenes:", searchQuery);
                    continue;
                }

                imageUrl = image.imageUrl;
                imageCache.set(searchQuery, imageUrl);
            }

            // Si no tiene src, lo agregamos. Si lo tiene vacío/roto, lo reemplazamos.
const newTag = /\bsrc\s*=/i.test(originalTag)
  ? originalTag.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, `src="${imageUrl}"`)
  : originalTag.replace(/<img/i, `<img src="${imageUrl}"`);

            finalHtml = finalHtml.replace(originalTag, newTag);

        } catch (error) {
            console.error(
                "Error buscando imagen:",
                searchQuery,
                error.message
            );
        }
    }
// Convierte Markdown ![alt](url) y URLs sueltas en <img> real
finalHtml = finalHtml.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1">');
    return finalHtml;
}

module.exports = { injectSerperImages };
