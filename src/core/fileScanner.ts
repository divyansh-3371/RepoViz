import fg from "fast-glob";

export async function scanRepository(repoPath: string) {
  return await fg(["**/*.js", "**/*.ts", "**/*.py"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules", ".git"]
  });
}