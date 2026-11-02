# Barnstorm 📣

![Node.js 22 or newer](https://img.shields.io/badge/node-%E2%89%A522-339933)
![Dependencies](https://img.shields.io/badge/dependencies-2-lightgrey)
![Pages](https://img.shields.io/badge/Pages-5%20Facebook%20%2B%20Instagram-0473EA)
![Posts only on your stamp](https://img.shields.io/badge/posting-only%20after%20your%20stamp-orange)

Carbarn's social media agent. Turns a topic into finished Facebook and Instagram pictures and captions for the five Carbarn Pages (Ireland, United Kingdom, United States, Malta, Cyprus). The pictures follow the lot cards approved on 1 Nov 2026. All facts come from the live Carbarn sites. Nothing is posted without your approval.

The name lives in `config/app.json`; change it there and it changes in the app, the start window and the posting packs.

`Node.js 24` · `Chrome via playwright-core` · `Live Carbarn site data` · `Claude caption polish, if a key is added`

---

## Table of contents

- [Start it](#start-it)
- [The weekly routine](#the-weekly-routine-about-15-minutes-a-day)
- [What each post can be](#what-each-post-can-be)
- [Rules it follows](#rules-it-follows)
- [Connecting Facebook and Instagram](#connecting-facebook-and-instagram-later)
- [Where things live](#where-things-live)
- [Choosing categories and themes](#choosing-categories-and-themes)
- [Known limits](#known-limits)
- [For a developer](#for-a-developer)
- [Licence](#licence)

## Start it

Double-click **`start.cmd`**. Your browser opens **http://localhost:5317**. Keep the black window open while you work, and close it to stop Barnstorm.

The first start installs two small packages: `playwright-core` drives your installed Chrome to draw the pictures, and `@anthropic-ai/sdk` is used only if you add a Claude key.

## The weekly routine (about 15 minutes a day)

**Feeds** is home: each Page shown as its Instagram grid before the posts exist. Planned posts are dashed placeholders with a **Build** button; built posts show their picture and status (To stamp, Needs fixes, Approved, Published). The screen is two panels of the same height. Left: the Page and its grid, with the categories and themes it rotates to next along the bottom. Right: whichever tile you click, with its pictures, the full caption and **Copy caption**, and what to do next (**Check and stamp**, **Export pack**, or **Build** for a planned one). Hand-made posts show their pictures and the Caption A from their own `caption.md`, so those can be copied too.

1. **Plan (Monday):** press **Propose this week**. Each Page gets three posts a week:
   - **Mon and Fri:** live auction lots from one category or theme.
   - **Wed:** a car from Carbarn's own stock.
   - **First post on a Page:** "How it works".
   - **Every third week:** a market fact.

   Each Page rotates through its site categories plus about 25 **themes** (brands such as Toyota or Honda, models such as Land Cruiser or Jimny, and filters such as manual, diesel 4x4, grade 5, nearly new or eight seats). Never-posted ones come first, then the one the Page has gone longest without. Nothing repeats on a Page within 21 days, counting weeks already planned, and two Pages never share one on the same day. Change or drop any slot.
2. **Build (the day before posting):** press **Build tomorrow** in the top bar. Auction lots change every day, so build late. If a theme has no lots that day, Barnstorm switches to the next one in the rotation and says so on the slot.

   Changed your mind about a built post? On the **Plan** it has three buttons:
   - **Rebuild:** builds it again with the same theme and other cars.
   - **⇄ (change):** rebuilds it with another topic, theme or date.
   - **× (remove):** takes it off the Plan, so the day is free to build again.

   The new post is built before the old one comes off, so a failed rebuild changes nothing. A post you reject in the studio frees its day by itself, and its cars are kept out of the next build. Old posts go under **Posts → Rejected**. Removing or rebuilding doesn't count as a rejection, so Learn doesn't hold it against the theme. Published posts stay put.
3. **Stamp:** open each post from Feeds or **Posts**. The studio shows it inside real Facebook and Instagram frames.
   - Hooks, features and photos can be swapped card by card.
   - Every save is a new version, and you can compare versions.
   - Fix anything red in **Checks**, then **Approve**: the post gets the approval stamp.
   - **Copy caption** above the preview copies the chosen caption, hashtags included. On a wide screen the caption sits in its own column beside the editor, with a **Copy** button on each version.
   - Tick **Plates checked** after looking at each picture. To blur a readable number plate, press **Draw a blur box** and click its four corners on the preview, following its slant (right-click takes back a corner).
4. **Publish:** on **Publish**, choose one route (every post there also has **Copy caption**):
   - **Export posting pack:** writes the pictures and `caption.md` into `posts/<Page>/<date>-<topic>/`. Square pictures are for Facebook; `instagram/` holds 3:4 versions so the Instagram grid shows the whole picture. Upload or schedule them in Meta Business Suite.
   - **Publish now:** goes straight to the Page, once the Page is connected in Settings. Until then the button says **Rehearse publish**: it records exactly what would be sent, and sends nothing.
5. **Learn:** when you keep making the same change, such as rewriting a hook, deleting a phrase or rejecting a category, Barnstorm suggests a rule. Accept or dismiss it.

## What each post can be

| Topic | Pictures | Photos used |
|---|---|---|
| Live lots | 4 lot cards from one category or theme | auction photos (see below) |
| Lot spotlight | 1 lot card | auction photo |
| Stock car | hero card plus up to 3 more photos | Carbarn's own yard photos |
| How it works | cover plus 3 steps | Carbarn's own yard photos |
| Market fact | 1 card (25-year rule, SVA/JEVIC, five-year limit…) | Carbarn's own yard photo |

Every picture is made twice: **1080×1080 for Facebook** and **1080×1440 (3:4) for Instagram**. Use the toggle above the preview to see either. For a car that touches the edges of its photo, **Photo → Show the whole photo** fits all of it, on both formats.

## Rules it follows

- **Facts:** every number comes from the listing. Before approval, every lot is re-read from the site, and a changed or withdrawn lot blocks approval.
- **Lot cards:** as in Jim's template: the photo with the white Carbarn wordmark top right (as on the first cards, no plate) and the hook from the car's selling points in a blue chip bottom left, then a thin Carbarn Blue bar with the car's name over GRADE and mileage chips, and the auction day on the right. The bar and the hook chip are set in Manrope, Carbarn's brand font, as in the template. Instagram shows the whole photo in the middle, with Carbarn navy bands above (the logo) and below (the hook), so the car is never zoomed in to fill the taller picture. The logo takes the top corner away from the car: top right, unless the car (or an auction house's own label, which must not be covered) is there and the top left is plain wall; if both top corners are busy, it drops just below them. The hook always takes the other side. **Photo → Logo corner** overrides it. No price and no web address on any picture, and no "this week" (auctions update daily). Cars graded R or RA (repair history) are never picked.
- **Capitals on the pictures:** every word of the hook, the car's name, the auction line and an info card's title starts with a capital ("Room For Seven", "Live Auction · Thu 5 Nov"), including anything you type in the Text tab. The capitals are added when the picture is drawn, so the Text tab and the captions keep the words as written. Short forms (JDM, 4WD, GR), numbers (4x4, 660cc) and km stay as they are. Body text and captions stay in normal sentences.
- **Words:** the About kit's banned words block approval, including "best", "premium", "guaranteed", "no hidden costs", "we clear customs" and "pay nothing". Edit the list in **Settings → Words to avoid**.
- **Per market:**
  - US copy says every car is at least 25 years old from its build month.
  - Malta: SVA and JEVIC certificates arranged in Japan.
  - Cyprus: within the five-year limit.
  - Ireland: "people carrier".
  - US spelling for the US.
- **Auction-house photos:** auction houses ban reposting their photos on social media. Every live-lot post carries that warning, so confirm permission before posting them. The stock-car, How it works and market-fact posts use only Carbarn's own yard photos.

## Connecting Facebook and Instagram (later)

In **Settings → Connections**, enter each Page's ID, its Instagram account ID and a Page access token. The token needs `pages_manage_posts`, `pages_read_engagement`, `instagram_basic` and `instagram_content_publish`, from a Meta app linked to the Pages.

Tokens are saved only on this PC, in `%APPDATA%\CarbarnContentEngine\secrets.json`, never in this folder. Instagram receives a 4:5 trim of the 3:4 picture, the tallest shape its API accepts. The design keeps everything clear of the trimmed edges.

An optional **Anthropic API key** adds **Polish the chosen caption with Claude**. The rewrite is refused if it changes a number, drops the link or a hashtag, or uses a banned word.

An optional **Gemini API key** (from aistudio.google.com/apikey) sharpens soft photos. Paste it in **Settings → Connections → Gemini** and press **Save key**: Barnstorm checks it with Google first, then saves it in the same secrets file, never in this folder. There is no `.env` file.

- **Billing first:** Gemini's image models have no free use. The Google project the key belongs to needs billing turned on (aistudio.google.com, API keys, the key's project, Set up billing), or Google refuses every photo and Barnstorm says so.
- **What it does:** every photo narrower than 1000 px (most auction photos are 640×480) is sent to Gemini when a post is built, and comes back as a sharper 2K version. About US$0.05 a photo, billed to the Google account; the same photo is never paid for twice.
- **What it must not do:** Gemini is told to change nothing about the car (every scratch, dent, badge and wheel stays), to keep the framing, to keep all text and logos (watermarks included) and to keep blurred plates blurred. A picture that comes back smaller or a different shape is refused, and the original is used.
- **Your check:** every sharpened photo gets a warning to compare it with the original. The **Photo** tab shows the two side by side, with **Use the original** to put it back. The plates check starts again. If Gemini fails, the post is built with the original photo and says why.
- **Settings:** untick **Sharpen soft photos automatically** to sharpen only when you press **Sharpen with Gemini** in the Photo tab. The model, the size and the 1000 px threshold are in `config/photos.json`.

## Where things live

| Path | What |
|---|---|
| `config/*.json` | markets (with each Page's themes), themes (`collections.json`), hooks, word rules, schedule, seed history, app name, photo sharpening (`photos.json`). Editable in Settings. |
| `templates/` | the card designs (HTML), bundled Montserrat font, logos in `assets/` |
| `data/posts/<id>/v<n>/` | every version of every post, with its square and `ig/` pictures |
| `data/plans/`, `data/log.jsonl`, `data/learn.json` | plans, the activity log, accepted and dismissed suggestions |
| `../posts/` | exported posting packs, next to the hand-made posts. Barnstorm never writes into a folder it did not make. |

## Choosing categories and themes

**Settings → Rotation** lists, per Page, every site category and theme with when it was last posted and when it is next planned. Switch off anything you don't want on that Page; reorder site categories to break ties. A theme is only offered on a Page where its site has at least 40 lots for it: run `node scripts/check-collections.js --write` now and then to refresh that list.

## Known limits

- **Stock photos:** Carbarn's stock photo server mixes auction shots with its own yard photos. Barnstorm keeps only phone-camera sizes (auction shots are 1024×768 or 640×480). Yard photos aren't sorted, so a stock post's first picture can be an interior or a close-up. QA asks you to check it.
- **Plates:** Barnstorm can't detect a readable number plate automatically. That's what the Plates checked tick is for.
- **Odometer:** the sites sometimes show 1,000 km as a placeholder on older cars. QA flags those.
- **Engagement:** results such as reach and likes are not read back from Meta yet. That needs connected Pages.
- **Scheduling:** posts publish when you press the button. To schedule them, export the posting pack and use Meta Business Suite.

## For a developer

- Run `npm test` for 187 tests (including browser smoke tests of every screen), using Node's built-in runner.
- Run `node scripts/check-sources.js` for a live check of all five sites.
- Run `node scripts/e2e.mjs <dataDir> <date> <topic> <market[:category]>…` to build against live data.
- Run `npm run check-private` before every push, or enable the hook once with `git config core.hooksPath .githooks`. `data/` and every secret stay on this computer.
- The engine spec and plan are in `docs/`, the build ledger is `docs/progress.md`, the changes are in `CHANGELOG.md`, and the interface design is in `DESIGN.md` and `PRODUCT.md`. See `CONTRIBUTING.md` and `SECURITY.md`.

## Licence

All rights reserved. See [LICENSE](LICENSE). The Carbarn name and mark belong to the business they refer to. The fonts in `assets/fonts` keep their own licence: see [assets/fonts/LICENSE.md](assets/fonts/LICENSE.md).
