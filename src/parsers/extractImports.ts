import Parser from "tree-sitter"

export function extractImports(tree: Parser.Tree): string[] {

  const imports: string[] = []

  function walk(node: Parser.SyntaxNode) {

    // JavaScript / TypeScript imports
    if (node.type === "import_statement") {

      const source = node.childForFieldName("source")

      if (source) {
        const moduleName = source.text.replace(/['"]/g, "")
        imports.push(moduleName)
      }
    }

    // require("module")
    if (node.type === "call_expression") {

      const func = node.child(0)

      if (func && func.text === "require") {

        const args = node.childForFieldName("arguments")

        if (args && args.namedChildren.length > 0) {

          const moduleName = args.namedChildren[0].text.replace(/['"]/g, "")
          imports.push(moduleName)

        }
      }
    }

    for (const child of node.children) {
      walk(child)
    }
  }

  walk(tree.rootNode)

  return imports
}