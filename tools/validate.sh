#!/bin/sh
# Every check this extension has, in one script.
#
# This used to live inside .github/workflows/ci.yml as six inline steps, which
# meant none of it could be run before a push. It is the same six checks, in the
# same order, and they now run wherever you are: directly, through
# `oss check uncropped`, or from CI, which calls this file and nothing else.
set -eu
cd "$(dirname "$0")/.."

fail=0
step() { printf '\n== %s\n' "$1"; }
fail_if() { if [ "$1" -ne 0 ]; then fail=1; fi; }

step "manifest.json is well-formed and consistent"
node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const fail = (msg) => { console.error("FAIL: " + msg); process.exitCode = 1; };
  if (m.manifest_version !== 3) fail("not manifest v3");
  if (m.description.length > 132) fail("description is " + m.description.length + " chars, the store caps it at 132");
  for (const f of [m.background.service_worker, m.options_ui.page, ...Object.values(m.icons)]) {
    if (!fs.existsSync(f)) fail("manifest points at a missing file: " + f);
  }
  for (const f of ["content.js", "offscreen.html", "offscreen.js", "options.js"]) {
    if (!fs.existsSync(f)) fail("missing source file: " + f);
  }
  if (m.host_permissions) fail("host_permissions crept back in");
  console.log("manifest ok, version " + m.version);
' || fail_if $?

step "JavaScript parses"
for f in background.js content.js offscreen.js options.js docs/site.js; do
  node --check "$f" && echo "ok $f" || fail_if $?
done

step "Inline SVG is well-formed"
python3 - <<'PY' || fail=1
import re, sys, glob, xml.etree.ElementTree as ET
bad = 0
for path in glob.glob('docs/*.html') + glob.glob('meta/*.html') + glob.glob('meta/*.svg'):
    src = open(path, encoding='utf-8').read()
    for i, svg in enumerate(re.findall(r'<svg\b.*?</svg>', src, re.S)):
        try:
            ET.fromstring(svg)
        except Exception as e:
            bad += 1
            print(f'FAIL {path} svg#{i+1}: {e}')
print('broken SVG blocks:', bad)
sys.exit(1 if bad else 0)
PY

step "The extension carries no dependencies"
if ls package.json package-lock.json yarn.lock node_modules 2>/dev/null | grep -q .; then
  echo "FAIL: a dependency appeared in a project that is supposed to have none"
  fail=1
else
  echo "ok, still no dependencies"
fi

step "Store artwork is the size and shape the console demands"
python3 - <<'PY' || fail=1
import struct, sys, zlib
def png(path):
    d = open(path, 'rb').read()
    w, h = struct.unpack('>II', d[16:24])
    return w, h, d[24], d[25]
fail = []
for path, want in [
    ('screenshots/store-icon.png', (128, 128)),
    ('screenshots/store-1.png', (1280, 800)),
    ('screenshots/store-2.png', (1280, 800)),
    ('screenshots/store-3.png', (1280, 800)),
    ('screenshots/store-promo-small.png', (440, 280)),
    ('screenshots/store-promo-marquee.png', (1400, 560)),
    ('icons/icon128.png', (128, 128)),
]:
    w, h, depth, ctype = png(path)
    if (w, h) != want:
        fail.append(f'{path} is {w}x{h}, the store wants {want[0]}x{want[1]}')
    print(f'ok {path} {w}x{h}')
# The store icon carries 96px of artwork inside a 128px frame. The console
# rounds and shadows the outer margin, so a full bleed icon dropped in here gets
# clipped. Corners transparent, middle not.
d = open('screenshots/store-icon.png', 'rb').read()
idat = b''
off = 8
while off < len(d):
    ln = struct.unpack('>I', d[off:off+4])[0]
    if d[off+4:off+8] == b'IDAT': idat += d[off+8:off+8+ln]
    off += 12 + ln
raw = zlib.decompress(idat)
stride = 128 * 4
if len(raw) != (stride + 1) * 128:
    print('unexpected store-icon encoding, skipping the margin check')
else:
    rows = [bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)]) for y in range(128)]
    prev = bytearray(stride)
    for y, line in enumerate(rows):
        f = raw[y*(stride+1)]
        for x in range(stride):
            a = line[x-4] if x >= 4 else 0
            b = prev[x]
            c = prev[x-4] if x >= 4 else 0
            v = line[x]
            if f == 1: v += a
            elif f == 2: v += b
            elif f == 3: v += (a + b) // 2
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                v += a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            line[x] = v & 255
        prev = line
    alpha = lambda x, y: rows[y][x*4+3]
    for x, y in [(2, 2), (125, 2), (2, 125), (125, 125), (8, 64), (119, 64)]:
        if alpha(x, y) > 8:
            fail.append(f'store-icon.png has artwork at ({x},{y}); the outer 16px must stay transparent')
    if alpha(64, 64) < 200:
        fail.append('store-icon.png is transparent in the middle')
    if not fail:
        print('ok store-icon.png keeps its 16px transparent margin')
if fail:
    print('\nFAIL:\n  ' + '\n  '.join(fail)); sys.exit(1)
PY

step "Every permission has a justification written for the console"
node -e '
  const fs = require("fs");
  const declared = JSON.parse(fs.readFileSync("manifest.json", "utf8")).permissions || [];
  const listing = fs.readFileSync("meta/store-listing.md", "utf8");
  // Bounded to the next heading, or a stray bold word anywhere later in the
  // file (Assets, the publishing checklist) would read as a permission.
  const section = (listing.split("## Permission justifications")[1] || "").split(/\n## /)[0];
  const written = [...section.matchAll(/^\*\*([a-zA-Z]+)\*\*$/gm)].map((m) => m[1]);
  const fail = (msg) => { console.error("FAIL: " + msg); process.exitCode = 1; };
  for (const p of declared) {
    if (!written.includes(p)) fail(`manifest declares ${p}, store-listing.md does not justify it`);
  }
  for (const w of written) {
    if (w !== "Remote" && !declared.includes(w)) {
      fail(`store-listing.md justifies ${w}, which the manifest does not declare`);
    }
  }
  console.log("justified: " + declared.join(", "));
' || fail_if $?

step "The version is the same number everywhere"
node -e '
  const fs = require("fs");
  const version = JSON.parse(fs.readFileSync("manifest.json", "utf8")).version;
  const fail = (msg) => { console.error("FAIL: " + msg); process.exitCode = 1; };
  const inPage = fs.readFileSync("content.js", "utf8").match(/VERSION\s*=\s*.([^\x27"]+)./);
  if (!inPage) fail("content.js no longer declares a VERSION");
  else if (inPage[1] !== version) fail(`content.js says ${inPage[1]}, manifest says ${version}`);
  if (!fs.readFileSync("CHANGELOG.md", "utf8").includes(`## [${version}]`)) {
    fail(`CHANGELOG.md has no entry for ${version}`);
  }
  console.log("version " + version + " agrees everywhere");
' || fail_if $?

step "Package the store upload, and check it against the store"
tools/package.sh || fail=1

if [ "$fail" -ne 0 ]; then
  printf '\nvalidate: FAILED\n'
  exit 1
fi
printf '\nvalidate: everything passes\n'
