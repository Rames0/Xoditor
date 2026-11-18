# Bilingual paste fixtures

- `playground-bilingual.docx` is a synthetic Word document with Unicode Nepali,
  English, Kalimati and Arial runs, two list levels, horizontally and vertically
  merged table cells, and an embedded PNG with alt text.
- `playground-bilingual.html` is the equivalent synthetic HTML fixture used by
  Playwright via the real browser clipboard and Ctrl+V.

Native Microsoft Word paste is **Not tested**. No actual Word clipboard capture
was available. The HTML fixture does not represent a capture from Word.

For a native test, open the DOCX in desktop Word and copy the full document.
Paste into the running Xoditor playground over its selected sample, and repeat
in an empty editor. Verify the exact bilingual sentence, font runs, ordered
list and nested bullet, merged cells, and image. Download the HTML and verify
the same content and valid sibling blocks. Record the Word version, OS, browser
and version, and the results for editor and download separately.
