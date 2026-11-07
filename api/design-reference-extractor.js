function extractWebReferences(data) {
    const results = Array.isArray(data?.organic)
        ? data.organic
        : [];

    return results.slice(0, 6).map(item => ({
        title: item.title || "",
        description: item.snippet || "",
        url: item.link || ""
    }));
}

function extractImageReferences(data) {
    const results = Array.isArray(data?.images)
        ? data.images
        : [];

    return results.slice(0, 5).map(item => ({
        title: item.title || "",
        imageUrl: item.imageUrl || "",
        source: item.source || "",
        pageUrl: item.link || "",
        dimensions: {
            width: item.imageWidth || null,
            height: item.imageHeight || null
        }
    }));
}

function buildDesignContext(webData, imageData) {
    const webReferences = extractWebReferences(webData);
    const imageReferences = extractImageReferences(imageData);

    const sections = [
        "REFERENCIAS EXTERNAS PARA EL DISEÑO",
        "",
        "INSTRUCCIONES:",
        "- Utiliza estas referencias como inspiración.",
        "- No copies diseños protegidos de forma literal.",
        "- No inventes información que no aparece en los resultados.",
        "- No afirmes que has visto imágenes si no puedes acceder a ellas.",
        "- Decide qué elementos son apropiados para el proyecto.",
        "",
        "REFERENCIAS WEB:"
    ];

    if (webReferences.length) {
        webReferences.forEach((item, index) => {
            sections.push(
                `${index + 1}. ${item.title}`,
                `Descripción: ${item.description}`,
                `Fuente: ${item.url}`,
                ""
            );
        });
    } else {
        sections.push("No se encontraron referencias web.");
    }

    sections.push(
        "",
        "REFERENCIAS DE IMÁGENES:"
    );

    if (imageReferences.length) {
        imageReferences.forEach((item, index) => {
            sections.push(
                `${index + 1}. ${item.title}`,
                `Origen: ${item.source}`,
                `URL de imagen: ${item.imageUrl}`,
                `Página original: ${item.pageUrl}`,
                `Dimensiones: ${item.dimensions.width || "Desconocidas"} x ${item.dimensions.height || "Desconocidas"}`,
                ""
            );
        });
    } else {
        sections.push("No se encontraron imágenes de referencia.");
    }

    sections.push(
        "",
        "CRITERIOS DE DISEÑO:",
        "1. Define una dirección visual coherente.",
        "2. Selecciona una jerarquía tipográfica apropiada.",
        "3. Selecciona una paleta de colores consistente.",
        "4. Define distribución, espaciado y proporciones.",
        "5. Evita diseños genéricos y componentes innecesarios.",
        "6. Prioriza la calidad visual y la experiencia de usuario.",
        "7. No descargues ni utilices imágenes externas automáticamente.",
        "8. Las referencias no sustituyen las instrucciones del usuario."
    );

    return sections.join("\n");
}

module.exports = {
    extractWebReferences,
    extractImageReferences,
    buildDesignContext
};
