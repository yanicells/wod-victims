import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalizePaalamUrl } from "../lib/canonicalize.js";
import { makeTargetId } from "../lib/ids.js";

/**
 * Mirrors ingest pendingUrls filtering so we can unit-test the idempotency
 * contract without spinning up the full CLI.
 */
function selectPending(
  discovered: string[],
  completedIds: Set<string>,
  explicit: string[]
): string[] {
  const source = explicit.length > 0 ? explicit : discovered;
  const seen = new Set<string>();
  const queue: string[] = [];

  for (const raw of source) {
    const canonical = canonicalizePaalamUrl(raw);
    const id = makeTargetId("paalam", canonical);
    if (completedIds.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    queue.push(canonical);
  }

  return queue;
}

describe("ingest pending URL selection", () => {
  const base = "https://paalam.org/homepage/victims/johndy-maglinte";
  const canonical = `${base}/`;
  const id = makeTargetId("paalam", canonical);

  it("skips explicit --url values that are already completed", () => {
    const queue = selectPending([], new Set([id]), [`${base}?utm=1`, `${base}/#x`]);
    assert.deepEqual(queue, []);
  });

  it("canonicalizes and dedupes explicit URL variants", () => {
    const queue = selectPending([], new Set(), [base, `${base}/`, `${base}?x=1`]);
    assert.deepEqual(queue, [canonical]);
  });

  it("filters discovered URLs against completed IDs", () => {
    const other = "https://paalam.org/homepage/victims/romnick-garces/";
    const queue = selectPending([canonical, other], new Set([id]), []);
    assert.deepEqual(queue, [other]);
  });
});
