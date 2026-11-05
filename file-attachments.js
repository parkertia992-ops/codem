(() => {
  "use strict";

  const CONFIG = {
  endpoint: "/api/file-analyzer",
  maxFiles: 100,
  maxFileSize: 1024 * 1024,
  maxTotalSize: 2.5 * 1024 * 1024,
  maxImages: 3,
  zipLibrary: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
};

  const TEXT_EXTENSIONS = new Set([
    "js", "jsx", "ts", "tsx", "mjs", "cjs",
    "html", "htm", "css", "scss", "sass",
    "json", "jsonc", "md", "mdx", "txt",
    "py", "java", "c", "cpp", "h", "hpp",
    "cs", "go", "rs", "php", "rb", "swift",
    "kt", "dart", "vue", "svelte", "astro",
    "sql", "sh", "bat", "ps1", "yml", "yaml",
    "toml", "xml", "svg", "env", "gitignore",
    "dockerfile", "prisma", "graphql", "gql"
  ]);

  const state = {
    files: [],
    analysis: "",
    analyzing: false,
    zipPromise: null
  };

  const inputField = document.getElementById("codelabInput");
  const sendButton = document.getElementById("codelabSendBtn");
  const wrapper = document.querySelector(".codelab-chat-input-wrapper");
  const container = document.querySelector(".codelab-chat-bar-container");

  if (!inputField || !sendButton || !wrapper || !container) {
    console.error("Codelab Attachments: no se encontraron los elementos del chat.");
    return;
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.accept = "*/*";
  fileInput.hidden = true;

  const folderInput = document.createElement("input");

folderInput.type = "file";
folderInput.multiple = true;
folderInput.webkitdirectory = true;
folderInput.setAttribute("webkitdirectory", "webkitdirectory");
folderInput.hidden = true;

  document.body.append(fileInput, folderInput);

  const attachButton = document.createElement("button");
  attachButton.type = "button";
  attachButton.className = "codelab-attach-button";
  attachButton.setAttribute("aria-label", "Adjuntar archivos");
  attachButton.title = "Adjuntar archivos, carpetas o ZIP";
  attachButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.82l8.49-8.49"/>
    </svg>
  `;

  const menu = document.createElement("div");
  menu.className = "codelab-attach-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" data-action="files">
      <span>＋</span> Seleccionar archivos
    </button>
    <button type="button" data-action="folder">
      <span>▧</span> Seleccionar carpeta
    </button>
    <button type="button" data-action="zip">
      <span>▤</span> Seleccionar ZIP
    </button>
  `;

  const attachments = document.createElement("div");
  attachments.className = "codelab-attachments";
  attachments.setAttribute("aria-live", "polite");

  const status = document.createElement("div");
  status.className = "codelab-attachment-status";
  status.hidden = true;

  wrapper.insertBefore(attachButton, inputField);
  container.insertBefore(menu, wrapper);
  container.insertBefore(attachments, wrapper);
  container.appendChild(status);

  function getExtension(name) {
    const parts = String(name).toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function isImage(file) {
  const extension = getExtension(file.name);

  return /^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type || "") ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);
}

  function isTextFile(file) {
    const extension = getExtension(file.name);

    return TEXT_EXTENSIONS.has(extension) ||
      file.type.startsWith("text/") ||
      file.type === "application/json";
  }

  function showStatus(message, type = "info") {
    status.hidden = false;
    status.textContent = message;
    status.dataset.type = type;
  }

  function hideStatus() {
    status.hidden = true;
    status.textContent = "";
  }

 function renderAttachments() {
  attachments.replaceChildren();

  if (state.files.length === 0) {
    attachments.hidden = true;
    return;
  }

  attachments.hidden = false;

  const groups = new Map();

  for (const item of state.files) {
    const key = item.groupId || item.id;

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: item.groupName || item.name,
        items: []
      });
    }

    groups.get(key).items.push(item);
  }

  for (const group of groups.values()) {
    const chip = document.createElement("div");
    chip.className = "codelab-attachment-chip";

    const name = document.createElement("span");
    name.className = "codelab-attachment-name";
    name.textContent = group.name;
    name.title = group.name;

    const count = document.createElement("span");
    count.className = "codelab-attachment-count";
    count.textContent = `${group.items.length} archivos`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "codelab-attachment-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Eliminar ${group.name}`);

    remove.addEventListener("click", () => {
      state.files = state.files.filter(item =>
        (item.groupId || item.id) !== group.id
      );

      state.analysis = "";
      renderAttachments();
      hideStatus();
    });

    chip.append(name, count, remove);
    attachments.appendChild(chip);
  }
}

  function calculateTotalSize(files) {
    return files.reduce((total, file) => total + (file.size || 0), 0);
  }
  function addFiles(newFiles, groupName = null) {
  const existing = new Set(
    state.files.map(file => `${file.path}:${file.size}`)
  );

  const groupId = groupName
    ? `group-${Date.now()}-${Math.random().toString(36).slice(2)}`
    : null;

  let added = 0;

  for (const file of newFiles) {
    if (state.files.length >= CONFIG.maxFiles) {
      showStatus(`Máximo ${CONFIG.maxFiles} archivos por proyecto.`, "error");
      break;
    }

    const path =
      file.codelabRelativePath ||
      file.webkitRelativePath ||
      file.name;

    const key = `${path}:${file.size}`;

    if (existing.has(key)) continue;

    if (file.size > CONFIG.maxFileSize) {
      showStatus(`${path}: supera el límite permitido.`, "error");
      continue;
    }

    if (calculateTotalSize(state.files) + file.size > CONFIG.maxTotalSize) {
      showStatus("El proyecto supera el límite total permitido.", "error");
      break;
    }

    state.files.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: path,
      size: file.size,
      path,
      groupId,
      groupName
    });

    existing.add(key);
    added++;
  }

  if (added > 0) {
    state.analysis = "";
    renderAttachments();
    showStatus(
      `${groupName || "Archivos"}: ${added} archivos preparados. Se analizarán al enviar el mensaje.`,
      "success"
    );
  } else if (newFiles.length === 0) {
    showStatus("No se recibieron archivos.", "error");
  }
}
function addFiles(newFiles, groupName = null) {
  const existing = new Set(
    state.files.map(file => `${file.path}:${file.size}`)
  );

  const groupId = groupName
    ? `group-${Date.now()}-${Math.random().toString(36).slice(2)}`
    : null;

  let added = 0;

  for (const file of newFiles) {
    if (state.files.length >= CONFIG.maxFiles) {
      showStatus(
        `Máximo ${CONFIG.maxFiles} archivos por proyecto.`,
        "error"
      );
      break;
    }

    const path =
      file.codelabRelativePath ||
      file.webkitRelativePath ||
      file.name;

    const key = `${path}:${file.size}`;

    if (existing.has(key)) continue;

    if (file.size > CONFIG.maxFileSize) {
      showStatus(`${path}: supera el límite permitido.`, "error");
      continue;
    }

    if (
      calculateTotalSize(state.files) + file.size >
      CONFIG.maxTotalSize
    ) {
      showStatus(
        "El proyecto supera el límite total permitido.",
        "error"
      );
      break;
    }

    state.files.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: path,
      size: file.size,
      path,
      groupId,
      groupName
    });

    existing.add(key);
    added++;
  }

  if (added > 0) {
    state.analysis = "";
    renderAttachments();

    showStatus(
      `${groupName || "Archivos"}: ${added} archivos preparados. Se analizarán al enviar el mensaje.`,
      "success"
    );
  } else if (newFiles.length === 0) {
    showStatus("No se recibieron archivos.", "error");
  }
}
 folderInput.addEventListener("change", () => {
  const selected = Array.from(folderInput.files || []);
  folderInput.value = "";
if (!selected.length) {
  showStatus(
    "El navegador no entregó archivos. Comprueba que hayas seleccionado la carpeta y no hayas cancelado el selector.",
    "error"
  );

  console.error("Folder input:", {
    webkitdirectory: folderInput.webkitdirectory,
    filesLength: folderInput.files?.length,
    value: folderInput.value
  });

  return;
}

  const firstPath = selected[0].webkitRelativePath || selected[0].name;
  const folderName = firstPath.split("/")[0] || "Proyecto";

  const filesWithPaths = selected.map(file => {
    const relativePath = file.webkitRelativePath || file.name;

        Object.defineProperty(file, "codelabRelativePath", {
      value: relativePath,
      configurable: true
    });

    return file;
  });

  // Incorporar los archivos seleccionados de la carpeta.
  addFiles(filesWithPaths, folderName);
});

// Esta función debe quedar fuera del evento de selección de carpetas.
function loadZipLibrary() {
    if (window.JSZip) return Promise.resolve(window.JSZip);

    if (state.zipPromise) return state.zipPromise;

    state.zipPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CONFIG.zipLibrary;
      script.async = true;

      script.onload = () => {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error("No se pudo cargar JSZip."));
      };

      script.onerror = () => reject(
        new Error("No se pudo cargar el lector ZIP.")
      );

      document.head.appendChild(script);
    });

    return state.zipPromise;
  }


async function extractZip(zipFile) {
  showStatus(`Extrayendo el contenido de ${zipFile.name}...`);

  const JSZip = await loadZipLibrary();
  const zip = await JSZip.loadAsync(zipFile);

  const extracted = [];

  const ignoredDirectories = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    ".vercel"
  ]);

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const normalizedPath = path.replace(/\\/g, "/");
    const segments = normalizedPath.split("/").filter(Boolean);

    if (segments.some(segment => ignoredDirectories.has(segment))) {
      continue;
    }

    const extension = getExtension(normalizedPath);

    const imageTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif"
    };

    if (!TEXT_EXTENSIONS.has(extension) && !imageTypes[extension]) {
      continue;
    }

    const blob = await entry.async("blob");

    const file = new File(
      [blob],
      segments[segments.length - 1],
      {
        type: blob.type || imageTypes[extension] || "text/plain"
      }
    );

    Object.defineProperty(file, "webkitRelativePath", {
      value: normalizedPath
    });

    extracted.push(file);

    if (extracted.length >= CONFIG.maxFiles) {
      showStatus(
        `Se alcanzó el límite de ${CONFIG.maxFiles} archivos del ZIP.`,
        "info"
      );
      break;
    }
  }

  if (extracted.length === 0) {
    throw new Error("La carpeta comprimida no contiene archivos compatibles.");
  }

  return extracted;
}
  async function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(
        new Error(`No se pudo leer la imagen ${file.name}.`)
      );

      reader.readAsDataURL(file);
    });
  }

  async function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(
        new Error(`No se pudo leer ${file.name}.`)
      );

      reader.readAsText(file);
    });
  }

  async function prepareFiles() {
    const prepared = [];
    let imageCount = 0;

    for (const item of state.files) {
      const file = item.file;

      if (isImage(file)) {
        imageCount++;

        if (imageCount > CONFIG.maxImages) {
          showStatus(
            `Solo se analizarán las primeras ${CONFIG.maxImages} imágenes.`,
            "info"
          );
          continue;
        }

        prepared.push({
          name: item.path,
          type: file.type,
          dataUrl: await readAsDataURL(file)
        });

      } else if (isTextFile(file)) {
        prepared.push({
          name: item.path,
          type: file.type,
          content: await readAsText(file)
        });
      }
    }

    return prepared;
  }


async function getFilesForRequest() {
    const prepared = [];

    for (const item of state.files) {
        if (!isTextFile(item.file)) {
            continue;
        }

        const content = await readAsText(item.file);

        prepared.push({
            path: item.path,
            content
        });
    }

    return prepared;
}

  
  async function analyzeProject() {
    state.analysis = "";

    if (state.files.length === 0) {
      state.analyzing = false;
      hideStatus();
      renderAttachments();
      return;
    }

    state.analyzing = true;
    renderAttachments();
    showStatus("Preparando archivos para Qwen...");

    try {
      const files = await prepareFiles();

      if (files.length === 0) {
        throw new Error("No hay archivos compatibles para analizar.");
      }

      showStatus("Qwen 3.8 27B está analizando el proyecto...");

      const response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ files })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Falló el análisis del proyecto.");
      }

     state.analysis = result.analysis;
state.analyzing = false;

showStatus(
  `Análisis completado: ${result.filesAnalyzed} archivos procesados` +
  (result.filesIgnored ? ` · ${result.filesIgnored} ignorados` : ""),
  "success"
);

return true;
      showStatus(
        `Análisis completado: ${result.filesAnalyzed} archivos procesados` +
        (result.filesIgnored ? ` · ${result.filesIgnored} ignorados` : ""),
        "success"
      );

    } catch (error) {
      state.analysis = "";
      state.analyzing = false;
      showStatus(error.message || "No se pudo analizar el proyecto.", "error");
      console.error("Codelab attachment analysis:", error);
      return false;
    }
  }

  function openMenu() {
    menu.hidden = !menu.hidden;
  }

  attachButton.addEventListener("click", openMenu);

  menu.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    menu.hidden = true;

    if (button.dataset.action === "files") {
      fileInput.click();
    }

    if (button.dataset.action === "folder") {
      folderInput.click();
    }

    if (button.dataset.action === "zip") {
      fileInput.accept = ".zip,application/zip,application/x-zip-compressed";
      fileInput.click();
    }
  });

  document.addEventListener("click", event => {
    if (!menu.contains(event.target) && !attachButton.contains(event.target)) {
      menu.hidden = true;
    }
  });

  fileInput.addEventListener("change", async () => {
    const selected = Array.from(fileInput.files || []);
    fileInput.value = "";

    const zipFiles = selected.filter(file =>
      getExtension(file.name) === "zip"
    );

    const normalFiles = selected.filter(file =>
      getExtension(file.name) !== "zip"
    );

    try {
      if (normalFiles.length) addFiles(normalFiles);

      for (const zipFile of zipFiles) {
        const extracted = await extractZip(zipFile);
        addFiles(extracted, zipFile.name);
      }
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      fileInput.accept = "*/*";
    }
  });

let bypassSendInterception = false;
  function injectProjectContext() {
    if (!state.analysis || state.analyzing) return false;

    const userMessage = inputField.value.trim();

    if (!userMessage) return false;

    if (inputField.dataset.projectContextInjected === "true") {
      return true;
    }

    inputField.value =
      `${userMessage}\n\n` +
      `--- CONTEXTO DEL PROYECTO ANALIZADO POR QWEN ---\n` +
      `${state.analysis}\n` +
      `--- FIN DEL CONTEXTO DEL PROYECTO ---`;

    inputField.dataset.projectContextInjected = "true";

    queueMicrotask(() => {
      inputField.dataset.projectContextInjected = "false";
    });

    return true;
  }

async function processAttachmentSend(event) {
  if (bypassSendInterception) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (state.analyzing) return;

  if (state.files.length > 0 && !state.analysis) {
    const success = await analyzeProject();
    if (!success) return;
  }

  injectProjectContext();

  bypassSendInterception = true;
  sendButton.click();

  setTimeout(() => {
    bypassSendInterception = false;
  }, 0);
}

document.addEventListener("click", event => {
  if (!event.target.closest("#codelabSendBtn")) return;
  processAttachmentSend(event);
}, true);

document.addEventListener("keydown", event => {
  if (event.target !== inputField) return;
  if (event.key !== "Enter" || event.shiftKey) return;

  processAttachmentSend(event);
}, true);

  window.codelabAttachments = {
    getFiles: () => state.files.map(item => item.name),
    getFilesForRequest,
    getAnalysis: () => state.analysis,
    clear: () => {
      state.files = [];
      state.analysis = "";
      state.analyzing = false;
      renderAttachments();
      hideStatus();
    }
  };

})();
