1. You run (scrape → prep). Smaller chunks because the site throttles after ~7 rapid hits:
```
pnpm scrape:paalam:batch -- --limit=15 --delay-ms=3000
pnpm scrape:paalam:retry -- --limit=15 --delay-ms=4000 --force   # mop up any new failures
pnpm review:paalam:scrape-quality
pnpm prepare:paalam:extraction -- --limit=50
```

The last command prints a batch id like paalam_extraction_batch_2026....

2. Hand off to me — just paste this line (with the real id):
```
extract batch paalam_extraction_batch_<id>
```

I'll read the batch, write <id>_extracted.jsonl, and report counts. I don't run anything.

3. You land it (after I report done):
```
cat data/intermediate/extractions/batches/<id>_extracted.jsonl >> data/intermediate/extractions/paalam_ai_extracts.jsonl
pnpm validate:paalam:extraction
pnpm ops:summary
```
