---
description: Search and manage validated user pain points from Pain Radar (vettedgaps.com). Use when the user wants to discover real problems on SaaS marketplaces (Shopify, Notion, Atlassian, etc.), look up details for a specific pain card, save promising ideas to favorites, or post comments on discovered pains. Requires VETTED_GAPS_TOKEN env var (Pro-tier API token from https://vettedgaps.com/api_tokens).
---

# Vetted Gaps — Pain Radar API skill

You can search the Pain Radar index, retrieve full pain card details with evidence, save favorites for later, and post comments on cards. All operations go through the public API at `https://vettedgaps.com/api/v1/*`.

## Authentication

Every request MUST include these headers:

```
Authorization: Bearer ${VETTED_GAPS_TOKEN}
User-Agent: vettedgaps-skill/0.4.0
Accept: application/json
```

For binary exports (PDF) use `Accept: */*` and stream the response to a file (do not put the binary in your context window).

If `VETTED_GAPS_TOKEN` is not set or invalid:
- Tell the user: "I need a Pain Radar API token. Generate one at https://vettedgaps.com/api_tokens (requires Pro subscription), then `export VETTED_GAPS_TOKEN=<token>` and restart Claude Code."
- Do not retry without the token.

## Operations

### 1. Search pains

`GET https://vettedgaps.com/api/v1/pains`

Query parameters (all optional):

| Param | Type | Description |
|---|---|---|
| `niche` | string | Marketplace slug (e.g. `shopify`, `notion`, `atlassian`). |
| `min_score` | float | Cards with `score >= min_score` (range 0..1). |
| `opportunity_type` | string | One of `vendor_only`, `addon_opportunity`, `workflow_tool`, `competitor_opportunity`. |
| `actionable` | `true` | Shortcut to exclude `vendor_only` cards (recommended when user wants ideas for mini-apps / extensions). |
| `after` | ISO 8601 | Only cards `last_aggregated_at >= after`. |
| `per_page` | int | Default 20, max 50. |
| `cursor` | opaque | Pagination cursor from previous `meta.next_cursor`. |

Response:

```json
{
  "data": [
    {
      "id": 310,
      "title": "...",
      "description": "...",
      "status": "published",
      "score": 0.6779,
      "severity_hint": "high",
      "monetization_signal": "explicit",
      "opportunity_type": "addon_opportunity",
      "marketplace_slug": "shopify",
      "last_aggregated_at": "2026-05-20T12:34:56Z"
    }
  ],
  "meta": { "has_more": true, "next_cursor": "eyJpZCI6..." }
}
```

**Use this when** the user wants to discover pains in a marketplace, find idea candidates, or filter by score/type.

### 2. Get card details

`GET https://vettedgaps.com/api/v1/pains/:id`

Returns full card with `score_components` and `evidence` array (quotes from real Reddit posts with source URLs). Use after search to dig into a specific card.

Response adds:

```json
{
  "score_components": {"reach": 0.8, "monetization": 1.0, ...},
  "evidence": [
    {
      "quote_text": "...",
      "source_url": "https://reddit.com/r/shopify/...",
      "source_created_at": "2026-05-15T08:12:00Z"
    }
  ]
}
```

### 3. Save to favorites

`POST https://vettedgaps.com/api/v1/favorites`

Body:

```json
{
  "pain_card_id": 310,
  "note": "Optional note, max 1000 chars"
}
```

Returns `201 Created` for a new favorite, `200 OK` if the user already favorited this card (idempotent — note is NOT updated on repeat).

### 4. Export card (markdown / PDF / JSON)

Each pain card can be exported in 3 formats — same renders as the website provides via the UI download buttons.

`GET https://vettedgaps.com/api/v1/pains/:id/export.md`
`GET https://vettedgaps.com/api/v1/pains/:id/export.pdf`
`GET https://vettedgaps.com/api/v1/pains/:id/export.json`

Each returns the body with `Content-Disposition: attachment; filename="painradar-<slug>-<date>.<ext>"` and `Content-Type` for the format.

**Markdown** (for AI briefings, internal docs):
```bash
curl -H "Authorization: Bearer $VETTED_GAPS_TOKEN" \
     -H "User-Agent: vettedgaps-skill/0.4.0" \
     -o /tmp/painradar-310.md \
     https://vettedgaps.com/api/v1/pains/310/export.md
```

**PDF** (for sharing, reading offline, printing):
```bash
curl -H "Authorization: Bearer $VETTED_GAPS_TOKEN" \
     -H "User-Agent: vettedgaps-skill/0.4.0" \
     -o ~/Downloads/painradar-310.pdf \
     https://vettedgaps.com/api/v1/pains/310/export.pdf
```

**JSON** (structured export with `export_version`, `pain_card`, evidence array):
```bash
curl -H "Authorization: Bearer $VETTED_GAPS_TOKEN" \
     -H "User-Agent: vettedgaps-skill/0.4.0" \
     -o /tmp/painradar-310.json \
     https://vettedgaps.com/api/v1/pains/310/export.json
```

Responses are cached client-side for 1 hour via ETag/304. If a card has no evidence — `422 validation_failed`. Use this when the user says they want to *save*, *download*, *export*, *get a PDF/markdown/briefing* of a pain card.

### 5. Post a comment

`POST https://vettedgaps.com/api/v1/pains/:id/comments`

Body:

```json
{
  "body": "Comment text, 1..10000 chars (markdown supported)",
  "parent_comment_id": null
}
```

`parent_comment_id` (optional) — for a reply, must reference an existing top-level (not-reply) comment on the same card. Returns `201 Created` with `{data: {id, body, body_html, created_at, parent_comment_id}}`.

## Cross-platform marketplace gaps

A second, complementary angle on opportunities. Operations 1–5 above mine **real user complaints** (the *primary* signal). These three compare the *app catalogs* of two platforms **semantically** (pure vector math, no LLM): a feature offered by many apps on platform A but by **nobody** on platform B is validated, unmet demand on B.

Use pains as the main source of truth; use gaps as a supporting signal to size and locate demand. Same auth, error envelope and 60 req/min rate limit as above.

### 6. List comparable platforms

`GET https://vettedgaps.com/api/v1/marketplace_gaps/platforms`

No parameters. Returns the platforms you may compare (only crawled ones), with app counts. **Call this first** so you use valid slugs.

```json
{ "data": [ { "slug": "monday", "name": "Monday", "apps_count": 1217 }, { "slug": "atlassian", "name": "Atlassian", "apps_count": 7278 } ] }
```

### 7. Compare two platforms

`GET https://vettedgaps.com/api/v1/marketplace_gaps/compare?a=<slug>&b=<slug>`

Query parameters:

| Param | Type | Description |
|---|---|---|
| `a` | string | **Required.** Platform A slug. |
| `b` | string | **Required.** Platform B slug (must differ from `a`). |
| `per_page` | int | Gaps per direction per page (default 50, max 100). |
| `cursor` | opaque | Pagination cursor from previous `meta.next_cursor`. |

Returns **both directions in one response**: `gaps_a_to_b` (features in A missing from B) and `gaps_b_to_a` (the reverse).

```json
{
  "data": {
    "a": { "slug": "monday", "name": "Monday" },
    "b": { "slug": "asana", "name": "Asana" },
    "gaps_a_to_b": [
      {
        "feature_text": "Two-way Google Calendar sync",
        "source_apps": [ { "name": "CalSync", "url": "https://..." } ],
        "popularity": { "installs": 678, "rating": 5.0, "reviews_count": 12 },
        "covered_natively": false
      }
    ],
    "gaps_b_to_a": []
  },
  "meta": {
    "per_page": 50,
    "total_a_to_b": 6173,
    "total_b_to_a": 87,
    "has_more": true,
    "next_cursor": "eyJhIjo1MCwiYiI6NTB9"
  }
}
```

`popularity` is `null` when the platform publishes no metrics. `covered_natively` is present only when native-coverage data exists for the target platform.

**Pagination:** both directions are paginated independently behind one `cursor`. Totals (`total_a_to_b`/`total_b_to_a`) can be in the thousands — never try to pull everything; show the top gaps plus the totals. To page through, repeat with `cursor=meta.next_cursor` until `meta.has_more` is `false`.

### 8. Lookup a plugin across platforms

`GET https://vettedgaps.com/api/v1/marketplace_gaps/lookup?q=<text>`

Text-searches features by name (`q` required), then finds the nearest semantic match on every *other* platform. Use to check whether an idea already exists elsewhere. No pagination (fixed top matches).

```json
{
  "data": {
    "results": [
      { "query_feature": "time tracking", "platform": { "slug": "asana", "name": "Asana" }, "closest_match": "Time tracker KosmoTime", "app_name": "KosmoTime", "popularity": null }
    ]
  }
}
```

## Error envelope

All errors return JSON of shape:

```json
{ "error": { "code": "<code>", "message": "<human readable>" } }
```

| Status | Code | Meaning | What to do |
|---|---|---|---|
| 400 | `bad_request` | Invalid parameter (e.g. unknown `opportunity_type`). | Show the message; ask user to clarify. |
| 401 | `unauthorized` | Missing or invalid token. | Tell user to regenerate token. |
| 403 | `forbidden` | User is not Pro. | Tell user to subscribe at https://vettedgaps.com/pricing. |
| 404 | `not_found` | Pain card does not exist. | Tell user the card was not found. |
| 422 | `validation_failed` | Body validation (note too long, body empty, invalid parent). `details` field has per-field errors. | Show user the specific issue. |
| 429 | `rate_limited` | Over 60 req/min on this token. | Wait, then retry. Header `Retry-After` shows seconds. |

## Rate limit

60 requests per minute per API token. Headers `X-RateLimit-Limit` and `X-RateLimit-Remaining` are present on successful responses.

If you hit rate limit while iterating (e.g. fetching details for many cards), pause and tell the user — do not silently retry.

## Examples

**User**: "find me 5 addon-opportunity ideas for Shopify with score above 0.5"

You should:
1. `GET /api/v1/pains?niche=shopify&min_score=0.5&opportunity_type=addon_opportunity&per_page=5`
2. Summarize the 5 results (id, title, score, one-line description) and ask which to dig into.

**User**: "save #310 to favorites"

You should:
1. `POST /api/v1/favorites` with `{"pain_card_id": 310}`.
2. Confirm based on status (201 = saved, 200 = already in favorites).

**User**: "comment on #310: 'investigating this for a chrome extension'"

You should:
1. `POST /api/v1/pains/310/comments` with `{"body": "investigating this for a chrome extension"}`.
2. Show the created comment ID.

**User**: "what do monday apps offer that asana apps don't?"

You should:
1. `GET /api/v1/marketplace_gaps/platforms` to confirm `monday` and `asana` exist.
2. `GET /api/v1/marketplace_gaps/compare?a=monday&b=asana&per_page=20`.
3. Summarize the top `gaps_a_to_b` (feature, which apps offer it, popularity) and quote `meta.total_a_to_b` so the user knows how many more exist. Treat it as a demand signal, then cross-reference with `search_pains` for matching user complaints.
