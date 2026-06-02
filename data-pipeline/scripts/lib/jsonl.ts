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

// Append one JSON object as one line.
// This is how scrape/discovery runs stay audit-friendly over time.
export function appendJsonlRow(filePath: string, row: JsonlRow): void {
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`);
}
