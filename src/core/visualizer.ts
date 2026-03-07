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

function typeColor(fileType?: string): string {
  switch (fileType) {
    case "component":
      return "#45a4ff"
    case "service":
      return "#f59e0b"
    case "utility":
      return "#22c55e"
    case "config":
      return "#a78bfa"
    case "hook":
      return "#ec4899"
    case "page":
      return "#14b8a6"
    default:
      return "#8ea4c8"
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
      background: linear-gradient(135deg, #14213b 0%, #121a2b 100%);
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .title h1 { font-size: 18px; }
    .title p { margin-top: 2px; font-size: 12px; color: var(--muted); }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    #searchInput, .btn {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      color: var(--text);
      background: #10192b;
    }
    .btn {
      cursor: pointer;
      background: #1a2741;
    }
    .btn:hover { border-color: var(--red); }
    .btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      border-color: var(--line);
    }
    #searchInput { min-width: 220px; }
    .main {
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 360px;
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
      background: linear-gradient(180deg, #0f1729 0%, #0f1525 100%);
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
      padding: 7px 8px;
      display: flex;
      gap: 8px;
    }
    .flow-legend {
      position: absolute;
      top: 8px;
      right: 8px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(12, 17, 28, 0.94);
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
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 10px;
    }
    .panel {
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .panel-header {
      padding: 9px 12px;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--line);
      background: #1c2945;
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
      padding: 10px;
      background: #0d1424;
      overflow: auto;
      white-space: pre;
      font-family: Consolas, monospace;
      font-size: 11px;
      line-height: 1.45;
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
        <input id="searchInput" type="text" placeholder="Search files/modules...">
        <button id="fitBtn" class="btn">Fit</button>
        <button id="resetBtn" class="btn">Reset</button>
        <button id="backBtn" class="btn">Back To Repo</button>
        <button id="toggleMetricsBtn" class="btn">Hide Metrics</button>
        <button id="toggleCodeBtn" class="btn">Hide Code</button>
      </div>
    </header>

    <main class="main">
      <section class="graph-card">
        <div id="network"></div>
        <button id="flowBackBtn" class="flow-back hidden">Back To Repo</button>
        <div id="flowLegend" class="flow-legend hidden">
          <div class="title">Flow Legend</div>
          <div class="item"><span>Ellipse</span><span>Start/End</span></div>
          <div class="item"><span>Rectangle</span><span>Process/Call</span></div>
          <div class="item"><span>Diamond</span><span>Decision</span></div>
          <div class="item"><span>Red Solid</span><span>Main Flow</span></div>
          <div class="item"><span>Red Dashed</span><span>Source/Sink Link</span></div>
        </div>
        <div class="hint">
          <span>Single click: overview + highlight</span>
          <span>Double click: top-down source-to-sink flowchart</span>
        </div>
      </section>

      <aside class="side">
        <section id="metricsPanel" class="panel">
          <div class="panel-header">
            <span>Metrics Dashboard</span>
            <button id="collapseMetricsBtn" class="btn">Collapse</button>
          </div>
          <div id="metricsBody" class="panel-body"></div>
        </section>
        <section id="codePanel" class="panel">
          <div class="panel-header">
            <span>Source Viewer</span>
            <button id="collapseCodeBtn" class="btn">Collapse</button>
          </div>
          <div class="panel-body">
            <div id="codeMeta" class="code-meta">Select a local file node to load source.</div>
            <pre id="codeView" class="code-view">No file selected.</pre>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <script>
    const serverPort = ${serverPort};
    const graphData = ${jsonInline(graph)};
    const viewData = ${jsonInline(viewData)};
    const colorByType = ${typeColor.toString()};

    const viewIdToNode = new Map(viewData.nodes.map((n) => [n.id, n]));
    const nodeIdToViewId = new Map(viewData.nodes.map((n) => [n.nodeId, n.id]));
    const mainBaseNodeStyles = new Map(
      viewData.nodes.map((n) => [
        n.id,
        {
          color: n.isExternal ? "#f59e0b" : colorByType(n.fileType),
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
          color: { color: "#6d7fa2", opacity: 0.75 },
          width: 1.3
        }
      ])
    );

    const mainNodesData = new vis.DataSet(
      viewData.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        title: node.title,
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
        smooth: { type: "dynamic" },
        ...mainBaseEdgeStyles.get(edge.id)
      }))
    );

    let network = new vis.Network(
      document.getElementById("network"),
      { nodes: mainNodesData, edges: mainEdgesData },
      {
        nodes: { borderWidthSelected: 3 },
        edges: {
          font: { color: "#b8c4da", size: 10, strokeWidth: 0 },
          arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        },
        physics: {
          enabled: true,
          solver: "forceAtlas2Based",
          stabilization: { iterations: 170, fit: true },
          forceAtlas2Based: {
            gravitationalConstant: -80,
            springLength: 130,
            springConstant: 0.05,
            centralGravity: 0.003
          }
        },
        interaction: { hover: true, zoomView: true, dragView: true }
      }
    );

    let initialPositions = null;
    let mode = "main";
    let flowData = null;

    function setFlowModeUI(isFlow) {
      const topBack = document.getElementById("backBtn");
      const canvasBack = document.getElementById("flowBackBtn");
      const flowLegend = document.getElementById("flowLegend");
      const searchInput = document.getElementById("searchInput");

      if (topBack) {
        topBack.classList.remove("hidden");
        topBack.style.display = "inline-flex";
        topBack.style.visibility = "visible";
        topBack.style.opacity = "1";
        topBack.disabled = !isFlow;
      }
      if (canvasBack) {
        canvasBack.classList.toggle("hidden", !isFlow);
        canvasBack.style.display = isFlow ? "inline-flex" : "none";
        canvasBack.style.visibility = isFlow ? "visible" : "hidden";
        canvasBack.style.opacity = isFlow ? "1" : "0";
      }

      if (flowLegend) flowLegend.classList.toggle("hidden", !isFlow);
      if (searchInput) searchInput.disabled = isFlow;
    }

    network.once("stabilizationIterationsDone", () => {
      network.setOptions({ physics: false });
      initialPositions = network.getPositions();
      network.fit({ animation: { duration: 400 } });
    });

    network.on("click", async (params) => {
      if (!params.nodes.length || mode !== "main") return;
      const node = viewIdToNode.get(params.nodes[0]);
      if (!node) return;

      highlightPathRed(node.nodeId);
      showNodeOverview(node);
    });

    network.on("doubleClick", async (params) => {
      if (!params.nodes.length || mode !== "main") return;
      const node = viewIdToNode.get(params.nodes[0]);
      if (!node || node.isExternal) return;
      await loadSource(node);
      await showFlowGraph(node);
    });

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

      document.getElementById("summaryLine").textContent =
        "Flow view: " + shortName(node.nodeId) + " | " +
        entities.length + " flow nodes | " +
        baseFlowEdges.length + " flow edges";

      document.getElementById("metricsBody").innerHTML =
        '<div class="metrics-grid">' +
          metricCard("File", shortName(node.nodeId)) +
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
        "</div>";
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
        return;
      }

      meta.textContent = "Loading " + node.nodeId + "...";
      code.textContent = "";
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
        code.textContent = source;
      } catch (error) {
        meta.textContent = "Could not load source for " + node.nodeId;
        code.textContent = String(error);
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

      code.textContent =
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
        case "module":
        case "return":
          return "ellipse";
        default:
          return "box";
      }
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

        const idToIndex = new Map();
        const flowNodes = entities.map((entity, index) => {
          idToIndex.set(entity.id, index);
          return {
            id: index,
            label: entity.name,
            title: entity.type + " (lines " + (entity.startLine + 1) + "-" + (entity.endLine + 1) + ")",
            flowType: entity.type,
            color: flowNodeColor(entity.type),
            shape: flowNodeShape(entity.type),
            margin: 10,
            font: { color: "#e8edf7", size: 11 }
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
        const flowEdges = [...baseFlowEdges];

        if (!flowNodes.length) {
          flowNodes.push({
            id: 0,
            label: "No entities found",
            title: node.nodeId,
            color: "#6b7280",
            shape: "box",
            font: { color: "#e8edf7", size: 12 }
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
        flowNodes.push({
          id: sourceNodeId,
          label: "SOURCE",
          title: "Known entry source",
          shape: "box",
          color: "#16a34a",
          size: 16,
          font: { color: "#ecfdf5", size: 12 }
        });
        flowNodes.push({
          id: sinkNodeId,
          label: "SINK",
          title: "Known terminal sink",
          shape: "box",
          color: "#b91c1c",
          size: 16,
          font: { color: "#fef2f2", size: 12 }
        });
        sourceCandidates.slice(0, 10).forEach((targetId, idx) => {
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
        sinkCandidates.slice(0, 10).forEach((fromId, idx) => {
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
        flowNodes.forEach((n) => adjacency.set(n.id, []));
        flowEdges.forEach((e) => {
          if (!adjacency.has(e.from)) adjacency.set(e.from, []);
          adjacency.get(e.from).push(e.to);
        });
        const levelMap = new Map();
        const q = [sourceNodeId];
        levelMap.set(sourceNodeId, 0);
        while (q.length) {
          const current = q.shift();
          const currentLevel = levelMap.get(current) || 0;
          (adjacency.get(current) || []).forEach((next) => {
            if (!levelMap.has(next)) {
              levelMap.set(next, currentLevel + 1);
              q.push(next);
            }
          });
        }
        flowNodes.forEach((n) => {
          n.level = levelMap.has(n.id) ? levelMap.get(n.id) : 1;
        });

        flowData = {
          nodes: new vis.DataSet(flowNodes),
          edges: new vis.DataSet(flowEdges)
        };

        network.setData(flowData);
        network.setOptions({
          layout: {
            hierarchical: {
              enabled: true,
              direction: "UD",
              sortMethod: "directed",
              nodeSpacing: 170,
              levelSeparation: 135,
              treeSpacing: 300,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true
            }
          },
          physics: { enabled: false },
          nodes: {
            borderWidthSelected: 3,
            borderWidth: 1.4,
            shapeProperties: { borderRadius: 6 }
          },
          edges: {
            font: { color: "#fda4af", size: 9, strokeWidth: 0, align: "top" },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: {
              enabled: false
            },
            color: { inherit: false }
          }
        });
        mode = "flow";
        titleText.textContent = "File Flow Graph: " + shortName(node.nodeId);
        if (backBtn) backBtn.style.fontWeight = "700";
        setFlowModeUI(true);
        renderFlowMetrics(node, entities, baseFlowEdges);
        setTimeout(() => network.fit({ animation: { duration: 300 } }), 120);
      } catch (error) {
        document.getElementById("codeMeta").textContent = "Flow graph error for " + node.nodeId;
        document.getElementById("codeView").textContent = String(error);
      }
    }

    function goBackToMainGraph() {
      if (mode !== "flow") return;
      mode = "main";
      flowData = null;
      network.setData({ nodes: mainNodesData, edges: mainEdgesData });
      network.setOptions({
        layout: { hierarchical: false },
        physics: { enabled: false },
        nodes: { borderWidthSelected: 3 },
        edges: {
          font: { color: "#b8c4da", size: 10, strokeWidth: 0 },
          arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        }
      });
      document.getElementById("titleText").textContent = "Repository Dependency Graph";
      setFlowModeUI(false);
      renderRepoMetrics();
      resetMainStyles();
      if (initialPositions) {
        mainNodesData.update(
          Object.keys(initialPositions).map((id) => ({
            id: Number(id),
            x: initialPositions[id].x,
            y: initialPositions[id].y
          }))
        );
      }
      network.fit({ animation: { duration: 300 } });
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

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (mode === "flow") {
        network.fit({ animation: { duration: 250 } });
        return;
      }
      document.getElementById("searchInput").value = "";
      resetMainStyles();
      if (initialPositions) {
        mainNodesData.update(
          Object.keys(initialPositions).map((id) => ({
            id: Number(id),
            x: initialPositions[id].x,
            y: initialPositions[id].y
          }))
        );
      }
      network.fit({ animation: { duration: 300 } });
    });

    document.getElementById("backBtn").addEventListener("click", () => {
      goBackToMainGraph();
    });
    const flowBackBtn = document.getElementById("flowBackBtn");
    if (flowBackBtn) {
      flowBackBtn.addEventListener("click", () => {
        goBackToMainGraph();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mode === "flow") {
        goBackToMainGraph();
      }
    });

    document.getElementById("searchInput").addEventListener("input", (event) => {
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

    document.getElementById("collapseMetricsBtn").addEventListener("click", () => {
      document.getElementById("metricsPanel").classList.toggle("collapsed");
    });
    document.getElementById("collapseCodeBtn").addEventListener("click", () => {
      document.getElementById("codePanel").classList.toggle("collapsed");
    });

    let metricsVisible = true;
    let codeVisible = true;
    document.getElementById("toggleMetricsBtn").addEventListener("click", () => {
      metricsVisible = !metricsVisible;
      setPanelVisibility("metricsPanel", metricsVisible, "toggleMetricsBtn", "Metrics");
    });
    document.getElementById("toggleCodeBtn").addEventListener("click", () => {
      codeVisible = !codeVisible;
      setPanelVisibility("codePanel", codeVisible, "toggleCodeBtn", "Code");
    });

    setFlowModeUI(false);
    renderRepoMetrics();
  </script>
</body>
</html>`

  fs.writeFileSync(htmlPath, html)
  console.log(`\nVisualization saved to: ${htmlPath}`)
  return htmlPath
}
