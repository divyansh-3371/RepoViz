import Parser from "tree-sitter";
import { LanguageRegistry, ParserResult } from "./languages/languageRegistry";

/**
 * Backward-compatible function that wraps the new LanguageRegistry
 *
 * This maintains the original API while using the new registry under the hood.
 * New code should prefer using globalLanguageRegistry directly, but this
 * wrapper ensures existing code continues to work without modification.
 *
 * @param filePath Path to the file to parse
 * @returns Parser instance with language set, or null if not supported
 *
 * @deprecated Use globalLanguageRegistry.getParserForFile() instead for access to profiles
 */
export function getParserForFile(filePath: string): ParserResult | null {
  if (!globalLanguageRegistry) {
    throw new Error(
      "Language registry not initialized. Call initializeLanguageRegistry() at application startup."
    );
  }
  return globalLanguageRegistry.getParserForFile(filePath);
}

/**
 * Global language registry instance
 * This replaces the hardcoded language detection from the original parserRegistry.ts
 *
 * Instead of hard-coded if/else chains:
 *   if (filePath.endsWith(".js")) { parser.setLanguage(JavaScript); }
 *   if (filePath.endsWith(".ts")) { parser.setLanguage(TypeScript); }
 *   // etc...
 *
 * We use a registry pattern:
 *   globalLanguageRegistry.register(new JavaScriptProfile())
 *   globalLanguageRegistry.register(new TypeScriptProfile())
 *   // etc...
 *
 * And query it:
 *   const result = globalLanguageRegistry.getParserForFile(filePath)
 */
let globalLanguageRegistry: LanguageRegistry | null = null;

/**
 * Initialize the language registry with all supported languages
 * Must be called at application startup before parsing any files
 *
 * This function is called from the application entry point to set up
 * all language profiles and validate that dependencies are installed.
 *
 * @param registry Configured LanguageRegistry instance
 * @throws {Error} If registry validation fails or packages are missing
 */
export function initializeLanguageRegistry(registry: LanguageRegistry): void {
  // Validate all profiles
  const validation = registry.validateProfiles();
  if (!validation.valid) {
    throw new Error(
      `Language registry validation failed:\n${validation.errors.join("\n")}`
    );
  }

  globalLanguageRegistry = registry;
}

/**
 * Get the global language registry
 * Used to query supported languages, extensions, etc.
 *
 * @throws {Error} If registry has not been initialized
 */
export function getLanguageRegistry(): LanguageRegistry {
  if (!globalLanguageRegistry) {
    throw new Error(
      "Language registry not initialized. Call initializeLanguageRegistry() at application startup."
    );
  }
  return globalLanguageRegistry;
}
