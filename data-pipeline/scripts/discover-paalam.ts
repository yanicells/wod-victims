/**
 * Discover Paalam victim profile URLs from sitemap + WordPress REST API.
 * Writes/updates data/paalam/state.json (discoveredUrls only).
 *
 * Usage:
 *   pnpm discover:paalam
 *   pnpm discover:paalam -- --delay-ms=500 --max-rest-pages=2
 */
import { canonicalizePaalamUrl } from "./lib/canonicalize.js";
import { fetchText, sleep } from "./lib/http.js";
import { loadState, saveState } from "./lib/state.js";

type Args = {
  dryRun: boolean;
  delayMs: number;
  timeoutMs: number;
  restPageSize: number;
  maxRestPages: number | undefined;
};

const BASE_URL = "https://paalam.org";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const REST_URL = `${BASE_URL}/wp-json/wp/v2/victim`;
const VICTIM_PATH_MARKER = "/homepage/victims/";

function parseArgs(): Args {
  const args = process.argv.slice(2);

  function readNumberFlag(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const match = args.find((arg) => arg.startsWith(prefix));
    if (!match) return fallback;
    const value = Number(match.slice(prefix.length));
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid --${name}; expected a positive number.`);
    }
    return value;
  }

  const maxRestPagesArg = args.find((arg) => arg.startsWith("--max-rest-pages="));

  return {
    dryRun: args.includes("--dry-run"),
    delayMs: readNumberFlag("delay-ms", 500),
    timeoutMs: readNumberFlag("timeout-ms", 30_000),
    restPageSize: Math.min(readNumberFlag("rest-page-size", 100), 100),
    maxRestPages: maxRestPagesArg ? readNumberFlag("max-rest-pages", 1) : undefined
  };
}

function collectSitemapVictimUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1] ?? "")
    .filter((url) => url.includes(VICTIM_PATH_MARKER))
    .map(canonicalizePaalamUrl);
}

async function collectRestUrls(args: Args): Promise<{ urls: string[]; totalReported: number }> {
  const urls: string[] = [];
  let page = 1;
  let totalReported = 0;

  for (;;) {
    if (args.maxRestPages !== undefined && page > args.maxRestPages) {
      break;
    }

    const url = `${REST_URL}?per_page=${args.restPageSize}&page=${page}&_fields=link`;
    const response = await fetchText(url, args.timeoutMs, 1);

    if (response.status === 400) {
      break;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`REST page ${page} failed with HTTP ${response.status}`);
    }

    if (page === 1) {
      const totalHeader = response.headers.get("x-wp-total");
      totalReported = totalHeader ? Number(totalHeader) : 0;
    }

    const rows = JSON.parse(response.body) as Array<{ link?: string }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (row.link) {
        urls.push(canonicalizePaalamUrl(row.link));
      }
    }

    page += 1;
    await sleep(args.delayMs);
  }

  return { urls, totalReported };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`Discovering Paalam profiles (dryRun=${args.dryRun})…`);

  const sitemap = await fetchText(SITEMAP_URL, args.timeoutMs, 1);
  if (sitemap.status < 200 || sitemap.status >= 300) {
    throw new Error(`Sitemap fetch failed with HTTP ${sitemap.status}`);
  }

  const sitemapUrls = collectSitemapVictimUrls(sitemap.body);
  console.log(`Sitemap victim URLs: ${sitemapUrls.length}`);

  await sleep(args.delayMs);
  const rest = await collectRestUrls(args);
  console.log(`REST victim URLs: ${rest.urls.length} (reported total ${rest.totalReported})`);

  const merged = [...new Set([...sitemapUrls, ...rest.urls])].sort();
  console.log(`Merged unique URLs: ${merged.length}`);

  if (args.dryRun) {
    console.log("Dry run — state not written.");
    return;
  }

  const state = loadState();
  const before = new Set(state.discoveredUrls);
  const added = merged.filter((url) => !before.has(url));
  state.discoveredUrls = [...new Set([...state.discoveredUrls, ...merged])].sort();
  saveState(state);

  console.log(`Added ${added.length} new URLs. Total discovered: ${state.discoveredUrls.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
