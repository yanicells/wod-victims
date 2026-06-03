import { z } from "zod";

// These enums keep tracker statuses consistent across future scripts.
// For example, we want "queued" everywhere, not "queue", "to_queue", etc.
export const SourceStatus = z.enum(["backlog", "approved", "active", "paused", "blocked", "retired"]);
export const TargetStatus = z.enum([
  "discovered",
  "queued",
  "scraped",
  "unchanged",
  "changed",
  "failed",
  "blocked",
  "out_of_scope",
  "retired"
]);
export const TargetType = z.enum(["index_page", "profile_page", "news_article", "dataset_page", "pdf", "api_endpoint", "unknown"]);
export const ExtractionStatus = z.enum([
  "not_started",
  "queued",
  "extracted",
  "validated",
  "failed",
  "skipped_unchanged",
  "needs_rerun"
]);
export const ReviewStatus = z.enum(["not_required", "queued", "in_review", "reviewed", "needs_follow_up"]);
export const ScrapeRunMode = z.enum(["discover", "initial_scrape", "recheck", "retry_failed", "backfill", "sample", "batch"]);

const optionalText = z.string().optional();

// Row schemas validate tracker rows once data gets added.
// Empty starter CSV files are okay because there are no rows to validate yet.
export const SourceRegistryRow = z.object({
  source_key: z.string().min(1),
  source_name: z.string().min(1),
  source_type: optionalText,
  base_url: optionalText,
  status: SourceStatus,
  priority: optionalText,
  owner: optionalText,
  robots_checked_at: optionalText,
  terms_notes: optionalText,
  scrape_strategy: optionalText,
  recheck_frequency_days: optionalText,
  last_discovery_run_id: optionalText,
  last_scrape_run_id: optionalText,
  notes: optionalText,
  created_at: optionalText,
  updated_at: optionalText
});

export const ScrapeTargetRow = z.object({
  target_id: z.string().min(1),
  source_key: z.string().min(1),
  url: z.string().min(1),
  canonical_url: optionalText,
  target_type: TargetType,
  discovered_at: optionalText,
  discovered_from_url: optionalText,
  status: TargetStatus,
  priority: optionalText,
  last_scraped_at: optionalText,
  last_success_at: optionalText,
  last_checked_at: optionalText,
  last_http_status: optionalText,
  last_content_hash: optionalText,
  latest_raw_html_path: optionalText,
  latest_raw_text_path: optionalText,
  latest_snapshot_id: optionalText,
  extraction_status: ExtractionStatus,
  review_status: ReviewStatus,
  failure_count: optionalText,
  next_retry_at: optionalText,
  notes: optionalText,
  created_at: optionalText,
  updated_at: optionalText
});

export const RecheckQueueRow = z.object({
  target_id: z.string().min(1),
  source_key: z.string().min(1),
  url: z.string().min(1),
  recheck_reason: optionalText,
  due_at: optionalText,
  priority: optionalText,
  status: optionalText,
  created_at: optionalText,
  updated_at: optionalText,
  notes: optionalText
});
