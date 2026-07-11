/**
 * Normalize Paalam profile URLs so discovery and ingest share the same ID space.
 * Trailing-slash and query/hash variants of the same page must hash to one target ID.
 */
export function canonicalizePaalamUrl(url: string): string {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported Paalam URL protocol: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "paalam.org" && host !== "www.paalam.org") {
    throw new Error(`Unexpected Paalam URL host: ${parsed.hostname}`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("Paalam profile URLs must not include credentials");
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname.startsWith("/homepage/victims/") || pathname === "/homepage/victims") {
    throw new Error(`Not a Paalam victim profile URL: ${url}`);
  }

  parsed.protocol = "https:";
  parsed.hostname = "paalam.org";
  parsed.port = "";
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = `${pathname}/`;

  return parsed.toString();
}
