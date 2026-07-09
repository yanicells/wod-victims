import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseIncidentDate,
  parseLocation,
  parsePaalamProfile
} from "../lib/parse-paalam-profile.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures"
);

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("parseIncidentDate", () => {
  it("parses exact dates", () => {
    assert.deepEqual(parseIncidentDate("June 17, 2021"), {
      iso: "2021-06-17",
      precision: "exact_date"
    });
    assert.deepEqual(parseIncidentDate("May 1, 2021"), {
      iso: "2021-05-01",
      precision: "exact_date"
    });
  });

  it("parses month and year", () => {
    assert.deepEqual(parseIncidentDate("August 2016"), {
      iso: "2016-08",
      precision: "month"
    });
  });

  it("parses year only", () => {
    assert.deepEqual(parseIncidentDate("2016"), {
      iso: "2016",
      precision: "year"
    });
  });

  it("returns unknown for empty or junk", () => {
    assert.deepEqual(parseIncidentDate(null), {
      iso: null,
      precision: "unknown"
    });
    assert.deepEqual(parseIncidentDate("sometime last year"), {
      iso: null,
      precision: "unknown"
    });
  });
});

describe("parseLocation", () => {
  it("splits city and province", () => {
    assert.deepEqual(parseLocation("Binan, Laguna"), {
      raw: "Binan, Laguna",
      cityMunicipality: "Binan",
      province: "Laguna",
      region: null,
      precision: "city_municipality"
    });
  });

  it("normalizes spaced commas", () => {
    assert.equal(
      parseLocation("Cabanatuan , Nueva Ecija").raw,
      "Cabanatuan, Nueva Ecija"
    );
  });

  it("maps Metro Manila to NCR", () => {
    const parsed = parseLocation("Manila, Metro Manila");
    assert.equal(parsed.cityMunicipality, "Manila");
    assert.equal(parsed.region, "National Capital Region");
    assert.equal(parsed.province, null);
  });
});

describe("parsePaalamProfile fixtures", () => {
  it("parses a full profile (Johndy Maglinte)", () => {
    const parsed = parsePaalamProfile(readFixture("johndy-full.html"));
    assert.equal(parsed.name, "Johndy Maglinte");
    assert.equal(parsed.gender, "male");
    assert.equal(parsed.age, 16);
    assert.equal(parsed.maritalStatus, "Single");
    assert.equal(parsed.incidentType, "Killed in police operation");
    assert.equal(parsed.dateKilled, "2021-06-17");
    assert.equal(parsed.datePrecision, "exact_date");
    assert.equal(parsed.location.raw, "Binan, Laguna");
    assert.equal(parsed.location.cityMunicipality, "Binan");
    assert.equal(parsed.location.province, "Laguna");
    assert.deepEqual(parsed.sourceUrls, [
      "https://www.rappler.com/nation/cops-kill-16-year-old-boy-laguna-anti-drug-operation"
    ]);
    assert.equal(parsed.needsReview, false);
  });

  it("handles missing age without inventing it", () => {
    const parsed = parsePaalamProfile(readFixture("no-age.html"));
    assert.equal(parsed.name, "Obet Tington");
    assert.equal(parsed.age, null);
    assert.equal(parsed.gender, "male");
    assert.equal(parsed.dateKilled, "2021-05-31");
    assert.equal(parsed.location.cityMunicipality, "Manila");
    assert.ok(parsed.sourceUrls.length >= 1);
  });

  it("flags anonymous names for review", () => {
    const parsed = parsePaalamProfile(readFixture("anonymous.html"));
    assert.equal(parsed.name, "Anonymous");
    assert.ok(parsed.needsReview);
    assert.ok(parsed.reviewReasons.includes("anonymous_or_unnamed"));
  });

  it("normalizes location spacing typos", () => {
    const parsed = parsePaalamProfile(readFixture("loc-typo-spaces.html"));
    assert.equal(parsed.location.raw, "Cabanatuan, Nueva Ecija");
    assert.equal(parsed.location.cityMunicipality, "Cabanatuan");
    assert.equal(parsed.location.province, "Nueva Ecija");
  });

  it("keeps alias/occupation and flags public figures", () => {
    const parsed = parsePaalamProfile(readFixture("mayor-no-age.html"));
    assert.equal(parsed.name, "Christopher “Amping” Cuan");
    assert.equal(parsed.alias, "Amping");
    assert.equal(parsed.occupation, "Mayor");
    assert.equal(parsed.age, null);
    assert.ok(parsed.reviewReasons.includes("sensitive_public_figure"));
    // Narrative mentions 46-year-old — must NOT invent age from story.
    assert.equal(parsed.age, null);
    assert.ok(
      parsed.warnings.some((warning) => warning.includes("Age mentioned in narrative"))
    );
  });

  it("parses age when occupation is a separate field", () => {
    const parsed = parsePaalamProfile(readFixture("age-occupation.html"));
    assert.ok(parsed.age !== null);
    assert.ok(typeof parsed.age === "number");
    assert.ok(parsed.occupation === null || typeof parsed.occupation === "string");
  });
});
