# Carbarn Content Engine: design

Status: v1 design, 1 Nov 2026. Jim delegated every product decision ("do whatever you think would be the best"), so each choice below is the builder's call unless it says "Jim decided".

## Why it exists

Five new Facebook and Instagram Pages (Carbarn Ireland, United Kingdom, United States, Malta, Cyprus) need regular, on-brand posts from a 1–2 person team. In October 2026, management rejected images invented by generative AI. The posts Jim approved on 1 Nov 2026 are coded templates filled with real data from the Carbarn sites: one car per picture, a lively hook, the model, a features line, a km pill, a grade badge and the market's logo.

The engine turns a **topic** into finished **pictures and captions** in that approved style. It then gives Jim a review queue and a publishing step, and it learns from his edits.

## Jim decided (1 Nov 2026 and earlier)

- Photos only for now: no video.
- Facebook and Instagram first.
- Carbarn branding on every picture.
- One car per picture, posted as a multi-photo post or carousel. No grids.
- Generous spacing. Three text levels on lot cards: hook, then model and features, then a km pill on the right.
- Never say "this week", because auctions update daily. Use per-day counts or "live right now".
- No estimated landed price on auction-lot cards (it reads as fixed). Mileage is not the hero.
- Hooks come from the lot's own selling points or equipment.
- Each market gets a different category.
- Every fact comes from the live listing. AI never paints cars, prices or logos.
- Nothing is published without approval.

## Goals

1. Plan: propose a week of posts per Page, mixing categories and topic types, with no repeats.
2. Build: for each planned topic, fetch live data, pick strong cars, write hooks, features and captions, then render 1080×1080 PNGs.
3. Check: automatic QA flags. Facts are compared with the listing, and the checks also cover banned phrases, text overflow, the auction-photo rights warning, number plates, dates and duplicates.
4. Review: edit any single slot (hook, model, features, km, photo, crop, blur box, caption) and re-render only that card. Approve or reject with a reason, and compare versions.
5. Publish: export a posting pack (PNGs plus caption.md) into `posts/<market>/`. Publish to Facebook and Instagram through the official Graph API once Page tokens are supplied. Until then, a mock publisher logs exactly what would be sent.
6. Learn: log every edit, approval, rejection and publish, then suggest rule changes for Jim to accept or dismiss.

## Non-goals (v1)

- No video, TikTok, YouTube or Carbarn Australia. AU is a separate business; its research is reference only.
- No generative image models.
- No cloud hosting or multi-user login.
- No paid ads.
- Engagement analytics beyond storing post IDs: deferred until tokens exist.

## Anti-goals (a failure even if it works)

- A figure on a card that does not match the listing.
- A post going out without Jim's approval.
- Copy using the About kit's "never use" words (e.g. "best", "premium", "luxury", "risk-free", "no hidden costs", "landed price", "guaranteed", "we clear customs").
- An auction photo with a readable plate.
- A look that drifts from the approved lot card.
- Secrets stored in the project folder.

## Constraints

- **Runtime:** runs on Jim's Windows 11 PC. Node.js 24 is installed, as are Google Chrome and Edge. One npm dependency: `playwright-core` (exact pin), driving the installed Chrome.
- **API keys:** none supplied yet. Every external service has a mock, and real connectors switch on when a key appears in the secrets file.
- **Secrets file:** `%APPDATA%\CarbarnContentEngine\secrets.json`, never inside the project.
- **Data source:** each site's own Next.js RSC payload (`GET <page>` with header `RSC: 1`). It carries structured `vehicle` objects, `vehicleCount` and site config, so no HTML scraping is needed.
- **Rights:**
  - Auction houses ban reposting their photos on social. Every auction photo carries a QA warning, and approval needs a "plates checked" tick.
  - Carbarn's own yard photos of stock (`s3-ap-southeast-2.amazonaws.com/nichibo/...`) are rights-safe.
  - `...F.jpg` and `...R.jpg` on nichibojapan.com are auction photos.
- **Copy rules:** the per-market facts and word lists come from `reports/Facebook About section kit.md`.

## Markets (verified 31 Oct–1 Nov 2026)

| Key | Page | Site | Locale | Ports | Lead fact (approved wording) | Popular categories on site |
|---|---|---|---|---|---|---|
| ie | Carbarn Ireland | carbarn.ie | en-IE | Dublin, Cork | Costs shown up front; "people carrier" | hybrid, small-petrol, suv, family-7-seaters, sports |
| uk | Carbarn United Kingdom | carbarn.uk | en-GB | Southampton, Portbury | Right-hand drive, no age limit | people-carriers, kei-cars, hybrid, vans-campers, 4wd, sports |
| us | Carbarn United States | carbarn.us | en-US | LA/Long Beach, Tacoma, Houston, Jacksonville, Baltimore | "Every car we list for the US is at least 25 years old, counted from its build month." | sports, 4wd, vans-campers, manual |
| mt | Carbarn Malta | carbarn.mt | en-MT | Marsaxlokk, Valletta | "SVA and JEVIC certificates arranged in Japan" | city-hatchbacks, suv, hybrid, vans-campers |
| cy | Carbarn Cyprus | carbarn.cy | en-CY | Limassol, Larnaca | "within Cyprus's five-year limit, checked against its build date" | hybrid, small-petrol, suv |

## Topics (v1)

| Topic | Pictures | Photos | Data |
|---|---|---|---|
| `live-lots` | 4 lot cards, one category | auction (warning) | category payload, lot payloads, per-day counts |
| `lot-spotlight` | 1 lot card | auction (warning) | one lot |
| `stock-spotlight` | 1 stock card plus up to 3 own-photo cards | own (safe) | stock list and vehicle |
| `how-it-works` | cover plus 3 steps | own stock photos (safe) | fixed copy, per-market ports and words |
| `market-fact` | 1 info card | own stock photo (safe) | approved lead-fact wording per market |

## How the pipeline works

**Plan → Build → Check → Review → Publish → Learn.**

**Plan:**
- Default cadence is Mon, Wed and Fri per Page. That's 15 posts a week, sized for 1–2 people.
- Monday and Friday are `live-lots`, rotating through the market's categories. A category isn't reused within 14 days on that Page, and the planner avoids the same category on two Pages on the same day.
- Wednesday is `stock-spotlight` when a rights-safe stock car hasn't been featured in 30 days. Otherwise it falls back to `lot-spotlight`.
- A Page's first post is `how-it-works`.
- The 5 posts made by hand on 1 Nov seed the history.

**Build** works at build time, normally the day before posting, because lots appear daily. Lots must auction after the planned date.

**Picker (builder's call)** scores each lot:
- grade (S/6 = 6, 5, 4.5, 4 …; R/RA count low but are allowed for US classics)
- interior/exterior A/B
- selling points present
- photo count ≥ 2
- model and make variety across the 4 cards
- not used in another post in the last 30 days

Some lots are excluded: houses in `excludedHouses` (default `["USS"]`), and photos under 600 px wide. Lots under 1000 px wide are allowed but carry a low-res warning.

**Writer:** rule-based, from editable config.
- **Hooks:** model library → selling-point rules → grade/equipment rules → category fallback. The top 3 candidates are offered as variants.
- **Features line:** up to 3 items, skipping whatever the hook already says.
- **Captions:** two options. A uses the per-day count on the first lot day; B uses the live-now count.
- **Spelling:** US English for us, UK English elsewhere.

An optional Claude connector (`ANTHROPIC_API_KEY` in secrets) can rewrite a caption on request; QA always re-runs afterwards.

**Render:**
- HTML templates in the approved style, rendered by Chrome to PNG.
- Fonts are bundled locally (Montserrat, SIL OFL).
- The crop is a focal point plus zoom. Blur boxes are stored in image percentages and drawn as CSS backdrop blur.

**Check:** QA flags have a severity: error blocks approval, warn needs a glance. The full list is in plan Task 6.

**Review studio:** a local web UI at `http://localhost:5317` with these screens:
- **Today:** what needs doing.
- **Plan:** the week grid.
- **Review:** the post editor.
- **Publish:** the queue.
- **Learn:** log and suggestions.
- **Settings:** markets, word rules, hook library and connections.

Every save is a new version. Old versions stay viewable side by side.

**Publish:**
- **Export:** writes `posts/<market folder>/<date>-<slug>/` (PNGs plus caption.md), in the same layout as the hand-made posts.
- **Facebook:** a multi-photo Page post. Photos are uploaded unpublished, then posted to the feed with `attached_media`.
- **Instagram:** a carousel built from the uploaded Facebook photos' CDN URLs, so no extra hosting is needed. Container → carousel → `media_publish`.
- The Graph API version is configurable.

**Learn:** an append-only `data/log.jsonl`. Suggestions come from repeated patterns: a hook from the library edited away twice, the same phrase deleted three times, and rejection reasons. Jim accepts or dismisses each one.

## Left to the builder

File layout, UI styling (match the Carbarn tokens), scoring weights, hook wording in the starter library (true, short, lively, ≤ 22 characters), and test coverage.
