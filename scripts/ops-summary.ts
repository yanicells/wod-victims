import { countBy, formatCounts } from "./lib/counts.js";
import { readCsvRows } from "./lib/csv.js";
import { readJsonlRows } from "./lib/jsonl.js";
import { fromRoot } from "./lib/paths.js";

const sources = readCsvRows(fromRoot("data/ops/source_registry.csv"));
const targets = readCsvRows(fromRoot("data/ops/scrape_targets.csv"));
const recheckItems = readCsvRows(fromRoot("data/ops/recheck_queue.csv"));
const scrapeRuns = readJsonlRows(fromRoot("data/ops/scrape_runs.jsonl"));

console.log("Data Operations Summary");
console.log("=======================");

console.log(`Sources: ${sources.length}`);
console.log(`  by status: ${formatCounts(countBy(sources, "status"))}`);

console.log(`\nScrape targets: ${targets.length}`);
console.log(`  by status: ${formatCounts(countBy(targets, "status"))}`);
console.log(`  by extraction status: ${formatCounts(countBy(targets, "extraction_status"))}`);
console.log(`  by review status: ${formatCounts(countBy(targets, "review_status"))}`);

console.log(`\nRecheck queue items: ${recheckItems.length}`);
console.log(`  by status: ${formatCounts(countBy(recheckItems, "status"))}`);

console.log(`\nScrape runs: ${scrapeRuns.length}`);
