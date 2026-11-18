# Application integration

Load `dist/xoditor.min.css` and `dist/xoditor.min.js`, then create the editor
only after its host element has mounted:

```js
const editor = new Xoditor('#document', {
    height: '500px',
    autoSave: false,
    defaultFont: 'Arial',
    onChange(html, instance) {
        // Schedule your application's save operation here.
    }
});
editor.setContent('<p>Initial document</p>');
const html = editor.getContent();
editor.setReadOnly(true);
// On component unmount:
editor.destroy();
```

React, Vue and other component frameworks can use the same lifecycle. This
project does not currently provide dedicated framework wrapper packages.
Never construct a new editor on every component render.

## Saving and loading

The host owns persistence, authentication, authorization, upload storage and
conflict resolution. Disable local autosave when the host manages saves.
Treat HTML as user input and sanitize it on the server with an application-specific
policy. Use sandboxed previews for documents containing untrusted CSS.

## Fonts and paste

Deploy the bundled fonts and `fonts/fonts.css` if using those font families.
Word paste supports clipboard HTML, Office-list cleanup and clipboard images.
Page-perfect DOCX import is not supported. Review complex merged tables, floating
images, footnotes and page-specific layout after pasting. Browser printing and
server-side PDF generation are separate responsibilities.

## Compatibility and editing engine

Browser results are recorded by `npm run test:all`. A configured engine is not
considered verified until its complete run passes. IME and Nepali editing scenarios
are included. Several formatting commands still use `document.execCommand`.
Replacing that engine requires a separate document-model and transaction design;
it has not been replaced by this update.
