# Chrome Web Store: listing copy and submission answers

Everything the dashboard asks for, written out, so that submission is a paste
job rather than a writing job. The order to do things in, and everything that
is not a dashboard field, is in [PUBLISHING.md](PUBLISHING.md). Fill the
checklist at the bottom before you press publish.

---

## Item name

    Uncropped

## Short description (132 characters max, this is 125)

    Screenshots the whole page. Below the fold, off to the right, and inside the scrolling div your browser calls the whole page.

## Category

    Developer Tools

## Language

    English

---

## Detailed description

Chrome already has a button called "Capture full size screenshot". It lives in
the DevTools command menu, and on a plain document it works.

Then you point it at an app: a dashboard, an inbox, an admin panel, anything
built in the last decade. The page has a header that stays put and a panel that
scrolls. You press the button and you get the viewport. Not because the button
is broken, but because on that page the document really is one screen tall. A
container is doing the scrolling, and the browser has no reason to think that
container is the page.

Uncropped has a reason to think so.

WHAT IT DOES

• Captures the entire scrollable area as one image, vertically and horizontally
• Finds the real scroll container when the document itself does not scroll, which
  is the case that every other approach quietly gets wrong
• Warms the page up first, so lazy loaded images below the fold are in the shot
  instead of being blank rectangles
• Hides fixed headers and toolbars after the first tile, so a sticky navbar is
  not stamped down the length of the image
• Captures at your screen's real pixel density, so a Retina page comes out at
  Retina resolution
• Scales the output down and tells you the factor when a page is larger than a
  canvas can hold, rather than failing at the last step
• PNG or JPEG, straight into Downloads, or ask each time

HOW TO USE IT

Click the toolbar icon, or press Cmd+Shift+Y on a Mac, Ctrl+Shift+Y elsewhere.
Watch the badge count up. The file lands in Downloads/Uncropped.

WHAT IT DOES NOT DO

It makes no network requests, because it has nowhere to send anything. It has no
analytics, no account, no remote configuration and no bundled libraries. It asks
for no host permissions, which means it cannot touch a page you have not clicked
it on. The source is the shipped file, and it is on GitHub under MIT.

Chrome does not allow any extension to read chrome:// pages, the Web Store, or
other extensions' pages, so Uncropped cannot photograph those either. A cross
origin iframe is captured exactly as it appears on screen and is not expanded,
which is the same limit DevTools has.

---

## Single purpose statement

Uncropped captures a full page screenshot of the tab the user is looking at, when
the user asks for one. That is its only function. It has no secondary behaviour,
no content injection outside a capture run, and no background activity when the
user is not capturing.

---

## Permission justifications

Paste each of these into the matching field in the dashboard.

**activeTab**
The extension needs to read and scroll the page the user is currently looking at
in order to photograph it. activeTab grants that access only for the tab the
user clicked on, only after the click, and only until that tab navigates. It is
requested specifically so that the extension does not need broad host
permissions.

**scripting**
The capture logic is injected into the page at the moment the user clicks,
rather than being declared as a content script that would run on every page the
user loads. The injected script measures the scroll container, scrolls it, and
restores it. Nothing runs until the user asks for a screenshot.

**downloads**
The finished image is written to the user's Downloads folder. The extension only
creates downloads and never reads, searches, or modifies existing ones.

**offscreen**
The stitching canvas lives in an offscreen document. A Manifest V3 service
worker provides OffscreenCanvas but not URL.createObjectURL, and the downloads
API requires a URL, so the finished image cannot be produced in the worker
itself. The offscreen document loads no page content and makes no requests.

**Host permissions**
None are requested.

**Remote code**
None. The extension bundles no libraries and loads no script, style, or font
from any network location. Everything executed is in the package.

---

## Data usage disclosures

Answer "No" to every collection category, and tick all three certifications.

| Question | Answer |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No. Page pixels are rendered to a local file and never transmitted |

Certifications: the data is not sold to third parties, is not used or transferred
for a purpose unrelated to the item's single purpose, and is not used or
transferred to determine creditworthiness or for lending purposes.

Privacy policy URL: https://john-athan.github.io/uncropped/privacy-policy.html

---

## Assets

All generated by `tools/render-assets.sh`.

| Asset | Size | File |
|---|---|---|
| Store icon | 128 x 128 | `icons/icon128.png` |
| Screenshot 1 | 1280 x 800 | `screenshots/store-1.png` |
| Screenshot 2 | 1280 x 800 | `screenshots/store-2.png` |
| Screenshot 3 | 1280 x 800 | `screenshots/store-3.png` |
| Small promo tile | 440 x 280 | `screenshots/store-promo-small.png` |
| Marquee promo tile | 1400 x 560 | `screenshots/store-promo-marquee.png` |

---

## Before publishing

Done, and re-checkable:

- [x] Search the Chrome Web Store for "Uncropped" and confirm the name is free
      in this category. Done 2026-09-01, clear, recorded in THIRD_PARTY.md.
- [x] Check the same name against a trademark register. Done 2026-09-01, no
      record found in the software classes. Re-check before submitting, and
      re-check the store listing search too, because both change.
- [x] Publish `docs/` to GitHub Pages so the privacy policy URL resolves. Live
      since 2026-09-01, verified HTTP 200 again on 2026-09-02:
      https://john-athan.github.io/uncropped/privacy-policy.html
- [x] Build the package: `tools/package.sh`. Produces a 20 KB, 13 file zip and
      validates it with `scripts/check-package.mjs`.
- [x] Run the provenance gate. Done 2026-09-01 over the whole tree, nine
      matches reviewed and cleared in THIRD_PARTY.md.
- [x] Artwork present at the sizes the console demands: 128 icon, three
      1280 x 800 screenshots, 440 x 280 and 1400 x 560 promo tiles.

- [x] Developer account registered and the one time fee paid. Confirmed
      2026-09-02: Carrier Pigeon is live on the store under this account, which
      the console does not allow without a paid registration and a verified
      publisher contact email.
- [x] Capture all three shapes in `tests/pages/` with the packaged build. Done
      2026-09-02 against the contents of `uncropped-1.0.0.zip`, loaded unpacked
      into a clean profile, driven by the real Cmd+Shift+Y command so that
      activeTab was granted the way it is for a user. Results:

      | Page | Output | Checked |
      |---|---|---|
      | `article.html` | 1648 x 16384, 17 tiles, scaled to 65% | Sticky header once at the top, sections 01, 02, 03 in order, lazy image boxes filled |
      | `app-shell.html` | 2036 x 8422, 6 tiles, scroller `div.panel` | Panel only, no sidebar down the side |
      | `wide-table.html` | 2654 x 3996, 6 tiles | Rows 19 to 28 and columns 14 to 20 continuous across both seams |

      The article page is tall enough to hit the 16384 px side limit, so that
      run also exercised the downscale path and reported the factor.
- [x] Store screenshots still match the shipped build. The options page and the
      capture output did not change, so `tools/render-assets.sh` output stands.

Needs a person, because it needs a logged in Google account:

- [ ] Create the item in the console and upload `uncropped-1.0.0.zip`.
- [ ] Paste the fields above into the listing and the privacy practices tab.
- [ ] Submit for review.
- [ ] After the item exists, put the store URL in the README's Install section
      and in the repository's website field, and set up the four secrets so
      the next version publishes from a tag.
