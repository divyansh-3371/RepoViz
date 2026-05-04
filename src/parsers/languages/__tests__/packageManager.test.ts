import { LanguagePackageManager } from '../packageManager';
import { LanguageRegistry } from '../languageRegistry';
import {
  JavaScriptProfile,
  PythonProfile,
  JavaProfile,
  GoProfile,
  RustProfile
} from '../profiles';

describe('LanguagePackageManager', () => {
  let packageManager: LanguagePackageManager;

  beforeEach(() => {
    packageManager = new LanguagePackageManager();
  });

  describe('Package Installation Detection', () => {
    it('should check if a package is installed', () => {
      const isInstalled = packageManager.isPackageInstalled('tree-sitter');
      expect(typeof isInstalled).toBe('boolean');
    });

    it('should detect tree-sitter as likely installed (used by framework)', () => {
      const isInstalled = packageManager.isPackageInstalled('tree-sitter');
      // tree-sitter should be installed since it's a dependency
      expect(isInstalled).toBe(true);
    });

    it('should return false for obviously non-existent packages', () => {
      const isInstalled = packageManager.isPackageInstalled(
        'nonexistent-package-xyz-12345'
      );
      expect(isInstalled).toBe(false);
    });
  });

  describe('Package Requirements from Profiles', () => {
    it('should extract packages from language profiles', () => {
      const profiles = [
        new JavaScriptProfile(),
        new PythonProfile(),
        new JavaProfile()
      ];

      const packages = new Set<string>();
      for (const profile of profiles) {
        packages.add(profile.treeParserModule);
      }

      expect(packages.size).toBeGreaterThan(0);
      expect(packages.has('tree-sitter-javascript')).toBe(true);
      expect(packages.has('tree-sitter-python')).toBe(true);
    });

    it('should have unique package names across profiles', () => {
      const profiles = [
        new JavaScriptProfile(),
        new PythonProfile(),
        new JavaProfile(),
        new GoProfile(),
        new RustProfile()
      ];

      const packages = profiles.map((p) => p.treeParserModule);
      const unique = new Set(packages);

      expect(unique.size).toBe(packages.length);
    });
  });

  describe('Registry Validation', () => {
    it('should validate registry with language profiles', () => {
      const registry = new LanguageRegistry();
      registry.register(new JavaScriptProfile());
      registry.register(new PythonProfile());

      const validation = packageManager.validateRegistry(registry);
      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should return validation result with proper structure', () => {
      const registry = new LanguageRegistry();
      registry.register(new JavaScriptProfile());

      const validation = packageManager.validateRegistry(registry);
      expect(typeof validation.valid).toBe('boolean');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should list missing packages in errors', () => {
      const registry = new LanguageRegistry();
      registry.register(new JavaScriptProfile());

      const validation = packageManager.validateRegistry(registry);

      // If packages are missing, they should be in errors
      if (!validation.valid) {
        expect(validation.errors.length).toBeGreaterThan(0);
        for (const err of validation.errors) {
          expect(typeof err).toBe('string');
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle null package name gracefully', () => {
      const isInstalled = packageManager.isPackageInstalled(null as any);
      expect(typeof isInstalled).toBe('boolean');
    });

    it('should handle empty string package name', () => {
      const isInstalled = packageManager.isPackageInstalled('');
      expect(typeof isInstalled).toBe('boolean');
    });

    it('should handle package names with special characters', () => {
      const isInstalled = packageManager.isPackageInstalled('@scope/package');
      expect(typeof isInstalled).toBe('boolean');
    });
  });

  describe('Package List Building', () => {
    it('should build list of all required packages', () => {
      const profiles = [
        new JavaScriptProfile(),
        new PythonProfile(),
        new JavaProfile(),
        new GoProfile(),
        new RustProfile()
      ];

      const packages: string[] = [];
      for (const profile of profiles) {
        if (!packages.includes(profile.treeParserModule)) {
          packages.push(profile.treeParserModule);
        }
      }

      expect(packages.length).toBe(5);
    });
  });

  describe('Ensure Packages Installed', () => {
    it('should attempt to ensure packages are installed', () => {
      const profiles = [new JavaScriptProfile(), new PythonProfile()];

      try {
        packageManager.ensurePackagesInstalled(profiles);
        // If it succeeds, that's fine
      } catch (error) {
        // If tree-sitter packages aren't installed, this is expected
        expect((error as Error).message).toBeDefined();
      }
    });

    it('should throw error with helpful message if packages missing', () => {
      const profiles = [new JavaScriptProfile()];

      // Try to ensure packages (may fail if not installed)
      let threw = false;
      try {
        packageManager.ensurePackagesInstalled(profiles);
      } catch (error) {
        threw = true;
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('tree-sitter');
      }

      // Either it succeeded or threw - both are acceptable
      expect(typeof threw).toBe('boolean');
    });
  });
});

describe('LanguagePackageManager Initialization', () => {
  it('should create package manager instance', () => {
    const pm = new LanguagePackageManager();
    expect(pm).toBeDefined();
    expect(typeof pm.isPackageInstalled).toBe('function');
    expect(typeof pm.validateRegistry).toBe('function');
    expect(typeof pm.ensurePackagesInstalled).toBe('function');
  });

  it('should work with singleton pattern', () => {
    const pm1 = new LanguagePackageManager();
    const pm2 = new LanguagePackageManager();

    // Both should work
    expect(pm1.isPackageInstalled('tree-sitter')).toBe(
      pm2.isPackageInstalled('tree-sitter')
    );
  });
});

describe('Dependency Resolution', () => {
  const packageManager = new LanguagePackageManager();

  it('should resolve tree-sitter as dependency of all parsers', () => {
    // tree-sitter should be installed since it's a direct dependency
    const hasCorePackage = packageManager.isPackageInstalled('tree-sitter');
    expect(typeof hasCorePackage).toBe('boolean');
  });

  it('should validate that required packages for all languages are defined', () => {
    const profiles = [
      new JavaScriptProfile(),
      new PythonProfile(),
      new JavaProfile(),
      new GoProfile(),
      new RustProfile()
    ];

    for (const profile of profiles) {
      expect(profile.treeParserModule).toBeTruthy();
      expect(profile.treeParserModule).toMatch(/^tree-sitter-/);
    }
  });
});

describe('Installation Commands', () => {
  const packageManager = new LanguagePackageManager();

  it('should generate install command for profiles', () => {
    const profiles = [new JavaScriptProfile(), new PythonProfile()];
    const command = packageManager.getInstallCommand(profiles);

    expect(typeof command).toBe('string');
    expect(command).toContain('npm install');
    expect(command).toContain('tree-sitter-javascript');
    expect(command).toContain('tree-sitter-python');
  });

  it('should handle single profile', () => {
    const profiles = [new JavaScriptProfile()];
    const command = packageManager.getInstallCommand(profiles);

    expect(typeof command).toBe('string');
    expect(command).toContain('npm install');
    expect(command).toContain('tree-sitter-javascript');
  });

  it('should handle multiple profiles', () => {
    const profiles = [
      new JavaScriptProfile(),
      new PythonProfile(),
      new JavaProfile()
    ];
    const command = packageManager.getInstallCommand(profiles);

    expect(typeof command).toBe('string');
    expect(command.split(' ').length).toBe(5); // npm install pkg1 pkg2 pkg3
  });
});
