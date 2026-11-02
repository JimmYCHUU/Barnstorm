# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: Jim, who handles marketing for Carbarn. He runs five brand-new Facebook and Instagram Pages alone, from a desktop PC, for about 15 minutes a day. The Pages are Carbarn Ireland, United Kingdom, United States, Malta and Cyprus (confirmed 2 Nov 2026). His job each day:
- decide what goes out next;
- build tomorrow's posts from live data;
- check every picture and caption;
- approve them, then export or publish.

## Product Purpose

Barnstorm is Carbarn's social media and branding agent. It turns live data from the Carbarn export storefronts (Japanese auction lots and Carbarn's own stock) into finished, on-brand picture posts and captions. It does this through one daily loop: plan, build, check, review, publish, learn.

Success means:
- three posts a week per Page;
- no factual errors;
- no repeated categories or cars;
- a look management has already approved: the 1 Nov 2026 lot cards.

## Positioning

Every figure comes from the live listing, and no picture is invented by an image model; management rejected AI-painted looks in October 2026. Nothing is posted without Jim's stamp of approval. A generic scheduler cannot do this, because it knows nothing about daily auction churn, lot grades, per-market import rules, or the rights limits on auction photos.

## Operating Context

- **Daily churn:** auction lots change every day, so posts are built the day before they go out.
- **Five Pages, five rule sets:** the US 25-year rule; SVA/JEVIC in Malta; Cyprus's five-year limit; "people carrier" in Ireland; US spelling for the US.
- **Two formats:** every picture is 1:1 for Facebook and 3:4 for Instagram, because Instagram's profile grid crops squares.
- **Publishing:** until Meta Page tokens exist, approved posts are exported as posting packs and scheduled in Meta Business Suite.
- **Photo rights:** auction-house photos carry a reposting warning. Carbarn's own yard photos are rights-safe but can show number plates.

## Capabilities and Constraints

- Local web app on Windows, started with `start.cmd`, at localhost:5317. Pictures are rendered by the installed Chrome.
- Topics:
  - live lots by theme (site categories plus themed collections, rotated so a Page doesn't repeat itself);
  - lot spotlight;
  - stock car;
  - How it works;
  - market fact.
- Quality checks block approval on:
  - facts that don't match the listing, or lots that are gone;
  - banned words;
  - overflowing text;
  - unchecked plates.
- Versions are kept for every edit, with side-by-side comparison.
- Publishing goes through the Meta Graph API when connected, and runs as a rehearsal otherwise. Secrets are stored outside the project.
- **Undecided:** engagement analytics (needs tokens), and scheduled auto-publishing.

## Brand Commitments

- **Name: Barnstorm.** Jim asked for a name tying Carbarn to a social-media and branding agent; the builder chose it on 2 Nov 2026, and it is one setting, open to change.
- **Carbarn identity:** Carbarn Blue `#0473EA`, navy `#061D33`, Montserrat on social pictures, Manrope on the web, and the CARBARN wordmark with the market name under it.
- **The approved lot-card look is fixed:** photo above, Carbarn Blue bar, hook, then model and features, km pill, grade badge, logo top-left.
- **Copy rules:** from the Facebook About kit. Never "best", "premium", "guaranteed", "no hidden costs", "this week" and so on.

## Evidence on Hand

- Approved post sets in `../posts/`: Ireland 7–8 seaters, UK kei cars, US JDM sports, Malta city hatchbacks, Cyprus hybrids.
- Market logos in `assets/logos/`.
- The About kit: `../reports/Facebook About section kit.md`.
- No engagement data, testimonials or performance figures exist. Never invent them.

## Product Principles

1. **Facts before flair.** A wrong number is worse than a dull hook.
2. **Nothing goes out without the stamp.** Approval is explicit, and any later change re-opens it.
3. **Variety by default.** Rotate categories and cars across Pages and weeks. Never repost what has been posted.
4. **Instagram is a first-class format.** Judge every post in both shapes.
5. **One person, fifteen minutes.** The next action is always obvious, and routine work takes one click.
