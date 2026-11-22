/*! Xoditor v1.0.0 | Open-source rich text editor
 * Copyright (c) 2026 Ramesh Maharjan
 * https://xoditor.rameshmaharjan.info.np
 * Released under the MIT License. See LICENSE.
 * Bundled third-party libraries retain their respective licenses.
 */
class Xoditor {
    // BEGIN GENERATED METADATA
    static get version() { return "1.0.0"; }
    static get author() { return 'Ramesh Maharjan'; }
    static get license() { return "MIT"; }
    static get homepage() { return "https://xoditor.rameshmaharjan.info.np"; }
    // END GENERATED METADATA
    constructor(element, options = {}) {
        this.element = typeof element === 'string' ? document.querySelector(element) : element;
        
        if (!this.element) {
            throw new Error('Xoditor: Element not found');
        }
        
        const isAuto = options.autoHeight === true || options.height === 'auto';
        this.options = {
            height: isAuto ? 'auto' : '600px',
            minHeight: '200px',
            autoHeight: isAuto,
            width: '100%',
            placeholder: 'Start typing...',
            toolbar: ['fontName', 'fontSize', 'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'foreColor', 'backColor', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertOrderedList', 'insertUnorderedList', 'outdent', 'indent', 'link', 'unlink', 'image', 'table', 'hr', 'html', 'removeFormat', 'undo', 'redo', 'selectAll', 'print', 'wordCount', 'spellCheck', 'find', 'replace', 'fullscreen', 'zoom'],
            fonts: ['Kalimati', 'Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Verdana', 'Georgia', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Helvetica', 'Garamond', 'Palatino', 'Kokila', 'Preeti', 'Sagarmatha', 'Kantipur', 'Fontasy Himali'],
            defaultFont: 'Kalimati',
            spellCheck: true,
            wordCount: true,
            autoSave: true,
            autoFormat: true,
            smartQuotes: true,
            autoCorrect: true,
            trackChanges: false,
            collaborativeMode: false,
            pageBreaks: true,
            headers: true,
            footers: true,
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            pageSize: 'A4',
            zoom: 100,
            ...options
        };
        
        if (this.options.autoHeight || this.options.height === 'auto') {
            this.options.autoHeight = true;
            this.options.height = 'auto';
        }
        
        this.htmlMode = false;
        this.fullscreenMode = false;
        this.wordCount = 0;
        this.characterCount = 0;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoStack = 50;
        this.isComposing = false;
        this.lastContent = '';
        this.autoCorrectRules = this.initAutoCorrectRules();
        this.smartQuoteRules = this.initSmartQuoteRules();
        this.currentFont = this.options.defaultFont;
        this.currentFontSize = '11';
        
        this.init();
    }

    initAutoCorrectRules() {
        return {
            '(c)': '©',
            '(r)': '®',
            '(tm)': '™',
            '--': '—',
            '...': '…',
            '1/2': '½',
            '1/4': '¼',
            '3/4': '¾',
            '->': '→',
            '<-': '←',
            '=>': '⇒',
            '<=': '⇐',
            '+-': '±',
            'teh': 'the',
            'adn': 'and',
            'recieve': 'receive',
            'seperate': 'separate',
            'definately': 'definitely',
            'occured': 'occurred'
        };
    }
    
    initSmartQuoteRules() {
        return {
            '"': { open: '"', close: '"' },
            "'": { open: '"', close: '"' }
        };
    }

    init() {
        this.createEditor();
        this.createToolbar();
        this.bindEvents();
        this.initializeFonts();
        this.lastContent = this.getContent();
    }
    
    initializeFonts() {
        // Set default font and size for the editor
        this.editor.style.fontFamily = `"${this.options.defaultFont}", ${this.getFontFallback(this.options.defaultFont)}`;
        this.editor.style.fontSize = '11pt';
        this.editor.style.setProperty('font-family', `"${this.options.defaultFont}", ${this.getFontFallback(this.options.defaultFont)}`, 'important');
        this.editor.style.setProperty('font-size', '11pt', 'important');
        
        // Ensure fonts are loaded
        this.loadCustomFonts();
        
        // Set initial toolbar state
        setTimeout(() => {
            this.updateDefaultToolbarState();
        }, 100);
        
        // Flag to track paragraph initialization
        this.hasInitializedParagraph = false;
        
        // Add font change detection
        this.setupFontChangeDetection();
    }
    
    initializeWithParagraph() {
        if (this.htmlMode) return;
        
        const p = document.createElement('p');
        p.innerHTML = '<br>'; // Ensures the paragraph has height
        
        this.editor.appendChild(p);
        
        // Set cursor in the paragraph
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(p, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        this.updatePlaceholder();
    }
    
    loadCustomFonts() {
        // Check if custom fonts are loaded
        const customFonts = ['Kalimati', 'Kokila', 'Preeti', 'Sagarmatha', 'Kantipur', 'Fontasy Himali'];
        
        customFonts.forEach(font => {
            if (this.options.fonts.includes(font)) {
                // Create a test element to trigger font loading
                const testElement = document.createElement('span');
                testElement.style.fontFamily = font;
                testElement.style.position = 'absolute';
                testElement.style.visibility = 'hidden';
                testElement.style.fontSize = '1px';
                testElement.textContent = 'test';
                document.body.appendChild(testElement);
                
                // Remove after a short delay
                setTimeout(() => {
                    if (testElement.parentNode) {
                        testElement.parentNode.removeChild(testElement);
                    }
                }, 1000);
            }
        });
    }

    createEditor() {
        this.container = document.createElement('div');
        this.container.className = 'xoditor';
        
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'editor-toolbar';
        
        this.editor = document.createElement('div');
        this.editor.className = 'editor-content';
        this.editor.contentEditable = 'true';
        if (this.options.autoHeight) {
            this.container.classList.add('auto-height');
            this.container.dataset.autoHeight = 'true';
            this.editor.style.height = 'auto';
        } else {
            this.editor.style.height = this.options.height;
        }
        if (this.options.minHeight) {
            this.editor.style.minHeight = typeof this.options.minHeight === 'number' ?
                this.options.minHeight + 'px' : this.options.minHeight;
        }
        this.container.style.width = this.options.width;
        this.editor.setAttribute('data-placeholder', this.options.placeholder);
        
        if (this.options.spellCheck) {
            this.editor.setAttribute('spellcheck', 'true');
        }
        
        this.container.appendChild(this.toolbar);
        this.container.appendChild(this.editor);
        
        if (this.options.wordCount) {
            this.createStatusBar();
        }
        
        // Don't set default font on the entire editor to avoid affecting all text
        
        this.element.appendChild(this.container);
    }

    isAutoHeight() {
        if (this.options.autoHeight === true || this.options.height === 'auto') return true;
        if (this.container && (this.container.classList.contains('auto-height') || this.container.dataset.autoHeight === 'true')) return true;
        if (this.editor && this.editor.style.height === 'auto') return true;
        return false;
    }

    isFlexFill() {
        if (!this.container) return false;
        if (this.container.classList.contains('flex-fill')) return true;
        if (this.container.style.height === '100%') return true;
        if (this.container.closest && this.container.closest('.printable-sifarish-editor-wrap')) return true;
        const parent = this.container.parentElement;
        if (parent) {
            if (parent.classList.contains('printable-sifarish-editor-wrap')) return true;
            try {
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.display === 'flex') {
                    const compStyle = window.getComputedStyle(this.container);
                    if (compStyle.flexGrow !== '0' && compStyle.height !== 'auto') return true;
                }
            } catch (_) {}
        }
        return false;
    }

    createToolbar() {
        const buttons = {
            fontName: { type: 'select', title: 'Font Family' },
            fontSize: { type: 'select', title: 'Font Size', options: ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '36', '40', '44', '48', '54', '60', '66', '72', '80', '88', '96'] },
            bold: { icon: '<i class="fa fa-bold"></i>', command: 'bold', title: 'Bold (Ctrl+B)' },
            italic: { icon: '<i class="fa fa-italic"></i>', command: 'italic', title: 'Italic (Ctrl+I)' },
            underline: { icon: '<i class="fa fa-underline"></i>', command: 'underline', title: 'Underline (Ctrl+U)' },
            strikethrough: { icon: '<i class="fa fa-strikethrough"></i>', command: 'strikeThrough', title: 'Strikethrough' },
            subscript: { icon: '<i class="fa fa-subscript"></i>', command: 'subscript', title: 'Subscript' },
            superscript: { icon: '<i class="fa fa-superscript"></i>', command: 'superscript', title: 'Superscript' },
            foreColor: { icon: '<i class="fa fa-font"></i>', command: 'foreColor', title: 'Text Color' },
            backColor: { icon: '<i class="fa fa-paint-brush"></i>', command: 'backColor', title: 'Highlight Color' },
            justifyLeft: { icon: '<i class="fa fa-align-left"></i>', command: 'justifyLeft', title: 'Align Left' },
            justifyCenter: { icon: '<i class="fa fa-align-center"></i>', command: 'justifyCenter', title: 'Center' },
            justifyRight: { icon: '<i class="fa fa-align-right"></i>', command: 'justifyRight', title: 'Align Right' },
            justifyFull: { icon: '<i class="fa fa-align-justify"></i>', command: 'justifyFull', title: 'Justify' },
            insertOrderedList: { icon: '<i class="fa fa-list-ol"></i>', command: 'insertOrderedList', title: 'Numbered List' },
            insertUnorderedList: { icon: '<i class="fa fa-list-ul"></i>', command: 'insertUnorderedList', title: 'Bullet List' },
            outdent: { icon: '<i class="fa fa-outdent"></i>', command: 'outdent', title: 'Decrease Indent' },
            indent: { icon: '<i class="fa fa-indent"></i>', command: 'indent', title: 'Increase Indent' },
            link: { icon: '<i class="fa fa-link"></i>', command: 'createLink', title: 'Insert Link' },
            unlink: { icon: '<i class="fa fa-unlink"></i>', command: 'unlink', title: 'Remove Link' },
            image: { icon: '<i class="fa fa-image"></i>', command: 'insertImage', title: 'Insert Image' },
            table: { icon: '<i class="fa fa-table"></i>', command: 'insertTable', title: 'Insert Table' },
            hr: { icon: '<i class="fa fa-minus"></i>', command: 'insertHorizontalRule', title: 'Horizontal Rule' },
            html: { icon: '<i class="fa fa-code"></i>', command: 'toggleHTML', title: 'Edit HTML' },
            removeFormat: { icon: '<i class="fa fa-eraser"></i>', command: 'removeFormat', title: 'Clear Formatting' },
            undo: { icon: '<i class="fa fa-undo"></i>', command: 'undo', title: 'Undo' },
            redo: { icon: '<i class="fa fa-repeat"></i>', command: 'redo', title: 'Redo' },
            selectAll: { icon: '<i class="fa fa-check-square-o"></i>', command: 'selectAll', title: 'Select All' },
            print: { icon: '<i class="fa fa-print"></i>', command: 'print', title: 'Print' },
            wordCount: { icon: '<i class="fa fa-calculator"></i>', command: 'showWordCount', title: 'Word Count' },
            spellCheck: { icon: '<i class="fa fa-spell-check"></i>', command: 'toggleSpellCheck', title: 'Toggle Spell Check' },
            find: { icon: '<i class="fa fa-search"></i>', command: 'showFindReplace', title: 'Find and replace' },
            
            fullscreen: { icon: '<i class="fa fa-expand"></i>', command: 'toggleFullscreen', title: 'Fullscreen' },
            zoom: { type: 'select', title: 'Zoom', options: ['50%', '75%', '100%', '125%', '150%', '200%'] }
        };

        this.options.toolbar.forEach(tool => {
            if (buttons[tool]) {
                if (buttons[tool].type === 'select') {
                    this.createSelectTool(tool, buttons[tool]);
                } else {
                    const btn = document.createElement('button');
                    btn.className = 'word-toolbar-btn';
                    btn.innerHTML = buttons[tool].icon;
                    btn.title = buttons[tool].title;
                    btn.onclick = (e) => {
                        e.preventDefault();
                        if (buttons[tool].command === 'foreColor' || buttons[tool].command === 'backColor') {
                            this.showColorPicker(buttons[tool].command, btn);
                        } else if (buttons[tool].command === 'showWordCount') {
                            this.showWordCountDialog();
                        } else if (buttons[tool].command === 'toggleSpellCheck') {
                            this.toggleSpellCheck();
                        } else if (buttons[tool].command === 'showFindReplace') {
                            this.showFindReplace(tool === 'replace');
                        } else if (buttons[tool].command === 'toggleFullscreen') {
                            this.toggleFullscreen();
                        } else {
                            this.execCommand(buttons[tool].command);
                        }
                    };
                    this.toolbar.appendChild(btn);
                }
            }
        });
    }

    createSelectTool(tool, config) {
        if (tool === 'fontName') {
            this.createFontDropdown();
        } else if (tool === 'fontSize') {
            this.createFontSizeDropdown(config.options);
        } else if (tool === 'zoom') {
            this.createZoomDropdown(config.options);
        }
    }

    createStatusBar() {
        this.statusBar = document.createElement('div');
        this.statusBar.className = 'editor-status-bar';
        
        this.wordCountDisplay = document.createElement('span');
        this.wordCountDisplay.className = 'word-count-display';
        this.wordCountDisplay.textContent = 'Words: 0 | Characters: 0';
        
        this.statusBar.appendChild(this.wordCountDisplay);
        this.container.appendChild(this.statusBar);
    }

    createFontDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'word-dropdown font-dropdown';
        
        const button = document.createElement('button');
        button.className = 'word-dropdown-btn';
        button.innerHTML = `<span class="dropdown-text">${this.currentFont}</span><i class="fa fa-caret-down"></i>`;
        button.title = 'Font Family';
        
        const menu = document.createElement('div');
        menu.className = 'word-dropdown-menu font-menu';
        
        // Add search input for fonts
        const searchContainer = document.createElement('div');
        searchContainer.className = 'font-search-container';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search fonts...';
        searchInput.className = 'font-search-input';
        searchContainer.appendChild(searchInput);
        menu.appendChild(searchContainer);
        
        const fontList = document.createElement('div');
        fontList.className = 'font-list';
        
        this.options.fonts.forEach(font => {
            const item = document.createElement('div');
            item.className = 'word-dropdown-item font-item';
            item.style.fontFamily = `'${font}', ${this.getFontFallback(font)}`;
            const fontLabel = document.createElement('span');
            fontLabel.className = 'font-name';
            fontLabel.textContent = font;
            item.appendChild(fontLabel);
            item.dataset.font = font;
            item.title = font;
            
            // Highlight current font
            if (font === this.currentFont) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Remove previous selection
                fontList.querySelectorAll('.font-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.applyFont(font, button, menu);
            });
            
            fontList.appendChild(item);
        });
        
        menu.appendChild(fontList);
        
        // Font search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const fontItems = fontList.querySelectorAll('.font-item');
            
            fontItems.forEach(item => {
                const fontName = item.dataset.font.toLowerCase();
                if (fontName.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(menu);
            // Focus search input when opened
            if (menu.classList.contains('show')) {
                setTimeout(() => searchInput.focus(), 100);
            }
        });
        
        dropdown.appendChild(button);
        dropdown.appendChild(menu);
        this.toolbar.appendChild(dropdown);
    }
    
    getFontFallback(font) {
        // Provide appropriate fallbacks for different font types
        const serifFonts = ['Times New Roman', 'Georgia', 'Garamond', 'Palatino', 'Kokila'];
        const monospaceFonts = ['Courier New', 'Consolas', 'Monaco'];
        
        if (serifFonts.includes(font)) {
            return 'serif';
        } else if (monospaceFonts.includes(font)) {
            return 'monospace';
        } else {
            return 'sans-serif';
        }
    }

    createFontSizeDropdown(sizes) {
        const dropdown = document.createElement('div');
        dropdown.className = 'word-dropdown size-dropdown';
        
        const button = document.createElement('button');
        button.className = 'word-dropdown-btn size-btn';
        button.innerHTML = `<span class="dropdown-text">${this.currentFontSize}</span><i class="fa fa-caret-down"></i>`;
        button.title = 'Font Size';
        
        // Add editable input for custom sizes
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'size-input';
        input.value = this.currentFontSize;
        input.min = '8';
        input.max = '96';
        input.style.display = 'none';
        
        const menu = document.createElement('div');
        menu.className = 'word-dropdown-menu size-menu';
        
        // Add custom size input at top
        const customSizeContainer = document.createElement('div');
        customSizeContainer.className = 'custom-size-container';
        const customSizeInput = document.createElement('input');
        customSizeInput.type = 'number';
        customSizeInput.placeholder = 'Custom size';
        customSizeInput.className = 'custom-size-input';
        customSizeInput.min = '8';
        customSizeInput.max = '96';
        customSizeInput.value = this.currentFontSize;
        
        const applyCustomBtn = document.createElement('button');
        applyCustomBtn.textContent = 'Apply';
        applyCustomBtn.className = 'apply-custom-size';
        
        customSizeContainer.appendChild(customSizeInput);
        customSizeContainer.appendChild(applyCustomBtn);
        menu.appendChild(customSizeContainer);
        
        // Add separator
        const separator = document.createElement('div');
        separator.className = 'size-separator';
        menu.appendChild(separator);
        
        const sizeList = document.createElement('div');
        sizeList.className = 'size-list';
        
        sizes.forEach(size => {
            const item = document.createElement('div');
            item.className = 'word-dropdown-item size-item';
            item.innerHTML = `<span class="size-value">${size}</span><span class="size-preview" style="font-size: ${Math.min(parseInt(size), 16)}px;">${size}pt</span>`;
            item.dataset.size = size;
            item.title = `${size} points`;
            
            // Highlight current size
            if (size === this.currentFontSize) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Remove previous selection
                sizeList.querySelectorAll('.size-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                customSizeInput.value = size;
                this.applyFontSize(size, button, menu);
            });
            
            sizeList.appendChild(item);
        });
        
        menu.appendChild(sizeList);
        
        // Custom size functionality
        const applyCustomSize = () => {
            const customSize = parseInt(customSizeInput.value);
            if (customSize >= 8 && customSize <= 96) {
                // Remove previous selections
                sizeList.querySelectorAll('.size-item').forEach(i => i.classList.remove('selected'));
                this.applyFontSize(customSize.toString(), button, menu);
            }
        };
        
        applyCustomBtn.addEventListener('click', applyCustomSize);
        customSizeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyCustomSize();
            }
        });
        
        // Double-click to edit size directly
        button.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const currentText = button.querySelector('.dropdown-text');
            input.style.display = 'inline-block';
            input.style.width = '40px';
            input.style.height = '20px';
            input.style.fontSize = '11px';
            input.value = this.currentFontSize;
            currentText.style.display = 'none';
            button.appendChild(input);
            input.focus();
            input.select();
            
            const finishEdit = () => {
                const newSize = parseInt(input.value);
                if (newSize >= 8 && newSize <= 96) {
                    this.applyFontSize(newSize.toString(), button, menu);
                }
                input.style.display = 'none';
                currentText.style.display = 'inline';
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
            };
            
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    finishEdit();
                }
            });
        });
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(menu);
            // Focus custom input when opened
            if (menu.classList.contains('show')) {
                setTimeout(() => customSizeInput.focus(), 100);
            }
        });
        
        dropdown.appendChild(button);
        dropdown.appendChild(menu);
        this.toolbar.appendChild(dropdown);
    }

    createZoomDropdown(options) {
        const dropdown = document.createElement('div');
        dropdown.className = 'word-dropdown zoom-dropdown';
        
        const button = document.createElement('button');
        button.className = 'word-dropdown-btn';
        button.innerHTML = '<span class="dropdown-text">100%</span><i class="fa fa-caret-down"></i>';
        
        const menu = document.createElement('div');
        menu.className = 'word-dropdown-menu';
        
        options.forEach(zoom => {
            const item = document.createElement('div');
            item.className = 'word-dropdown-item';
            item.textContent = zoom;
            item.dataset.zoom = zoom;
            
            item.addEventListener('click', () => this.applyZoom(zoom, button, menu));
            
            menu.appendChild(item);
        });
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(menu);
        });
        
        dropdown.appendChild(button);
        dropdown.appendChild(menu);
        this.toolbar.appendChild(dropdown);
    }

    toggleDropdown(menu) {
        document.querySelectorAll('.word-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
        
        if (menu.classList.contains('show')) {
            setTimeout(() => {
                document.addEventListener('click', () => {
                    menu.classList.remove('show');
                }, { once: true });
            }, 10);
        }
    }

    applyFont(font, button, menu) {
        menu.classList.remove('show');
        button.querySelector('.dropdown-text').textContent = font;
        this.currentFont = font;
        
        if (this.htmlMode) {
            this.applyFontInHTMLMode(font);
            return;
        }
        
        this.editor.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            // Apply font ONLY to selected text
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontFamily = `"${font}"`;
            
            try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
                
                // Restore selection on the modified text
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);
            } catch (error) {
                console.error('Font application failed:', error);
            }
        }
        // Do NOT change default font when no selection - only change selected text
    }
    
    applyFontInHTMLMode(font) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) {
            // If no selection, update the entire HTML content's font references
            let htmlContent = this.editor.textContent || this.editor.innerText || '';
            htmlContent = this.updateFontInSelectedHTML(htmlContent, 'font-family', font);
            this.editor.textContent = htmlContent;
            return;
        }
        
        const selectedText = selection.toString();
        if (!selectedText) return;
        
        // Update font references within the selected HTML text
        const updatedText = this.updateFontInSelectedHTML(selectedText, 'font-family', font);
        
        // Replace selected text with updated text
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(updatedText));
        
        // Clear selection
        selection.removeAllRanges();
    }
    
    updateFontInSelectedHTML(htmlText, property, value) {
        let updatedHTML = htmlText;
        
        if (property === 'font-family') {
            // Update all font-family in style attributes
            updatedHTML = updatedHTML.replace(
                /font-family:\s*[^;"']+/gi,
                `font-family: '${value}'`
            );
            
            // Update face attributes in font tags
            updatedHTML = updatedHTML.replace(
                /face="[^"]*"/gi,
                `face="${value}"`
            );
            
            // Update encoded font-family references
            updatedHTML = updatedHTML.replace(
                /font-family:\s*&quot;[^&]*&quot;/gi,
                `font-family: &quot;${value}&quot;`
            );
            
            // If no existing font-family found, add it to style attributes
            if (!updatedHTML.includes('font-family:')) {
                updatedHTML = updatedHTML.replace(
                    /style="([^"]*)"/gi,
                    `style="$1; font-family: '${value}';"`
                );
                
                // If no style attribute exists, add one
                if (!updatedHTML.includes('style=')) {
                    updatedHTML = updatedHTML.replace(
                        /<(\w+)([^>]*)>/gi,
                        `<$1$2 style="font-family: '${value}';">`
                    );
                }
            }
            
        } else if (property === 'font-size') {
            // Update all font-size references
            updatedHTML = updatedHTML.replace(
                /font-size:\s*[^;"']+/gi,
                `font-size: ${value}pt`
            );
            
            // Update size attributes in font tags
            updatedHTML = updatedHTML.replace(
                /size="[^"]*"/gi,
                `size="${Math.round(value/3)}"`
            );
            
            // If no existing font-size found, add it to style attributes
            if (!updatedHTML.includes('font-size:')) {
                updatedHTML = updatedHTML.replace(
                    /style="([^"]*)"/gi,
                    `style="$1; font-size: ${value}pt"`
                );
                
                // If no style attribute exists, add one
                if (!updatedHTML.includes('style=')) {
                    updatedHTML = updatedHTML.replace(
                        /<(\w+)([^>]*)>/gi,
                        `<$1$2 style="font-size: ${value}pt">`
                    );
                }
            }
        }
        
        return updatedHTML;
    }
    
    updateHTMLFontReferences(property, value) {
        let htmlContent = this.editor.textContent || this.editor.innerText;
        htmlContent = this.updateFontInSelectedHTML(htmlContent, property, value);
        this.editor.textContent = htmlContent;
    }

    applyFontToSelection(font) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const span = document.createElement('span');
        span.style.fontFamily = font;
        
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        } catch (error) {
            console.error('Font application failed:', error);
        }
    }
    
    setDefaultFont(font) {
        // Set default font for the editor
        this.editor.style.fontFamily = `"${font}", ${this.getFontFallback(font)}`;
        this.editor.style.setProperty('font-family', `"${font}", ${this.getFontFallback(font)}`, 'important');
        
        // Store as current default
        this.currentFont = font;
        
        // Update any empty paragraphs and divs
        const emptyElements = this.editor.querySelectorAll('p:empty, div:empty, span:empty');
        emptyElements.forEach(el => {
            el.style.fontFamily = `"${font}", ${this.getFontFallback(font)}`;
            el.style.setProperty('font-family', `"${font}", ${this.getFontFallback(font)}`, 'important');
        });
        
        // Apply to current cursor position if no selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            let element = range.startContainer;
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            if (element && this.editor.contains(element)) {
                element.style.fontFamily = `"${font}", ${this.getFontFallback(font)}`;
                element.style.setProperty('font-family', `"${font}", ${this.getFontFallback(font)}`, 'important');
            }
        }
    }
    
    getSelectedElements(range) {
        const elements = [];
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (range.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );
        
        let node;
        while (node = walker.nextNode()) {
            elements.push(node);
        }
        
        return elements;
    }

    applyFontSize(size, button, menu) {
        menu.classList.remove('show');
        button.querySelector('.dropdown-text').textContent = size;
        this.currentFontSize = size;
        
        const fontSize = parseInt(size, 10);
        if (fontSize < 8 || fontSize > 96) return;
        
        if (this.htmlMode) {
            this.applyFontSizeInHTMLMode(fontSize);
            return;
        }
        
        this.editor.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            // Apply font size ONLY to selected text
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontSize = fontSize + 'pt';
            
            try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
                
                // Restore selection on the modified text
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);
            } catch (error) {
                console.error('Font size application failed:', error);
            }
        }
        // Do NOT change default font size when no selection - only change selected text
    }
    
    applyFontSizeInHTMLMode(fontSize) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) {
            // If no selection, update the entire HTML content's font size references
            let htmlContent = this.editor.textContent || this.editor.innerText || '';
            htmlContent = this.updateFontInSelectedHTML(htmlContent, 'font-size', fontSize);
            this.editor.textContent = htmlContent;
            return;
        }
        
        const selectedText = selection.toString();
        if (!selectedText) return;
        
        // Update font size references within the selected HTML text
        const updatedText = this.updateFontInSelectedHTML(selectedText, 'font-size', fontSize);
        
        // Replace selected text with updated text
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(updatedText));
        
        // Clear selection
        selection.removeAllRanges();
    }
    
    applyFontSizeToSelection(fontSize) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const span = document.createElement('span');
        span.style.fontSize = fontSize + 'px';
        
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        } catch (error) {
            console.error('Font size application failed:', error);
        }
    }
    
    applyStyleToSelection(property, value) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        // Always create new span for selected text
        const span = document.createElement('span');
        span.style[this.camelCase(property)] = value;
        
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            // Restore selection
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        } catch (error) {
            console.error('Style application failed:', error);
        }
    }
    
    getParentSpan(range) {
        let element = range.commonAncestorContainer;
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        while (element && element !== this.editor) {
            if (element.tagName === 'SPAN') {
                return element;
            }
            element = element.parentElement;
        }
        return null;
    }
    
    isDirectSpanParent(range, span) {
        // Check if the entire selection is within this span
        return span.contains(range.startContainer) && span.contains(range.endContainer);
    }
    
    cleanupSpanStyle(span) {
        // Combine font-family and font-size into proper order
        const fontFamily = span.style.fontFamily;
        const fontSize = span.style.fontSize;
        
        if (fontFamily && fontSize) {
            // Clear existing styles and set in proper order
            span.removeAttribute('style');
            span.style.fontFamily = fontFamily;
            span.style.fontSize = fontSize;
        }
    }
    
    camelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
    
    setDefaultFontSize(fontSize) {
        // Set default font size for the editor
        this.editor.style.fontSize = fontSize + 'pt';
        this.editor.style.setProperty('font-size', fontSize + 'pt', 'important');
        this.currentFontSize = fontSize.toString();
        
        // Update any empty paragraphs and divs
        const emptyElements = this.editor.querySelectorAll('p:empty, div:empty, span:empty');
        emptyElements.forEach(el => {
            el.style.fontSize = fontSize + 'pt';
            el.style.setProperty('font-size', fontSize + 'pt', 'important');
        });
        
        // Apply to current cursor position if no selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            let element = range.startContainer;
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            if (element && this.editor.contains(element)) {
                element.style.fontSize = fontSize + 'pt';
                element.style.setProperty('font-size', fontSize + 'pt', 'important');
            }
        }
    }
    
    cleanupFontElements(targetSize) {
        // Clean up old font elements and apply exact pixel sizes
        const fontElements = this.editor.querySelectorAll('font[size]');
        fontElements.forEach(el => {
            const span = document.createElement('span');
            span.style.fontSize = (targetSize || this.currentFontSize || 11) + 'px !important';
            span.setAttribute('data-font-size', targetSize || this.currentFontSize || 11);
            span.innerHTML = el.innerHTML;
            
            // Preserve other styles
            if (el.hasAttribute('color')) {
                span.style.color = el.getAttribute('color');
            }
            if (el.hasAttribute('face')) {
                span.style.fontFamily = el.getAttribute('face');
            }
            
            el.parentNode.replaceChild(span, el);
        });
        
        // Also clean up any remaining font tags without size
        const allFontElements = this.editor.querySelectorAll('font');
        allFontElements.forEach(el => {
            const span = document.createElement('span');
            
            // Preserve attributes as styles
            if (el.hasAttribute('size')) {
                const size = this.fontSizeToPixels(el.getAttribute('size'));
                span.style.fontSize = size + 'px !important';
            }
            if (el.hasAttribute('color')) {
                span.style.color = el.getAttribute('color') + ' !important';
            }
            if (el.hasAttribute('face')) {
                span.style.fontFamily = el.getAttribute('face') + ' !important';
            }
            
            span.innerHTML = el.innerHTML;
            el.parentNode.replaceChild(span, el);
        });
    }
    
    fontSizeToPixels(sizeIndex) {
        // Convert font size index to pixels
        const sizeMap = {
            '1': 8, '2': 10, '3': 12, '4': 14, '5': 18, '6': 24, '7': 36
        };
        return sizeMap[sizeIndex] || 12;
    }

    applyZoom(zoomValue, button, menu) {
        const zoom = parseInt(zoomValue);
        this.options.zoom = zoom;
        this.editor.style.zoom = zoom + '%';
        button.querySelector('.dropdown-text').textContent = zoomValue;
        menu.classList.remove('show');
    }

    getFontSizeIndex(fontSize) {
        // Map font sizes to execCommand fontSize indices (1-7)
        const sizeMap = {
            8: '1', 10: '1', 11: '2', 12: '2', 14: '3', 16: '4', 18: '4',
            20: '5', 22: '5', 24: '6', 26: '6', 28: '6', 30: '7', 32: '7',
            36: '7', 40: '7', 44: '7', 48: '7', 54: '7', 60: '7', 66: '7',
            72: '7', 80: '7', 88: '7', 96: '7'
        };
        return sizeMap[fontSize] || '3';
    }

    execCommand(command, value = null) {
        try {
            this.editor.focus();
            
            if (command === 'undo') {
                this.performUndo();
                return;
            } else if (command === 'redo') {
                this.performRedo();
                return;
            } else if (command === 'createLink') {
                if (value !== null && value !== undefined && value !== '') {
                    const validUrl = this.validateUrl(value);
                    if (validUrl) {
                        document.execCommand(command, false, validUrl);
                    } else {
                        this.notify('Invalid URL format');
                    }
                } else {
                    this.showLinkDialog();
                }
            } else if (command === 'insertImage') {
                if (value !== null && value !== undefined && value !== '') {
                    const validUrl = this.validateImageUrl(value);
                    if (validUrl) {
                        document.execCommand(command, false, validUrl);
                    } else {
                        this.notify('Invalid image URL format');
                    }
                } else {
                    this.showImageDialog();
                }
            } else if (command === 'insertTable') {
                this.insertTable();
            } else if (command === 'print') {
                this.printContent();
            } else if (command === 'toggleHTML') {
                this.toggleHTMLMode();
            } else {
                document.execCommand(command, false, value);
            }
        } catch (error) {
            console.error('Command execution error:', error);
        }
    }

notify(message) {
        clearTimeout(this.noticeTimeout);
        if (!this.notice) {
            this.notice = document.createElement('div');
            this.notice.className = 'xoditor-notice';
            this.notice.setAttribute('role', 'status');
            this.toolbar.after(this.notice);
        }
        this.notice.textContent = message;
        this.notice.hidden = false;
        this.noticeTimeout = setTimeout(() => {
            if (this.notice) this.notice.hidden = true;
        }, 3000);
    }

    showLinkDialog() {
        if (this.readOnly || this.htmlMode) return;
        this.linkDialog?.remove();
        this.imageDialog?.remove();

        let existingLink = null;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            if (node && node.nodeType === 3) node = node.parentElement;
            if (node && this.editor.contains(node)) {
                existingLink = node.closest('a');
            }
        }

        const initialUrl = existingLink ? (existingLink.getAttribute('href') || '') : '';
        const initialText = existingLink ? (existingLink.textContent || '') : (sel?.toString() || '');
        const initialTarget = existingLink ? (existingLink.getAttribute('target') === '_blank') : false;

        const dialog = document.createElement('div');
        dialog.className = 'custom-link-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-label', existingLink ? 'Edit link' : 'Insert link');

        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'URL: ';
        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.dataset.field = 'url';
        urlInput.placeholder = 'https://example.com';
        urlInput.value = initialUrl;
        urlInput.autocomplete = 'off';
        urlLabel.appendChild(urlInput);

        const textLabel = document.createElement('label');
        textLabel.textContent = 'Text: ';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.dataset.field = 'text';
        textInput.placeholder = 'Text to display';
        textInput.value = initialText;
        textInput.autocomplete = 'off';
        textLabel.appendChild(textInput);

        const targetLabel = document.createElement('label');
        const targetInput = document.createElement('input');
        targetInput.type = 'checkbox';
        targetInput.dataset.field = 'target';
        targetInput.checked = initialTarget;
        targetLabel.appendChild(targetInput);
        targetLabel.appendChild(document.createTextNode(' Open in new tab'));

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'custom-dialog-primary';
        applyBtn.textContent = existingLink ? 'Update Link' : 'Insert Link';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';

        let removeBtn = null;
        if (existingLink) {
            removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'custom-dialog-danger';
            removeBtn.textContent = 'Remove Link';
            removeBtn.onclick = () => {
                if (existingLink && this.editor.contains(existingLink)) {
                    existingLink.replaceWith(...existingLink.childNodes);
                } else {
                    document.execCommand('unlink');
                }
                dialog.remove();
                this.linkDialog = null;
                this.changed?.();
            };
        }

        const applyLink = () => {
            const rawUrl = urlInput.value.trim();
            if (!rawUrl) {
                this.notify('Please enter a URL');
                urlInput.focus();
                return;
            }
            const validUrl = this.validateUrl(rawUrl);
            if (!validUrl) {
                this.notify('Invalid URL format');
                urlInput.focus();
                return;
            }

            const displayText = textInput.value.trim();
            const openInNewTab = targetInput.checked;

            if (existingLink && this.editor.contains(existingLink)) {
                existingLink.href = validUrl;
                if (displayText) {
                    existingLink.textContent = displayText;
                }
                if (openInNewTab) {
                    existingLink.target = '_blank';
                    existingLink.rel = 'noopener noreferrer';
                } else {
                    existingLink.removeAttribute('target');
                    existingLink.removeAttribute('rel');
                }
            } else {
                const selNow = window.getSelection();
                const hasSelection = selNow && !selNow.isCollapsed && selNow.toString().length > 0;

                if (hasSelection && (!displayText || displayText === selNow.toString())) {
                    document.execCommand('createLink', false, validUrl);
                    if (openInNewTab && selNow.anchorNode) {
                        let parent = selNow.anchorNode.nodeType === 1 ? selNow.anchorNode : selNow.anchorNode.parentElement;
                        const created = parent?.closest('a') || parent?.querySelector(`a[href="${validUrl}"]`);
                        if (created) {
                            created.target = '_blank';
                            created.rel = 'noopener noreferrer';
                        }
                    }
                } else {
                    const link = document.createElement('a');
                    link.href = validUrl;
                    link.textContent = displayText || validUrl;
                    if (openInNewTab) {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }
                    const range = (this.savedRange ? this.savedRange.cloneRange() : null) || (selNow?.rangeCount ? selNow.getRangeAt(0) : null);
                    if (range && this.editor.contains(range.commonAncestorContainer)) {
                        range.deleteContents();
                        range.insertNode(link);
                        const newRange = document.createRange();
                        newRange.setStartAfter(link);
                        newRange.setEndAfter(link);
                        selNow?.removeAllRanges();
                        selNow?.addRange(newRange);
                    } else {
                        document.execCommand('insertHTML', false, link.outerHTML);
                    }
                }
            }

            this.changed?.();
            dialog.remove();
            this.linkDialog = null;
        };

        applyBtn.onclick = applyLink;
        cancelBtn.onclick = () => {
            dialog.remove();
            this.linkDialog = null;
            this.restoreSelection?.();
        };

        dialog.appendChild(urlLabel);
        dialog.appendChild(textLabel);
        dialog.appendChild(targetLabel);
        dialog.appendChild(applyBtn);
        if (removeBtn) dialog.appendChild(removeBtn);
        dialog.appendChild(cancelBtn);

        if (this.options.bootstrap) {
            dialog.querySelectorAll('input:not([type=checkbox])').forEach(input => input.classList.add('form-control', 'form-control-sm'));
            dialog.querySelectorAll('button').forEach(btn => {
                if (btn === applyBtn) btn.classList.add('btn', 'btn-sm', 'btn-primary');
                else if (btn === removeBtn) btn.classList.add('btn', 'btn-sm', 'btn-danger');
                else btn.classList.add('btn', 'btn-sm', 'btn-light');
            });
        }

        dialog.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                dialog.remove();
                this.linkDialog = null;
                this.restoreSelection?.();
            }
        });

        this.toolbar.after(dialog);
        this.linkDialog = dialog;
        (initialUrl ? textInput : urlInput).focus();
    }

    showImageDialog() {
        if (this.readOnly || this.htmlMode) return;
        this.linkDialog?.remove();
        this.imageDialog?.remove();

        const dialog = document.createElement('div');
        dialog.className = 'custom-image-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-label', 'Insert image');

        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'Image URL: ';
        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.dataset.field = 'url';
        urlInput.placeholder = 'https://example.com/image.png';
        urlInput.autocomplete = 'off';
        urlLabel.appendChild(urlInput);

        const altLabel = document.createElement('label');
        altLabel.textContent = 'Alt text: ';
        const altInput = document.createElement('input');
        altInput.type = 'text';
        altInput.dataset.field = 'alt';
        altInput.placeholder = 'Image description';
        altInput.autocomplete = 'off';
        altLabel.appendChild(altInput);

        const fileLabel = document.createElement('label');
        fileLabel.className = 'custom-image-file-label';
        fileLabel.textContent = 'Upload File...';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp,image/bmp';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
            if (fileInput.files[0]) {
                dialog.remove();
                this.imageDialog = null;
                if (typeof this.insertImageFile === 'function') {
                    this.insertImageFile(fileInput.files[0]);
                } else {
                    const reader = new FileReader();
                    reader.onload = () => {
                        document.execCommand('insertImage', false, reader.result);
                        this.changed?.();
                    };
                    reader.readAsDataURL(fileInput.files[0]);
                }
            }
        });
        fileLabel.appendChild(fileInput);

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'custom-dialog-primary';
        applyBtn.textContent = 'Insert Image';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';

        const applyImage = () => {
            const rawUrl = urlInput.value.trim();
            if (!rawUrl) {
                this.notify('Please enter an image URL or choose a file');
                urlInput.focus();
                return;
            }
            const validUrl = this.validateImageUrl(rawUrl);
            if (!validUrl) {
                this.notify('Invalid image URL format');
                urlInput.focus();
                return;
            }

            const altText = altInput.value.trim();
            if (altText) {
                const img = document.createElement('img');
                img.src = validUrl;
                img.alt = altText;
                img.style.maxWidth = '100%';
                const sel = window.getSelection();
                const range = (this.savedRange ? this.savedRange.cloneRange() : null) || (sel?.rangeCount ? sel.getRangeAt(0) : null);
                if (range && this.editor.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    range.insertNode(img);
                    const newRange = document.createRange();
                    newRange.setStartAfter(img);
                    newRange.setEndAfter(img);
                    sel?.removeAllRanges();
                    sel?.addRange(newRange);
                } else {
                    document.execCommand('insertHTML', false, img.outerHTML);
                }
            } else {
                document.execCommand('insertImage', false, validUrl);
            }

            this.changed?.();
            dialog.remove();
            this.imageDialog = null;
        };

        applyBtn.onclick = applyImage;
        cancelBtn.onclick = () => {
            dialog.remove();
            this.imageDialog = null;
            this.restoreSelection?.();
        };

        dialog.appendChild(urlLabel);
        dialog.appendChild(altLabel);
        dialog.appendChild(fileLabel);
        dialog.appendChild(applyBtn);
        dialog.appendChild(cancelBtn);

        if (this.options.bootstrap) {
            dialog.querySelectorAll('input:not([type=file]):not([type=checkbox])').forEach(input => input.classList.add('form-control', 'form-control-sm'));
            fileLabel.classList.add('btn', 'btn-sm', 'btn-outline-secondary');
            dialog.querySelectorAll('button').forEach(btn => {
                if (btn === applyBtn) btn.classList.add('btn', 'btn-sm', 'btn-primary');
                else btn.classList.add('btn', 'btn-sm', 'btn-light');
            });
        }

        dialog.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyImage();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                dialog.remove();
                this.imageDialog = null;
                this.restoreSelection?.();
            }
        });

        this.toolbar.after(dialog);
        this.imageDialog = dialog;
        urlInput.focus();
    }

    insertTable() {
        this.showTableGrid();
    }

    showTableGrid() {
        const existingGrid = this.container.querySelector('.table-grid');
        if (existingGrid) existingGrid.remove();
        
        const grid = document.createElement('div');
        grid.className = 'table-grid';
        
        const gridContainer = document.createElement('div');
        gridContainer.className = 'table-grid-container';
        
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 8; j++) {
                const cell = document.createElement('div');
                cell.className = 'table-grid-cell';
                cell.dataset.row = i + 1;
                cell.dataset.col = j + 1;
                
                cell.addEventListener('mouseenter', () => this.highlightTableGrid(i + 1, j + 1));
                cell.addEventListener('click', () => this.createTableFromGrid(i + 1, j + 1));
                
                gridContainer.appendChild(cell);
            }
        }
        
        const label = document.createElement('div');
        label.className = 'table-grid-label';
        label.textContent = '1 x 1 Table';
        
        grid.appendChild(gridContainer);
        grid.appendChild(label);
        
        const tableBtn = this.toolbar.querySelector('[title="Insert Table"]');
        const rect = tableBtn.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        grid.style.left = (rect.left - containerRect.left) + 'px';
        grid.style.top = (rect.bottom - containerRect.top + 5) + 'px';
        
        this.container.appendChild(grid);
        
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!grid.contains(e.target) && !tableBtn.contains(e.target)) {
                    grid.remove();
                }
            }, { once: true });
        }, 10);
    }

    highlightTableGrid(rows, cols) {
        const cells = this.container.querySelectorAll('.table-grid-cell');
        const label = this.container.querySelector('.table-grid-label');
        
        cells.forEach(cell => {
            const cellRow = parseInt(cell.dataset.row);
            const cellCol = parseInt(cell.dataset.col);
            
            if (cellRow <= rows && cellCol <= cols) {
                cell.classList.add('highlighted');
            } else {
                cell.classList.remove('highlighted');
            }
        });
        
        label.textContent = `${rows} x ${cols} Table`;
    }

    createTableFromGrid(rows, cols) {
        const grid = this.container.querySelector('.table-grid');
        if (grid) grid.remove();
        
        let tableHTML = '<table class="word-table" style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #000;">';
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>';
            for (let j = 0; j < cols; j++) {
                tableHTML += '<td style="padding: 4px 6px;"><br></td>';
            }
            tableHTML += '</tr>';
        }
        tableHTML += '</table><p></p>';
        
        this.editor.focus();
        document.execCommand('insertHTML', false, tableHTML);
        
        setTimeout(() => this.enhanceWordTables(), 100);
    }

    enhanceWordTables() {
        const tables = this.editor.querySelectorAll('.word-table');
        tables.forEach(table => {
            table.addEventListener('click', (e) => {
                if (e.target.tagName === 'TD') {
                    this.selectTableCell(e.target);
                }
            });
        });
    }

    selectTableCell(cell) {
        this.editor.querySelectorAll('.selected-cell').forEach(c => {
            c.classList.remove('selected-cell');
        });
        
        cell.classList.add('selected-cell');
        
        const range = document.createRange();
        range.selectNodeContents(cell);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        cell.focus();
    }

    showFindReplace(showReplace = false) {
        const existingDialog = document.querySelector('.find-replace-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'find-replace-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Find ${showReplace ? '& Replace' : ''}</h3>
                    <button class="close-dialog" onclick="this.closest('.find-replace-dialog').remove()">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="input-group">
                        <label>Find:</label>
                        <input type="text" id="findText" placeholder="Enter text to find">
                    </div>
                    ${showReplace ? `
                    <div class="input-group">
                        <label>Replace:</label>
                        <input type="text" id="replaceText" placeholder="Enter replacement text">
                    </div>
                    ` : ''}
                    <div class="options-group">
                        <label><input type="checkbox" id="matchCase"> Match case</label>
                        <label><input type="checkbox" id="wholeWord"> Whole words only</label>
                    </div>
                    <div class="button-group">
                        <button onclick="window.currentEditor.findNext()">Find Next</button>
                        <button onclick="window.currentEditor.findPrevious()">Find Previous</button>
                        ${showReplace ? `
                        <button onclick="window.currentEditor.replace()">Replace</button>
                        <button onclick="window.currentEditor.replaceAll()">Replace All</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        document.getElementById('findText').focus();
        
        window.currentEditor = this;
    }

    findNext() {
        const findText = document.getElementById('findText').value;
        if (!findText) return;
        
        const matchCase = document.getElementById('matchCase').checked;
        const wholeWord = document.getElementById('wholeWord').checked;
        
        this.performFind(findText, matchCase, wholeWord, true);
    }

    findPrevious() {
        const findText = document.getElementById('findText').value;
        if (!findText) return;
        
        const matchCase = document.getElementById('matchCase').checked;
        const wholeWord = document.getElementById('wholeWord').checked;
        
        this.performFind(findText, matchCase, wholeWord, false);
    }

    performFind(searchText, matchCase, wholeWord, forward) {
        const selection = window.getSelection();
        const searchFlags = [];
        
        if (!matchCase) searchFlags.push('i');
        if (wholeWord) searchText = `\\b${searchText}\\b`;
        
        const regex = new RegExp(searchText, searchFlags.join(''));
        const content = this.editor.textContent;
        
        let startPos = 0;
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            startPos = forward ? range.endOffset : range.startOffset;
        }
        
        const searchContent = forward ? content.substring(startPos) : content.substring(0, startPos);
        const match = forward ? regex.exec(searchContent) : this.findLastMatch(regex, searchContent);
        
        if (match) {
            const actualPos = forward ? startPos + match.index : match.index;
            this.selectTextRange(actualPos, actualPos + match[0].length);
        } else {
            const wrapContent = forward ? content : content;
            const wrapMatch = forward ? regex.exec(wrapContent) : this.findLastMatch(regex, wrapContent);
            
            if (wrapMatch) {
                this.selectTextRange(wrapMatch.index, wrapMatch.index + wrapMatch[0].length);
            } else {
                this.notify('Text not found');
            }
        }
    }

    findLastMatch(regex, text) {
        let lastMatch = null;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            lastMatch = match;
            if (!regex.global) break;
        }
        
        return lastMatch;
    }

    selectTextRange(start, end) {
        const walker = document.createTreeWalker(
            this.editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentPos = 0;
        let startNode = null, endNode = null;
        let startOffset = 0, endOffset = 0;
        
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;
            
            if (currentPos + nodeLength >= start && !startNode) {
                startNode = node;
                startOffset = start - currentPos;
            }
            
            if (currentPos + nodeLength >= end) {
                endNode = node;
                endOffset = end - currentPos;
                break;
            }
            
            currentPos += nodeLength;
        }
        
        if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            range.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    replace() {
        const findText = document.getElementById('findText').value;
        const replaceText = document.getElementById('replaceText').value;
        
        if (!findText) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const selectedText = selection.toString();
            const matchCase = document.getElementById('matchCase').checked;
            
            if ((matchCase && selectedText === findText) || 
                (!matchCase && selectedText.toLowerCase() === findText.toLowerCase())) {
                document.execCommand('insertText', false, replaceText);
                this.findNext();
            }
        }
    }

    replaceAll() {
        const findText = document.getElementById('findText').value;
        const replaceText = document.getElementById('replaceText').value;
        
        if (!findText) return;
        
        const matchCase = document.getElementById('matchCase').checked;
        const wholeWord = document.getElementById('wholeWord').checked;
        
        let searchFlags = 'g';
        if (!matchCase) searchFlags += 'i';
        
        let searchPattern = findText;
        if (wholeWord) searchPattern = `\\b${searchPattern}\\b`;
        
        const regex = new RegExp(searchPattern, searchFlags);
        const content = this.editor.innerHTML;
        const newContent = content.replace(regex, replaceText);
        
        this.editor.innerHTML = newContent;
        
        const matches = (content.match(regex) || []).length;
        this.notify(`Replaced ${matches} occurrence(s)`);
    }

    toggleFullscreen() {
        if (!this.fullscreenMode) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }
    
    enterFullscreen() {
        this.fullscreenMode = true;
        this.container.classList.add('fullscreen-mode');
        document.body.classList.add('editor-fullscreen');
        
        const fullscreenBtn = this.toolbar.querySelector('[title*="Fullscreen"]');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fa fa-compress"></i>';
            fullscreenBtn.title = 'Exit Fullscreen';
        }
    }
    
    exitFullscreen() {
        this.fullscreenMode = false;
        this.container.classList.remove('fullscreen-mode');
        document.body.classList.remove('editor-fullscreen');
        
        const fullscreenBtn = this.toolbar.querySelector('[title*="Fullscreen"]');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fa fa-expand"></i>';
            fullscreenBtn.title = 'Fullscreen';
        }
    }

    bindEvents() {
        this.editor.addEventListener('input', (e) => {
            if (!this.isComposing) {
                if (this.htmlMode) {
                    this.handleHTMLInput(e);
                } else {
                    this.ensureParagraphStart();
                    this.handleAutoFormat(e);
                    this.handleAutoCorrect(e);
                    this.handleSmartQuotes(e);
                    this.ensureFontConsistency();
                }
                this.saveToUndoStack();
            }
            this.updatePlaceholder();
            this.updateWordCount();
            if (this.options.autoSave) {
                this.autoSave();
            }
            
            // Debounce toolbar state updates for better performance
            if (this.toolbarUpdateTimeout) {
                clearTimeout(this.toolbarUpdateTimeout);
            }
            this.toolbarUpdateTimeout = setTimeout(() => {
                this.updateToolbarState();
            }, 100);
        });
        
        // Immediate toolbar update on selection change
        this.editor.addEventListener('selectionchange', () => {
            if (this.toolbarUpdateTimeout) {
                clearTimeout(this.toolbarUpdateTimeout);
            }
            this.updateToolbarState();
        });
        
        // Handle font changes on keyup for better responsiveness
        this.editor.addEventListener('keyup', () => {
            if (this.fontUpdateTimeout) {
                clearTimeout(this.fontUpdateTimeout);
            }
            this.fontUpdateTimeout = setTimeout(() => {
                this.updateToolbarState();
            }, 100);
        });
        
        // Handle mouse clicks for font detection
        this.editor.addEventListener('click', () => {
            setTimeout(() => {
                this.updateToolbarState();
            }, 50);
        });
        
        this.editor.addEventListener('keydown', (e) => {
            if (this.htmlMode && (e.key === 'Enter' || e.key === 'Tab')) {
                this.handleHTMLKeydown(e);
            } else if (!this.htmlMode) {
                this.handleEditorKeydown(e);
            }
        });
        
        this.editor.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        
        this.editor.addEventListener('compositionend', () => {
            this.isComposing = false;
        });
        
        // Initialize with paragraph on first focus
        this.editor.addEventListener('focus', () => {
            if (!this.hasInitializedParagraph && this.editor.innerHTML.trim() === '') {
                this.initializeWithParagraph();
                this.hasInitializedParagraph = true;
            }
        }, { once: true });

        document.addEventListener('selectionchange', () => {
            if (this.editor && document.getSelection().anchorNode && this.editor.contains(document.getSelection().anchorNode)) {
                // Debounce selection change updates
                if (this.selectionUpdateTimeout) {
                    clearTimeout(this.selectionUpdateTimeout);
                }
                this.selectionUpdateTimeout = setTimeout(() => {
                    this.updateToolbarState();
                    this.detectCurrentFont();
                }, 50);
            }
        });

        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();

            if (this.htmlMode) {
                const htmlData = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
                if (htmlData) {
                    const formatted = this.formatHTML(htmlData);
                    document.execCommand('insertText', false, formatted);
                }
            } else {
                const htmlData = e.clipboardData.getData('text/html');
                const textData = e.clipboardData.getData('text/plain');

                if (htmlData) {
                    const sanitizedHtml = this.sanitizeHtml(htmlData);
                    document.execCommand('insertHTML', false, sanitizedHtml);
                } else if (textData) {
                    document.execCommand('insertText', false, textData);
                }
            }
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.execCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.execCommand('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.execCommand('underline');
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.performRedo();
                        } else {
                            this.performUndo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.performRedo();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.execCommand('selectAll');
                        break;
                    case 'p':
                        e.preventDefault();
                        this.execCommand('print');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.execCommand('createLink');
                        break;
                    case 'f':
                        e.preventDefault();
                        this.showFindReplace();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.showFindReplace(true);
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveDocument();
                        break;
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                this.formatCode();
            }
            
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
            
            if (e.key === 'Tab') {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    let cell = range.commonAncestorContainer;
                    
                    while (cell && cell.nodeType !== Node.ELEMENT_NODE) {
                        cell = cell.parentNode;
                    }
                    while (cell && cell.tagName !== 'TD' && cell.tagName !== 'TH') {
                        cell = cell.parentNode;
                        if (!cell || cell === this.editor) break;
                    }
                    
                    if (cell && (cell.tagName === 'TD' || cell.tagName === 'TH')) {
                        e.preventDefault();
                        const nextCell = e.shiftKey ? this.getPreviousCell(cell) : this.getNextCell(cell);
                        if (nextCell) {
                            this.selectTableCell(nextCell);
                        }
                    }
                }
            }
        });
    }

    handleAutoFormat(e) {
        if (!this.options.autoFormat) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent;
            const cursorPos = range.startOffset;
            
            if (text.match(/^\d+\. /) && cursorPos > 3) {
                this.convertToOrderedList();
            } else if (text.match(/^[*-] /) && cursorPos > 2) {
                this.convertToUnorderedList();
            }
        }
    }
    
    handleAutoCorrect(e) {
        if (!this.options.autoCorrect) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent;
            const cursorPos = range.startOffset;
            
            const beforeCursor = text.substring(0, cursorPos);
            const words = beforeCursor.split(/\s+/);
            const lastWord = words[words.length - 1];
            
            if (this.autoCorrectRules[lastWord.toLowerCase()]) {
                const correction = this.autoCorrectRules[lastWord.toLowerCase()];
                const wordStart = beforeCursor.lastIndexOf(lastWord);
                
                const newText = text.substring(0, wordStart) + correction + text.substring(cursorPos);
                textNode.textContent = newText;
                
                const newRange = document.createRange();
                newRange.setStart(textNode, wordStart + correction.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }
    
    handleSmartQuotes(e) {
        if (!this.options.smartQuotes) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        
        if (textNode.nodeType === Node.TEXT_NODE && e.data) {
            const quote = e.data;
            if (this.smartQuoteRules[quote]) {
                const text = textNode.textContent;
                const cursorPos = range.startOffset;
                const beforeCursor = text.substring(0, cursorPos - 1);
                
                const isOpening = !beforeCursor.match(/\S$/) || beforeCursor.match(/[\s\(\[\{]$/);
                const smartQuote = isOpening ? this.smartQuoteRules[quote].open : this.smartQuoteRules[quote].close;
                
                const newText = text.substring(0, cursorPos - 1) + smartQuote + text.substring(cursorPos);
                textNode.textContent = newText;
                
                const newRange = document.createRange();
                newRange.setStart(textNode, cursorPos);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }

    saveToUndoStack() {
        const currentContent = this.editor.innerHTML;
        if (currentContent !== this.lastContent) {
            this.undoStack.push(this.lastContent);
            if (this.undoStack.length > this.maxUndoStack) {
                this.undoStack.shift();
            }
            this.redoStack = [];
            this.lastContent = currentContent;
        }
    }
    
    performUndo() {
        if (this.undoStack.length > 0) {
            const currentContent = this.editor.innerHTML;
            this.redoStack.push(currentContent);
            const previousContent = this.undoStack.pop();
            this.editor.innerHTML = previousContent;
            this.lastContent = previousContent;
            this.updatePlaceholder();
        }
    }
    
    performRedo() {
        if (this.redoStack.length > 0) {
            const currentContent = this.editor.innerHTML;
            this.undoStack.push(currentContent);
            const nextContent = this.redoStack.pop();
            this.editor.innerHTML = nextContent;
            this.lastContent = nextContent;
            this.updatePlaceholder();
        }
    }

    saveDocument() {
        const content = this.getContent();
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateToolbarState() {
        if (this.htmlMode) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
            this.updateDefaultToolbarState();
            return;
        }
        
        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;
        
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        // Ensure element is within editor
        if (!element || !this.editor.contains(element)) {
            this.updateDefaultToolbarState();
            return;
        }
        
        // Find the most specific element with font styling
        let fontElement = element;
        while (fontElement && fontElement !== this.editor) {
            if (fontElement.style && (fontElement.style.fontFamily || fontElement.style.fontSize)) {
                break;
            }
            fontElement = fontElement.parentElement;
        }
        
        this.updateFontDropdowns(fontElement || element);
        this.updateButtonStates();
    }
    
    updateFontDropdowns(element) {
        const fontDropdown = this.toolbar.querySelector('.font-dropdown .dropdown-text');
        const sizeDropdown = this.toolbar.querySelector('.size-dropdown .dropdown-text');
        
        if (fontDropdown) {
            const fontFamily = this.getEffectiveFontFamily(element);
            if (fontFamily && this.options.fonts.includes(fontFamily)) {
                fontDropdown.textContent = fontFamily;
                this.currentFont = fontFamily;
                
                // Update selected state in dropdown
                const fontItems = this.toolbar.querySelectorAll('.font-item');
                fontItems.forEach(item => {
                    item.classList.toggle('selected', item.dataset.font === fontFamily);
                });
            }
        }
        
        if (sizeDropdown) {
            const fontSize = this.getEffectiveFontSize(element);
            if (fontSize) {
                sizeDropdown.textContent = fontSize.toString();
                this.currentFontSize = fontSize.toString();
                
                // Update selected state in dropdown
                const sizeItems = this.toolbar.querySelectorAll('.size-item');
                sizeItems.forEach(item => {
                    item.classList.toggle('selected', item.dataset.size === fontSize.toString());
                });
                
                // Update custom size input
                const customSizeInput = this.toolbar.querySelector('.custom-size-input');
                if (customSizeInput) {
                    customSizeInput.value = fontSize.toString();
                }
            }
        }
    }
    
    getEffectiveFontFamily(element) {
        // Check for data attribute first
        if (element.hasAttribute('data-font-family')) {
            return element.getAttribute('data-font-family');
        }
        
        // Check inline style
        if (element.style.fontFamily) {
            const fontFamily = element.style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
            if (this.options.fonts.includes(fontFamily)) {
                return fontFamily;
            }
        }
        
        // Check computed style
        const computedStyle = window.getComputedStyle(element);
        const fontFamily = computedStyle.fontFamily.replace(/["']/g, '').split(',')[0].trim();
        
        // Find matching font in our list
        const matchingFont = this.options.fonts.find(font => 
            fontFamily.toLowerCase().includes(font.toLowerCase()) ||
            font.toLowerCase().includes(fontFamily.toLowerCase())
        );
        
        return matchingFont || this.currentFont;
    }
    
    getEffectiveFontSize(element) {
        // Check inline style first
        if (element.style.fontSize) {
            const fontSize = parseFloat(element.style.fontSize);
            if (fontSize >= 8 && fontSize <= 96) {
                return Math.round(fontSize);
            }
        }
        
        // Check computed style and convert from pixels to points
        const computedStyle = window.getComputedStyle(element);
        const fontSizePx = parseFloat(computedStyle.fontSize);
        
        if (fontSizePx) {
            // Convert pixels to points (1pt = 1.33px approximately)
            const fontSizePt = Math.round(fontSizePx * 0.75);
            if (fontSizePt >= 8 && fontSizePt <= 96) {
                return fontSizePt;
            }
        }
        
        return parseInt(this.currentFontSize) || 11;
    }
    
    updateDefaultToolbarState() {
        const fontDropdown = this.toolbar.querySelector('.font-dropdown .dropdown-text');
        const sizeDropdown = this.toolbar.querySelector('.size-dropdown .dropdown-text');
        
        if (fontDropdown) {
            fontDropdown.textContent = this.currentFont;
        }
        
        if (sizeDropdown) {
            sizeDropdown.textContent = this.currentFontSize;
        }
        
        this.updateButtonStates();
    }

    getNextCell(cell) {
        const cells = Array.from(cell.closest('table').querySelectorAll('td'));
        const currentIndex = cells.indexOf(cell);
        return cells[currentIndex + 1] || null;
    }

    getPreviousCell(cell) {
        const cells = Array.from(cell.closest('table').querySelectorAll('td'));
        const currentIndex = cells.indexOf(cell);
        return cells[currentIndex - 1] || null;
    }

    printContent() {
        const editorStyles = window.getComputedStyle(this.editor);
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            this.notify('Please allow popups to enable printing');
            return;
        }
        
        // Preserve colors before sanitizing
        this.preserveColors();
        const content = this.sanitizeHtml(this.editor.innerHTML);
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Print - xoditor</title>
                    <style>
                        @page {
                            margin: 15mm;
                            size: A4;
                        }
                        
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                            box-sizing: border-box;
                        }
                        
                        @media print {
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                        }
                        
                        body { 
                            font-family: ${editorStyles.fontFamily || 'Calibri, sans-serif'};
                            font-size: ${editorStyles.fontSize || '11pt'};
                            line-height: ${editorStyles.lineHeight || '1.15'};
                            color: ${editorStyles.color || '#000'};
                            background: white;
                            margin: 0;
                            padding: 0;
                            width: 100%;
                        }
                        
                        p {
                            margin: 0 0 12px 0;
                            line-height: 1.15;
                            page-break-inside: avoid;
                        }
                        
                        ul, ol {
                            margin: 12px 0;
                            padding-left: 30px;
                            page-break-inside: avoid;
                        }
                        
                        ul {
                            list-style-type: disc;
                        }
                        
                        ol {
                            list-style-type: decimal;
                        }
                        
                        ul ul {
                            list-style-type: circle;
                            margin: 6px 0;
                        }
                        
                        ul ul ul {
                            list-style-type: square;
                        }
                        
                        ol ol {
                            list-style-type: lower-alpha;
                            margin: 6px 0;
                        }
                        
                        ol ol ol {
                            list-style-type: lower-roman;
                        }
                        
                        li {
                            margin: 4px 0;
                            line-height: 1.15;
                            page-break-inside: avoid;
                        }
                        
                        img {
                            max-width: 100%;
                            height: auto;
                            border-radius: 4px;
                            margin: 8px 0;
                            page-break-inside: avoid;
                        }
                        
                        a {
                            color: #0078d4;
                            text-decoration: underline;
                        }
                        
                        table {
                            border-collapse: collapse !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 10px 0;
                            box-sizing: border-box !important;
                            page-break-inside: avoid;
                            table-layout: fixed;
                        }
                        
                        table.word-table,
                        table[style*="border"] {
                            border: 1px solid #000 !important;
                        }
                        
                        table td, table th {
                            padding: 8px;
                            text-align: left;
                            vertical-align: top;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                            page-break-inside: avoid;
                        }
                        
                        table.word-table td,
                        table.word-table th,
                        table[style*="border"] td,
                        table[style*="border"] th,
                        td[style*="border"],
                        th[style*="border"] {
                            border: 1px solid #000 !important;
                        }
                        
                        table th {
                            background: linear-gradient(to bottom, #f8f9fa, #e9ecef) !important;
                            font-weight: bold;
                            text-align: center;
                        }
                        
                        hr {
                            border: none;
                            border-top: 2px solid #ddd;
                            margin: 20px 0;
                            height: 1px;
                            background: linear-gradient(to right, transparent, #ddd, transparent);
                            page-break-after: avoid;
                        }
                        
                        strong, b { font-weight: bold; }
                        em, i { font-style: italic; }
                        u { text-decoration: underline; }
                        sub { vertical-align: sub; font-size: smaller; }
                        sup { vertical-align: super; font-size: smaller; }
                        
                        /* Preserve all inline styles */
                        [style*="font-size"] { font-size: inherit !important; }
                        [style*="font-family"] { font-family: inherit !important; }
                        [style*="color"] { color: inherit !important; }
                        [style*="background"] { background: inherit !important; }
                        [style*="text-align: left"] { text-align: left !important; }
                        [style*="text-align: center"] { text-align: center !important; }
                        [style*="text-align: right"] { text-align: right !important; }
                        [style*="text-align: justify"] { text-align: justify !important; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        
        setTimeout(() => {
            try {
                printWindow.focus();
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                }, 1000);
            } catch (error) {
                console.error('Print error:', error);
                printWindow.close();
            }
        }, 500);
    }

    toggleHTMLMode() {
        try {
            if (!this.htmlMode) {
                // Switch to HTML source mode
                this.htmlContent = this.editor.innerHTML;
                this.editor.style.fontFamily = 'Consolas, Monaco, monospace';
                this.editor.style.fontSize = '12px';
                this.editor.style.whiteSpace = 'pre-wrap';
                this.editor.textContent = this.formatHTML(this.htmlContent);
                this.htmlMode = true;
                this.container.classList.add('html-mode');
            } else {
                // Switch back to visual mode
                const htmlContent = this.editor.textContent || '';
                this.editor.style.fontFamily = '';
                this.editor.style.fontSize = '';
                this.editor.style.whiteSpace = '';
                this.editor.innerHTML = this.sanitizeHtml(htmlContent);
                this.htmlMode = false;
                this.container.classList.remove('html-mode');
                this.updatePlaceholder();
            }
        } catch (error) {
            console.error('HTML mode toggle error:', error);
        }
    }
    
    getPlainHTMLContent() {
        if (!this.htmlMode) return this.editor.innerHTML;
        return this.editor.textContent || this.editor.innerText || '';
    }
    
    highlightHTML(html) {
        const lines = html.split('\n');
        const highlightedLines = lines.map((line, index) => {
            const highlightedLine = this.highlightHTMLLine(line);
            return `<div class="html-line">${highlightedLine}</div>`;
        });
        return highlightedLines.join('');
    }
    
    highlightHTMLLine(line) {
        if (!line.trim()) return '&nbsp;';
        
        let highlighted = line;
        
        // Don't double-escape if already escaped
        if (!highlighted.includes('&lt;')) {
            highlighted = highlighted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        // HTML Comments
        highlighted = highlighted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="html-comment">$1</span>');
        
        // CDATA sections
        highlighted = highlighted.replace(/(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g, '<span class="html-cdata">$1</span>');
        
        // Processing instructions
        highlighted = highlighted.replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="html-processing-instruction">$1</span>');
        
        // DOCTYPE
        highlighted = highlighted.replace(/(&lt;!DOCTYPE[^&gt;]*&gt;)/gi, '<span class="html-doctype">$1</span>');
        
        // HTML Tags with comprehensive attribute highlighting
        highlighted = highlighted.replace(/(&lt;)(\/?)([a-zA-Z][\w-]*)(.*?)(&gt;)/g, 
            function(match, openBracket, slash, tagName, attributes, closeBracket) {
                let result = '<span class="html-tag">' + openBracket + slash + '</span>';
                result += '<span class="html-tag-name">' + tagName + '</span>';
                
                if (attributes && attributes.trim()) {
                    // Handle quoted attributes (including &quot;)
                    attributes = attributes.replace(/(\s+)([\w-]+)(\s*=\s*)(&quot;)([^&]*?)(&quot;)/g, 
                        '$1<span class="html-attribute">$2</span>$3<span class="html-attribute-value">$4$5$6</span>');
                    
                    // Handle single quoted attributes
                    attributes = attributes.replace(/(\s+)([\w-]+)(\s*=\s*)(')([^']*?)(')/g, 
                        '$1<span class="html-attribute">$2</span>$3<span class="html-attribute-value">$4$5$6</span>');
                    
                    // Handle regular quoted attributes
                    attributes = attributes.replace(/(\s+)([\w-]+)(\s*=\s*)(")([^"]*?)(")(?![^<]*<\/span>)/g, 
                        '$1<span class="html-attribute">$2</span>$3<span class="html-attribute-value">$4$5$6</span>');
                    
                    // Handle attributes without quotes
                    attributes = attributes.replace(/(\s+)([\w-]+)(\s*=\s*)([^\s"'&gt;&quot;]+)(?![^<]*<\/span>)/g, 
                        '$1<span class="html-attribute">$2</span>$3<span class="html-attribute-value">$4</span>');
                    
                    // Handle boolean attributes
                    attributes = attributes.replace(/(\s+)([\w-]+)(?=\s|$)(?![^<]*<\/span>)/g, 
                        '$1<span class="html-attribute">$2</span>');
                    
                    result += attributes;
                }
                
                result += '<span class="html-tag">' + closeBracket + '</span>';
                return result;
            }
        );
        
        // HTML Entities (including &quot;, &amp;, etc.)
        highlighted = highlighted.replace(/(&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)(?![^<]*<\/span>)/g, '<span class="html-entity">$1</span>');
        
        // Text content between tags
        highlighted = highlighted.replace(/(&gt;)([^&<]+)(&lt;)/g, function(match, gt, text, lt) {
            if (text.includes('<span') || text.trim() === '') return match;
            return gt + '<span class="html-text">' + text + '</span>' + lt;
        });
        
        // Standalone text at beginning or end of line
        highlighted = highlighted.replace(/^([^&<]+)(&lt;)/g, '<span class="html-text">$1</span>$2');
        highlighted = highlighted.replace(/(&gt;)([^&<]+)$/g, '$1<span class="html-text">$2</span>');
        
        return highlighted;
    }

    formatHTML(html) {
        if (!html) return '';
        
        // Simple formatting - just add line breaks after tags
        return html
            .replace(/></g, '>\n<')
            .replace(/^\s+|\s+$/gm, '')
            .split('\n')
            .filter(line => line.trim())
            .join('\n');
    }
    
    isSelfClosingTag(tag) {
        const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
        const tagName = tag.match(/<(\w+)/)?.[1]?.toLowerCase();
        return selfClosing.includes(tagName);
    }
    
    isInlineTag(tag) {
        const inline = ['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'small', 'sub', 'sup', 'code', 'kbd', 'samp', 'var', 'mark', 'del', 'ins'];
        const tagName = tag.match(/<(\w+)/)?.[1]?.toLowerCase();
        return inline.includes(tagName);
    }

    showColorPicker(command, button) {
        const existingPicker = this.container.querySelector('.color-picker');
        if (existingPicker) existingPicker.remove();
        
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        
        // Comprehensive color palette with proper color names and hex values
        const colors = [
            // Basic colors
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
            // Extended colors
            '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#808080', '#C0C0C0',
            // Additional colors
            '#FFA500', '#FFC0CB', '#A52A2A', '#DDA0DD', '#98FB98', '#87CEEB', '#F0E68C', '#D2691E',
            '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#FFB6C1', '#20B2AA', '#87CEFA', '#778899',
            '#B0C4DE', '#FFFFE0', '#00CED1', '#FA8072', '#E6E6FA', '#F5DEB3', '#FFEFD5', '#FFDAB9',
            '#FFE4E1', '#F0FFFF', '#F5FFFA', '#F0FFF0', '#FDF5E6', '#FAEBD7', '#FAF0E6', '#FFF8DC'
        ];
        
        const picker = document.createElement('div');
        picker.className = 'color-picker';
        picker.style.gridTemplateColumns = 'repeat(8, 24px)';
        picker.style.gap = '3px';
        picker.style.padding = '15px';
        picker.style.maxWidth = '220px';
        
        // Add custom color input
        const customColorContainer = document.createElement('div');
        customColorContainer.style.cssText = 'grid-column: 1 / -1; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;';
        
        const customColorInput = document.createElement('input');
        customColorInput.type = 'color';
        customColorInput.style.cssText = 'width: 30px; height: 30px; border: none; border-radius: 4px; cursor: pointer;';
        customColorInput.title = 'Choose custom color';
        
        const customColorLabel = document.createElement('span');
        customColorLabel.textContent = 'Custom Color';
        customColorLabel.style.cssText = 'font-size: 12px; color: #666;';
        
        customColorContainer.appendChild(customColorInput);
        customColorContainer.appendChild(customColorLabel);
        picker.appendChild(customColorContainer);
        
        // Add color options
        colors.forEach(color => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = color;
            colorOption.style.width = '24px';
            colorOption.style.height = '24px';
            colorOption.style.border = color === '#FFFFFF' ? '2px solid #ddd' : '2px solid transparent';
            colorOption.dataset.color = color;
            colorOption.title = color;
            picker.appendChild(colorOption);
        });
        
        const rect = button.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        picker.style.left = (rect.left - containerRect.left) + 'px';
        picker.style.top = (rect.bottom - containerRect.top + 5) + 'px';
        
        // Handle color selection
        const applyColor = (color) => {
            if (range) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            this.editor.focus();
            
            try {
                if (command === 'backColor') {
                    // Use both hiliteColor and backColor for better compatibility
                    document.execCommand('hiliteColor', false, color);
                    if (!document.queryCommandSupported('hiliteColor')) {
                        document.execCommand('backColor', false, color);
                    }
                    // Also apply inline style for better compatibility
                    this.applyInlineColorStyle('background-color', color);
                } else {
                    document.execCommand('foreColor', false, color);
                    // Apply inline style for better compatibility
                    this.applyInlineColorStyle('color', color);
                }
            } catch (error) {
                console.warn('execCommand failed, using inline styles:', error);
                this.applyInlineColorStyle(command === 'backColor' ? 'background-color' : 'color', color);
            }
            
            picker.remove();
        };
        
        picker.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                const color = e.target.dataset.color;
                applyColor(color);
            }
        });
        
        customColorInput.addEventListener('change', (e) => {
            const color = e.target.value;
            applyColor(color);
        });
        
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!picker.contains(e.target) && !button.contains(e.target)) {
                    picker.remove();
                }
            }, { once: true });
        }, 100);
        
        this.container.appendChild(picker);
    }
    
    applyInlineColorStyle(property, color) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        try {
            const span = document.createElement('span');
            span.style[property] = color;
            span.style.setProperty(property, color, 'important');
            
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            // Ensure the color is preserved
            span.setAttribute('style', span.getAttribute('style') + '; ' + property + ': ' + color + ' !important;');
            
            // Clear selection
            selection.removeAllRanges();
        } catch (error) {
            console.error('Failed to apply inline color style:', error);
        }
    }





    updatePlaceholder() {
        this.container.classList.toggle('empty', !this.editor.textContent.trim());
    }

    updateToolbarState() {
        if (this.htmlMode) return;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const fontDropdown = this.toolbar.querySelector('.font-dropdown .dropdown-text');
        const sizeDropdown = this.toolbar.querySelector('.size-dropdown .dropdown-text');
        
        // Update font family
        if (fontDropdown) {
            try {
                const fontName = document.queryCommandValue('fontName');
                if (fontName && fontName !== 'false') {
                    const cleanFont = fontName.replace(/["']/g, '').split(',')[0].trim();
                    if (this.options.fonts.includes(cleanFont)) {
                        fontDropdown.textContent = cleanFont;
                        this.currentFont = cleanFont;
                    }
                }
            } catch (e) {}
        }
        
        // Update font size
        if (sizeDropdown) {
            const range = selection.getRangeAt(0);
            let element = range.commonAncestorContainer;
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            
            if (element && this.editor.contains(element)) {
                const computedStyle = window.getComputedStyle(element);
                const fontSize = parseInt(computedStyle.fontSize);
                if (fontSize >= 8 && fontSize <= 96) {
                    sizeDropdown.textContent = fontSize.toString();
                    this.currentFontSize = fontSize.toString();
                }
            }
        }
        
        this.updateButtonStates();
    }

    updateButtonStates() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
        commands.forEach(command => {
            const btn = this.toolbar.querySelector(`[title*="${command.charAt(0).toUpperCase() + command.slice(1)}"]`);
            if (btn) {
                if (document.queryCommandState(command)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    isElementBold(element) {
        const style = window.getComputedStyle(element);
        return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
    }

    isElementItalic(element) {
        const style = window.getComputedStyle(element);
        return style.fontStyle === 'italic';
    }

    isElementUnderlined(element) {
        const style = window.getComputedStyle(element);
        return style.textDecoration.includes('underline');
    }

    updateWordCount() {
        if (!this.options.wordCount || !this.wordCountDisplay) return;
        
        const documentText = new DOMParser().parseFromString(this.getContent().replace(/>\s+</g, '><'), 'text/html');
        documentText.querySelectorAll('script,style,template').forEach(node => node.remove());
        documentText.querySelectorAll('p,div,li,tr,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre,br').forEach(node => node.appendChild(documentText.createTextNode(' ')));
        const text = (documentText.body.textContent || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;
        
        this.wordCount = words;
        this.characterCount = characters;
        
        this.wordCountDisplay.textContent = `Words: ${words} | Characters: ${characters} (${charactersNoSpaces} without spaces)`;
    }

    showWordCountDialog() {
        const documentText = new DOMParser().parseFromString(this.getContent().replace(/>\s+</g, '><'), 'text/html');
        documentText.querySelectorAll('script,style,template').forEach(node => node.remove());
        documentText.querySelectorAll('p,div,li,tr,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre,br').forEach(node => node.appendChild(documentText.createTextNode(' ')));
        const text = (documentText.body.textContent || '').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;
        const paragraphs = this.editor.querySelectorAll('p').length || (text.trim() ? 1 : 0);
        const lines = text.split('\n').length;
        
        const dialog = document.createElement('div');
        dialog.className = 'word-count-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Document Statistics</h3>
                <table>
                    <tr><td>Words:</td><td>${words}</td></tr>
                    <tr><td>Characters (with spaces):</td><td>${characters}</td></tr>
                    <tr><td>Characters (without spaces):</td><td>${charactersNoSpaces}</td></tr>
                    <tr><td>Paragraphs:</td><td>${paragraphs}</td></tr>
                    <tr><td>Lines:</td><td>${lines}</td></tr>
                </table>
                <button class="close-dialog">Close</button>
            </div>
        `;
        
        dialog.querySelector('.close-dialog').onclick = () => dialog.remove();
        document.body.appendChild(dialog);
        
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!dialog.querySelector('.dialog-content').contains(e.target)) {
                    dialog.remove();
                }
            }, { once: true });
        }, 100);
    }

    toggleSpellCheck() {
        this.options.spellCheck = !this.options.spellCheck;
        this.editor.setAttribute('spellcheck', this.options.spellCheck.toString());
        
        const btn = this.toolbar.querySelector('[title="Toggle Spell Check"]');
        if (btn) {
            btn.classList.toggle('active', this.options.spellCheck);
        }
    }

    autoSave() {
        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            const content = this.getContent();
            localStorage.setItem('xoditor_autoSave', content);
            console.log('Content auto-saved');
        }, 2000);
    }

    getContent() {
        return this.editor.innerHTML;
    }

    setContent(html) {
        try {
            const sanitizedHtml = this.sanitizeHtml(html || '');
            this.editor.innerHTML = sanitizedHtml;
            this.updatePlaceholder();
            this.lastContent = sanitizedHtml;
            setTimeout(() => {
                this.fixTableSizes();
                this.preserveColors();
                this.ensureFontConsistency();
                this.updateToolbarState();
            }, 100);
        } catch (error) {
            console.error('Set content error:', error);
            this.editor.innerHTML = '';
            this.updatePlaceholder();
        }
    }
    
    ensureParagraphStart() {
        // Ensure content starts with a paragraph tag
        if (this.editor.innerHTML.trim() === '' || this.editor.innerHTML === '<br>') {
            return; // Let placeholder handle empty state
        }
        
        const firstChild = this.editor.firstChild;
        if (!firstChild) return;
        
        // If first child is text node, wrap it in a paragraph
        if (firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent.trim()) {
            const p = document.createElement('p');
            
            // Move the text node into the paragraph
            const textContent = firstChild.textContent;
            firstChild.remove();
            p.textContent = textContent;
            
            this.editor.insertBefore(p, this.editor.firstChild);
            
            // Set cursor at end of paragraph
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(p, p.childNodes.length);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        // If first child is not a block element, wrap it
        else if (firstChild.nodeType === Node.ELEMENT_NODE && 
                !this.isBlockElement(firstChild) && 
                firstChild.textContent.trim()) {
            const p = document.createElement('p');
            
            // Move the element into the paragraph
            const element = firstChild;
            element.remove();
            p.appendChild(element);
            
            this.editor.insertBefore(p, this.editor.firstChild);
        }
    }
    
    isBlockElement(element) {
        const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'TR', 'TD', 'TH'];
        return blockElements.includes(element.tagName);
    }
    
    handleEditorKeydown(e) {
        // Handle Enter key to create new paragraphs
        if (e.key === 'Enter' && !e.shiftKey) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let currentElement = range.commonAncestorContainer;
                
                if (currentElement.nodeType === Node.TEXT_NODE) {
                    currentElement = currentElement.parentElement;
                }
                
                // If we're not in a paragraph, create one
                if (!currentElement.closest('p') && this.editor.contains(currentElement)) {
                    e.preventDefault();
                    
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    
                    // Insert the paragraph
                    if (range.endContainer === this.editor) {
                        this.editor.appendChild(p);
                    } else {
                        range.insertNode(p);
                    }
                    
                    // Set cursor in the new paragraph
                    const newRange = document.createRange();
                    newRange.setStart(p, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }
    }
    
    ensureFontConsistency() {
        // Remove any data attributes that may have been added
        const elementsWithData = this.editor.querySelectorAll('[data-font-family], [data-font-size]');
        elementsWithData.forEach(el => {
            el.removeAttribute('data-font-family');
            el.removeAttribute('data-font-size');
        });
    }
    
    preserveColors() {
        // Ensure all color attributes and styles are properly applied
        const elementsWithColors = this.editor.querySelectorAll('[color], [bgcolor], [style*="color"], [style*="background"]');
        
        elementsWithColors.forEach(el => {
            // Handle color attribute
            if (el.hasAttribute('color')) {
                const color = el.getAttribute('color');
                el.style.setProperty('color', color, 'important');
            }
            
            // Handle bgcolor attribute
            if (el.hasAttribute('bgcolor')) {
                const bgcolor = el.getAttribute('bgcolor');
                el.style.setProperty('background-color', bgcolor, 'important');
            }
            
            // Ensure style colors have !important
            if (el.hasAttribute('style')) {
                const style = el.getAttribute('style');
                let newStyle = style;
                
                // Add !important to color properties if not present
                if (style.includes('color:') && !style.includes('color:') + '.*!important') {
                    newStyle = newStyle.replace(/(color:\s*[^;]+)(?!.*!important)/gi, '$1 !important');
                }
                if (style.includes('background-color:') && !style.includes('background-color:') + '.*!important') {
                    newStyle = newStyle.replace(/(background-color:\s*[^;]+)(?!.*!important)/gi, '$1 !important');
                }
                if (style.includes('background:') && !style.includes('background:') + '.*!important') {
                    newStyle = newStyle.replace(/(background:\s*[^;]+)(?!.*!important)/gi, '$1 !important');
                }
                
                if (newStyle !== style) {
                    el.setAttribute('style', newStyle);
                }
            }
        });
    }

    fixTableSizes() {
        const tables = this.editor.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.classList.contains('word-table')) {
                table.classList.add('word-table');
            }
            table.style.cssText = 'border-collapse: collapse !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; border: 1px solid #000 !important;';

            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.style.border = '1px solid #000';
                cell.style.padding = '4px 8px';
                cell.style.minHeight = '20px';
                cell.style.verticalAlign = 'top';
                cell.style.wordWrap = 'break-word';
                cell.style.overflowWrap = 'break-word';
                cell.contentEditable = 'true';
            });
        });
        
        this.enhanceWordTables();
    }

    validateUrl(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            if (['http:', 'https:'].includes(urlObj.protocol)) {
                return urlObj.href;
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    validateImageUrl(url) {
        const validUrl = this.validateUrl(url);
        if (validUrl) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
            const hasValidExtension = imageExtensions.some(ext => 
                validUrl.toLowerCase().includes(ext)
            );
            return hasValidExtension ? validUrl : null;
        }
        return null;
    }

    sanitizeHtml(html) {
        if (!html) return '';
        
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
            dangerousAttrs.forEach(attr => {
                if (el.hasAttribute(attr)) {
                    el.removeAttribute(attr);
                }
            });
            
            ['href', 'src'].forEach(attr => {
                if (el.hasAttribute(attr)) {
                    const value = el.getAttribute(attr);
                    if (value && (value.toLowerCase().startsWith('javascript:') || value.toLowerCase().startsWith('data:'))) {
                        el.removeAttribute(attr);
                    }
                }
            });
            
            // Preserve color-related attributes and styles
            const colorAttrs = ['color', 'bgcolor', 'style'];
            colorAttrs.forEach(attr => {
                if (el.hasAttribute(attr)) {
                    const value = el.getAttribute(attr);
                    if (attr === 'style' && value) {
                        // Ensure color styles are preserved with !important
                        let style = value;
                        if (style.includes('color:') && !style.includes('!important')) {
                            style = style.replace(/(color:\s*[^;]+)/gi, '$1 !important');
                        }
                        if (style.includes('background-color:') && !style.includes('!important')) {
                            style = style.replace(/(background-color:\s*[^;]+)/gi, '$1 !important');
                        }
                        if (style.includes('background:') && !style.includes('!important')) {
                            style = style.replace(/(background:\s*[^;]+)/gi, '$1 !important');
                        }
                        el.setAttribute('style', style);
                    }
                }
            });
        });
        
        return temp.innerHTML;
    }

    handleHTMLInput(e) {
        // Simple HTML mode - no syntax highlighting to avoid escaping issues
        // Content is handled as plain text
    }
    
    handleHTMLKeydown(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '  ');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const currentLine = range.startContainer.closest('.html-line');
                const lineText = currentLine ? currentLine.textContent : '';
                const indent = lineText.match(/^(\s*)/)?.[1] || '';
                
                const newLine = document.createElement('div');
                newLine.className = 'html-line';
                newLine.innerHTML = indent + '&nbsp;';
                
                if (currentLine) {
                    currentLine.parentNode.insertBefore(newLine, currentLine.nextSibling);
                } else {
                    this.editor.appendChild(newLine);
                }
                
                const newRange = document.createRange();
                newRange.setStart(newLine, newLine.childNodes.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }
    
    getCursorPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return 0;
        
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this.editor);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }
    
    setCursorPosition(position) {
        const walker = document.createTreeWalker(
            this.editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentPos = 0;
        let node;
        
        while (node = walker.nextNode()) {
            const nodeLength = node.textContent.length;
            if (currentPos + nodeLength >= position) {
                const range = document.createRange();
                range.setStart(node, position - currentPos);
                range.collapse(true);
                
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                break;
            }
            currentPos += nodeLength;
        }
    }
    
    formatCode() {
        if (this.htmlMode) {
            const htmlContent = this.getPlainHTMLContent();
            const formattedHTML = this.formatHTML(htmlContent);
            this.editor.innerHTML = this.highlightHTML(formattedHTML);
        }
    }
    
    setupFontChangeDetection() {
        // Detect font changes when user types
        this.editor.addEventListener('input', () => {
            if (this.fontDetectionTimeout) {
                clearTimeout(this.fontDetectionTimeout);
            }
            this.fontDetectionTimeout = setTimeout(() => {
                this.detectCurrentFont();
            }, 200);
        });
    }
    
    detectCurrentFont() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        let element = range.commonAncestorContainer;
        
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        if (element && this.editor.contains(element)) {
            const fontFamily = this.getEffectiveFontFamily(element);
            const fontSize = this.getEffectiveFontSize(element);
            
            // Update dropdowns if font has changed
            const fontDropdown = this.toolbar.querySelector('.font-dropdown .dropdown-text');
            const sizeDropdown = this.toolbar.querySelector('.size-dropdown .dropdown-text');
            
            if (fontDropdown && fontFamily && fontFamily !== fontDropdown.textContent) {
                fontDropdown.textContent = fontFamily;
                this.currentFont = fontFamily;
            }
            
            if (sizeDropdown && fontSize && fontSize.toString() !== sizeDropdown.textContent) {
                sizeDropdown.textContent = fontSize.toString();
                this.currentFontSize = fontSize.toString();
            }
        }
    }
    
    destroy() {
        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        if (this.htmlHighlightTimeout) clearTimeout(this.htmlHighlightTimeout);
        if (this.toolbarUpdateTimeout) clearTimeout(this.toolbarUpdateTimeout);
        if (this.selectionUpdateTimeout) clearTimeout(this.selectionUpdateTimeout);
        if (this.fontUpdateTimeout) clearTimeout(this.fontUpdateTimeout);
        if (this.fontDetectionTimeout) clearTimeout(this.fontDetectionTimeout);
        
        document.querySelectorAll('.find-replace-dialog, .table-dialog, .word-count-dialog, .custom-link-dialog, .custom-image-dialog').forEach(dialog => {
            dialog.remove();
        });
        
        if (this.fullscreenMode) {
            this.exitFullscreen();
        }
        
        this.container.remove();
    }
}


document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-xoditor]').forEach(el => {
        try {
            new Xoditor(el);
        } catch (error) {
            console.error('Failed to initialize Xoditor:', error);
        }
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Xoditor;
    module.exports.Xoditor = Xoditor;
}
if (typeof window !== 'undefined') {
    window.Xoditor = Xoditor;
}
