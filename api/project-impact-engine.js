
const path = require("path");

const SOURCE_EXTENSIONS = new Set([
    ".js", ".jsx", ".ts", ".tsx",
    ".mjs", ".cjs", ".vue", ".svelte"
]);

function normalizePath(value) {
    return String(value || "")
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "")
        .replace(/\/+/g, "/");
}

function getExtension(filePath) {
    return path.posix.extname(filePath).toLowerCase();
}

function resolveImport(fromFile, importPath, fileMap) {
    if (!importPath || !importPath.startsWith(".")) return null;

    const base = normalizePath(
        path.posix.join(
            path.posix.dirname(fromFile),
            importPath
        )
    );

    const candidates = [
        base,
        ...[...SOURCE_EXTENSIONS].map(ext => base + ext),
        ...[...SOURCE_EXTENSIONS].map(ext =>
            path.posix.join(base, "index" + ext)
        )
    ];

    return candidates.find(candidate => fileMap.has(candidate)) || null;
}

function extractImports(filePath, content, fileMap) {
    const imports = new Set();

    const patterns = [
        /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
        /require\(\s*["']([^"']+)["']\s*\)/g,
        /import\(\s*["']([^"']+)["']\s*\)/g
    ];

    for (const pattern of patterns) {
        let match;

        while ((match = pattern.exec(content)) !== null) {
            const resolved = resolveImport(
                filePath,
                match[1],
                fileMap
            );

            if (resolved) imports.add(resolved);
        }
    }

    return [...imports];
}

function buildProjectMap(files) {
    const fileMap = new Map();

    for (const file of files || []) {
        if (!file || typeof file.path !== "string") continue;
        if (typeof file.content !== "string") continue;

        const normalized = normalizePath(file.path);

        if (!normalized || normalized.startsWith("../")) continue;

        fileMap.set(normalized, {
            path: normalized,
            content: file.content,
            extension: getExtension(normalized),
            imports: [],
            importedBy: []
        });
    }

    for (const file of fileMap.values()) {
        if (!SOURCE_EXTENSIONS.has(file.extension)) continue;

        file.imports = extractImports(
            file.path,
            file.content,
            fileMap
        );
    }

    for (const file of fileMap.values()) {
        for (const dependency of file.imports) {
            const target = fileMap.get(dependency);

            if (target && !target.importedBy.includes(file.path)) {
                target.importedBy.push(file.path);
            }
        }
    }

    return fileMap;
}

function getRelatedFiles(filePath, projectMap) {
    const file = projectMap.get(normalizePath(filePath));

    if (!file) return [];

    const related = new Set([
        ...file.imports,
        ...file.importedBy
    ]);

    return [...related];
}

function getImpactContext(changedFiles, projectMap) {
    const changes = [];
    const impacted = new Set();
    const missing = [];

    for (const requestedPath of changedFiles || []) {
        const normalized = normalizePath(requestedPath);
        const file = projectMap.get(normalized);

        if (!file) {
            missing.push(normalized);
            continue;
        }

        const directDependencies = file.imports;
        const directConsumers = file.importedBy;

        for (const dependency of directDependencies) {
            impacted.add(dependency);
        }

        for (const consumer of directConsumers) {
            impacted.add(consumer);
        }

        changes.push({
            file: normalized,
            dependencies: directDependencies,
            consumers: directConsumers
        });
    }

    return {
        changes,
        impactedFiles: [...impacted],
        missingFiles: missing,
        totalProjectFiles: projectMap.size
    };
}

function buildImpactPrompt(changedFiles, projectMap) {
    const impact = getImpactContext(changedFiles, projectMap);

    const details = impact.changes.map(item => {
        return [
            `ARCHIVO: ${item.file}`,
            `DEPENDENCIAS: ${item.dependencies.join(", ") || "Ninguna detectada"}`,
            `ARCHIVOS QUE LO UTILIZAN: ${item.consumers.join(", ") || "Ninguno detectado"}`
        ].join("\n");
    }).join("\n\n");

    const impactedContent = impact.impactedFiles.map(filePath => {
        const file = projectMap.get(filePath);

        if (!file) return "";

        return [
            `ARCHIVO RELACIONADO: ${file.path}`,
            file.content
        ].join("\n");
    }).filter(Boolean).join("\n\n");

    return {
        impact,
        context: `
ANÁLISIS DE IMPACTO DEL PROYECTO

${details}

ARCHIVOS RELACIONADOS Y SU CONTENIDO:

${impactedContent}

REGLAS OBLIGATORIAS:

1. No evalúes un archivo de forma aislada.
2. Antes de modificarlo, estudia sus dependencias y consumidores.
3. Comprueba cómo afectaría el cambio a los módulos relacionados.
4. Si una modificación exige cambios coordinados en otros archivos,
   inclúyelos en la misma operación.
5. No reorganices ni reestructures archivos por iniciativa propia.
6. Conserva las funciones y comportamientos que no necesitan cambios.
7. No declares que un cambio es seguro si no has comprobado sus dependencias.
8. Si no tienes suficiente contexto, solicita los archivos que faltan.
9. Comprueba también los componentes visuales y sus estilos cuando
   el cambio afecte a la interfaz.
10. Prioriza la integridad del proyecto completo sobre la corrección
    aislada de una línea.
`
    };
}

module.exports = {
    buildProjectMap,
    getRelatedFiles,
    getImpactContext,
    buildImpactPrompt
};
