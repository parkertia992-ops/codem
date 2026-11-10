// serper-extractor.js - Buscador e inyector de imágenes reales
async function injectSerperImages(htmlString) {
  // Buscamos cualquier etiqueta img que la IA haya marcado con data-search
  const regex = /<img[^>]+data-search=["']([^"']+)["'][^>]*>/g;
  let finalHtml = htmlString;
  
  const matches = [...htmlString.matchAll(regex)];

  for (const match of matches) {
    const fullTag = match[0];
    const searchQuery = match[1]; // Lo que la IA quiere buscar (ej: "paisaje marte 4k")

    try {
      // Llamada directa a Serper.dev
      const response = await fetch("https://google.serper.dev/images", {
        method: 'POST',
        headers: {
          "X-API-KEY": "TU_API_KEY_AQUI", // ¡Pega tu llave de Serper aquí!
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: searchQuery })
      });

      const data = await response.json();
      
      // Fallback por si la búsqueda falla
      let imageUrl = "https://images.unsplash.com/photo-1518770660439-4636190af475"; 

      if (data.images && data.images.length > 0) {
        imageUrl = data.images[0].imageUrl; // Extraemos la URL de la primera imagen
      }

      // Inyectamos la URL real en el src del código HTML
      let newTag = fullTag;
      if (newTag.includes('src=')) {
        newTag = newTag.replace(/src=["'][^"']*["']/, `src="${imageUrl}"`);
      } else {
        newTag = newTag.replace('<img', `<img src="${imageUrl}"`);
      }

      finalHtml = finalHtml.replace(fullTag, newTag);

    } catch (error) {
      console.error("Error extrayendo con Serper:", error);
    }
  }

  return finalHtml;
}

module.exports = { injectSerperImages };
