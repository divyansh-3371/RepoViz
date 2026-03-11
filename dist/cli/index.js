#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fileScanner_1 = require("../core/fileScanner");
const languageDetector_1 = require("../core/languageDetector");
const graphBuilder_1 = require("../core/graphBuilder");
const githubHandler_1 = require("../core/githubHandler");
const visualizer_1 = require("../core/visualizer");
const analysisServer_1 = require("../server/analysisServer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const open_1 = __importDefault(require("open"));
const program = new commander_1.Command();
program
    .argument("<repoPath>", "Path to repository or GitHub URL")
    .option("-o, --output <path>", "Output file path for graph (default: graph.json)")
    .action(async (input, options) => {
    let repoPath;
    let cleanup;
    let serverPort;
    // Track directories that need to be cleaned up
    const tempDirsToClean = [];
    let cleaned = false;
    const runCleanup = () => {
        if (cleaned) {
            return;
        }
        cleaned = true;
        // Clean up dynamic temp directories
        for (const dir of tempDirsToClean) {
            try {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                    console.log(`Cleaned up temporary directory: ${dir}`);
                }
            }
            catch (error) {
                console.error(`Failed to clean up directory ${dir}:`, error instanceof Error ? error.message : error);
            }
        }
        // Run any additionally provided cleanup
        if (cleanup) {
            try {
                // Temporarily disable the console.log from the original cleanup inside githubHandler.ts
                // as we might have already cleaned it above. The inner cleanup checks fs.existsSync.
                cleanup();
            }
            catch (error) {
                console.error("Cleanup failed:", error instanceof Error ? error.message : error);
            }
        }
    };
    const handleSignal = (signal) => {
        console.log(`\nReceived ${signal}. Cleaning up...`);
        runCleanup();
        process.exit(0);
    };
    // Register handlers right away
    process.on("exit", runCleanup);
    process.on("SIGINT", () => handleSignal("SIGINT"));
    process.on("SIGTERM", () => handleSignal("SIGTERM"));
    process.on("SIGHUP", () => handleSignal("SIGHUP"));
    process.on("uncaughtException", (error) => {
        console.error("Uncaught exception:", error);
        runCleanup();
        process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled rejection:", reason);
        runCleanup();
        process.exit(1);
    });
    try {
        // Start analysis server
        console.log("Starting analysis server...");
        serverPort = await (0, analysisServer_1.startAnalysisServer)();
        // Get the actual repo path (clone if GitHub URL)
        const result = await (0, githubHandler_1.getRepoPath)(input, (dir) => {
            tempDirsToClean.push(dir);
        });
        repoPath = result.repoPath;
        cleanup = result.cleanup;
        console.log("Scanning repository...");
        const files = await (0, fileScanner_1.scanRepository)(repoPath);
        console.log("Files detected:", files.length);
        const extensions = (0, languageDetector_1.detectExtensions)(files);
        console.log("Languages:", extensions);
        console.log("Building dependency graph...");
        const graph = (0, graphBuilder_1.buildGraph)(files);
        console.log("Nodes:", graph.nodes.length);
        console.log("Edges:", graph.edges.length);
        // Save graph to file
        const outputPath = options.output || "graph.json";
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
        console.log(`Graph saved to: ${outputPath}`);
        // Generate visualization with server port
        const htmlPath = (0, visualizer_1.generateVisualization)(graph, outputPath, serverPort);
        console.log("Opening visualization in browser...");
        await (0, open_1.default)(htmlPath);
        // Keep server running
        console.log("\n✅ Visualization ready! The analysis server will continue running.");
        console.log("Close this terminal to stop the server.\n");
    }
    catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        runCleanup();
        process.exit(1);
    }
});
program.parse();
