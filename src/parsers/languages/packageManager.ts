import * as fs from "fs";
import * as path from "path";
import { LanguageProfile } from "./languageProfile";
import { LanguageRegistry } from "./languageRegistry";

export class LanguagePackageManager {
  /**
   * Check if a package is installed by looking for it in node_modules
   *
   * @param packageName The npm package name (e.g., "tree-sitter-java")
   * @returns true if the package exists in node_modules
   */
  public isPackageInstalled(packageName: string): boolean {
    try {
      // Try to resolve the package - if it succeeds, it's installed
      const resolved = require.resolve(packageName);
      return fs.existsSync(resolved);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the path to a package in node_modules
   *
   * @param packageName The npm package name
   * @returns Path if found, null if not installed
   */
  public getPackagePath(packageName: string): string | null {
    try {
      return require.resolve(packageName);
    } catch (error) {
      return null;
    }
  }

  /**
   * Ensure all packages for given profiles are installed
   * Throws an error with installation instructions if any are missing
   *
   * @param profiles Language profiles to check
   * @throws {Error} If any required packages are missing
   */
  public ensurePackagesInstalled(profiles: LanguageProfile[]): void {
    const missing: LanguageProfile[] = [];

    for (const profile of profiles) {
      if (!this.isPackageInstalled(profile.treeParserModule)) {
        missing.push(profile);
      }
    }

    if (missing.length > 0) {
      const packageNames = missing
        .map((p) => p.treeParserModule)
        .join(" ");

      const languages = missing
        .map((p) => `${p.name} (${p.id})`)
        .join(", ");

      throw new Error(
        `Missing required tree-sitter language packages for: ${languages}\n\n` +
        `Install them with:\n` +
        `  npm install ${packageNames}\n\n` +
        `Or add to package.json and run: npm install`
      );
    }
  }

  /**
   * Validate all profiles in a registry
   */
  public validateRegistry(registry: LanguageRegistry): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate profile structure
    const profileValidation = registry.validateProfiles();
    if (!profileValidation.valid) {
      errors.push(...profileValidation.errors);
    }

    // Validate packages
    const profiles = registry.getProfiles();
    for (const profile of profiles) {
      if (!this.isPackageInstalled(profile.treeParserModule)) {
        errors.push(
          `Package "${profile.treeParserModule}" (for ${profile.name}) is not installed. ` +
          `Run: npm install ${profile.treeParserModule}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get installation command for missing packages
   *
   * @param profiles Profiles with missing packages
   * @returns npm install command string
   */
  public getInstallCommand(profiles: LanguageProfile[]): string {
    const packages = profiles.map((p) => p.treeParserModule).join(" ");
    return `npm install ${packages}`;
  }

  /**
   * Configuration suggestions for adding new languages
   * Returns a checklist of what to install for a set of new profiles
   *
   * @param profiles New profiles to add
   * @returns Installation checklist
   */
  public getAddLanguageChecklist(profiles: LanguageProfile[]): string {
    const lines: string[] = [];
    lines.push("To add these languages, run:");
    lines.push(`  npm install ${profiles.map((p) => p.treeParserModule).join(" ")}`);
    lines.push("");
    lines.push("Or add to package.json:");
    for (const profile of profiles) {
      lines.push(`  "${profile.treeParserModule}": "^0.23.0"`);
    }
    return lines.join("\n");
  }

  /**
   * Get currently installed language packages (for debugging)
   *
   * @returns List of installed tree-sitter packages
   */
  public getInstalledPackages(): string[] {
    const nodeModulesPath = path.join(process.cwd(), "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
      return [];
    }

    try {
      const packages = fs.readdirSync(nodeModulesPath);
      const tsSitterPackages = packages.filter((pkg) =>
        pkg.startsWith("tree-sitter-")
      );
      return tsSitterPackages.sort();
    } catch (error) {
      return [];
    }
  }
}

/**
 * Global package manager instance
 * Used to validate that all languages have their dependencies installed
 */
export const packageManager = new LanguagePackageManager();
