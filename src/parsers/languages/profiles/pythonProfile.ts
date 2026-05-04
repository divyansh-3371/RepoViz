import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for Python
 *
 * Supports `.py` files
 * Uses tree-sitter-python for parsing
 * Has regex fallback for when AST parsing doesn't find entities
 */
export class PythonProfile implements LanguageProfile {
  id = "python";
  name = "Python";
  fileExtensions = [".py"];
  treeParserModule = "tree-sitter-python";

  astNodes = {
    scopes: {
      classDefinition: "class_definition",
      functionDefinition: "function_definition",
      methodDefinition: "function_definition" // Python uses function_definition for methods too
    },
    controlFlow: {
      loopStatements: [
        "for_statement",
        "while_statement"
      ],
      conditionStatements: ["if_statement"],
      returnStatement: "return_statement",
      throwStatement: "raise_statement",
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
        "pass_statement",
        "delete_statement"
      ]
    }
  };

  imports = {
    importStatementTypes: ["import_statement", "import_from_statement"],
    importFieldName: "module" // Python uses "module" field for imports
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getFunctionName(node: Parser.SyntaxNode): string | null {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getMethodName(node: Parser.SyntaxNode): string | null {
      // In Python, methods are just function_definition within a class
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    }
  };

  labelingRules = {
    loopLabel(node: Parser.SyntaxNode): string {
      if (node.type === "for_statement") {
        const left = node.childForFieldName("left");
        const right = node.childForFieldName("right");
        return left && right ? `for ${left.text} in ${right.text}` : "for (...)";
      }
      if (node.type === "while_statement") {
        const cond = node.childForFieldName("condition");
        return `while (${cond?.text || "..."})`;
      }
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      if (node.type === "if_statement") {
        const cond = node.childForFieldName("condition");
        return `if (${cond?.text || "..."})`;
      }
      return node.type.replace(/_/g, " ");
    }
  };

  features = {
    hasRegexFallback: true, // Python AST can be incomplete; regex fallback helps
    supportsArrowFunctions: false,
    hasGenerics: false,
    indentationBased: true
  };
}
