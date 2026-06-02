import fs from "node:fs";
import { parse } from "csv-parse/sync";

// Read only the first CSV row. We use this to confirm a tracker has the right columns.
export function readCsvHeader(filePath: string): string[] {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parse(text, { bom: true, to_line: 1 }) as string[][];

  return rows[0] ?? [];
}

// Read CSV rows as objects where keys are column names.
// Empty header-only CSV files simply return an empty list.
export function readCsvRows(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, "utf8");

  if (text.trim().length === 0) {
    return [];
  }

  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];
}

