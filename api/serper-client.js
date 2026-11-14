const SERPER_URL = "https://google.serper.dev";

async function requestSerper(endpoint, apiKey, query) {
    if (!apiKey) throw new Error("Falta SERPER_API_KEY.");
    
    const response = await fetch(`${SERPER_URL}/${endpoint}`, {
        method: "POST",
        headers: {
         "X-API-KEY": process.env.SERPER_API_KEY || "",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: query, num: 6, gl: "ec", hl: "es" })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Error de Serper: ${response.status}`);
    return data;
}

async function searchWeb(apiKey, query) { return requestSerper("search", apiKey, query); }
async function searchImages(apiKey, query) { return requestSerper("images", apiKey, query); }

// EL EXTRACTOR BLINDADO ANTI-ALUCINACIONES DE LA IA
async function injectSerperImages(htmlString) {
    const apiKey = process.env.SERPER_API_KEY;
    
    // Atrapamos absolutamente TODAS las etiquetas <img>, tengan data-search o no
    const regex = /<img([^>]+)>/g;
    let finalHtml = htmlString;
    const matches = [...htmlString.matchAll(regex)];

    for (const match of matches) {
        const fullTag = match[0];
        const attributes = match[1];

        // Extraemos lo que sea que la IA haya puesto
        const srcMatch = attributes.match(/src=["']([^"']*)["']/);
        const altMatch = attributes.match(/alt=["']([^"']*)["']/);
        const dataSearchMatch = attributes.match(/data-search=["']([^"']*)["']/);

        const src = srcMatch ? srcMatch[1] : "";
        const alt = altMatch ? altMatch[1] : "paisaje espacial";
        const dataSearch = dataSearchMatch ? dataSearchMatch[1] : "";

        // Si la imagen ya es un link real de internet (http), la dejamos quieta
        if (src.startsWith("http")) continue;

        // Si la IA fue necia y no usó data-search, usamos el "alt" para buscar en Google
        const searchQuery = dataSearch || alt || "planeta marte espacio realista";
        
        // Imagen de respaldo por si falta la API Key o Serper falla (así nunca se ve rota)
        let imageUrl = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80";

        if (apiKey) {
            try {
                const data = await searchImages(apiKey, searchQuery);
                if (data.images && data.images.length > 0) {
                    imageUrl = data.images[0].imageUrl;
                }
            } catch (error) {
                console.warn(`Serper falló para "${searchQuery}", usando imagen de respaldo.`);
            }
        }

        // Inyectamos la URL real a la mala
        let newTag = fullTag;
        if (srcMatch) {
            newTag = newTag.replace(/src=["'][^"']*["']/, `src="${imageUrl}"`);
        } else {
            newTag = newTag.replace('<img', `<img src="${imageUrl}"`);
        }
        
        finalHtml = finalHtml.replace(fullTag, newTag);
    }

    // PARCHE ANTI-FONDOS NEGROS: Si la IA no puso fondo, se lo inyectamos al CSS a la fuerza
    if (!finalHtml.includes("background-image")) {
        finalHtml = finalHtml.replace('</style>', `
            /* Parche de fondo espacial inyectado por Coderex */
            body, main, header, .hero { 
                background-image: linear-gradient(rgba(9, 9, 11, 0.7), rgba(9, 9, 11, 0.9)), url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80') !important;
                background-size: cover !important;
                background-position: center !important;
                background-attachment: fixed !important;
            }
        </style>`);
    }

    return finalHtml;
}

module.exports = { searchWeb, searchImages, injectSerperImages };
