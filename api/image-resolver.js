// api/image-resolver.js
const SERPER_URL = "https://google.serper.dev/images";
const FALLBACK = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80";

// Dominios que la IA inventa y que debemos reemplazar
const FAKE_DOMAINS = [
  "example.com",
  "example.org",
  "placeholder.com",
  "placeholder.coderex",
  "via.placeholder.com",
  "dummyimage.com",
  "fakeimg.pl",
  "picsum.photos/id/0", // a veces genera ids rotos
];

function isFakeOrLocal(url) {
  if (!url) return true;
  const lower = url.toLowerCase();

  // Rutas locales
  if (!lower.startsWith("http") && !lower.startsWith("data:")) return true;

  // Dominios falsos
  return FAKE_DOMAINS.some(domain => lower.includes(domain));
}

async function searchImage(query, apiKey) {
  if (!apiKey || !query) return FALLBACK;
  try {
    const response = await fetch(SERPER_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 6 })
    });
    if (!response.ok) return FALLBACK;
    const data = await response.json();
    const image = (data.images || []).find(item => {
      try { return new URL(item.imageUrl).protocol === "https:"; }
      catch { return false; }
    });
    return image ? image.imageUrl : FALLBACK;
  } catch (e) {
    console.error("searchImage error:", e.message);
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
    .trim();
}

function findNearbyName(text, index) {
  const chunk = text.slice(Math.max(0, index - 500), index);
  const match = chunk.match(/"name"\s*:\s*"([^"]+)"/i);
  return match ? match[1] : "";
}

async function resolveImages(sourceText, apiKey = process.env.SERPER_API_KEY) {
  if (typeof sourceText !== "string") return sourceText;

  const resolve = makeResolver(apiKey);
  let result = sourceText;

  // 1. Etiquetas <img>
  const imgRegex = /<img\b[^>]*>/gi;
  for (const match of [...result.matchAll(imgRegex)]) {
    const tag = match[0];
    const srcMatch = tag.match(/src\s*=\s*["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : "";

    // Solo tocamos si es local o dominio falso
    if (src && !isFakeOrLocal(src)) continue;

    const dataSearch = (tag.match(/data-search\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
    const alt = (tag.match(/alt\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
    const query = dataSearch || alt || cleanName(src) || "planet photo";

    const url = await resolve(query);

    let newTag = tag;
    if (/\bsrc\s*=/i.test(tag)) {
      newTag = tag.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${url}"`);
    } else {
      newTag = tag.replace(/<img/i, `<img src="${url}"`);
    }
    result = result.replace(tag, newTag);
  }

  // 2. Cualquier string entre comillas que sea ruta local o dominio falso
  const pathRegex = /(["'])((?:https?:\/\/(?:example\.com|example\.org|placeholder\.com|via\.placeholder\.com)[^"']*)|(?!https?:\/\/)(?!data:)[^"'<>\s]*\.(?:jpe?g|png|webp|gif|svg))\1/gi;
  const matches = [...result.matchAll(pathRegex)];

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const full = m[0];
    const quote = m[1];
    const path = m[2];
    const idx = m.index;

    const name = findNearbyName(result, idx) || cleanName(path) || "photo";
    const url = await resolve(name);

    result = result.slice(0, idx) + quote + url + quote + result.slice(idx + full.length);
  }

  return result;
}

module.exports = { resolveImages };
