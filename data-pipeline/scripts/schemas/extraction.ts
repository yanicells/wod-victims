import { z } from "zod";

const Confidence = z.number().min(0).max(1);

const EvidenceString = z.string();

const NullableTextField = z.object({
  value: z.string().nullable(),
  source_quote: EvidenceString,
  confidence: Confidence
});

const NullableNumberField = z.object({
  value: z.number().int().nonnegative().nullable(),
  source_quote: EvidenceString,
  confidence: Confidence
});

export const PaalamExtractionRecord = z.object({
  source_key: z.literal("paalam"),
  target_id: z.string().min(1),
  snapshot_id: z.string().min(1),
  source_url: z.string().url(),
  raw_text_path: z.string().min(1),
  profile_url: z.string().url(),
  name: NullableTextField,
  age: NullableNumberField,
  gender: z.object({
    value: z.enum(["male", "female", "unknown"]),
    source_quote: EvidenceString,
    confidence: Confidence
  }),
  date_killed: z.object({
    value: z.string().nullable(),
    date_precision: z.enum(["exact_date", "month", "year", "unknown"]),
    source_quote: EvidenceString,
    confidence: Confidence
  }),
  location: z.object({
    raw_location: z.string().nullable(),
    barangay: z.string().nullable(),
    city_municipality: z.string().nullable(),
    province: z.string().nullable(),
    region: z.string().nullable(),
    location_precision: z.enum(["exact_public_location", "barangay", "city_municipality", "province", "unknown"]),
    source_quote: EvidenceString,
    confidence: Confidence
  }),
  incident_context: z.object({
    short_summary: z.string(),
    source_quote: EvidenceString,
    confidence: Confidence
  }),
  source_urls: z.array(z.string().url()),
  warnings: z.array(z.string()),
  needs_review: z.boolean(),
  review_reason: z.string()
});

export type PaalamExtractionRecordType = z.infer<typeof PaalamExtractionRecord>;

