"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const analysisServer_1 = require("./analysisServer");
const open_1 = __importDefault(require("open"));
(0, analysisServer_1.startAnalysisServer)()
    .then((port) => {
    const url = `http://localhost:${port}`;
    console.log(`Opening landing page at ${url}`);
    return (0, open_1.default)(url);
})
    .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
