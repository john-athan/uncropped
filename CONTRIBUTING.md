# Contributing

## Running it

Load the repository folder unpacked from `chrome://extensions` with Developer
mode on. There is no build step and no dependency, deliberately: everything
here is the platform. Reload the extension after a change; the page half is
injected fresh on every capture, so no tab reload is needed.

```sh
tools/package.sh                # the store zip, validated
tools/render-assets.sh          # icons, promo tiles, store screenshots
oss provenance uncropped        # where new code came from
```

## Testing a change

There is no unit test suite, because almost nothing here is a pure function.
What the extension does is scroll a real page and photograph it, so the tests
are three pages that break in three different ways. Open
`tests/pages/index.html` from disk and capture each one:

| | What it is | What a correct capture looks like |
|---|---|---|
| `article.html` | Document scrolls, sticky header, lazy images | Tall image, header once at the top, no blank image boxes |
| `app-shell.html` | `html` and `body` are one viewport tall, a `div` scrolls | Tall image of the panel only, sidebar not repeated down the side |
| `wide-table.html` | Wider and taller than the window | One wide tall image, cells labelled `row.column` so a seam or a skip is readable |

`app-shell.html` is the case the built in DevTools capture gets wrong, and the
reason the extension exists. Re-run it after any change to the scroller search.
A pull request that touches `content.js` should say which of the three were
captured and on what device pixel ratio, because a fractional DPR is where the
tile arithmetic goes wrong.

## What a change should not do

Three constraints hold the design together, and a change that breaks one needs
an argument rather than a patch:

- **No dependency, and no build step.** CI fails if a `package.json`,
  a lockfile or a `node_modules` appears. The source in the repository is the
  shipped file, which is what makes the privacy claim checkable by a stranger.
- **No host permissions, and no declared content script.** The extension can
  only reach a page the user clicked it on. `scripts/check-package.mjs` fails
  if either creeps back in.
- **No network call.** Nothing is fetched, sent or measured. The one `fetch`
  in the package decodes a `data:` URL and the package checker allows that
  exact shape and nothing wider.

## Before opening a pull request

```sh
node --check background.js && node --check content.js \
  && node --check offscreen.js && node --check options.js
tools/package.sh
oss provenance uncropped
```

If the change borrowed an idea, an algorithm or a block of code from
somewhere, say where in the pull request and add it to
[THIRD_PARTY.md](THIRD_PARTY.md). The provenance check asks GitHub the same
question afterwards, and it is better to have the answer already written down.
