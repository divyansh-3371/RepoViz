import Parser from "tree-sitter"
import { parseFile } from "./parseFile"

export type CodeEntityType =
  | "module"
  | "function"
  | "class"
  | "method"
  | "variable"
  | "loop"
  | "condition"
  | "call"
  | "return"

export interface CodeEntity {
  id: string
  name: string
  type: CodeEntityType
  startLine: number
  endLine: number
  children?: string[]
  references?: string[]
}

export interface CodeStructure {
  filePath: string
  fileName: string
  entities: CodeEntity[]
  connections: Array<{ from: string; to: string; type: string }>
}

type ScopeInfo = {
  id: string
  name: string
}

export function analyzeFileStructure(filePath: string): CodeStructure {
  const tree = parseFile(filePath)
  if (!tree) {
    return {
      filePath,
      fileName: filePath.split(/[\\/]/).pop() || filePath,
      entities: [],
      connections: []
    }
  }

  const entities: CodeEntity[] = []
  const connections: Array<{ from: string; to: string; type: string }> = []
  const nameToEntityIds = new Map<string, string[]>()
  let idCounter = 0

  function nextId(prefix: string): string {
    return `${prefix}-${idCounter++}`
  }

  function addEntity(
    type: CodeEntityType,
    name: string,
    node: Parser.SyntaxNode
  ): string {
    const id = nextId(type)
    entities.push({
      id,
      name,
      type,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      children: [],
      references: []
    })
    const key = name.trim()
    if (key) {
      if (!nameToEntityIds.has(key)) nameToEntityIds.set(key, [])
      nameToEntityIds.get(key)?.push(id)
    }
    return id
  }

  function addConnection(from: string, to: string, type: string) {
    connections.push({ from, to, type })
  }

  function compactText(value: string, max = 90): string {
    const text = value.replace(/\s+/g, " ").trim()
    if (text.length <= max) return text
    return text.slice(0, max - 3) + "..."
  }

  function conditionLabel(node: Parser.SyntaxNode): string {
    const cond =
      node.childForFieldName("condition") ||
      node.namedChildren.find((c) => c.type.includes("expression"))
    if (!cond) return compactText(node.type.replace(/_/g, " "))
    if (node.type === "switch_statement") return compactText(`switch (${cond.text})`)
    if (node.type === "if_statement") return compactText(`if (${cond.text})`)
    return compactText(`${node.type.replace(/_statement$/, "")} (${cond.text})`)
  }

  function loopLabel(node: Parser.SyntaxNode): string {
    if (node.type === "for_statement") return compactText(`for (...)`)
    if (node.type === "for_in_statement") return compactText(`for-in (...)`)
    if (node.type === "for_of_statement") return compactText(`for-of (...)`)
    if (node.type === "while_statement") {
      const cond = node.childForFieldName("condition")
      return compactText(`while (${cond?.text || "..."})`)
    }
    if (node.type === "do_statement") return compactText("do ... while (...)")
    return compactText(node.type.replace(/_/g, " "))
  }

  function getFunctionName(node: Parser.SyntaxNode): string | null {
    const nameField = node.childForFieldName("name")
    if (nameField) return nameField.text

    // const foo = () => {}
    if (
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "generator_function"
    ) {
      const declarator = node.parent
      if (declarator?.type === "variable_declarator") {
        const left = declarator.childForFieldName("name") || declarator.child(0)
        if (left) return left.text
      }
    }

    return null
  }

  function statementChildren(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return node.namedChildren.filter((child) =>
      [
        "expression_statement",
        "if_statement",
        "for_statement",
        "while_statement",
        "for_in_statement",
        "for_of_statement",
        "do_statement",
        "return_statement",
        "switch_statement",
        "try_statement",
        "throw_statement",
        "break_statement",
        "continue_statement",
        "variable_declaration",
        "lexical_declaration"
      ].includes(child.type)
    )
  }

  function firstMeaningfulStatement(
    node: Parser.SyntaxNode | null | undefined
  ): Parser.SyntaxNode | null {
    if (!node) return null
    if (node.type === "statement_block") {
      return statementChildren(node)[0] || null
    }
    return node
  }

  function callName(node: Parser.SyntaxNode): string | null {
    if (node.type !== "call_expression") return null
    const fn = node.childForFieldName("function") || node.child(0)
    if (!fn) return null
    if (fn.type === "identifier" || fn.type === "property_identifier") {
      return fn.text
    }
    if (fn.type === "member_expression") {
      const prop =
        fn.childForFieldName("property") ||
        fn.namedChildren[fn.namedChildren.length - 1]
      return prop?.text || null
    }
    return fn.text || null
  }

  function findCallExpressions(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const result: Parser.SyntaxNode[] = []
    function walk(n: Parser.SyntaxNode) {
      if (n.type === "call_expression") result.push(n)
      for (const c of n.namedChildren) walk(c)
    }
    walk(node)
    return result
  }

  function connectSequentialStatements(
    ownerId: string,
    stmts: Parser.SyntaxNode[],
    stmtToEntity: Map<Parser.SyntaxNode, string>
  ) {
    for (let i = 0; i < stmts.length - 1; i++) {
      const a = stmtToEntity.get(stmts[i])
      const b = stmtToEntity.get(stmts[i + 1])
      if (a && b) addConnection(a, b, "next")
    }
    if (stmts.length > 0) {
      const first = stmtToEntity.get(stmts[0])
      if (first) addConnection(ownerId, first, "entry")
    }
  }

  function buildControlFlowForBlock(
    owner: ScopeInfo,
    block: Parser.SyntaxNode
  ) {
    const stmts = statementChildren(block)
    const stmtToEntity = new Map<Parser.SyntaxNode, string>()

    for (const stmt of stmts) {
      if (
        stmt.type === "for_statement" ||
        stmt.type === "while_statement" ||
        stmt.type === "for_in_statement" ||
        stmt.type === "for_of_statement" ||
        stmt.type === "do_statement"
      ) {
        const loopId = addEntity("loop", loopLabel(stmt), stmt)
        stmtToEntity.set(stmt, loopId)
        addConnection(owner.id, loopId, "contains")

        const body = stmt.childForFieldName("body")
        const first = firstMeaningfulStatement(body)
        if (first) {
          const bodyNodeId = addEntity("condition", compactText(first.text), first)
          addConnection(loopId, bodyNodeId, "loop-body")
          addConnection(bodyNodeId, loopId, "loop-back")
        }
        continue
      }

      if (stmt.type === "if_statement" || stmt.type === "switch_statement") {
        const condId = addEntity("condition", conditionLabel(stmt), stmt)
        stmtToEntity.set(stmt, condId)
        addConnection(owner.id, condId, "contains")

        const consequence =
          stmt.childForFieldName("consequence") || stmt.namedChildren[0]
        const alternative = stmt.childForFieldName("alternative")
        const trueBranch = firstMeaningfulStatement(consequence)
        const falseBranch = firstMeaningfulStatement(alternative)

        if (trueBranch) {
          const trueId = addEntity(
            "condition",
            compactText("true: " + trueBranch.text),
            trueBranch
          )
          addConnection(condId, trueId, "true")
        }
        if (falseBranch) {
          const falseId = addEntity(
            "condition",
            compactText("false: " + falseBranch.text),
            falseBranch
          )
          addConnection(condId, falseId, "false")
        }
        continue
      }

      if (stmt.type === "return_statement") {
        const returnExpr =
          stmt.namedChildren.find((c) => c.type.includes("expression"))?.text || ""
        const returnId = addEntity(
          "return",
          compactText(returnExpr ? `return ${returnExpr}` : "return"),
          stmt
        )
        stmtToEntity.set(stmt, returnId)
        addConnection(owner.id, returnId, "contains")
        continue
      }

      if (
        stmt.type === "variable_declaration" ||
        stmt.type === "lexical_declaration"
      ) {
        const vars = stmt.namedChildren.filter(
          (c) => c.type === "variable_declarator"
        )
        if (vars.length === 0) {
          const varId = addEntity("variable", compactText(stmt.text), stmt)
          stmtToEntity.set(stmt, varId)
          addConnection(owner.id, varId, "contains")
        } else {
          const names = vars
            .map((v) => v.childForFieldName("name")?.text || v.child(0)?.text || "")
            .filter(Boolean)
          const varId = addEntity(
            "variable",
            compactText(`declare ${names.join(", ")}`),
            stmt
          )
          stmtToEntity.set(stmt, varId)
          addConnection(owner.id, varId, "contains")
        }
        continue
      }

      // Expression statements and others
      const calls = findCallExpressions(stmt)
      if (calls.length > 0) {
        const firstCall = calls[0]
        const cName = callName(firstCall) || "call"
        const callId = addEntity("call", compactText(firstCall.text), firstCall)
        stmtToEntity.set(stmt, callId)
        addConnection(owner.id, callId, "contains")

        const targets = nameToEntityIds.get(cName) || []
        for (const targetId of targets) {
          if (targetId !== callId) addConnection(callId, targetId, "calls")
        }
      } else {
        const opId = addEntity("condition", compactText(stmt.text), stmt)
        stmtToEntity.set(stmt, opId)
        addConnection(owner.id, opId, "contains")
      }
    }

    connectSequentialStatements(owner.id, stmts, stmtToEntity)
  }

  function analyzeScope(node: Parser.SyntaxNode, scope: ScopeInfo) {
    const body =
      node.childForFieldName("body") ||
      node.namedChildren.find((c) => c.type === "statement_block")
    if (!body || body.type !== "statement_block") return
    buildControlFlowForBlock(scope, body)
  }

  const moduleId = addEntity("module", "module", tree.rootNode)

  function walk(node: Parser.SyntaxNode, scopeStack: ScopeInfo[]) {
    const currentScope = scopeStack[scopeStack.length - 1]

    if (node.type === "class_declaration") {
      const name = node.childForFieldName("name")?.text || "Class"
      const classId = addEntity("class", name, node)
      addConnection(currentScope.id, classId, "contains")
      const nextStack = [...scopeStack, { id: classId, name }]
      for (const child of node.namedChildren) walk(child, nextStack)
      return
    }

    if (
      node.type === "function_declaration" ||
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "generator_function"
    ) {
      const fnName = getFunctionName(node) || "function"
      const fnId = addEntity("function", fnName, node)
      addConnection(currentScope.id, fnId, "contains")
      analyzeScope(node, { id: fnId, name: fnName })
      for (const child of node.namedChildren) {
        if (child.type !== "statement_block") walk(child, [...scopeStack, { id: fnId, name: fnName }])
      }
      return
    }

    if (node.type === "method_definition") {
      const mName = node.childForFieldName("name")?.text || "method"
      const methodId = addEntity("method", mName, node)
      addConnection(currentScope.id, methodId, "contains")
      analyzeScope(node, { id: methodId, name: mName })
      for (const child of node.namedChildren) {
        if (child.type !== "statement_block") walk(child, [...scopeStack, { id: methodId, name: mName }])
      }
      return
    }

    for (const child of node.namedChildren) {
      walk(child, scopeStack)
    }
  }

  walk(tree.rootNode, [{ id: moduleId, name: "module" }])

  return {
    filePath,
    fileName: filePath.split(/[\\/]/).pop() || filePath,
    entities,
    connections: dedupeConnections(connections)
  }
}

function dedupeConnections(
  input: Array<{ from: string; to: string; type: string }>
): Array<{ from: string; to: string; type: string }> {
  const seen = new Set<string>()
  const out: Array<{ from: string; to: string; type: string }> = []
  for (const c of input) {
    const key = `${c.from}|${c.to}|${c.type}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}
