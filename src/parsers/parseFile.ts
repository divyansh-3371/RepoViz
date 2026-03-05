import fs from "fs";
import { getParserForFile } from "./parserRegistry";

export function parseFile(filePath: string) {
  const parser = getParserForFile(filePath);
  if (!parser) return null;

  const code = fs.readFileSync(filePath, "utf8");
  const tree = parser.parse(code);

  return tree;
}