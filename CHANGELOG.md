# Changelog

All notable changes to Barnstorm. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow `MAJOR.MINOR.PATCH`.

## [Unreleased]

### Changed
- **New lot card, from Jim's template.** The photo fills the top with the white Carbarn wordmark
  of the first cards top right, without a plate. The bar and the hook chip are set in Manrope,
  Carbarn's brand font, as in the template. The Carbarn Blue bar below holds the car's name, then white GRADE and mileage
  chips, with the auction day ("Live Auction · Thu 5 Nov") or "In Stock In Japan" on the right.
  The bar keeps the template's thin size; the hook sits in a blue chip at the photo's bottom
  left, where the template had its web address. Instagram shows the whole photo in the middle
  in Carbarn navy, with equal bands above (the logo) and below (the hook), so the car is
  never zoomed in to fill the taller picture; a blurred copy looked unprofessional. **Show the whole photo** now works on Facebook
  too, for a car that touches the edges of its photo. The green dot's glow is no longer
  clipped. No price and no web address on any picture: a stock car's
  price is in its caption only. The features line is no longer drawn; it still writes the
  caption. The info cards move their logo to the top
  right too. Posts drawn before show **Redraw with the new design**. (Jim, 2 Nov 2026: "Just
  exclude the price… there should not be website link marked on the image", then "The vehicle
  gets cutts out in the instagram post. Also what about those hooks.")
- **The car is no longer under a shade.** The dark navy shade across the top of every photo is
  gone; a soft shadow hugging the white wordmark's letters keeps it readable instead. The
  stock-gallery cards lose their bottom shade too, and every photo gets a
  light lift in brightness and contrast for flat auction-hall light. (Jim, 2 Nov 2026: "The
  shadow engulfed the vehicle a lot. So a customer might find out this uninteresting".)

### Added
- **The logo keeps off the car.** Each picture measures how much detail lies under the logo's
  top corners; the logo takes the plain-wall corner, top right unless the car is there, and the
  hook takes the other side. When both top corners are busy (old auction photos print a label in
  each), the logo drops just below them, so an auction house's own mark is never covered.
  **Photo → Logo corner** overrides it. (Jim, 2 Nov 2026: "If the logo ovelaps with the cars body
  or any part then it will reflect the position to oppsite side.")
- **Blur a plate by its four corners.** Draw a blur box now takes four clicks, one on each
  corner of the plate, so the blur follows a plate seen at an angle instead of a straight box
  around it. Right-click takes back the last corner. Older boxes still work. (Jim, 2 Nov 2026:
  "the perspective of the number plate is not straight box".)
- **Redraw with the new design.** A post drawn with an earlier card design says so in the
  studio, with a button that draws every picture again with the same cars, text and photos (and
  rewrites a caption you have not edited). A stamped post goes back to draft for a new stamp.

### Fixed
- **Gemini says why it refused.** A key whose Google project has no billing now gets a plain
  message saying billing must be turned on (Gemini's image models have no free use), instead of
  "over its quota". A real per-minute limit is waited out, as long as Google asks, and tried
  again. (Jim, 2 Nov 2026, of a post where all four photos failed: "Why is this happening.")
- **Captions no longer pick up the pictures' capitals.** "a Toyota Carina ED with alloy Wheels"
  reads "with alloy wheels" again. The capitals are added only when a picture is drawn, so the
  stored text and the captions keep the words as written.
- **A car name a little too long is set smaller instead of failing.** "1995 Mazda Bongo Brawny
  Van V" fits on the Instagram card; a line still too long at 80% of its size is reported.
- **The same warning on several cards is one line.** "Soft photo on cards 1, 2, 3 and 4",
  "Gemini could not sharpen cards 1, 2, 3 and 4".


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
