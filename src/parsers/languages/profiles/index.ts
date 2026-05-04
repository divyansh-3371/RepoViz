/**
 * Language profiles for all supported languages
 * Export all profiles for easy registration with the language registry
 */

// Import all profiles
import { JavaScriptProfile } from "./javascriptProfile";
import { TypeScriptProfile } from "./typescriptProfile";
import { TSXProfile } from "./tsxProfile";
import { PythonProfile } from "./pythonProfile";
import { JavaProfile } from "./javaProfile";
import { GoProfile } from "./goProfile";
import { RustProfile } from "./rustProfile";
import { CppProfile } from "./cppProfile";
import { RubyProfile } from "./rubyProfile";

// Export all profiles for easy registration with the language registry

// Existing languages (4)
export { JavaScriptProfile } from "./javascriptProfile";
export { TypeScriptProfile } from "./typescriptProfile";
export { TSXProfile } from "./tsxProfile";
export { PythonProfile } from "./pythonProfile";

// New languages (5)
export { JavaProfile } from "./javaProfile";
export { GoProfile } from "./goProfile";
export { RustProfile } from "./rustProfile";
export { CppProfile } from "./cppProfile";
export { RubyProfile } from "./rubyProfile";

/**
 * Convenience array of all profiles
 * Used for initialization and validation
 */
export const ALL_PROFILES = [
  // Existing
  new JavaScriptProfile(),
  new TypeScriptProfile(),
  new TSXProfile(),
  new PythonProfile(),
  // New
  new JavaProfile(),
  new GoProfile(),
  new RustProfile(),
  new CppProfile(),
  new RubyProfile()
];
