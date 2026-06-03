import fs from "node:fs";
import path from "node:path";
import { readCsvRows, writeCsvRows } from "./lib/csv.js";
import { sha256 } from "./lib/hash.js";
import { extractOutgoingSourceLinks, htmlToVisibleText } from "./lib/html.js";
import { fetchText, sleep } from "./lib/http.js";
import { makeRunId, makeSnapshotId } from "./lib/ids.js";
import { appendJsonlRow } from "./lib/jsonl.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles } from "./schemas/workspace.js";

type Args = {
  dryRun: boolean;
  limit: number;
  delayMs: number;
  timeoutMs: number;
  runMode: "sample" | "batch";
};

type ScrapeResult = {
  targetId: string;
  url: string;
  ok: boolean;
  httpStatus: number;
  outgoingSourceLinks: string[];
  snapshotId: string | undefined;
  rawHtmlPath: string | undefined;
  rawTextPath: string | undefined;
  contentHash: string | undefined;
  error: string | undefined;
};

const SOURCE_KEY = "paalam";

function parseArgs(): Args {
  const args = process.argv.slice(2);

  function readNumberFlag(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const match = args.find((arg) => arg.startsWith(prefix));

    if (!match) {
      return fallback;
    }

    const value = Number(match.slice(prefix.length));
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid --${name}; expected a positive number.`);
    }

    return value;
  }

  return {
    dryRun: args.includes("--dry-run"),
    limit: readNumberFlag("limit", 20),
    delayMs: readNumberFlag("delay-ms", 2_500),
    timeoutMs: readNumberFlag("timeout-ms", 20_000),
    runMode: args.includes("--run-mode=sample") ? "sample" : "batch"
  };
}

function getCsvColumns(filePath: string): string[] {
  const expectation = expectedCsvFiles.find((file) => file.path === filePath);

  if (!expectation) {
    throw new Error(`No CSV expectation found for ${filePath}.`);
  }

  return expectation.columns;
}

function selectQueuedTargets(rows: Record<string, string>[], limit: number): Record<string, string>[] {
  return rows
    .filter((row) => row.source_key === SOURCE_KEY)
    .filter((row) => row.target_type === "profile_page")
    .filter((row) => row.status === "queued")
    .slice(0, limit);
}

function relativeSnapshotPath(snapshotId: string, extension: "html" | "txt"): string {
  return `data/raw/paalam/snapshots/${snapshotId}.${extension}`;
}

function writeSnapshotFiles(rawHtmlPath: string, rawTextPath: string, html: string, text: string): void {
  fs.writeFileSync(fromRoot(rawHtmlPath), html);
  fs.writeFileSync(fromRoot(rawTextPath), text);
}

function incrementFailureCount(row: Record<string, string>): string {
  const current = Number(row.failure_count || "0");
  return String(Number.isFinite(current) ? current + 1 : 1);
}

function buildRetryTime(now: Date): string {
  const retry = new Date(now);
  retry.setDate(retry.getDate() + 1);
  return retry.toISOString();
}

function requiredCell(row: Record<string, string>, field: string): string {
  const value = row[field];

  if (!value) {
    throw new Error(`Missing required field "${field}" in scrape target row.`);
  }

  return value;
}

async function scrapeOneTarget(row: Record<string, string>, timeoutMs: number): Promise<ScrapeResult> {
  const targetId = requiredCell(row, "target_id");
  const url = requiredCell(row, "url");

  try {
    // This fetches only the HTML document for the victim profile.
    // It does not download images, scripts, or outgoing news articles.
    const response = await fetchText(url, timeoutMs);

    if (response.status < 200 || response.status >= 300) {
      return {
        targetId,
        url,
        ok: false,
        httpStatus: response.status,
        outgoingSourceLinks: [],
        snapshotId: undefined,
        rawHtmlPath: undefined,
        rawTextPath: undefined,
        contentHash: undefined,
        error: `HTTP ${response.status}`
      };
    }

    // The hash is based on raw HTML, because this is the exact source capture.
    // Later, if the hash is identical, we can skip unnecessary extraction work.
    const contentHash = sha256(response.body);
    const fetchedAt = new Date().toISOString();
    const snapshotId = makeSnapshotId(targetId, fetchedAt, contentHash);
    const rawHtmlPath = relativeSnapshotPath(snapshotId, "html");
    const rawTextPath = relativeSnapshotPath(snapshotId, "txt");

    // Raw text is a readable companion file for extraction.
    // We still keep raw HTML so the original capture is never lost.
    const rawText = htmlToVisibleText(response.body);
    const outgoingSourceLinks = extractOutgoingSourceLinks(response.body, url);

    writeSnapshotFiles(rawHtmlPath, rawTextPath, response.body, rawText);

    // A per-page manifest is the receipt for this snapshot.
    // It ties together the target, timestamp, hash, saved files, and source links.
    const manifestPath = fromRoot(`data/raw/paalam/manifests/${snapshotId}.json`);
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          snapshot_id: snapshotId,
          target_id: targetId,
          source_key: SOURCE_KEY,
          url,
          fetched_at: fetchedAt,
          http_status: response.status,
          content_hash: contentHash,
          raw_html_path: rawHtmlPath,
          raw_text_path: rawTextPath,
          outgoing_source_links: outgoingSourceLinks
        },
        null,
        2
      )}\n`
    );

    return {
      targetId,
      url,
      ok: true,
      httpStatus: response.status,
      outgoingSourceLinks,
      snapshotId,
      rawHtmlPath,
      rawTextPath,
      contentHash,
      error: undefined
    };
  } catch (error) {
    return {
      targetId,
      url,
      ok: false,
      httpStatus: 0,
      outgoingSourceLinks: [],
      snapshotId: undefined,
      rawHtmlPath: undefined,
      rawTextPath: undefined,
      contentHash: undefined,
      error: String(error)
    };
  }
}

function updateTargetRows(
  allRows: Record<string, string>[],
  selectedRows: Record<string, string>[],
  results: ScrapeResult[],
  checkedAt: string
): Record<string, string>[] {
  const selectedIds = new Set(selectedRows.map((row) => requiredCell(row, "target_id")));
  const resultsByTargetId = new Map(results.map((result) => [result.targetId, result]));

  return allRows.map((row) => {
    const targetId = requiredCell(row, "target_id");

    if (!selectedIds.has(targetId)) {
      return row;
    }

    const result = resultsByTargetId.get(targetId);
    if (!result) {
      return row;
    }

    if (result.ok) {
      return {
        ...row,
        status: "scraped",
        last_scraped_at: checkedAt,
        last_success_at: checkedAt,
        last_checked_at: checkedAt,
        last_http_status: String(result.httpStatus),
        last_content_hash: result.contentHash ?? "",
        latest_raw_html_path: result.rawHtmlPath ?? "",
        latest_raw_text_path: result.rawTextPath ?? "",
        latest_snapshot_id: result.snapshotId ?? "",
        extraction_status: "not_started",
        review_status: "not_required",
        updated_at: checkedAt
      };
    }

    return {
      ...row,
      status: "failed",
      last_scraped_at: checkedAt,
      last_checked_at: checkedAt,
      last_http_status: result.httpStatus ? String(result.httpStatus) : "",
      failure_count: incrementFailureCount(row),
      next_retry_at: buildRetryTime(new Date(checkedAt)),
      notes: `${row.notes}; last_error=${result.error ?? "unknown"}`,
      updated_at: checkedAt
    };
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = new Date().toISOString();
  const runId = makeRunId(SOURCE_KEY, args.runMode, startedAt);

  const allTargets = readCsvRows(fromRoot("data/ops/scrape_targets.csv"));
  const selectedTargets = selectQueuedTargets(allTargets, args.limit);

  if (selectedTargets.length === 0) {
    console.log("No queued Paalam profile targets found.");
    return;
  }

  console.log(`Starting Paalam ${args.runMode} scrape: ${runId}`);
  console.log(`Targets selected: ${selectedTargets.length}`);
  console.log(args.dryRun ? "Mode: dry run (no pages fetched, no files changed)" : "Mode: write raw snapshots and update trackers");

  if (args.dryRun) {
    console.log("\nSelected targets:");
    selectedTargets.forEach((row, index) => {
      console.log(`${index + 1}. ${row.url}`);
    });
    return;
  }

  const results: ScrapeResult[] = [];

  for (const [index, row] of selectedTargets.entries()) {
    // Scraping happens one page at a time. This is slower, but kinder to the site
    // and much easier to debug than many parallel requests.
    console.log(`[${index + 1}/${selectedTargets.length}] Fetching ${row.url}`);

    const result = await scrapeOneTarget(row, args.timeoutMs);
    results.push(result);

    if (result.ok) {
      console.log(`  saved ${result.snapshotId} (${result.outgoingSourceLinks.length} source links)`);
    } else {
      console.log(`  failed: ${result.error}`);
    }

    // Delay after every target except the last one.
    // This is the simplest rate-limit: wait before touching the site again.
    if (index < selectedTargets.length - 1) {
      await sleep(args.delayMs);
    }
  }

  const finishedAt = new Date().toISOString();
  const successCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - successCount;

  const updatedTargets = updateTargetRows(allTargets, selectedTargets, results, finishedAt);
  writeCsvRows(fromRoot("data/ops/scrape_targets.csv"), getCsvColumns("data/ops/scrape_targets.csv"), updatedTargets);

  const sourceRows = readCsvRows(fromRoot("data/ops/source_registry.csv"));
  const updatedSources = sourceRows.map((row) =>
    row.source_key === SOURCE_KEY
      ? {
          ...row,
          last_scrape_run_id: runId,
          updated_at: finishedAt
        }
      : row
  );
  writeCsvRows(fromRoot("data/ops/source_registry.csv"), getCsvColumns("data/ops/source_registry.csv"), updatedSources);

  appendJsonlRow(fromRoot("data/ops/scrape_runs.jsonl"), {
    run_id: runId,
    source_key: SOURCE_KEY,
    started_at: startedAt,
    finished_at: finishedAt,
    mode: args.runMode,
    target_count: selectedTargets.length,
    success_count: successCount,
    changed_count: successCount,
    unchanged_count: 0,
    failed_count: failedCount,
    script_version: "scrape-paalam.ts@0.2",
    git_commit: "",
    operator: "Codex",
    notes: `run_mode=${args.runMode}; limit=${args.limit}; delay_ms=${args.delayMs}; profile_pages_only=true; images_fetched=false; linked_news_fetched=false`
  });

  for (const result of results.filter((item) => !item.ok)) {
    appendJsonlRow(fromRoot("data/raw/paalam/failed_urls.jsonl"), {
      run_id: runId,
      target_id: result.targetId,
      url: result.url,
      http_status: result.httpStatus,
      error: result.error,
      failed_at: finishedAt
    });
  }

  const report = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    target_count: selectedTargets.length,
    success_count: successCount,
    failed_count: failedCount,
    results: results.map((result) => ({
      target_id: result.targetId,
      url: result.url,
      ok: result.ok,
      http_status: result.httpStatus,
      snapshot_id: result.snapshotId,
      raw_html_path: result.rawHtmlPath,
      raw_text_path: result.rawTextPath,
      outgoing_source_links_count: result.outgoingSourceLinks.length,
      outgoing_source_links: result.outgoingSourceLinks,
      error: result.error
    }))
  };

  const reportPath = fromRoot(`data/raw/paalam/manifests/${runId}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nPaalam ${args.runMode} scrape summary`);
  console.log("---------------------------");
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Report: ${path.relative(fromRoot(), reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
