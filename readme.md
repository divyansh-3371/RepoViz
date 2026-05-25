# RepoViz

<div align="center">

## Simplifying Codebase Comprehension Through Interactive Dependency Visualization

Multi-language repository analysis and interactive dependency visualization powered by AST parsing and graph-based architecture exploration.

</div>

---

# Overview

RepoViz is a multi-language codebase visualization tool that helps developers understand complex software architectures through interactive dependency graphs and file-level code flow analysis.

The system automatically analyzes repositories, extracts dependencies using AST-based parsing, and generates browser-native visualizations for architecture exploration, debugging, onboarding, and refactoring.

RepoViz supports both:
- Local repositories
- Public GitHub repositories

without requiring any configuration setup.

---

# Features

- Interactive dependency graph visualization
- File-level code flow visualization
- Multi-language repository analysis
- AST-based dependency extraction using Tree-sitter
- GitHub repository analysis via URL
- Local repository support
- Circular dependency detection
- Metrics dashboard
- Search and filtering
- Zero-configuration workflow
- JSON and HTML export support

---

# Supported Languages

RepoViz currently supports:

| Language | Extensions |
|---|---|
| JavaScript | `.js` |
| TypeScript | `.ts` |
| JSX | `.jsx` |
| TSX | `.tsx` |
| Python | `.py` |
| Java | `.java` |
| Go | `.go` |
| Rust | `.rs` |
| C++ | `.cpp` |
| Ruby | `.rb` |

---

# Tech Stack

## Core Technologies

- TypeScript
- Node.js
- Express.js
- Tree-sitter
- vis.js

## Supporting Libraries

- simple-git
- fast-glob
- commander
- cors
- open

---

# System Workflow

```text
User Input
   ↓
Repository Loader
   ↓
File Scanner
   ↓
Language Detection
   ↓
Tree-sitter Parsing
   ↓
AST Generation
   ↓
Dependency Extraction
   ↓
Graph Builder
   ↓
Visualization Engine
   ↓
Interactive HTML Output
```

---

# Installation

## Clone the Repository

```bash
git clone https://github.com/divyansh-3371/RepoViz.git
cd RepoViz
```

## Install Dependencies

```bash
npm install
```

---

# Running RepoViz

## Start the Server

```bash
npm start
```

The application will start on:

```text
http://localhost:3001
```

---

# Usage

## Analyze a GitHub Repository

Paste a GitHub repository URL into the input field:

```text
https://github.com/user/repository
```

RepoViz will:
1. Shallow clone the repository
2. Parse source files
3. Extract dependencies
4. Build dependency graphs
5. Generate interactive visualization

---

## Analyze a Local Repository

Provide a local repository path:

### Windows

```text
C:/Projects/my-project
```

### Linux/macOS

```text
/home/user/project
```

---

# Visualization Features

## Dependency Graph

The dependency graph provides:

- Interactive node exploration
- Dependency highlighting
- Zoom and pan support
- Search and filtering
- File metadata inspection

### Nodes Represent
- Source files

### Edges Represent
- Import/dependency relationships

---

## File Flow Visualization

RepoViz also visualizes internal code structures such as:

- Functions
- Classes
- Loops
- Conditions
- Returns
- Exceptions
- Function calls

This enables developers to inspect internal file logic and control flow interactively.

---

# Metrics Generated

RepoViz computes architectural metrics including:

- Lines of Code (LOC)
- File size
- In-degree
- Out-degree
- Dependency counts
- Circular dependencies
- File type distribution

These metrics help identify:
- Critical modules
- Tightly coupled files
- Architectural bottlenecks

---

# Project Structure

```text
src/
├── cli/                 # Command-line interface
├── core/                # Graph construction & visualization
├── parsers/             # AST parsing and analysis
│   └── languages/       # Language profiles
├── server/              # Express server
└── utils/               # Utility functions
```

---

# Example Workflow

```bash
npm start
```

Open your browser:

```text
http://localhost:3001
```

Then:
1. Enter repository URL or local path
2. Start analysis
3. Explore dependency graph
4. Inspect file-level code flow
5. Export visualization

---

# Testing

RepoViz includes:
- Unit Testing
- Integration Testing
- Functional Testing
- Edge Case Testing

## Run Tests

```bash
npm test
```

## Test Results

| Metric | Value |
|---|---|
| Test Suites | 5 |
| Total Tests | 102 |
| Pass Rate | 100% |

---

# Key Design Goals

- Zero configuration
- Multi-language support
- Fast repository analysis
- Interactive exploration
- Browser-native visualization
- Lightweight architecture
- Local-first processing

---

# Current Limitations

- Static analysis only
- No runtime dependency tracing
- Dense visualization for extremely large repositories
- Dynamic imports may not always resolve completely
- Limited historical/version tracking

---

# Future Improvements

- Parallel processing
- Dynamic runtime analysis
- AI-powered querying
- Additional language support
- Graph clustering and grouping
- Cloud deployment
- Historical architecture evolution tracking

---

# Why RepoViz?

Modern developers spend most of their time understanding existing code rather than writing new functionality.

RepoViz reduces that cognitive overhead by automatically generating architectural insights from repositories with minimal setup.

It is especially useful for:
- Open-source contribution
- Developer onboarding
- Architecture analysis
- Refactoring
- Debugging
- Dependency inspection

---

# Contributors

- Phalak Bhatnagar
- Lakshya Veer Singh
- Divyansh Bansal

### Supervisor
- Dr. K Rajalakshmi

---

# License

This project is licensed under the MIT License.

---

# Screenshots

## Repository Input Interface

> Add screenshot here

```text
/docs/screenshots/input-ui.png
```

---

## Dependency Graph Visualization

> Add screenshot here

```text
/docs/screenshots/dependency-graph.png
```

---

## File Flow Visualization

> Add screenshot here

```text
/docs/screenshots/file-flow.png
```

---

# Repository Link

https://github.com/divyansh-3371/RepoViz

```