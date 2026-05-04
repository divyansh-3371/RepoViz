import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for Ruby
 *
 * Supports `.rb`, `.erb`, `.rake` files
 * Uses tree-sitter-ruby for parsing
 * Has regex fallback for complex indentation-based scoping
 */
export class RubyProfile implements LanguageProfile {
  id = "ruby";
  name = "Ruby";
  fileExtensions = [".rb", ".erb", ".rake", ".gemfile"];
  treeParserModule = "tree-sitter-ruby";

  astNodes = {
    scopes: {
      classDefinition: "class_definition",
      functionDefinition: "method_definition",
      methodDefinition: "method_definition" // Ruby treats all as method_definition
    },
    controlFlow: {
      loopStatements: [
        "for_statement",
        "while_statement",
        "until_statement",
        "begin_statement"
      ],
      conditionStatements: ["if_statement", "unless_statement", "case_statement"],
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
        "unless_statement",
        "case_statement",
        "for_statement",
        "while_statement",
        "until_statement",
        "begin_statement",
        "return_statement",
        "raise_statement",
        "break_statement",
        "continue_statement",
        "call",
        "assignment"
      ]
    }
  };

  imports = {
    importStatementTypes: ["call"],
    importFieldName: "argument", // Simplified for now
    extractors: [
      {
        matchNodeType: "call",
        extract(node: Parser.SyntaxNode): string[] | null {
          // Look for require() or require_relative() calls
          const method = node.childForFieldName("method");
          if (method && (method.text === "require" || method.text === "require_relative")) {
            const args = node.childForFieldName("arguments");
            if (args) {
              // Arguments are typically in parentheses with a string
              const firstArg = args.namedChildren[0];
              if (firstArg) {
                let text = firstArg.text;
                // Remove quotes
                if ((text.startsWith('"') && text.endsWith('"')) ||
                    (text.startsWith("'") && text.endsWith("'"))) {
                  text = text.slice(1, -1);
                }
                return text ? [text] : null;
              }
            }
          }
          return null;
        }
      }
    ]
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
      if (node.type === "until_statement") {
        const cond = node.childForFieldName("condition");
        return `until (${cond?.text || "..."})`;
      }
      if (node.type === "begin_statement") {
        return "begin ... rescue ... end";
      }
      return node.type.replace(/_/g, " ");
    },

    conditionLabel(node: Parser.SyntaxNode): string {
      if (node.type === "if_statement") {
        const cond = node.childForFieldName("condition");
        return `if (${cond?.text || "..."})`;
      }
      if (node.type === "unless_statement") {
        const cond = node.childForFieldName("condition");
        return `unless (${cond?.text || "..."})`;
      }
      if (node.type === "case_statement") {
        const expr = node.childForFieldName("expr");
        return `case (${expr?.text || "..."})`;
      }
      return node.type.replace(/_/g, " ");
    }
  };

  features = {
    hasRegexFallback: true, // Ruby's complex syntax benefits from regex fallback
    supportsArrowFunctions: true, // Ruby has lambdas and procs
    hasGenerics: false,
    indentationBased: true
  };
}
