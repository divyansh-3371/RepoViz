import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import TypeScript = require("tree-sitter-typescript");

export function getParserForFile(filePath: string): Parser | null {
  const parser = new Parser();

  if (filePath.endsWith(".js")) {
    parser.setLanguage(JavaScript as unknown as Parser.Language);
    return parser;
  }

  if (filePath.endsWith(".ts")) {
    parser.setLanguage(TypeScript.typescript as unknown as Parser.Language);
    return parser;
  }

  if (filePath.endsWith(".tsx")) {
    parser.setLanguage(TypeScript.tsx as unknown as Parser.Language);
    return parser;
  }

  if (filePath.endsWith(".py")) {
    parser.setLanguage(Python as unknown as Parser.Language);
    return parser;
  }

  return null;
}
