# Paalam Extraction Batch Prompt

Read each JSONL input row in:

```text
data/intermediate/extractions/batches/paalam_extraction_batch_20260604054601.jsonl
```

For each row, extract one strict JSON object that matches the schema in:

```text
guide/09_PAALAM_EXTRACTION_SCHEMA.md
```

Append outputs to:

```text
data/intermediate/extractions/paalam_ai_extracts.jsonl
```

Rules:

- Do not invent missing data.
- Every non-null field needs a source quote.
- Preserve `source_key`, `target_id`, `snapshot_id`, `source_url`, `raw_text_path`, and `profile_url`.
- Use null for missing values.
- Use confidence from 0 to 1.
- Mark uncertain rows with `needs_review: true`.
- Return JSONL only if asked to produce output.
