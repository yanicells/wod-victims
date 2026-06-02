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

// CSV values need escaping when they contain commas, quotes, or newlines.
// This tiny helper keeps tracker writing dependency-light and predictable.
function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export function writeCsvRows(filePath: string, columns: string[], rows: Record<string, string>[]): void {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column] ?? "")).join(","))
  ];

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}
