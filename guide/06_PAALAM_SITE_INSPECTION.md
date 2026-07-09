# Paalam Site Inspection

> **Note:** structured victim fields (name, age, date, location, source links) live in each profile page's HTML, in labeled `ul.plm-details` list items — not in the WordPress REST API's `content.rendered`. REST is used for discovery (finding profile URLs) only; `ingest-paalam.ts` fetches the HTML page itself and parses it with `lib/parse-paalam-profile.ts`.

Inspection date: 2026-06-03

Purpose: understand Paalam.org structure before building any scraper.

No broad scrape was run. This inspection checked only robots.txt, sitemap.xml, the homepage, the "Who Were They?" page, the About page, one sample victim profile, and one small WordPress REST API response.

## Checked URLs

- https://paalam.org/
- https://paalam.org/robots.txt
- https://paalam.org/sitemap.xml
- https://paalam.org/who-were-the-victims-of-the-war-on-drugs/
- https://paalam.org/about-this-website/
- https://paalam.org/homepage/victims/johndy-maglinte/
- https://paalam.org/wp-json/wp/v2/victim/4172
- https://paalam.org/wp-json/wp/v2/victim?per_page=5&page=1&_fields=id,slug,link,title,date,modified,type

## Robots and access notes

`robots.txt` exists and allows normal public paths:

```text
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Sitemap: https://paalam.org/sitemap.xml
```

The site also sends `x-robots-tag: noindex` on checked responses. Treat this as a public-access site but still scrape gently and only for project-relevant pages.

## Site structure

Paalam appears to be a WordPress site with a custom post type named `victim`.

Observed profile URL pattern:

```text
https://paalam.org/homepage/victims/{slug}/
```

Example:

```text
https://paalam.org/homepage/victims/johndy-maglinte/
```

The homepage contains paginated profile links, but this should not be the first discovery method because it depends on frontend pagination and theme markup.

Better discovery sources:

1. `sitemap.xml`
2. WordPress REST API list endpoint
3. homepage/profile navigation as fallback only

## Discovery observations

### Sitemap

The sitemap includes normal pages and victim profile URLs.

Observed from a single sitemap fetch:

```text
total URLs: 3006
victim profile URLs matching /homepage/victims/: 3000
```

### WordPress REST API

The REST endpoint works for the `victim` post type.

List endpoint:

```text
https://paalam.org/wp-json/wp/v2/victim?per_page=5&page=1&_fields=id,slug,link,title,date,modified,type
```

Observed response headers:

```text
X-WP-Total: 3349
X-WP-TotalPages: 670
```

Single profile endpoint:

```text
https://paalam.org/wp-json/wp/v2/victim/4172
```

Useful fields:

- `id`
- `slug`
- `link`
- `title.rendered`
- `date`
- `modified`
- `content.rendered`
- `excerpt.rendered`

## Count mismatch to investigate

Do not treat any count as final yet.

Observed counts:

- About/list wording says there are 3,195 known victims on the "Who Were They?" page.
- Sitemap had 3,000 victim profile URLs in the sampled fetch.
- WordPress REST API reported 3,349 victim posts.

Possible reasons:

- some victim posts are not in the sitemap
- some REST `victim` posts are drafts/private/unlisted-like or otherwise not visible in sitemap
- some victims are listed by name but do not have profile pages
- some pages represent anonymous or grouped records
- the site's count wording may be outdated

The discovery script should report these counts separately instead of forcing them to match.

## Sample victim page structure

Sample page:

```text
https://paalam.org/homepage/victims/johndy-maglinte/
```

Observed page sections:

- title/name in `h1`
- post author and post date
- image content
- basic details list
- incident details
- source links
- narrative excerpt/content
- previous/next profile links

Observed sample fields:

```text
Name: Johndy Maglinte
Sex: Male
Age: 16
Marital Status: Single
Incident type: Killed in police operation
Date of Incident: June 17, 2021
Location of Incident: Binan, Laguna
Source: Rappler article URL
```

Important: images exist on profile pages, but the project does not use photos in v1.

## About page methodology notes

The About page says the site is an online memorial and that many entries are based on television, online, and print news stories. It says source links are included wherever possible and that entries may separate multiple victims from a single news story.

Implication for this project:

- preserve Paalam profile URL as the primary memorial source
- preserve outgoing news links as supporting sources
- expect multiple victims to share one source article
- do not assume Paalam independently verified all facts
- do not scrape photos for v1

## Recommended discovery strategy

Use a two-input discovery script:

1. Fetch `sitemap.xml` and collect URLs matching `/homepage/victims/`.
2. Fetch WordPress REST victim list pages with small page size and `_fields=id,slug,link,title,date,modified,type`.

Then:

- canonicalize URLs
- merge by canonical URL and/or REST `id`
- record sitemap presence
- record REST presence
- add new profile URLs to `data/ops/scrape_targets.csv`
- write a `scrape_runs.jsonl` row with `mode=discover`
- do not fetch profile HTML during discovery

## Recommended sample scrape strategy

After discovery only:

1. Choose 20 queued profile targets.
2. Fetch profile HTML slowly.
3. Save append-only raw HTML snapshots.
4. Convert visible content to plain text.
5. Save raw text snapshots.
6. Compute content hash.
7. Extract outgoing source links.
8. Update `scrape_targets.csv`.
9. Generate a scrape report.

Suggested request behavior:

- one request at a time
- start with 2 to 5 seconds between profile page requests
- stop on repeated errors
- never fetch image files
- never fetch linked news articles during the Paalam profile sample scrape

## Risks and cautions

- REST count, sitemap count, and list-page wording disagree.
- Some names are duplicates or variants.
- Some records are anonymous or nickname-only.
- Some source articles may be dead links later.
- Profile pages contain photos; ignore image URLs except as metadata if needed.
- Location text may include city only or source narrative may mention barangay; do not over-map.

## Discovery run result

Discovery script:

```text
data-pipeline/scripts/discover-paalam.ts
```

Command run:

```text
pnpm discover:paalam -- --delay-ms=500
```

Result:

```text
run_id: paalam_discover_20260602172527
sitemap victim URLs: 3000
REST total reported: 3349
REST pages fetched: 34
merged candidates: 3349
new targets added: 3349
```

All discovered targets were added to `data/ops/scrape_targets.csv` as queued `profile_page` targets with `extraction_status=not_started`.

No victim profile pages were fetched during discovery.

## Next implementation task

Run quality review on the 20-page sample scrape before scaling.

Sample scrape result:

```text
run_id: paalam_sample_20260602173855
profile pages fetched: 20
success: 20
failed: 0
report: data/raw/paalam/manifests/paalam_sample_20260602173855.json
```

Quality note:

- Arthur Abdul had a visible `Source(s)` section but the link was malformed/non-external (`href="Arthur Abdul "`), so the scraper recorded zero outgoing source links for that profile.

Next review should check:

- whether the 20 raw text files are readable enough for AI extraction
- whether source link extraction should flag malformed source entries separately
- whether navigation/footer text should be reduced before extraction
- whether the sample can move to AI extraction
