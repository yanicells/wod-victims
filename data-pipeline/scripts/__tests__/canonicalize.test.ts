import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalizePaalamUrl } from "../lib/canonicalize.js";

describe("canonicalizePaalamUrl", () => {
  it("adds a trailing slash", () => {
    assert.equal(
      canonicalizePaalamUrl("https://paalam.org/homepage/victims/johndy-maglinte"),
      "https://paalam.org/homepage/victims/johndy-maglinte/"
    );
  });

  it("strips query and hash", () => {
    assert.equal(
      canonicalizePaalamUrl(
        "https://paalam.org/homepage/victims/johndy-maglinte/?utm=1#section"
      ),
      "https://paalam.org/homepage/victims/johndy-maglinte/"
    );
  });

  it("is stable for already-canonical URLs", () => {
    const url = "https://paalam.org/homepage/victims/johndy-maglinte/";
    assert.equal(canonicalizePaalamUrl(url), url);
  });

  it("collapses HTTP and www variants to the HTTPS apex host", () => {
    assert.equal(
      canonicalizePaalamUrl(
        "http://www.paalam.org/homepage/victims/johndy-maglinte"
      ),
      "https://paalam.org/homepage/victims/johndy-maglinte/"
    );
  });

  it("rejects URLs outside the Paalam victim-profile boundary", () => {
    assert.throws(() => canonicalizePaalamUrl("https://example.com/test"));
    assert.throws(() =>
      canonicalizePaalamUrl("ftp://paalam.org/homepage/victims/test")
    );
    assert.throws(() => canonicalizePaalamUrl("https://paalam.org/about/"));
    assert.throws(() =>
      canonicalizePaalamUrl("https://user:pass@paalam.org/homepage/victims/test")
    );
  });
});
