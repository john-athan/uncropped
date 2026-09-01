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

Nothing yet. Findings from `scripts/provenance-check.py` that turn out to be
convergent output rather than copying belong here, with the date and the
reasoning.
