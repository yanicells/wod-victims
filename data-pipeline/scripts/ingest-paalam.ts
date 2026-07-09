/**
 * Ingest Paalam victim profiles: fetch → parse → append clean JSONL → delete HTML.
 *
 * Usage:
 *   pnpm ingest:paalam -- --limit=10
 *   pnpm ingest:paalam -- --limit=5 --delay-ms=3000 --keep-cache
 */
import fs from "node:fs";
import path from "node:path";
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

type Args = {
  dryRun: boolean;
  limit: number;
  delayMs: number;
  timeoutMs: number;
  retries: number;
  maxConsecutiveFailures: number;
  keepCache: boolean;
  urls: string[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);

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
    maxConsecutiveFailures: readNumberFlag("max-consecutive-failures", 5, true),
    keepCache: args.includes("--keep-cache"),
    urls: urlFlags
  };
}

function pendingUrls(discovered: string[], completedIds: Set<string>, explicit: string[]): string[] {
  if (explicit.length > 0) {
    return explicit;
  }

  return discovered.filter((url) => {
    const id = makeTargetId("paalam", url);
    return !completedIds.has(id);
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const state = loadState();
  const existingIds = loadVictimIds();
  const completed = new Set([...state.completedIds, ...existingIds]);

  const queue = pendingUrls(state.discoveredUrls, completed, args.urls).slice(0, args.limit);

  if (queue.length === 0) {
    console.log("Nothing to ingest. Run discover:paalam first, or pass --url=...");
    return;
  }

  console.log(
    `Ingesting ${queue.length} profile(s) (delay=${args.delayMs}ms, dryRun=${args.dryRun})…`
  );

  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.mkdirSync(path.dirname(victimsPath()), { recursive: true });

  let success = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  const reviewFlags: string[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const url = queue[index]!;
    const id = makeTargetId("paalam", url);
    const scrapedAt = new Date().toISOString();
    const cachePath = path.join(cacheDir(), `${id}.html`);

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

        appendJsonlRow(victimsPath(), record);
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

  console.log(
    JSON.stringify(
      {
        success,
        failed,
        victims_file: victimsPath(),
        completed_total: loadVictimIds().size,
        review_flags: reviewFlags.slice(0, 20)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
