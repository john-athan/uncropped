#!/usr/bin/env bash
# Render every binary asset in this repo from its source in meta/.
#
# The renderer is the browser the extension targets, which is already installed,
# already colour manages the way the store will show the result, and removes the
# need for a design tool or an image library in the dependency list.
#
#   tools/render-assets.sh            # everything
#   tools/render-assets.sh icons      # just icons/
#   tools/render-assets.sh promo      # just the store tiles
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] && [ -x "$CHROME" ] || { echo "no Chrome binary found; set CHROME=" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

shoot() { # shoot <html> <out.png> <w> <h> [--opaque]
  local html="$1"
  local out="$2"
  local w="$3"
  local h="$4"
  local bg="00000000"
  [ "${5:-}" = "--opaque" ] && bg="ffffffff"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 \
    --default-background-color="$bg" \
    --window-size="$w,$h" \
    --screenshot="$out" "file://$html" >/dev/null 2>&1
  [ -s "$out" ] || { echo "render failed: $out" >&2; exit 1; }
}

wrap() { # wrap <svg> <size> -> path to an html file that paints it at that size
  local svg="$1"
  local size="$2"
  local out
  out="$WORK/wrap-$size-$(basename "$svg" .svg).html"
  {
    printf '<meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}'
    printf 'svg{display:block;width:%spx;height:%spx}</style>' "$size" "$size"
    cat "$svg"
  } > "$out"
  echo "$out"
}

do_icons() {
  mkdir -p "$ROOT/icons"
  # Small sizes get the simplified master: at 16 px the page furniture turns to mud.
  for size in 16 32; do
    shoot "$(wrap "$ROOT/meta/icon-small.svg" "$size")" "$ROOT/icons/icon$size.png" "$size" "$size"
  done
  for size in 48 128; do
    shoot "$(wrap "$ROOT/meta/icon.svg" "$size")" "$ROOT/icons/icon$size.png" "$size" "$size"
  done
  echo "icons: $(cd "$ROOT/icons" && echo *.png)"
}

do_promo() {
  mkdir -p "$ROOT/screenshots"
  shoot "$ROOT/meta/promo-small.html"   "$ROOT/screenshots/store-promo-small.png"   440  280 --opaque
  shoot "$ROOT/meta/promo-marquee.html" "$ROOT/screenshots/store-promo-marquee.png" 1400 560 --opaque
  echo "promo: store-promo-small.png store-promo-marquee.png"
}

do_shots() {
  mkdir -p "$ROOT/screenshots"
  for n in 1 2 3; do
    [ -f "$ROOT/meta/shot-$n.html" ] || continue
    shoot "$ROOT/meta/shot-$n.html" "$ROOT/screenshots/store-$n.png" 1280 800 --opaque
  done
  echo "shots: $(cd "$ROOT/screenshots" && ls store-[0-9].png 2>/dev/null | tr '\n' ' ')"
}

case "${1:-all}" in
  icons) do_icons ;;
  promo) do_promo ;;
  shots) do_shots ;;
  all) do_icons; do_promo; do_shots ;;
  *) echo "usage: $0 [all|icons|promo|shots]" >&2; exit 2 ;;
esac
