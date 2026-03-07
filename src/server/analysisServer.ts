import express, { Request, Response } from "express"
import cors from "cors"
import http from "http"
import fs from "fs"
import { analyzeFileStructure } from "../parsers/codeAnalyzer"

const app = express()
let PORT = 3001
const MAX_SOURCE_BYTES = 1024 * 1024

app.use(cors())
app.use(express.json())

function safeReadSource(filePath: string): string {
  const fileStat = fs.statSync(filePath)
  if (fileStat.size > MAX_SOURCE_BYTES) {
    throw new Error("File is too large to preview")
  }
  return fs.readFileSync(filePath, "utf8")
}

app.get("/api/analyze", (req: Request, res: Response) => {
  const filePath = req.query.file as string
  if (!filePath) {
    return res.status(400).json({ error: "file parameter is required" })
  }

  try {
    const structure = analyzeFileStructure(filePath)
    return res.json(structure)
  } catch (error) {
    console.error("Error analyzing file:", error)
    return res.status(500).json({
      error: "Failed to analyze file",
      message: error instanceof Error ? error.message : "Unknown error"
    })
  }
})

app.get("/api/source", (req: Request, res: Response) => {
  const filePath = req.query.file as string
  if (!filePath) {
    return res.status(400).json({ error: "file parameter is required" })
  }

  try {
    const content = safeReadSource(filePath)
    return res.json({ filePath, content })
  } catch (error) {
    return res.status(500).json({
      error: "Failed to read source file",
      message: error instanceof Error ? error.message : "Unknown error"
    })
  }
})

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" })
})

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(startPort, () => {
      const addressInfo = server.address()
      if (addressInfo && typeof addressInfo !== "string") {
        const port = addressInfo.port
        server.close()
        resolve(port)
      } else {
        reject(new Error("Could not determine port"))
      }
    })
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(findAvailablePort(startPort + 1))
      } else {
        reject(err)
      }
    })
  })
}

export async function startAnalysisServer(): Promise<number> {
  const availablePort = await findAvailablePort(PORT)
  PORT = availablePort

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`\nAnalysis server running at http://localhost:${PORT}`)
      console.log(
        `   API endpoint: http://localhost:${PORT}/api/analyze?file=<filepath>`
      )
      resolve(PORT)
    })
  })
}
