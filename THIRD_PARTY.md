# Third-party material in Uncropped

Uncropped is MIT licensed and its source was written for this project. This file
records anything that came from elsewhere, and anything a reader might
reasonably suspect came from elsewhere.

## Dependencies

None. There is no `package.json`, no lockfile, no bundler and no build step for
the extension itself. The three source files call the Chrome extension APIs and
the platform APIs (`OffscreenCanvas`, `createImageBitmap`, `IntersectionObserver`)
directly. What is in the repo is what is shipped.

## Tooling

`tools/render-assets.sh` shells out to the Google Chrome binary already on the
machine to rasterise `meta/*.svg` and `meta/*.html`. Chrome is not vendored,
redistributed, or modified, and none of its code is in this repo.

`scripts/provenance-check.py` was written for the `carrier-pigeon` project by
the same author and is reused here under the same MIT license. It needs `gh` and
`git`, both of which the developer supplies.

## Icons, screenshots and copy

`meta/icon.svg`, `meta/icon-small.svg`, the promo tiles and the store
screenshots were drawn for this project. `meta/sample-capture.png` is a real
Uncropped style capture of this project's own documentation page, rendered by
`tools/render-assets.sh`. No third-party website, product UI, or trademark
appears in any store asset, which is deliberate: screenshots of somebody else's
site in a store listing is a permissions question nobody needs to have.

## Names

"Uncropped" is used descriptively: the capture is not cropped to the window.
Checked on 2026-09-01, against the Chrome Web Store, a trademark search in the
software classes, and general product and package searches. Nothing came back
under that name.

The project was called Longshot until that check. The store already carries at
least four screenshot extensions using that name, one of which is also a scroll
and stitch full page capture tool, so the name was dropped before any listing
copy came to depend on it. A second candidate, Fullbleed, was dropped because
there is an active PDF engine of that name on crates.io and GitHub. Neither was
a legal problem; both were an avoidable one.

Re-run this check before each submission. The store changes.

## Prior art, and why the code is not derived from it

Scroll and stitch is the obvious approach and several extensions use it. The
implementation here was written from the API documentation. The parts most
likely to look similar to somebody else's are the ones the platform dictates:
`captureVisibleTab` in a loop, `drawImage` onto one canvas, and an offscreen
document because a service worker cannot make an object URL. Convergent output
on a constrained API is not copying. Where this code makes a choice that is
genuinely its own, it is commented at the point of the choice.

## Reviewed and cleared

**2026-09-01. Nine matches on the quota retry in `background.js`. Cleared.**

`scripts/provenance-check.py --all` returned nine repositories that contain the
same rare identifiers as our `captureVisibleTab` retry, one of them
(`extension-tools/screenshot-extension`, `code/capture/ViewportCapture.js`)
under MPL-2.0, which the gate blocks on in a permissive project.

Read side by side, they are not the same code. Theirs is a class method,
`isQuotaError`, that lowercases the message and runs a chain of `.includes()`
tests, with a linear backoff of `retryDelay * (attempt + 1)`. Ours is a
one-line regex predicate feeding a gap that is shared across the whole capture
run and moves in both directions: it widens when the browser complains and
narrows again after four clean captures. The only shared material is what the
platform dictates: the method name `captureVisibleTab`, and the token
`MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`, which is Chrome's own error string
and therefore appears verbatim in every extension that handles this error at
all. That is convergence on a constrained API, not copying, and no MPL-2.0
material is present in this repository.

The other eight matches (MIT or unlicensed) are the same line and the same
reasoning.

One change followed from the review, for its own sake rather than for
provenance: the predicate used to also match `too many` and `rate`, neither of
which occurs in Chrome's message, and `rate` risked classifying an unrelated
failure as a quota error and retrying it six times. It now matches only the two
tokens that actually appear.

Findings that turn out to be convergent output rather than copying belong here,
with the date and the reasoning.
