import fs from "fs"
import path from "path"
import { buildGraph } from "../core/graphBuilder"
import {
  evaluateGraphAgainstGroundTruth,
  loadGroundTruth
} from "../core/groundTruthEvaluator"
import { initializeEvaluationLanguages } from "../parsers/initializeEvaluationLanguages"
import { getLanguageRegistry } from "../parsers/parserRegistry"

type FixtureScore = {
  fixture: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
}

const fixturesRoot = path.join(__dirname, "..", "__tests__", "fixtures")

function main(): void {
  initializeEvaluationLanguages()

  const fixtureDirs = fs
    .readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturesRoot, entry.name))
    .filter((fixtureDir) => fs.existsSync(path.join(fixtureDir, "expected-graph.json")))

  if (fixtureDirs.length === 0) {
    throw new Error(`No expected-graph.json files found in ${fixturesRoot}`)
  }

  const scores = fixtureDirs.map(scoreFixture)
  printScores(scores)
}

function scoreFixture(fixtureDir: string): FixtureScore {
  const fixture = path.basename(fixtureDir)
  const files = getSupportedFiles(fixtureDir)
  const graph = buildGraph(files)
  const groundTruth = loadGroundTruth(path.join(fixtureDir, "expected-graph.json"))
  const metrics = evaluateGraphAgainstGroundTruth(graph, groundTruth, fixtureDir)

  return {
    fixture,
    accuracy: metrics.accuracy,
    precision: metrics.precision,
    recall: metrics.recall,
    f1: metrics.f1,
    truePositives: metrics.truePositives,
    falsePositives: metrics.falsePositives,
    falseNegatives: metrics.falseNegatives
  }
}

function getSupportedFiles(rootDir: string): string[] {
  const registry = getLanguageRegistry()
  const supportedExtensions = registry.getSupportedExtensions()
  const files: string[] = []

  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (entry.isFile() && supportedExtensions.has(path.extname(entry.name))) {
        files.push(fullPath)
      }
    }
  }

  walk(rootDir)
  return files
}

function printScores(scores: FixtureScore[]): void {
  const rows = scores.map((score) => ({
    fixture: score.fixture,
    accuracy: toPercent(score.accuracy),
    precision: toPercent(score.precision),
    recall: toPercent(score.recall),
    f1: toPercent(score.f1),
    tp: score.truePositives,
    fp: score.falsePositives,
    fn: score.falseNegatives
  }))

  console.table(rows)

  const average = averageScores(scores)
  console.log("Average:", {
    accuracy: toPercent(average.accuracy),
    precision: toPercent(average.precision),
    recall: toPercent(average.recall),
    f1: toPercent(average.f1)
  })
}

function averageScores(scores: FixtureScore[]): Pick<FixtureScore, "accuracy" | "precision" | "recall" | "f1"> {
  return {
    accuracy: average(scores.map((score) => score.accuracy)),
    precision: average(scores.map((score) => score.precision)),
    recall: average(scores.map((score) => score.recall)),
    f1: average(scores.map((score) => score.f1))
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
