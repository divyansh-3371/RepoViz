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
exports.isGitHubUrl = isGitHubUrl;
exports.cloneGitHubRepo = cloneGitHubRepo;
exports.getRepoPath = getRepoPath;
const simple_git_1 = __importDefault(require("simple-git"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
async function isGitHubUrl(input) {
    return (input.startsWith("https://github.com/") ||
        input.startsWith("http://github.com/") ||
        input.startsWith("git@github.com:"));
}
async function cloneGitHubRepo(url, onTempDirCreated) {
    const tempDir = path.join(os.tmpdir(), `repo-visualizer-${Date.now()}`);
    if (onTempDirCreated) {
        onTempDirCreated(tempDir);
    }
    console.log(`Cloning repository from ${url}...`);
    const git = (0, simple_git_1.default)();
    try {
        await git.clone(url, tempDir, ["--depth", "1"]);
        console.log(`Repository cloned to temporary directory: ${tempDir}`);
    }
    catch (error) {
        throw new Error(`Failed to clone repository: ${error}`);
    }
    const cleanup = () => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log(`Cleaned up temporary directory: ${tempDir}`);
        }
    };
    return { tempDir, cleanup };
}
async function getRepoPath(input, onTempDirCreated) {
    const isGithub = await isGitHubUrl(input);
    if (isGithub) {
        const { tempDir, cleanup } = await cloneGitHubRepo(input, onTempDirCreated);
        return { repoPath: tempDir, cleanup };
    }
    // Local path
    if (!fs.existsSync(input)) {
        throw new Error(`Repository path does not exist: ${input}`);
    }
    return { repoPath: input };
}
