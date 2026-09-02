# Security policy

## Reporting

Please report anything security relevant through
[GitHub's private advisory form](https://github.com/john-athan/uncropped/security/advisories/new)
rather than a public issue. I will confirm receipt within a week.

## What counts

This is a browser extension that runs, on request, inside whatever page the
user was looking at. The interesting boundary is between that page and the
extension, and reports along it are always welcome, in particular:

- **Anything that makes the extension act on a page's behalf.** `content.js`
  is injected by a click and answers only messages from the extension's own
  service worker. A path by which page script drives a capture, reaches the
  offscreen document, or writes a download, is a bug.
- **Anything that leaves the page changed after `RESTORE`.** The capture
  scrolls the page, hides fixed bars and switches lazy images to eager. Every
  one of those is recorded and put back. A mutation that survives a run, or a
  run that aborts without restoring, is a bug worth reporting even when it
  looks cosmetic: it is the extension leaving state in somebody else's app.
- **Anything that gets a filename past the downloads call.** The saved name is
  built from the page host and a timestamp. A host that escapes
  `Uncropped/` and writes elsewhere in the filesystem is the highest severity
  thing here.
- **Any way to make the extension issue a network request.** It makes none. It
  holds no host permissions, bundles no libraries, and loads no script, style
  or font from any remote source. The single `fetch` in the package decodes a
  `data:` URL from `captureVisibleTab`, and `scripts/check-package.mjs` fails
  the build on any other shape.

## What does not count

- The image contains whatever was on screen, including anything private that
  was on screen. That is what a screenshot is.
- Captures are refused on `chrome://` pages, the Web Store, and other
  extensions' pages. Chrome refuses those to every extension, not just this
  one.
- A cross origin iframe is photographed as rendered rather than expanded. So is
  it in DevTools, for the same reason.
- Content inside a closed shadow root is invisible to the scroller search, as
  it is to everything else outside the component.

## Verifying a claim yourself

There is no build step and no dependency, so the source in this repository is
what runs in the browser. `tools/package.sh` produces the uploaded zip from
those files and validates it, and `scripts/provenance-check.py` records where
the code came from.
