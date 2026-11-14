// api/image-resolver.js
// Resuelve CUALQUIER imagen inventada por la IA (rutas locales, placeholders, etc.)

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
            body: JSON.stringify({ q: query, num: 8 })
        });

        if (!response.ok) throw new Error(`Serper HTTP ${response.status}`);

        const data = await response.json();
        const image = (data.images || []).find(item => {
            try {
                return new URL(item.imageUrl).protocol === "https:";
            } catch {
                return false;
            }
        });

        return image ? image.imageUrl : FALLBACK;
    } catch (error) {
        console.error("image-resolver: error buscando", query, "→", error.message);
        return FALLBACK;
    }
}

function makeResolver(apiKey) {
    const cache = new Map();
    return async function resolve(query) {
        const key = (query || "").trim().toLowerCase();
        if (!key) return FALLBACK;
        if (cache.has(key)) return cache.get(key);

        const url = await searchImage(key, apiKey);
        cache.set(key, url);
        return url;
    };
}

// Limpia el nombre del archivo para usarlo como query
function cleanFilename(path) {
    return path
        .split("/").pop()
        .replace(/\.[^.]+$/, "")          // quita extensión
        .replace(/[-_]+/g, " ")           // guiones → espacios
        .replace(/\d+/g, "")              // quita números
        .trim();
}

// Busca un "name" cercano en JSON (útil cuando hay arrays de objetos)
function findNearbyName(text, index) {
    const start = Math.max(0, index - 500);
    const chunk = text.slice(start, index);
    const lastOpen = chunk.lastIndexOf("{");
    const scoped = lastOpen >= 0 ? chunk.slice(lastOpen) : chunk;
    const match = scoped.match(/"name"\s*:\s*"([^"]+)"/i);
    return match ? match[1] : "";
}

async function resolveImages(sourceText, apiKey = process.env.SERPER_API_KEY) {
    if (typeof sourceText !== "string") {
        throw new Error("El contenido a procesar no es un string válido.");
    }

    if (!apiKey) {
        console.warn("⚠️ image-resolver: SERPER_API_KEY no configurada → usando fallback");
    }

    const resolve = makeResolver(apiKey);
    let result = sourceText;

    // ──────────────────────────────────────────────
    // 1. Etiquetas <img> completas
    // ──────────────────────────────────────────────
    const imgTagRegex = /<img\b[^>]*>/gi;
    const imgMatches = [...result.matchAll(imgTagRegex)];

    for (const match of imgMatches) {
        const tag = match[0];

        // Si ya tiene una URL real de internet, la dejamos
        if (/src\s*=\s*["']https?:\/\//i.test(tag)) continue;

        // Extraemos posibles queries
        const dataSearch = tag.match(/data-search\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const alt = tag.match(/alt\s*=\s*["']([^"']+)["']/i)?.[1] || "";
        const src = tag.match(/src\s*=\s*["']([^"']*)["']/i)?.[1] || "";

        let query = dataSearch || alt;

        // Si el src es una ruta local, usamos el nombre del archivo
        if (!query && src && !src.startsWith("http") && !src.startsWith("data:")) {
            query = cleanFilename(src);
        }

        // Fallback de último recurso
        if (!query) query = "modern high quality photo";

        const url = await resolve(query);

        let newTag;
        if (/\bsrc\s*=/i.test(tag)) {
            newTag = tag.replace(/\bsrc\s*=\s*(["']?)[^"'\s>]*\1/i, `src="${url}"`);
        } else {
            newTag = tag.replace(/<img/i, `<img src="${url}"`);
        }

        result = result.replace(tag, newTag);
    }

    // ──────────────────────────────────────────────
    // 2. Rutas locales entre comillas (cualquier parte del código)
    //    Ej: "image/nose.jpg", './assets/foto.png', "images/marte.jpg"
    // ──────────────────────────────────────────────
    const localPathRegex = /(["'])((?!https?:\/\/)(?!data:)(?!blob:)[^"'<>\s]*\.(?:jpe?g|png|webp|gif|svg|avif))\1/gi;
    const pathMatches = [...result.matchAll(localPathRegex)];

    // Procesamos de atrás hacia adelante para no romper los índices
    for (let i = pathMatches.length - 1; i >= 0; i--) {
        const match = pathMatches[i];
        const [fullMatch, quote, localPath] = match;

        const niceName = findNearbyName(result, match.index);
        const fileBase = cleanFilename(localPath);
        const query = (niceName || fileBase || "photo").trim();

        const url = await resolve(query);
        result = result.slice(0, match.index) + `${quote}${url}${quote}` + result.slice(match.index + fullMatch.length);
    }

    // ──────────────────────────────────────────────
    // 3. CSS background-image: url(...) con rutas locales
    // ──────────────────────────────────────────────
    result = result.replace(
        /url\(\s*(['"]?)((?!https?:\/\/)(?!data:)[^)'"]+\.(?:jpe?g|png|webp|gif|svg))\1\s*\)/gi,
        async (full, quote, localPath) => {
            // Nota: replace con async no funciona bien, lo hacemos de forma síncrona con fallback
            return `url(${quote}${FALLBACK}${quote})`;
        }
    );

    // Versión síncrona del CSS (más segura)
    const cssUrlRegex = /url\(\s*(['"]?)((?!https?:\/\/)(?!data:)[^)'"]+\.(?:jpe?g|png|webp|gif|svg))\1\s*\)/gi;
    const cssMatches = [...result.matchAll(cssUrlRegex)];

    for (let i = cssMatches.length - 1; i >= 0; i--) {
        const match = cssMatches[i];
        const [fullMatch, quote, localPath] = match;
        const query = cleanFilename(localPath) || "background";
        const url = await resolve(query);
        result = result.slice(0, match.index) + `url(${quote}${url}${quote})` + result.slice(match.index + fullMatch.length);
    }

    // ──────────────────────────────────────────────
    // 4. Markdown suelto → <img>
    // ──────────────────────────────────────────────
    result = result.replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
        '<img src="$2" alt="$1">'
    );

    return result;
}

module.exports = { resolveImages };
