import { ASTNodeMapper } from '../astNodeMapper';
import {
  JavaScriptProfile,
  PythonProfile,
  JavaProfile,
  RustProfile,
  CppProfile
} from '../profiles';
import Parser from 'tree-sitter';

// Mock SyntaxNode for testing
const mockNode = (type: string, fieldName: string = 'name'): any => ({
  type,
  childForFieldName: (name: string) => (name === fieldName ? { text: 'testName' } : null),
  namedChildren: [],
  parent: null
});

describe('ASTNodeMapper', () => {
  describe('Scope Detection', () => {
    it('should detect class definitions in JavaScript', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const classNode = mockNode('class_declaration');
      expect(mapper.isClassDefinition(classNode)).toBe(true);
    });

    it('should detect function definitions in JavaScript', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const funcNode = mockNode('function_declaration');
      expect(mapper.isFunctionDefinition(funcNode)).toBe(true);

      const arrowNode = mockNode('arrow_function');
      expect(mapper.isFunctionDefinition(arrowNode)).toBe(true);
    });

    it('should detect class definitions in Java', () => {
      const profile = new JavaProfile();
      const mapper = new ASTNodeMapper(profile);

      const classNode = mockNode('class_declaration');
      expect(mapper.isClassDefinition(classNode)).toBe(true);

      const interfaceNode = mockNode('interface_declaration');
      expect(mapper.isClassDefinition(interfaceNode)).toBe(true);
    });

    it('should detect method definitions', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const methodNode = mockNode('method_definition');
      expect(mapper.isMethodDefinition(methodNode)).toBe(true);
    });

    it('should return false for non-matching nodes', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const exprNode = mockNode('expression_statement');
      expect(mapper.isClassDefinition(exprNode)).toBe(false);
      expect(mapper.isFunctionDefinition(exprNode)).toBe(false);
    });
  });

  describe('Control Flow Detection', () => {
    it('should detect loop statements in JavaScript', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      expect(mapper.isLoopStatement(mockNode('for_statement'))).toBe(true);
      expect(mapper.isLoopStatement(mockNode('while_statement'))).toBe(true);
      expect(mapper.isLoopStatement(mockNode('do_statement'))).toBe(true);
    });

    it('should detect condition statements', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      expect(mapper.isConditionStatement(mockNode('if_statement'))).toBe(true);
      expect(mapper.isConditionStatement(mockNode('switch_statement'))).toBe(true);
    });

    it('should detect return statements', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      expect(mapper.isReturnStatement(mockNode('return_statement'))).toBe(true);
      expect(mapper.isReturnStatement(mockNode('expression_statement'))).toBe(false);
    });

    it('should detect throw/raise statements', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      expect(mapper.isThrowStatement(mockNode('throw_statement'))).toBe(true);

      const pythonMapper = new ASTNodeMapper(new PythonProfile());
      expect(pythonMapper.isThrowStatement(mockNode('raise_statement'))).toBe(true);
    });

    it('should detect unique loop statements per language', () => {
      // Python doesn't have do-while
      const pythonMapper = new ASTNodeMapper(new PythonProfile());
      expect(pythonMapper.isLoopStatement(mockNode('while_statement'))).toBe(true);
      expect(pythonMapper.isLoopStatement(mockNode('for_statement'))).toBe(true);

      // Rust has loop_expression
      const rustMapper = new ASTNodeMapper(new RustProfile());
      expect(rustMapper.isLoopStatement(mockNode('loop_expression'))).toBe(true);
    });
  });

  describe('Block Navigation', () => {
    it('should identify block nodes', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const blockNode = mockNode('block');
      expect(mapper.isBlock(blockNode)).toBe(true);
    });

    it('should identify C++ compound_statement as block', () => {
      const profile = new CppProfile();
      const mapper = new ASTNodeMapper(profile);

      const compoundNode = mockNode('compound_statement');
      expect(mapper.isBlock(compoundNode)).toBe(true);
    });

    it('should identify statement types within blocks', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      expect(mapper.isStatementType(mockNode('expression_statement'))).toBe(true);
      expect(mapper.isStatementType(mockNode('if_statement'))).toBe(true);
      expect(mapper.isStatementType(mockNode('return_statement'))).toBe(true);
    });
  });

  describe('Name Extraction', () => {
    it('should extract class names', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const node = {
        type: 'class_declaration',
        childForFieldName: (name: string) => (name === 'name' ? { text: 'MyClass' } : null)
      };

      const name = mapper.getClassName(node as any);
      expect(name).toBe('MyClass');
    });

    it('should extract function names', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const node = {
        type: 'function_declaration',
        childForFieldName: (name: string) => (name === 'name' ? { text: 'myFunction' } : null)
      };

      const name = mapper.getFunctionName(node as any);
      expect(name).toBe('myFunction');
    });

    it('should handle null name nodes', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const node = {
        type: 'function_declaration',
        childForFieldName: () => null
      };

      const name = mapper.getFunctionName(node as any);
      expect(name).toBeNull();
    });
  });

  describe('Control Flow Labeling', () => {
    it('should label for loops', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const node = mockNode('for_statement');
      const label = mapper.getLoopLabel(node);
      expect(label).toBeDefined();
      expect(typeof label).toBe('string');
    });

    it('should label if statements', () => {
      const profile = new JavaScriptProfile();
      const mapper = new ASTNodeMapper(profile);

      const node = mockNode('if_statement');
      const label = mapper.getConditionLabel(node);
      expect(label).toBeDefined();
      expect(typeof label).toBe('string');
    });

    it('should use profile-specific labels', () => {
      const jsMapper = new ASTNodeMapper(new JavaScriptProfile());
      const jsLabel = jsMapper.getLoopLabel(mockNode('for_statement'));

      const pythonMapper = new ASTNodeMapper(new PythonProfile());
      const pythonLabel = pythonMapper.getLoopLabel(mockNode('for_statement'));

      // Both should define labels (though they may differ in format)
      expect(jsLabel).toBeDefined();
      expect(pythonLabel).toBeDefined();
    });
  });

  describe('Feature Flags', () => {
    it('should identify regex fallback requirement', () => {
      const pythonMapper = new ASTNodeMapper(new PythonProfile());
      expect(pythonMapper.hasRegexFallback()).toBe(true);

      const jsMapper = new ASTNodeMapper(new JavaScriptProfile());
      expect(jsMapper.hasRegexFallback()).toBe(false);
    });

    it('should identify generics support', () => {
      const javaMapper = new ASTNodeMapper(new JavaProfile());
      expect(javaMapper.hasGenerics()).toBe(true);

      const jsMapper = new ASTNodeMapper(new JavaScriptProfile());
      expect(jsMapper.hasGenerics()).toBe(false);
    });

    it('should identify arrow function support', () => {
      const jsMapper = new ASTNodeMapper(new JavaScriptProfile());
      expect(jsMapper.supportsArrowFunctions()).toBe(true);
    });
  });

  describe('Language-Specific Variations', () => {
    it('should handle different exception throw types', () => {
      const jsMapper = new ASTNodeMapper(new JavaScriptProfile());
      expect(jsMapper.isThrowStatement(mockNode('throw_statement'))).toBe(true);

      const pythonMapper = new ASTNodeMapper(new PythonProfile());
      expect(pythonMapper.isThrowStatement(mockNode('raise_statement'))).toBe(true);
    });

    it('should handle different loop types per language', () => {
      // Java has enhanced_for_statement
      const javaMapper = new ASTNodeMapper(new JavaProfile());
      expect(javaMapper.isLoopStatement(mockNode('enhanced_for_statement'))).toBe(true);

      // C++ has different loop variations
      const cppMapper = new ASTNodeMapper(new CppProfile());
      expect(cppMapper.isLoopStatement(mockNode('for_statement'))).toBe(true);
    });

    it('should handle language-specific match expressions', () => {
      const rustMapper = new ASTNodeMapper(new RustProfile());
      expect(rustMapper.isConditionStatement(mockNode('match_expression'))).toBe(true);
    });
  });

  describe('Consistency Across Languages', () => {
    const profiles = [
      new JavaScriptProfile(),
      new PythonProfile(),
      new JavaProfile(),
      new RustProfile(),
      new CppProfile()
    ];

    it('should have loop statement detection for all profiles', () => {
      for (const profile of profiles) {
        const mapper = new ASTNodeMapper(profile);
        const loopTypes = profile.astNodes.controlFlow.loopStatements;
        expect(loopTypes.length).toBeGreaterThan(0);
        // Should be able to detect at least one loop type
        expect(mapper.isLoopStatement(mockNode(loopTypes[0]))).toBe(true);
      }
    });

    it('should have condition statement detection for all profiles', () => {
      for (const profile of profiles) {
        const mapper = new ASTNodeMapper(profile);
        const conditionTypes = profile.astNodes.controlFlow.conditionStatements;
        expect(conditionTypes.length).toBeGreaterThan(0);
      }
    });

    it('should have class definition detection for all profiles', () => {
      for (const profile of profiles) {
        const mapper = new ASTNodeMapper(profile);
        const classTypes = profile.astNodes.scopes.classDefinition;
        expect(classTypes).toBeDefined();
      }
    });
  });
});
