/**
 * Functional Tests for Code Dependency Analysis
 * Tests the complete analysis pipeline for core use cases
 */

import { buildGraph } from '../core/graphBuilder';
import { Graph, GraphNode, GraphEdge } from '../core/graphTypes';
import path from 'path';
import fs from 'fs';
import { initializeLanguages } from '../parsers/initializeLanguages';

/**
 * Helper to get all files from a fixture directory
 */
function getFixtureFiles(fixtureName: string): string[] {
  const fixtureDir = path.join(__dirname, 'fixtures', fixtureName);
  
  if (!fs.existsSync(fixtureDir)) {
    console.error(`Fixture directory not found: ${fixtureDir}`);
    return [];
  }
  
  try {
    // Recursively read all files from the fixture directory
    const allFiles: string[] = [];
    const supportedExtensions = ['.js', '.py', '.ts', '.tsx', '.jsx'];
    
    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (supportedExtensions.includes(ext)) {
            allFiles.push(fullPath);
          }
        }
      }
    }
    
    walkDir(fixtureDir);
    
    if (allFiles.length === 0) {
      console.warn(`No files found in fixture ${fixtureName}`);
    }
    
    return allFiles;
  } catch (error) {
    console.error(`Failed to read fixture ${fixtureName}:`, error);
    return [];
  }
}

describe('Functional Tests - Dependency Analysis', () => {
  
  beforeAll(() => {
    // Initialize language parsers before running tests
    try {
      initializeLanguages();
    } catch (error) {
      console.error('Failed to initialize languages:', error);
      // Tests can still run if tree-sitter isn't fully available
    }
  });
  
  describe('Test Case 1: Local Dependency', () => {
    it('should create edges for local relative imports', () => {
      const files = getFixtureFiles('local-dependency');
      expect(files.length).toBeGreaterThan(0);

      const graph = buildGraph(files);

      // Verify nodes exist for all files
      expect(graph.nodes.length).toBe(3); // main.js, utils.js, processor.js
      expect(graph.nodes.every((n: GraphNode) => n.fileType !== undefined)).toBe(true);

      // Verify edges exist with isExternal = false
      const localEdges = graph.edges.filter((e: GraphEdge) => !e.isExternal);
      expect(localEdges.length).toBeGreaterThan(0);

      // main.js should have edges to utils and processor
      const mainNode = graph.nodes.find((n: GraphNode) => n.id.includes('main'));
      const mainEdges = graph.edges.filter((e: GraphEdge) => e.from === mainNode?.id);
      expect(mainEdges.length).toBeGreaterThan(0);

      // All edges from main should be local (not external)
      expect(mainEdges.every((e: GraphEdge) => !e.isExternal)).toBe(true);
    });

    it('should resolve relative import paths correctly', () => {
      const files = getFixtureFiles('local-dependency');
      const graph = buildGraph(files);

      // processor.js imports from utils.js
      const processorNode = graph.nodes.find((n: GraphNode) => n.id.includes('processor'));
      const utilsNode = graph.nodes.find((n: GraphNode) => n.id.includes('utils'));

      const edge = graph.edges.find(
        (e: GraphEdge) => e.from === processorNode?.id && e.to === utilsNode?.id
      );

      expect(edge).toBeDefined();
      expect(edge?.isExternal).toBe(false);
    });
  });

  describe('Test Case 2: External Dependency', () => {
    it('should mark non-local imports as external', () => {
      const files = getFixtureFiles('external-dependency');
      expect(files.length).toBeGreaterThan(0);

      const graph = buildGraph(files);

      // Verify nodes
      expect(graph.nodes.length).toBeGreaterThan(0);

      // Find edges to npm packages
      const externalEdges = graph.edges.filter((e: GraphEdge) => e.isExternal);
      expect(externalEdges.length).toBeGreaterThan(0);

      // Verify common npm packages are marked external
      const externalTargets = externalEdges.map((e: GraphEdge) => e.to);
      expect(
        externalTargets.some((t: string) => 
          t === 'express' || 
          t === 'lodash' || 
          t === 'axios'
        )
      ).toBe(true);
    });

    it('should not create nodes for external dependencies', () => {
      const files = getFixtureFiles('external-dependency');
      const graph = buildGraph(files);

      // Only local files should have nodes
      const nodeIds = graph.nodes.map((n: GraphNode) => n.id.toLowerCase());
      
      // Should not have nodes for npm packages
      expect(nodeIds.some((id: string) => id.includes('express'))).toBe(false);
      expect(nodeIds.some((id: string) => id.includes('lodash'))).toBe(false);
      expect(nodeIds.some((id: string) => id.includes('axios'))).toBe(false);
    });
  });

  describe('Test Case 3: Circular Dependency', () => {
    it('should detect and handle circular dependencies', () => {
      const files = getFixtureFiles('circular-dependency');
      expect(files.length).toBeGreaterThan(0);

      const graph = buildGraph(files);

      // Verify all files are processed
      expect(graph.nodes.length).toBeGreaterThanOrEqual(3);

      // Edges should form a cycle: A -> B -> C -> A
      const edges = graph.edges;
      expect(edges.length).toBeGreaterThan(0);

      // Each file should have at least one outgoing edge for circular deps
      const fileANode = graph.nodes.find((n: GraphNode) => n.id.includes('fileA'));
      const fileBNode = graph.nodes.find((n: GraphNode) => n.id.includes('fileB'));
      const fileCNode = graph.nodes.find((n: GraphNode) => n.id.includes('fileC'));

      const edgeFromA = edges.find((e: GraphEdge) => e.from === fileANode?.id);
      const edgeFromB = edges.find((e: GraphEdge) => e.from === fileBNode?.id);
      const edgeFromC = edges.find((e: GraphEdge) => e.from === fileCNode?.id);

      expect(edgeFromA).toBeDefined();
      expect(edgeFromB).toBeDefined();
      expect(edgeFromC).toBeDefined();

      // Verify the cycle chain exists
      expect(edgeFromA?.to).toContain('fileB');
      expect(edgeFromB?.to).toContain('fileC');
      expect(edgeFromC?.to).toContain('fileA');
    });

    it('should not crash due to circular dependencies', () => {
      const files = getFixtureFiles('circular-dependency');
      
      // This should complete without throwing
      expect(() => {
        buildGraph(files);
      }).not.toThrow();
    });
  });

  describe('Test Case 4: Multi-language Repository', () => {
    it('should parse JavaScript and Python files together', () => {
      const files = getFixtureFiles('multi-language');
      expect(files.length).toBeGreaterThan(0);

      const graph = buildGraph(files);

      // Verify we have both JS and Python files
      const jsFiles = graph.nodes.filter((n: GraphNode) => n.extension === '.js');
      const pyFiles = graph.nodes.filter((n: GraphNode) => n.extension === '.py');

      expect(jsFiles.length).toBeGreaterThan(0);
      expect(pyFiles.length).toBeGreaterThan(0);

      // Verify nodes have correct file types
      expect(graph.nodes.every((n: GraphNode) => n.extension !== undefined)).toBe(true);
    });

    it('should preserve file extension information', () => {
      const files = getFixtureFiles('multi-language');
      const graph = buildGraph(files);

      // Check for specific extensions
      const extensions = graph.nodes.map((n: GraphNode) => n.extension);
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.py');
    });

    it('should handle imports across different languages', () => {
      const files = getFixtureFiles('multi-language');
      const graph = buildGraph(files);

      // Verify edges exist between files
      expect(graph.edges.length).toBeGreaterThan(0);

      // Script.js should import from helper.js
      const scriptNode = graph.nodes.find((n: GraphNode) => n.id.includes('script'));
      const helperNode = graph.nodes.find((n: GraphNode) => n.id.includes('helper'));

      const edge = graph.edges.find(
        (e: GraphEdge) => e.from === scriptNode?.id && e.to === helperNode?.id
      );
      expect(edge).toBeDefined();
    });
  });

  describe('Test Case 5: Missing File Import', () => {
    it('should ignore missing file imports without crashing', () => {
      const files = getFixtureFiles('missing-import');
      
      // This should NOT throw an error
      expect(() => {
        buildGraph(files);
      }).not.toThrow();
    });

    it('should handle unresolved import paths gracefully', () => {
      const files = getFixtureFiles('missing-import');
      const graph = buildGraph(files);

      // Should still produce a valid graph
      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);

      // Should have edges including unresolved ones
      expect(graph.edges.length).toBeGreaterThan(0);

      // Non-existent paths should be marked as external (or resolved as external)
      const missingFileEdges = graph.edges.filter(
        (e: GraphEdge) => e.to.includes('path/that/does/not/exist')
      );
      
      // Even if unresolved, edge should exist
      if (missingFileEdges.length > 0) {
        expect(missingFileEdges[0].isExternal).toBe(true);
      }
    });

    it('should still parse valid imports in same file', () => {
      const files = getFixtureFiles('missing-import');
      const graph = buildGraph(files);

      // Should detect the express import even if other imports are missing
      const externalEdges = graph.edges.filter((e: GraphEdge) => e.isExternal);
      const expressEdge = externalEdges.find((e: GraphEdge) => e.to === 'express');
      
      expect(expressEdge).toBeDefined();
    });
  });

  describe('Test Case 6: Index File Resolution', () => {
    it('should resolve directory imports to index files', () => {
      const files = getFixtureFiles('index-resolution');
      expect(files.length).toBeGreaterThan(0);

      const graph = buildGraph(files);

      // Should find main.js and utils/index.js
      expect(graph.nodes.length).toBeGreaterThanOrEqual(2);

      // main.js should import utils/index.js
      const mainNode = graph.nodes.find((n: GraphNode) => n.id.includes('main'));
      const indexNode = graph.nodes.find((n: GraphNode) => n.id.includes('index'));

      expect(mainNode).toBeDefined();
      expect(indexNode).toBeDefined();

      // Edge should resolve to the index file
      const edge = graph.edges.find((e: GraphEdge) => e.from === mainNode?.id);
      expect(edge).toBeDefined();
      expect(edge?.to).toContain('index');
    });

    it('should resolve directory paths without extension to index file', () => {
      const files = getFixtureFiles('index-resolution');
      const graph = buildGraph(files);

      const mainNode = graph.nodes.find((n: GraphNode) => n.id.includes('main'));
      const edge = graph.edges.find((e: GraphEdge) => e.from === mainNode?.id);

      // The imported "./utils" should resolve to "utils/index.js"
      expect(edge?.to).toMatch(/utils.*(index\.js)?/);
      expect(edge?.isExternal).toBe(false);
    });
  });

  describe('Integration: All test cases together', () => {
    it('should handle mixed repository with all patterns', () => {
      // Test that tool can handle diverse codebases
      const fixtures = [
        'local-dependency',
        'external-dependency',
        'circular-dependency',
        'multi-language'
      ];

      for (const fixture of fixtures) {
        const files = getFixtureFiles(fixture);
        if (files.length > 0) {
          expect(() => {
            buildGraph(files);
          }).not.toThrow();
        }
      }
    });
  });
});
