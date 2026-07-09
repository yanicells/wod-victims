import fs from "node:fs";
import { fromRoot } from "./paths.js";

export type IngestState = {
  source: "paalam";
  updatedAt: string;
  discoveredUrls: string[];
  completedIds: string[];
  failed: Array<{
    id: string;
    url: string;
    error: string;
    failedAt: string;
    attempts: number;
  }>;
};

const DEFAULT_STATE: IngestState = {
  source: "paalam",
  updatedAt: new Date(0).toISOString(),
  discoveredUrls: [],
  completedIds: [],
  failed: []
};

export function statePath(): string {
  return fromRoot("data/paalam/state.json");
}

export function victimsPath(): string {
  return fromRoot("data/paalam/victims.jsonl");
}

export function cacheDir(): string {
  return fromRoot("data/cache/paalam");
}

export function loadState(): IngestState {
  const path = statePath();
  if (!fs.existsSync(path)) {
    return structuredClone(DEFAULT_STATE);
  }

  return JSON.parse(fs.readFileSync(path, "utf8")) as IngestState;
}

export function saveState(state: IngestState): void {
  const path = statePath();
  fs.mkdirSync(fromRoot("data/paalam"), { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function loadVictimIds(filePath = victimsPath()): Set<string> {
  if (!fs.existsSync(filePath)) {
    return new Set();
  }

  const ids = new Set<string>();
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as { id?: string };
    if (row.id) ids.add(row.id);
  }
  return ids;
}
