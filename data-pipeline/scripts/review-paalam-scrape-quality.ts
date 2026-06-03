import fs from "node:fs";
import path from "node:path";
import { readCsvRows, writeCsvRows } from "./lib/csv.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles } from "./schemas/workspace.js";

type QualityRow = {
  target_id: string;
  url: string;
  status: string;
  latest_snapshot_id: string;
  raw_html_path: string;
  raw_text_path: string;
  html_exists: string;
  text_exists: string;
  text_char_count: string;
  outgoing_source_links_count: string;
  issues: string;
  ready_for_ai_extraction: string;
};

type SnapshotManifest = {
  snapshot_id?: string;
  target_id?: string;
  url?: string;
  outgoing_source_links?: string[];
};

const SOURCE_KEY = "paalam";
const MIN_TEXT_CHARS = 500;

const REPORT_COLUMNS = [
  "target_id",
  "url",
  "status",
  "latest_snapshot_id",
  "raw_html_path",
  "raw_text_path",
  "html_exists",
  "text_exists",
  "text_char_count",
  "outgoing_source_links_count",
  "issues",
  "ready_for_ai_extraction"
];

function getCsvColumns(filePath: string): string[] {
  const expectation = expectedCsvFiles.find((file) => file.path === filePath);

  if (!expectation) {
    throw new Error(`No CSV expectation found for ${filePath}.`);
  }

  return expectation.columns;
}

function fileExists(relativePath: string): boolean {
  return relativePath.length > 0 && fs.existsSync(fromRoot(relativePath));
}

function readTextIfExists(relativePath: string): string {
  if (!fileExists(relativePath)) {
    return "";
  }

  return fs.readFileSync(fromRoot(relativePath), "utf8");
}

function readManifest(snapshotId: string): SnapshotManifest {
  const manifestPath = fromRoot(`data/raw/paalam/manifests/${snapshotId}.json`);

  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SnapshotManifest;
}

function buildQualityRow(target: Record<string, string>): QualityRow {
  const issues: string[] = [];

  const targetId = target.target_id ?? "";
  const url = target.url ?? "";
  const status = target.status ?? "";
  const snapshotId = target.latest_snapshot_id ?? "";
  const rawHtmlPath = target.latest_raw_html_path ?? "";
  const rawTextPath = target.latest_raw_text_path ?? "";

  const htmlExists = fileExists(rawHtmlPath);
  const textExists = fileExists(rawTextPath);
  const rawText = readTextIfExists(rawTextPath);
  const textCharCount = rawText.length;
  const manifest = snapshotId ? readManifest(snapshotId) : {};
  const outgoingSourceLinksCount = manifest.outgoing_source_links?.length ?? 0;

  // Each check is deliberately simple and explainable.
  // If a row fails any check, it can still stay in the dataset, but it should not
  // move quietly into AI extraction without being noticed.
  if (status !== "scraped") {
    issues.push("target_not_scraped");
  }

  if (!snapshotId) {
    issues.push("missing_snapshot_id");
  }

  if (!htmlExists) {
    issues.push("missing_raw_html");
  }

  if (!textExists) {
    issues.push("missing_raw_text");
  }

  if (textExists && textCharCount < MIN_TEXT_CHARS) {
    issues.push("raw_text_too_short");
  }

  if (rawText.includes("Source(s)") && outgoingSourceLinksCount === 0) {
    issues.push("source_section_without_valid_external_link");
  }

  const readyForAiExtraction = issues.length === 0;

  return {
    target_id: targetId,
    url,
    status,
    latest_snapshot_id: snapshotId,
    raw_html_path: rawHtmlPath,
    raw_text_path: rawTextPath,
    html_exists: htmlExists ? "yes" : "no",
    text_exists: textExists ? "yes" : "no",
    text_char_count: String(textCharCount),
    outgoing_source_links_count: String(outgoingSourceLinksCount),
    issues: issues.join(";"),
    ready_for_ai_extraction: readyForAiExtraction ? "yes" : "no"
  };
}

function updateTargetReviewStatuses(targets: Record<string, string>[], rows: QualityRow[], reviewedAt: string): void {
  const qualityByTargetId = new Map(rows.map((row) => [row.target_id, row]));

  // This status is for operational memory, not final truth.
  // It lets ops:summary show which scraped pages need human/AI attention
  // before they should enter extraction.
  const updatedTargets = targets.map((target) => {
    const targetId = target.target_id;
    const quality = targetId ? qualityByTargetId.get(targetId) : undefined;

    if (!quality) {
      return target;
    }

    if (quality.ready_for_ai_extraction === "no") {
      return {
        ...target,
        review_status: "queued",
        updated_at: reviewedAt
      };
    }

    // If a later extraction validation already queued review, keep that queue.
    if (target.extraction_status === "validated" && target.review_status === "queued") {
      return target;
    }

    return {
      ...target,
      review_status: "not_required",
      updated_at: reviewedAt
    };
  });

  writeCsvRows(fromRoot("data/ops/scrape_targets.csv"), getCsvColumns("data/ops/scrape_targets.csv"), updatedTargets);
}

function main(): void {
  const targets = readCsvRows(fromRoot("data/ops/scrape_targets.csv"));
  const scrapedPaalamTargets = targets.filter((target) => target.source_key === SOURCE_KEY && target.status === "scraped");
  const rows = scrapedPaalamTargets.map(buildQualityRow);
  const reviewedAt = new Date().toISOString();

  const readyCount = rows.filter((row) => row.ready_for_ai_extraction === "yes").length;
  const needsReviewRows = rows.filter((row) => row.ready_for_ai_extraction === "no");

  const csvPath = fromRoot("data/qa/paalam_scrape_quality_report.csv");
  const jsonPath = fromRoot("data/qa/paalam_scrape_quality_report.json");

  writeCsvRows(csvPath, REPORT_COLUMNS, rows);
  fs.writeFileSync(
    jsonPath,
	    `${JSON.stringify(
	      {
	        generated_at: reviewedAt,
        source_key: SOURCE_KEY,
        scraped_targets_reviewed: rows.length,
        ready_for_ai_extraction: readyCount,
        needs_review: needsReviewRows.length,
        issue_counts: countIssues(rows),
        rows
      },
      null,
      2
    )}\n`
	  );

  updateTargetReviewStatuses(targets, rows, reviewedAt);

  console.log("Paalam Scrape Quality Review");
  console.log("============================");
  console.log(`Scraped targets reviewed: ${rows.length}`);
  console.log(`Ready for AI extraction: ${readyCount}`);
  console.log(`Needs review: ${needsReviewRows.length}`);
  console.log(`CSV report: ${path.relative(fromRoot(), csvPath)}`);
  console.log(`JSON report: ${path.relative(fromRoot(), jsonPath)}`);
}

function countIssues(rows: QualityRow[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    if (!row.issues) {
      continue;
    }

    for (const issue of row.issues.split(";")) {
      counts[issue] = (counts[issue] ?? 0) + 1;
    }
  }

  return counts;
}

main();
