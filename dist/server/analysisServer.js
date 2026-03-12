"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAnalysisServer = startAnalysisServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const codeAnalyzer_1 = require("../parsers/codeAnalyzer");
const fileScanner_1 = require("../core/fileScanner");
const languageDetector_1 = require("../core/languageDetector");
const graphBuilder_1 = require("../core/graphBuilder");
const githubHandler_1 = require("../core/githubHandler");
const visualizer_1 = require("../core/visualizer");
const app = (0, express_1.default)();
let PORT = 3001;
const MAX_SOURCE_BYTES = 1024 * 1024;
let currentVisualizationHtml = null;
let currentRepoCleanup = null;
// Track directories that need to be cleaned up
const tempDirsToClean = [];
const runCleanup = () => {
    while (tempDirsToClean.length > 0) {
        const dir = tempDirsToClean.pop();
        if (dir) {
            try {
                if (fs_1.default.existsSync(dir)) {
                    fs_1.default.rmSync(dir, { recursive: true, force: true });
                    console.log(`Cleaned up temporary directory: ${dir}`);
                }
            }
            catch (error) {
                console.error(`Failed to clean up directory ${dir}:`, error instanceof Error ? error.message : error);
            }
        }
    }
    if (currentRepoCleanup) {
        try {
            currentRepoCleanup();
        }
        catch (error) {
            console.error("Cleanup failed:", error instanceof Error ? error.message : error);
        }
        currentRepoCleanup = null;
    }
};
const handleSignal = (signal) => {
    console.log(`\nReceived ${signal}. Cleaning up...`);
    runCleanup();
    process.exit(0);
};
process.on("exit", runCleanup);
process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
process.on("SIGHUP", () => handleSignal("SIGHUP"));
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    runCleanup();
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    runCleanup();
    process.exit(1);
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
function safeReadSource(filePath) {
    const fileStat = fs_1.default.statSync(filePath);
    if (fileStat.size > MAX_SOURCE_BYTES) {
        throw new Error("File is too large to preview");
    }
    return fs_1.default.readFileSync(filePath, "utf8");
}
function landingPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Repository Visualizer</title>
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121a2b;
      --line: #283556;
      --text: #e8edf7;
      --muted: #a8b3cb;
      --accent: #2dd4bf;
      --accent-2: #60a5fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(900px 600px at 100% -10%, rgba(45, 212, 191, 0.12), transparent 60%),
        radial-gradient(900px 600px at -10% 110%, rgba(59, 130, 246, 0.12), transparent 60%),
        var(--bg);
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .ambient {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }
    .orb {
      position: absolute;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(96, 165, 250, 0.25), transparent 60%);
      filter: blur(2px);
      animation: float 12s ease-in-out infinite;
    }
    .orb.one { top: -120px; right: -120px; }
    .orb.two { bottom: -160px; left: -140px; animation-delay: -4s; }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(22px); }
    }
    .card {
      width: min(720px, 92vw);
      background: linear-gradient(180deg, #141d31 0%, #0f1525 100%);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 18px 45px rgba(3, 6, 15, 0.5);
      display: grid;
      gap: 16px;
      position: relative;
      z-index: 1;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.2px;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #d9f7f0;
      background: rgba(45, 212, 191, 0.12);
      border: 1px solid rgba(45, 212, 191, 0.35);
      border-radius: 999px;
      padding: 4px 10px;
      width: fit-content;
    }
    .badge span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px rgba(45, 212, 191, 0.8);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }
    input {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 13px;
      background: #0f1729;
      color: var(--text);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.15);
    }
    button {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      cursor: pointer;
      background: linear-gradient(180deg, #1c2a49 0%, #16233b 100%);
      color: var(--text);
      transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }
    button:hover {
      border-color: var(--accent);
      box-shadow: 0 8px 18px rgba(16, 185, 129, 0.2);
      transform: translateY(-1px);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .tile {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: rgba(15, 23, 41, 0.7);
      font-size: 12px;
      color: var(--muted);
    }
    .tile strong {
      display: block;
      color: var(--text);
      margin-bottom: 6px;
    }
    .status {
      min-height: 18px;
      font-size: 12px;
      color: var(--muted);
    }
    .small {
      font-size: 12px;
      color: var(--muted);
    }
    code {
      background: #0f1729;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid var(--line);
    }
  </style>
</head>
<body>
  <div class="ambient">
    <div class="orb one"></div>
    <div class="orb two"></div>
  </div>
  <div class="card">
    <div>
      <h1>Repository Visualizer</h1>
      <p>Paste a GitHub URL or a local repo path. The server will build the dependency graph and open the interactive view.</p>
    </div>
    <div class="row">
      <input id="repoInput" placeholder="https://github.com/user/repo or C:\\path\\to\\repo" />
      <button id="goBtn">Visualize</button>
    </div>
    <div id="status" class="status"></div>
    <div class="grid">
      <div class="tile"><strong>Flow Graphs</strong>Double-click a file to inspect its internal flow chart.</div>
      <div class="tile"><strong>Dependency Map</strong>See imports, dependents, and critical modules at a glance.</div>
      <div class="tile"><strong>Metrics</strong>File size, LOC, cycles, and structure insights.</div>
    </div>
  </div>

  <script>
    const input = document.getElementById("repoInput");
    const status = document.getElementById("status");
    const button = document.getElementById("goBtn");
    async function visualize() {
      const value = String(input.value || "").trim();
      if (!value) {
        status.textContent = "Enter a repository URL or local path.";
        return;
      }
      status.textContent = "Building visualization... this can take a moment.";
      button.disabled = true;
      try {
        const res = await fetch("/api/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: value })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to build visualization");
        }
        window.location.href = data.url || "/visualization";
      } catch (err) {
        status.textContent = String(err);
      } finally {
        button.disabled = false;
      }
    }
    button.addEventListener("click", visualize);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") visualize();
    });
  </script>
</body>
</html>`;
}
async function buildVisualization(input) {
    if (currentRepoCleanup) {
        currentRepoCleanup();
        currentRepoCleanup = null;
    }
    const result = await (0, githubHandler_1.getRepoPath)(input, (dir) => {
        tempDirsToClean.push(dir);
    });
    currentRepoCleanup = result.cleanup || null;
    const files = await (0, fileScanner_1.scanRepository)(result.repoPath);
    (0, languageDetector_1.detectExtensions)(files);
    const graph = (0, graphBuilder_1.buildGraph)(files);
    const outputDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "repo-visualizer-output-"));
    // Record output directories to be cleaned up
    tempDirsToClean.push(outputDir);
    const outputPath = path_1.default.join(outputDir, "graph.json");
    fs_1.default.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
    const htmlPath = (0, visualizer_1.generateVisualization)(graph, outputPath, PORT);
    return fs_1.default.readFileSync(htmlPath, "utf8");
}
app.get("/", (_req, res) => {
    res.status(200).send(landingPage());
});
app.get("/visualization", (_req, res) => {
    if (!currentVisualizationHtml) {
        return res.status(404).send("No visualization generated yet.");
    }
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(currentVisualizationHtml);
});
app.post("/api/cleanup", (_req, res) => {
    runCleanup();
    res.json({ ok: true });
});
app.post("/api/visualize", async (req, res) => {
    const input = String(req.body?.input || "").trim();
    if (!input) {
        return res.status(400).json({ error: "input is required" });
    }
    try {
        currentVisualizationHtml = await buildVisualization(input);
        return res.json({ ok: true, url: "/visualization" });
    }
    catch (error) {
        console.error("Visualization error:", error);
        return res.status(500).json({
            error: "Failed to build visualization",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
app.get("/api/analyze", (req, res) => {
    const filePath = req.query.file;
    if (!filePath) {
        return res.status(400).json({ error: "file parameter is required" });
    }
    try {
        const structure = (0, codeAnalyzer_1.analyzeFileStructure)(filePath);
        return res.json(structure);
    }
    catch (error) {
        console.error("Error analyzing file:", error);
        return res.status(500).json({
            error: "Failed to analyze file",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
app.get("/api/source", (req, res) => {
    const filePath = req.query.file;
    if (!filePath) {
        return res.status(400).json({ error: "file parameter is required" });
    }
    try {
        const content = safeReadSource(filePath);
        return res.json({ filePath, content });
    }
    catch (error) {
        return res.status(500).json({
            error: "Failed to read source file",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = http_1.default.createServer(app);
        server.listen(startPort, () => {
            const addressInfo = server.address();
            if (addressInfo && typeof addressInfo !== "string") {
                const port = addressInfo.port;
                server.close();
                resolve(port);
            }
            else {
                reject(new Error("Could not determine port"));
            }
        });
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                resolve(findAvailablePort(startPort + 1));
            }
            else {
                reject(err);
            }
        });
    });
}
async function startAnalysisServer() {
    const availablePort = await findAvailablePort(PORT);
    PORT = availablePort;
    return new Promise((resolve) => {
        app.listen(PORT, () => {
            console.log(`\nAnalysis server running at http://localhost:${PORT}`);
            console.log(`   API endpoint: http://localhost:${PORT}/api/analyze?file=<filepath>`);
            resolve(PORT);
        });
    });
}
