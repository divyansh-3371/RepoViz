import { startAnalysisServer } from "./analysisServer"
import open from "open"

startAnalysisServer()
  .then((port) => {
    const url = `http://localhost:${port}`
    console.log(`Opening landing page at ${url}`)
    return open(url)
  })
  .catch((error) => {
    console.error("Failed to start server:", error)
    process.exit(1)
  })
