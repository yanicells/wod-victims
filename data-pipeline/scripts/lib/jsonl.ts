import fs from "node:fs";

export type JsonlRow = Record<string, unknown>;

// JSONL means "one JSON object per line".
// Empty files are valid because some trackers start with no rows yet.
export function readJsonlRows(filePath: string): JsonlRow[] {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as JsonlRow;
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1} in ${filePath}: ${String(error)}`);
    }
  });
}

