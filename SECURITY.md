# Security and privacy

Barnstorm runs on one computer, reads Carbarn's own websites, and turns what it reads into
Facebook and Instagram posts that a person checks and stamps. These are the properties it is built
around. If you find one broken, please report it (see below).

## What it never does

- **Posts nothing by itself.** One code path sends a post anywhere: **Publish now** on the
  Publish screen, for a post that carries the approval stamp, on a Page that has been connected in
  Settings, after a confirmation that names the Page. Until a Page is connected the same button
  only rehearses: it records exactly what would be sent and sends nothing. Approval re-reads every
  lot from the site first, and a changed or withdrawn lot blocks it.
- **Reads only Carbarn's own public pages.** Listings, lots and stock come from the five Carbarn
  websites with ordinary page requests. Nothing is submitted to them, and no account is signed in.
- **Sends AI services only what their job needs.** With an Anthropic key added, **Polish the
  chosen caption with Claude** sends that caption's text, and nothing else. The rewrite is refused
  if it changes a number, drops the link or a hashtag, or uses a banned word. With a Gemini key
  added, a listing photo is sent to Google's Gemini to be sharpened: automatically when a post is
  built and the photo is narrower than 1000 px (unless that is switched off in Settings), or when
  **Sharpen with Gemini** is pressed for it. Only that photo goes, never a caption, a token or a
  post.
- **Never removes a watermark.** Sharpening keeps all text and logos in a photo as they are,
  watermarks included, and keeps blurred plates blurred.
- **Local only.** The page is served on `127.0.0.1`. Any request that changes something is
  refused when it comes from another website or origin. **Open folder** opens only folders inside
  `posts/`.
- **Keeps secrets out of this folder.** Page tokens, the Anthropic key and the Gemini key live in
  `%APPDATA%\CarbarnContentEngine\secrets.json` on this computer, never in the project, and never
  in a posting pack or a log.

## What is stored on the computer that runs it

Every post and every version of it (the cards, the captions, the square and 3:4 pictures), the
weekly plans, the history of what each Page has posted, the activity log with any reasons given for
a rejection, accepted and dismissed suggestions, and a cache of the listing photos used. All of it
under `data/`, which git never sees. Exported posting packs go to `../posts/`, outside this
repository.

## Reporting a problem

Please report anything that posts without the stamp and the button, sends a token or key anywhere
but Meta or Anthropic, sends anything to an AI service other than the caption being polished, the
page being reachable from another origin, or a private value in the repository. Use GitHub's
private vulnerability reporting on this repository ("Security" → "Report a vulnerability"), or open
an issue that describes the kind of problem without the detail. Do not include a token, a key or
anything from `data/` in a report.

## Supported versions

The `main` branch.
