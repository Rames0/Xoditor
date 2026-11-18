# Office clipboard benchmark

Run `npm run build`, then `npm run test:office-benchmark` with a
Playwright Chromium browser installed. To compare a local Jodit browser bundle,
set `JODIT_BUNDLE=/path/to/jodit.min.js` before running the same command.
The report at `test-results/office-benchmark.json` records editor versions,
bundle hashes, browser version and individual check results.

Both editors receive the same synthetic HTML and plain-text clipboard payload
through a paste event. The benchmark inspects each editor's exported HTML.
The first fixture covers Nepali text, nested numbering, merged cells,
semantic headers, an explicit font, a link and Office markup cleanup.
The reported font check verifies exported markup, rather than rendered glyphs.

In Chromium 157, Xoditor 1.0.0 passed all eight checks. The tested Jodit 4.7.9
bundle passed six. Nested numbering and Office markup cleanup differed.
These results describe a single fixture and configuration. Native Word
clipboard formats, images, visual layout fidelity and other editor builds
need separate measurements.
