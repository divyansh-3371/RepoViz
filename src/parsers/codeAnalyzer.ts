import Parser from "tree-sitter"
import { parseFile } from "./parseFile"
import * as fs from "fs"

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
  kind?: CodeEntityType
}

export function analyzeFileStructure(filePath: string): CodeStructure {
  const isPython = filePath.toLowerCase().endsWith(".py")
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

  function addEntityManual(
    type: CodeEntityType,
    name: string,
    startLine: number,
    endLine: number
  ): string {
    const id = nextId(type)
    entities.push({
      id,
      name,
      type,
      startLine,
      endLine,
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

  function looksLikeConditionExpression(text: string): boolean {
    if (!text) return false
    const trimmed = text.trim()
    return (
      trimmed.includes("==") ||
      trimmed.includes("!=") ||
      trimmed.includes(">") ||
      trimmed.includes("<") ||
      trimmed.includes("&&") ||
      trimmed.includes("||") ||
      trimmed.includes("?") ||
      trimmed.includes(" in ") ||
      trimmed.includes(" instanceof ")
    )
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
    if (isPython) {
      return node.namedChildren.filter((child) =>
        [
          "expression_statement",
          "if_statement",
          "for_statement",
          "while_statement",
          "for_in_statement",
          "return_statement",
          "try_statement",
          "raise_statement",
          "break_statement",
          "continue_statement",
          "assignment",
          "augmented_assignment",
          "import_statement",
          "import_from_statement",
          "with_statement",
          "assert_statement",
          "pass_statement"
        ].includes(child.type)
      )
    }
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
    if (node.type === "statement_block" || node.type === "block") {
      return statementChildren(node)[0] || null
    }
    return node
  }

  function callName(node: Parser.SyntaxNode): string | null {
    if (node.type !== "call_expression" && node.type !== "call") return null
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
      if (n.type === "call_expression" || n.type === "call") result.push(n)
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
    block: Parser.SyntaxNode,
    entryFromId?: string,
    entryType?: string
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
        if (body && body.type === "statement_block") {
          const branch = buildControlFlowForBlock(
            { id: loopId, name: "loop" },
            body,
            loopId,
            "loop-body"
          )
          if (branch.lastId) {
            addConnection(branch.lastId, loopId, "loop-back")
          }
        } else {
          const first = firstMeaningfulStatement(body)
          if (first) {
            const bodyNodeId = addEntity("condition", compactText(first.text), first)
            addConnection(loopId, bodyNodeId, "loop-body")
            addConnection(bodyNodeId, loopId, "loop-back")
          }
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

        if (consequence && consequence.type === "statement_block") {
          buildControlFlowForBlock(
            { id: condId, name: "true" },
            consequence,
            condId,
            "true"
          )
        } else {
          const trueBranch = firstMeaningfulStatement(consequence)
          if (trueBranch) {
            const trueId = createInlineBranchNode(trueBranch, "true")
            if (trueId) addConnection(condId, trueId, "true")
          }
        }

        if (alternative && alternative.type === "statement_block") {
          buildControlFlowForBlock(
            { id: condId, name: "false" },
            alternative,
            condId,
            "false"
          )
        } else {
          const falseBranch = firstMeaningfulStatement(alternative)
          if (falseBranch) {
            const falseId = createInlineBranchNode(falseBranch, "false")
            if (falseId) addConnection(condId, falseId, "false")
          }
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

      if (stmt.type === "throw_statement") {
        const throwExpr =
          stmt.namedChildren.find((c) => c.type.includes("expression"))?.text || ""
        const throwId = addEntity(
          "return",
          compactText(throwExpr ? `throw ${throwExpr}` : "throw"),
          stmt
        )
        stmtToEntity.set(stmt, throwId)
        addConnection(owner.id, throwId, "contains")
        continue
      }

      if (stmt.type === "break_statement" || stmt.type === "continue_statement") {
        const jumpId = addEntity("return", compactText(stmt.text), stmt)
        stmtToEntity.set(stmt, jumpId)
        addConnection(owner.id, jumpId, "contains")
        continue
      }

      // Expression statements and others
      const exprNode =
        stmt.type === "expression_statement"
          ? stmt.namedChildren[0]
          : stmt.namedChildren.find((c) => c.type.includes("expression"))
      if (exprNode?.type === "conditional_expression") {
        const condId = addEntity("condition", compactText(exprNode.text), stmt)
        stmtToEntity.set(stmt, condId)
        addConnection(owner.id, condId, "contains")
        const trueExpr = exprNode.childForFieldName("consequence")
        const falseExpr = exprNode.childForFieldName("alternative")
        if (trueExpr) {
          const tId = addEntity("variable", compactText(`true: ${trueExpr.text}`), trueExpr)
          addConnection(condId, tId, "true")
        }
        if (falseExpr) {
          const fId = addEntity("variable", compactText(`false: ${falseExpr.text}`), falseExpr)
          addConnection(condId, fId, "false")
        }
        continue
      }
      const isAssignment =
        exprNode &&
        (exprNode.type === "assignment_expression" ||
          exprNode.type === "augmented_assignment_expression" ||
          exprNode.type === "update_expression")
      const calls = findCallExpressions(exprNode || stmt)

      if (isAssignment) {
        const opId = addEntity(
          "variable",
          compactText(`assign ${exprNode?.text || stmt.text}`),
          stmt
        )
        stmtToEntity.set(stmt, opId)
        addConnection(owner.id, opId, "contains")
        continue
      }

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
        const exprText = exprNode?.text || stmt.text
        const isConditionLike =
          exprNode?.type === "logical_expression" ||
          (exprNode?.type === "binary_expression" && looksLikeConditionExpression(exprText)) ||
          (exprNode?.type === "unary_expression" && looksLikeConditionExpression(exprText))
        const nodeType: CodeEntityType = isConditionLike ? "condition" : "variable"
        const label = isConditionLike
          ? compactText(exprText)
          : compactText(`expr ${exprText}`)
        const opId = addEntity(nodeType, label, stmt)
        stmtToEntity.set(stmt, opId)
        addConnection(owner.id, opId, "contains")
      }
    }

    connectSequentialStatements(owner.id, stmts, stmtToEntity)
    const firstId = stmts.length ? stmtToEntity.get(stmts[0]) || null : null
    const lastId = stmts.length ? stmtToEntity.get(stmts[stmts.length - 1]) || null : null
    if (entryFromId && firstId) {
      addConnection(entryFromId, firstId, entryType || "entry")
    }
    return { firstId, lastId }
  }

  function createInlineBranchNode(
    stmt: Parser.SyntaxNode,
    labelPrefix: string
  ): string | null {
    if (!stmt) return null
    if (stmt.type === "return_statement") {
      const returnExpr =
        stmt.namedChildren.find((c) => c.type.includes("expression"))?.text || ""
      return addEntity(
        "return",
        compactText(`${labelPrefix}: ${returnExpr ? `return ${returnExpr}` : "return"}`),
        stmt
      )
    }
    if (stmt.type === "throw_statement") {
      const throwExpr =
        stmt.namedChildren.find((c) => c.type.includes("expression"))?.text || ""
      return addEntity(
        "return",
        compactText(`${labelPrefix}: ${throwExpr ? `throw ${throwExpr}` : "throw"}`),
        stmt
      )
    }
    if (
      stmt.type === "variable_declaration" ||
      stmt.type === "lexical_declaration" ||
      stmt.type === "assignment" ||
      stmt.type === "augmented_assignment"
    ) {
      return addEntity("variable", compactText(`${labelPrefix}: ${stmt.text}`), stmt)
    }
    if (
      stmt.type === "for_statement" ||
      stmt.type === "while_statement" ||
      stmt.type === "for_in_statement" ||
      stmt.type === "for_of_statement" ||
      stmt.type === "do_statement"
    ) {
      return addEntity("loop", compactText(`${labelPrefix}: ${loopLabel(stmt)}`), stmt)
    }
    if (stmt.type === "if_statement" || stmt.type === "switch_statement") {
      return addEntity("condition", compactText(`${labelPrefix}: ${conditionLabel(stmt)}`), stmt)
    }
    if (stmt.type === "expression_statement") {
      const exprNode = stmt.namedChildren[0]
      if (exprNode?.type === "conditional_expression") {
        return addEntity("condition", compactText(`${labelPrefix}: ${exprNode.text}`), stmt)
      }
      const isAssignment =
        exprNode &&
        (exprNode.type === "assignment_expression" ||
          exprNode.type === "augmented_assignment_expression" ||
          exprNode.type === "update_expression" ||
          exprNode.type === "assignment" ||
          exprNode.type === "augmented_assignment")
      const calls = findCallExpressions(exprNode || stmt)
      if (calls.length > 0) {
        return addEntity("call", compactText(`${labelPrefix}: ${calls[0].text}`), calls[0])
      }
      if (isAssignment) {
        return addEntity("variable", compactText(`${labelPrefix}: assign ${exprNode?.text || stmt.text}`), stmt)
      }
      return addEntity("variable", compactText(`${labelPrefix}: ${stmt.text}`), stmt)
    }
    return addEntity("variable", compactText(`${labelPrefix}: ${stmt.text}`), stmt)
  }

  function analyzeScope(node: Parser.SyntaxNode, scope: ScopeInfo) {
    const body =
      node.childForFieldName("body") ||
      node.namedChildren.find((c) => c.type === "statement_block" || c.type === "block")
    if (!body || (body.type !== "statement_block" && body.type !== "block")) return
    buildControlFlowForBlock(scope, body)
  }

  const moduleId = addEntity("module", "module", tree.rootNode)
  const moduleScope: ScopeInfo = { id: moduleId, name: "module", kind: "module" }

  function walk(node: Parser.SyntaxNode, scopeStack: ScopeInfo[]) {
    const currentScope = scopeStack[scopeStack.length - 1]

    if (node.type === "class_definition") {
      const name = node.childForFieldName("name")?.text || "Class"
      const classId = addEntity("class", name, node)
      addConnection(currentScope.id, classId, "contains")
      const nextStack = [...scopeStack, { id: classId, name, kind: "class" as CodeEntityType }]
      for (const child of node.namedChildren) walk(child, nextStack)
      return
    }

    if (node.type === "function_definition") {
      const fnName = node.childForFieldName("name")?.text || "function"
      const fnType: CodeEntityType =
        currentScope?.kind === "class" ? "method" : "function"
      const fnId = addEntity(fnType, fnName, node)
      addConnection(currentScope.id, fnId, "contains")
      analyzeScope(node, { id: fnId, name: fnName, kind: fnType })
      for (const child of node.namedChildren) {
        if (child.type !== "statement_block" && child.type !== "block") {
          walk(child, [...scopeStack, { id: fnId, name: fnName, kind: fnType as CodeEntityType }])
        }
      }
      return
    }

    if (node.type === "class_declaration") {
      const name = node.childForFieldName("name")?.text || "Class"
      const classId = addEntity("class", name, node)
      addConnection(currentScope.id, classId, "contains")
      const nextStack = [...scopeStack, { id: classId, name, kind: "class" as CodeEntityType }]
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
      analyzeScope(node, { id: fnId, name: fnName, kind: "function" })
      for (const child of node.namedChildren) {
        if (child.type !== "statement_block") {
          walk(child, [...scopeStack, { id: fnId, name: fnName, kind: "function" as CodeEntityType }])
        }
      }
      return
    }

    if (node.type === "method_definition") {
      const mName = node.childForFieldName("name")?.text || "method"
      const methodId = addEntity("method", mName, node)
      addConnection(currentScope.id, methodId, "contains")
      analyzeScope(node, { id: methodId, name: mName, kind: "method" })
      for (const child of node.namedChildren) {
        if (child.type !== "statement_block") {
          walk(child, [...scopeStack, { id: methodId, name: mName, kind: "method" }])
        }
      }
      return
    }

    for (const child of node.namedChildren) {
      walk(child, scopeStack)
    }
  }

  walk(tree.rootNode, [moduleScope])

  if (isPython && entities.filter((e) => e.type !== "module").length === 0) {
    try {
      const src = fs.readFileSync(filePath, "utf8")
      const lines = src.split(/\r?\n/)

      const scopes: Array<{ id: string; type: CodeEntityType; indent: number }> = [
        { id: moduleId, type: "module", indent: -1 }
      ]

      function countIndent(value: string): number {
        let count = 0
        for (const ch of value) {
          if (ch === " ") count += 1
          else if (ch === "\t") count += 4
          else break
        }
        return count
      }

      function isBlankOrComment(value: string): boolean {
        const trimmed = value.trim()
        return !trimmed || trimmed.startsWith("#")
      }

      function findBlockEnd(start: number, baseIndent: number): number {
        let end = start
        for (let i = start + 1; i < lines.length; i++) {
          const line = lines[i]
          if (isBlankOrComment(line)) continue
          const indent = countIndent(line)
          if (indent <= baseIndent) break
          end = i
        }
        return end
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (isBlankOrComment(line)) continue

        const indent = countIndent(line)
        while (scopes.length > 1 && indent <= scopes[scopes.length - 1].indent) {
          scopes.pop()
        }

        const defMatch = line.match(/^\s*(async\s+def|def)\s+([A-Za-z_]\w*)\s*\(.*\)\s*:/)
        const classMatch = line.match(/^\s*class\s+([A-Za-z_]\w*)\s*(\([^)]*\))?\s*:/)

        if (classMatch) {
          const name = classMatch[1]
          const endLine = findBlockEnd(i, indent)
          const classId = addEntityManual("class", name, i, endLine)
          addConnection(scopes[scopes.length - 1].id, classId, "entry")
          scopes.push({ id: classId, type: "class", indent })
          continue
        }

        if (defMatch) {
          const name = defMatch[2]
          const endLine = findBlockEnd(i, indent)
          const kind: CodeEntityType =
            scopes[scopes.length - 1].type === "class" ? "method" : "function"
          const fnId = addEntityManual(kind, name, i, endLine)
          addConnection(scopes[scopes.length - 1].id, fnId, "entry")
          scopes.push({ id: fnId, type: kind, indent })
          continue
        }
      }
    } catch {
      // Fallback is best-effort only.
    }
  }

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
