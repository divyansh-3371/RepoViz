#!/usr/bin/env node

import { Command } from "commander"
import { scanRepository } from "../core/fileScanner"
import { detectExtensions } from "../core/languageDetector"
import { buildGraph } from "../core/graphBuilder"

const program = new Command()

program
  .argument("<repoPath>", "Path to repository")
  .action(async (repoPath) => {

    console.log("Scanning repository...")

    const files = await scanRepository(repoPath)
    console.log("Files detected:", files.length)

    const extensions = detectExtensions(files)
    console.log("Languages:", extensions)

    console.log("Building dependency graph...")

    const graph = buildGraph(files)

    console.log("Nodes:", graph.nodes.length)
    console.log("Edges:", graph.edges.length)

    console.log("\nSample edges:")
    console.log(graph.edges.slice(0,5))

  })

program.parse()