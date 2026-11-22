# Publishing to the Chrome Web Store

Everything that can be prepared ahead of time is in this repository. What is
left needs a Google account, and cannot be done for you. The listing copy and
the exact answers for every dashboard field live in
[store-listing.md](store-listing.md); this file is the order to do things in.

## What you need once, before the first submission

1. **A Chrome Web Store developer account.** Register at
   <https://chrome.google.com/webstore/devconsole>. There is a one time
   USD 5 fee, paid by the Google account that will own the listing.
2. **A verified publisher contact email**, which the store shows on the
   listing. The console prompts for this on first use and blocks publishing
   until the address is verified by email.
3. **A hosted privacy policy URL.** Already live at
   <https://john-athan.github.io/uncropped/privacy-policy.html>, deployed from
   `docs/` by `.github/workflows/pages.yml`.

## Building the upload

```sh
node tools/webext.mjs package              # zip, then check it against store limits
tools/render-assets.sh                   # icons, promo tiles, store screenshots
node tools/webext.mjs check uncropped-1.0.0.zip
```

`webext.mjs package` runs the checker itself, so a green run is the whole gate. The
checker refuses a package whose manifest exceeds a store field limit, names a
file it did not pack, carries anything but the extension, drifts out of sync
with the version string in `content.js`, or contains an `eval`, a network call
or an HTML injection that the listing says it does not. A rejection costs a
review cycle, which is days rather than minutes.

Re-render the assets before the artwork whenever the options page or the
capture output changes. Two of the three screenshots photograph the
extension's own behaviour, and a listing that shows an older output is worse
than no listing.

## Trying the exact upload before uploading it

The zip is what a reviewer installs, so install it the same way. Unzip it into
a scratch folder, load *that* folder unpacked from `chrome://extensions`, and
capture all three shapes in `tests/pages/`:

```sh
rm -rf /tmp/uncropped-check && mkdir -p /tmp/uncropped-check
unzip -q uncropped-1.0.0.zip -d /tmp/uncropped-check
open tests/pages/index.html
```

| Page | What a correct capture looks like |
|---|---|
| `article.html` | Tall image, sticky header once at the top, no blank image boxes |
| `app-shell.html` | Tall image of the panel only, sidebar not repeated down the side |
| `wide-table.html` | One wide tall image, `row.column` labels continuous across seams |

The second is the case the built in DevTools capture gets wrong, and the one
worth re-running after any change to the scroller search.

## Filling in the listing

Copy and answers: [store-listing.md](store-listing.md). Artwork:

| Field in the console | File | Size |
|---|---|---|
| Store icon | `screenshots/store-icon.png` | 128 x 128, 96 px of artwork, 16 px transparent margin |
| Screenshots, up to 5 | `screenshots/store-1.png`, `store-2.png`, `store-3.png` | 1280 x 800 |
| Small promo tile | `screenshots/store-promo-small.png` | 440 x 280 |
| Marquee promo tile | `screenshots/store-promo-marquee.png` | 1400 x 560 |

Category **Developer Tools**, language **English**.

Do not put `icons/icon128.png` in the store icon field. It is the toolbar icon
and fills its frame; the console rounds and shadows the outer 16 px of a store
icon, which would clip the artwork. `tools/render-assets.sh store-icon` renders
the padded one, and CI fails if that margin goes away.

**The artwork does not ship with a release.** The store API uploads the
package only. A new `screenshots/store-icon.png`, screenshot or promo tile has
to be uploaded again by hand in the dashboard, on the Store listing tab, and the
item submitted for review. `oss publish` names the files that changed since the
version the store held.

## The privacy practices tab

The console will not let you publish until every field here is filled in. The
answers in `store-listing.md` are what the code actually does. Do not soften
them: a justification that overstates or understates the access is the usual
reason a review stalls, and every claim there is checkable against the source
in one grep.

Tick **none** of the data type checkboxes. Then certify all three statements,
and then tick the separate certification at the foot of the tab confirming
compliance with the Developer Program Policies. That last box sits below the
three and is easy to miss, and the console blocks publishing without it.

For remote code, select **"No, I am not using remote code."**

## After the first publish

Reviews usually take a few days for a first submission and are faster after.
Once the item exists it has an **item ID**, and updates are uploaded from this
machine: `oss release` cuts the version, and `oss publish uncropped` uploads it to
the store with the credentials in the keychain (item `cws-kaleve`, set up once
for every extension, see oss-kit's `docs/chrome-web-store.md`). Nothing about
the store lives in a GitHub secret or a workflow.

Then change the Install section of the README from "not on the Chrome Web
Store yet" to the store URL, and set the repository's website field to it.

## Releasing

```sh
oss release uncropped --patch     # checks, provenance gate, version, tag, GitHub release
oss publish uncropped             # the tagged version to the Chrome Web Store
```

`oss release` runs the provenance gate before it tags, while a match can still
change what ships; the weekly fleet sweep catches anything that slipped past.
