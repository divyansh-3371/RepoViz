export interface GraphNode {
  id: string
  type: "file"
  fileType?: "component" | "service" | "utility" | "config" | "page" | "hook" | "other"
  extension?: string
  loc?: number
  sizeBytes?: number
}

export interface GraphEdge {
  from: string
  to: string
  type: "import"
  isExternal?: boolean
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
