# Contributing

Barnstorm is a working tool for one business's social media. Changes are welcome as pull requests.
The rules below are what keep it safe to share.

## The four rules

1. **Two dependencies, no build step.** `playwright-core` draws the pictures in the installed
   Chrome, and `@anthropic-ai/sdk` is used only for the optional caption polish. Everything else is
   Node.js built-ins (`node:http`, `node:test`, …), plain ES modules, plain CSS and HTML. A new
   package needs a reason that nothing built in can meet.
2. **Public or invented data only.** Test fixtures are saved copies of Carbarn's public listing
   pages; anything else in tests and documentation is made up. Never commit a real post from
   `data/`, a token, a key or a screenshot of a real account.
3. **Nothing private leaves the computer.** Run `npm run check-private` before every push, and
   enable the hook so it runs by itself: `git config core.hooksPath .githooks`. `data/` and every
   secrets file are git-ignored; keep them that way.
4. **The product rules are fixed.** Nothing is posted without the approval stamp and a person
   pressing Publish; every number on a card or in a caption comes from the listing and is re-read
   before approval; the banned words block approval; auction-house photos carry their warning. A
   change that weakens one of these will not be merged.

## Working on it

```bat
npm test                 :: every check, about thirty seconds, no internet
npm run check-private    :: before every push
npm start                :: the app on http://localhost:5317
```

- One branch and one pull request per change. Keep the app working end to end at every commit.
- Commit titles read `Area: what changed, in plain words`, for example
  `Feeds: a tile opens beside the grid with its caption to copy`.
- Write for the owner, who is not a developer: plain words in the app, in the README and in
  commit messages.
- A change to behaviour comes with a test, and with the README and `CHANGELOG.md`
  ("Unreleased") updated in the same pull request. Interface changes follow `DESIGN.md`.
- No AI is ever credited as an author or co-author in a commit, pull request or file.
