# xoditor

A project-focused rich text editor for existing GWP HTML letters and tables. The
Darta Details page currently uses this editor; other pages keep their existing
editor. This is a local integration, with no TinyMCE runtime or subscription.

## Use

Load `dist/xoditor.min.css` and `dist/xoditor.min.js`. For standalone use, load `fonts/fonts.css` for the bundled fonts.
GWP uses its existing `css/font-face-inclulde.css` and shared `js/fonts`; deployment copies only JS/CSS assets. The existing
toolbar uses Font Awesome icons; GWP already loads Font Awesome.

```html
<textarea id="document"></textarea>
<script>
const editor = new Xoditor('#document', {
    defaultFont: 'Kalimati',
    defaultFontSize: '18px',
    height: 'auto',
    minHeight: '350px',
    autoSave: false,
    onChange(html, editor) {
        // Host application can update its preview here.
    }
});
</script>
```

When loading source files instead of `dist`, load `src/xoditor.js` followed
by `src/xoditor-enhancements.js`, and both matching CSS files.

## Supported behavior

- Bold, italic, underline, strike, subscript, superscript, text/background colors.
- Font family and pixel sizes, paragraph styles, alignment, lists, indentation,
  line spacing, horizontal rules and explicit page breaks.
- Nepali text and local Kalimati, Kokila, Preeti, Sagarmatha, Kantipur and Fontasy
  Himali fonts. The browser handles input methods; composition is not rewritten.
- Toolbar selection preservation; repeated font changes reuse selected spans.
- Word HTML paste cleanup: Office classes/namespaces are removed while standard
  fonts, colors and tables are retained. Word numbered/bulleted paragraphs with
  `mso-list` metadata become HTML lists, including tested nested levels and
  Nepali numeric markers.
- Word clipboard images are embedded or uploaded when the clipboard supplies
  raster image files. Unavailable local Word images produce a message.
- Table creation within the current paragraph's layout container; row/column
  insertion/removal, header toggle, rectangular cell selection with Shift-click,
  merge/split, vertical alignment, all/no/outside/inside/individual borders with
  color, style and width controls.
- Drag internal column borders to resize adjacent columns. Drag the right outer
  edge to resize the whole table. These drag operations require unmerged cells.
- Image URL insertion, file upload and clipboard images. Drag the right or bottom
  edge to change width or height independently, or the bottom-right corner to
  resize proportionally.
- HTML download and a special-character picker, including Nepali punctuation.
- Undo/redo snapshots, text-only find/replace with literal search, HTML source,
  printing, fullscreen, zoom, word counts and browser spellcheck.
- Read-only mode, independent editor instances and removable event listeners.
- A4/Letter/Legal page-size controls, portrait/landscape orientation and millimeter
  margins. Settings are retained in exported `@page` CSS and undo/redo history.
- Template IDs/styles round-trip. Template CSS is scoped for visual editing and
  retained in exported HTML, so body-level template rules do not affect the host
  page. Executable tags/event handlers and unsupported URL schemes are filtered.

## API

HTML source mode now uses local CodeMirror with line numbers, HTML/CSS/JavaScript
syntax colors, matching opening/closing tags, automatic closing tags/brackets,
fold gutters, fold/unfold controls, source Find/Replace, Go to line and cursor position. `Format HTML` uses local Prettier and is
undoable. Formatting uses four spaces and multiline inline CSS, preserves quoted
attribute values and raw-text elements, and rejects invalid HTML without changing
the source. Semicolons in entity-quoted CSS strings are not declaration separators.
Shortcuts: Ctrl/Cmd+Alt+F formats; Ctrl+Q folds the current block.
Use `setSourceContent(html)` when updating source programmatically.
The built `dist/xoditor.min.js` includes CodeMirror and Prettier, and
`dist/xoditor.min.css` includes CodeMirror styles. No separate code-tool
imports are needed for built usage. The source demo loads the local vendor files
explicitly. Dependencies are pinned and their licenses accompany the build.

```js
editor.getContent();
editor.setContent(html);
editor.setReadOnly(true);
editor.destroy();
```

Enable `stickyToolbar: true` to keep the toolbar visible while scrolling within
the editor's page area. Set `stickyToolbarOffset` in pixels when the page has a
fixed header. The View tab's Sticky toolbar button toggles this behavior, and
`editor.setStickyToolbar(true)` enables it programmatically.

Textareas receive updated HTML and are restored when the editor is destroyed.
`gwp_front/js/xoditor.js` preserves the `.value`, `getEditorValue()`,
`setEditorValue()`, `.editor`, `setReadOnly()` and `destroy()` interface used by
Darta's existing scripts and dynamically opened official-details modal.

Optional `uploadImage(file)` must return a Promise resolving to an image URL.
Without it, raster images are embedded as data URLs. The default image limit is
10 MB and can be changed with `maxImageBytes`. This hook does not change the
separate Darta form's fingerprint/MinIO upload implementation.

Autosave, when enabled, uses a key based on the page URL and textarea ID. Supply
`autosaveKey` for a document-specific key. GWP's adapter disables local autosave.

## Build and test

```sh
npm install
npm run build
npx playwright install chromium
npm test
npm run deploy:gwp
npx playwright install firefox
npm run verify
```

`deploy:gwp` rebuilds and copies distributable JS/CSS files into the GWP frontend.
`verify` rebuilds/deploys, checks package syntax and deployed asset hashes, and
runs Chromium/Firefox against source and minified JS/CSS. `test:all` runs just
the browser matrix; `test:dist` runs the built variant in both browsers.
`TEST_BROWSERS=chromium npm run test:all` limits engines when Firefox is unavailable.
Results are written to `test-results/verification.json`.

Browser tests cover template/image round-tripping, executable HTML filtering,
repeated font sizes, actual typing/toolbar clicks, Word lists/tables/images,
table containment and resizing, merge/split, image resizing, undo/redo, source
editing, find/replace, independent instances and the modal adapter lifecycle.

## Limits

This is not a complete Microsoft Word implementation. Word pagination, floating
objects, equations, complex multilevel lists and embedded images absent from the
browser clipboard are not guaranteed to transfer exactly. Test representative
letters and their printed output before extending the rollout beyond Darta.

Row/column edits, merging/splitting and border ranges use a logical cell grid
for tested rowspan/colspan layouts. Resizing a table with merged cells remains
disabled. Invalid/ragged imported tables need manual review. Browser spellcheck
is not a Nepali proofreading service.
Track changes, concurrent collaboration and a DOCX/PDF import engine are not
implemented. PDF output continues to use the project's existing workflow.

The current formatting commands rely partly on the browser's legacy
`execCommand` implementation. Chromium and Firefox regression checks passed;
Safari/WebKit and the authenticated backend save/print workflow still need
integration tests. See `VERIFICATION.md` for the tested scenarios and limits.
