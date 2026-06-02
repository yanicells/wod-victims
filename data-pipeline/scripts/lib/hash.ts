import crypto from "node:crypto";

// A content hash lets us tell whether a page changed between two fetches.
// We hash raw HTML, not cleaned text, because raw HTML is the actual source capture.
export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

