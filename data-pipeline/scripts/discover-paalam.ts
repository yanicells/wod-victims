import fs from "node:fs";
import path from "node:path";
import { readCsvRows, writeCsvRows } from "./lib/csv.js";
import { fetchText, sleep } from "./lib/http.js";
import { makeRunId, makeTargetId } from "./lib/ids.js";
import { appendJsonlRow } from "./lib/jsonl.js";
import { fromRoot } from "./lib/paths.js";
import { expectedCsvFiles } from "./schemas/workspace.js";

type Args = {
  dryRun: boolean;
  delayMs: number;
  timeoutMs: number;
  restPageSize: number;
  maxRestPages: number | undefined;
};

type DiscoveryCandidate = {
  canonicalUrl: string;
  title: string | undefined;
  restId: string | undefined;
  restModified: string | undefined;
  foundInSitemap: boolean;
  foundInRest: boolean;
};

const SOURCE_KEY = "paalam";
const BASE_URL = "https://paalam.org";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const ROBOTS_URL = `${BASE_URL}/robots.txt`;
const REST_URL = `${BASE_URL}/wp-json/wp/v2/victim`;
const VICTIM_PATH_MARKER = "/homepage/victims/";

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

  const maxRestPagesArg = args.find((arg) => arg.startsWith("--max-rest-pages="));

  return {
    dryRun: args.includes("--dry-run"),
    delayMs: readNumberFlag("delay-ms", 750),
    timeoutMs: readNumberFlag("timeout-ms", 20_000),
    restPageSize: Math.min(readNumberFlag("rest-page-size", 100), 100),
    maxRestPages: maxRestPagesArg ? readNumberFlag("max-rest-pages", 1) : undefined
  };
}

function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";

  // Paalam profile URLs are slash-normalized on the site.
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }

  return parsed.toString();
}

function collectSitemapVictimUrls(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1] ?? "");

  return urls
    .filter((url) => url.includes(VICTIM_PATH_MARKER))
    .map(canonicalizeUrl);
}

function mergeCandidate(candidates: Map<string, DiscoveryCandidate>, candidate: DiscoveryCandidate): void {
  const existing = candidates.get(candidate.canonicalUrl);

  if (!existing) {
    candidates.set(candidate.canonicalUrl, candidate);
    return;
  }

  // One profile can be found by sitemap and REST. Merge signals instead of creating duplicates.
  candidates.set(candidate.canonicalUrl, {
    canonicalUrl: candidate.canonicalUrl,
    title: existing.title || candidate.title,
    restId: existing.restId || candidate.restId,
    restModified: existing.restModified || candidate.restModified,
    foundInSitemap: existing.foundInSitemap || candidate.foundInSitemap,
    foundInRest: existing.foundInRest || candidate.foundInRest
  });
}

function getCsvColumns(filePath: string): string[] {
  const expectation = expectedCsvFiles.find((file) => file.path === filePath);

  if (!expectation) {
    throw new Error(`No CSV expectation found for ${filePath}.`);
  }

  return expectation.columns;
}

function discoveryMethod(candidate: DiscoveryCandidate): string {
  if (candidate.foundInSitemap && candidate.foundInRest) {
    return "sitemap+wp_rest";
  }

  return candidate.foundInSitemap ? "sitemap" : "wp_rest";
}

function buildTargetRow(candidate: DiscoveryCandidate, discoveredAt: string): Record<string, string> {
  const titleNote = candidate.title ? `title=${candidate.title}` : "title=unknown";
  const restNote = candidate.restId ? `rest_id=${candidate.restId}` : "rest_id=unknown";
  const modifiedNote = candidate.restModified ? `rest_modified=${candidate.restModified}` : "rest_modified=unknown";

  return {
    target_id: makeTargetId(SOURCE_KEY, candidate.canonicalUrl),
    source_key: SOURCE_KEY,
    url: candidate.canonicalUrl,
    canonical_url: candidate.canonicalUrl,
    target_type: "profile_page",
    discovered_at: discoveredAt,
    discovered_from_url: discoveryMethod(candidate),
    status: "queued",
    priority: "high",
    last_scraped_at: "",
    last_success_at: "",
    last_checked_at: "",
    last_http_status: "",
    last_content_hash: "",
    latest_raw_html_path: "",
    latest_raw_text_path: "",
    latest_snapshot_id: "",
    extraction_status: "not_started",
    review_status: "not_required",
    failure_count: "0",
    next_retry_at: "",
    notes: [titleNote, restNote, modifiedNote].join("; "),
    created_at: discoveredAt,
    updated_at: discoveredAt
  };
}

async function fetchRestCandidates(args: Args, candidates: Map<string, DiscoveryCandidate>): Promise<{ total: number; pagesFetched: number }> {
  let total = 0;
  let totalPages = 1;
  let pagesFetched = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    if (args.maxRestPages && page > args.maxRestPages) {
      break;
    }

    const url = new URL(REST_URL);
    url.searchParams.set("per_page", String(args.restPageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("_fields", "id,slug,link,title,date,modified,type");

    const response = await fetchText(url.toString(), args.timeoutMs);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`REST request failed with HTTP ${response.status}: ${url.toString()}`);
    }

    total = Number(response.headers.get("x-wp-total") ?? total);
    totalPages = Number(response.headers.get("x-wp-totalpages") ?? totalPages);
    pagesFetched += 1;

    const rows = JSON.parse(response.body) as Array<{
      id?: number;
      link?: string;
      title?: { rendered?: string };
      modified?: string;
      type?: string;
    }>;

    for (const row of rows) {
      if (!row.link || row.type !== "victim") {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(row.link);
      mergeCandidate(candidates, {
        canonicalUrl,
        title: row.title?.rendered,
        restId: row.id ? String(row.id) : undefined,
        restModified: row.modified,
        foundInSitemap: false,
        foundInRest: true
      });
    }

    if (page < totalPages) {
      await sleep(args.delayMs);
    }
  }

  return { total, pagesFetched };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = new Date().toISOString();
  const runId = makeRunId(SOURCE_KEY, "discover", startedAt);

  const sourceRows = readCsvRows(fromRoot("data/ops/source_registry.csv"));
  const paalamSource = sourceRows.find((row) => row.source_key === SOURCE_KEY && row.status === "active");

  if (!paalamSource) {
    throw new Error("Paalam source must exist in source_registry.csv with status=active before discovery.");
  }

  console.log(`Starting Paalam discovery run: ${runId}`);
  console.log(args.dryRun ? "Mode: dry run (trackers will not be changed)" : "Mode: write changes to trackers");

  const robots = await fetchText(ROBOTS_URL, args.timeoutMs);
  if (!robots.body.includes("Sitemap:")) {
    console.warn("robots.txt did not include a Sitemap line. Continuing because sitemap URL is configured.");
  }

  await sleep(args.delayMs);

  const sitemap = await fetchText(SITEMAP_URL, args.timeoutMs);
  if (sitemap.status < 200 || sitemap.status >= 300) {
    throw new Error(`Sitemap request failed with HTTP ${sitemap.status}.`);
  }

  const candidates = new Map<string, DiscoveryCandidate>();
  const sitemapUrls = collectSitemapVictimUrls(sitemap.body);

  for (const canonicalUrl of sitemapUrls) {
    mergeCandidate(candidates, {
      canonicalUrl,
      title: undefined,
      restId: undefined,
      restModified: undefined,
      foundInSitemap: true,
      foundInRest: false
    });
  }

  await sleep(args.delayMs);
  const restSummary = await fetchRestCandidates(args, candidates);

  const existingTargets = readCsvRows(fromRoot("data/ops/scrape_targets.csv"));
  const existingUrls = new Set(existingTargets.map((row) => row.canonical_url || row.url));
  const newCandidates = [...candidates.values()].filter((candidate) => !existingUrls.has(candidate.canonicalUrl));
  const newTargetRows = newCandidates.map((candidate) => buildTargetRow(candidate, startedAt));
  const finishedAt = new Date().toISOString();

  const runSummary = {
    run_id: runId,
    source_key: SOURCE_KEY,
    started_at: startedAt,
    finished_at: finishedAt,
    mode: "discover",
    target_count: candidates.size,
    success_count: newTargetRows.length,
    changed_count: 0,
    unchanged_count: existingTargets.length,
    failed_count: 0,
    script_version: "discover-paalam.ts@0.1",
    git_commit: "",
    operator: "Codex",
    notes: `sitemap_urls=${sitemapUrls.length}; rest_total=${restSummary.total}; rest_pages_fetched=${restSummary.pagesFetched}; dry_run=${args.dryRun}`
  };

  if (!args.dryRun) {
    const targetColumns = getCsvColumns("data/ops/scrape_targets.csv");
    writeCsvRows(fromRoot("data/ops/scrape_targets.csv"), targetColumns, [...existingTargets, ...newTargetRows]);

    appendJsonlRow(fromRoot("data/ops/scrape_runs.jsonl"), runSummary);

    const sourceColumns = getCsvColumns("data/ops/source_registry.csv");
    const updatedSources = sourceRows.map((row) =>
      row.source_key === SOURCE_KEY
        ? {
            ...row,
            last_discovery_run_id: runId,
            updated_at: startedAt
          }
        : row
    );
    writeCsvRows(fromRoot("data/ops/source_registry.csv"), sourceColumns, updatedSources);
  }

  // A small report file is useful for learning and auditing without opening huge CSVs.
  const report = {
    ...runSummary,
    dry_run: args.dryRun,
    sitemap_victim_urls: sitemapUrls.length,
    rest_total: restSummary.total,
    rest_pages_fetched: restSummary.pagesFetched,
    merged_candidate_count: candidates.size,
    new_target_count: newTargetRows.length,
    existing_target_count: existingTargets.length,
    sample_new_targets: newTargetRows.slice(0, 10).map((row) => ({
      target_id: row.target_id,
      url: row.url,
      notes: row.notes
    }))
  };

  const reportDir = fromRoot("data/raw/paalam/manifests");
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${runId}${args.dryRun ? "-dry-run" : ""}.json`), `${JSON.stringify(report, null, 2)}\n`);

  console.log("\nDiscovery summary");
  console.log("-----------------");
  console.log(`Sitemap victim URLs: ${sitemapUrls.length}`);
  console.log(`REST total reported: ${restSummary.total}`);
  console.log(`REST pages fetched: ${restSummary.pagesFetched}`);
  console.log(`Merged candidates: ${candidates.size}`);
  console.log(`Existing targets: ${existingTargets.length}`);
  console.log(`New targets: ${newTargetRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
