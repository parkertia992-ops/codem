
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const executeFile = promisify(execFile);

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const VALIDATION_TIMEOUT = 10000;

const JAVASCRIPT_EXTENSIONS = new Set([
    ".js",
    ".mjs",
    ".cjs"
]);

const JSON_EXTENSIONS = new Set([
    ".json"
]);

function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/");
}

function validateFilePath(filePath) {
    const normalized = normalizePath(filePath);

    if (!normalized || normalized.startsWith("/")) {
        return false;
    }

    return !normalized.split("/").some(part =>
        !part || part === "." || part === ".."
    );
}

function validateInputFiles(files) {
    if (!Array.isArray(files)) {
        throw new Error("La lista de archivos no es válida.");
    }

    if (files.length > MAX_FILES) {
        throw new Error(
            `La validación admite un máximo de ${MAX_FILES} archivos.`
        );
    }

    let totalBytes = 0;

    for (const file of files) {
        if (
            !file ||
            typeof file.path !== "string" ||
            typeof file.content !== "string"
        ) {
            throw new Error("Se recibió un archivo inválido.");
        }

        if (!validateFilePath(file.path)) {
            throw new Error(
                `Ruta no permitida: ${file.path}`
            );
        }

        const bytes = Buffer.byteLength(file.content, "utf8");

        if (bytes > MAX_FILE_BYTES) {
            throw new Error(
                `El archivo ${file.path} supera el límite de 1 MB.`
            );
        }

        totalBytes += bytes;

        if (totalBytes > MAX_TOTAL_BYTES) {
            throw new Error(
                "El proyecto supera el límite de validación de 5 MB."
            );
        }
    }

    return files;
}

async function createTemporaryProject(files) {
    const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), "coderex-validation-")
    );

    try {
        for (const file of files) {
            const relativePath = normalizePath(file.path);
            const destination = path.resolve(
                directory,
                ...relativePath.split("/")
            );

            const relative = path.relative(directory, destination);

            if (
                relative.startsWith("..") ||
                path.isAbsolute(relative)
            ) {
                throw new Error(
                    `Ruta fuera del proyecto: ${file.path}`
                );
            }

            await fs.mkdir(path.dirname(destination), {
                recursive: true
            });

            await fs.writeFile(
                destination,
                file.content,
                {
                    encoding: "utf8",
                    flag: "wx"
                }
            );
        }

        return directory;
    } catch (error) {
        await fs.rm(directory, {
            recursive: true,
            force: true
        });

        throw error;
    }
}

async function checkJavaScriptSyntax(filePath) {
    try {
        await executeFile(
            process.execPath,
            ["--check", filePath],
            {
                timeout: VALIDATION_TIMEOUT,
                maxBuffer: 1024 * 1024,
                windowsHide: true
            }
        );

        return {
            file: filePath,
            check: "javascript_syntax",
            status: "passed",
            message: "Sintaxis JavaScript válida."
        };
    } catch (error) {
        const output = [
            error.stderr,
            error.stdout,
            error.message
        ]
            .filter(Boolean)
            .join("\n")
            .trim();

        return {
            file: filePath,
            check: "javascript_syntax",
            status: "failed",
            message: output.slice(0, 5000)
        };
    }
}

async function checkJsonSyntax(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf8");

        JSON.parse(content);

        return {
            file: filePath,
            check: "json_syntax",
            status: "passed",
            message: "JSON válido."
        };
    } catch (error) {
        return {
            file: filePath,
            check: "json_syntax",
            status: "failed",
            message: String(error.message).slice(0, 5000)
        };
    }
}

async function inspectProject(files, directory) {
    const results = [];

    for (const file of files) {
        const extension = path.posix
            .extname(file.path)
            .toLowerCase();

        const absolutePath = path.resolve(
            directory,
            ...normalizePath(file.path).split("/")
        );

        if (JAVASCRIPT_EXTENSIONS.has(extension)) {
            results.push(
                await checkJavaScriptSyntax(absolutePath)
            );
        }

        if (JSON_EXTENSIONS.has(extension)) {
            results.push(
                await checkJsonSyntax(absolutePath)
            );
        }
    }

    return results;
}

function buildValidationSummary(results) {
    const passed = results.filter(
        result => result.status === "passed"
    ).length;

    const failed = results.filter(
        result => result.status === "failed"
    ).length;

    return {
        totalChecks: results.length,
        passed,
        failed,
        status: failed > 0
            ? "failed"
            : results.length > 0
                ? "passed"
                : "not_checked"
    };
}

async function validateProject(files) {
    const safeFiles = validateInputFiles(files);

    if (safeFiles.length === 0) {
        return {
            status: "not_checked",
            summary: {
                totalChecks: 0,
                passed: 0,
                failed: 0,
                status: "not_checked"
            },
            results: [],
            limitations: [
                "No se recibieron archivos para validar."
            ]
        };
    }

    let temporaryDirectory = null;

    try {
        temporaryDirectory = await createTemporaryProject(
            safeFiles
        );

        const results = await inspectProject(
            safeFiles,
            temporaryDirectory
        );

        const summary = buildValidationSummary(results);

        return {
            status: summary.status,
            summary,
            results,
            limitations: [
                "No se ejecutaron scripts del proyecto.",
                "No se ejecutó npm, pnpm, yarn ni bun.",
                "No se realizó una compilación TypeScript.",
                "No se ejecutaron pruebas automatizadas.",
                "Solo se comprobaron archivos JavaScript y JSON."
            ]
        };
    } finally {
        if (temporaryDirectory) {
            await fs.rm(temporaryDirectory, {
                recursive: true,
                force: true
            }).catch(() => {});
        }
    }
}

module.exports = {
    validateProject
};
