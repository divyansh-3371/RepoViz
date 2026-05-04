import { registerBuiltInImportHandlers } from "./extractImports"
import { initializeLanguageRegistry } from "./parserRegistry"
import { LanguageRegistry } from "./languages/languageRegistry"
import { packageManager } from "./languages/packageManager"
import { JavaScriptProfile, PythonProfile } from "./languages/profiles"

export function initializeEvaluationLanguages(): void {
  const registry = new LanguageRegistry()
  const profileInstances = [new JavaScriptProfile(), new PythonProfile()]

  for (const profile of profileInstances) {
    registry.register(profile)
  }

  const validation = registry.validateProfiles()
  if (!validation.valid) {
    throw new Error(
      `Evaluation language registry validation failed: ${validation.errors.join(", ")}`
    )
  }

  packageManager.ensurePackagesInstalled(profileInstances)
  registerBuiltInImportHandlers()
  initializeLanguageRegistry(registry)
}
