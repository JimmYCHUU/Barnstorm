---
name: Barnstorm
description: Carbarn's social media agent, a local desk for planning, checking and stamping Facebook and Instagram posts for five Pages.
colors:
  carbarn-blue: "#0473EA"
  carbarn-blue-deep: "#0360C5"
  blue-wash: "#E8F1FE"
  blue-line: "#B9D5FA"
  harbour-navy: "#061D33"
  harbour-navy-raised: "#0B2A49"
  rail-ink: "#B7C8DE"
  ink: "#0E1B2C"
  ink-soft: "#34465C"
  muted: "#5E6E83"
  faint: "#8A98AA"
  line: "#DCE3EC"
  line-soft: "#E9EEF4"
  paper: "#F3F6FA"
  surface: "#FFFFFF"
  sunk: "#F7F9FC"
  signal-red: "#C2362B"
  red-wash: "#FCEDEB"
  amber: "#8F5B00"
  amber-wash: "#FFF3D6"
  go-green: "#11764A"
  green-wash: "#E4F4EB"
typography:
  wordmark:
    fontFamily: "Montserrat, Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  dialog: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.carbarn-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.carbarn-blue-deep}"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-default-hover:
    backgroundColor: "{colors.sunk}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.signal-red}"
    rounded: "{rounded.sm}"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.carbarn-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  status-chip:
    backgroundColor: "{colors.line-soft}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 9px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px"
---

# Design System: Barnstorm

## Overview

**Creative North Star: "The Proof Desk"**

Barnstorm is a printer's proof desk for social posts. Every Page is laid out as the Instagram profile it will become, every post is checked inside the real Facebook or Instagram frame it will appear in, and nothing leaves the desk without a stamp. The world is Carbarn's own: a deep harbour-navy rail, a cool paper canvas, white working surfaces, and Carbarn Blue held back for the moments that mean "go".

It is a working tool for one person, used about fifteen minutes a day at a desktop. Density is moderate: the posts themselves (the car pictures) are the loudest thing on every screen, and the interface stays quiet around them. Expression lives in precise details, the stamp, the status seals, and the authored icon set, never in decoration.

**Key Characteristics:**
- Navy rail and paper canvas; white surfaces for work.
- Carbarn Blue only for action, selection and approval.
- Posts are always shown at their real ratio: Instagram 3:4, Facebook 1:1.
- One status vocabulary with one colour per state, everywhere.
- One lift shadow for things that float; everything else is flat with hairlines.

## Colors

A restrained palette: Carbarn's navy and blue on cool neutrals, plus three signal colours that only ever mean status.

### Primary
- **Carbarn Blue** (#0473EA): primary buttons, the active rail item, selected tabs and segments, focus rings, the selected Page chip, and the approval stamp. Its rarity is what makes "Build" and "Approve" findable.
- **Carbarn Blue Deep** (#0360C5): hover state of primary buttons.
- **Blue Wash** (#E8F1FE) and **Blue Line** (#B9D5FA): focus halos, "Exported" chips, info flags, and the dashed outline of planned slots.

### Secondary
- **Harbour Navy** (#061D33): the left rail and the wordmark block; also the toast and overlay scrim (at 42%).
- **Harbour Navy Raised** (#0B2A49): rail hover.
- **Rail Ink** (#B7C8DE): rail labels at rest.

### Neutral
- **Ink** (#0E1B2C): headings and body text.
- **Ink Soft** (#34465C): secondary text, table headers, inactive segment labels.
- **Muted** (#5E6E83) and **Faint** (#8A98AA): hints, dates, placeholders, idle seal dots.
- **Line** (#DCE3EC) and **Line Soft** (#E9EEF4): borders and dividers.
- **Paper** (#F3F6FA): the canvas behind everything.
- **Surface** (#FFFFFF): panels, frames, inputs, cards.
- **Sunk** (#F7F9FC): hover fills, empty states, row headers.

### Status
- **Signal Red** (#C2362B) on **Red Wash** (#FCEDEB): "Needs fixes", blocking checks, Reject, Rejected.
- **Amber** (#8F5B00) on **Amber Wash** (#FFF3D6): "To stamp", warnings, slot notes. The seal dot uses a brighter amber (#E5A100).
- **Go Green** (#11764A) on **Green Wash** (#E4F4EB): "Approved", connected Pages.

### Named Rules
**The Blue Means Go Rule.** Carbarn Blue marks only what to press, what is selected, and what is stamped. Never use it for decoration, headings or large fills.

**The One Vocabulary Rule.** Post state is always one of Planned, To stamp, Needs fixes, Approved, Exported, Published or Posted by hand, with the same colour on every screen, as a chip in lists and as a seal on pictures.

## Typography

**UI Font:** Manrope (with Segoe UI, system-ui)
**Wordmark Font:** Montserrat 900 (Carbarn's brand face), used only for the BARNSTORM wordmark and the approval stamp

**Character:** Manrope is a calm, slightly geometric workhorse that stays legible at 12px. Montserrat Black appears only where the brand speaks, so it keeps its weight.

### Hierarchy
- **Wordmark** (900, 18px, 0.02em tracking): the BARNSTORM mark in the rail block.
- **Headline** (800, 24px, 1.2, −0.015em): one per screen, the page title.
- **Title** (800, 17px, 1.3): panel and section titles; 14px inside the studio inspector and feed sidebar.
- **Body** (500, 14px, 1.5, tabular figures): all reading text, inputs, table cells.
- **Label** (700, 12px, 1.3): form labels, chips, table headers, dates.

### Named Rules
**The Tabular Numbers Rule.** Figures are tabular everywhere (counts, dates, mileage), so columns and badges never jitter.

**The No Eyebrow Rule.** Headings stand alone. No small uppercase kicker sits above a heading.

## Layout

A fixed app shell: a 56px top bar (wordmark block, breadcrumbs, and the "Tomorrow" build status with its button on the right) over a 224px navy rail and a scrolling main area with 24px top and 28px side padding.

- **Feeds** (home): a row of Page chips, then a two-column layout. On the left (up to 700px) is the Page profile header and a three-column 3:4 grid with 4px gutters, like an Instagram profile. On the right (300px, sticky) are "Up next" and "Rotation".
- **Studio:** three columns. A 92px film strip, a centred stage up to 520px wide holding the native frame, and a 400px inspector.
- **Plan:** a single bordered week grid (112px Page column plus seven days), with today's column tinted.

Spacing steps are 4, 8, 16, 24 and 32px; space above a section heading is larger than below it.

**Responsive:**
- At 1280px the feed sidebar narrows to 260px and the studio inspector to 360px.
- At 1060px the rail collapses to 72px icons (counts become corner badges). The studio becomes preview plus a 340px inspector, with the film strip as a row above.
- Below 900px everything stacks.
- The Instagram frame's width follows the window height, so its action row stays near the fold.
- Barnstorm is desktop-only by decision.

## Elevation & Depth

Flat by default, separated by 1px hairlines and tonal steps (paper, surface, sunk). A single soft "lift" shadow marks only what floats over the page: the post frame in the studio, dialogs, the busy overlay card, toasts, and a hovered post card.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgba(6,29,51,.06), 0 10px 28px rgba(6,29,51,.10)`): floating frames, dialogs, toasts, hover on post cards and built slots.
- **Seal** (`box-shadow: 0 1px 3px rgba(6,29,51,.18)`): status seals sitting on pictures.
- **Focus halo** (`box-shadow: 0 0 0 3px #E8F1FE`): focused inputs and the selected Page chip.

### Named Rules
**The One Lift Rule.** There is exactly one elevation. If something needs more emphasis, change its colour or position, not its shadow.

## Shapes

Gently rounded and consistent:
- buttons and inputs at 8px;
- slots and list rows at 10px;
- panels, frames and the week grid at 12px;
- dialogs at 16px;
- chips, seals, Page chips and switches as full pills.

The Instagram grid itself is square-cornered with 4px gutters, rounding only its outer top corners, as on a real profile. The circle is reserved for the approval stamp and its 44px seal mark.

## Components

### Buttons
- **Shape:** gently rounded (8px), 36px tall; small buttons are 30px.
- **Primary:** Carbarn Blue with white label, a leading 16px icon. Reserved for the main action of a view: Build, Approve, Save, New post.
- **Default:** white with a hairline border; hover fills with Sunk and darkens the border.
- **Danger:** white with a red label; hover fills with Red Wash.
- **Ghost:** no border or fill until hover; used for icon-only actions (change, drop, reorder).
- **Press:** a 1px downward nudge. All transitions run 150ms on the standard ease.

### Status chips and seals
- **Chip:** a 24px pill with a 7px dot in the state colour on its wash, used in lists and headers.
- **Seal:** the same state as a white pill with a coloured dot, laid over pictures (centred at the top of a tile).

### Panels
White, 12px corners, hairline border, 18px padding, no shadow. A "flush" panel drops its padding and holds rows divided by hairlines (publish rows, suggestions, activity).

### Inputs / Fields
White, hairline border, 8px corners, 8px by 10px padding. On focus the border turns Carbarn Blue with a 3px Blue Wash halo. Labels sit above in Label type. Switches are 36px by 20px pills that turn Carbarn Blue when on.

### Navigation
The navy rail holds six items (Feeds, Plan, Posts, Publish, Learn, Settings), each an authored 20px line icon plus a 14px bold label.
- **Hover:** raises the item to Harbour Navy Raised.
- **Active:** fills it with Carbarn Blue.
- **Counts:** shown as small pills (posts to stamp, posts ready to publish).
- **Rail foot:** carries the product's promise, "Nothing goes out without your stamp".

### Native post frames (signature)
The studio shows each post inside a faithful frame:
- **Facebook:** the Page header with avatar and date, the caption cut at "See more", the 1:1 picture, then Like, Comment and Share.
- **Instagram:** the handle, the 3:4 picture, carousel dots, the action row, then the caption cut at "more".
- **Toggle:** a segmented control switches formats, and the film strip follows the chosen ratio.

### Approval stamp (signature)
An approved post carries a round Carbarn Blue seal reading "APPROVED" and the post date on its preview.
- **Shape:** 150px, Montserrat 900, rotated −12°, set in the upper photo area so it never covers the card's auction pill or hook.
- **Motion:** it drops in (scaling from 1.6× over 260ms) only at the moment of approval. Reduced-motion users get it without the movement.
- **Afterwards:** it sits still and fades to 12% while the pointer is over the preview, so the card stays readable.
- **While red checks are open:** the Approve button is blocked (muted blue, "Approve · 4 to fix") and points to the checks instead.

### Page feed tiles
- **Grid:** three columns of 3:4 tiles, newest first, like Instagram.
- **Built posts:** show their Instagram picture untouched. Nothing is laid over the card's printed hook; the theme and date are in the tooltip and accessible name. "To stamp" and "Needs fixes" carry a status seal pill. Approved, exported and published posts carry a 44px round seal mark rotated −12° (blue, navy once published).
- **Up next list (narrow column):** status is a bare 10px dot in the state colour (hollow for Planned), with the word in its tooltip and accessible name, so each post stays on one line.
- **Planned posts:** a faded preview of the card they will become. The top 62% is a pale photo area with the topic icon; below is a light Carbarn-blue band with the theme as its title, then topic and date. Build appears over the photo area on hover or focus.
- **Hand-made posts:** show their picture with a "Posted" seal.

## Do's and Don'ts

### Do:
- **Do** show every post at its real ratio (Instagram 3:4, Facebook 1:1) and inside its native frame when it is being judged.
- **Do** keep Carbarn Blue (#0473EA) for action, selection and the stamp only.
- **Do** use the one status vocabulary and its colours for every state, on every screen.
- **Do** use the authored 24px line icons (1.75px stroke, round caps) with every primary action.
- **Do** keep motion between 150 and 260ms on the standard ease (cubic-bezier(.2,.8,.2,1)), and honour reduced motion.

### Don't:
- **Don't** put a small uppercase eyebrow or kicker above headings.
- **Don't** add hero-metric cards or decorative charts; counts live inline in the profile header.
- **Don't** add a second shadow level or glassy or blurred surfaces.
- **Don't** use Montserrat beyond the wordmark and the stamp.
- **Don't** show a post cropped to a ratio it will not be published in.
