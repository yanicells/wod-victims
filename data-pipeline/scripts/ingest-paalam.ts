/**
 * Ingest Paalam victim profiles: fetch → parse → append clean JSONL → delete HTML.
 *
 * Usage:
 *   pnpm ingest:paalam -- --limit=10
 *   pnpm ingest:paalam -- --limit=5 --delay-ms=3000 --keep-cache
 *   pnpm ingest:paalam -- --url=https://paalam.org/homepage/victims/example/
 *
 * Already-ingested IDs are always skipped (including explicit --url), so retries
 * and manual re-runs cannot duplicate rows in victims.jsonl.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalizePaalamUrl } from "./lib/canonicalize.js";
import { sha256 } from "./lib/hash.js";
import { fetchText, sleep } from "./lib/http.js";
import { makeTargetId } from "./lib/ids.js";
import { appendJsonlRow } from "./lib/jsonl.js";
import { toVictimRecord } from "./lib/paalam-record.js";
import { parsePaalamProfile } from "./lib/parse-paalam-profile.js";
import {
  cacheDir,
  loadState,
  loadVictimIds,
  saveState,
  victimsPath
} from "./lib/state.js";

export type Args = {
  dryRun: boolean;
  limit: number;
  delayMs: number;
  timeoutMs: number;
  retries: number;
  maxConsecutiveFailures: number;
  keepCache: boolean;
  urls: string[];
};

export function parseArgs(args = process.argv.slice(2)): Args {
  function readNumberFlag(name: string, fallback: number, allowZero = false): number {
    const prefix = `--${name}=`;
    const match = args.find((arg) => arg.startsWith(prefix));
    if (!match) return fallback;
    const value = Number(match.slice(prefix.length));
    const invalid = !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0);
    if (invalid) {
      throw new Error(`Invalid --${name}`);
    }
    return value;
  }

  const urlFlags = args
    .filter((arg) => arg.startsWith("--url="))
    .map((arg) => arg.slice("--url=".length));

  return {
    dryRun: args.includes("--dry-run"),
    limit: readNumberFlag("limit", 10),
    delayMs: readNumberFlag("delay-ms", 2_500),
    timeoutMs: readNumberFlag("timeout-ms", 30_000),
    retries: readNumberFlag("retries", 1, true),
    maxConsecutiveFailures: readNumberFlag("max-consecutive-failures", 5),
    keepCache: args.includes("--keep-cache"),
    urls: urlFlags
  };
}

export function pendingUrls(
  discovered: string[],
  completedIds: Set<string>,
  explicit: string[]
): { queue: string[]; skippedAlreadyDone: number } {
  const source = explicit.length > 0 ? explicit : discovered;
  const seenInQueue = new Set<string>();
  const queue: string[] = [];
  let skippedAlreadyDone = 0;

  for (const raw of source) {
    let canonical: string;
    try {
      canonical = canonicalizePaalamUrl(raw);
    } catch {
      throw new Error(`Invalid URL: ${raw}`);
    }

    const id = makeTargetId("paalam", canonical);
    if (completedIds.has(id)) {
      skippedAlreadyDone += 1;
      continue;
    }

    if (seenInQueue.has(id)) {
      continue;
    }

    seenInQueue.add(id);
    queue.push(canonical);
  }

  return { queue, skippedAlreadyDone };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const state = loadState();
  const existingIds = loadVictimIds();
  const completed = new Set([...state.completedIds, ...existingIds]);

  const { queue: pending, skippedAlreadyDone } = pendingUrls(
    state.discoveredUrls,
    completed,
    args.urls
  );
  const queue = pending.slice(0, args.limit);

  if (queue.length === 0) {
    console.log(
      skippedAlreadyDone > 0
        ? `Nothing to ingest (${skippedAlreadyDone} already completed).`
        : "Nothing to ingest. Run discover:paalam first, or pass --url=..."
    );
    return;
  }

  console.log(
    `Ingesting ${queue.length} profile(s) (delay=${args.delayMs}ms, dryRun=${args.dryRun}, skippedAlreadyDone=${skippedAlreadyDone})…`
  );

  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.mkdirSync(path.dirname(victimsPath()), { recursive: true });

  let success = 0;
  let failed = 0;
  let skipped = skippedAlreadyDone;
  let consecutiveFailures = 0;
  const reviewFlags: string[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const url = queue[index]!;
    const id = makeTargetId("paalam", url);
    const scrapedAt = new Date().toISOString();
    const cachePath = path.join(cacheDir(), `${id}.html`);

    // Re-check immediately before write — protects against concurrent/manual races.
    if (completed.has(id) || loadVictimIds().has(id)) {
      skipped += 1;
      console.log(`↷ ${index + 1}/${queue.length} skip already ingested ${id}`);
      continue;
    }

    try {
      const response = await fetchText(url, args.timeoutMs, args.retries);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = response.body;
      const contentHash = sha256(html);
      const parsed = parsePaalamProfile(html);
      const record = toVictimRecord({
        id,
        profileUrl: url,
        scrapedAt,
        contentHash,
        parsed
      });

      if (args.dryRun) {
        console.log(
          `[dry-run] ${index + 1}/${queue.length} ${record.name ?? "(no name)"} | ${record.dateKilled ?? "no-date"} | ${record.locationRaw ?? "no-loc"} | sources=${record.sourceUrls.length} review=${record.needsReview}`
        );
      } else {
        if (args.keepCache) {
          fs.writeFileSync(cachePath, html);
        }

        // Final guard right before append.
        if (loadVictimIds().has(id)) {
          skipped += 1;
          console.log(`↷ ${index + 1}/${queue.length} skip already ingested ${id}`);
          continue;
        }

        appendJsonlRow(victimsPath(), record);
        completed.add(id);
        state.completedIds = [...new Set([...state.completedIds, id])];
        state.failed = state.failed.filter((row) => row.id !== id);
        saveState(state);

        if (fs.existsSync(cachePath) && !args.keepCache) {
          fs.unlinkSync(cachePath);
        }

        console.log(
          `✓ ${index + 1}/${queue.length} ${record.name ?? "(no name)"} | ${record.dateKilled ?? "no-date"} | ${record.locationRaw ?? "no-loc"}`
        );
      }

      if (record.needsReview) {
        reviewFlags.push(`${id}: ${record.reviewReasons.join(", ")}`);
      }

      success += 1;
      consecutiveFailures = 0;
    } catch (error) {
      failed += 1;
      consecutiveFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${index + 1}/${queue.length} ${url} — ${message}`);

      if (!args.dryRun) {
        const existing = state.failed.find((row) => row.id === id);
        const attempts = (existing?.attempts ?? 0) + 1;
        state.failed = [
          ...state.failed.filter((row) => row.id !== id),
          { id, url, error: message, failedAt: scrapedAt, attempts }
        ];
        saveState(state);
      }

      if (
        args.maxConsecutiveFailures > 0 &&
        consecutiveFailures >= args.maxConsecutiveFailures
      ) {
        console.error(
          `Stopping after ${consecutiveFailures} consecutive failures (likely throttling).`
        );
        break;
      }
    }

    if (index < queue.length - 1) {
      await sleep(args.delayMs);
    }
  }

  // Best-effort: clear any leftover cache files from this run.
  if (!args.keepCache && fs.existsSync(cacheDir())) {
    for (const name of fs.readdirSync(cacheDir())) {
      if (name.endsWith(".html")) {
        fs.unlinkSync(path.join(cacheDir(), name));
      }
    }
  }

  const uniqueIds = loadVictimIds();
  console.log(
    JSON.stringify(
      {
        success,
        failed,
        skipped,
        victims_file: victimsPath(),
        completed_total: uniqueIds.size,
        review_flags: reviewFlags.slice(0, 20)
      },
      null,
      2
    )
  );
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entrypoint === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
