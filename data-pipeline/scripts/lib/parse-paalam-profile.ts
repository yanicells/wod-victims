import * as cheerio from "cheerio";

export type DatePrecision = "exact_date" | "month" | "year" | "unknown";
export type LocationPrecision =
  | "barangay"
  | "city_municipality"
  | "province"
  | "unknown";
export type Gender = "male" | "female" | "unknown";

export type ParsedLocation = {
  raw: string | null;
  cityMunicipality: string | null;
  province: string | null;
  region: string | null;
  precision: LocationPrecision;
};

export type ParsedPaalamProfile = {
  name: string | null;
  alias: string | null;
  gender: Gender;
  age: number | null;
  maritalStatus: string | null;
  occupation: string | null;
  incidentType: string | null;
  dateKilled: string | null;
  datePrecision: DatePrecision;
  dateRaw: string | null;
  timeOfIncident: string | null;
  location: ParsedLocation;
  sourceUrls: string[];
  narrative: string | null;
  warnings: string[];
  needsReview: boolean;
  reviewReasons: string[];
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const SITE_NAME_SUFFIX = /\s*[-–—]\s*Paalam\.org.*$/i;
const METRO_MANILA_ALIASES = new Set([
  "metro manila",
  "ncr",
  "national capital region"
]);

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "") // soft hyphen from WordPress copy
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocationText(value: string): string {
  let normalized = cleanText(value)
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Common Paalam typo seen in the wild.
  normalized = normalized.replace(/\bMetro Manilaa\b/gi, "Metro Manila");

  return normalized;
}

function parseGender(value: string | undefined): Gender {
  if (!value) {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") {
    return "male";
  }
  if (normalized === "female" || normalized === "f") {
    return "female";
  }

  return "unknown";
}

function parseAge(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,3})\b/);
  if (!match) {
    return null;
  }

  const age = Number(match[1]);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return null;
  }

  return age;
}

export function parseIncidentDate(raw: string | null | undefined): {
  iso: string | null;
  precision: DatePrecision;
} {
  if (!raw) {
    return { iso: null, precision: "unknown" };
  }

  const text = cleanText(raw);

  // "June 17, 2021" / "June 17 2021"
  const full = text.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/
  );
  if (full) {
    const month = MONTHS[full[1]!.toLowerCase()];
    const day = Number(full[2]);
    const year = Number(full[3]);
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return {
        iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        precision: "exact_date"
      };
    }
  }

  // "June 2021"
  const monthYear = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    const year = Number(monthYear[2]);
    if (month && year >= 1900 && year <= 2100) {
      return {
        iso: `${year}-${String(month).padStart(2, "0")}`,
        precision: "month"
      };
    }
  }

  // "2021"
  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year >= 1900 && year <= 2100) {
      return { iso: String(year), precision: "year" };
    }
  }

  return { iso: null, precision: "unknown" };
}

export function parseLocation(raw: string | null | undefined): ParsedLocation {
  if (!raw) {
    return {
      raw: null,
      cityMunicipality: null,
      province: null,
      region: null,
      precision: "unknown"
    };
  }

  const normalized = normalizeLocationText(raw);
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      raw: normalized,
      cityMunicipality: null,
      province: null,
      region: null,
      precision: "unknown"
    };
  }

  if (parts.length === 1) {
    const only = parts[0]!;
    if (METRO_MANILA_ALIASES.has(only.toLowerCase())) {
      return {
        raw: normalized,
        cityMunicipality: null,
        province: null,
        region: "National Capital Region",
        precision: "province"
      };
    }

    return {
      raw: normalized,
      cityMunicipality: only,
      province: null,
      region: null,
      precision: "city_municipality"
    };
  }

  const city = parts[0]!;
  const second = parts[1]!;

  if (METRO_MANILA_ALIASES.has(second.toLowerCase())) {
    return {
      raw: normalized,
      cityMunicipality: city,
      province: null,
      region: "National Capital Region",
      precision: "city_municipality"
    };
  }

  return {
    raw: normalized,
    cityMunicipality: city,
    province: second,
    region: null,
    precision: "city_municipality"
  };
}

function isUsableSourceUrl(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const host = url.hostname.toLowerCase();
    if (host === "paalam.org" || host.endsWith(".paalam.org")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function extractLabeledDetails($: cheerio.CheerioAPI): {
  fields: Record<string, string>;
  incidentType: string | null;
} {
  const fields: Record<string, string> = {};
  let incidentType: string | null = null;

  $("ul.plm-details").each((_, list) => {
    const className = ($(list).attr("class") ?? "").toLowerCase();
    if (className.includes("source")) {
      return;
    }

    $(list)
      .children("li")
      .each((__, item) => {
        const text = cleanText($(item).text());
        if (!text) {
          return;
        }

        const colon = text.indexOf(":");
        if (colon === -1) {
          if (!incidentType) {
            incidentType = text;
          }
          return;
        }

        const key = text.slice(0, colon).trim().toLowerCase();
        const value = text.slice(colon + 1).trim();
        if (key && value && !(key in fields)) {
          fields[key] = value;
        }
      });
  });

  return { fields, incidentType };
}

function extractSourceUrls($: cheerio.CheerioAPI): {
  urls: string[];
  malformed: string[];
} {
  const urls: string[] = [];
  const malformed: string[] = [];
  const seen = new Set<string>();

  $("ul.plm-details.source a[href]").each((_, link) => {
    const href = cleanText($(link).attr("href") ?? "");
    if (!href) {
      return;
    }

    if (!isUsableSourceUrl(href)) {
      malformed.push(href);
      return;
    }

    if (!seen.has(href)) {
      seen.add(href);
      urls.push(href);
    }
  });

  return { urls, malformed };
}

function extractNarrative($: cheerio.CheerioAPI): string | null {
  const paragraphs: string[] = [];

  $("p").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || text.length < 40) {
      return;
    }

    const lower = text.toLowerCase();
    if (
      lower.includes("please upgrade") ||
      lower.includes("modern browser") ||
      lower.includes("back to browsing")
    ) {
      return;
    }

    paragraphs.push(text);
  });

  if (paragraphs.length === 0) {
    return null;
  }

  return paragraphs.slice(0, 3).join("\n\n");
}

function looksAnonymous(name: string | null): boolean {
  if (!name) {
    return true;
  }

  return /^anonymous\b/i.test(name);
}

function looksSensitiveOccupation(occupation: string | null): boolean {
  if (!occupation) {
    return false;
  }

  return /\b(mayor|governor|councilor|kagawad|congressman|senator|judge|priest|pastor|police|officer)\b/i.test(
    occupation
  );
}

/**
 * Parse a Paalam victim profile HTML page into structured fields.
 * Uses the labeled `plm-details` blocks only — never invents values from narrative.
 */
export function parsePaalamProfile(html: string): ParsedPaalamProfile {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const reviewReasons: string[] = [];

  let name =
    cleanText($("h1.post-title").first().text()) ||
    cleanText($("h1").first().text()) ||
    null;

  if (name) {
    name = name.replace(SITE_NAME_SUFFIX, "").trim() || null;
  }

  if (!name) {
    const og = $("meta[property='og:title']").attr("content");
    if (og) {
      name = cleanText(og).replace(SITE_NAME_SUFFIX, "").trim() || null;
    }
  }

  const { fields, incidentType } = extractLabeledDetails($);
  const { urls: sourceUrls, malformed } = extractSourceUrls($);
  const narrative = extractNarrative($);

  const age = parseAge(fields["age"]);
  const dateRaw = fields["date of incident"] ?? null;
  const parsedDate = parseIncidentDate(dateRaw);
  const location = parseLocation(fields["location of incident"]);
  const occupation = fields["occupation"] ?? null;
  const alias = fields["alias"] ?? null;
  const gender = parseGender(fields["sex"]);

  if (malformed.length > 0) {
    warnings.push(`Malformed source link(s): ${malformed.join("; ")}`);
    reviewReasons.push("malformed_source_link");
  }

  if (sourceUrls.length === 0) {
    reviewReasons.push("missing_source_url");
  }

  if (!name) {
    reviewReasons.push("missing_name");
  } else if (looksAnonymous(name)) {
    reviewReasons.push("anonymous_or_unnamed");
  }

  if (!dateRaw || parsedDate.precision === "unknown") {
    reviewReasons.push("missing_or_unparsed_date");
  }

  if (!location.raw) {
    reviewReasons.push("missing_location");
  }

  if (looksSensitiveOccupation(occupation)) {
    reviewReasons.push("sensitive_public_figure");
  }

  // Age in narrative but not in profile box — do not invent; just note.
  if (age === null && narrative && /\b\d{1,3}-year-old\b/i.test(narrative)) {
    warnings.push("Age mentioned in narrative but missing from profile details.");
  }

  return {
    name,
    alias,
    gender,
    age,
    maritalStatus: fields["marital status"] ?? null,
    occupation,
    incidentType,
    dateKilled: parsedDate.iso,
    datePrecision: parsedDate.precision,
    dateRaw,
    timeOfIncident: fields["time of incident"] ?? null,
    location,
    sourceUrls,
    narrative,
    warnings,
    needsReview: reviewReasons.length > 0,
    reviewReasons
  };
}
