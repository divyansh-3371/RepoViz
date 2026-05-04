import Parser from "tree-sitter";

export interface ImportExtractorRule {
  matchNodeType: string | string[];
  extract(node: Parser.SyntaxNode): string[] | null;
}

export interface LanguageProfile {
  // ============ METADATA ============
  /** Unique identifier for the language (e.g., "java", "go", "rust") */
  id: string;

  /** Human-readable language name (e.g., "Java", "Go", "Rust") */
  name: string;

  /** File extensions this language uses (e.g., [".java"], [".go", ".mod"]) */
  fileExtensions: string[];

  /** tree-sitter npm package name (e.g., "tree-sitter-java") */
  treeParserModule: string;

  astNodes: {
    /**
     * Scope-defining node types (top-level code containers)
     */
    scopes: {
      /** Node types that define a class/struct/record (e.g., "class_declaration") */
      classDefinition: string | string[];

      /** Node types that define a function/method at module level (e.g., "function_declaration") */
      functionDefinition: string | string[];

      /**
       * Node types that define methods inside classes (e.g., "method_declaration")
       * Some languages (e.g., Kotlin) may use same as functionDefinition
       */
      methodDefinition: string | string[];
    };

  
    controlFlow: {
      /** Loop statement types (for, while, do-while, foreach, etc.) */
      loopStatements: string[];

      /** Conditional statement types (if, switch, when, etc.) */
      conditionStatements: string[];

      /** Return statement node type */
      returnStatement: string;

      /** Throw statement node type */
      throwStatement: string;

      /** Break statement node type */
      breakStatement: string;

      /** Continue statement node type */
      continueStatement: string;
    };

    /**
     * Block/body node types for scope analysis
     */
    block: {
      /** Node type that represents a code block (e.g., "block", "statement_block") */
      blockNode: string;

      /** All valid statement child types (children that can appear in a block) */
      statementTypes: string[];
    };
  };

  imports: {
    /** Node types that represent import statements */
    importStatementTypes: string[];

    importFieldName?: string;

    /** Custom extractors for import patterns that don't fit standard field lookup */
    extractors?: ImportExtractorRule[];
  };

  nameExtraction: {
    /**
     * Extract class/struct/record name from a class definition node
     * Returns null if name cannot be determined (e.g., anonymous class)
     */
    getClassName(node: Parser.SyntaxNode): string | null;

    /**
     * Extract function/method name from a function definition node
     * Returns null if name cannot be determined (e.g., lambda)
     */
    getFunctionName(node: Parser.SyntaxNode): string | null;

    /**
     * Extract method name from a method definition node
     * Some languages may have separate node types for methods vs functions
     */
    getMethodName(node: Parser.SyntaxNode): string | null;

    /**
     * Extract variable/parameter name from a declaration node (optional)
     */
    getVariableName?(node: Parser.SyntaxNode): string | null;
  };

  labelingRules: {
    /**
     * Generate a label for a loop node
     * Example: "for i in 0..length", "while condition", "foreach item"
     */
    loopLabel(node: Parser.SyntaxNode): string;

    /**
     * Generate a label for a condition node
     * Example: "if x > 5", "switch value", "when predicate"
     */
    conditionLabel(node: Parser.SyntaxNode): string;
  };

 
  features: {
    /**
     * If true, fall back to regex-based parsing when tree-sitter doesn't find entities.
     * Used for Python and potentially Ruby.
     */
    hasRegexFallback: boolean;

    /** Whether language supports arrow functions / lambdas (for labeling) */
    supportsArrowFunctions: boolean;

    /** Whether language supports generics (for better naming) */
    hasGenerics: boolean;

    /** Whether language uses indentation for scoping (Python, Ruby) */
    indentationBased?: boolean;
  };

  controlFlowHandlers?: {
    /**
     * Handle language-specific control flow nodes not covered by standard loopStatements/conditionStatements
     * Returns the entity type to create, or null to skip
     */
    [nodeType: string]: (node: Parser.SyntaxNode) => string | null;
  };
}

export abstract class BaseLanguageProfile implements LanguageProfile {
  abstract id: string;
  abstract name: string;
  abstract fileExtensions: string[];
  abstract treeParserModule: string;
  abstract astNodes: LanguageProfile["astNodes"];
  abstract imports: LanguageProfile["imports"];
  abstract nameExtraction: LanguageProfile["nameExtraction"];
  abstract labelingRules: LanguageProfile["labelingRules"];
  abstract features: LanguageProfile["features"];
}
