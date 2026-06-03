import fs from "node:fs";
import path from "node:path";
import { readCsvRows, writeCsvRows } from "./lib/csv.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles } from "./schemas/workspace.js";

type Args = {
  limit: number;
};

type CsvRow = Record<string, string>;

const SOURCE_KEY = "paalam";

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : 20;

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("Invalid --limit; expected a positive number.");
  }

  return {
    limit
  };
}

function readJson(relativePath: string): unknown {
  return JSON.parse(fs.readFileSync(fromRoot(relativePath), "utf8"));
}

function getCsvColumns(filePath: string): string[] {
  const expectation = expectedCsvFiles.find((file) => file.path === filePath);

  if (!expectation) {
    throw new Error(`No CSV expectation found for ${filePath}.`);
  }

  return expectation.columns;
}

function readManifest(snapshotId: string): Record<string, unknown> {
  return readJson(`data/raw/paalam/manifests/${snapshotId}.json`) as Record<string, unknown>;
}

function readRawText(relativePath: string): string {
  return fs.readFileSync(fromRoot(relativePath), "utf8");
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function requiredCell(row: CsvRow, field: string, rowLabel = "CSV row"): string {
  const value = row[field];

  if (!value) {
    throw new Error(`Missing required field "${field}" in ${rowLabel}.`);
  }

  return value;
}

function getLatestExtractionBatchId(notes: string | undefined): string | undefined {
  return notes
    ?.split(";")
    .map((note) => note.trim())
    .find((note) => note.startsWith("latest_extraction_batch="))
    ?.slice("latest_extraction_batch=".length);
}

function replaceLatestExtractionBatchNote(notes: string, batchId: string): string {
  const existingNotes = notes
    .split(";")
    .map((note) => note.trim())
    .filter((note) => note.length > 0)
    .filter((note) => !note.startsWith("latest_extraction_batch="));

  return [...existingNotes, `latest_extraction_batch=${batchId}`].join("; ");
}

function markTargetsQueuedForExtraction(targetIds: Set<string>, batchId: string, queuedAt: string): void {
  if (targetIds.size === 0) {
    return;
  }

  const targetsPath = fromRoot("data/ops/scrape_targets.csv");
  const rows = readCsvRows(targetsPath);

  // The scrape target tracker is the long-term memory of the pipeline.
  // Marking these rows as queued prevents future agents from guessing
  // whether a scraped page has already entered the AI extraction step.
  const updatedRows = rows.map((row) => {
    const targetId = requiredCell(row, "target_id", "scrape target row");

    if (!targetIds.has(targetId)) {
      return row;
    }

    return {
      ...row,
      extraction_status: "queued",
      notes: replaceLatestExtractionBatchNote(row.notes ?? "", batchId),
      updated_at: queuedAt
    };
  });

  writeCsvRows(targetsPath, getCsvColumns("data/ops/scrape_targets.csv"), updatedRows);
}

function getAlreadyExtractedTargetIds(): Set<string> {
  const filePath = fromRoot("data/intermediate/extractions/paalam_ai_extracts.jsonl");

  if (!fs.existsSync(filePath)) {
    return new Set();
  }

  // The output file is append-only, so this protects the next batch from
  // asking the AI to extract the same target twice.
  const ids = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as { target_id?: string };
      } catch {
        return {};
      }
    })
    .map((row) => row.target_id)
    .filter((id): id is string => Boolean(id));

  return new Set(ids);
}

function main(): void {
  const args = parseArgs();
  const qualityRows = readCsvRows(fromRoot("data/qa/paalam_scrape_quality_report.csv"));
  const targetRows = readCsvRows(fromRoot("data/ops/scrape_targets.csv"));
  const alreadyExtracted = getAlreadyExtractedTargetIds();
  const targetsById = new Map(targetRows.map((row) => [requiredCell(row, "target_id", "scrape target row"), row]));

  // Start from pages that passed scrape-quality review and are not already
  // present in the AI extraction output file.
  const readyUnextractedRows = qualityRows
    .filter((row: CsvRow) => row.ready_for_ai_extraction === "yes")
    .filter((row: CsvRow) => !alreadyExtracted.has(requiredCell(row, "target_id", "Paalam quality report row")));

  const alreadyQueuedRows = readyUnextractedRows.filter((row) => {
    const targetId = requiredCell(row, "target_id", "Paalam quality report row");
    const target = targetsById.get(targetId);

    return target?.extraction_status === "queued";
  });

  // A second call to this script should not create a duplicate batch for rows
  // that are already waiting for AI extraction.
  const candidates = readyUnextractedRows
    .filter((row: CsvRow) => {
      const targetId = requiredCell(row, "target_id", "Paalam quality report row");
      const target = targetsById.get(targetId);

      return target?.extraction_status !== "queued" && target?.extraction_status !== "validated" && target?.extraction_status !== "extracted";
    })
    .slice(0, args.limit);

  if (candidates.length === 0) {
    const existingBatchIds = Array.from(
      new Set(
        alreadyQueuedRows
          .map((row) => targetsById.get(requiredCell(row, "target_id", "Paalam quality report row")))
          .map((target) => getLatestExtractionBatchId(target?.notes))
          .filter((batchId): batchId is string => Boolean(batchId))
      )
    );

    console.log("No new Paalam extraction batch prepared");
    console.log("=======================================");
    console.log(`Quality-ready unextracted rows: ${readyUnextractedRows.length}`);
    console.log(`Already queued for extraction: ${alreadyQueuedRows.length}`);

    if (existingBatchIds.length > 0) {
      console.log(`Existing queued batch ID(s): ${existingBatchIds.join(", ")}`);
      console.log("Next step: extract the existing queued batch before preparing another one.");
    } else {
      console.log("Next step: scrape/review another Paalam batch, then prepare extraction again.");
    }

    return;
  }

  const batchId = `paalam_extraction_batch_${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14)}`;
  const batchDir = fromRoot("data/intermediate/extractions/batches");
  fs.mkdirSync(batchDir, { recursive: true });

  const jsonlPath = path.join(batchDir, `${batchId}.jsonl`);
  const promptPath = path.join(batchDir, `${batchId}_prompt.md`);

  const rows = candidates.map((row) => {
    const targetId = requiredCell(row, "target_id", "Paalam quality report row");
    const snapshotId = requiredCell(row, "latest_snapshot_id", "Paalam quality report row");
    const sourceUrl = requiredCell(row, "url", "Paalam quality report row");
    const rawTextPath = requiredCell(row, "raw_text_path", "Paalam quality report row");
    const manifest = readManifest(snapshotId);

    return {
      batch_id: batchId,
      source_key: SOURCE_KEY,
      target_id: targetId,
      snapshot_id: snapshotId,
      source_url: sourceUrl,
      raw_text_path: rawTextPath,
      outgoing_source_links: getStringArray(manifest.outgoing_source_links),
      raw_text: readRawText(rawTextPath)
    };
  });

  const queuedAt = new Date().toISOString();
  markTargetsQueuedForExtraction(new Set(rows.map((row) => row.target_id)), batchId, queuedAt);

  // The JSONL file is the actual input for the AI extraction pass.
  // The prompt file is a companion checklist so another AI can run the batch
  // without needing to rediscover the repo conventions.
  fs.writeFileSync(jsonlPath, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : ""));

  fs.writeFileSync(
    promptPath,
    `# Paalam Extraction Batch Prompt

Read each JSONL input row in:

\`\`\`text
${path.relative(fromRoot(), jsonlPath)}
\`\`\`

For each row, extract one strict JSON object that matches the schema in:

\`\`\`text
guide/09_PAALAM_EXTRACTION_SCHEMA.md
\`\`\`

Append outputs to:

\`\`\`text
data/intermediate/extractions/paalam_ai_extracts.jsonl
\`\`\`

Rules:

- Do not invent missing data.
- Every non-null field needs a source quote.
- Preserve \`source_key\`, \`target_id\`, \`snapshot_id\`, \`source_url\`, \`raw_text_path\`, and \`profile_url\`.
- Use null for missing values.
- Use confidence from 0 to 1.
- Mark uncertain rows with \`needs_review: true\`.
- Return JSONL only if asked to produce output.
`
  );

  console.log("Paalam extraction batch prepared");
  console.log("===============================");
  console.log(`Batch ID: ${batchId}`);
  console.log(`Records: ${rows.length}`);
  console.log(`Input JSONL: ${path.relative(fromRoot(), jsonlPath)}`);
  console.log(`Prompt file: ${path.relative(fromRoot(), promptPath)}`);
}

main();
