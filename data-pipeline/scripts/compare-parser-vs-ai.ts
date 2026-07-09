/**
 * Offline accuracy check: parse every saved Paalam HTML snapshot and compare
 * core fields against the previous AI extraction file (when present).
 *
 * Run: pnpm --filter @wod-victims/data-pipeline exec tsx scripts/compare-parser-vs-ai.ts
 */
import fs from "node:fs";
import path from "node:path";
import { parsePaalamProfile } from "./lib/parse-paalam-profile.js";
import { fromRoot } from "./lib/paths.js";

type AiRecord = {
  target_id: string;
  name?: { value?: string | null };
  age?: { value?: number | null };
  gender?: { value?: string | null };
  date_killed?: { value?: string | null };
  location?: {
    raw_location?: string | null;
    city_municipality?: string | null;
    province?: string | null;
  };
  source_urls?: string[];
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoc(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function main(): void {
  const snapshotsDir = fromRoot("data/raw/paalam/snapshots");
  const aiPath = fromRoot("data/intermediate/extractions/paalam_ai_extracts.jsonl");

  if (!fs.existsSync(snapshotsDir)) {
    console.error("No snapshots directory found.");
    process.exit(1);
  }

  const aiByTarget = new Map<string, AiRecord>();
  if (fs.existsSync(aiPath)) {
    for (const line of fs.readFileSync(aiPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as AiRecord;
      aiByTarget.set(row.target_id, row);
    }
  }

  const htmlFiles = fs
    .readdirSync(snapshotsDir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => path.join(snapshotsDir, name));

  let parsedOk = 0;
  let withName = 0;
  let withDate = 0;
  let withLoc = 0;
  let withSources = 0;
  let compared = 0;
  let nameMatch = 0;
  let dateMatch = 0;
  let locMatch = 0;
  let ageMatch = 0;
  const diffs: string[] = [];

  for (const file of htmlFiles) {
    const base = path.basename(file);
    const targetMatch = base.match(/^(paalam_profile_[0-9a-f]+)_/);
    if (!targetMatch) continue;

    const targetId = targetMatch[1]!;
    const html = fs.readFileSync(file, "utf8");
    const parsed = parsePaalamProfile(html);
    parsedOk += 1;

    if (parsed.name) withName += 1;
    if (parsed.dateKilled) withDate += 1;
    if (parsed.location.raw) withLoc += 1;
    if (parsed.sourceUrls.length > 0) withSources += 1;

    const ai = aiByTarget.get(targetId);
    if (!ai) continue;

    compared += 1;

    const aiName = normalizeName(ai.name?.value ?? null);
    const parserName = normalizeName(parsed.name);
    if (aiName && parserName && (parserName === aiName || parserName.includes(aiName) || aiName.includes(parserName))) {
      nameMatch += 1;
    } else if (aiName || parserName) {
      diffs.push(`name ${targetId}: parser=${parsed.name} ai=${ai.name?.value}`);
    } else {
      nameMatch += 1;
    }

    if ((parsed.dateKilled ?? null) === (ai.date_killed?.value ?? null)) {
      dateMatch += 1;
    } else {
      diffs.push(
        `date ${targetId}: parser=${parsed.dateKilled} ai=${ai.date_killed?.value} raw=${parsed.dateRaw}`
      );
    }

    const pLoc = normalizeLoc(parsed.location.raw);
    const aLoc = normalizeLoc(ai.location?.raw_location ?? null);
    if (pLoc === aLoc) {
      locMatch += 1;
    } else {
      diffs.push(`loc ${targetId}: parser=${parsed.location.raw} ai=${ai.location?.raw_location}`);
    }

    if ((parsed.age ?? null) === (ai.age?.value ?? null)) {
      ageMatch += 1;
    } else {
      // Prefer parser when AI invented age from narrative and profile has none.
      diffs.push(`age ${targetId}: parser=${parsed.age} ai=${ai.age?.value}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        html_files: htmlFiles.length,
        parsed: parsedOk,
        coverage: {
          name: withName,
          date: withDate,
          location: withLoc,
          sources: withSources
        },
        vs_ai: {
          compared,
          name_match: nameMatch,
          date_match: dateMatch,
          location_match: locMatch,
          age_match: ageMatch
        },
        diff_count: diffs.length,
        diffs: diffs.slice(0, 30)
      },
      null,
      2
    )
  );
}

main();
