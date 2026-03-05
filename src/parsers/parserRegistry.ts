import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";

export function getParserForFile(filePath: string): Parser | null {
  const parser = new Parser();

  if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
    parser.setLanguage(JavaScript as unknown as Parser.Language);
    return parser;
  }

  if (filePath.endsWith(".py")) {
    parser.setLanguage(Python as unknown as Parser.Language);
    return parser;
  }

  return null;
}