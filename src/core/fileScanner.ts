import fg from "fast-glob";
import { getLanguageRegistry } from "../parsers/parserRegistry";

/**
 * Scan repository for supported source files
 * Uses the language registry to determine supported file extensions
 *
 * @param repoPath Path to the repository root
 * @returns Array of absolute file paths
 */
export async function scanRepository(repoPath: string): Promise<string[]> {
  // Get all supported file extensions from the language registry
  const registry = getLanguageRegistry();
  const extensions = registry.getSupportedExtensions();

  // Build glob patterns from supported extensions
  const patterns = Array.from(extensions).map((ext) => `**/*${ext}`);

  if (patterns.length === 0) {
    return []; // No supported extensions
  }

  return await fg(patterns, {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules", ".git", "dist", "build", ".next", "out"]
  });
}