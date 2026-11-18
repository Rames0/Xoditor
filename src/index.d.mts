export interface ChangeEvent {
    html: string;
    editor: Xoditor;
}

export type Plugin = (editor: Xoditor) => void | (() => void);
export type Command<T = unknown, R = unknown> = (editor: Xoditor, value: T) => R;

export interface XoditorOptions {
    height?: string | number;
    minHeight?: string;
    width?: string;
    label?: string;
    placeholder?: string;
    toolbar?: string[];
    fonts?: string[];
    defaultFont?: string;
    defaultFontSize?: string;
    autoHeight?: boolean;
    autoSave?: boolean;
    autosaveKey?: string;
    autoFormatSource?: boolean;
    bootstrap?: boolean;
    ribbon?: boolean;
    readOnly?: boolean;
    stickyToolbar?: boolean;
    wordCount?: boolean;
    maxImageBytes?: number;
    uploadImage?: (file: File) => string | Promise<string>;
    onChange?: (html: string, editor: Xoditor) => void;
    plugins?: Plugin[];
    [legacyOption: string]: unknown;
}

export declare class Xoditor {
    constructor(element: string | HTMLElement, options?: XoditorOptions);
    static readonly version: string;
    static readonly author: string;
    static readonly license: string;
    static readonly homepage: string;
    readonly element: HTMLElement;
    readonly editor: HTMLElement | null;
    readonly container: HTMLElement;
    readonly readOnly: boolean;
    readonly destroyed?: boolean;
    on(event: 'change', listener: (event: ChangeEvent) => void): () => void;
    registerCommand<T, R>(name: string, handler: Command<T, R>): () => void;
    execute(name: string, value?: unknown): unknown;
    execCommand(name: string, value?: unknown): unknown;
    /** Insert trusted HTML at the current editor selection. */
    insertMarkup(html: string): void;
    getHTML(): string;
    setHTML(html: string): void;
    getContent(): string;
    setContent(html: string): void;
    getText(): string;
    clear(): void;
    focus(): void;
    undo(): void;
    redo(): void;
    setReadOnly(value: boolean): void;
    destroy(): void;
}

export default Xoditor;
