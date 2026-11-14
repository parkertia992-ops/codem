// api/serper-extractor.js
// Busca imágenes reales y reemplaza los src vacíos generados por la IA,
// y también cualquier ruta local inventada (images/algo.jpg) en cualquier parte del HTML/JS.

const SERPER_URL = "https://google.serper.dev/images";
const FALLBACK = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80";

async function resolveImageUrl(searchQuery, apiKey, cache) {
    if (cache.has(searchQuery)) return cache.get(searchQuery);

    if (!apiKey) {
        cache.set(searchQuery, FALLBACK);
        return FALLBACK;
    }

    try {
        const response = await fetch(SERPER_URL, {
            method: "POST",
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: searchQuery, num: 5 })
        });

        if (!response.ok) throw new Error(`Serper respondió HTTP ${response.status}`);

        const data = await response.json();
        const image = (data.images || []).find(item => {
            try { return new URL(item.imageUrl).protocol === "https:"; }
            catch { return false; }
        });

        const resolved = image ? image.imageUrl : FALLBACK;
        cache.set(searchQuery, resolved);
        return resolved;
    } catch (error) {
        console.error("Error buscando imagen:", searchQuery, error.message);
        cache.set(searchQuery, FALLBACK);
        return FALLBACK;
    }
}

async function injectSerperImages(htmlString) {
    if (typeof htmlString !== "string") {
        throw new Error("El contenido HTML no es válido.");
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.warn("SERPER_API_KEY no configurada, usando fallback Unsplash para todas las imágenes.");
    }

    const imageCache = new Map();
    let finalHtml = htmlString;

    // 1) Etiquetas <img> con data-search/alt y src vacío o placeholder
    const imgRegex = /<img\b[^>]*>/gi;
    const imgMatches = [...finalHtml.matchAll(imgRegex)];

    for (const match of imgMatches) {
        const originalTag = match[0];
        const searchQuery = (originalTag.match(/data-search=["']([^"']+)["']/i)?.[1]
            || originalTag.match(/alt=["']([^"']+)["']/i)?.[1]
            || "").trim();

        if (!searchQuery) continue;
        if (/src=["']https?:\/\//i.test(originalTag)) continue;

        const imageUrl = await resolveImageUrl(searchQuery, apiKey, imageCache);

        const newTag = /\bsrc\s*=/i.test(originalTag)
            ? originalTag.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, `src="${imageUrl}"`)
            : originalTag.replace(/<img/i, `<img src="${imageUrl}"`);

        finalHtml = finalHtml.replace(originalTag, newTag);
    }

    // 2) Rutas locales inventadas en cualquier parte (HTML o JS/JSON):
    // "images/marte.jpg", './img/foto-1.png', "assets/saturno.webp", etc.
    const localPathRegex = /(["'])((?!https?:\/\/)(?!data:)[^"'<>]*\.(?:jpe?g|png|webp|gif|svg))\1/gi;
    const localMatches = [...finalHtml.matchAll(localPathRegex)];

    for (const match of localMatches) {
        const [fullMatch, quote, localPath] = match;
        const fileName = localPath.split("/").pop().replace(/\.[^.]+$/, "");
        const searchQuery = fileName.replace(/[-_]+/g, " ").trim();

        if (!searchQuery) continue;

        const imageUrl = await resolveImageUrl(searchQuery, apiKey, imageCache);
        finalHtml = finalHtml.replace(fullMatch, `${quote}${imageUrl}${quote}`);
    }

    // 3) Markdown ![alt](url) y URLs sueltas -> <img> real
    finalHtml = finalHtml.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1">');

    return finalHtml;
}

module.exports = { injectSerperImages };
