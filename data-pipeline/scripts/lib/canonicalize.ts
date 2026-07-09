/**
 * Normalize Paalam profile URLs so discovery and ingest share the same ID space.
 * Trailing-slash and query/hash variants of the same page must hash to one target ID.
 */
export function canonicalizePaalamUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";

  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }

  return parsed.toString();
}
