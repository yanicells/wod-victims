import fs from "node:fs";
import path from "node:path";
import { PaalamExtractionRecord } from "./schemas/extraction.js";
import { readCsvRows, writeCsvRows } from "./lib/csv.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles } from "./schemas/workspace.js";

type ValidationIssue = {
  line: number;
  target_id?: string;
  issue: string;
  field?: string;
  details?: unknown;
};

type Args = {
  inputPath: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const inputArg = args.find((arg) => arg.startsWith("--input="));

  return {
    inputPath: inputArg ? inputArg.slice("--input=".length) : "data/intermediate/extractions/paalam_ai_extracts.jsonl"
  };
}

function getCsvColumns(filePath: string): string[] {
  const expectation = expectedCsvFiles.find((file) => file.path === filePath);

  if (!expectation) {
    throw new Error(`No CSV expectation found for ${filePath}.`);
  }

  return expectation.columns;
}

function hasSupport(sourceQuote: string, confidence: number): boolean {
  return sourceQuote.trim().length > 0 && confidence > 0;
}

function addUnsupportedFactIssue(
  issues: ValidationIssue[],
  line: number,
  targetId: string,
  field: string,
  sourceQuote: string,
  confidence: number
): void {
  if (!hasSupport(sourceQuote, confidence)) {
    issues.push({
      line,
      target_id: targetId,
      issue: "extracted_value_without_supporting_quote_or_confidence",
      field,
      details: { source_quote: sourceQuote, confidence }
    });
  }
}

function updateTargetExtractionStatuses(records: Array<{ target_id: string; needs_review: boolean }>, validatedAt: string): void {
  if (records.length === 0) {
    return;
  }

  const targetsPath = fromRoot("data/ops/scrape_targets.csv");
  const rows = readCsvRows(targetsPath);
  const recordsByTargetId = new Map(records.map((record) => [record.target_id, record]));

  // Only call this after validation has no issues.
  // That way the tracker never says "validated" for a broken output file.
  const updatedRows = rows.map((row) => {
    const targetId = row.target_id;
    const record = targetId ? recordsByTargetId.get(targetId) : undefined;

    if (!record) {
      return row;
    }

    return {
      ...row,
      extraction_status: "validated",
      review_status: record.needs_review ? "queued" : "not_required",
      updated_at: validatedAt
    };
  });

  writeCsvRows(targetsPath, getCsvColumns("data/ops/scrape_targets.csv"), updatedRows);
}

function main(): void {
  const args = parseArgs();
  const fullPath = fromRoot(args.inputPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Extraction output file not found: ${args.inputPath}`);
  }

  const lines = fs
    .readFileSync(fullPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const issues: ValidationIssue[] = [];
  const validatedRecords: Array<{ target_id: string; needs_review: boolean }> = [];
  const seenTargetIds = new Set<string>();
  let validCount = 0;
  let needsReviewCount = 0;

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as unknown;
      const result = PaalamExtractionRecord.safeParse(parsed);
      const lineNumber = index + 1;

      if (!result.success) {
        issues.push({
          line: lineNumber,
          issue: "schema_validation_failed",
          details: result.error.issues
        });
        return;
      }

      const record = result.data;
      validCount += 1;
      if (record.needs_review) {
        needsReviewCount += 1;
      }
      validatedRecords.push({ target_id: record.target_id, needs_review: record.needs_review });

      if (seenTargetIds.has(record.target_id)) {
        issues.push({
          line: lineNumber,
          target_id: record.target_id,
          issue: "duplicate_target_id_in_extraction_output"
        });
      }
      seenTargetIds.add(record.target_id);

      if (!fs.existsSync(fromRoot(record.raw_text_path))) {
        issues.push({
          line: lineNumber,
          target_id: record.target_id,
          issue: "raw_text_path_not_found",
          field: "raw_text_path",
          details: record.raw_text_path
        });
      }

      // If a field contains a fact, it needs a quote and non-zero confidence.
      // This is intentionally simple so it stays easy to inspect by hand.
      if (record.name.value !== null) {
        addUnsupportedFactIssue(issues, lineNumber, record.target_id, "name", record.name.source_quote, record.name.confidence);
      }
      if (record.age.value !== null) {
        addUnsupportedFactIssue(issues, lineNumber, record.target_id, "age", record.age.source_quote, record.age.confidence);
      }
      if (record.gender.value !== "unknown") {
        addUnsupportedFactIssue(issues, lineNumber, record.target_id, "gender", record.gender.source_quote, record.gender.confidence);
      }
      if (record.date_killed.value !== null) {
        addUnsupportedFactIssue(
          issues,
          lineNumber,
          record.target_id,
          "date_killed",
          record.date_killed.source_quote,
          record.date_killed.confidence
        );
      }
      if (
        record.location.raw_location !== null ||
        record.location.barangay !== null ||
        record.location.city_municipality !== null ||
        record.location.province !== null ||
        record.location.region !== null
      ) {
        addUnsupportedFactIssue(
          issues,
          lineNumber,
          record.target_id,
          "location",
          record.location.source_quote,
          record.location.confidence
        );
      }
      if (record.incident_context.short_summary.trim().length > 0) {
        addUnsupportedFactIssue(
          issues,
          lineNumber,
          record.target_id,
          "incident_context",
          record.incident_context.source_quote,
          record.incident_context.confidence
        );
      }
    } catch (error) {
      issues.push({
        line: index + 1,
        issue: "invalid_json",
        details: String(error)
      });
    }
  });

  const report = {
    generated_at: new Date().toISOString(),
    input_path: args.inputPath,
    total_lines: lines.length,
    valid_records: validCount,
    needs_review: needsReviewCount,
    invalid_records: issues.length,
    issues
  };

  const reportPath = fromRoot("data/qa/paalam_extraction_validation_report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Paalam Extraction Validation");
  console.log("============================");
  console.log(`Input: ${args.inputPath}`);
  console.log(`Total lines: ${lines.length}`);
  console.log(`Valid records: ${validCount}`);
  console.log(`Needs review: ${needsReviewCount}`);
  console.log(`Invalid records: ${issues.length}`);
  console.log(`Report: ${path.relative(fromRoot(), reportPath)}`);

  if (issues.length > 0) {
    process.exit(1);
  }

  updateTargetExtractionStatuses(validatedRecords, report.generated_at);
}

main();
