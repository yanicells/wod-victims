import type { ParsedPaalamProfile } from "./parse-paalam-profile.js";

export type PaalamVictimRecord = {
  id: string;
  source: "paalam";
  profileUrl: string;
  scrapedAt: string;
  contentHash: string;
  name: string | null;
  alias: string | null;
  gender: "male" | "female" | "unknown";
  age: number | null;
  maritalStatus: string | null;
  occupation: string | null;
  incidentType: string | null;
  dateKilled: string | null;
  datePrecision: "exact_date" | "month" | "year" | "unknown";
  dateRaw: string | null;
  timeOfIncident: string | null;
  locationRaw: string | null;
  cityMunicipality: string | null;
  province: string | null;
  region: string | null;
  locationPrecision: "barangay" | "city_municipality" | "province" | "unknown";
  sourceUrls: string[];
  narrative: string | null;
  warnings: string[];
  needsReview: boolean;
  reviewReasons: string[];
};

export function toVictimRecord(input: {
  id: string;
  profileUrl: string;
  scrapedAt: string;
  contentHash: string;
  parsed: ParsedPaalamProfile;
}): PaalamVictimRecord {
  const { parsed } = input;

  return {
    id: input.id,
    source: "paalam",
    profileUrl: input.profileUrl,
    scrapedAt: input.scrapedAt,
    contentHash: input.contentHash,
    name: parsed.name,
    alias: parsed.alias,
    gender: parsed.gender,
    age: parsed.age,
    maritalStatus: parsed.maritalStatus,
    occupation: parsed.occupation,
    incidentType: parsed.incidentType,
    dateKilled: parsed.dateKilled,
    datePrecision: parsed.datePrecision,
    dateRaw: parsed.dateRaw,
    timeOfIncident: parsed.timeOfIncident,
    locationRaw: parsed.location.raw,
    cityMunicipality: parsed.location.cityMunicipality,
    province: parsed.location.province,
    region: parsed.location.region,
    locationPrecision: parsed.location.precision,
    sourceUrls: parsed.sourceUrls,
    narrative: parsed.narrative,
    warnings: parsed.warnings,
    needsReview: parsed.needsReview,
    reviewReasons: parsed.reviewReasons
  };
}
