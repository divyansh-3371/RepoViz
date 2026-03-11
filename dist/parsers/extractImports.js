"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImports = extractImports;
function extractImports(tree) {
    const imports = new Set();
    function walk(node) {
        // JavaScript / TypeScript imports
        if (node.type === "import_statement" ||
            node.type === "export_statement" ||
            node.type === "import_declaration") {
            const source = node.childForFieldName("source");
            if (source) {
                const moduleName = source.text.replace(/['"]/g, "");
                imports.add(moduleName);
            }
        }
        // require("module")
        if (node.type === "call_expression") {
            const func = node.child(0);
            if (func && func.text === "require") {
                const args = node.childForFieldName("arguments");
                if (args && args.namedChildren.length > 0) {
                    const moduleName = args.namedChildren[0].text.replace(/['"]/g, "");
                    imports.add(moduleName);
                }
            }
            // import("module")
            if (func && func.type === "import") {
                const args = node.childForFieldName("arguments");
                if (args && args.namedChildren.length > 0) {
                    const moduleName = args.namedChildren[0].text.replace(/['"]/g, "");
                    imports.add(moduleName);
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
