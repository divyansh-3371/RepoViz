"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanRepository = scanRepository;
const fast_glob_1 = __importDefault(require("fast-glob"));
async function scanRepository(repoPath) {
    return await (0, fast_glob_1.default)(["**/*.js", "**/*.ts", "**/*.py"], {
        cwd: repoPath,
        absolute: true,
        ignore: ["node_modules", ".git"]
    });
}
