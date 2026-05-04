import Parser from "tree-sitter";
import { LanguageProfile } from "./languageProfile";

/**
 * Result of getParserForFile - contains both the parser instance and its language profile
 */
export interface ParserResult {
  parser: Parser;
  profile: LanguageProfile;
}

export class LanguageRegistry {
  /** Map from language id to profile (e.g., "java" → JavaProfile instance) */
  private profiles: Map<string, LanguageProfile> = new Map();

  /** Map from file extension to language id (e.g., ".java" → "java") */
  private extensionMap: Map<string, string> = new Map();

  /** Cached Parser instances per language (reuse to avoid recreating) */
  private parserCache: Map<string, Parser> = new Map();

  /** Whether modules have been dynamically loaded yet */
  private modulesLoaded: boolean = false;

  /**
   * Register a language profile with the registry
   * @param profile The LanguageProfile to register
   */
  public register(profile: LanguageProfile): void {
    this.profiles.set(profile.id, profile);

    // Map all file extensions to this language
    for (const ext of profile.fileExtensions) {
      this.extensionMap.set(ext, profile.id);
    }
  }

  /**
   * Get a parser for a specific file
   * Returns both the Parser instance and its LanguageProfile
   *
   * @param filePath Path to the file to parse
   * @returns {parser, profile} if supported, null if unsupported extension
   */
  public getParserForFile(filePath: string): ParserResult | null {
    // Extract file extension (case-insensitive)
    const dotIndex = filePath.lastIndexOf(".");
    if (dotIndex === -1) {
      return null; // No extension
    }

    const extension = filePath.substring(dotIndex).toLowerCase();

    // Look up language id from extension
    const languageId = this.extensionMap.get(extension);
    if (!languageId) {
      return null; // Extension not supported
    }

    const profile = this.profiles.get(languageId);
    if (!profile) {
      return null; // Language id not found (shouldn't happen if registry is consistent)
    }

    // Get or create parser instance for this language
    let parser = this.parserCache.get(languageId);
    if (!parser) {
      parser = new Parser();
      this.parserCache.set(languageId, parser);
    }

    // Load language module and set it on the parser
    this.setLanguageOnParser(parser, profile);

    return { parser, profile };
  }

  /**
   * Get all registered profiles
   */
  public getProfiles(): LanguageProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get all supported file extensions
   */
  public getSupportedExtensions(): Set<string> {
    return new Set(this.extensionMap.keys());
  }

  /**
   * Get profile for a specific language id
   */
  public getProfile(languageId: string): LanguageProfile | undefined {
    return this.profiles.get(languageId);
  }

  /**
   * Check if an extension is supported
   */
  public isExtensionSupported(extension: string): boolean {
    return this.extensionMap.has(extension.toLowerCase());
  }

  /**
   * Get the language id for a file extension
   */
  public getLanguageIdForExtension(extension: string): string | undefined {
    return this.extensionMap.get(extension.toLowerCase());
  }

  /**
   * Validate all profiles in the registry
   * Checks for missing dependencies, invalid configurations, etc.
   *
   * @returns {valid: boolean, errors: string[]}
   */
  public validateProfiles(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const profile of this.profiles.values()) {
      // Check that profile has required fields
      if (!profile.id || !profile.id.trim()) {
        errors.push(`Profile missing id`);
      }

      if (!profile.name || !profile.name.trim()) {
        errors.push(`Profile "${profile.id}" missing name`);
      }

      if (!profile.fileExtensions || profile.fileExtensions.length === 0) {
        errors.push(`Profile "${profile.id}" has no file extensions`);
      }

      if (!profile.treeParserModule || !profile.treeParserModule.trim()) {
        errors.push(`Profile "${profile.id}" missing treeParserModule`);
      }

      // Check that AST node mapping has required sections
      if (!profile.astNodes) {
        errors.push(`Profile "${profile.id}" missing astNodes mapping`);
        continue;
      }

      if (!profile.astNodes.scopes) {
        errors.push(`Profile "${profile.id}" missing astNodes.scopes`);
      }
      if (!profile.astNodes.controlFlow) {
        errors.push(`Profile "${profile.id}" missing astNodes.controlFlow`);
      }
      if (!profile.astNodes.block) {
        errors.push(`Profile "${profile.id}" missing astNodes.block`);
      }

      // Check that name extraction has required functions
      if (!profile.nameExtraction) {
        errors.push(`Profile "${profile.id}" missing nameExtraction functions`);
      } else {
        if (typeof profile.nameExtraction.getClassName !== "function") {
          errors.push(`Profile "${profile.id}" missing getClassName function`);
        }
        if (typeof profile.nameExtraction.getFunctionName !== "function") {
          errors.push(`Profile "${profile.id}" missing getFunctionName function`);
        }
        if (typeof profile.nameExtraction.getMethodName !== "function") {
          errors.push(`Profile "${profile.id}" missing getMethodName function`);
        }
      }

      // Check labeling rules
      if (!profile.labelingRules) {
        errors.push(`Profile "${profile.id}" missing labelingRules`);
      } else {
        if (typeof profile.labelingRules.loopLabel !== "function") {
          errors.push(`Profile "${profile.id}" missing loopLabel function`);
        }
        if (typeof profile.labelingRules.conditionLabel !== "function") {
          errors.push(`Profile "${profile.id}" missing conditionLabel function`);
        }
      }

      // Check features
      if (!profile.features) {
        errors.push(`Profile "${profile.id}" missing features`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load language module and set it on parser
   * Uses require() with try/catch to handle missing packages gracefully
   *
   * @private
   */
  private setLanguageOnParser(parser: Parser, profile: LanguageProfile): void {
    try {
      // Dynamically require the tree-sitter language package
      // e.g., require("tree-sitter-java") returns the language module
      const languageModule = require(profile.treeParserModule);

      // Handle different export styles:
      // - Most: default export is the language
      // - Some: .typescript for TypeScript, .tsx for TSX
      // - Some: require additional field selection
      let language = languageModule.default || languageModule;

      // Special case: tree-sitter-typescript exports {typescript, tsx}
      if (profile.id === "typescript") {
        language = languageModule.typescript;
      } else if (profile.id === "jsx" || profile.id === "tsx") {
        language = languageModule.tsx;
      }

      // Set the language on the parser
      parser.setLanguage(language as any);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error";

      throw new Error(
        `Failed to load language module for "${profile.id}" (${profile.treeParserModule}): ${errorMessage}. ` +
        `Make sure it's installed: npm install ${profile.treeParserModule}`
      );
    }
  }
}

/**
 * Global registry instance
 * Should be initialized at application startup with all supported languages
 */
export const globalLanguageRegistry = new LanguageRegistry();
