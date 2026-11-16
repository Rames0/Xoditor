# Master implementation and verification prompt

Act as the maintainer of Xoditor and its GWP Darta integration. Improve this
existing editor toward familiar Microsoft Word authoring behavior, using the
actual source and observable browser results as evidence. Execute the work; do
not stop after suggesting changes or writing a plan.

## Product constraints

1. Preserve existing saved letter HTML, Nepali text, template IDs, font families,
   header/footer styles, nested containers, image URLs and printable output.
2. Use the existing Xoditor and maintain its public API. Keep the GWP
   `.value`, `getEditorValue`, `setEditorValue`, `.editor`, read-only and destroy
   adapter working. Limit the application rollout to dartaDetails.html.
3. Prioritize Word copy/paste, including font/color/spacing, ordinary and nested
   lists, tables, merged cells and raster images supplied by the clipboard.
   Preserve meaningful formatting while removing Office-specific markup.
4. Keep controls understandable: selections survive toolbar clicks; font changes
   target selected text without multiplying wrappers or duplicating IDs; typing
   with an IME is not interrupted. Support undo/redo for editing operations.
5. Tables must remain inside their intended layout container. Support row/column
   edits, header cells, merge/split, borders, alignment, adjacent column resizing
   and whole-table resizing. Use logical cell positions when spans are involved;
   disable or explain operations that cannot be performed safely.
6. Support safe image insertion/upload, proportional resizing, source mode,
   find/replace, printing, fullscreen, zoom, word counts, read-only mode and
   isolated autosave. Async uploads/paste must preserve their insertion location.
7. Provide document layout controls for page size/orientation and margins, with
   predictable printable HTML. Distinguish page layout controls from automatic
   pagination, and do not claim a Word-compatible pagination engine.
8. Changes must remain local/offline-capable and use only appropriately licensed
   dependencies. Do not replace this editor with a paid engine silently.

## Workflow

- Inspect package scripts, implementation, tests, adapter and integration first.
- List concrete defects/gaps in a verification report. Implement the highest
  impact fixes and update the report with actual outcomes.
- Add regression tests that exercise user behavior and invariants, not merely
  copies of implementation logic. Include source and built-asset checks.
- Run tests in Chromium and Firefox when available. Record unavailable engines,
  skipped scenarios and failures honestly. Capture unexpected console errors.
- Exercise typing, selection, repeated formatting, IME composition, Word-style
  paste, asynchronous images, tables with spans, resizing, source/history,
  literal/Unicode find-replace, read-only, multiple instances, template style
  isolation and repeated modal create/destroy.
- Include package build/deployment checks and verify deployed assets match dist.
  Preserve unrelated user changes and avoid changing backend data during tests.
- Rebuild the distributable JS/CSS/fonts and deploy to the one trial page only.
- Document behavior, test commands, supported browser results and known limits.

## Acceptance criteria

The implemented scenarios pass their regression checks without unexpected
browser exceptions. HTML save/load preserves tested data and does not persist
editor-only selection markers. The built assets pass the same relevant checks.
No claims of universal perfection, zero possible defects, complete Word parity,
real DOCX fidelity, live collaboration, or production readiness without evidence.
Explicitly report any unmet product requirement or untested integration path.

## Deliverables

Working source and distributable assets, one-page GWP integration, repeatable
package test/build commands, browser regression tests, and a verification report
mapping changes to test evidence and remaining limitations.
