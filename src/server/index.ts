import { startAnalysisServer } from "./analysisServer"

startAnalysisServer()
  .then((port) => {
    const url = `http://localhost:${port}`
    console.log(`Server is running at ${url}`)
    console.log(`Open this URL in your browser to use the visualizer`)
  })
  .catch((error) => {
    console.error("Failed to start server:", error)
    process.exit(1)
  })
