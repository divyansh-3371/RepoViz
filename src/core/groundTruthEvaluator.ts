import fs from "fs"
import path from "path"
import { Graph, GraphEdge } from "./graphTypes"

export interface GroundTruthEdge {
  from: string
  to: string
  isExternal?: boolean
}

export interface GroundTruthDataset {
  name?: string
  edges: GroundTruthEdge[]
}

export interface EdgeAccuracyMetrics {
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number
  recall: number
  f1: number
  accuracy: number
  falsePositiveEdges: GroundTruthEdge[]
  falseNegativeEdges: GroundTruthEdge[]
}

export function loadGroundTruth(filePath: string): GroundTruthDataset {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as GroundTruthDataset
}

export function evaluateGraphAgainstGroundTruth(
  graph: Graph,
  groundTruth: GroundTruthDataset,
  repoRoot: string
): EdgeAccuracyMetrics {
  const expectedEdges = groundTruth.edges
  const actualEdges = graph.edges.map((edge) => normalizeActualEdge(edge, repoRoot))

  const expectedKeys = new Set(expectedEdges.map(edgeKey))
  const actualKeys = new Set(actualEdges.map(edgeKey))

  const truePositives = countIntersection(actualKeys, expectedKeys)
  const falsePositiveEdges = actualEdges.filter((edge) => !expectedKeys.has(edgeKey(edge)))
  const falseNegativeEdges = expectedEdges.filter((edge) => !actualKeys.has(edgeKey(edge)))
  const falsePositives = falsePositiveEdges.length
  const falseNegatives = falseNegativeEdges.length

  const precision = divide(truePositives, truePositives + falsePositives)
  const recall = divide(truePositives, truePositives + falseNegatives)
  const f1 = divide(2 * precision * recall, precision + recall)
  const accuracy = divide(
    truePositives,
    truePositives + falsePositives + falseNegatives
  )

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    accuracy,
    falsePositiveEdges,
    falseNegativeEdges
  }
}

function normalizeActualEdge(edge: GraphEdge, repoRoot: string): GroundTruthEdge {
  return {
    from: normalizeGraphPath(edge.from, repoRoot),
    to: edge.isExternal ? edge.to : normalizeGraphPath(edge.to, repoRoot),
    isExternal: Boolean(edge.isExternal)
  }
}

function normalizeGraphPath(value: string, repoRoot: string): string {
  const normalizedValue = normalizeSeparators(value)
  const normalizedRoot = normalizeSeparators(path.resolve(repoRoot))

  if (normalizedValue === normalizedRoot) {
    return path.basename(normalizedRoot)
  }

  if (normalizedValue.startsWith(`${normalizedRoot}/`)) {
    return normalizedValue.slice(normalizedRoot.length + 1)
  }

  return normalizedValue
}

function normalizeSeparators(value: string): string {
  return value.replace(/\\/g, "/")
}

function edgeKey(edge: GroundTruthEdge): string {
  return [
    normalizeSeparators(edge.from),
    normalizeSeparators(edge.to),
    edge.isExternal ? "external" : "internal"
  ].join("->")
}

function countIntersection(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const value of left) {
    if (right.has(value)) {
      count += 1
    }
  }
  return count
}

function divide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1
  }

  return Number((numerator / denominator).toFixed(4))
}
