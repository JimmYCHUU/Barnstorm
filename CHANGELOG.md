# Changelog

All notable changes to Barnstorm. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow `MAJOR.MINOR.PATCH`.

## [Unreleased]

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
