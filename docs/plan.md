# Carbarn Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local app that turns a topic into on-brand Facebook/Instagram pictures and captions for the 5 Carbarn export Pages, with QA, a review studio, publishing and learning.

**Architecture:**
- **Server:** a Node.js HTTP server. It has a small JSON API, a vanilla-JS single-page review studio, and a JSON-file store under `data/`.
- **Sources:** Carbarn site data comes from Next.js RSC payloads.
- **Rendering:** `playwright-core` drives the installed Chrome to render HTML templates to PNG.
- **External services:** every one has a mock until keys exist.

**Tech Stack:**
- Node.js 24 (ESM), `node:test`
- `playwright-core@1.55.0`, the only dependency
- System Chrome, falling back to Edge, then the ms-playwright Chromium
- Bundled Montserrat woff2

**Spec:** `docs/engine-spec.md`

## Global Constraints

- Root: `D:\Jim\Social Media Research\content-engine\`. Port `5317`.
- Secrets live only in `%APPDATA%\CarbarnContentEngine\secrets.json`, never in the project.
- Card size is 1080×1080 PNG.
- Brand tokens:
  - Colours: blue `#0473EA`, navy `#061D33`, label `#D6E8FF`
  - Font: Montserrat 600/700/800/900
  - Logo: shown white via `filter:brightness(0) invert(1)`
- Lot card geometry is copied from the approved `posts/carbarn-united-kingdom/2026-11-kei-cars/template/card.html`:
  - photo row 736px, bar padding `36px 48px 40px`, logo 232px at 40/48
  - hook `900 74px/1`, model `800 36px/1.15`, features `600 26px/1.3`
  - km pill `800 28px/1`, padding `12px 24px`
- Copy:
  - Never use "this week", "best", "premium", "luxury", "high-quality", "trusted", "No. 1", "leading", "risk-free", "pay nothing", "no hidden costs", "all-inclusive", "landed price", "on-the-road", "drive-away", "duty-free", "guaranteed", "road-legal", "door-to-door", "we clear", "we import", "cheapest".
  - Use "refundable card deposit" and "no bid … without your approval".
  - Ireland uses "people carrier", not "people mover".
- No estimated landed price on auction-lot cards.
- Nothing publishes without status `approved` and an explicit publish action.
- No generative image model anywhere.
- Not a git repo, and Jim's rule is commit only when asked, so "Commit" steps are skipped.

## Review Focus

1. **A lot is withdrawn or changed between build and approval.** QA re-fetches the lot on approve, and a missing lot or changed km/grade/date is an error. Test: `qa: lot-gone and fact-mismatch from refetch` (Task 6).
2. **The site returns an error page, times out or changes its payload shape.** The source throws a clear `SourceError` naming the URL, and the UI shows it rather than a blank post. Test: `carbarn: non-RSC response throws SourceError` (Task 2).
3. **Long hooks, models or feature lines.** Overflow is detected after render and becomes an error flag, and the writer pre-trims the features line to 3 items or fewer and 44 characters or fewer. Test: `render: reports overflow for 40-char hook` (Task 1), `hooks: featureLine never exceeds 44 chars` (Task 3).
4. **A category has fewer than 4 eligible lots on the target dates.** The build uses what exists (minimum 1) and adds a warn flag; with 0 it fails with a readable message. Test: `liveLots: 2 eligible lots gives 2 cards and warn` (Task 5).
5. **Jim edits a slot and then the rebuild overwrites it.** Edited slots are marked `locked`, and swapping a lot keeps locked caption edits. Test: `store: edit creates version and locks slot` (Task 5).

---

### Task 1: Scaffold, assets and lot-card renderer

**Files:**
- Create: `package.json`, `start.cmd`, `assets/fonts/*.woff2`, `assets/logos/carbarn-{ie,uk,us,mt,cy}-logo.png`, `templates/shared.css`, `templates/lot-card.html`, `lib/render.js`
- Test: `test/render.test.js`

**Interfaces:**
- Produces:
  - `renderCard(card: CardSpec, outPath: string) -> Promise<{overflow: string[], photo: {w,h}}>`
  - `closeBrowser()`
  - `CardSpec`:
    `{template:'lot-card'|'info-card'|'cost-card', market:{key,logo,brand,lang}, photo:{file, focus:{x,y}, zoom, blur:[{x,y,w,h}]}, slots:{...}}`
    - photo file is an absolute local path
    - focus is 0–100 %
    - zoom is ≥ 1
    - blur boxes are in % of the natural image

- [ ] Step 1: Write the tests.
  - `render: lot card is 1080x1080`: the PNG header width/height is 1080.
  - `render: reports overflow for 40-char hook`: `overflow` includes `'hook'`.
  - `render: no overflow for approved UK Jimny card`: uses the slots from `posts/.../kei-cars/template/cards.js` card 0.
- [ ] Step 2: Run `node --test test/render.test.js` and expect FAIL.
- [ ] Step 3: Implement the template and renderer.
  - The template reads `window.CARD`.
  - It positions the image itself, with no object-fit:
    - `scale = max(W/natW, H/natH) * zoom`
    - offset: `-(natW*scale - W) * focus.x/100`
  - Blur boxes are absolutely positioned divs with `backdrop-filter: blur(14px)`, over the same transform.
  - Overflow is measured with inline `span` widths against the bar width (hook, model, features) and the pill's left edge.
  - The browser is launched once: `chromium.launch({executablePath})`, picking the first that exists of Chrome, Edge, then ms-playwright.
- [ ] Step 4: Run the tests and expect PASS.

### Task 2: Carbarn source (RSC)

**Files:**
- Create: `lib/util/rsc.js`, `lib/sources/carbarn.js`
- Create: `config/markets.json` (the design's market table, plus `site`, `folder`, `currency`, `dateStyle:'dmy'|'mdy'`, `hashtags`, `leadFact`, `ports`, `categories[{slug,label,noun}]`)
- Test: `test/carbarn.test.js` with fixtures `test/fixtures/{lot,category,stock-list}.rsc`

**Interfaces:**
- Produces:
  - `extractObjects(text, key) -> object[]`: every JSON object value of `"key":{…}`, brace-matched and string-aware.
  - `fetchRsc(url) -> Promise<string>`: header `RSC: 1`, 30 s timeout. It throws `SourceError` on non-200 or when the body starts with `<!DOCTYPE`.
  - `getCategory(market, slug, {date, page}) -> {count, lots: Lot[], cutoffUtc}`
  - `getCategoryCounts(market, slug, dates[]) -> {total, byDate:{[d]:n}}`
  - `getLot(market, id) -> Lot` (full detail, with the `auctionSheetSummary` fields flattened)
  - `getStockList(market) -> Stock[]`
  - `getSiteConfig(market) -> {popularCategories, arrivalPorts, approxArrivalTimeInDays}`
  - `photoUrl(url, {w:1600,h:900})`
  - `Lot`: `{id, title, make, model, modelCode, year, auctionDate, auctionHouse, odometerKm, grade, interiorGrade, exteriorGrade, fuel, engineCc, drive, transmission, colour, seats, variant, regDate, equipment, sellingPoints, inspectorNotes, photos[], url}`

- [ ] Step 1: Save the fixtures from the probes. Write the tests.
  - `rsc: extracts 24 vehicles from category fixture`
  - `carbarn: category fixture count is 3236`
  - `carbarn: lot fixture maps 2723320 odometerKm 7000, grade "5", sellingPoints contains "Seat Heater", regDate "2022-04"`
  - `carbarn: non-RSC response throws SourceError` (uses a stubbed fetch)
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement. Lot URL is `https://www.<site>/live-auction/<make>/<model>/<code>/<id>`; build it from the slug fields, or use `/live-auction/x/x/x/<id>` if that resolves.
- [ ] Step 4: Run and expect PASS, then live-check the 5 markets once from the CLI: `node lib/sources/carbarn.js --check`.

### Task 3: Names, dates, hooks and features

**Files:**
- Create: `lib/text/names.js`, `lib/text/dates.js`, `lib/text/hooks.js`, `config/hooks.json`
- Test: `test/text.test.js`

**Interfaces:**
- Produces:
  - `modelName(lot) -> string`, e.g. `"2022 Suzuki Jimny XC"`, `"2025 Mazda2 15 BD"`, `"1994 Nissan Skyline GT-R"`.
  - `auctionPill(date, market) -> "TUE 3 NOV" | "TUE NOV 3"`
  - `dayName(date) -> "Tuesday"`
  - `hookCandidates(lot, market, category) -> [{text, source}]`: up to 3, each ≤ 22 characters.
  - `featureLine(lot, usedHook) -> string`: 3 items or fewer, joined with `" · "`, ≤ 44 characters.
  - `kmLabel(lot) -> "7,000 km"`
- `config/hooks.json`:
  - `models`: model library keyed by `MAKE MODEL[ CODE]`. Seed it with the 20 hooks approved on 1 Nov 2026.
  - `points`: regex → hook template.
  - `features`: regex → label.

- [ ] Step 1: Write the tests.
  - `names`: the three examples above, plus `"N BOX"` → `"N-Box"`.
  - `dates: US pill is TUE NOV 3, UK pill is TUE 3 NOV`.
  - `hooks: BNR32 gives "The original Godzilla" first`.
  - `hooks: Raize with sellingPoints "One owner" offers "Just one owner"`.
  - `hooks: every candidate <= 22 chars`.
  - `hooks: featureLine never exceeds 44 chars` (fuzz over the fixture's 24 lots).
  - `hooks: featureLine skips the feature already in the hook`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 4: Captions and word rules

**Files:**
- Create: `lib/text/captions.js`, `lib/text/rules.js`, `config/rules.json`
- Test: `test/captions.test.js`

**Interfaces:**
- Produces:
  - `captionsFor(post, market) -> {a, b}`
  - `checkCopy(text, market) -> [{rule, phrase, severity}]`
  - `config/rules.json`: `{never:[…global], perMarket:{ie:{replace:{"people mover":"people carrier"}}, us:{spelling:"us"}}, spellingPairs:[["favourite","favorite"],["colour","color"],["tyre","tire"],["neighbour","neighbor"]]}`
- Caption A pattern (approved 1 Nov):
  - `{count} {noun} go under the hammer in Japan on {Day} {emoji}`
  - then the market's lead fact
  - then "Four we'd look at first: …"
  - then the inspection-and-deposit line and the ports line
  - then the link and 5 hashtags
- Caption B: `{n} {noun} are live on {site} right now… Swipe for {n} favourites 👉`

- [ ] Step 1: Write the tests.
  - `captions: US A contains "at least 25 years old"`.
  - `captions: no caption contains a never-word for any market`.
  - `captions: US uses "favorites", UK uses "favourites"`.
  - `rules: "this week" flagged as error`.
  - `rules: IE "people mover" flagged`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 5: Store, picker and the lot topics

**Files:**
- Create: `lib/store.js`, `lib/pick.js`, `lib/photos.js`, `lib/topics/index.js`, `lib/topics/live-lots.js`, `lib/topics/lot-spotlight.js`, `lib/build.js`
- Test: `test/build.test.js` (stubbed source and renderer)

**Interfaces:**
- Produces:
  - `store`:
    - `listPosts(filter)`, `getPost(id)`, `savePost(post, {reason}) -> version`, `getVersion(id, v)`
    - `usedLots(sinceDays) -> Set`
    - `logEvent(e)`
    - Post layout: `data/posts/<id>/post.json` plus `v<n>/{post.json, card-<i>.png}`
  - `scoreLot(lot, ctx) -> number`
  - `pickLots(lots, n, ctx) -> Lot[]`: variety comes from penalising a repeated make (−2) and a repeated model (−6).
  - `cachePhoto(url) -> {file, w, h}`: stored in `data/cache/photos/<sha1>.jpg`.
  - `buildPost({market, topic, params, plannedFor}) -> Post`
  - `rebuildCard(post, i, changes) -> Post`
  - `Post`:
    `{id, market, topic, params, plannedFor, status:'draft'|'approved'|'rejected'|'exported'|'published', version, cards:[{lotId, photo:{url,file,w,h,source:'auction'|'own', n}, focus, zoom, blur, slots:{hook,model,feat,km,grade,pill}, hookOptions, facts, locked:[], platesChecked}], caption:{a,b,chosen,locked}, counts, qa:[], links:[] }`

- [ ] Step 1: Write the tests.
  - `liveLots: picks 4 distinct models from the fixture`.
  - `liveLots: 2 eligible lots gives 2 cards and warn`.
  - `pick: excludes lot used in last 30 days`.
  - `store: edit creates version and locks slot`.
  - `build: lots auctioning on or before plannedFor are excluded`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 6: QA

**Files:**
- Create: `lib/qa.js`
- Test: `test/qa.test.js`

**Interfaces:**
- Produces: `runQA(post, {refetch:boolean}) -> [{id, severity:'error'|'warn'|'info', card?:i, message}]`

The rules, with exact ids:

| id | severity | when |
|---|---|---|
| `lot-gone` | error | refetch fails |
| `fact-mismatch` | error | km, grade or pill differs from the facts or the refetch |
| `auction-past` | error | auctionDate ≤ plannedFor |
| `overflow` | error | the renderer reports it |
| `banned-phrase` | error | `checkCopy` |
| `spelling` | warn | |
| `placeholder` | error | `/undefined\|null\|NaN\|\{\w+\}\|TBD/` |
| `auction-photo` | warn | photo is an auction photo |
| `plates-unchecked` | error | auction photo and `!platesChecked` |
| `low-res` | warn | w < 1000 |
| `duplicate-lot` | warn | lot already used |
| `caption-length` | error | > 2200 characters |
| `hashtags` | warn | > 5 |
| `us-age` | error | regDate under 25 years old |
| `cy-age` | warn | regDate over 4 years 9 months old |
| `counts-stale` | warn | counts are more than 12 h old at approve time |
| `few-cards` | warn | |

- [ ] Step 1: Write one test per rule id, each asserting that the id appears for a crafted post and is absent for a clean post.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 7: Server API and review studio

**Files:**
- Create: `server.js`, `lib/api.js`, `ui/index.html`, `ui/app.js`, `ui/app.css`
- Test: `test/api.test.js` (starts the server on a random port with a stubbed build)

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces these routes:

| Method | Route | Body / effect |
|---|---|---|
| GET | `/api/state` | markets, connections, counts |
| GET | `/api/posts` | |
| GET | `/api/posts/:id` | |
| POST | `/api/posts` | `{market, topic, params, plannedFor}` |
| PATCH | `/api/posts/:id` | `{card?, slots?, focus?, zoom?, blur?, photoN?, platesChecked?, caption?}` |
| POST | `/api/posts/:id/swap` | `{card, lotId}` |
| GET | `/api/posts/:id/alternatives?card=i` | |
| POST | `/api/posts/:id/approve` | blocked by error flags |
| POST | `/api/posts/:id/reject` | `{reason}` |
| GET | `/api/posts/:id/versions/:v` | |
| GET | `/files/*` | serves `data/` |

- UI screens:
  - **Today:** queue counts and the next build actions.
  - **Review:** a list, plus an editor with the card strip, slot fields, hook variant chips, a photo picker (lot photos), focus and zoom sliders, a drag-to-draw blur box, a plates-checked tick, caption A/B, a QA panel, a versions drawer and side-by-side compare.

- [ ] Step 1: Write the tests.
  - `api: create → get returns cards`.
  - `api: approve with error flag returns 409`.
  - `api: patch hook re-renders only that card` (the renderer stub records its calls).
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS, then do a manual pass in Chrome: create a UK kei-cars post, edit a hook, swap a lot, draw a blur box, approve.

### Task 8: Stock and info topics

**Files:**
- Create: `templates/info-card.html`, `lib/topics/stock-spotlight.js`, `lib/topics/how-it-works.js`, `lib/topics/market-fact.js`
- Modify: `lib/sources/carbarn.js` (stock detail and own-photo classification)
- Test: `test/topics.test.js`

**Interfaces:**
- Produces:
  - `isOwnPhoto(url) -> boolean`: true for `amazonaws.com/nichibo/` URLs; false for `nichibojapan.com/AuctionPictures` and `photos.carbarn.com.au`.
  - The three topics register in `topics/index.js` with `build(ctx) -> {cards, caption}`.
  - `info-card` variants: `cover`, `step`, `fact`. The stock card is the lot-card with pill `IN STOCK IN JAPAN` and the stock price in place of km. The price is a real fixed price, not an estimate.

- [ ] Step 1: Write the tests.
  - `stock: own photos only`.
  - `how-it-works: 4 cards, ports from market`.
  - `market-fact: US card text equals approved 25-year wording`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS, then render all three for IE and look at them.

### Task 9: Planner

**Files:**
- Create: `lib/planner.js`, `config/schedule.json`, UI Plan screen
- Test: `test/planner.test.js`

**Interfaces:**
- Produces:
  - `proposeWeek(weekStart, history, markets, stockByMarket) -> Slot[]`
  - `Slot`: `{id, market, date, topic, params, status:'proposed'|'accepted'|'dropped'|'built', postId?}`
  - Store: `data/plans/<weekStart>.json`
  - API: `GET /api/plan?week=`, `POST /api/plan/propose`, `PATCH /api/plan/:slotId`, `POST /api/plan/:slotId/build`

- [ ] Step 1: Write the tests.
  - `planner: 15 slots Mon/Wed/Fri x 5`.
  - `planner: no category repeated on a Page within 14 days`.
  - `planner: no two Pages share a category on the same day`.
  - `planner: first post for a Page with no history is how-it-works`.
  - `planner: Wed falls back to lot-spotlight when no own-photo stock`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 10: Publish

**Files:**
- Create: `lib/secrets.js`, `lib/publish/pack.js`, `lib/publish/meta.js`, UI Publish screen and Connections settings
- Test: `test/publish.test.js`

**Interfaces:**
- Produces:
  - `exportPack(post) -> folder`: `posts/<market.folder>/<plannedFor>-<slug>/` with `N-<slug>.png` files and `caption.md`.
  - `publish(post, {platforms:['facebook','instagram']}) -> {facebook:{id}, instagram:{id}, mock:boolean}`
  - Facebook:
    1. `POST /{page}/photos` with `published=false` (multipart)
    2. `POST /{page}/feed` with `attached_media`
  - Instagram:
    1. `GET /{photo}?fields=images`
    2. `POST /{ig}/media` with `is_carousel_item`
    3. `POST /{ig}/media` with `media_type=CAROUSEL`
    4. poll `status_code`
    5. `POST /{ig}/media_publish`
  - Mock mode writes every request it would send to `data/publish-mock/<id>.json`.
  - Secrets are read per market: `{meta:{graphVersion:'v23.0', pages:{ie:{pageId,pageToken,igUserId}}}, anthropic:{apiKey}}`

- [ ] Step 1: Write the tests.
  - `publish: refuses non-approved post`.
  - `publish: mock records 4 photo uploads + feed + IG carousel calls`.
  - `pack: writes 4 PNGs and caption.md with lot links`.
  - `secrets: never written inside project dir`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 11: Learn and settings

**Files:**
- Create: `lib/learn.js`, UI Learn and Settings screens (edit `config/hooks.json`, `config/rules.json`, `config/schedule.json`)
- Test: `test/learn.test.js`

**Interfaces:**
- Produces:
  - `suggestRules(events) -> [{id, kind:'hook-library'|'never-phrase'|'category-weight', proposal, evidence:[eventIds]}]`
  - `applySuggestion(id)`
  - `dismissSuggestion(id)`

- [ ] Step 1: Write the tests.
  - `learn: two edits away from the same library hook suggest replacing it`.
  - `learn: phrase deleted in 3 caption edits suggests never-phrase`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 12: Optional Claude caption polish

**Files:**
- Create: `lib/providers/claude.js`
- Test: `test/claude.test.js` (stubbed fetch)

Load the `claude-api` skill before writing this.

**Interfaces:**
- Produces: `polishCaption(text, {market, facts, rules}) -> text`. It is disabled with no key.
- QA re-runs afterwards, and the polished caption is rejected if any number in it is missing from the facts.

- [ ] Step 1: Write the tests.
  - `claude: disabled without key`.
  - `claude: output with a new number is rejected`.
- [ ] Step 2: Run and expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run and expect PASS.

### Task 13: End to end and docs

**Files:**
- Create: `README.md` (how to start and the daily routine), `start.cmd`

- [ ] Step 1: `npm test` passes in full.
- [ ] Step 2: Propose next week. Build all 15 slots against live sites, then look at every card PNG.
- [ ] Step 3: Fix anything that looks off, and record it in the README "Known limits" section.
