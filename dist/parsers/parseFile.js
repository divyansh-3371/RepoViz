"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFile = parseFile;
const fs_1 = __importDefault(require("fs"));
const parserRegistry_1 = require("./parserRegistry");
function parseFile(filePath) {
    const parser = (0, parserRegistry_1.getParserForFile)(filePath);
    if (!parser)
        return null;
    const code = fs_1.default.readFileSync(filePath, "utf8");
    const tree = parser.parse(code);
    return tree;
}
