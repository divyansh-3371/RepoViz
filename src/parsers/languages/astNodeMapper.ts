import Parser from "tree-sitter";
import { LanguageProfile } from "./languageProfile";

/**
 * Generic abstraction for AST node matching and navigation
 *
 * This layer handles language variations in:
 * - Node type names (some languages use "class_declaration", others "class_definition")
 * - Field names (some use "source", others use "path" for imports)
 * - Node hierarchy (some nest body in "block", others in "body")
 *
 * By centralizing this logic, codeAnalyzer.ts becomes language-agnostic
 */
export class ASTNodeMapper {
  constructor(private profile: LanguageProfile) {}

  // ============ SCOPE MATCHING ============

  /**
   * Check if a node is a class/struct/record definition
   */
  public isClassDefinition(node: Parser.SyntaxNode): boolean {
    const classNodeTypes = this.profile.astNodes.scopes.classDefinition;
    const typeArray = Array.isArray(classNodeTypes)
      ? classNodeTypes
      : [classNodeTypes];
    return typeArray.includes(node.type);
  }

  /**
   * Check if a node is a top-level function definition
   */
  public isFunctionDefinition(node: Parser.SyntaxNode): boolean {
    const funcNodeTypes = this.profile.astNodes.scopes.functionDefinition;
    const typeArray = Array.isArray(funcNodeTypes)
      ? funcNodeTypes
      : [funcNodeTypes];
    return typeArray.includes(node.type);
  }

  /**
   * Check if a node is a method definition (inside a class)
   */
  public isMethodDefinition(node: Parser.SyntaxNode): boolean {
    const methodNodeTypes = this.profile.astNodes.scopes.methodDefinition;
    const typeArray = Array.isArray(methodNodeTypes)
      ? methodNodeTypes
      : [methodNodeTypes];
    return typeArray.includes(node.type);
  }

  /**
   * Check if a node represents any kind of scope (class, function, method)
   */
  public isScope(node: Parser.SyntaxNode): boolean {
    return (
      this.isClassDefinition(node) ||
      this.isFunctionDefinition(node) ||
      this.isMethodDefinition(node)
    );
  }

  // ============ CONTROL FLOW MATCHING ============

  /**
   * Check if a node is a loop statement (for, while, do-while, foreach, etc.)
   */
  public isLoopStatement(node: Parser.SyntaxNode): boolean {
    return this.profile.astNodes.controlFlow.loopStatements.includes(node.type);
  }

  /**
   * Check if a node is a condition statement (if, switch, when, etc.)
   */
  public isConditionStatement(node: Parser.SyntaxNode): boolean {
    return this.profile.astNodes.controlFlow.conditionStatements.includes(
      node.type
    );
  }

  /**
   * Check if a node is a return statement
   */
  public isReturnStatement(node: Parser.SyntaxNode): boolean {
    return node.type === this.profile.astNodes.controlFlow.returnStatement;
  }

  /**
   * Check if a node is a throw statement
   */
  public isThrowStatement(node: Parser.SyntaxNode): boolean {
    return node.type === this.profile.astNodes.controlFlow.throwStatement;
  }

  /**
   * Check if a node is a break statement
   */
  public isBreakStatement(node: Parser.SyntaxNode): boolean {
    return node.type === this.profile.astNodes.controlFlow.breakStatement;
  }

  /**
   * Check if a node is a continue statement
   */
  public isContinueStatement(node: Parser.SyntaxNode): boolean {
    return node.type === this.profile.astNodes.controlFlow.continueStatement;
  }

  /**
   * Check if a node is any kind of control flow statement
   */
  public isControlFlowStatement(node: Parser.SyntaxNode): boolean {
    return (
      this.isLoopStatement(node) ||
      this.isConditionStatement(node) ||
      this.isReturnStatement(node) ||
      this.isThrowStatement(node) ||
      this.isBreakStatement(node) ||
      this.isContinueStatement(node)
    );
  }

  // ============ BLOCK / BODY NAVIGATION ============

  /**
   * Check if a node is a block/body node (contains statements)
   */
  public isBlock(node: Parser.SyntaxNode): boolean {
    return node.type === this.profile.astNodes.block.blockNode;
  }

  /**
  * Check if a node is a valid statement type within a block
  */
  public isStatementType(node: Parser.SyntaxNode): boolean {
    return this.profile.astNodes.block.statementTypes.includes(node.type);
  }

  /**
   * Get valid statement children of a node
   * Filters children to only include valid statement types
   */
  public getStatementChildren(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const validStatementTypes = this.profile.astNodes.block.statementTypes;
    return node.namedChildren.filter((child) =>
      validStatementTypes.includes(child.type)
    );
  }

  /**
   * Find the body/block of a scope (class, function, method)
   * Different languages store the body in different places:
   * - JavaScript: "body" field
   * - Java: "body" field
   * - Go: no body field, statements directly in node
   * - Rust: has "block" field
   *
   * This tries common field names and returns the first valid one
   */
  public getScopeBody(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // Try common body field names
    const fieldNames = ["body", "block", "statement_block"];

    for (const fieldName of fieldNames) {
      const bodyNode = node.childForFieldName(fieldName);
      if (bodyNode) {
        return bodyNode;
      }
    }

    // If no body field found, check if node itself can act as a block
    if (this.isBlock(node)) {
      return node;
    }

    // Some languages might have statements as direct children
    // Return the node itself to iterate its statement children
    if (node.namedChildren.some((child) =>
      this.profile.astNodes.block.statementTypes.includes(child.type)
    )) {
      return node;
    }

    return null;
  }

  // ============ NAME EXTRACTION ============

  /**
   * Extract name from a class definition node
   */
  public getClassName(node: Parser.SyntaxNode): string | null {
    if (!this.isClassDefinition(node)) {
      return null;
    }
    return this.profile.nameExtraction.getClassName(node);
  }

  /**
   * Extract name from a function definition node
   */
  public getFunctionName(node: Parser.SyntaxNode): string | null {
    if (!this.isFunctionDefinition(node)) {
      return null;
    }
    return this.profile.nameExtraction.getFunctionName(node);
  }

  /**
   * Extract name from a method definition node
   */
  public getMethodName(node: Parser.SyntaxNode): string | null {
    if (!this.isMethodDefinition(node)) {
      return null;
    }
    return this.profile.nameExtraction.getMethodName(node);
  }

  /**
   * Extract name from any scope node
   */
  public getScopeName(node: Parser.SyntaxNode): string | null {
    if (this.isClassDefinition(node)) {
      return this.getClassName(node);
    } else if (this.isMethodDefinition(node)) {
      return this.getMethodName(node);
    } else if (this.isFunctionDefinition(node)) {
      return this.getFunctionName(node);
    }
    return null;
  }

  /**
   * Extract variable name from a declaration node (optional)
   */
  public getVariableName(node: Parser.SyntaxNode): string | null {
    const getVarName = this.profile.nameExtraction.getVariableName;
    if (getVarName) {
      return getVarName(node);
    }
    return null;
  }

  // ============ CONTROL FLOW LABELING ============

  /**
   * Generate a human-readable label for a loop node
   * Examples: "for i = 0..10", "while x > 0", "foreach item"
   */
  public getLoopLabel(node: Parser.SyntaxNode): string {
    if (!this.isLoopStatement(node)) {
      return "(loop)";
    }
    return this.profile.labelingRules.loopLabel(node);
  }

  /**
   * Generate a human-readable label for a condition node
   * Examples: "if x > 5", "switch value"
   */
  public getConditionLabel(node: Parser.SyntaxNode): string {
    if (!this.isConditionStatement(node)) {
      return "(condition)";
    }
    return this.profile.labelingRules.conditionLabel(node);
  }

  /**
   * Generate a label for any control flow node
   */
  public getControlFlowLabel(node: Parser.SyntaxNode): string {
    if (this.isLoopStatement(node)) {
      return this.getLoopLabel(node);
    } else if (this.isConditionStatement(node)) {
      return this.getConditionLabel(node);
    } else if (this.isReturnStatement(node)) {
      return "return";
    } else if (this.isThrowStatement(node)) {
      return "throw";
    } else if (this.isBreakStatement(node)) {
      return "break";
    } else if (this.isContinueStatement(node)) {
      return "continue";
    }
    return "(control flow)";
  }

  // ============ FIELD EXTRACTION ============

  /**
   * Get a field from a node by field name
   * Handles language variations in field naming
   */
  public getField(
    node: Parser.SyntaxNode,
    fieldName: string
  ): Parser.SyntaxNode | null {
    return node.childForFieldName(fieldName) || null;
  }

  /**
   * Get multiple fields from a node
   */
  public getFields(
    node: Parser.SyntaxNode,
    fieldNames: string[]
  ): (Parser.SyntaxNode | null)[] {
    return fieldNames.map((name) => this.getField(node, name));
  }

  /**
   * Get all children of a specific type
   */
  public getChildrenOfType(
    node: Parser.SyntaxNode,
    types: string | string[]
  ): Parser.SyntaxNode[] {
    const typeArray = Array.isArray(types) ? types : [types];
    return node.namedChildren.filter((child) => typeArray.includes(child.type));
  }

  /**
   * Check if a node has a specific child type
   */
  public hasChildOfType(
    node: Parser.SyntaxNode,
    type: string
  ): boolean {
    return node.namedChildren.some((child) => child.type === type);
  }

  // ============ LANGUAGE FEATURES ============

  /**
   * Check if language supports regex fallback
   * Used for Python primarily, may be used for other dynamic languages
   */
  public hasRegexFallback(): boolean {
    return this.profile.features.hasRegexFallback;
  }

  /**
   * Check if language supports arrow functions
   * Affects how lambdas/anonymous functions are labeled
   */
  public supportsArrowFunctions(): boolean {
    return this.profile.features.supportsArrowFunctions;
  }

  /**
   * Check if language supports generics
   * Affects how class/method names are extracted and displayed
   */
  public hasGenerics(): boolean {
    return this.profile.features.hasGenerics;
  }

  /**
   * Check if language is indentation-based (Python, Ruby, etc.)
   * Affects how blocks are determined
   */
  public isIndentationBased(): boolean {
    return this.profile.features.indentationBased || false;
  }

  // ============ CUSTOM HANDLERS ============

  /**
   * Check if a custom control flow handler exists for this node type
   */
  public hasCustomHandler(nodeType: string): boolean {
    return (
      this.profile.controlFlowHandlers !== undefined &&
      this.profile.controlFlowHandlers[nodeType] !== undefined
    );
  }

  /**
   * Call a custom control flow handler for a node type
   * Returns the entity type to create, or null to skip
   */
  public callCustomHandler(node: Parser.SyntaxNode): string | null {
    if (
      !this.profile.controlFlowHandlers ||
      !this.profile.controlFlowHandlers[node.type]
    ) {
      return null;
    }
    return this.profile.controlFlowHandlers[node.type](node);
  }

  /**
   * Get the language profile being used by this mapper
   */
  public getProfile(): LanguageProfile {
    return this.profile;
  }
}
