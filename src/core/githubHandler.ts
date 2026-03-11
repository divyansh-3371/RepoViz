import simpleGit, { SimpleGit } from "simple-git"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export async function isGitHubUrl(input: string): Promise<boolean> {
  return (
    input.startsWith("https://github.com/") ||
    input.startsWith("http://github.com/") ||
    input.startsWith("git@github.com:")
  )
}

export async function cloneGitHubRepo(
  url: string,
  onTempDirCreated?: (dir: string) => void
): Promise<{ tempDir: string; cleanup: () => void }> {
  const tempDir = path.join(
    os.tmpdir(),
    `repo-visualizer-${Date.now()}`
  )

  if (onTempDirCreated) {
    onTempDirCreated(tempDir)
  }

  console.log(`Cloning repository from ${url}...`)

  const git: SimpleGit = simpleGit()

  try {
    await git.clone(url, tempDir, ["--depth", "1"])
    console.log(`Repository cloned to temporary directory: ${tempDir}`)
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error}`)
  }

  const cleanup = () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
      console.log(`Cleaned up temporary directory: ${tempDir}`)
    }
  }

  return { tempDir, cleanup }
}

export async function getRepoPath(
  input: string,
  onTempDirCreated?: (dir: string) => void
): Promise<{
  repoPath: string
  cleanup?: () => void
}> {
  const isGithub = await isGitHubUrl(input)

  if (isGithub) {
    const { tempDir, cleanup } = await cloneGitHubRepo(input, onTempDirCreated)
    return { repoPath: tempDir, cleanup }
  }

  // Local path
  if (!fs.existsSync(input)) {
    throw new Error(`Repository path does not exist: ${input}`)
  }

  return { repoPath: input }
}
