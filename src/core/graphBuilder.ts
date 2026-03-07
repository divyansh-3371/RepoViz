import { Graph, GraphNode, GraphEdge } from "./graphTypes"
import { parseFile } from "../parsers/parseFile"
import { extractImports } from "../parsers/extractImports"
import fs from "fs"
import path from "path"

export function buildGraph(files: string[]): Graph {
  const normalizedFileSet = new Set(files.map((file) => normalizePath(file)))
  const fileAliasMap = buildFileAliasMap(files)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const file of files) {
    const filePath = normalizePath(file)
    const extension = path.extname(filePath).toLowerCase()
    const stats = safeStat(filePath)
    const loc = safeCountLines(filePath)

    nodes.push({
      id: filePath,
      type: "file",
      extension,
      loc,
      sizeBytes: stats?.size,
      fileType: classifyFileType(filePath)
    })

    const tree = parseFile(filePath)

    if (!tree) continue

    const imports = extractImports(tree)
    const fromDir = path.dirname(filePath)

    for (const imp of imports) {
      const resolvedTarget = resolveImportTarget(
        imp,
        fromDir,
        normalizedFileSet,
        fileAliasMap
      )

      edges.push({
        from: filePath,
        to: resolvedTarget,
        type: "import",
        isExternal: !normalizedFileSet.has(resolvedTarget)
      })
    }
  }

  return { nodes, edges: dedupeEdges(edges) }
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/")
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>()
  const deduped: GraphEdge[] = []

  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}:${edge.type}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(edge)
  }

  return deduped
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function safeCountLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf8")
    if (!content) return 0
    return content.split(/\r?\n/).length
  } catch {
    return 0
  }
}

function buildFileAliasMap(files: string[]): Map<string, string> {
  const map = new Map<string, string>()

  for (const file of files) {
    const normalized = normalizePath(file)
    const withoutExtension = normalized.replace(/\.[^/.]+$/, "")
    map.set(normalized, normalized)
    map.set(withoutExtension, normalized)
  }

  return map
}

function resolveImportTarget(
  rawImport: string,
  fromDir: string,
  fileSet: Set<string>,
  aliasMap: Map<string, string>
): string {
  if (!rawImport) return rawImport

  const cleanedImport = rawImport.split("?")[0].replace(/\\/g, "/")

  if (!cleanedImport.startsWith(".") && !cleanedImport.startsWith("/")) {
    return cleanedImport
  }

  const absoluteBase = normalizePath(path.resolve(fromDir, cleanedImport))
  const candidates = [
    absoluteBase,
    `${absoluteBase}.js`,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.jsx`,
    `${absoluteBase}.mjs`,
    `${absoluteBase}.cjs`,
    `${absoluteBase}.py`,
    `${absoluteBase}/index.js`,
    `${absoluteBase}/index.ts`,
    `${absoluteBase}/index.tsx`,
    `${absoluteBase}/index.jsx`,
    `${absoluteBase}/index.py`
  ]

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate

    const aliasHit = aliasMap.get(candidate)
    if (aliasHit) return aliasHit
  }

  return cleanedImport
}

function classifyFileType(filePath: string): GraphNode["fileType"] {
  const normalized = normalizePath(filePath).toLowerCase()
  const fileName = path.basename(normalized).toLowerCase()

  if (
    normalized.includes("/components/") ||
    fileName.endsWith(".jsx") ||
    fileName.endsWith(".tsx")
  ) {
    return "component"
  }

  if (
    normalized.includes("/services/") ||
    fileName.includes("service") ||
    fileName.includes("api")
  ) {
    return "service"
  }

  if (
    normalized.includes("/config/") ||
    fileName.includes("config") ||
    fileName.endsWith(".json")
  ) {
    return "config"
  }

  if (normalized.includes("/pages/") || fileName.includes("page")) {
    return "page"
  }

  if (normalized.includes("/hooks/") || fileName.startsWith("use")) {
    return "hook"
  }

  if (normalized.includes("/utils/") || fileName.includes("util")) {
    return "utility"
  }

  return "other"
}
