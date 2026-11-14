// api/image-resolver.js
// Resuelve imágenes reales para el HTML/JS/JSON que genera la IA.
// Cubre dos casos:
//  1) <img data-search="..." src="..."> con placeholder o src vacío/roto.
//  2) Rutas locales inventadas en cualquier parte del código ("images/marte.jpg", "urano.jpg", etc.),
//     incluyendo las que vienen dentro de arrays/objetos JSON (usa el "name" cercano como pista
//     para buscar algo más preciso que el nombre del archivo).

const SERPER_URL = "https://google.serper.dev/images";
const FALLBACK = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80";

async function searchImage(query, apiKey) {
    if (!apiKey) return FALLBACK;

    try {
        const response = await fetch(SERPER_URL, {
            method: "POST",
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: query, num: 5 })
        });

        if (!response.ok) {
            throw new Error(`Serper respondió HTTP ${response.status}`);
        }

        const data = await response.json();
        const image = (data.images || []).find(item => {
            try { return new URL(item.imageUrl).protocol === "https:"; }
            catch { return false; }
        });

        return image ? image.imageUrl : FALLBACK;
    } catch (error) {
        console.error("image-resolver: fallo buscando", query, "-", error.message);
        return FALLBACK;
    }
}

function makeResolver(apiKey) {
    const cache = new Map();
    return async function resolve(query) {
        const key = query.trim().toLowerCase();
        if (!key) return FALLBACK;
        if (cache.has(key)) return cache.get(key);
        const url = await searchImage(key, apiKey);
        cache.set(key, url);
        return url;
    };
}

// Busca un campo "name": "..." dentro de los ~400 caracteres anteriores a `index`,
// sin salirse del objeto JSON que lo contiene (heurística simple basada en el último '{').
function findNearbyName(text, index) {
    const start = Math.max(0, index - 400);
    const chunk = text.slice(start, index);
    const lastOpenBrace = chunk.lastIndexOf("{");
    const scoped = lastOpenBrace >= 0 ? chunk.slice(lastOpenBrace) : chunk;
    const match = scoped.match(/"name"\s*:\s*"([^"]+)"/i);
    return match ? match[1] : "";
}

async function resolveImages(sourceText, apiKey = process.env.SERPER_API_KEY) {
    if (typeof sourceText !== "string") {
        throw new Error("El contenido a procesar no es un string válido.");
    }

    if (!apiKey) {
        console.warn("image-resolver: SERPER_API_KEY no configurada, se usará el fallback fijo.");
    }

    const resolve = makeResolver(apiKey);
    let result = sourceText;

    // 1) Etiquetas <img> con data-search/alt y src vacío, roto o placeholder.
    const imgTagRegex = /<img\b[^>]*>/gi;
    for (const match of [...result.matchAll(imgTagRegex)]) {
        const tag = match[0];
        if (/src\s*=\s*["']https?:\/\//i.test(tag)) continue;

        const query = (tag.match(/data-search=["']([^"']+)["']/i)?.[1]
            || tag.match(/alt=["']([^"']+)["']/i)?.[1]
            || "").trim();

        if (!query) continue;

        const url = await resolve(query);
        const newTag = /\bsrc\s*=/i.test(tag)
            ? tag.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, `src="${url}"`)
            : tag.replace(/<img/i, `<img src="${url}"`);

        result = result.replace(tag, newTag);
    }

    // 2) Rutas locales inventadas en cualquier parte (HTML, JS o JSON),
    // con o sin carpeta: "images/marte.jpg", "urano.jpg", './assets/foto.png', etc.
    const localPathRegex = /(["'])((?!https?:\/\/)(?!data:)[^"'<>]*\.(?:jpe?g|png|webp|gif|svg))\1/gi;
    for (const match of [...result.matchAll(localPathRegex)]) {
        const [fullMatch, quote, localPath] = match;
        const niceName = findNearbyName(result, match.index);
        const fileBase = localPath.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        const query = (niceName || fileBase).trim();

        if (!query) continue;

        const url = await resolve(query);
        result = result.replace(fullMatch, `${quote}${url}${quote}`);
    }

    // 3) Markdown ![alt](url) suelto -> <img> real
    result = result.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1">');

    return result;
}

module.exports = { resolveImages };
