export class Extensions {
    #commands = new Map();
    #listeners = new Map();
    #cleanups = [];
    #destroyed = false;

    on(event, listener) {
        if (this.#destroyed || typeof listener !== 'function') throw new TypeError('An active editor and a listener are required');
        const listeners = this.#listeners.get(event) ?? new Set();
        listeners.add(listener);
        this.#listeners.set(event, listeners);
        return () => listeners.delete(listener);
    }

    emit(event, payload) {
        for (const listener of [...(this.#listeners.get(event) ?? [])]) listener(payload);
    }

    register(name, handler) {
        if (this.#destroyed || typeof name !== 'string' || !name.trim() || typeof handler !== 'function') {
            throw new TypeError('An active editor, command name and handler are required');
        }
        if (this.#commands.has(name)) throw new Error('Command already registered: ' + name);
        this.#commands.set(name, handler);
        return () => {
            if (this.#commands.get(name) === handler) this.#commands.delete(name);
        };
    }

    getCommand(name) {
        return this.#commands.get(name);
    }

    addCleanup(cleanup) {
        if (typeof cleanup === 'function') this.#cleanups.push(cleanup);
    }

    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        const errors = [];
        for (const cleanup of this.#cleanups.reverse()) {
            try {
                cleanup();
            } catch (error) {
                errors.push(error);
            }
        }
        this.#cleanups = [];
        this.#listeners.clear();
        this.#commands.clear();
        if (errors.length) throw new AggregateError(errors, 'Xoditor plugin cleanup failed');
    }
}
