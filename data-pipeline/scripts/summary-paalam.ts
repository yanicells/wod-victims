/**
 * Summarize the current Paalam dataset.
 *
 * Usage: pnpm summary:paalam
 */
import fs from "node:fs";
import { loadState, victimsPath } from "./lib/state.js";
import type { PaalamVictimRecord } from "./lib/paalam-record.js";

function main(): void {
  const state = loadState();
  const path = victimsPath();
  const rows: PaalamVictimRecord[] = [];

  if (fs.existsSync(path)) {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      rows.push(JSON.parse(line) as PaalamVictimRecord);
    }
  }

  const needsReview = rows.filter((row) => row.needsReview);
  const withDate = rows.filter((row) => row.dateKilled);
  const withLoc = rows.filter((row) => row.locationRaw);
  const withSources = rows.filter((row) => row.sourceUrls.length > 0);
  const withAge = rows.filter((row) => row.age !== null);

  const reasonCounts = new Map<string, number>();
  for (const row of needsReview) {
    for (const reason of row.reviewReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  console.log(
    JSON.stringify(
      {
        discovered_urls: state.discoveredUrls.length,
        completed_ids: state.completedIds.length,
        failed: state.failed.length,
        victims: rows.length,
        with_name: rows.filter((row) => row.name).length,
        with_date: withDate.length,
        with_location: withLoc.length,
        with_sources: withSources.length,
        with_age: withAge.length,
        needs_review: needsReview.length,
        review_reason_counts: Object.fromEntries(
          [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])
        ),
        sample: rows.slice(0, 3).map((row) => ({
          name: row.name,
          dateKilled: row.dateKilled,
          locationRaw: row.locationRaw,
          sourceUrls: row.sourceUrls.length,
          needsReview: row.needsReview
        }))
      },
      null,
      2
    )
  );
}

main();
