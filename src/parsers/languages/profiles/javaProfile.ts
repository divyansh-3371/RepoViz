import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for Java
 *
 * Supports `.java` files
 * Uses tree-sitter-java for parsing
 */
export class JavaProfile implements LanguageProfile {
  id = "java";
  name = "Java";
  fileExtensions = [".java"];
  treeParserModule = "tree-sitter-java";

  astNodes = {
    scopes: {
      classDefinition: ["class_declaration", "interface_declaration", "enum_declaration", "record_declaration"],
      functionDefinition: "constructor_declaration",
      methodDefinition: "method_declaration"
    },
    controlFlow: {
      loopStatements: [
        "for_statement",
        "enhanced_for_statement",
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
        "enhanced_for_statement",
        "while_statement",
        "do_statement",
        "return_statement",
        "switch_statement",
        "try_statement",
        "throw_statement",
        "break_statement",
        "continue_statement",
        "local_variable_declaration",
        "synchronized_statement"
      ]
    }
  };

  imports = {
    importStatementTypes: ["import_declaration", "import_on_demand_declaration"],
    importFieldName: "name"
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getFunctionName(node: Parser.SyntaxNode): string | null {
      // Constructors don't have traditional names, use class name
      if (node.type === "constructor_declaration") {
        const nameNode = node.childForFieldName("name");
        return nameNode?.text || "<init>";
      }

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
      if (node.type === "for_statement") return "for (...)";
      if (node.type === "enhanced_for_statement") {
        const var_node = node.childForFieldName("variable");
        const expr = node.childForFieldName("value");
        return `for (${var_node?.text || "x"} : ${expr?.text || "..."})`;
      }
      if (node.type === "while_statement") {
        const cond = node.childForFieldName("condition");
        return `while (${cond?.text || "..."})`;
      }
      if (node.type === "do_statement") return "do ... while (...)";
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      if (node.type === "if_statement") {
        const cond = node.childForFieldName("condition");
        return `if (${cond?.text || "..."})`;
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
    hasGenerics: true
  };
}
