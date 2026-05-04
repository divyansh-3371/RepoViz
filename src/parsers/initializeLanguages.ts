/**
 * Language Registry Initialization
 *
 * This module initializes the global language registry with all supported languages.
 * Must be called at application startup before parsing any files.
 *
 * Usage:
 *   import { initializeLanguages } from "./parsers/initializeLanguages"
 *   initializeLanguages()  // Call once at app startup
 */

import { LanguageRegistry } from "./languages/languageRegistry";
import { packageManager } from "./languages/packageManager";
import { importHandlerRegistry } from "./importExtractors/importHandler";
import { registerBuiltInImportHandlers } from "./extractImports";
import { initializeLanguageRegistry } from "./parserRegistry";

// Import all language profiles
import {
  JavaScriptProfile,
  TypeScriptProfile,
  TSXProfile,
  PythonProfile,
  JavaProfile,
  GoProfile,
  RustProfile,
  CppProfile,
  RubyProfile,
  ALL_PROFILES
} from "./languages/profiles";

/**
 * Initialize all language support
 * Creates the global registry, registers all profiles, and validates installation
 *
 * @throws {Error} If registry validation fails or required packages are missing
 */
export function initializeLanguages(): void {
  // Create the global registry
  const registry = new LanguageRegistry();

  // Register all language profiles
  // Note: profiles must be instantiated as classes
  const profileInstances = [
    new JavaScriptProfile(),
    new TypeScriptProfile(),
    new TSXProfile(),
    new PythonProfile(),
    new JavaProfile(),
    new GoProfile(),
    new RustProfile(),
    new CppProfile(),
    new RubyProfile()
  ];

  for (const profile of profileInstances) {
    registry.register(profile);
  }

  // Validate the registry
  const validation = registry.validateProfiles();
  if (!validation.valid) {
    console.error("Language registry validation failed:");
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error("Language registry validation failed. See errors above.");
  }

  // Validate that required tree-sitter packages are available
  try {
    packageManager.ensurePackagesInstalled(profileInstances);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }

  // Register built-in import handlers
  registerBuiltInImportHandlers();

  // Initialize the global registry
  initializeLanguageRegistry(registry);

  // Log successful initialization
  const extensions = registry.getSupportedExtensions();
  console.log(`Language registry initialized successfully!`);
  console.log(`Supported languages (${profileInstances.length}): ${profileInstances.map((p) => p.name).join(", ")}`);
  console.log(`Supported file extensions (${extensions.size}): ${Array.from(extensions).sort().join(", ")}`);
}

/**
 * Check if languages are initialized (useful for testing/debugging)
 */
export function areLanguagesInitialized(): boolean {
  try {
    // Try to access the global registry
    const registry = require("./parserRegistry").getLanguageRegistry();
    return registry !== null;
  } catch {
    return false;
  }
}

/**
 * Get initialization status with diagnostics
 * Useful for debugging initialization issues
 */
export function getInitializationStatus(): {
  initialized: boolean;
  supportedLanguages: number;
  supportedExtensions: Set<string>;
  missingPackages: string[];
} {
  const registry = new LanguageRegistry();

  const profileInstances = [
    new JavaScriptProfile(),
    new TypeScriptProfile(),
    new TSXProfile(),
    new PythonProfile(),
    new JavaProfile(),
    new GoProfile(),
    new RustProfile(),
    new CppProfile(),
    new RubyProfile()
  ];

  for (const profile of profileInstances) {
    registry.register(profile);
  }

  const missingPackages: string[] = [];
  for (const profile of profileInstances) {
    if (!packageManager.isPackageInstalled(profile.treeParserModule)) {
      missingPackages.push(profile.treeParserModule);
    }
  }

  return {
    initialized: missingPackages.length === 0,
    supportedLanguages: profileInstances.length,
    supportedExtensions: registry.getSupportedExtensions(),
    missingPackages
  };
}
