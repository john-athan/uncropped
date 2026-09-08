# Changelog

All notable changes to Uncropped. The format follows Keep a Changelog, and the
versions follow Semantic Versioning.

## [Unreleased]

### Changed
- CI's six checks moved out of the workflow file and into `tools/validate.sh`,
  runnable directly, through `oss check uncropped`, or from CI.
- The provenance gate moved to oss-kit, one shared copy that runs before a
  release is tagged instead of a script duplicated in this repo.
- `meta/store-listing.md` now justifies `storage`, the permission the listing
  had missed, and drops the "Host permissions: none" line the console never
  shows for an item that requests none.

## [1.0.0] - 2026-09-02

First release.

### Added
- Whole page capture by scroll and stitch, on both axes.
- Detection of the real scroll container when the document does not scroll,
  including inside open shadow roots.
- Warm up pass so lazy images and virtualised rows exist before measuring.
- Fixed and sticky bars hidden after the first tile, with backdrops and tall
  sticky columns left alone.
- Adaptive capture interval that backs off when Chrome rate limits and speeds
  back up when it stops.
- Area ceiling: output over the limit scales down and reports the factor,
  instead of failing at the last step.
- Options page: format, JPEG quality, warm up pass, hide fixed bars, settle
  budget, size ceiling, ask where to save.
- Keyboard shortcut, Cmd or Ctrl + Shift + Y.
- Minimum Chrome version 116, which is where `chrome.offscreen.hasDocument`
  arrives and therefore the oldest browser this can run on.

[1.0.0]: https://github.com/john-athan/uncropped/releases/tag/v1.0.0
