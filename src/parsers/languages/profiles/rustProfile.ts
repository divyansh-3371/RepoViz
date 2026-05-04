import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for Rust
 *
 * Supports `.rs` files
 * Uses tree-sitter-rust for parsing
 */
export class RustProfile implements LanguageProfile {
  id = "rust";
  name = "Rust";
  fileExtensions = [".rs"];
  treeParserModule = "tree-sitter-rust";

  astNodes = {
    scopes: {
      classDefinition: ["struct_item", "enum_item", "trait_item"],
      functionDefinition: "function_item",
      methodDefinition: "method_declaration" // Methods inside impl blocks
    },
    controlFlow: {
      loopStatements: [
        "for_expression",
        "while_expression",
        "loop_expression"
      ],
      conditionStatements: ["if_expression", "match_expression"],
      returnStatement: "return_expression",
      throwStatement: "panic_macro", // Rust uses panic! macro
      breakStatement: "break_expression",
      continueStatement: "continue_expression"
    },
    block: {
      blockNode: "block",
      statementTypes: [
        "expression_statement",
        "if_expression",
        "for_expression",
        "while_expression",
        "loop_expression",
        "match_expression",
        "return_expression",
        "break_expression",
        "continue_expression",
        "let_declaration",
        "const_item",
        "static_item"
      ]
    }
  };

  imports = {
    importStatementTypes: ["use_declaration"],
    importFieldName: "path" // Rust uses "path" for imports
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      // Rust uses name field for structs, enums, traits
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
      if (node.type === "for_expression") {
        const pattern = node.childForFieldName("pattern");
        const value = node.childForFieldName("value");
        return `for ${pattern?.text || "x"} in ${value?.text || "..."}`;
      }
      if (node.type === "while_expression") {
        const cond = node.childForFieldName("condition");
        return `while (${cond?.text || "..."})`;
      }
      if (node.type === "loop_expression") return "loop { ... }";
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      if (node.type === "if_expression") {
        const cond = node.childForFieldName("condition");
        return `if (${cond?.text || "..."})`;
      }
      if (node.type === "match_expression") {
        const expr = node.childForFieldName("value");
        return `match (${expr?.text || "..."})`;
      }
      return node.type.replace(/_/g, " ");
    }
  };

  features = {
    hasRegexFallback: false,
    supportsArrowFunctions: false,
    hasGenerics: true
  };
}
