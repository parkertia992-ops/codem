// api/image-resolver.js
// Reemplaza CUALQUIER ruta de imagen inventada por la IA (cualquier tema)

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
            body: JSON.stringify({
                q: query,
                num: 8
            })
        });

        if (!response.ok) throw new Error(`Serper ${response.status}`);
        const data = await response.json();

        const image = (data.images || []).find(item => {
            try {
                return new URL(item.imageUrl).protocol === "https:";
            } catch {
                return false;
            }
        });

        return image ? image.imageUrl : FALLBACK;
    } catch (err) {
        console.error("Serper falló:", query, "→", err.message);
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
    return (str || "")
        .split("/").pop()
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\d+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Busca el "name" más cercano hacia atrás (útil en JSON)
function findNearbyName(text, index) {
    const start = Math.max(0, index - 700);
    const chunk = text.slice(start, index);
    const matches = [...chunk.matchAll(/"name"\s*:\s*"([^"]+)"/gi)];
    if (matches.length > 0) {
        return matches[matches.length - 1][1];
    }
    return "";
}

// Busca también otros campos útiles (title, alt, description, label...)
function findNearbyContext(text, index) {
    const start = Math.max(0, index - 700);
    const chunk = text.slice(start, index);

    const patterns = [
        /"name"\s*:\s*"([^"]+)"/gi,
        /"title"\s*:\s*"([^"]+)"/gi,
        /"alt"\s*:\s*"([^"]+)"/gi,
        /"label"\s*:\s*"([^"]+)"/gi,
        /"description"\s*:\s*"([^"]{5,80})"/gi
    ];

    for (const pattern of patterns) {
        const matches = [...chunk.matchAll(pattern)];
        if (matches.length > 0) {
            return matches[matches.length - 1][1];
        }
    }
    return "";
}

async function resolveImages(sourceText, apiKey = process.env.SERPER_API_KEY) {
    if (typeof sourceText !== "string") return sourceText;

    if (!apiKey) {
        console.warn("⚠️ SERPER_API_KEY no configurada → se usará fallback");
    }

    const resolve = makeResolver(apiKey);
    let result = sourceText;

    // =====================================================
    // 1. CUALQUIER string entre comillas que termine en extensión de imagen
    //    y que NO sea una URL real
    // =====================================================
    const imagePathRegex = /(["'])((?!https?:\/\/)(?!data:)(?!blob:)[^"'<>\s]*\.(?:jpe?g|png|webp|gif|svg|avif|bmp))\1/gi;

    const matches = [...result.matchAll(imagePathRegex)];

    // De atrás hacia adelante para no romper índices
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const fullMatch = match[0];
        const quote = match[1];
        const localPath = match[2];
        const index = match.index;

        // Construimos el mejor query posible
        const context = findNearbyContext(result, index);
        const fileName = cleanName(localPath);

        let query = context || fileName;

        // Si el query es demasiado genérico o vacío
        if (!query || query.length < 2) {
            query = "high quality photo";
        }

        const url = await resolve(query);

        result = result.slice(0, index) + `${quote}${url}${quote}` + result.slice(index + fullMatch.length);
    }

    // =====================================================
    // 2. Etiquetas <img> (por si el modelo sí usó data-search o alt)
    // =====================================================
    const imgRegex = /<img\b[^>]*>/gi;
    const imgMatches = [...result.matchAll(imgRegex)];

    for (const match of imgMatches) {
        const tag = match[0];

        // Si ya tiene URL real, la dejamos
        if (/src\s*=\s*["']https?:\/\//i.test(tag)) continue;

        const dataSearch = tag.match(/data-search\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const alt = tag.match(/alt\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const title = tag.match(/title\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const src = tag.match(/src\s*=\s*["']([^"']*)["']/i)?.[1] || "";

        let query = dataSearch || alt || title || cleanName(src) || "photo";

        const url = await resolve(query);

        let newTag;
        if (/\bsrc\s*=/i.test(tag)) {
            newTag = tag.replace(/\bsrc\s*=\s*(["']?)[^"'\s>]*\1/i, `src="${url}"`);
        } else {
            newTag = tag.replace(/<img/i, `<img src="${url}"`);
        }

        result = result.replace(tag, newTag);
    }

    // =====================================================
    // 3. background-image: url(...) con rutas locales
    // =====================================================
    const cssRegex = /url\(\s*(['"]?)((?!https?:\/\/)(?!data:)[^)'"]+\.(?:jpe?g|png|webp|gif|svg|avif))\1\s*\)/gi;
    const cssMatches = [...result.matchAll(cssRegex)];

    for (let i = cssMatches.length - 1; i >= 0; i--) {
        const match = cssMatches[i];
        const fullMatch = match[0];
        const quote = match[1] || "";
        const localPath = match[2];
        const index = match.index;

        const query = cleanName(localPath) || "background";
        const url = await resolve(query);

        result = result.slice(0, index) + `url(${quote}${url}${quote})` + result.slice(index + fullMatch.length);
    }

    return result;
}

module.exports = { resolveImages };
