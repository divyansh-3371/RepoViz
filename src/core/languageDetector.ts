import path from "path";

export function detectExtensions(files: string[]) {
  const extensions = new Set<string>();

  for (const file of files) {
    extensions.add(path.extname(file));
  }

  return Array.from(extensions);
}