import * as cheerio from "cheerio";

const PAALAM_HOST = "paalam.org";
const SOCIAL_OR_UTILITY_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "www.pinterest.com",
  "plus.google.com",
  "google.com",
  "www.google.com"
]);

// Turn HTML into readable text for later AI extraction.
// This is intentionally simple: remove non-content elements, then collapse whitespace.
export function htmlToVisibleText(html: string): string {
  const $ = cheerio.load(html);

  // These tags either run code, style the page, embed media, or repeat navigation.
  // Removing them keeps the text file readable while preserving actual page wording.
  $("script, style, noscript, svg, img, iframe, form").remove();

  const text = $("body").text();

  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function normalizeLink(href: string, pageUrl: string): string | undefined {
  try {
    const url = new URL(href, pageUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function looksLikeSourceHeader(text: string): boolean {
  return text.trim().toLowerCase().startsWith("source");
}

function isUsefulOutgoingSourceLink(url: string): boolean {
  const host = new URL(url).hostname.toLowerCase();

  if (host === PAALAM_HOST || host.endsWith(`.${PAALAM_HOST}`)) {
    return false;
  }

  return !SOCIAL_OR_UTILITY_HOSTS.has(host);
}

// Extract the source links Paalam lists on a victim profile page.
// First we look under the visible "Source(s)" section; if that fails, we fall back
// to external links while excluding obvious social/share links.
export function extractOutgoingSourceLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const sourceLinks = new Set<string>();

  $("h1, h2, h3, h4, h5, h6").each((_, header) => {
    if (!looksLikeSourceHeader($(header).text())) {
      return;
    }

    $(header)
      .nextUntil("h1, h2, h3, h4, h5, h6")
      .find("a[href]")
      .each((__, link) => {
        const normalized = normalizeLink($(link).attr("href") ?? "", pageUrl);
        if (normalized && isUsefulOutgoingSourceLink(normalized)) {
          sourceLinks.add(normalized);
        }
      });
  });

  if (sourceLinks.size > 0) {
    return [...sourceLinks].sort();
  }

  $("a[href]").each((_, link) => {
    const normalized = normalizeLink($(link).attr("href") ?? "", pageUrl);
    if (normalized && isUsefulOutgoingSourceLink(normalized)) {
      sourceLinks.add(normalized);
    }
  });

  return [...sourceLinks].sort();
}

