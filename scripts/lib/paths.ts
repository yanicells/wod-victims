import path from "node:path";

// All package scripts are meant to run from the repo root.
// This helper keeps path building consistent across scripts.
export function fromRoot(...parts: string[]): string {
  return path.join(process.cwd(), ...parts);
}

