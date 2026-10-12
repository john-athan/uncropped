#!/bin/sh
# Every check this extension has. Run it directly, through `oss check
# uncropped`, or from CI, which calls this file and nothing else.
#
# The checks every extension in the fleet shares live in tools/webext.mjs,
# which oss-kit owns; what is particular to this one is in webext.json and
# below.
set -eu
cd "$(dirname "$0")/.."

fail=0
node tools/webext.mjs validate || fail=1

printf '\n== The arithmetic that decides what the picture looks like\n'
node test.js || fail=1

if [ "$fail" -ne 0 ]; then printf '\nvalidate: FAILED\n'; exit 1; fi
printf '\nvalidate: everything passes\n'
