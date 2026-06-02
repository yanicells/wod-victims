import { z } from "zod";
import { RecheckQueueRow, ScrapeTargetRow, SourceRegistryRow } from "./ops.js";

export type CsvExpectation = {
  path: string;
  columns: string[];
  rowSchema?: z.ZodType;
};

export const expectedDirectories = [
  "data/ops",
  "data/raw/paalam/pages",
  "data/raw/paalam/index_pages",
  "data/raw/paalam/snapshots",
  "data/raw/paalam/manifests",
  "data/raw/news/pages",
  "data/raw/news/snapshots",
  "data/raw/news/manifests",
  "data/intermediate/extractions",
  "data/intermediate/normalized",
  "data/intermediate/dedupe",
  "data/processed",
  "data/qa",
  "scripts",
  "docs"
];

export const expectedCsvFiles: CsvExpectation[] = [
  {
    path: "data/ops/source_registry.csv",
    columns: [
      "source_key",
      "source_name",
      "source_type",
      "base_url",
      "status",
      "priority",
      "owner",
      "robots_checked_at",
      "terms_notes",
      "scrape_strategy",
      "recheck_frequency_days",
      "last_discovery_run_id",
      "last_scrape_run_id",
      "notes",
      "created_at",
      "updated_at"
    ],
    rowSchema: SourceRegistryRow
  },
  {
    path: "data/ops/scrape_targets.csv",
    columns: [
      "target_id",
      "source_key",
      "url",
      "canonical_url",
      "target_type",
      "discovered_at",
      "discovered_from_url",
      "status",
      "priority",
      "last_scraped_at",
      "last_success_at",
      "last_checked_at",
      "last_http_status",
      "last_content_hash",
      "latest_raw_html_path",
      "latest_raw_text_path",
      "latest_snapshot_id",
      "extraction_status",
      "review_status",
      "failure_count",
      "next_retry_at",
      "notes",
      "created_at",
      "updated_at"
    ],
    rowSchema: ScrapeTargetRow
  },
  {
    path: "data/ops/recheck_queue.csv",
    columns: ["target_id", "source_key", "url", "recheck_reason", "due_at", "priority", "status", "created_at", "updated_at", "notes"],
    rowSchema: RecheckQueueRow
  },
  {
    path: "data/processed/victims.csv",
    columns: [
      "victim_id",
      "canonical_name",
      "display_name",
      "alternate_names",
      "age",
      "age_confidence",
      "gender",
      "date_killed",
      "date_precision",
      "location_id",
      "incident_id",
      "profile_url",
      "source_dataset",
      "verification_status",
      "confidence_level",
      "needs_review",
      "public_notes",
      "internal_notes",
      "created_at",
      "updated_at"
    ]
  },
  {
    path: "data/processed/incidents.csv",
    columns: [
      "incident_id",
      "date",
      "date_precision",
      "location_id",
      "fatalities_count",
      "incident_type",
      "actor_type",
      "source_summary",
      "confidence_level",
      "needs_review",
      "created_at",
      "updated_at"
    ]
  },
  {
    path: "data/processed/sources.csv",
    columns: [
      "source_id",
      "source_key",
      "target_id",
      "snapshot_id",
      "source_url",
      "canonical_url",
      "source_title",
      "source_type",
      "publisher",
      "published_date",
      "scraped_at",
      "raw_html_path",
      "raw_text_path",
      "access_status",
      "notes"
    ]
  },
  {
    path: "data/qa/review_queue.csv",
    columns: [
      "review_id",
      "record_type",
      "record_id",
      "source_key",
      "target_id",
      "issue_type",
      "issue_description",
      "priority",
      "assigned_to",
      "status",
      "review_notes",
      "created_at",
      "resolved_at"
    ]
  },
  {
    path: "data/qa/rejected_records.csv",
    columns: ["record_type", "record_id", "source_key", "target_id", "issue_type", "reason", "rejected_at", "rejected_by", "notes"]
  },
  {
    path: "data/qa/manual_fixes.csv",
    columns: ["fix_id", "record_type", "record_id", "field_name", "old_value", "new_value", "source_quote", "reason", "fixed_by", "fixed_at", "notes"]
  }
];

export const expectedJsonlFiles = [
  "data/ops/scrape_runs.jsonl",
  "data/raw/paalam/failed_urls.jsonl",
  "data/raw/news/failed_urls.jsonl",
  "data/intermediate/extractions/paalam_ai_extracts.jsonl",
  "data/intermediate/extractions/news_ai_extracts.jsonl",
  "data/intermediate/normalized/victims_normalized.jsonl",
  "data/intermediate/normalized/locations_normalized.jsonl",
  "data/intermediate/dedupe/candidate_duplicates.jsonl"
];

