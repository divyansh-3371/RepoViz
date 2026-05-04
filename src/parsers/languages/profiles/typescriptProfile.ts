import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for TypeScript
 *
 * Supports `.ts` files
 * Uses tree-sitter-typescript (typescript dialect)
 */
export class TypeScriptProfile implements LanguageProfile {
  id = "typescript";
  name = "TypeScript";
  fileExtensions = [".ts"];
  treeParserModule = "tree-sitter-typescript";

  astNodes = {
    scopes: {
      classDefinition: "class_declaration",
      functionDefinition: ["function_declaration", "generator_function"],
      methodDefinition: "method_definition"
    },
    controlFlow: {
      loopStatements: [
        "for_statement",
        "for_in_statement",
        "for_of_statement",
        "while_statement",
        "do_statement"
      ],
      conditionStatements: ["if_statement", "switch_statement"],
      returnStatement: "return_statement",
      throwStatement: "throw_statement",
      breakStatement: "break_statement",
      continueStatement: "continue_statement"
    },
    block: {
      blockNode: "block",
      statementTypes: [
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
      ]
    }
  };

  imports = {
    importStatementTypes: ["import_statement", "export_statement", "import_declaration"],
    importFieldName: "source"
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getFunctionName(node: Parser.SyntaxNode): string | null {
      // Try "name" field first (function_declaration, generator_function)
      const nameNode = node.childForFieldName("name");
      if (nameNode) return nameNode.text;

      // For arrow functions and function expressions in variables
      if (
        node.type === "arrow_function" ||
        node.type === "function_expression" ||
        node.type === "generator_function"
      ) {
        const parent = node.parent;
        if (parent?.type === "variable_declarator") {
          const varName =
            parent.childForFieldName("name") || parent.child(0);
          if (varName) return varName.text;
        }
      }

      return null;
    },

    getMethodName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    }
  };

  labelingRules = {
    loopLabel(node: Parser.SyntaxNode): string {
      if (node.type === "for_statement") return "for (...)";
      if (node.type === "for_in_statement") return "for-in (...)";
      if (node.type === "for_of_statement") return "for-of (...)";
      if (node.type === "while_statement") {
        const cond = node.childForFieldName("condition");
        return `while (${cond?.text || "..."})`;
      }
      if (node.type === "do_statement") return "do ... while (...)";
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      const cond =
        node.childForFieldName("condition") ||
        node.namedChildren.find((c) => c.type.includes("expression"));

      if (!cond) return node.type.replace(/_/g, " ");
      if (node.type === "switch_statement")
        return `switch (${cond.text})`;
      if (node.type === "if_statement") return `if (${cond.text})`;
      return `${node.type.replace(/_statement$/, "")} (${cond.text})`;
    }
  };

  features = {
    hasRegexFallback: false,
    supportsArrowFunctions: true,
    hasGenerics: true
  };
}
