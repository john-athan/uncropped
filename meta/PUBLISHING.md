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
tools/package.sh                         # zip, then check it against store limits
tools/render-assets.sh                   # icons, promo tiles, store screenshots
node scripts/check-package.mjs uncropped-1.0.0.zip
```

`package.sh` runs the checker itself, so a green run is the whole gate. The
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
Once the item exists it has an **item ID**, and updates can be automated:
`.github/workflows/publish.yml` uploads and publishes on a version tag when
four repository secrets are present. It checks for credentials first and exits
successfully without them, so it stays inert until somebody decides otherwise.

To create those secrets:

1. In a Google Cloud project, enable the **Chrome Web Store API** and create an
   **OAuth client ID** of type *Desktop app*.
2. Authorise it once against the developer account for the scope
   `https://www.googleapis.com/auth/chromewebstore`, and keep the refresh
   token.
3. Add `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` and
   `CWS_REFRESH_TOKEN` to the repository's secrets.

Google's walkthrough for that flow is at
<https://developer.chrome.com/docs/webstore/using-api>.

Then change the Install section of the README from "not on the Chrome Web
Store yet" to the store URL, and set the repository's website field to it.

## Releasing

```sh
./scripts/provenance-check.py            # while the answer can still change the release
git tag v1.0.0 && git push origin v1.0.0
```

The tag runs `provenance.yml` again against the release, and `publish.yml`,
which does nothing until the four secrets exist.
