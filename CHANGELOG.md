# Changelog

All notable changes to Barnstorm. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow `MAJOR.MINOR.PATCH`.

## [Unreleased]

### Changed
- **R and RA grade cars are never put in a post.** Cars with a repair history are left out of
  live-lot and lot-spotlight posts and out of the swap list. Carbarn's own stock is unaffected.
  (Jim, 2 Nov 2026, after rejecting a post because "This lot is R grade": "r should be skipped".)
- **Every word on the pictures starts with a capital.** The hook, the features line and an info
  card's title: "Room For Seven", "Pocket-Sized 4x4", "4WD · 5-Speed Manual · Keyless Entry". What
  you type in the Text tab follows the same rule. Short forms, numbers and km are unchanged;
  body text and captions stay in sentences. (Jim, 2 Nov 2026: "Every words first letter should be
  capital letter.")

### Added
- **Rebuild, change or remove a built post on the Plan.** Rebuild builds the day again with the
  same theme and other cars. Change rebuilds it with another topic, theme or date. Remove takes
  the post off so the day can be built again. The new post is built before the old one comes off,
  so a failed rebuild leaves things as they were. Published posts stay. (Jim, 2 Nov 2026: "There
  should be option to remove this lot. and re generate with same or different category".)
- **A rejected post frees its day.** Rejecting a post in the studio puts its Plan slot back to
  planned, with the reason in a note, and the next build skips its cars. Before, a rejected post
  kept the slot, and Build only reopened it.
- **Soft photos are sharpened with Gemini.** With a Gemini API key saved in Settings → Connections,
  every listing photo narrower than 1000 px is sent to Google's Gemini when a post is built and
  comes back as a sharper 2K version (about US$0.05 a photo). Gemini is told to change nothing
  about the car, keep all text and logos including watermarks, and keep blurred plates blurred.
  Every sharpened photo is flagged to compare with the original in the Photo tab, where **Use the
  original** puts it back, and the plates check starts again. A key is checked with Google before
  it is saved. (Jim, 2 Nov 2026: "The pictures for vehicles are a bit low resolution … I want to
  use the gemini for that.")

### Fixed
- **Built posts on the Plan are compact rows.** A small picture beside the theme and status,
  instead of a full-size card that stretched a whole row of the week.
- **The side menu stays in place on long pages.** On Settings, Plan or the studio, scrolling
  used to carry the navy menu away and leave white space under it.

### Changed
- **Feeds is two panels of one height.** The Page and its grid on the left, the picked post on the
  right, with matching header and footer bands, so the edges line up at every window size. The
  five Pages are equal tabs across the full width. Planned posts are dashed placeholders with
  their theme and a Build button instead of grey blocks. Up next and Used lately are gone from
  Feeds: the grid already shows what's coming, and Settings → Rotation shows when each theme was
  last used. (Jim, 2 Nov 2026: "this ui looks broken, no symmetry".)

### Added
- **Hand-made posts open with their pictures and caption.** Picking one shows all its pictures
  and the Caption A from its `caption.md`, with Copy caption and Open folder.

## [1.0.0] - 2026-11-02

### Added
- **Barnstorm, Carbarn's social media agent.** Plans three posts a week for each of the five
  Carbarn Pages (Ireland, United Kingdom, United States, Malta, Cyprus), builds them from the live
  Carbarn sites as branded lot cards, checks every fact, and posts nothing without the approval
  stamp. Every picture is made twice: 1080×1080 for Facebook and 1080×1440 (3:4) for Instagram.
- **Themes that rotate.** Each Page rotates through its site categories and about 25 themes
  (brands, models and filters such as manual, diesel 4x4, grade 5 or eight seats): never-posted
  first, then the longest ago, nothing repeated on a Page within 21 days, and no two Pages on the
  same one on the same day. Hand-made posts count. Settings → Rotation switches any of them off.
- **Page feeds.** Home shows each Page as its Instagram grid before the posts exist: planned posts
  as faded placeholders to build from, built ones with their status, stamped ones with a seal.
- **The studio.** Each post inside real Facebook and Instagram frames, card by card: hooks,
  features, photos, crop, blur boxes, the plates check, two captions, every save a version to
  compare. Approve stays shut until the red checks are fixed, then stamps the post.
- **Publish.** A posting pack for Meta Business Suite, or straight to a connected Page; a rehearsal
  until one is connected.
- **Learn.** Repeated edits and rejections become suggested rules to accept or dismiss.
- **Copy caption everywhere.** On Feeds, in the studio (above the preview, and on each caption
  version) and on Publish. The button says "Copied" for a moment. (Jim, 2 Nov 2026: "Also there's
  no caption copying system available as well.")

### Changed
- **Feeds fills the window.** A tile opens in a panel beside the grid with all its pictures, the
  full caption and what to do next, where a wide screen used to show an empty third. The studio's
  preview is as wide as the picture and the editor takes the rest; on a wide screen the caption has
  its own column. (Jim, 2 Nov 2026: "There is a huge white space in the right side of the panel.")

### Fixed
- **Polish the chosen caption with Claude** did nothing when pressed; it now rewrites the chosen
  caption and checks the result.
