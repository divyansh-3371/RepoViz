import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for Go
 *
 * Supports `.go` files
 * Uses tree-sitter-go for parsing
 */
export class GoProfile implements LanguageProfile {
  id = "go";
  name = "Go";
  fileExtensions = [".go"];
  treeParserModule = "tree-sitter-go";

  astNodes = {
    scopes: {
      classDefinition: "type_declaration", // Go uses type for struct definitions
      functionDefinition: "function_declaration",
      methodDefinition: "method_declaration"
    },
    controlFlow: {
      loopStatements: ["for_statement"],
      conditionStatements: ["if_statement", "switch_statement"],
      returnStatement: "return_statement",
      throwStatement: "panic_statement", // Go uses panic instead of throw
      breakStatement: "break_statement",
      continueStatement: "continue_statement"
    },
    block: {
      blockNode: "block",
      statementTypes: [
        "expression_statement",
        "if_statement",
        "for_statement",
        "return_statement",
        "switch_statement",
        "select_statement",
        "go_statement",
        "defer_statement",
        "short_var_declaration",
        "var_declaration",
        "const_declaration",
        "break_statement",
        "continue_statement",
        "fallthrough_statement",
        "panic_statement"
      ]
    }
  };

  imports = {
    importStatementTypes: ["import_declaration", "import_spec"],
    importFieldName: "path" // Go uses "path" field for imports
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      // In Go, structs are defined with type keyword
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getFunctionName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getMethodName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    }
  };

  labelingRules = {
    loopLabel(node: Parser.SyntaxNode): string {
      if (node.type === "for_statement") {
        // Go for loops have different forms:
        // for init; cond; post { ... }
        // for cond { ... }
        // for { ... }  (infinite loop)
        const cond = node.childForFieldName("condition");
        if (cond) return `for (${cond.text})`;
        return "for (...)";
      }
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      if (node.type === "if_statement") {
        const condition = node.childForFieldName("condition") ||
          node.childForFieldName("initializer");
        return `if (${condition?.text || "..."})`;
      }
      if (node.type === "switch_statement") {
        const expr = node.childForFieldName("expression");
        return `switch (${expr?.text || "..."})`;
      }
      return node.type.replace(/_/g, " ");
    }
  };

  features = {
    hasRegexFallback: false,
    supportsArrowFunctions: false,
    hasGenerics: false // Go added generics in 1.18, but treating as optional
  };
}
