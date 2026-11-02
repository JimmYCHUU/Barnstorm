# SDD ledger — plan: content-engine/docs/plan.md
Ruling: no git, no worktree, no commit steps — the folder is not a repo and Jim's rule is "commit only when asked" — cost if wrong: no per-task history; this ledger is the record.
Pre-flight: Task 5 consumes Task 2 Lot + Task 3 text fns + Task 1 renderCard; Task 6 consumes Task 4 checkCopy + Task 2 getLot; Task 7 consumes 2–6; Task 9 consumes store (5); Task 10 consumes Post (5). Names checked against Interfaces blocks: consistent.
Task 1: complete (tests: node --test test/render.test.js → 4/4 pass; visual match with approved Jimny card)
Task 2: complete (tests: node --test test/carbarn.test.js → 7/7 pass; live check scripts/check-sources.js OK on ie/uk/us/mt/cy)
Task 2: Ruling: added getStockVehicle + parseStockList to Task 2 (plan put stock detail in Task 8) — same payload parser, cheaper to do once — cost if wrong: none.
Task 2: Ruling: add QA rule `km-suspect` (warn when odometer ≤ 1,000 km on a car older than 1 year) — live data shows a 2018 Jimny at 1,000 km, matching the site's known placeholder defect — cost if wrong: an extra warning to dismiss.
Task 3: complete (tests: node --test test/text.test.js → 14/14 pass)
Task 4: complete (tests: node --test test/captions.test.js → 10/10 pass)
Task 5: complete (tests: node --test test/build.test.js → 8/8 pass; live UK kei-cars + US sports builds OK, 25–40 s each)
Task 5: Ruling: picker weights set by live results — make repeat −4, model-family repeat −6, non-Japanese make −4, hook-library model +3, and the 12-lot detail shortlist is itself variety-picked — first live run gave 4 Daihatsus and a Mercedes in a "JDM" post — cost if wrong: retune numbers in lib/pick.js.
Task 5: Ruling: "A genuine Type R" hook only for HONDA (point rules accept an optional make) — Subaru "TS TYPE R" trim would mislead — cost if wrong: none.
Task 5: Ruling: QA us-age/cy-age use the model year, not regDate — regDate is a registration date (a 1997 Evo IV showed 2002-08), the site already filters by build month — cost if wrong: borderline cars only get a warning.
Task 6: complete (tests: node --test test/qa.test.js → 17/17 pass; wired into build via defaultDeps.qa)
Task 7: complete (tests: node --test test/api.test.js → 7/7; full suite 71/71; browser check of Today, Review, editor tabs, blur drawing maps exactly onto the render)
Task 7: Ruling: added /refresh-counts and /reopen routes (not in plan) — needed for the counts-stale fix and to undo an approval — cost if wrong: none.
Task 8: Ruling: stock "own" photos are classified by size after download — the nichibo stock server re-hosts auction shots at 1024x768/640x480 (turntable/booth) before Carbarn's phone yard shots (1600x1200, portrait); only the latter are used — cost if wrong: a reviewer may need to swap a photo; plates tick now applies to own photos too.
Ruling (Tasks 1/5/7): every card renders twice — 1080x1080 for Facebook and 1080x1440 for Instagram — because Jim saw square cards cut off on Instagram's 3:4 grid (parallel session, recorded in memory 1 Nov); IG geometry copied from posts/*/template/card.html (.ig rules) — cost if wrong: double render time.
Task 8: complete (tests: node --test test/topics.test.js → 9/9; full suite 85/85; live build of how-it-works + market-fact for all 5 markets, both formats, no overflow)
Task 8: Ruling: "Pay only if you win" step title became "Invoiced only if you win" — the kit bans "pay nothing until you win" and prefers "invoiced only if your bid wins" — cost if wrong: one string in lib/topics/how-it-works.js.
Task 8: Ruling: stock cards hide grades outside S/6–1/R/RA and omit 0 km — live data had a "grade 9", 0 km Carry — cost if wrong: none.
Task 9: complete (tests: node --test test/planner.test.js → 8/8; api plan test; full suite 94/94; live propose for week of 2 Nov skips the hand-made Monday posts)
Task 9: Ruling: planner skips any day that already has a post for that Page, puts "not used on this Page in 14 days" above "no same-day clash between Pages", and lets Pages with fewest categories choose first — a live run double-booked Mon 2 Nov — cost if wrong: retune in lib/planner.js.
Task 9: Ruling: seed history (config/seed-history.json) holds the 5 hand-made posts of 2 Nov and their 20 lots; copied to data/history.json on first start — cost if wrong: edit the file.
Task 10: complete (tests: node --test test/publish.test.js → 7/7; full suite 101/101)
Task 10: Ruling: Instagram API upload uses a 4:5 trim (1080x1350) of the 3:4 card, staged as an unpublished Page photo for its CDN URL — the Graph API accepts 4:5 at the tallest and needs a public image URL; the 3:4 design keeps 64px clear top and bottom — cost if wrong: switch crop off if Meta accepts 3:4.
Task 10: Ruling: export writes a .engine.json marker and never writes into a folder without one (adds -2) — protects hand-made post folders — cost if wrong: none.
Task 10: Ruling: without a Page token, Publish is a "rehearsal" that logs the exact calls (tokens redacted) to data/publish-log/ — cost if wrong: none.
Task 11: complete (tests: node --test test/learn.test.js → 5/5; full suite 106/106; Settings, Learn, Publish screens checked in the browser)
Task 11: Ruling: config files are read through lib/config.js (CE_CONFIG override) so tests can apply learned rules to a copy — cost if wrong: none.
Task 12: complete (tests: node --test test/claude.test.js → 6/6; full suite passes). @anthropic-ai/sdk pinned to 0.135.0 (newest release older than two weeks on 1 Nov 2026); model claude-opus-5-5, effort low, server-side refusal fallback "default".
Task 12: Ruling: the polish is refused unless every number, link and hashtag survives and no banned phrase appears — the design forbids facts from an AI — cost if wrong: an over-strict refusal; the original caption is kept.
Task 13: complete (npm test → 116/116; live end-to-end: live-lots for all 5 Pages and stock spotlights for all 5, both formats, no overflow; README.md + start.cmd written)
Task 13: Ruling: variant names keep only grade codes / known words from the start (max 2) — live feed produced "Serena E-", "CR-V Ex* Black", and "PREMIUM" trims (a banned word) — cost if wrong: an occasional missing trim name, editable per card.
Task 13: Ruling: hooks are de-duplicated within a post (next option, features recomputed) — a live Malta post had three "Top marks: grade 6" — cost if wrong: none.
Task 13: Ruling: stock posts carry a 'hero-photo' warning — yard photos are unsorted (live Alphard/Hiace heroes were interiors; one gallery card showed a chassis number) and no image classifier is used — cost if wrong: one extra glance per stock post.
Final review: fresh reviewer (subagent, most capable model) — 1 Critical, 4 Important, 8 Minor, 5 declined to judge.
Final: fixed own-photo cards had no "Plates checked" tick (Critical) — test/ui.test.js editor test asserts #plates, verified in browser; suite 136/136
Final: fixed publish/export ignored red checks and post-approval edits — 'api: publishing re-reads the lots and refuses when one is gone', 'build: editing an exported post sends it back to draft', 'build: a re-check that finds errors sends an approved post back to draft', 'publish: refuses a post with blocking QA flags' RED→GREEN
Final: fixed partial publish not recorded (duplicate Facebook post on retry) — 'publish: a failed Instagram leg keeps the Facebook result and never posts twice' RED→GREEN
Final: fixed getLot accepted a page for a different car — 'carbarn: a page for a different lot is refused as not found' RED→GREEN
Final: fixed lot-spotlight crash with no eligible lot — 'lotSpotlight: no eligible lot gives a readable error' RED→GREEN
Final: fixed (re-graded Minor→Important) empty km/pill/model passed QA; outage reported as "lot gone" — 'qa: an empty km, pill or model is a missing-fact error', 'qa: an unreachable site is not reported as a withdrawn lot' RED→GREEN
Final: fixed (re-graded Minor→Important) UTC "today" is yesterday until 06:00 in Dhaka — 'dates: today() uses the local calendar date' RED→GREEN
Final: fixed (re-graded Minor→Important) other websites could POST to the local API; unvalidated dates reached folder names; unescaped error text — 'api: requests from another website are refused', 'api: a malformed post date is refused' RED→GREEN
Final: fixed (re-graded Minor→Important) published posts could go back to draft and be published again — 'api: a published post cannot go back to draft' RED→GREEN
Final: fixed regression found while verifying the fixes: `$$` in a String.replace replacement corrupted two editor handlers (format toggle, card select) — new test/ui.test.js (7 browser smoke tests) goes RED when the bug is reintroduced, GREEN after
Final: minor (deferred): every save copies all 8 PNGs into a new version folder (about 10–15 MB per version); hard-link or skip unchanged cards later.
Final: minor (deferred): Learn could suggest banning a phrase that the engine's own caption template writes; accepting it would make every new post fail QA until edited.
Final: Ruling: declined-to-judge — 4:5 crop now verified pixel-identical; Instagram's JPEG preference relies on Facebook's CDN re-encoding the staged PNG (unverifiable until a Page is connected); stock "shipping included" mirrors the sites' own "Shipping included" label; auction photos stay warn-only (Jim's call, flagged on every post).

## Barnstorm: rename, themed rotation, Page feeds UI (2 Nov 2026)
Rename: complete. The app is "Barnstorm, Carbarn's social media agent"; the name is read from config/app.json (UI title and wordmark, start window, posting-pack footer).
Themes: complete (tests: test/collections.test.js; planner, captions, build and api tests). config/collections.json holds 28 themes (brands, models, filters such as manual, diesel 4x4, grade 5/6, nearly new, eight seats); scripts/check-collections.js --write keeps per-Page lists to themes with at least 40 live lots.
Ruling: site categories and themes are interleaved in one rotation per Page, never-posted first, then least recently used; cooldown raised 14 → 21 days — Jim had already posted the categories the old dialog defaulted to — cost if wrong: change categoryCooldownDays in Settings → Schedule.
Ruling: proposing a week counts slots already planned four weeks either side (lib/planner.js plannedAround) — a live run proposed the same five categories on Fri 6 and Fri 13 Nov and repeated "How it works" — test 'api: proposing the next week rotates on from the week already planned' RED→GREEN.
Ruling: "Next up" suggestions (Feeds, New post, Settings → Rotation) also count planned slots, and pickers show "planned <date>" — cost if wrong: none.
Ruling: a slot with no eligible lots falls back to the next fresh theme (up to three) only when it is for tomorrow; further out, the error says to build it the day before — the site lists auctions only a few days ahead, so other themes would fail too — test 'api: building a far-off slot too early…' RED→GREEN.
Ruling: older data/history.json files get their hand-made folders backfilled from the seed at start, so those posts show their pictures on Feeds — test/history.test.js RED→GREEN.
UI: complete. Page feeds home (each Page as its Instagram grid; planned slots as placeholders), Posts list, studio with real Facebook and Instagram frames and an approval stamp, Plan week grid, Publish, Learn, Settings with a Rotation tab (per-Page switches, last-posted and planned dates). Product record in PRODUCT.md, direction contract in .impeccable/surfaces/ui-index-html.md.
Fixed in the screenshot review: the Instagram preview was squeezed into one third of its frame (its `ig` class collided with the feed grid's) — now `.preview.p34`; repeated plate checks show as one line ('ui: the same plate check on several cards shows as one line'); film thumbnails follow the chosen format.
Live end-to-end (scratch data): themes Malta Honda, US Toyota, Ireland Land Cruiser and UK manual each built 4 cards of only that theme's cars; npm test → 161/161 (after the finish review fixes).
Finish review (impeccable, degraded mode: a fresh general-purpose agent following degraded/finish-reviewer.md, because the shipped reviewer agent is not installed): round 1 "fix" with 8 material items; round 2 scored 6 resolved, 3 partial, 3 new. All remaining items were fixed after round 2 and confirmed by screenshot, but not re-scored (the two-round budget was used).
Ruling: planned slots that already repeat a recent post on their Page are moved when the plan is opened (lib/plan-routes.js repairPlan), as well as after any build (moveClashingSlots) — test 'api: opening a plan moves any slot that already repeats…' RED→GREEN.
Ruling (declined from review): "How it works" is not staggered across Pages — it is a format with each market's own facts, not a category or theme. Status words stay as text pills where they must be read; only stamped posts get the round seal.
Fixed: the feed's planned tiles reused the Plan's .slot style (an 8px white mat) — renamed .tile.ghost; the Instagram caption could not be reached under the sticky stage at 1000px tall — frame now sized to the window.
DESIGN.md and .impeccable/design.json written from the built system; the five Carbarn logos carry their origin (impeccable embed-prompt).

## Feeds panel and caption copying (2 Nov 2026)
Asked: "There is a huge white space in the right side of the panel. Also there's no caption copying system available as well." (Jim, 2 Nov 2026.)
Found: at 1920 px the Feeds grid stopped at 700 px plus a 300 px side column (`.feed`), leaving about 600 px empty; the studio centred a 520 px frame in a wide column with empty space either side. Copy caption existed only on Publish, for approved posts.
Fixed: Feeds is grid | panel. Clicking a tile opens it in the panel: its pictures, the full chosen caption with Copy caption, and Open in studio / Export pack (Build and Change on the Plan for a planned slot). Up next and Rotation sit beside the panel from 1600 px, under it below that.
Fixed: the studio's stage is exactly as wide as the picture can be and still fit the window; the inspector takes the rest. From 760 px of inspector width the caption leaves its tab for its own column, with Copy on each version (copies the box as it is, saved or not). Copy caption above the preview on every post.
Fixed: "Polish the chosen caption with Claude" had no click handler; it now calls /api/posts/:id/polish for the chosen caption.
Copy goes through one helper (ui/lib.js copyText): clipboard API, a textarea fallback, the button reads "Copied" for 1.6 s, and a toast.
Tests: 'ui: a feed tile opens beside the grid, and its caption copies' and 'ui: a wide studio gives the caption its own column, and Copy caption copies the chosen one' read the clipboard back; npm test → 162/162. Screens checked at 1920×1080, 1536×864 and 1366×768.

## Feeds: two panes of one height (2 Nov 2026)
Asked: "this ui looks broken, no symmetry, how does it falls under good ui ux" (Jim, 2 Nov 2026, screenshot at 1920 wide, 905 tall).
Found: three columns of content height (grid, a 130 px panel for a hand-made post, Up next and Rotation) ended at three different heights with dead space under each; planned tiles were grey blocks that read as broken images; the Page chips ended at two thirds of the width.
Ruling: Feeds is two panes filling the window height (`.feed`, 100vh - 168px), each with the same 104 px head band and 60 px foot band, so tops, bands and bottoms line up; each pane scrolls inside itself. Right pane has one structure for every tile kind (picture | caption, then actions). Up next and Used lately dropped from Feeds as duplicates of the grid and Settings → Rotation — cost if wrong: one click to Settings.
Added: hand-made posts carry their pictures and Caption A from caption.md (lib/feed-routes.js) — test 'api: a hand-made post in the feed carries its pictures and Caption A from caption.md' RED→GREEN.
Checked: pane edges measured equal at 1920×905, 1536×730 and 1366×650 (heads 249/249, foots equal); stacked below 1180 px. npm test → 163/163.
