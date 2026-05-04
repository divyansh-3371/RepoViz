import Parser from "tree-sitter";
import { LanguageProfile } from "./languages/languageProfile";
import { ImportHandler, BaseImportHandler, importHandlerRegistry } from "./importExtractors/importHandler";

/**
 * Extract imports/dependencies from a syntax tree for a specific language
 *
 * This uses language-specific handlers registered in the ImportHandlerRegistry.
 * Each language can define its own import extraction logic.
 *
 * @param tree The parsed syntax tree
 * @param profile The language profile (contains language-specific config)
 * @returns Array of imported module/package names
 */
export function extractImports(tree: Parser.Tree, profile: LanguageProfile): string[] {
  // Try to get language-specific handler
  const handler = importHandlerRegistry.getHandler(profile.id);
  if (handler) {
    return handler.extract(tree);
  }

  // Fall back to profile-based extraction for simple cases
  // This works for languages with standard import statements
  return extractImportsFromProfile(tree, profile);
}

/**
 * Default import extraction using profile configuration
 * Works for languages with simple, standard import statements
 *
 * For languages with complex import syntax, provide a custom ImportHandler instead.
 *
 * @private
 */
function extractImportsFromProfile(tree: Parser.Tree, profile: LanguageProfile): string[] {
  const imports = new Set<string>();
  const importNodeTypes = profile.imports.importStatementTypes;
  const fieldName = profile.imports.importFieldName || "source";

  function walk(node: Parser.SyntaxNode) {
    // Check if this is an import statement
    if (importNodeTypes.includes(node.type)) {
      // Try to get the import path from the specified field
      const sourceNode = node.childForFieldName(fieldName);
      if (sourceNode) {
        let moduleName = sourceNode.text;
        // Remove quotes if present
        if ((moduleName.startsWith('"') && moduleName.endsWith('"')) ||
            (moduleName.startsWith("'") && moduleName.endsWith("'"))) {
          moduleName = moduleName.slice(1, -1);
        }
        if (moduleName) {
          imports.add(moduleName);
        }
      }
    }

    // Apply custom extractors from profile
    if (profile.imports.extractors) {
      for (const rule of profile.imports.extractors) {
        const ruleNodeTypes = Array.isArray(rule.matchNodeType)
          ? rule.matchNodeType
          : [rule.matchNodeType];

        if (ruleNodeTypes.includes(node.type)) {
          const extracted = rule.extract(node);
          if (extracted) {
            extracted.forEach((imp) => imports.add(imp));
          }
        }
      }
    }

    // Continue walking the tree
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return Array.from(imports);
}

/**
 * Default import handler for JavaScript/TypeScript languages
 *
 * Handles:
 * - import statements (import x from "module")
 * - export statements (export from "module")
 * - require() calls
 * - dynamic import() calls
 */
class JavaScriptImportHandler extends BaseImportHandler {
  extract(tree: Parser.Tree): string[] {
    const imports = new Set<string>();

    function walk(node: Parser.SyntaxNode) {
      // Standard import/export statements
      if (
        node.type === "import_statement" ||
        node.type === "export_statement" ||
        node.type === "import_declaration"
      ) {
        const source = node.childForFieldName("source");
        if (source) {
          const moduleName = source.text.replace(/['"]/g, "");
          if (moduleName) {
            imports.add(moduleName);
          }
        }
      }

      // require("module") calls
      if (node.type === "call_expression") {
        const func = node.child(0);

        if (func && func.text === "require") {
          const args = node.childForFieldName("arguments");
          if (args && args.namedChildren.length > 0) {
            const moduleName = args.namedChildren[0].text.replace(/['"]/g, "");
            if (moduleName) {
              imports.add(moduleName);
            }
          }
        }

        // import("module") dynamic imports
        if (func && func.type === "import") {
          const args = node.childForFieldName("arguments");
          if (args && args.namedChildren.length > 0) {
            const moduleName = args.namedChildren[0].text.replace(/['"]/g, "");
            if (moduleName) {
              imports.add(moduleName);
            }
          }
        }
      }

      for (const child of node.children) {
        walk(child);
      }
    }

    walk(tree.rootNode);
    return Array.from(imports);
  }
}

/**
 * Register built-in import handlers
 * This is called during application initialization to set up handlers
 */
export function registerBuiltInImportHandlers(): void {
  // JavaScript handler works for JS, TS, and JSX/TSX
  const jsHandler = new JavaScriptImportHandler(
    // Create a minimal profile just to satisfy the interface
    // The actual handler implementation doesn't use it much
    {
      id: "javascript",
      name: "JavaScript",
      fileExtensions: [".js"],
      treeParserModule: "tree-sitter-javascript",
      astNodes: { scopes: {}, controlFlow: {}, block: {} } as any,
      imports: { importStatementTypes: [] },
      nameExtraction: { getClassName: () => null, getFunctionName: () => null, getMethodName: () => null },
      labelingRules: { loopLabel: () => "", conditionLabel: () => "" },
      features: { hasRegexFallback: false, supportsArrowFunctions: true, hasGenerics: false }
    }
  );

  importHandlerRegistry.register("javascript", jsHandler);
  importHandlerRegistry.register("typescript", jsHandler);
  importHandlerRegistry.register("jsx", jsHandler);
  importHandlerRegistry.register("tsx", jsHandler);
}
