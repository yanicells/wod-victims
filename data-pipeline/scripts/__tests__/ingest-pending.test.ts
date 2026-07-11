import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs, pendingUrls } from "../ingest-paalam.js";
import { makeTargetId } from "../lib/ids.js";

describe("ingest pending URL selection", () => {
  const base = "https://paalam.org/homepage/victims/johndy-maglinte";
  const canonical = `${base}/`;
  const id = makeTargetId("paalam", canonical);

  it("skips explicit --url values that are already completed", () => {
    const selected = pendingUrls([], new Set([id]), [
      `${base}?utm=1`,
      `${base}/#x`
    ]);
    assert.deepEqual(selected.queue, []);
    assert.equal(selected.skippedAlreadyDone, 2);
  });

  it("canonicalizes and dedupes explicit URL variants", () => {
    const selected = pendingUrls([], new Set(), [
      base,
      `${base}/`,
      `${base}?x=1`
    ]);
    assert.deepEqual(selected.queue, [canonical]);
  });

  it("filters discovered URLs against completed IDs", () => {
    const other = "https://paalam.org/homepage/victims/romnick-garces/";
    const selected = pendingUrls([canonical, other], new Set([id]), []);
    assert.deepEqual(selected.queue, [other]);
  });

  it("keeps zero retries but rejects a disabled failure cutoff", () => {
    assert.equal(parseArgs(["--retries=0"]).retries, 0);
    assert.throws(
      () => parseArgs(["--max-consecutive-failures=0"]),
      /Invalid --max-consecutive-failures/
    );
  });
});
