import { Graph } from "./graphTypes"
import fs from "fs"
import path from "path"

interface ViewNode {
  id: number
  nodeId: string
  label: string
  title: string
  isExternal: boolean
  fileType?: string
  loc?: number
  sizeBytes?: number
}

interface ViewEdge {
  id: string
  from: number
  to: number
  label: string
}

function jsonInline<T>(value: T): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

function baseName(value: string): string {
  const normalized = value.replace(/\\/g, "/")
  const parts = normalized.split("/")
  return parts[parts.length - 1] || value
}

function displayPath(value: string): string {
  const normalized = String(value || "").replace(/\\/g, "/")
  const lower = normalized.toLowerCase()
  const marker = "/repo-visualizer/"
  const idx = lower.indexOf(marker)
  if (idx !== -1) {
    return normalized.slice(idx + 1)
  }
  const bare = "repo-visualizer/"
  const idxBare = lower.indexOf(bare)
  if (idxBare !== -1) {
    return normalized.slice(idxBare)
  }
  return normalized
}

function typeColor(fileType?: string): string {
  switch (fileType) {
    case "component":
      return "#3b82f6"
    case "service":
      return "#facc15"
    case "utility":
      return "#22c55e"
    case "config":
      return "#8b5cf6"
    case "hook":
      return "#ec4899"
    case "page":
      return "#14b8a6"
    default:
      return "#94a3b8"
  }
}

function buildViewData(graph: Graph): { nodes: ViewNode[]; edges: ViewEdge[] } {
  const nodeIndex = new Map<string, number>()
  const nodes: ViewNode[] = graph.nodes.map((node, index) => {
    nodeIndex.set(node.id, index)
    return {
      id: index,
      nodeId: node.id,
      label: baseName(node.id),
      title: node.id,
      isExternal: false,
      fileType: node.fileType,
      loc: node.loc,
      sizeBytes: node.sizeBytes
    }
  })

  const externals: string[] = []
  for (const edge of graph.edges) {
    if (!nodeIndex.has(edge.to) && !externals.includes(edge.to)) {
      externals.push(edge.to)
    }
  }

  externals.forEach((externalId, index) => {
    const viewId = nodes.length + index
    nodeIndex.set(externalId, viewId)
    nodes.push({
      id: viewId,
      nodeId: externalId,
      label: baseName(externalId),
      title: externalId,
      isExternal: true
    })
  })

  const edges: ViewEdge[] = []
  graph.edges.forEach((edge, index) => {
    const from = nodeIndex.get(edge.from)
    const to = nodeIndex.get(edge.to)
    if (from === undefined || to === undefined) return

    edges.push({
      id: `edge-${index}-${from}-${to}`,
      from,
      to,
      label: edge.type
    })
  })

  return { nodes, edges }
}

export function generateVisualization(
  graph: Graph,
  outputPath: string,
  serverPort = 3001
): string {
  const graphDir = path.dirname(outputPath)
  const base = path.basename(outputPath, path.extname(outputPath))
  const htmlPath = path.join(graphDir, `${base}-visualization.html`)
  const viewData = buildViewData(graph)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repository Dependency Graph</title>
  <link href="https://cdn.jsdelivr.net/npm/vis-network/dist/vis-network.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/vis-network/dist/vis-network.min.js"></script>
  <style>
    :root {
      --bg: #0c111c;
      --panel: #151d2f;
      --soft: #1d2943;
      --text: #e8edf7;
      --muted: #a8b3cb;
      --line: #2d3b5f;
      --red: #ff3b3b;
      --accent: #2dd4bf;
      --shadow: 0 16px 40px rgba(6, 10, 20, 0.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(1100px 700px at 95% -10%, #20325c 0%, transparent 60%),
        radial-gradient(1200px 900px at -5% 115%, #1b4b58 0%, transparent 55%),
        var(--bg);
    }
    .app {
      height: 100%;
      padding: 10px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 10px;
    }
    .topbar {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: linear-gradient(135deg, #162444 0%, #111829 100%);
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      box-shadow: var(--shadow);
    }
    .title h1 { font-size: 18px; letter-spacing: 0.2px; }
    .title p { margin-top: 2px; font-size: 12px; color: var(--muted); }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #searchInput, .btn {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text);
      background: #0f1729;
      transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }
    .btn {
      cursor: pointer;
      background: linear-gradient(180deg, #1c2a49 0%, #16233b 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .btn:hover {
      border-color: var(--accent);
      box-shadow: 0 6px 14px rgba(16, 185, 129, 0.18);
      transform: translateY(-1px);
    }
    .btn:active { transform: translateY(0); }
    #searchInput { min-width: 220px; }
    .main {
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .graph-card, .panel {
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: var(--panel);
    }
    .graph-card {
      position: relative;
      background: radial-gradient(1200px 600px at 75% -20%, rgba(45, 212, 191, 0.08), transparent 60%),
        linear-gradient(180deg, #0f1729 0%, #0f1525 100%);
      box-shadow: var(--shadow);
    }
    #network {
      width: 100%;
      height: 100%;
      min-height: 420px;
    }
    .hint {
      position: absolute;
      left: 8px;
      bottom: 8px;
      font-size: 11px;
      color: var(--muted);
      background: rgba(12, 17, 28, 0.92);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 7px 10px;
      display: flex;
      gap: 8px;
    }
    .flow-legend {
      position: absolute;
      top: 8px;
      right: 8px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(10, 16, 28, 0.96);
      padding: 8px 10px;
      min-width: 200px;
      font-size: 11px;
      color: var(--muted);
      display: grid;
      gap: 5px;
      z-index: 4;
    }
    .flow-back {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 5;
      border: 1px solid #7f1d1d;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 700;
      color: #fee2e2;
      background: rgba(153, 27, 27, 0.92);
      cursor: pointer;
    }
    .flow-back:hover {
      background: rgba(185, 28, 28, 0.95);
    }
    .flow-legend .title {
      color: var(--text);
      font-weight: 600;
      margin-bottom: 2px;
    }
    .flow-legend .item {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .side {
      display: none;
      min-height: 0;
    }
    body.flow-mode .main {
      grid-template-columns: minmax(0, 1fr) 380px;
    }
    body.flow-mode .side {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      gap: 10px;
    }
    body.flow-mode .side.metrics-open {
      flex-direction: column;
    }
    body.flow-mode {
      overflow: hidden;
    }
    body.flow-mode #codePanel {
      height: 100%;
      min-height: 0;
    }
    body.flow-mode #codePanel .panel-body {
      min-height: 0;
      overflow: hidden;
    }
    body.flow-mode #codeView {
      height: 100%;
      overflow: auto;
    }
    body.flow-mode #metricsPanel {
      height: 100%;
      min-height: 0;
    }
    body.flow-mode #metricsPanel .panel-body {
      min-height: 0;
      overflow: auto;
    }
    body.flow-mode #metricsSideSlot {
      min-height: 0;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    body.flow-mode #metricsSideSlot > .panel {
      flex: 1;
      min-height: 0;
    }
    .panel {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 0;
    }
    .panel-header {
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(90deg, #1c2945 0%, #1a2741 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-body {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      font-size: 12px;
    }
    .hidden { display: none !important; }
    .collapsed .panel-body { display: none; }
    .metrics-grid, .chart-list, .list {
      display: grid;
      gap: 8px;
    }
    .metric-card, .list-item {
      border: 1px solid var(--line);
      border-radius: 9px;
      padding: 8px;
      background: var(--soft);
      color: var(--muted);
      font-size: 11px;
      word-break: break-all;
    }
    .metric-card .value {
      margin-top: 2px;
      color: var(--text);
      font-size: 16px;
      font-weight: 700;
    }
    .chart-row .head {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 3px;
    }
    .chart-row .bar {
      height: 8px;
      border-radius: 999px;
      background: #0e1526;
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .chart-row .bar > div {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #ff7a7a 0%, #ff3b3b 100%);
    }
    .code-meta {
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 8px;
      display: grid;
      gap: 3px;
      word-break: break-all;
    }
    .code-view {
      min-height: 180px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0d1424;
      overflow: auto;
      font-family: Consolas, monospace;
      font-size: 11px;
      line-height: 1.45;
    }
    .code-line {
      display: grid;
      grid-template-columns: 42px 1fr;
      gap: 10px;
      padding: 2px 10px;
    }
    .code-line:hover {
      background: rgba(45, 212, 191, 0.08);
    }
    .code-line .line-no {
      color: var(--muted);
      text-align: right;
      user-select: none;
    }
    .code-line .line-text {
      white-space: pre;
    }
    .code-line.flow-highlight {
      background: rgba(244, 63, 94, 0.18);
      box-shadow: inset 0 0 0 1px rgba(244, 63, 94, 0.35);
    }
    .code-line.cursor-highlight {
      background: rgba(34, 197, 94, 0.15);
    }
    .control-drawer {
      position: fixed;
      top: 72px;
      right: 16px;
      width: 320px;
      max-height: calc(100vh - 110px);
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(19, 28, 47, 0.98) 0%, rgba(15, 21, 37, 0.98) 100%);
      backdrop-filter: blur(8px);
      padding: 10px;
      display: grid;
      gap: 8px;
      z-index: 9;
      transform: translateX(calc(100% + 24px));
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s ease, opacity 0.25s ease;
      box-shadow: var(--shadow);
    }
    .control-drawer.open {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }
    .control-drawer .btn,
    .control-drawer #searchInput,
    .control-drawer .panel {
      border-radius: 10px;
    }
    .control-drawer #searchInput {
      width: 100%;
    }
    .legend-grid {
      display: grid;
      gap: 6px;
      font-size: 11px;
      color: var(--muted);
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-swatch {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 1px solid var(--line);
      background: #1f2a44;
    }
    .graph-legend {
      position: absolute;
      left: 8px;
      top: 8px;
      z-index: 6;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(12, 17, 28, 0.94);
      padding: 8px 10px;
      min-width: 200px;
      color: var(--muted);
    }
    .graph-legend .title {
      color: var(--text);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .flow-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    @media (max-width: 1100px) {
      .main { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="title">
        <h1 id="titleText">Repository Dependency Graph</h1>
        <p id="summaryLine"></p>
      </div>
      <div class="actions">
        <button id="backBtn" class="btn">Back To Repo</button>
        <div id="flowActionBar" class="flow-actions"></div>
        <button id="controlsToggle" class="btn">Open Controls</button>
      </div>
    </header>
    <div id="controlDrawer" class="control-drawer">
      <input id="searchInput" type="text" placeholder="Search files/modules...">
      <div id="quickButtonSlot">
        <button id="fitBtn" class="btn">Fit</button>
        <button id="toggleMetricsBtn" class="btn">Show Metrics</button>
      </div>
      <div id="metricsDrawerSlot">
        <section id="metricsPanel" class="panel hidden">
          <div class="panel-header">
            <span>Metrics Dashboard</span>
          </div>
          <div id="metricsBody" class="panel-body"></div>
        </section>
      </div>
    </div>

    <main class="main">
      <section class="graph-card">
        <div id="network"></div>
        <div id="graphLegend" class="graph-legend">
          <div class="title">Color Coding</div>
          <div id="typeLegend" class="legend-grid"></div>
        </div>
        <div id="flowLegend" class="flow-legend hidden">
          <div class="title">Flow Legend</div>
          <div class="item"><span>Ellipse</span><span>Start/End</span></div>
          <div class="item"><span>Rectangle</span><span>Process/Call</span></div>
          <div class="item"><span>Diamond</span><span>Decision</span></div>
          <div class="item"><span>Red Solid</span><span>Main Flow</span></div>
          <div class="item"><span>Red Dashed</span><span>Source/Sink Link</span></div>
        </div>
        <div class="hint">
          <span>Single click: source + highlight</span>
          <span>Double click: top-down source-to-sink flowchart</span>
        </div>
      </section>

      <aside class="side">
        <section id="codePanel" class="panel">
          <div class="panel-header">
            <span>Source Viewer</span>
          </div>
          <div class="panel-body">
            <div id="codeMeta" class="code-meta">Select a local file node to load source.</div>
            <pre id="codeView" class="code-view">No file selected.</pre>
          </div>
        </section>
        <div id="metricsSideSlot"></div>
      </aside>
    </main>
  </div>

  <script>
    const serverPort = ${serverPort};
    const graphData = ${jsonInline(graph)};
    const viewData = ${jsonInline(viewData)};
    const colorByType = ${typeColor.toString()};
    const externalColor = "#f97316";

    const viewIdToNode = new Map(viewData.nodes.map((n) => [n.id, n]));
    const nodeIdToViewId = new Map(viewData.nodes.map((n) => [n.nodeId, n.id]));
    const mainBaseNodeStyles = new Map(
      viewData.nodes.map((n) => [
        n.id,
        {
          color: n.isExternal ? externalColor : colorByType(n.fileType),
          borderWidth: 1.5,
          opacity: 1,
          font: { color: "#e8edf7", size: n.isExternal ? 11 : 12 }
        }
      ])
    );
    const mainBaseEdgeStyles = new Map(
      viewData.edges.map((e) => [
        e.id,
        {
          color: { color: "#8fa3c7", opacity: 0.55 },
          width: 1.05
        }
      ])
    );

    function renderTypeLegend() {
      const legend = document.getElementById("typeLegend");
      if (!legend) return;
      const seen = new Set();
      viewData.nodes.forEach((n) => seen.add(n.fileType || "other"));
      const types = [...seen].sort();
      const entries = [
        { label: "External module (third-party)", color: externalColor },
        ...types.map((type) => ({
          label: "Local " + type + " file",
          color: colorByType(type)
        })),
        { label: "Selected node + connected dependencies", color: "#ff3b3b" }
      ];
      legend.innerHTML = entries
        .map(
          (entry) =>
            '<div class="legend-item"><span class="legend-swatch" style="background:' +
            entry.color +
            '"></span><span>' +
            entry.label +
            "</span></div>"
        )
        .join("");
    }

    const mainNodesData = new vis.DataSet(
      viewData.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        title: shortName(node.nodeId),
        shape: "dot",
        size: node.isExternal ? 12 : 16,
        ...mainBaseNodeStyles.get(node.id)
      }))
    );
    const mainEdgesData = new vis.DataSet(
      viewData.edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        arrows: "to",
        ...mainBaseEdgeStyles.get(edge.id)
      }))
    );

    const mainOptions = {
      layout: { improvedLayout: true },
      nodes: {
        borderWidthSelected: 3,
        margin: { top: 6, right: 8, bottom: 6, left: 8 }
      },
      edges: {
        font: { color: "#b8c4da", size: 9, strokeWidth: 0 },
        arrows: { to: { enabled: true, scaleFactor: 0.45 } },
        smooth: { enabled: true, type: "continuous", roundness: 0.15 },
        color: { color: "#8fa3c7", opacity: 0.6 },
        width: 1.05,
        hoverWidth: 1.6,
        selectionWidth: 2.2
      },
      physics: {
        enabled: true,
        solver: "barnesHut",
        stabilization: { iterations: 240, fit: true },
        barnesHut: {
          gravitationalConstant: -1800,
          centralGravity: 0.01,
          springLength: 180,
          springConstant: 0.04,
          damping: 0.35,
          avoidOverlap: 0.8
        }
      },
      interaction: { hover: true, zoomView: true, dragView: true, keyboard: true }
    };

    const networkContainer = document.getElementById("network");
    let network = null;

    let initialPositions = null;
    let userMovedNodeIds = new Set();
    let flowNodeMeta = new Map();
    let flowNodeRanges = [];
    let flowBaseNodeStyles = new Map();
    let flowHoveredNodeId = null;
    let flowHighlightRange = null;
    let cursorHighlightLine = null;
    let codeLineElements = [];
    let flowMetricsContext = null;
    let mode = "main";
    let flowData = null;
    let flowInitialPositions = null;
    let backInProgress = false;
    const layoutKey = (() => {
      const raw = JSON.stringify({
        nodes: viewData.nodes.map((n) => [n.nodeId, n.label]),
        edges: viewData.edges.map((e) => [e.from, e.to, e.label])
      });
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
      }
      return "repo-graph-layout:" + hash.toString(16);
    })();

    function setFlowModeUI(isFlow) {
      const topBack = document.getElementById("backBtn");
      const flowActionBar = document.getElementById("flowActionBar");
      const quickButtonSlot = document.getElementById("quickButtonSlot");
      const fitBtn = document.getElementById("fitBtn");
      const toggleMetricsBtn = document.getElementById("toggleMetricsBtn");
      const controlsToggle = document.getElementById("controlsToggle");
      const metricsPanel = document.getElementById("metricsPanel");
      const metricsDrawerSlot = document.getElementById("metricsDrawerSlot");
      const metricsSideSlot = document.getElementById("metricsSideSlot");
      const searchInput = document.getElementById("searchInput");
      const flowLegend = document.getElementById("flowLegend");
      const graphLegend = document.getElementById("graphLegend");

      if (topBack) {
        topBack.classList.remove("hidden");
        topBack.style.display = "inline-flex";
        topBack.style.visibility = "visible";
        topBack.style.opacity = "1";
      }
      if (controlsToggle) {
        controlsToggle.style.display = isFlow ? "none" : "inline-flex";
      }
      if (searchInput) {
        searchInput.style.display = isFlow ? "none" : "block";
      }
      if (flowActionBar && quickButtonSlot && fitBtn && toggleMetricsBtn) {
        if (isFlow) {
          flowActionBar.appendChild(fitBtn);
          flowActionBar.appendChild(toggleMetricsBtn);
        } else {
          quickButtonSlot.appendChild(fitBtn);
          quickButtonSlot.appendChild(toggleMetricsBtn);
        }
      }
      if (metricsPanel && metricsDrawerSlot && metricsSideSlot) {
        if (isFlow) {
          metricsSideSlot.appendChild(metricsPanel);
        } else {
          metricsDrawerSlot.appendChild(metricsPanel);
        }
      }
      if (flowLegend) flowLegend.classList.toggle("hidden", !isFlow);
      if (graphLegend) graphLegend.classList.toggle("hidden", isFlow);
      if (document.body) {
        if (isFlow) {
          document.body.classList.add("flow-mode");
        } else {
          document.body.classList.remove("flow-mode");
        }
      }
      syncMetricsLayout();
      if (!isFlow) return;
      const codePanel = document.getElementById("codePanel");
      if (!metricsVisible && codePanel && codePanel.classList.contains("hidden")) {
        codePanel.classList.remove("hidden");
      }
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function resetCodeLineState() {
      flowHighlightRange = null;
      cursorHighlightLine = null;
      codeLineElements = [];
    }

    function renderCodeWithLines(source) {
      const code = document.getElementById("codeView");
      if (!code) return;
      const lines = String(source || "").split(/\\r?\\n/);
      const html = lines
        .map((line, idx) => {
          const safe = escapeHtml(line);
          const content = safe.length ? safe : "&nbsp;";
          return (
            '<div class="code-line" data-line="' +
            (idx + 1) +
            '"><span class="line-no">' +
            (idx + 1) +
            '</span><span class="line-text">' +
            content +
            "</span></div>"
          );
        })
        .join("");
      code.innerHTML = html;
      codeLineElements = Array.from(code.querySelectorAll(".code-line"));
      flowHighlightRange = null;
      cursorHighlightLine = null;
    }

    function setLineClass(line, className, enabled) {
      const el = codeLineElements[line - 1];
      if (!el) return;
      if (enabled) {
        el.classList.add(className);
      } else {
        el.classList.remove(className);
      }
    }

    function clearFlowLineHighlight() {
      if (!flowHighlightRange) return;
      const start = flowHighlightRange.start;
      const end = flowHighlightRange.end;
      for (let i = start; i <= end; i++) {
        setLineClass(i, "flow-highlight", false);
      }
      flowHighlightRange = null;
    }

    function setFlowLineHighlight(startLine, endLine) {
      if (!codeLineElements.length) return;
      const maxLine = codeLineElements.length;
      const start = Math.max(1, Math.min(maxLine, startLine || 1));
      const end = Math.max(start, Math.min(maxLine, endLine || start));
      if (flowHighlightRange && flowHighlightRange.start === start && flowHighlightRange.end === end) {
        return;
      }
      clearFlowLineHighlight();
      for (let i = start; i <= end; i++) {
        setLineClass(i, "flow-highlight", true);
      }
      flowHighlightRange = { start, end };
      ensureLineVisible(start);
    }

    function clearCursorLineHighlight() {
      if (!cursorHighlightLine) return;
      setLineClass(cursorHighlightLine, "cursor-highlight", false);
      cursorHighlightLine = null;
    }

    function setCursorLineHighlight(line) {
      if (!line || cursorHighlightLine === line) return;
      clearCursorLineHighlight();
      setLineClass(line, "cursor-highlight", true);
      cursorHighlightLine = line;
    }

    function ensureLineVisible(line) {
      const codeView = document.getElementById("codeView");
      const el = codeLineElements[line - 1];
      if (!codeView || !el) return;
      const viewRect = codeView.getBoundingClientRect();
      const lineRect = el.getBoundingClientRect();
      const isAbove = lineRect.top < viewRect.top + 12;
      const isBelow = lineRect.bottom > viewRect.bottom - 12;
      if (isAbove || isBelow) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }

    function setFlowNodeGlow(nodeId) {
      if (!flowData || !flowBaseNodeStyles.size) return;
      if (flowHoveredNodeId === nodeId) return;
      const glowBorder = "#38bdf8";
      const glowShadow = "rgba(56, 189, 248, 0.9)";
      if (flowHoveredNodeId !== null) {
        const base = flowBaseNodeStyles.get(flowHoveredNodeId);
        if (base) {
          flowData.nodes.update({
            id: flowHoveredNodeId,
            color: base.color,
            borderWidth: base.borderWidth,
            font: base.font,
            shape: base.shape,
            shadow: { enabled: false }
          });
        }
      }
      flowHoveredNodeId = nodeId;
      if (nodeId === null || nodeId === undefined) return;
      const base = flowBaseNodeStyles.get(nodeId);
      if (!base) return;
      const baseColor = typeof base.color === "string" ? base.color : base.color?.background;
      const baseFont = base.font || { color: "#e8edf7", size: 11 };
      flowData.nodes.update({
        id: nodeId,
        color: {
          background: baseColor || "#64748b",
          border: glowBorder,
          highlight: { background: baseColor || "#64748b", border: glowBorder },
          hover: { background: baseColor || "#64748b", border: glowBorder }
        },
        borderWidth: Math.max(4.2, (base.borderWidth || 1.4) + 2.6),
        font: { ...baseFont, color: "#ffffff", size: Math.min(16, (baseFont.size || 11) + 3) },
        shape: base.shape,
        shadow: { enabled: true, color: glowShadow, size: 36, x: 0, y: 0 }
      });
    }

    function setFlowNodeSelection(nodeId) {
      if (!network || mode !== "flow") return;
      if (nodeId === null || nodeId === undefined) {
        if (network.unselectAll) network.unselectAll();
        return;
      }
      if (network.selectNodes) {
        network.selectNodes([nodeId], false);
      }
    }

    function findFlowNodeByLine(line) {
      if (!line || !flowNodeRanges.length) return null;
      let best = null;
      let bestSpan = Infinity;
      for (const entry of flowNodeRanges) {
        if (line < entry.startLine || line > entry.endLine) continue;
        const span = entry.endLine - entry.startLine;
        if (span < bestSpan) {
          best = entry;
          bestSpan = span;
        }
      }
      return best;
    }

    function positionsAreValid(positions) {
      if (!positions) return false;
      const keys = Object.keys(positions);
      if (keys.length !== viewData.nodes.length) return false;
      for (const key of keys) {
        const point = positions[key];
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return false;
        }
        if (Math.abs(point.x) > 6000 || Math.abs(point.y) > 6000) {
          return false;
        }
      }
      return true;
    }

    function clearMovedNodes() {
      userMovedNodeIds.clear();
    }

    function loadSavedLayout() {
      try {
        const raw = localStorage.getItem(layoutKey);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed?.positions) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function saveMainLayout(positions) {
      try {
        const container = document.getElementById("network");
        const size = container
          ? { w: container.clientWidth || 0, h: container.clientHeight || 0 }
          : { w: 0, h: 0 };
        localStorage.setItem(
          layoutKey,
          JSON.stringify({ positions, size })
        );
      } catch {}
    }

    function applyMainLayout(positions) {
      if (!positionsAreValid(positions)) return false;
      mainNodesData.update(
        Object.keys(positions).map((id) => ({
          id: Number(id),
          x: positions[id].x,
          y: positions[id].y
        }))
      );
      network.setOptions({ physics: false });
      initialPositions = positions;
      clearMovedNodes();
      setTimeout(() => network.fit({ animation: { duration: 250 } }), 0);
      return true;
    }

    function getValidSavedPositions() {
      const savedLayout = loadSavedLayout();
      const savedPositions = savedLayout?.positions || null;
      const container = document.getElementById("network");
      const currentSize = container
        ? { w: container.clientWidth || 0, h: container.clientHeight || 0 }
        : { w: 0, h: 0 };
      const sizeMatches =
        savedLayout?.size &&
        Math.abs(savedLayout.size.w - currentSize.w) < 120 &&
        Math.abs(savedLayout.size.h - currentSize.h) < 120;

      if (!sizeMatches) {
        try {
          localStorage.removeItem(layoutKey);
        } catch {}
        return null;
      }

      if (!positionsAreValid(savedPositions)) {
        try {
          localStorage.removeItem(layoutKey);
        } catch {}
        return null;
      }
      return savedPositions;
    }

    function bindMainNetworkEvents() {
      if (!network) return;
      let clickTimeout = null;

      network.on("click", async (params) => {
        if (!params.nodes.length || mode !== "main") return;
        const node = viewIdToNode.get(params.nodes[0]);
        if (!node) return;

        if (clickTimeout !== null) {
          clearTimeout(clickTimeout);
        }

        clickTimeout = setTimeout(async () => {
          highlightPathRed(node.nodeId);
          await loadSource(node);
          clickTimeout = null;
        }, 250);
      });

      network.on("doubleClick", async (params) => {
        if (!params.nodes.length || mode !== "main") return;
        
        if (clickTimeout !== null) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }

        const node = viewIdToNode.get(params.nodes[0]);
        if (!node || node.isExternal) return;
        await loadSource(node);
        await showFlowGraph(node);
      });

      network.on("dragEnd", (params) => {
        if (mode !== "main") return;
        if (!params.nodes || !params.nodes.length) return;
        if (!initialPositions) return;
        const current = network.getPositions(params.nodes);
        params.nodes.forEach((id) => {
          const baseline = initialPositions[id];
          const now = current[id];
          if (!baseline || !now) return;
          const dx = now.x - baseline.x;
          const dy = now.y - baseline.y;
          const moved = Math.hypot(dx, dy) > 1;
          if (moved) {
            userMovedNodeIds.add(id);
          } else {
            userMovedNodeIds.delete(id);
          }
        });
      });

      network.on("hoverNode", (params) => {
        if (mode !== "flow") return;
        const nodeId = params.node;
        const meta = flowNodeMeta.get(nodeId);
        if (meta && Number.isFinite(meta.startLine)) {
          setFlowLineHighlight(meta.startLine, meta.startLine);
        } else {
          clearFlowLineHighlight();
        }
        setFlowNodeGlow(nodeId);
      });

      network.on("blurNode", () => {
        if (mode !== "flow") return;
        clearFlowLineHighlight();
        setFlowNodeGlow(null);
      });
    }

    function createMainNetwork() {
      if (!networkContainer) return;
      if (network) {
        try {
          network.destroy();
        } catch {}
      }
      network = new vis.Network(
        networkContainer,
        { nodes: mainNodesData, edges: mainEdgesData },
        mainOptions
      );
      bindMainNetworkEvents();

      const savedPositions = getValidSavedPositions();
      if (savedPositions && applyMainLayout(savedPositions)) {
        return;
      }
      network.once("stabilizationIterationsDone", () => {
        network.setOptions({ physics: false });
        initialPositions = network.getPositions();
        clearMovedNodes();
        saveMainLayout(initialPositions);
        network.fit({ animation: { duration: 400 } });
      });
    }

    createMainNetwork();

    function displayPath(value) {
      const normalized = String(value || "").replace(/\\\\/g, "/");
      const lower = normalized.toLowerCase();
      const marker = "/repo-visualizer/";
      const idx = lower.indexOf(marker);
      if (idx !== -1) {
        return normalized.slice(idx + 1);
      }
      const bare = "repo-visualizer/";
      const idxBare = lower.indexOf(bare);
      if (idxBare !== -1) {
        return normalized.slice(idxBare);
      }
      return normalized;
    }

    function shortName(value) {
      const parts = String(value).replace(/\\\\/g, "/").split("/");
      return parts[parts.length - 1] || String(value);
    }

    function formatBytes(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
      const v = bytes / Math.pow(1024, idx);
      return v.toFixed(v >= 10 ? 0 : 1) + " " + units[idx];
    }

    function metricCard(label, value) {
      return '<div class="metric-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
    }

    function chartRow(label, value, maxValue, rawValue) {
      const raw = rawValue === undefined ? Number(value) : rawValue;
      const pct = Math.max(5, Math.min(100, Math.round((raw / maxValue) * 100)));
      return '<div class="chart-row"><div class="head"><span>' + label + '</span><span>' + value + '</span></div><div class="bar"><div style="width:' + pct + '%"></div></div></div>';
    }

    function findCycles(nodes, edges) {
      const adjacency = new Map(nodes.map((n) => [n.id, []]));
      edges.forEach((e) => {
        if (!adjacency.has(e.from)) adjacency.set(e.from, []);
        adjacency.get(e.from).push(e.to);
      });

      const visited = new Set();
      const stack = new Set();
      const path = [];
      const cycles = new Set();

      function dfs(nodeId) {
        visited.add(nodeId);
        stack.add(nodeId);
        path.push(nodeId);
        for (const next of adjacency.get(nodeId) || []) {
          if (!visited.has(next)) {
            dfs(next);
          } else if (stack.has(next)) {
            const start = path.indexOf(next);
            if (start >= 0) {
              const cycle = path.slice(start);
              cycles.add([...cycle].sort().join("|"));
            }
          }
        }
        path.pop();
        stack.delete(nodeId);
      }

      nodes.forEach((n) => {
        if (!visited.has(n.id)) dfs(n.id);
      });

      return [...cycles].map((entry) => entry.split("|"));
    }

    function renderRepoMetrics() {
      const localNodeIds = new Set(graphData.nodes.map((n) => n.id));
      const localEdges = graphData.edges.filter((e) => localNodeIds.has(e.from) && localNodeIds.has(e.to));
      const outgoing = new Map(graphData.nodes.map((n) => [n.id, 0]));
      const incoming = new Map(graphData.nodes.map((n) => [n.id, 0]));
      graphData.edges.forEach((e) => {
        if (outgoing.has(e.from)) outgoing.set(e.from, (outgoing.get(e.from) || 0) + 1);
        if (incoming.has(e.to)) incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
      });

      const externalImports = new Set(
        graphData.edges.filter((e) => !localNodeIds.has(e.to)).map((e) => e.to)
      );

      const topImporters = [...graphData.nodes]
        .sort((a, b) => (outgoing.get(b.id) || 0) - (outgoing.get(a.id) || 0))
        .slice(0, 6);
      const mostDependedOn = [...graphData.nodes]
        .sort((a, b) => (incoming.get(b.id) || 0) - (incoming.get(a.id) || 0))
        .slice(0, 6);

      const orphans = graphData.nodes.filter(
        (n) => (outgoing.get(n.id) || 0) === 0 && (incoming.get(n.id) || 0) === 0
      );
      const leafModules = graphData.nodes.filter((n) => (outgoing.get(n.id) || 0) === 0);
      const cycles = findCycles(graphData.nodes, localEdges);

      const totalLoc = graphData.nodes.reduce((s, n) => s + (n.loc || 0), 0);
      const totalSize = graphData.nodes.reduce((s, n) => s + (n.sizeBytes || 0), 0);
      const avgDeps = graphData.nodes.length
        ? (graphData.edges.length / graphData.nodes.length).toFixed(1)
        : "0";

      const byType = new Map();
      graphData.nodes.forEach((n) => {
        const key = n.fileType || "other";
        byType.set(key, (byType.get(key) || 0) + 1);
      });
      const typeEntries = [...byType.entries()].sort((a, b) => b[1] - a[1]);
      const maxType = Math.max(1, ...typeEntries.map((x) => x[1]));

      document.getElementById("summaryLine").textContent =
        graphData.nodes.length + " files | " +
        localEdges.length + " local dependencies | " +
        externalImports.size + " external imports";

      document.getElementById("metricsBody").innerHTML =
        '<div class="metrics-grid">' +
          metricCard("Files", graphData.nodes.length) +
          metricCard("Local Edges", localEdges.length) +
          metricCard("Avg Deps/File", avgDeps) +
          metricCard("Cycles", cycles.length) +
          metricCard("Total LOC", totalLoc) +
          metricCard("Total Size", formatBytes(totalSize)) +
        "</div>" +
        '<h4 style="font-size:12px;margin-bottom:6px;">File Type Breakdown</h4>' +
        '<div class="chart-list">' +
          typeEntries.map(([k, v]) => chartRow(k, v, maxType)).join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Top Importers</h4>' +
        '<div class="list">' +
          topImporters.map((n) => '<div class="list-item">' + shortName(n.id) + " (" + (outgoing.get(n.id) || 0) + " imports)</div>").join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Most Depended-On Files</h4>' +
        '<div class="list">' +
          mostDependedOn.map((n) => '<div class="list-item">' + shortName(n.id) + " (" + (incoming.get(n.id) || 0) + " dependents)</div>").join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Health Signals</h4>' +
        '<div class="list">' +
          '<div class="list-item">Orphan files: ' + orphans.length + '</div>' +
          '<div class="list-item">Leaf modules (no outgoing deps): ' + leafModules.length + '</div>' +
          (cycles.length
            ? cycles.slice(0, 5).map((cycle) => '<div class="list-item">Cycle: ' + cycle.map(shortName).join(" -> ") + '</div>').join("")
            : '<div class="list-item">No circular dependencies detected.</div>') +
        "</div>";
    }

    function renderFlowMetrics(node, entities, baseFlowEdges) {
      const byType = new Map();
      entities.forEach((e) => byType.set(e.type, (byType.get(e.type) || 0) + 1));
      const typeEntries = [...byType.entries()].sort((a, b) => b[1] - a[1]);
      const maxType = Math.max(1, ...typeEntries.map((x) => x[1]));

      const edgeType = new Map();
      baseFlowEdges.forEach((e) => edgeType.set(e.type, (edgeType.get(e.type) || 0) + 1));
      const edgeTypeEntries = [...edgeType.entries()].sort((a, b) => b[1] - a[1]);
      const maxEdgeType = Math.max(1, ...edgeTypeEntries.map((x) => x[1]));

      const longestLabel = entities
        .slice()
        .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
        .slice(0, 5);

      const uniq = (arr) => [...new Set(arr.filter(Boolean))];
      const variables = uniq(
        entities
          .filter((e) => e.type === "variable")
          .map((e) => e.name)
      );
      const functions = uniq(
        entities
          .filter((e) => e.type === "function")
          .map((e) => e.name)
      );
      const methods = uniq(
        entities
          .filter((e) => e.type === "method")
          .map((e) => e.name)
      );
      const classes = uniq(
        entities
          .filter((e) => e.type === "class")
          .map((e) => e.name)
      );
      const calls = uniq(
        entities
          .filter((e) => e.type === "call")
          .map((e) => e.name)
      );
      const libraries = uniq(
        graphData.edges
          .filter((edge) => edge.from === node.nodeId)
          .filter((edge) => !graphData.nodes.some((n) => n.id === edge.to))
          .map((edge) => edge.to)
      );
      const localDependencies = uniq(
        graphData.edges
          .filter((edge) => edge.from === node.nodeId)
          .filter((edge) => graphData.nodes.some((n) => n.id === edge.to))
          .map((edge) => shortName(edge.to))
      );
      const usedBy = uniq(
        graphData.edges
          .filter((edge) => edge.to === node.nodeId)
          .map((edge) => shortName(edge.from))
      );

      document.getElementById("summaryLine").textContent =
        "Flow view: " + shortName(node.nodeId) + " | " +
        entities.length + " flow nodes | " +
        baseFlowEdges.length + " flow edges";

      document.getElementById("metricsBody").innerHTML =
        '<div class="metrics-grid">' +
          metricCard("File", shortName(node.nodeId)) +
          metricCard("Path", displayPath(node.nodeId)) +
          metricCard("Flow Nodes", entities.length) +
          metricCard("Flow Edges", baseFlowEdges.length) +
          metricCard("Unique Step Types", typeEntries.length) +
        "</div>" +
        '<h4 style="font-size:12px;margin-bottom:6px;">Element Types</h4>' +
        '<div class="chart-list">' +
          typeEntries.map(([k, v]) => chartRow(k, v, maxType)).join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Flow Edge Types</h4>' +
        '<div class="chart-list">' +
          edgeTypeEntries.map(([k, v]) => chartRow(k, v, maxEdgeType)).join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Detailed Steps</h4>' +
        '<div class="list">' +
          longestLabel.map((e) => '<div class="list-item">' + e.name + '</div>').join("") +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Variables</h4>' +
        '<div class="list">' +
          (variables.length
            ? variables.map((name) => '<div class="list-item">' + name + '</div>').join("")
            : '<div class="list-item">No variables detected.</div>') +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Functions / Methods / Classes</h4>' +
        '<div class="list">' +
          (functions.length
            ? '<div class="list-item"><strong>Functions:</strong> ' + functions.join(", ") + '</div>'
            : '<div class="list-item"><strong>Functions:</strong> none</div>') +
          (methods.length
            ? '<div class="list-item"><strong>Methods:</strong> ' + methods.join(", ") + '</div>'
            : '<div class="list-item"><strong>Methods:</strong> none</div>') +
          (classes.length
            ? '<div class="list-item"><strong>Classes:</strong> ' + classes.join(", ") + '</div>'
            : '<div class="list-item"><strong>Classes:</strong> none</div>') +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Function Calls Used</h4>' +
        '<div class="list">' +
          (calls.length
            ? calls.map((name) => '<div class="list-item">' + name + '</div>').join("")
            : '<div class="list-item">No call expressions detected.</div>') +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Libraries Used (External)</h4>' +
        '<div class="list">' +
          (libraries.length
            ? libraries.map((name) => '<div class="list-item">' + name + '</div>').join("")
            : '<div class="list-item">No external libraries imported.</div>') +
        "</div>" +
        '<h4 style="font-size:12px;margin:12px 0 6px;">Dependencies Context</h4>' +
        '<div class="list">' +
          '<div class="list-item"><strong>Local dependencies:</strong> ' + (localDependencies.length ? localDependencies.join(", ") : "none") + '</div>' +
          '<div class="list-item"><strong>Used by:</strong> ' + (usedBy.length ? usedBy.join(", ") : "none") + '</div>' +
        "</div>";
    }

    function renderMetricsForMode() {
      if (mode === "flow") {
        if (flowMetricsContext) {
          renderFlowMetrics(
            flowMetricsContext.node,
            flowMetricsContext.entities,
            flowMetricsContext.baseFlowEdges
          );
        } else {
          document.getElementById("metricsBody").innerHTML =
            '<div class="list"><div class="list-item">No file metrics available.</div></div>';
        }
        return;
      }
      renderRepoMetrics();
    }

    function resetMainStyles() {
      mainNodesData.update(
        mainNodesData.get().map((n) => ({ id: n.id, ...mainBaseNodeStyles.get(n.id) }))
      );
      mainEdgesData.update(
        mainEdgesData.get().map((e) => ({ id: e.id, ...mainBaseEdgeStyles.get(e.id) }))
      );
    }

    function highlightPathRed(nodeId) {
      if (mode !== "main") return;
      const start = nodeIdToViewId.get(nodeId);
      if (start === undefined) return;

      const connectedNodes = new Set([start]);
      const connectedEdges = new Set();
      const queue = [start];

      while (queue.length) {
        const current = queue.shift();
        for (const edge of viewData.edges) {
          if (edge.from === current || edge.to === current) {
            connectedEdges.add(edge.id);
            if (!connectedNodes.has(edge.from)) {
              connectedNodes.add(edge.from);
              queue.push(edge.from);
            }
            if (!connectedNodes.has(edge.to)) {
              connectedNodes.add(edge.to);
              queue.push(edge.to);
            }
          }
        }
      }

      mainNodesData.update(
        mainNodesData.get().map((n) => {
          if (!connectedNodes.has(n.id)) return { id: n.id, opacity: 0.12 };
          return {
            id: n.id,
            opacity: 1,
            borderWidth: n.id === start ? 4 : 2,
            color: n.id === start ? "#ff3b3b" : (mainBaseNodeStyles.get(n.id)?.color || "#8ea4c8")
          };
        })
      );
      mainEdgesData.update(
        mainEdgesData.get().map((e) => {
          if (!connectedEdges.has(e.id)) {
            return { id: e.id, color: { color: "#555f73", opacity: 0.15 }, width: 1 };
          }
          return { id: e.id, color: { color: "#ff3b3b", opacity: 1 }, width: 2.4 };
        })
      );
    }

    async function loadSource(node) {
      const meta = document.getElementById("codeMeta");
      const code = document.getElementById("codeView");

      if (node.isExternal) {
      meta.textContent = "External module: " + node.nodeId;
        code.textContent = "Source preview unavailable for external modules.";
        resetCodeLineState();
        return;
      }

      meta.textContent = "Loading " + node.nodeId + "...";
      code.textContent = "";
      resetCodeLineState();
      try {
        const response = await fetch("http://localhost:" + serverPort + "/api/source?file=" + encodeURIComponent(node.nodeId));
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || payload.error || "Failed to load source");
        }
        const source = String(payload.content || "");
      meta.innerHTML =
        "<span><strong>File:</strong> " + node.nodeId + "</span>" +
        "<span><strong>Type:</strong> " + (node.fileType || "other") + "</span>" +
        "<span><strong>Lines:</strong> " + (node.loc || source.split(/\\r?\\n/).length) + "</span>";
        renderCodeWithLines(source);
      } catch (error) {
        meta.textContent = "Could not load source for " + node.nodeId;
        code.textContent = String(error);
        resetCodeLineState();
      }
    }

    function showNodeOverview(node) {
      const meta = document.getElementById("codeMeta");
      const code = document.getElementById("codeView");
      const outgoing = graphData.edges.filter((e) => e.from === node.nodeId);
      const incoming = graphData.edges.filter((e) => e.to === node.nodeId);
      const localOutgoing = outgoing.filter((e) => graphData.nodes.some((n) => n.id === e.to));
      const externalOutgoing = outgoing.filter((e) => !graphData.nodes.some((n) => n.id === e.to));

      meta.innerHTML =
        "<span><strong>File:</strong> " + node.nodeId + "</span>" +
        "<span><strong>Type:</strong> " + (node.fileType || "other") + "</span>" +
        "<span><strong>Lines:</strong> " + (node.loc || 0) + "</span>" +
        "<span><strong>Size:</strong> " + formatBytes(node.sizeBytes || 0) + "</span>";

      const overview =
        "Overview for " + shortName(node.nodeId) + "\\n\\n" +
        "Depends on (local): " + localOutgoing.length + "\\n" +
        (localOutgoing.length
          ? localOutgoing.slice(0, 12).map((e) => " - " + shortName(e.to)).join("\\n")
          : " - none") +
        "\\n\\nDepends on (external): " + externalOutgoing.length + "\\n" +
        (externalOutgoing.length
          ? externalOutgoing.slice(0, 8).map((e) => " - " + e.to).join("\\n")
          : " - none") +
        "\\n\\nUsed by: " + incoming.length + "\\n" +
        (incoming.length
          ? incoming.slice(0, 12).map((e) => " - " + shortName(e.from)).join("\\n")
          : " - none");
      renderCodeWithLines(overview);
    }

    function flowNodeColor(kind) {
      switch (kind) {
        case "module": return "#64748b";
        case "class": return "#a78bfa";
        case "function": return "#22c55e";
        case "method": return "#3b82f6";
        case "variable": return "#f59e0b";
        case "loop": return "#ef4444";
        case "condition": return "#f97316";
        case "call": return "#06b6d4";
        case "return": return "#f43f5e";
        default: return "#94a3b8";
      }
    }

    function flowNodeShape(kind) {
      switch (kind) {
        case "condition":
          return "diamond";
        case "loop":
          return "circle";
        case "module":
        case "return":
          return "ellipse";
        default:
          return "box";
      }
    }

    function wrapLabel(text, maxLen = 22) {
      const words = String(text || "").split(/\\s+/).filter(Boolean);
      if (!words.length) return "";
      const lines = [];
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const next = words[i];
        if ((current + " " + next).length <= maxLen) {
          current += " " + next;
        } else {
          lines.push(current);
          current = next;
        }
      }
      lines.push(current);
      return lines.join("\\n");
    }

    async function showFlowGraph(node) {
      const backBtn = document.getElementById("backBtn");
      const titleText = document.getElementById("titleText");

      try {
        const response = await fetch("http://localhost:" + serverPort + "/api/analyze?file=" + encodeURIComponent(node.nodeId));
        const structure = await response.json();
        if (!response.ok) {
          throw new Error(structure.message || structure.error || "Failed to analyze file");
        }

        const entities = Array.isArray(structure.entities) ? structure.entities : [];
        const connections = Array.isArray(structure.connections)
          ? structure.connections.filter((c) =>
              ["entry", "next", "true", "false", "loop-body", "loop-back", "calls"].includes(c.type)
            )
          : [];

        flowNodeMeta = new Map();
        flowNodeRanges = [];
        flowBaseNodeStyles = new Map();
        flowHoveredNodeId = null;
        clearFlowLineHighlight();
        clearCursorLineHighlight();
        setFlowNodeGlow(null);

        const idToIndex = new Map();
        const flowNodes = entities.map((entity, index) => {
          idToIndex.set(entity.id, index);
          let startLine = Number.isFinite(entity.startLine) ? entity.startLine + 1 : null;
          let endLine = Number.isFinite(entity.endLine) ? entity.endLine + 1 : null;
          if (startLine !== null && endLine !== null && startLine > endLine) {
            const swap = startLine;
            startLine = endLine;
            endLine = swap;
          }
          if (startLine !== null && endLine !== null) {
            flowNodeMeta.set(index, { startLine, endLine });
            flowNodeRanges.push({ id: index, startLine, endLine });
          }
          const baseStyle = {
            color: flowNodeColor(entity.type),
            borderWidth: 1.4,
            font: { color: "#e8edf7", size: 11 },
            shape: flowNodeShape(entity.type)
          };
          flowBaseNodeStyles.set(index, baseStyle);
          return {
            id: index,
            label: wrapLabel(entity.name),
            title: entity.type + " (lines " + (entity.startLine + 1) + "-" + (entity.endLine + 1) + ")",
            flowType: entity.type,
            startLine,
            endLine,
            color: baseStyle.color,
            shape: baseStyle.shape,
            margin: 10,
            font: baseStyle.font,
            borderWidth: baseStyle.borderWidth
          };
        });

        const rawFlowEdges = connections
          .map((connection, index) => {
            const from = idToIndex.get(connection.from);
            const to = idToIndex.get(connection.to);
            if (from === undefined || to === undefined) return null;
            const edgeLabel =
              connection.type === "true" || connection.type === "false" || connection.type === "calls"
                ? connection.type
                : "";
            return {
              id: "flow-edge-" + index,
              from,
              to,
              type: connection.type,
              label: edgeLabel,
              arrows: "to",
              color: { color: "#e11d48", opacity: 0.85 },
              width: connection.type === "calls" ? 1.4 : 2
            };
          })
          .filter((value) => value !== null);

        const edgeSeen = new Set();
        const baseFlowEdges = rawFlowEdges.filter((e) => {
          const key = e.from + "|" + e.to + "|" + e.type;
          if (edgeSeen.has(key)) return false;
          edgeSeen.add(key);
          return true;
        });
        let flowEdges = [...baseFlowEdges];

        if (!flowNodes.length) {
          const emptyStyle = {
            color: "#6b7280",
            borderWidth: 1.4,
            font: { color: "#e8edf7", size: 12 },
            shape: "box"
          };
          flowBaseNodeStyles.set(0, emptyStyle);
          flowNodes.push({
            id: 0,
            label: "No entities found",
            title: node.nodeId,
            color: emptyStyle.color,
            shape: emptyStyle.shape,
            font: emptyStyle.font,
            borderWidth: emptyStyle.borderWidth
          });
        }

        const incomingCount = new Map();
        const outgoingCount = new Map();
        flowNodes.forEach((n) => {
          incomingCount.set(n.id, 0);
          outgoingCount.set(n.id, 0);
        });
        flowEdges.forEach((e) => {
          outgoingCount.set(e.from, (outgoingCount.get(e.from) || 0) + 1);
          incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1);
        });

        const sourceCandidates = flowNodes
          .filter((n) => (incomingCount.get(n.id) || 0) === 0)
          .filter((n) => n.flowType !== "condition")
          .map((n) => n.id);
        const sinkCandidates = flowNodes
          .filter((n) => (outgoingCount.get(n.id) || 0) === 0)
          .filter((n) => n.flowType !== "module")
          .map((n) => n.id);

        const sourceNodeId = -1001;
        const sinkNodeId = -1002;
        const sourceStyle = {
          color: "#16a34a",
          borderWidth: 1.4,
          font: { color: "#ecfdf5", size: 12 },
          shape: "box"
        };
        const sinkStyle = {
          color: "#b91c1c",
          borderWidth: 1.4,
          font: { color: "#fef2f2", size: 12 },
          shape: "box"
        };
        flowBaseNodeStyles.set(sourceNodeId, sourceStyle);
        flowBaseNodeStyles.set(sinkNodeId, sinkStyle);
          flowNodes.push({
            id: sourceNodeId,
            label: "SOURCE",
            title: "Known entry source",
            shape: sourceStyle.shape,
            color: sourceStyle.color,
            size: 16,
            font: sourceStyle.font,
            borderWidth: sourceStyle.borderWidth
          });
        flowNodes.push({
          id: sinkNodeId,
          label: "SINK",
          title: "Known terminal sink",
          shape: sinkStyle.shape,
          color: sinkStyle.color,
          size: 16,
          font: sinkStyle.font,
          borderWidth: sinkStyle.borderWidth
        });
        const MAX_ANCHOR_EDGES = 28;
        const sourceTargets = sourceCandidates
          .slice()
          .sort((a, b) => (outgoingCount.get(b) || 0) - (outgoingCount.get(a) || 0))
          .slice(0, MAX_ANCHOR_EDGES);
        const sinkTargets = sinkCandidates
          .slice()
          .sort((a, b) => (incomingCount.get(b) || 0) - (incomingCount.get(a) || 0))
          .slice(0, MAX_ANCHOR_EDGES);

        sourceTargets.forEach((targetId, idx) => {
          flowEdges.push({
            id: "source-edge-" + idx,
            from: sourceNodeId,
            to: targetId,
            label: "start",
            arrows: "to",
            color: { color: "#e11d48", opacity: 0.9 },
            width: 2,
            dashes: true
          });
        });
        sinkTargets.forEach((fromId, idx) => {
          flowEdges.push({
            id: "sink-edge-" + idx,
            from: fromId,
            to: sinkNodeId,
            label: "end",
            arrows: "to",
            color: { color: "#e11d48", opacity: 0.9 },
            width: 2,
            dashes: true
          });
        });

        const adjacency = new Map();
        const flowNodeIds = new Set(flowNodes.map((n) => n.id));
        flowEdges = flowEdges.filter((e) => flowNodeIds.has(e.from) && flowNodeIds.has(e.to));
        flowNodes.forEach((n) => adjacency.set(n.id, []));
        flowEdges.forEach((e) => {
          if (!adjacency.has(e.from)) adjacency.set(e.from, []);
          adjacency.get(e.from).push(e.to);
        });
        const levelMap = new Map();
        const incomingById = new Map();
        flowNodes.forEach((n) => {
          incomingById.set(n.id, []);
        });
        flowEdges.forEach((e) => {
          if (!incomingById.has(e.to)) incomingById.set(e.to, []);
          incomingById.get(e.to).push(e.from);
        });

        let roots = flowNodes
          .filter((n) => n.id !== sourceNodeId && n.id !== sinkNodeId)
          .filter((n) => (incomingCount.get(n.id) || 0) === 0)
          .map((n) => n.id);
        if (!roots.length) {
          const fallbackRoot = flowNodes.find(
            (n) => n.id !== sourceNodeId && n.id !== sinkNodeId
          );
          if (fallbackRoot) roots = [fallbackRoot.id];
        }

        const q = [];
        roots.forEach((id) => {
          levelMap.set(id, 0);
          q.push(id);
        });
        while (q.length) {
          const current = q.shift();
          const currentLevel = levelMap.get(current) || 0;
          (adjacency.get(current) || []).forEach((next) => {
            if (next === sourceNodeId || next === sinkNodeId) return;
            const nextLevel = currentLevel + 1;
            if (!levelMap.has(next) || (levelMap.get(next) || 0) > nextLevel) {
              levelMap.set(next, nextLevel);
              q.push(next);
            }
          });
        }

        let changed = true;
        let guard = flowNodes.length + 2;
        while (changed && guard-- > 0) {
          changed = false;
          flowNodes.forEach((n) => {
            if (n.id === sourceNodeId || n.id === sinkNodeId) return;
            if (levelMap.has(n.id)) return;
            const preds = incomingById.get(n.id) || [];
            const predLevels = preds
              .map((p) => levelMap.get(p))
              .filter((v) => Number.isFinite(v));
            if (predLevels.length) {
              const min = Math.min(...predLevels);
              levelMap.set(n.id, min + 1);
              changed = true;
            }
          });
        }

        let maxLevel = 0;
        levelMap.forEach((value) => {
          if (Number.isFinite(value)) maxLevel = Math.max(maxLevel, value);
        });
        flowNodes.forEach((n) => {
          if (n.id === sourceNodeId) {
            n.level = 0;
            return;
          }
          if (n.id === sinkNodeId) {
            n.level = maxLevel + 2;
            return;
          }
          const base = levelMap.has(n.id) ? levelMap.get(n.id) : maxLevel + 1;
          n.level = Math.max(0, Math.round(base + 1));
        });
        const useHierarchical = flowNodes.length > 0;

        flowData = {
          nodes: new vis.DataSet(flowNodes),
          edges: new vis.DataSet(flowEdges)
        };
        flowInitialPositions = null;

        network.setData(flowData);
        const flowPhysics = useHierarchical
          ? { enabled: false }
          : {
              enabled: true,
              solver: "barnesHut",
              stabilization: { iterations: 220, fit: true },
              barnesHut: {
                gravitationalConstant: -1200,
                centralGravity: 0.01,
                springLength: 170,
                springConstant: 0.04,
                damping: 0.35,
                avoidOverlap: 0.9
              }
            };
        const flowOptions = {
          interaction: { hover: true, dragView: true, zoomView: true },
          layout: {
            hierarchical: {
              enabled: useHierarchical,
              direction: "UD",
              sortMethod: "directed",
              nodeSpacing: 340,
              levelSeparation: 230,
              treeSpacing: 520,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
              shakeTowards: "roots"
            }
          },
          physics: flowPhysics,
          nodes: {
            borderWidthSelected: 3,
            borderWidth: 1.4,
            widthConstraint: { minimum: 140, maximum: 200 },
            heightConstraint: { minimum: 46 },
            font: { size: 11, multi: "newline" },
            margin: { top: 6, right: 10, bottom: 6, left: 10 },
            shapeProperties: { borderRadius: 6 }
          },
          edges: {
            font: { color: "#fda4af", size: 9, strokeWidth: 0, align: "top" },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: {
              enabled: true,
              type: "cubicBezier",
              forceDirection: "vertical",
              roundness: 0.45
            },
            color: { inherit: false }
          }
        };

        try {
          network.setOptions(flowOptions);
        } catch (error) {
          const message = String(error || "");
          if (message.includes("hierarchical") || message.includes("levels")) {
            flowNodes.forEach((n) => {
              delete n.level;
            });
            flowOptions.layout.hierarchical.enabled = true;
            flowOptions.physics = {
              enabled: false
            };
            network.setData({
              nodes: new vis.DataSet(flowNodes),
              edges: new vis.DataSet(flowEdges)
            });
            network.setOptions(flowOptions);
          } else {
            throw error;
          }
        }
        mode = "flow";
        titleText.textContent = "File Flow Graph: " + shortName(node.nodeId);
        if (backBtn) backBtn.style.fontWeight = "700";
        setFlowModeUI(true);
        flowMetricsContext = { node, entities, baseFlowEdges };
        renderFlowMetrics(node, entities, baseFlowEdges);
        setTimeout(() => {
          network.fit({ animation: { duration: 300 } });
          setTimeout(() => {
            flowInitialPositions = network.getPositions(
              flowNodes.map((n) => n.id)
            );
          }, 220);
        }, 120);
      } catch (error) {
        document.getElementById("codeMeta").textContent = "Flow graph error for " + node.nodeId;
        document.getElementById("codeView").textContent = String(error);
      }
    }

    function applySavedMainLayout() {
      const savedPositions = getValidSavedPositions();
      const positions = savedPositions || initialPositions;
      if (!positionsAreValid(positions)) return;
      applyMainLayout(positions);
    }

    function goBackToMainGraph() {
      if (backInProgress) return;
      backInProgress = true;
      try {
        mode = "main";
        flowData = null;
        flowInitialPositions = null;
        flowNodeMeta = new Map();
        flowNodeRanges = [];
        flowBaseNodeStyles = new Map();
        flowHoveredNodeId = null;
        clearFlowLineHighlight();
        clearCursorLineHighlight();
        flowMetricsContext = null;
        createMainNetwork();
        document.getElementById("titleText").textContent = "Repository Dependency Graph";
        setFlowModeUI(false);
        renderRepoMetrics();
        resetMainStyles();
        if (network && network.setSelection) {
          network.setSelection({ nodes: [], edges: [] }, { unselectAll: true });
        }
      } finally {
        backInProgress = false;
      }
    }

    function setPanelVisibility(panelId, visible, buttonId, labelBase) {
      const panel = document.getElementById(panelId);
      const button = document.getElementById(buttonId);
      if (!panel || !button) return;
      if (visible) {
        panel.classList.remove("hidden");
        button.textContent = "Hide " + labelBase;
      } else {
        panel.classList.add("hidden");
        button.textContent = "Show " + labelBase;
      }
    }

    document.getElementById("fitBtn").addEventListener("click", () => {
      network.fit({ animation: { duration: 320 } });
    });

    document.getElementById("backBtn").addEventListener("click", () => {
      goBackToMainGraph();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mode === "flow") {
        goBackToMainGraph();
      }
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        if (mode !== "main") return;
        const term = String(event.target.value || "").trim().toLowerCase();
        if (!term) {
          resetMainStyles();
          return;
        }
        mainNodesData.update(
          mainNodesData.get().map((n) => {
            const ref = viewIdToNode.get(n.id);
            const haystack = ((ref?.nodeId || "") + " " + (ref?.label || "")).toLowerCase();
            const hit = haystack.includes(term);
            return {
              id: n.id,
              opacity: hit ? 1 : 0.12,
              borderWidth: hit ? 3 : 1.5,
              color: hit ? "#ff3b3b" : (mainBaseNodeStyles.get(n.id)?.color || "#8ea4c8")
            };
          })
        );
        mainEdgesData.update(
          mainEdgesData.get().map((e) => ({ id: e.id, color: { color: "#6d7fa2", opacity: 0.2 }, width: 1 }))
        );
      });
    }

    const codeView = document.getElementById("codeView");
    if (codeView) {
      codeView.addEventListener("wheel", (event) => {
        event.stopPropagation();
      }, { passive: true });
      codeView.addEventListener("mousemove", (event) => {
        if (mode !== "flow") return;
        const target = event.target instanceof HTMLElement
          ? event.target.closest(".code-line")
          : null;
        if (!target) {
          clearCursorLineHighlight();
          setFlowNodeGlow(null);
          return;
        }
        const line = Number(target.dataset.line || 0);
        if (!Number.isFinite(line) || line <= 0) return;
        setCursorLineHighlight(line);
        const match = findFlowNodeByLine(line);
        if (match) {
          setFlowNodeGlow(match.id);
          setFlowNodeSelection(match.id);
        } else {
          setFlowNodeGlow(null);
          setFlowNodeSelection(null);
        }
      });

      codeView.addEventListener("mouseleave", () => {
        if (mode !== "flow") return;
        clearCursorLineHighlight();
        setFlowNodeGlow(null);
        setFlowNodeSelection(null);
      });
    }

    const controlsToggle = document.getElementById("controlsToggle");
    const controlDrawer = document.getElementById("controlDrawer");
    if (controlsToggle && controlDrawer) {
      controlsToggle.addEventListener("click", () => {
        const isOpen = controlDrawer.classList.toggle("open");
        controlsToggle.textContent = isOpen ? "Close Controls" : "Open Controls";
      });
    }

    let metricsVisible = false;
    function syncMetricsLayout() {
      const side = document.querySelector(".side");
      const codePanel = document.getElementById("codePanel");
      const metricsPanel = document.getElementById("metricsPanel");
      if (!side || !codePanel) return;
      if (mode === "flow" && metricsVisible) {
        side.classList.add("metrics-open");
        codePanel.classList.add("hidden");
        if (metricsPanel) metricsPanel.classList.remove("hidden");
      } else {
        side.classList.remove("metrics-open");
        codePanel.classList.remove("hidden");
        if (metricsPanel && mode === "flow") metricsPanel.classList.add("hidden");
      }
    }

    document.getElementById("toggleMetricsBtn").addEventListener("click", () => {
      metricsVisible = !metricsVisible;
      setPanelVisibility("metricsPanel", metricsVisible, "toggleMetricsBtn", "Metrics");
      document.getElementById("toggleMetricsBtn").textContent = metricsVisible ? "Hide Metrics" : "Show Metrics";
      if (metricsVisible) {
        renderMetricsForMode();
      }
      syncMetricsLayout();
      if (controlDrawer && mode !== "flow") {
        if (metricsVisible) {
          controlDrawer.classList.add("open");
        } else {
          controlDrawer.classList.remove("open");
        }
      }
    });

    setPanelVisibility("metricsPanel", metricsVisible, "toggleMetricsBtn", "Metrics");
    document.getElementById("toggleMetricsBtn").textContent = metricsVisible ? "Hide Metrics" : "Show Metrics";
    syncMetricsLayout();
    renderTypeLegend();
    setFlowModeUI(false);
    renderRepoMetrics();
    if (metricsVisible) {
      renderMetricsForMode();
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html)
  console.log(`\nVisualization saved to: ${htmlPath}`)
  return htmlPath
}
