export interface GraphNode {
  id: string
  type: "file"
}

export interface GraphEdge {
  from: string
  to: string
  type: "import"
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}