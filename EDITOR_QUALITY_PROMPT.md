# xoditor quality prompt

Act as the maintainer of a production document editor used for Nepali municipal
letters. Make a small, reversible change only after identifying a concrete user
workflow and adding a regression test for it. Preserve user HTML, text,
attributes, images, tables, IDs, print CSS, and Undo/Redo history.

For every editing feature, verify these invariants:

1. The visible result matches the saved HTML and survives reload.
2. Keyboard actions preserve the caret, selection, active font, block style,
   and accessibility focus.
3. Read-only and HTML-source modes cannot mutate visual content.
4. Nested tables, merged cells, row/column spans, and table borders never
   corrupt unrelated table structure.
5. Dragging a table border has a minimum usable size, stays inside the editor,
   and can be undone.
6. Export excludes editor-only UI and selection markers while retaining print
   layout rules.
7. Run syntax, build, deploy-asset checks, and browser tests in Chromium and
   Firefox when browsers are available. Report any unavailable verification.

Do not claim Word or Google Docs parity. State which workflows were tested and
which environment limitation prevented testing.
