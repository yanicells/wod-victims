import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// This file lives at data-pipeline/scripts/lib/paths.ts.
// Walking up three folders gives us the repo root, where /data and /docs live.
export const repoRoot = path.resolve(currentDirectory, "../../..");

// Build paths from the repo root even when a script runs inside data-pipeline.
export function fromRoot(...parts: string[]): string {
  return path.join(repoRoot, ...parts);
}
