import Parser from "tree-sitter";
import { LanguageProfile } from "../languageProfile";

/**
 * Language profile for C++
 *
 * Supports `.cpp`, `.cc`, `.cxx`, `.hpp`, `.h` files
 * Uses tree-sitter-cpp for parsing
 */
export class CppProfile implements LanguageProfile {
  id = "cpp";
  name = "C++";
  fileExtensions = [".cpp", ".cc", ".cxx", ".hpp", ".h", ".c++", ".hh"];
  treeParserModule = "tree-sitter-cpp";

  astNodes = {
    scopes: {
      classDefinition: ["class_specifier", "struct_specifier", "union_specifier"],
      functionDefinition: "function_definition",
      methodDefinition: "function_definition" // C++ treats methods as regular function_definitions
    },
    controlFlow: {
      loopStatements: [
        "for_statement",
        "while_statement",
        "do_statement",
        "range_based_for_statement"
      ],
      conditionStatements: ["if_statement", "switch_statement"],
      returnStatement: "return_statement",
      throwStatement: "throw_statement",
      breakStatement: "break_statement",
      continueStatement: "continue_statement"
    },
    block: {
      blockNode: "compound_statement",
      statementTypes: [
        "expression_statement",
        "if_statement",
        "for_statement",
        "range_based_for_statement",
        "while_statement",
        "do_statement",
        "return_statement",
        "switch_statement",
        "try_statement",
        "throw_statement",
        "break_statement",
        "continue_statement",
        "declaration",
        "block_declaration"
      ]
    }
  };

  imports = {
    importStatementTypes: ["preproc_include"],
    importFieldName: "path",
    extractors: [
      {
        matchNodeType: "preproc_include",
        extract(node: Parser.SyntaxNode): string[] | null {
          // Extract #include <path> or #include "path"
          const path = node.childForFieldName("path");
          if (path) {
            let text = path.text;
            // Remove angle brackets or quotes
            if ((text.startsWith("<") && text.endsWith(">")) ||
                (text.startsWith('"') && text.endsWith('"'))) {
              text = text.slice(1, -1);
            }
            return text ? [text] : null;
          }
          return null;
        }
      }
    ]
  };

  nameExtraction = {
    getClassName(node: Parser.SyntaxNode): string | null {
      // For class_specifier and struct_specifier
      if (node.type === "class_specifier" || node.type === "struct_specifier") {
        // The name is usually the first child after "class"/"struct" keyword
        let nameNode = node.childForFieldName("name");
        if (nameNode) return nameNode.text;

        // Fallback: look for identifier child
        const identifiers = node.namedChildren.find((c) => c.type === "type_identifier");
        return identifiers?.text || null;
      }
      return null;
    },

    getFunctionName(node: Parser.SyntaxNode): string | null {
      // C++ function declarators have the name as a field
      const declarator = node.childForFieldName("declarator");
      if (declarator) {
        // The declarator might be nested, so we need to recurse or find the deepest child
        let current = declarator;
        while (current?.namedChildren.length) {
          const declaratorChild = current.namedChildren.find(
            (c) => c.type === "function_declarator" || c.type === "pointer_declarator"
          );
          if (!declaratorChild) {
            // Found the deepest declarator, get its name
            const nameNode = current.childForFieldName("declarator") || current;
            if (nameNode?.type === "identifier" || nameNode?.type === "function_declarator") {
              return nameNode.text;
            }
            break;
          }
          current = declaratorChild;
        }

        // Fallback: try direct text from declarator
        if (declarator) return declarator.text;
      }

      // Try direct name field
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || null;
    },

    getMethodName(node: Parser.SyntaxNode): string | null {
      // Methods are function_definitions inside class/struct
      return this.getFunctionName(node);
    }
  };

  labelingRules = {
    loopLabel(node: Parser.SyntaxNode): string {
      if (node.type === "for_statement") return "for (...)";
      if (node.type === "range_based_for_statement") {
        const decl = node.childForFieldName("declaration");
        const range = node.childForFieldName("right");
        return `for (${decl?.text || "x"} : ${range?.text || "..."})`;
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
        const expr = node.childForFieldName("condition");
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
