import Parser from "tree-sitter"
import { parseFile, ParseFileResult } from "./parseFile"
import { LanguageProfile } from "./languages/languageProfile"
import { ASTNodeMapper } from "./languages/astNodeMapper"
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

/**
 * Analyze code structure from a file
 * Extracts classes, functions, methods, control flow, and calls
 *
 * @param filePath Path to the file to analyze
 * @returns CodeStructure with all extracted entities and connections
 */
export function analyzeFileStructure(filePath: string): CodeStructure {
  const parseResult = parseFile(filePath)
  if (!parseResult) {
    return {
      filePath,
      fileName: filePath.split(/[\\/]/).pop() || filePath,
      entities: [],
      connections: []
    }
  }

  return analyzeFileStructureWithProfile(filePath, parseResult.tree, parseResult.profile)
}

/**
 * Analyze code structure with a known language profile
 * This is the internal implementation that uses ASTNodeMapper for language-agnostic analysis
 *
 * @param filePath Path to the file
 * @param tree The parsed syntax tree
 * @param profile The language profile
 * @returns CodeStructure with all extracted entities and connections
 */
export function analyzeFileStructureWithProfile(
  filePath: string,
  tree: Parser.Tree,
  profile: LanguageProfile
): CodeStructure {
  const mapper = new ASTNodeMapper(profile)

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
    return compactText(mapper.getConditionLabel(node))
  }

  function loopLabel(node: Parser.SyntaxNode): string {
    return compactText(mapper.getLoopLabel(node))
  }

  function getFunctionName(node: Parser.SyntaxNode): string | null {
    // Use profile's name extraction if available
    const profileName = mapper.getFunctionName(node)
    if (profileName) return profileName

    // Fallback: const foo = () => {}
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
    return mapper.getStatementChildren(node)
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

    // Class definition
    if (mapper.isClassDefinition(node)) {
      const name = mapper.getClassName(node) || "Class"
      const classId = addEntity("class", name, node)
      addConnection(currentScope.id, classId, "contains")
      const nextStack = [...scopeStack, { id: classId, name, kind: "class" as CodeEntityType }]
      for (const child of node.namedChildren) walk(child, nextStack)
      return
    }

    // Function at module or class level
    if (mapper.isFunctionDefinition(node)) {
      const fnName = mapper.getFunctionName(node) || getFunctionName(node) || "function"
      const fnType: CodeEntityType =
        currentScope?.kind === "class" ? "method" : "function"
      const fnId = addEntity(fnType, fnName, node)
      addConnection(currentScope.id, fnId, "contains")
      analyzeScope(node, { id: fnId, name: fnName, kind: fnType })
      for (const child of node.namedChildren) {
        // Skip body to avoid duplicate analysis
        const body = mapper.getScopeBody(node)
        if (body && child === body) continue
        walk(child, [...scopeStack, { id: fnId, name: fnName, kind: fnType as CodeEntityType }])
      }
      return
    }

    // Method within a class
    if (mapper.isMethodDefinition(node)) {
      const mName = mapper.getMethodName(node) || "method"
      const methodId = addEntity("method", mName, node)
      addConnection(currentScope.id, methodId, "contains")
      analyzeScope(node, { id: methodId, name: mName, kind: "method" })
      for (const child of node.namedChildren) {
        const body = mapper.getScopeBody(node)
        if (body && child === body) continue
        walk(child, [...scopeStack, { id: methodId, name: mName, kind: "method" }])
      }
      return
    }

    for (const child of node.namedChildren) {
      walk(child, scopeStack)
    }
  }

  walk(tree.rootNode, [moduleScope])

  // Fallback parsing for languages that support regex fallback (e.g., Python)
  if (mapper.hasRegexFallback() && entities.filter((e) => e.type !== "module").length === 0) {
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
