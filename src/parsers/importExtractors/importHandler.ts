import Parser from "tree-sitter";
import { LanguageProfile } from "../languages/languageProfile";

export interface ImportHandler {
  /**
   * Extract import paths from a syntax tree
   * Returns a set of module/package names that this file imports
   */
  extract(tree: Parser.Tree): string[];

  /**
   * Get the language profile this handler works with
   */
  getProfile(): LanguageProfile;
}

/**
 * Base class for implementing language-specific import handlers
 * Provides utility methods for common import extraction patterns
 */
export abstract class BaseImportHandler implements ImportHandler {
  constructor(protected profile: LanguageProfile) {}

  /**
   * Extract imports from the syntax tree
   * Subclasses should implement this with language-specific logic
   */
  abstract extract(tree: Parser.Tree): string[];

  /**
   * Get the language profile
   */
  public getProfile(): LanguageProfile {
    return this.profile;
  }

  /**
   * Walk the tree and collect nodes of specific types
   * Utility method for traversing AST
   */
  protected findNodesOfType(
    node: Parser.SyntaxNode,
    types: string[]
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    function walk(current: Parser.SyntaxNode) {
      if (types.includes(current.type)) {
        results.push(current);
      }

      for (const child of current.children) {
        walk(child);
      }
    }

    walk(node);
    return results;
  }

  /**
   * Walk the tree and collect nodes matching a condition
   * Utility method for custom traversal
   */
  protected findNodesMatching(
    node: Parser.SyntaxNode,
    predicate: (node: Parser.SyntaxNode) => boolean
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    function walk(current: Parser.SyntaxNode) {
      if (predicate(current)) {
        results.push(current);
      }

      for (const child of current.children) {
        walk(child);
      }
    }

    walk(node);
    return results;
  }

  /**
   * Extract text from a field with quote character stripping
   * Common utility for import statements where the path is quoted
   */
  protected extractFromQuotedField(
    node: Parser.SyntaxNode,
    fieldName: string
  ): string | null {
    const field = node.childForFieldName(fieldName);
    if (!field) {
      return null;
    }

    // Remove surrounding quotes (" or ')
    let text = field.text;
    if ((text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1);
    }

    return text || null;
  }

  /**
   * Extract imports from profile.imports configuration
   * Default implementation handles simple cases where imports are in a standard field
   */
  protected extractFromProfile(tree: Parser.Tree): string[] {
    const imports = new Set<string>();
    const importNodeTypes = this.profile.imports.importStatementTypes;
    const fieldName = this.profile.imports.importFieldName || "source";

    const importNodes = this.findNodesOfType(tree.rootNode, importNodeTypes);

    for (const node of importNodes) {
      const importPath = this.extractFromQuotedField(node, fieldName);
      if (importPath) {
        imports.add(importPath);
      }
    }

    // Apply custom extractors from profile
    if (this.profile.imports.extractors) {
      for (const rule of this.profile.imports.extractors) {
        const ruleNodeTypes = Array.isArray(rule.matchNodeType)
          ? rule.matchNodeType
          : [rule.matchNodeType];

        const matchingNodes = this.findNodesOfType(tree.rootNode, ruleNodeTypes);
        for (const node of matchingNodes) {
          const extracted = rule.extract(node);
          if (extracted) {
            extracted.forEach((imp: string) => imports.add(imp));
          }
        }
      }
    }

    return Array.from(imports);
  }
}

/**
 * Registry for managing language-specific import handlers
 * Maps language ids to their corresponding handler classes/instances
 */
export class ImportHandlerRegistry {
  private handlers: Map<string, ImportHandler> = new Map();

  /**
   * Register an import handler for a language
   */
  public register(languageId: string, handler: ImportHandler): void {
    this.handlers.set(languageId, handler);
  }

  /**
   * Get the handler for a language
   */
  public getHandler(languageId: string): ImportHandler | null {
    return this.handlers.get(languageId) || null;
  }

  /**
   * Check if a handler is registered for a language
   */
  public hasHandler(languageId: string): boolean {
    return this.handlers.has(languageId);
  }

  /**
   * Get all registered handlers
   */
  public getAllHandlers(): ImportHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get all registered language ids
   */
  public getSupportedLanguages(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Global import handler registry
 * Should be populated at application startup with all import handlers
 */
export const importHandlerRegistry = new ImportHandlerRegistry();
