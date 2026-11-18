import '../dist/xoditor.min.js';
import {Extensions} from './modules/extensions.mjs';

const BrowserEditor = globalThis.window?.Xoditor;
if (!BrowserEditor) throw new Error('Xoditor must be loaded in a browser');

export class Xoditor extends BrowserEditor {
    #extensions;

    constructor(element, options = {}) {
        const {plugins = [], onChange, ...legacyOptions} = options;
        const extensions = new Extensions();
        super(element, {
            ...legacyOptions,
            onChange: (html, editor) => {
                onChange?.(html, editor);
                extensions.emit('change', {html, editor});
            }
        });
        this.#extensions = extensions;
        try {
            for (const plugin of plugins) this.#extensions.addCleanup(plugin(this));
        } catch (error) {
            try {
                this.destroy();
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Xoditor plugin setup failed');
            }
            throw error;
        }
    }

    on(event, listener) {
        return this.#extensions.on(event, listener);
    }

    registerCommand(name, handler) {
        return this.#extensions.register(name, handler);
    }

    execute(name, value) {
        if (this.destroyed || this.readOnly) return;
        const handler = this.#extensions.getCommand(name);
        return handler ? handler(this, value) : this.execCommand(name, value);
    }

    getHTML() { return this.getContent(); }
    setHTML(html) { this.setContent(html); }
    getText() {
        const doc = new DOMParser().parseFromString(this.getContent(), 'text/html');
        doc.querySelectorAll('style,script,template').forEach(node => node.remove());
        return doc.body.textContent;
    }
    clear() { this.setContent(''); }
    focus() {
        if (this.destroyed) return;
        if (this.htmlMode && this.codeMirror) this.codeMirror.focus();
        else this.restoreSelection();
    }
    undo() { return this.execCommand('undo'); }
    redo() { return this.execCommand('redo'); }

    destroy() {
        if (this.destroyed) return;
        try {
            this.#extensions.destroy();
        } finally {
            super.destroy();
        }
    }
}

export default Xoditor;
