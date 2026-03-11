"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = buildGraph;
const parseFile_1 = require("../parsers/parseFile");
const extractImports_1 = require("../parsers/extractImports");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function buildGraph(files) {
    const normalizedFileSet = new Set(files.map((file) => normalizePath(file)));
    const fileAliasMap = buildFileAliasMap(files);
    const nodes = [];
    const edges = [];
    for (const file of files) {
        const filePath = normalizePath(file);
        const extension = path_1.default.extname(filePath).toLowerCase();
        const stats = safeStat(filePath);
        const loc = safeCountLines(filePath);
        nodes.push({
            id: filePath,
            type: "file",
            extension,
            loc,
            sizeBytes: stats?.size,
            fileType: classifyFileType(filePath)
        });
        const tree = (0, parseFile_1.parseFile)(filePath);
        if (!tree)
            continue;
        const imports = (0, extractImports_1.extractImports)(tree);
        const fromDir = path_1.default.dirname(filePath);
        for (const imp of imports) {
            const resolvedTarget = resolveImportTarget(imp, fromDir, normalizedFileSet, fileAliasMap);
            edges.push({
                from: filePath,
                to: resolvedTarget,
                type: "import",
                isExternal: !normalizedFileSet.has(resolvedTarget)
            });
        }
    }
    return { nodes, edges: dedupeEdges(edges) };
}
function normalizePath(value) {
    return value.replace(/\\/g, "/");
}
function dedupeEdges(edges) {
    const seen = new Set();
    const deduped = [];
    for (const edge of edges) {
        const key = `${edge.from}->${edge.to}:${edge.type}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(edge);
    }
    return deduped;
}
function safeStat(filePath) {
    try {
        return fs_1.default.statSync(filePath);
    }
    catch {
        return null;
    }
}
function safeCountLines(filePath) {
    try {
        const content = fs_1.default.readFileSync(filePath, "utf8");
        if (!content)
            return 0;
        return content.split(/\r?\n/).length;
    }
    catch {
        return 0;
    }
}
function buildFileAliasMap(files) {
    const map = new Map();
    for (const file of files) {
        const normalized = normalizePath(file);
        const withoutExtension = normalized.replace(/\.[^/.]+$/, "");
        map.set(normalized, normalized);
        map.set(withoutExtension, normalized);
    }
    return map;
}
function resolveImportTarget(rawImport, fromDir, fileSet, aliasMap) {
    if (!rawImport)
        return rawImport;
    const cleanedImport = rawImport.split("?")[0].replace(/\\/g, "/");
    if (!cleanedImport.startsWith(".") && !cleanedImport.startsWith("/")) {
        return cleanedImport;
    }
    const absoluteBase = normalizePath(path_1.default.resolve(fromDir, cleanedImport));
    const candidates = [
        absoluteBase,
        `${absoluteBase}.js`,
        `${absoluteBase}.ts`,
        `${absoluteBase}.tsx`,
        `${absoluteBase}.jsx`,
        `${absoluteBase}.mjs`,
        `${absoluteBase}.cjs`,
        `${absoluteBase}.py`,
        `${absoluteBase}/index.js`,
        `${absoluteBase}/index.ts`,
        `${absoluteBase}/index.tsx`,
        `${absoluteBase}/index.jsx`,
        `${absoluteBase}/index.py`
    ];
    for (const candidate of candidates) {
        if (fileSet.has(candidate))
            return candidate;
        const aliasHit = aliasMap.get(candidate);
        if (aliasHit)
            return aliasHit;
    }
    return cleanedImport;
}
function classifyFileType(filePath) {
    const normalized = normalizePath(filePath).toLowerCase();
    const fileName = path_1.default.basename(normalized).toLowerCase();
    if (normalized.includes("/components/") ||
        fileName.endsWith(".jsx") ||
        fileName.endsWith(".tsx")) {
        return "component";
    }
    if (normalized.includes("/services/") ||
        fileName.includes("service") ||
        fileName.includes("api")) {
        return "service";
    }
    if (normalized.includes("/config/") ||
        fileName.includes("config") ||
        fileName.endsWith(".json")) {
        return "config";
    }
    if (normalized.includes("/pages/") || fileName.includes("page")) {
        return "page";
    }
    if (normalized.includes("/hooks/") || fileName.startsWith("use")) {
        return "hook";
    }
    if (normalized.includes("/utils/") || fileName.includes("util")) {
        return "utility";
    }
    return "other";
}
