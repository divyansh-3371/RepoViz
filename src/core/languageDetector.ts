import path from "path";
import { getLanguageRegistry } from "../parsers/parserRegistry";

/**
 * Detect file extensions in a set of files that are supported by the language registry
 *
 * @param files Array of file paths
 * @returns Array of supported file extensions found
 */
export function detectExtensions(files: string[]): string[] {
  const registry = getLanguageRegistry();
  const supportedExtensions = registry.getSupportedExtensions();
  const foundExtensions = new Set<string>();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext && supportedExtensions.has(ext)) {
      foundExtensions.add(ext);
    }
  }

  return Array.from(foundExtensions).sort();
}

/**
 * Get all supported file extensions from the language registry
 *
 * @returns Array of all supported extensions
 */
export function getSupportedExtensions(): string[] {
  const registry = getLanguageRegistry();
  return Array.from(registry.getSupportedExtensions()).sort();
}

/**
 * Check if a file extension is supported
 *
 * @param extension File extension (with or without leading dot)
 * @returns true if the extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  const registry = getLanguageRegistry();
  const normalized = extension.startsWith(".") ? extension : `.${extension}`;
  return registry.isExtensionSupported(normalized);
}