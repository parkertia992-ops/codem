// api/image-resolver.js
// Versión nuclear: reemplaza CUALQUIER ruta de imagen inventada

const SERPER_URL = "https://google.serper.dev/images";
const FALLBACK = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80";

async function searchImage(query, apiKey) {
    if (!apiKey || !query || query.length < 2) return FALLBACK;

    try {
        const response = await fetch(SERPER_URL, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ q: query + " high quality photo", num: 6 })
        });

        if (!response.ok) throw new Error(`Serper ${response.status}`);
        const data = await response.json();

        const image = (data.images || []).find(item => {
            try { return new URL(item.imageUrl).protocol === "https:"; }
            catch { return false; }
        });

        return image ? image.imageUrl : FALLBACK;
    } catch (err) {
        console.error("Serper falló:", query, err.message);
        return FALLBACK;
    }
}

function makeResolver(apiKey) {
    const cache = new Map();
    return async (query) => {
        const key = (query || "").trim().toLowerCase();
        if (!key) return FALLBACK;
        if (cache.has(key)) return cache.get(key);
        const url = await searchImage(key, apiKey);
        cache.set(key, url);
        return url;
    };
}

function cleanName(str) {
    return str
        .split("/").pop()
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\d+/g, "")
        .trim();
}

// Busca el valor de "name" más cercano hacia atrás
function findNearbyName(text, index) {
    const start = Math.max(0, index - 600);
    const chunk = text.slice(start, index);

    // Busca el último "name": "algo"
    const matches = [...chunk.matchAll(/"name"\s*:\s*"([^"]+)"/gi)];
    if (matches.length > 0) {
        return matches[matches.length - 1][1];
    }
    return "";
}

async function resolveImages(sourceText, apiKey = process.env.SERPER_API_KEY) {
    if (typeof sourceText !== "string") return sourceText;

    const resolve = makeResolver(apiKey);
    let result = sourceText;

    // ============================================
    // PATRÓN UNIVERSAL: cualquier string que termine en extensión de imagen
    // y que NO sea una URL real de internet
    // ============================================
    const imagePathRegex = /(["'])((?!https?:\/\/)(?!data:)(?!blob:)[^"'<>\s]*\.(?:jpe?g|png|webp|gif|svg|avif|bmp))\1/gi;

    const matches = [...result.matchAll(imagePathRegex)];

    // Procesamos de atrás hacia adelante para no romper los índices
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const fullMatch = match[0];
        const quote = match[1];
        const localPath = match[2];
        const index = match.index;

        // Intentamos sacar un buen query
        const nearbyName = findNearbyName(result, index);
        const fileName = cleanName(localPath);

        // Prioridad: name cercano > nombre del archivo
        let query = nearbyName || fileName;

        // Casos especiales de planetas (porque el modelo los genera mucho)
        const planetMap = {
            "mercury": "planeta mercurio",
            "venus": "planeta venus",
            "earth": "planeta tierra",
            "mars": "planeta marte",
            "jupiter": "planeta júpiter",
            "saturn": "planeta saturno",
            "uranus": "planeta urano",
            "neptune": "planeta neptuno",
            "pluto": "planeta plutón",
            "mercurio": "planeta mercurio",
            "tierra": "planeta tierra",
            "marte": "planeta marte",
            "jupiter": "planeta júpiter",
            "saturno": "planeta saturno",
            "urano": "planeta urano",
            "neptuno": "planeta neptuno"
        };

        const lower = (nearbyName || fileName).toLowerCase();
        if (planetMap[lower]) {
            query = planetMap[lower];
        }

        if (!query) query = "space planet high quality";

        const url = await resolve(query);

        // Reemplazamos
        result = result.slice(0, index) + `${quote}${url}${quote}` + result.slice(index + fullMatch.length);
    }

    // ============================================
    // También arreglamos <img> tags por si acaso
    // ============================================
    const imgRegex = /<img\b[^>]*>/gi;
    const imgMatches = [...result.matchAll(imgRegex)];

    for (const match of imgMatches) {
        const tag = match[0];
        if (/src\s*=\s*["']https?:\/\//i.test(tag)) continue;

        const dataSearch = tag.match(/data-search\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const alt = tag.match(/alt\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const src = tag.match(/src\s*=\s*["']([^"']*)["']/i)?.[1] || "";

        let query = dataSearch || alt || cleanName(src) || "modern photo";
        const url = await resolve(query);

        let newTag = tag;
        if (/\bsrc\s*=/i.test(tag)) {
            newTag = tag.replace(/\bsrc\s*=\s*(["']?)[^"'\s>]*\1/i, `src="${url}"`);
        } else {
            newTag = tag.replace(/<img/i, `<img src="${url}"`);
        }
        result = result.replace(tag, newTag);
    }

    return result;
}

module.exports = { resolveImages };
