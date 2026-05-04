import { LanguageRegistry } from '../languageRegistry';
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
} from '../profiles';

describe('LanguageRegistry', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  describe('Profile Registration', () => {
    it('should register a single language profile', () => {
      const jsProfile = new JavaScriptProfile();
      registry.register(jsProfile);

      const result = registry.getParserForFile('test.js');
      expect(result).not.toBeNull();
      expect(result?.profile.id).toBe('javascript');
    });

    it('should register multiple profiles', () => {
      registry.register(new JavaScriptProfile());
      registry.register(new PythonProfile());
      registry.register(new JavaProfile());

      expect(registry.getParserForFile('test.js')).not.toBeNull();
      expect(registry.getParserForFile('test.py')).not.toBeNull();
      expect(registry.getParserForFile('test.java')).not.toBeNull();
    });

    it('should handle all 9 language profiles', () => {
      const profiles = [
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

      for (const profile of profiles) {
        registry.register(profile);
      }

      expect(registry.getParserForFile('test.js')).not.toBeNull();
      expect(registry.getParserForFile('test.ts')).not.toBeNull();
      expect(registry.getParserForFile('test.tsx')).not.toBeNull();
      expect(registry.getParserForFile('test.py')).not.toBeNull();
      expect(registry.getParserForFile('test.java')).not.toBeNull();
      expect(registry.getParserForFile('test.go')).not.toBeNull();
      expect(registry.getParserForFile('test.rs')).not.toBeNull();
      expect(registry.getParserForFile('test.cpp')).not.toBeNull();
      expect(registry.getParserForFile('test.rb')).not.toBeNull();
    });
  });

  describe('Extension Detection', () => {
    beforeEach(() => {
      registry.register(new JavaScriptProfile());
      registry.register(new TypeScriptProfile());
      registry.register(new PythonProfile());
    });

    it('should return supported extensions', () => {
      const extensions = registry.getSupportedExtensions();
      expect(extensions.has('.js')).toBe(true);
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.py')).toBe(true);
    });

    it('should return all extensions from all profiles', () => {
      const profiles = [
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

      const testRegistry = new LanguageRegistry();
      for (const profile of profiles) {
        testRegistry.register(profile);
      }

      const extensions = testRegistry.getSupportedExtensions();
      expect(extensions.size).toBeGreaterThanOrEqual(14); // At least 14 distinct extensions
      expect(extensions.has('.js')).toBe(true);
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.tsx')).toBe(true);
      expect(extensions.has('.py')).toBe(true);
      expect(extensions.has('.java')).toBe(true);
      expect(extensions.has('.go')).toBe(true);
      expect(extensions.has('.rs')).toBe(true);
      expect(extensions.has('.cpp')).toBe(true);
      expect(extensions.has('.rb')).toBe(true);
    });
  });

  describe('File Extension Matching', () => {
    beforeEach(() => {
      registry.register(new JavaScriptProfile());
      registry.register(new TypeScriptProfile());
      registry.register(new TSXProfile());
      registry.register(new PythonProfile());
    });

    it('should find correct profile by file path', () => {
      const jsResult = registry.getParserForFile('/path/to/file.js');
      expect(jsResult?.profile.id).toBe('javascript');

      const tsResult = registry.getParserForFile('/path/to/file.ts');
      expect(tsResult?.profile.id).toBe('typescript');

      const pyResult = registry.getParserForFile('/path/to/file.py');
      expect(pyResult?.profile.id).toBe('python');
    });

    it('should handle case-insensitive extensions', () => {
      const result = registry.getParserForFile('/path/to/file.JS');
      expect(result?.profile.id).toBe('javascript');
    });

    it('should return null for unknown extensions', () => {
      const result = registry.getParserForFile('/path/to/file.unknown');
      expect(result).toBeNull();
    });

    it('should handle multiple extensions for same language', () => {
      // TSX should work for .tsx files
      const result = registry.getParserForFile('/path/to/file.tsx');
      expect(result?.profile.id).toBe('tsx');
    });
  });

  describe('Profile Validation', () => {
    it('should validate valid profiles', () => {
      registry.register(new JavaScriptProfile());
      const validation = registry.validateProfiles();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should validate all 9 default profiles', () => {
      const profiles = [
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

      for (const profile of profiles) {
        registry.register(profile);
      }

      const validation = registry.validateProfiles();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('Duplicate Registration', () => {
    it('should handle duplicate registrations', () => {
      const jsProfile = new JavaScriptProfile();
      registry.register(jsProfile);
      registry.register(jsProfile); // Register again

      const result = registry.getParserForFile('test.js');
      expect(result?.profile.id).toBe('javascript');
    });
  });
});

describe('ALL_PROFILES Constant', () => {
  it('should contain all 9 profiles', () => {
    expect(ALL_PROFILES.length).toBe(9);
  });

  it('should include each language exactly once', () => {
    const ids = ALL_PROFILES.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(9);
  });

  it('should include all expected language IDs', () => {
    const ids = new Set(ALL_PROFILES.map((p) => p.id));
    expect(ids.has('javascript')).toBe(true);
    expect(ids.has('typescript')).toBe(true);
    expect(ids.has('tsx')).toBe(true);
    expect(ids.has('python')).toBe(true);
    expect(ids.has('java')).toBe(true);
    expect(ids.has('go')).toBe(true);
    expect(ids.has('rust')).toBe(true);
    expect(ids.has('cpp')).toBe(true);
    expect(ids.has('ruby')).toBe(true);
  });
});
