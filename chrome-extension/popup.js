const PORTS_TO_TRY = Array.from({ length: 10 }, (_, index) => 3001 + index);
const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
  ".h",
  ".hpp",
  ".rs",
  ".rb"
]);

const analyzeBtn = document.getElementById("analyzeBtn");
const uploadBtn = document.getElementById("uploadBtn");
const folderInput = document.getElementById("folderInput");
const statusEl = document.getElementById("status");
const currentUrlEl = document.getElementById("currentUrl");

let currentTabUrl = "";
let serverBaseUrl = "";

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = type;
}

function setBusy(isBusy) {
  analyzeBtn.disabled = isBusy;
  uploadBtn.disabled = isBusy;
}

async function queryCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab?.url || "";
  currentUrlEl.textContent = currentTabUrl || "No current tab URL found.";
}

async function findServer() {
  if (serverBaseUrl) {
    return serverBaseUrl;
  }

  for (const port of PORTS_TO_TRY) {
    const candidate = `http://localhost:${port}`;
    try {
      const response = await fetch(`${candidate}/health`);
      if (response.ok) {
        serverBaseUrl = candidate;
        return candidate;
      }
    } catch {
      // Try the next local RepoViz port.
    }
  }

  throw new Error("RepoViz server was not found on localhost:3001-3010.");
}

async function postJson(path, body) {
  const baseUrl = await findServer();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "RepoViz request failed.");
  }

  return { baseUrl, data };
}

async function analyzeCurrentTab() {
  if (!currentTabUrl) {
    throw new Error("No active tab URL to analyze.");
  }

  const { baseUrl, data } = await postJson("/api/visualize", {
    input: currentTabUrl
  });

  await chrome.tabs.create({ url: `${baseUrl}${data.url || "/visualization"}` });
}

function getExtension(filePath) {
  const fileName = filePath.toLowerCase();
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex) : "";
}

function shouldUpload(file) {
  const path = file.webkitRelativePath || file.name;
  if (!SUPPORTED_EXTENSIONS.has(getExtension(path))) {
    return false;
  }

  return !path.split("/").some((part) =>
    ["node_modules", ".git", "dist", "build", ".next", "out"].includes(part)
  );
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        path: file.webkitRelativePath || file.name,
        content: String(reader.result || "")
      });
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

async function uploadSelectedFolder(files) {
  const sourceFiles = Array.from(files).filter(shouldUpload);

  if (sourceFiles.length === 0) {
    throw new Error("No supported source files were found in that folder.");
  }

  setStatus(`Uploading ${sourceFiles.length} source files...`);
  const uploadedFiles = await Promise.all(sourceFiles.map(readFileAsText));
  const { baseUrl, data } = await postJson("/api/upload-folder", {
    files: uploadedFiles
  });

  await chrome.tabs.create({ url: `${baseUrl}${data.url || "/visualization"}` });
}

analyzeBtn.addEventListener("click", async () => {
  setBusy(true);
  setStatus("Sending current tab URL to RepoViz...");
  try {
    await analyzeCurrentTab();
    setStatus("Visualization opened.", "ok");
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

uploadBtn.addEventListener("click", () => {
  folderInput.value = "";
  folderInput.click();
});

folderInput.addEventListener("change", async () => {
  if (!folderInput.files?.length) {
    return;
  }

  setBusy(true);
  try {
    await uploadSelectedFolder(folderInput.files);
    setStatus("Visualization opened.", "ok");
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

queryCurrentTab()
  .then(() => findServer())
  .then((baseUrl) => setStatus(`Connected to ${baseUrl}.`, "ok"))
  .catch((error) => setStatus(error.message || String(error), "error"));
