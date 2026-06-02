import crypto from "node:crypto";

// Keep IDs deterministic so rerunning discovery does not create duplicate targets.
export function makeTargetId(sourceKey: string, canonicalUrl: string): string {
  const digest = crypto.createHash("sha1").update(canonicalUrl).digest("hex").slice(0, 12);
  return `${sourceKey}_profile_${digest}`;
}

export function makeRunId(sourceKey: string, mode: string, startedAt: string): string {
  const compactTime = startedAt.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
  return `${sourceKey}_${mode}_${compactTime}`;
}

export function makeSnapshotId(targetId: string, fetchedAt: string, contentHash: string): string {
  const compactTime = fetchedAt.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
  return `${targetId}_${compactTime}_${contentHash.slice(0, 8)}`;
}
