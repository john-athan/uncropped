#!/usr/bin/env bash
# Build the Chrome Web Store upload. Ships the extension and nothing else:
# no docs, no meta sources, no screenshots, no tooling.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./manifest.json').version")"
OUT="uncropped-$VERSION.zip"

rm -f uncropped-*.zip
zip -rq "$OUT" \
  manifest.json \
  background.js content.js offscreen.html offscreen.js options.html options.js \
  icons \
  LICENSE \
  -x '*.DS_Store'

unzip -l "$OUT"
printf '\nsize: %s\n\n' "$(du -h "$OUT" | cut -f1)"

# A rejection costs a review cycle, so the limits are checked here rather than
# discovered in the upload form.
node scripts/check-package.mjs "$OUT"
printf '\n%s\n' "$OUT"
