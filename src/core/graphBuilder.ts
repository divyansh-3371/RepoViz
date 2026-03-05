import { Graph, GraphNode, GraphEdge } from "./graphTypes"
import { parseFile } from "../parsers/parseFile"
import { extractImports } from "../parsers/extractImports"

export function buildGraph(files: string[]): Graph {

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const file of files) {

    nodes.push({
      id: file,
      type: "file"
    })

    const tree = parseFile(file)

    if (!tree) continue

    const imports = extractImports(tree)

    for (const imp of imports) {

      edges.push({
        from: file,
        to: imp,
        type: "import"
      })

    }
  }

  return { nodes, edges }
}