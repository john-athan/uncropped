# Changelog

All notable changes to Uncropped. The format follows Keep a Changelog, and the
versions follow Semantic Versioning.

## [1.0.0] - unreleased

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
