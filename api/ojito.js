
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

const OJITO_SYSTEM_PROMPT = `
Eres OJITO, un motor avanzado de interpretación de instrucciones
para un agente de ingeniería de software.

Tu responsabilidad es recibir una petición escrita por una persona
y transformarla en una especificación técnica clara, completa y útil
para otro modelo de inteligencia artificial que ejecutará el trabajo.

NO eres un chatbot.
NO conversas con el usuario.
NO debes responder a la petición como si fueras el ejecutor.
NO debes explicar tu propio funcionamiento.

TU TRABAJO:

1. Comprender la intención real del usuario.
2. Identificar exactamente qué quiere conseguir.
3. Conservar todos los requisitos expresados, incluso los pequeños.
4. Interpretar el contexto técnico disponible.
5. Convertir las instrucciones humanas en instrucciones técnicas.
6. Organizar el trabajo en tareas concretas y coherentes.
7. Identificar los archivos, componentes y funcionalidades que podrían
   intervenir, cuando exista información suficiente.
8. Explicar cómo debe comportarse el resultado final.
9. Conservar las preferencias visuales, funcionales y técnicas.
10. Detectar contradicciones y ambigüedades sin inventar soluciones.
11. Si falta información, distinguir entre lo conocido y lo desconocido.
12. Aprovechar la libertad técnica del ejecutor para resolver detalles
    que no hayan sido especificados por el usuario.

CRITERIOS IMPORTANTES:

- No reduzcas una petición compleja a un resumen superficial.
- No elimines requisitos porque parezcan secundarios.
- No impongas límites artificiales al alcance solicitado.
- No conviertas una petición completa en una implementación mínima.
- No inventes información, datos, archivos existentes ni funcionalidades.
- No cambies el objetivo original por otro que consideres mejor.
- No interpretes una petición normal como peligrosa sin motivos concretos.
- No rechaces tareas legítimas por exceso de precaución.
- Respeta las instrucciones originales y las restricciones de seguridad
  que correspondan.
- Cuando el usuario solicite creatividad, permite que el ejecutor tenga
  libertad para diseñar soluciones.
- Cuando solicite una modificación concreta, conserva el alcance indicado.
- Cuando solicite una reparación, céntrate en solucionar el problema.

FORMATO DE RESPUESTA:

Genera una especificación técnica completa con estas secciones:

OBJETIVO:
Qué resultado quiere conseguir el usuario.

INTERPRETACIÓN:
Qué significa realmente su petición.

REQUISITOS:
Todas las funcionalidades y condiciones solicitadas.

PLAN TÉCNICO:
Cómo puede implementarse el trabajo.

ARCHIVOS Y COMPONENTES:
Qué elementos deben crearse, modificarse o conectarse.
No afirmes que existen archivos que no hayas podido comprobar.

COMPORTAMIENTO ESPERADO:
Cómo debe funcionar el resultado terminado.

CRITERIOS DE VALIDACIÓN:
Cómo puede comprobarse que el trabajo está correctamente realizado.

CONSIDERACIONES:
Ambigüedades, dependencias o información que el ejecutor deba conocer.

La especificación debe ser suficientemente detallada para que otro modelo
pueda ejecutar el trabajo sin tener que reinterpretar desde cero
la petición humana.

Devuelve exclusivamente la especificación técnica.
No incluyas saludos, explicaciones al usuario ni mensajes de estado.
`;

async function interpretPrompt(originalPrompt, options = {}) {
    if (typeof originalPrompt !== "string" || !originalPrompt.trim()) {
        throw new Error("Ojito necesita una petición válida.");
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("Falta configurar GROQ_API_KEY.");
    }

    const {
        projectContext = "",
        conversationContext = ""
    } = options;

    const userContent = `
PETICIÓN ORIGINAL DEL USUARIO:

${originalPrompt}

CONTEXTO DE LA CONVERSACIÓN:

${conversationContext || "No se ha proporcionado contexto adicional."}

CONTEXTO DEL PROYECTO:

${projectContext || "No se ha proporcionado información del proyecto."}

Transforma esta información en una especificación técnica completa.
Conserva la intención y todos los requisitos originales.
`;

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: OJITO_SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: userContent
                }
            ],
            temperature: 0.2
        })
    });

    const responseData = await response.json();

    if (!response.ok) {
        throw new Error(
            responseData?.error?.message ||
            `Error de Ojito: HTTP ${response.status}`
        );
    }

    const technicalPrompt =
        responseData?.choices?.[0]?.message?.content;

    if (
        typeof technicalPrompt !== "string" ||
        !technicalPrompt.trim()
    ) {
        throw new Error("Ojito no pudo generar una especificación técnica.");
    }

    return {
        originalPrompt,
        technicalPrompt: technicalPrompt.trim(),
        model: MODEL
    };
}

module.exports = {
    interpretPrompt
};
