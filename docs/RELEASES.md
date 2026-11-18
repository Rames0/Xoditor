# Release checklist

1. Update `package.json` and `package-lock.json` versions together.
2. Run `npm ci` and install the Playwright browsers.
3. Run `npm run verify` and explicitly run the full Chromium/Firefox/WebKit matrix.
4. Check desktop, touch-sized layouts, keyboard navigation and screen-reader labels.
5. Review saved Word-paste fixtures, Nepali input, source round trips and undo/redo.
6. Review dependency licenses and the published files using `npm pack --dry-run`.
7. Inspect the CI report before tagging a release; never label a skipped browser as passed.
8. Tag the version and record fixes and breaking changes in release notes.

The current `/dist/` website links follow the latest deployment. Consumers needing
reproducible production builds should self-host assets from a specific commit or
release. Published immutable version URLs are not implemented yet.
