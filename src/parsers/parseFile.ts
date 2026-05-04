import fs from "fs";
import Parser from "tree-sitter";
import { getParserForFile } from "./parserRegistry";
import { LanguageProfile } from "./languages/languageProfile";

/**
 * Result of parseFile - contains both syntax tree and language profile
 */
export interface ParseFileResult {
  tree: Parser.Tree;
  profile: LanguageProfile;
}

/**
 * Parse a file and return both its syntax tree and language profile
 *
 * @param filePath Path to the file to parse
 * @returns {tree, profile} if file is supported, null if not
 */
export function parseFile(filePath: string): ParseFileResult | null {
  const parserResult = getParserForFile(filePath);
  if (!parserResult) return null;

  try {
    const code = fs.readFileSync(filePath, "utf8");
    const tree = parserResult.parser.parse(code);

    return {
      tree,
      profile: parserResult.profile
    };
  } catch (error) {
    // File read errors are returned as null
    // (e.g., permission denied, file doesn't exist)
    return null;
  }
}