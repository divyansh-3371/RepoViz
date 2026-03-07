#!/usr/bin/env node

import { Command } from "commander"
import { scanRepository } from "../core/fileScanner"
import { detectExtensions } from "../core/languageDetector"
import { buildGraph } from "../core/graphBuilder"
import { getRepoPath } from "../core/githubHandler"
import { generateVisualization } from "../core/visualizer"
import { startAnalysisServer } from "../server/analysisServer"
import * as fs from "fs"
import * as path from "path"
import open from "open"

const program = new Command()

program
  .argument("<repoPath>", "Path to repository or GitHub URL")
  .option("-o, --output <path>", "Output file path for graph (default: graph.json)")
  .action(async (input, options) => {

    let repoPath: string
    let cleanup: (() => void) | undefined
    let serverPort: number

    try {
      // Start analysis server
      console.log("Starting analysis server...")
      serverPort = await startAnalysisServer()

      // Get the actual repo path (clone if GitHub URL)
      const result = await getRepoPath(input)
      repoPath = result.repoPath
      cleanup = result.cleanup

      console.log("Scanning repository...")

      const files = await scanRepository(repoPath)
      console.log("Files detected:", files.length)

      const extensions = detectExtensions(files)
      console.log("Languages:", extensions)

      console.log("Building dependency graph...")

      const graph = buildGraph(files)

      console.log("Nodes:", graph.nodes.length)
      console.log("Edges:", graph.edges.length)

      // Save graph to file
      const outputPath = options.output || "graph.json"
      const outputDir = path.dirname(outputPath)
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2))
      console.log(`Graph saved to: ${outputPath}`)

      // Generate visualization with server port
      const htmlPath = generateVisualization(graph, outputPath, serverPort)
      console.log("Opening visualization in browser...")
      await open(htmlPath)

      // Keep server running
      console.log("\n✅ Visualization ready! The analysis server will continue running.")
      console.log("Close this terminal to stop the server.\n")

    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program.parse()