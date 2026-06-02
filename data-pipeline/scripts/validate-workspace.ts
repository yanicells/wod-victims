import fs from "node:fs";
import { readCsvHeader, readCsvRows } from "./lib/csv.js";
import { readJsonlRows } from "./lib/jsonl.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles, expectedDirectories, expectedJsonlFiles } from "./schemas/workspace.js";

let failures = 0;

function pass(message: string): void {
  console.log(`OK  ${message}`);
}

function fail(message: string): void {
  failures += 1;
  console.error(`NO  ${message}`);
}

// This compares the exact CSV header order.
// Keeping the order stable makes later scripts and exports easier to read.
function sameColumns(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((column, index) => column === expected[index]);
}

for (const directory of expectedDirectories) {
  const fullPath = fromRoot(directory);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    pass(`directory exists: ${directory}`);
  } else {
    fail(`missing directory: ${directory}`);
  }
}

for (const csvFile of expectedCsvFiles) {
  const fullPath = fromRoot(csvFile.path);

  if (!fs.existsSync(fullPath)) {
    fail(`missing CSV file: ${csvFile.path}`);
    continue;
  }

  const header = readCsvHeader(fullPath);

  if (sameColumns(header, csvFile.columns)) {
    pass(`CSV header matches: ${csvFile.path}`);
  } else {
    fail(`CSV header mismatch: ${csvFile.path}`);
    console.error(`    expected: ${csvFile.columns.join(",")}`);
    console.error(`    actual:   ${header.join(",")}`);
    continue;
  }

  if (!csvFile.rowSchema) {
    continue;
  }

  const rows = readCsvRows(fullPath);
  rows.forEach((row, index) => {
    const result = csvFile.rowSchema?.safeParse(row);

    if (!result?.success) {
      fail(`invalid row ${index + 2} in ${csvFile.path}`);
      console.error(result?.error.format());
    }
  });
}

for (const jsonlFile of expectedJsonlFiles) {
  const fullPath = fromRoot(jsonlFile);

  if (!fs.existsSync(fullPath)) {
    fail(`missing JSONL file: ${jsonlFile}`);
    continue;
  }

  try {
    const rows = readJsonlRows(fullPath);
    pass(`JSONL is readable: ${jsonlFile} (${rows.length} rows)`);
  } catch (error) {
    fail(String(error));
  }
}

if (failures > 0) {
  console.error(`\nWorkspace validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("\nWorkspace validation passed.");

