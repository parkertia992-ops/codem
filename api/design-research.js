const {
    searchWeb,
    searchImages
} = require("./serper-client");

const {
    buildDesignContext
} = require("./design-reference-extractor");

function isDesignRequest(prompt) {
    if (typeof prompt !== "string") {
        return false;
    }

    const pattern =
        /\b(crea|crear|diseña|diseñar|construye|construir|genera|generar|mejora|rediseña|rediseñar|interfaz|interfaces|página web|pagina web|sitio web|landing page|dashboard|frontend|front-end|web app|aplicación web|aplicacion web|diseño visual|estilo visual)\b/i;

    return pattern.test(prompt);
}

async function runDesignResearch({
    prompt,
    apiKey
}) {
    if (!isDesignRequest(prompt)) {
        return "";
    }

    if (!apiKey) {
        console.warn("CODEREX DESIGN: SERPER_API_KEY no configurada.");
        return "";
    }

    const query = `${prompt} website UI design inspiration typography colors`;

    const imageQuery =
        `${prompt} website interface design visual inspiration`;

    try {
        const [webResults, imageResults] = await Promise.all([
            searchWeb(apiKey, query),
            searchImages(apiKey, imageQuery)
        ]);

        return buildDesignContext(
            webResults,
            imageResults
        );

    } catch (error) {
        console.error(
            "CODEREX DESIGN RESEARCH ERROR:",
            error.message
        );

        throw new Error(
            "No se pudieron obtener las referencias de diseño."
        );
    }
}

module.exports = {
    isDesignRequest,
    runDesignResearch
};
