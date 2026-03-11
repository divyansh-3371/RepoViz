"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParserForFile = getParserForFile;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
function getParserForFile(filePath) {
    const parser = new tree_sitter_1.default();
    if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
        parser.setLanguage(tree_sitter_javascript_1.default);
        return parser;
    }
    if (filePath.endsWith(".py")) {
        parser.setLanguage(tree_sitter_python_1.default);
        return parser;
    }
    return null;
}
