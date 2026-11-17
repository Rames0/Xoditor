const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const engines = require('playwright');

function resolveChromiumExecutable() {
    if (process.env.TEST_CHROMIUM_EXECUTABLE) return process.env.TEST_CHROMIUM_EXECUTABLE;
    const candidates = ['/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return undefined;
}

(async () => {
    const engine = process.env.TEST_BROWSER || 'chromium';
    const chromiumExec = resolveChromiumExecutable();
    const browser = await engines[engine].launch({headless:true,...(engine==='chromium'&&chromiumExec?{executablePath:chromiumExec}:{})});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<form><textarea id="first"></textarea><textarea id="second"></textarea><button id="save">Save</button></form>');
    const root = path.resolve(__dirname, '..');
    if (!process.env.TEST_EDITOR_DIST) {
        await page.addStyleTag({path:path.join(root,'vendor/codemirror.css')});
        await page.addScriptTag({path:path.join(root,'vendor/codemirror.min.js')});
        await page.addScriptTag({path:path.join(root,'vendor/prettier-html.min.js')});
    }
    if (process.env.TEST_EDITOR_DIST) {
        await page.addStyleTag({path:path.join(root, 'dist/xoditor.min.css')});
    } else {
        await page.addStyleTag({path:path.join(root, 'src/xoditor.css')});
        await page.addStyleTag({path:path.join(root, 'src/xoditor-enhancements.css')});
    }
    if (process.env.TEST_EDITOR_DIST) {
        await page.addScriptTag({path:path.join(root, 'dist/xoditor.min.js')});
    } else {
        await page.addScriptTag({path:path.join(root, 'src/xoditor.js')});
        await page.addScriptTag({path:path.join(root, 'src/xoditor-enhancements.js')});
    }
    await page.evaluate(() => {
        window.pasteEvent = options => {const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:options.clipboardData});return event;};
        window.changes = 0; window.submits = 0;
        document.querySelector('form').onsubmit = event => {event.preventDefault(); window.submits++;};
        window.editor = new Xoditor('#first', {ribbon:false,autoSave:false,autoFormatSource:false,defaultFont:'Kalimati',onChange:()=>window.changes++});
        window.other = new Xoditor('#second', {autoSave:false});
    });
    async function check(label, callback) { await callback(); console.log('PASS ' + label); }

    await check('Undo and redo restore a live caret beside the edited text', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<p>First</p><p>Second</p>');
            const p = editor.editor.lastElementChild;
            p.firstChild.appendData(' typed');editor.changed();
            const range=document.createRange();range.selectNodeContents(p);range.collapse(false);
            getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();
            editor.performUndo();
            const undo={text:getSelection().anchorNode.textContent,offset:getSelection().anchorOffset};
            editor.performRedo();
            return {undo,redo:{text:getSelection().anchorNode.textContent,offset:getSelection().anchorOffset}};
        });
        assert.deepEqual(result.undo,{text:'Second',offset:6});
        assert.deepEqual(result.redo,{text:'Second typed',offset:12});
    });

    await check('Reducing font size on an empty line removes oversized caret metrics', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<p style="font-size:48px;line-height:72px"><span style="font-size:48px"><br></span></p>');
            editor.placeCaret(editor.editor.querySelector('span'));
            editor.applyTextStyle('font-size', '12px');
            const block = editor.editor.querySelector('p');
            return {size:getComputedStyle(block).fontSize, height:getComputedStyle(block).lineHeight, inline:getComputedStyle(block.querySelector('span')).fontSize};
        });
        assert.equal(result.size, '12px');assert.equal(result.height, '18px');assert.equal(result.inline, '12px');
    });

    await check('Row and column selections style every selected cell without changing neighbors', async () => {
        for (const axis of ['row', 'column']) {
            const result = await page.evaluate(axis => {
                editor.setContent('<table><tr><td><span style="font-family:serif;font-size:12px">A</span></td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>');
                const table = editor.editor.querySelector('table');
                editor.selectCell(table.rows[0].cells[0], false);
                editor.selectCell(axis === 'row' ? table.rows[0].cells[1] : table.rows[1].cells[0], true);
                editor.applyTextStyle('font-family', 'monospace');
                editor.applyTextStyle('font-size', '24px');
                editor.execCommand('bold');
                return Array.from(table.querySelectorAll('td')).map(cell => {
                    const node = cell.querySelector('span,b,strong') || cell;
                    const style = getComputedStyle(node);
                    return {text:cell.textContent, size:style.fontSize, font:style.fontFamily, weight:style.fontWeight};
                });
            }, axis);
            const selected = axis === 'row' ? [0, 1] : [0, 2];
            result.forEach((cell, index) => {
                assert.equal(cell.text, 'ABCD'[index]);
                if (selected.includes(index)) {
                    assert.equal(cell.size, '24px'); assert.match(cell.font, /monospace/);
                    assert(Number(cell.weight) >= 700);
                } else { assert.notEqual(cell.size, '24px'); assert(Number(cell.weight) < 700); }
            });
        }
    });

    await check('Template and safe image round-trip; executable HTML filtered', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<div id="layout" style="padding-left:50px"><p id="subject">रमेश</p><img src="data:image/bmp;base64,Qk0="></div><style>body{color:red}p{margin:0}</style><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)">');
            return {html:editor.getContent(), outside:getComputedStyle(document.body).color};
        });
        assert.match(result.html,/id="layout"/); assert.match(result.html,/data:image\/bmp/); assert.match(result.html,/<style>/);
        assert.doesNotMatch(result.html,/javascript:|onerror|<script/); assert.notEqual(result.outside,'rgb(255, 0, 0)');
    });

    await check('Repeated font changes retain selection and avoid nested wrappers', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<p><strong id="subject">रमेश Test</strong></p>');
            const node=editor.editor.querySelector('strong').firstChild;
            const range=document.createRange();range.selectNodeContents(node); const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();
            editor.applyTextStyle('font-size','24px');editor.applyTextStyle('font-size','32px');editor.applyTextStyle('font-size','20px');
            return {html:editor.getContent(),size:getComputedStyle(editor.editor.querySelector('span')).fontSize,text:editor.editor.textContent};
        });
        assert.equal(result.size,'20px');assert.equal(result.text,'रमेश Test');assert.doesNotMatch(result.html,/<span[^>]*>\s*<span/);
    });

    await check('Word paste retains fonts, tables and numbered lists while cleaning Office markup', async () => {
        const html=await page.evaluate(() => {
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));
            const source='<p class="MsoNormal" style="font-family:Kalimati;font-size:18pt;color:blue">नेपाली Word</p><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1. </span>First item</p><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2. </span>Second item</p><table><tr><td>A</td><td>B</td></tr></table>';
            const data=new DataTransfer();data.setData('text/html',source);
            editor.editor.dispatchEvent(window.pasteEvent({clipboardData:data,bubbles:true,cancelable:true}));return editor.getContent();
        });
        assert.match(html,/नेपाली Word/); assert.match(html,/18pt/); assert.match(html,/<table/);assert.match(html,/<ol/); assert.doesNotMatch(html,/MsoNormal|mso-list/);
    });

    await check('Actual typing and toolbar font selection notify the host and keep the selection', async () => {
        await page.evaluate(() => {editor.setContent('<p>रमेश</p>');editor.placeCaret(editor.editor.querySelector('p'));});
        await page.locator('#xoditor-1 .editor-content').press('End');
        await page.keyboard.type(' typed');
        assert.match(await page.evaluate(()=>editor.getContent()),/typed/);
        await page.evaluate(() => {
            const range=document.createRange();range.selectNodeContents(editor.editor.querySelector('p'));
            const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();
        });
        await page.locator('#xoditor-1 .size-dropdown .word-dropdown-btn').click({position:{x:76,y:17}});
        await page.locator('#xoditor-1 .size-item[data-size="24"]').click();
        assert(await page.evaluate(()=>Array.from(editor.editor.querySelectorAll('span')).some(span=>span.style.fontSize==='24px')));
        assert.equal(await page.evaluate(()=>submits),0);
    });

    await check('Raster image uploads remain in saved HTML; image corner dragging keeps proportions', async () => {
        await page.evaluate(async () => {
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));
            const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;canvas.getContext('2d').fillRect(0,0,80,40);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve));await editor.insertImageFile(new File([blob],'image.png',{type:'image/png'}));
        });
        const image=page.locator('#xoditor-1 .editor-content img');await image.evaluate(img=>img.decode());
        const box=await image.boundingBox();
        await page.mouse.move(box.x+box.width-2,box.y+box.height-2);await page.mouse.down();await page.mouse.move(box.x+box.width+35,box.y+box.height+15);await page.mouse.up();
        const resized=await image.boundingBox();assert(resized.width>box.width);assert(Math.abs(resized.width/resized.height-2)<0.05);
        assert.match(await page.evaluate(()=>editor.getContent()),/data:image\/png;base64/);
    });

    await check('Word clipboard image files replace local image references', async () => {
        const html=await page.evaluate(async () => {
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));
            const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;
            const blob=await new Promise(resolve=>canvas.toBlob(resolve));
            const data=new DataTransfer();data.setData('text/html','<p class="MsoNormal">Word image<img src="file:///clipboard/image.png"></p>');data.items.add(new File([blob],'word.png',{type:'image/png'}));
            await editor.pasteContent(window.pasteEvent({clipboardData:data,cancelable:true}));return editor.getContent();
        });
        assert.match(html,/data:image\/png;base64/);assert.doesNotMatch(html,/file:\/\/\//);
    });

    await check('Pasting removes source editor UI styles and preserves document formatting',async()=>{
        const result=await page.evaluate(async()=>{editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));await editor.pasteContent(window.pasteEvent({clipboardData:{getData:type=>type==='text/html'?'<table id="land" class="table se-figure-selected" style="width:100%;scrollbar-width:none!important;caret-color:red"><tbody><tr><td rowspan="2" style="padding:8px;border:1px solid black;scroll-margin:54px"><span style="font-family:Kalimati;font-size:18px;overflow:visible;scroll-margin:48px">जग्गा&nbsp;</span></td></tr><tr></tr></tbody></table>':'',files:[]}}));return editor.getContent();});
        assert.doesNotMatch(result,/scrollbar|scroll-margin|caret-color|se-figure-selected|overflow: visible/);assert.match(result,/Kalimati/);assert.match(result,/18px/);assert.match(result,/rowspan="2"/);assert.match(result,/padding: 8px/);assert.match(result,/जग्गा/);
    });

    await check('Imported table borders render without changing document markup', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<table class="word-table table-bordered"><tr><td>A</td><td style="border:0">B</td></tr></table><table class="word-table" border="1"><tr><td>C</td></tr></table><table><tr><td style="border:3px dashed red">D</td></tr></table><table border="0"><tr><td>E</td></tr></table>');
            editor.updateTableGuides();
            const cells = Array.from(editor.editor.querySelectorAll('td'));
            return {styles: cells.map(cell => ({style: getComputedStyle(cell).borderTopStyle, width: getComputedStyle(cell).borderTopWidth, guide: cell.hasAttribute('data-editor-table-guide')})), html: editor.getContent()};
        });
        assert.equal(result.styles[0].style, 'solid'); assert.equal(result.styles[0].width, '1px'); assert.equal(result.styles[0].guide, false);
        assert.equal(result.styles[1].width, '0px'); assert.equal(result.styles[1].guide, true);
        assert.equal(result.styles[2].style, 'solid'); assert.equal(result.styles[2].width, '1px');
        assert.equal(result.styles[3].style, 'dashed'); assert.equal(result.styles[3].width, '3px');
        assert.equal(result.styles[4].guide, true);
        assert.match(result.html, /table-bordered/); assert.match(result.html, /border="1"/); assert.doesNotMatch(result.html, /data-editor-table-guide/);
    });

    await check('New tables use plain borderless markup with equal cell widths',async()=>{
        const result=await page.evaluate(()=>{editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));editor.createTableFromGrid(3,5);const table=editor.editor.querySelector('table');return {rows:table.rows.length,cells:table.querySelectorAll('td').length,group:table.querySelectorAll('colgroup').length,className:table.className,widths:Array.from(table.querySelectorAll('td'),cell=>cell.style.width),borders:Array.from(table.querySelectorAll('td'),cell=>cell.style.border)};});
        assert.equal(result.rows,3);assert.equal(result.cells,15);assert.equal(result.group,0);assert.equal(result.className,'');assert(result.widths.every(width=>width==='20%'));assert(result.borders.every(border=>border===''));
    });

    await check('Inserted table stays inside the layout div; row/column and merge/split controls work', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<div id="layout" style="padding-left:50px"><p>before after</p></div>');
            const node=editor.editor.querySelector('p').firstChild;const range=document.createRange();range.setStart(node,7);range.collapse(true);editor.savedRange=range;
            editor.createTableFromGrid(2,3);
            const table=editor.editor.querySelector('table'); const parent=table.parentElement.id;
            editor.editTable('rowBelow');editor.editTable('columnRight');
            const rows=table.rows.length,columns=table.rows[0].cells.length;
            editor.editTable('noBorders');const noBorder=getComputedStyle(table.rows[0].cells[0]).borderTopWidth;
            editor.editTable('borders');
            editor.selectCell(table.rows[0].cells[0],false);editor.selectCell(table.rows[0].cells[1],true);editor.editTable('merge');const merged=table.rows[0].cells[0].colSpan;
            editor.editTable('split');
            return {parent,rows,columns,noBorder,merged,split:table.rows[0].cells.length,html:editor.getContent()};
        });
        assert.equal(result.parent,'layout');assert.equal(result.rows,3);assert.equal(result.columns,4);assert.equal(result.merged,2);assert.equal(result.split,4);assert.equal(result.noBorder,'0px');assert.doesNotMatch(result.html,/class="selected-cell"/);
    });

    await check('New table rows, columns and split cells inherit their neighbouring cell style', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<table><tbody><tr><td id="keep" class="invoice selected-cell" data-kind="amount" style="border:3px dashed rgb(1, 2, 3);padding:9px;background-color:rgb(240, 230, 220);vertical-align:bottom;text-align:right"><span style="font-family:Times New Roman;font-size:22px;color:rgb(12, 34, 56);font-weight:bold">A</span></td><td>B</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table'),first=table.rows[0].cells[0];editor.selectCell(first,false);
            editor.editTable('rowBelow');const rowCell=table.rows[1].cells[0];
            editor.selectCell(first,false);editor.editTable('columnRight');const columnCell=table.rows[0].cells[1];
            editor.selectCell(first,false);first.colSpan=2;editor.editTable('split');const splitCell=table.rows[0].cells[1];
            const summary=item=>{const typing=item.querySelector('span');return {id:item.id,classes:item.className,kind:item.dataset.kind,border:item.style.border,padding:item.style.padding,background:item.style.backgroundColor,vertical:item.style.verticalAlign,align:item.style.textAlign,font:typing?.style.fontFamily,size:typing?.style.fontSize,color:typing?.style.color,weight:typing?.style.fontWeight,text:item.textContent};};
            return {row:summary(rowCell),column:summary(columnCell),split:summary(splitCell),html:editor.getContent()};
        });
        for(const cell of [result.row,result.column,result.split]) {assert.equal(cell.id,'');assert.equal(cell.classes,'invoice');assert.equal(cell.kind,'amount');assert.match(cell.border,/3px dashed/);assert.equal(cell.padding,'9px');assert.match(cell.background,/240/);assert.equal(cell.vertical,'bottom');assert.equal(cell.align,'right');assert.match(cell.font,/Times New Roman/);assert.equal(cell.size,'22px');assert.match(cell.color,/12/);assert.equal(cell.weight,'bold');assert.equal(cell.text,'');}
        assert.doesNotMatch(result.html,/selected-cell/);assert.doesNotMatch(result.html,/id="keep"[^>]*><br/);
    });

    await check('Default table cells have no inline styles and cell spans never inherit cell borders or padding', async () => {
        const result = await page.evaluate(() => {
            editor.setContent('<p>test</p>');
            const p = editor.editor.querySelector('p');
            const range = document.createRange();
            range.selectNodeContents(p);
            range.collapse(false);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
            editor.rememberSelection();
            editor.createTableFromGrid(2, 2);
            const table = editor.editor.querySelector('table');
            const cells = Array.from(table.querySelectorAll('td'));
            const inlineStyles = cells.map(c => c.getAttribute('style') || '');
            
            // Clean contaminated inner span having cell border/padding/overflow-wrap
            editor.setContent('<table><tbody><tr><td style="border:1px solid black;padding:4px"><span style="border:1px solid black;padding:4px;overflow-wrap:anywhere;font-family:Times New Roman;">sample</span></td></tr></tbody></table>');
            const cleanHtml = editor.getContent();
            const cleanSpan = editor.editor.querySelector('td span');
            const spanBorder = cleanSpan.style.border;
            const spanPadding = cleanSpan.style.padding;
            const spanFont = cleanSpan.style.fontFamily;
            
            return {
                inlineStyles,
                cleanHtml,
                spanBorder,
                spanPadding,
                spanFont
            };
        });
        assert.deepEqual(result.inlineStyles, ['width: 50%;', 'width: 50%;', 'width: 50%;', 'width: 50%;']);
        assert.equal(result.spanBorder, '');
        assert.equal(result.spanPadding, '');
        assert.match(result.spanFont, /Times New Roman/);
        assert.doesNotMatch(result.cleanHtml, /<span[^>]*style="[^"]*(?:border|padding|overflow-wrap)[^"]*"/);
    });

    await check('Select-all text styling never places spans in table structure', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Before</p><table><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tbody><tr><td>One</td><td>Two</td></tr></tbody></table><p>After</p>');
            const table=editor.editor.querySelector('table'),space=()=>{const span=document.createElement('span');span.style.fontFamily='Times New Roman';span.textContent=' ';return span;};
            table.insertBefore(space(),table.firstChild);table.querySelector('colgroup').insertBefore(space(),table.querySelector('colgroup').firstChild);table.querySelector('tbody').insertBefore(space(),table.querySelector('tbody').firstChild);table.querySelector('tr').insertBefore(space(),table.querySelector('tr').firstChild);
            const range=document.createRange();range.selectNodeContents(editor.editor);getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();editor.applyTextStyle('font-family','Times New Roman');
            const invalid=table.querySelectorAll(':scope > span,colgroup > span,tbody > span,tr > span').length;
            return {invalid,one:table.rows[0].cells[0].innerHTML,two:table.rows[0].cells[1].innerHTML,html:editor.getContent()};
        });
        assert.equal(result.invalid,0);assert.match(result.one,/font-family/);assert.match(result.two,/font-family/);assert.doesNotMatch(result.html,/<(?:table|colgroup|tbody|tr)[^>]*>\s*<span/);
    });

    await check('Enter in a table cell inserts a line break without a paragraph', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tbody><tr><td>First</td></tr></tbody></table>');const node=editor.editor.querySelector('td').firstChild;const range=document.createRange();range.setStart(node,node.length);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();});
        await page.keyboard.press('Enter');await page.keyboard.type('Second');
        const cell=page.locator('#xoditor-1 .editor-content td');
        assert.equal(await cell.locator('p,div').count(),0);assert.equal(await cell.textContent(),'FirstSecond');assert(await cell.locator('br').count()>=1);
        await page.evaluate(()=>editor.performUndo());assert.equal(await cell.textContent(),'First');
    });

    await check('Backspace immediately after Enter removes both table line breaks', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tbody><tr><td>Text</td></tr></tbody></table>');const node=editor.editor.querySelector('td').firstChild;const range=document.createRange();range.setStart(node,node.length);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);});
        await page.keyboard.press('Enter');
        const saved=await page.evaluate(()=>editor.getContent());assert.equal((saved.match(/<br\s*\/?\s*>/g)||[]).length,1);
        await page.keyboard.press('Backspace');
        const cell=page.locator('#xoditor-1 .editor-content td');assert.equal(await cell.innerHTML(),'Text');
        assert.doesNotMatch(await page.evaluate(()=>editor.getContent()),/data-editor-line-placeholder/);
    });

    await check('Deleting the final character on a trailing cell line removes its break',async()=>{
        await page.evaluate(()=>{editor.setContent('<table><tr><td>asdfasdf<br>X</td></tr></table>');const node=editor.editor.querySelector('td').lastChild;const range=document.createRange();range.setStart(node,1);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);});
        await page.keyboard.press('Backspace');
        assert.equal(await page.locator('#xoditor-1 .editor-content td').innerHTML(),'asdfasdf');
    });

    await check('Backspace removes a table line break after deleting newly typed text', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tbody><tr><td>Text</td></tr></tbody></table>');const node=editor.editor.querySelector('td').firstChild;const range=document.createRange();range.setStart(node,node.length);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);});
        await page.keyboard.press('Enter');await page.keyboard.type('XY');await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');
        const cell=page.locator('#xoditor-1 .editor-content td');assert.equal(await cell.textContent(),'Text');assert.doesNotMatch(await page.evaluate(()=>editor.getContent()),/<br/);
    });

    await check('Typing and Enter after a table create paragraphs and preserve Undo', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tbody><tr><td>Cell</td></tr></tbody></table>');editor.editor.focus();const range=document.createRange();range.setStartAfter(editor.editor.querySelector('table'));range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();});
        await page.keyboard.type('After table');await page.keyboard.press('Enter');await page.keyboard.type('Next line');
        const result=await page.evaluate(()=>({html:editor.getContent(),paragraphs:Array.from(editor.editor.children).filter(node=>node.tagName==='P').map(node=>node.textContent),cell:editor.editor.querySelector('td').textContent,bare:Array.from(editor.editor.childNodes).filter(node=>node.nodeType===3&&node.textContent.trim()).length}));
        assert.deepEqual(result.paragraphs,['After table','Next line']);assert.equal(result.cell,'Cell');assert.equal(result.bare,0);assert.doesNotMatch(result.html,/<div>/);
        await page.evaluate(()=>{const html=editor.getContent();editor.setContent(html);});assert.equal(await page.locator('#xoditor-1 .editor-content > p').count(),2);
    });

    await check('Existing bare text after a table is wrapped without moving the caret', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tr><td>Keep</td></tr></table>Tail');const text=editor.editor.lastChild;const range=document.createRange();range.setStart(text,2);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);});
        await page.keyboard.type('X');await page.keyboard.press('Enter');await page.keyboard.type('Y');
        const result=await page.evaluate(()=>({paragraphs:Array.from(editor.editor.querySelectorAll(':scope > p')).map(node=>node.textContent),cell:editor.editor.querySelector('td').textContent}));
        assert.deepEqual(result.paragraphs,['TaX','Yil']);assert.equal(result.cell,'Keep');
    });

    await check('Table row and whole-table height drag persist and undo', async () => {
        await page.evaluate(()=>editor.setContent('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'));
        const table=page.locator('#xoditor-1 .editor-content table');
        const before=await table.boundingBox();
        const cell=await table.locator('tr').last().locator('td').first().boundingBox();
        await page.mouse.move(cell.x+cell.width/2,cell.y+cell.height-2);await page.mouse.down();await page.mouse.move(cell.x+cell.width/2,cell.y+cell.height+48);await page.mouse.up();
        const after=await table.boundingBox();assert(after.height>before.height+40);
        const result=await page.evaluate(()=>{const html=editor.getContent();editor.setContent(html);return {html,height:editor.editor.querySelector('table').getBoundingClientRect().height};});
        assert.match(result.html,/height:/);assert(Math.abs(result.height-after.height)<3);
        const row=await table.locator('tr').first().locator('td').first().boundingBox();
        await page.mouse.move(row.x+row.width/2,row.y+row.height-2);await page.mouse.down();await page.mouse.move(row.x+row.width/2,row.y+row.height+28);await page.mouse.up();
        assert((await table.boundingBox()).height>result.height+20);
        await page.evaluate(()=>editor.performUndo());assert(Math.abs((await table.boundingBox()).height-result.height)<3);
    });

    await check('Table grid limits dimensions and rowSpan zero resolves to its real bottom row', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<table><tbody><tr><td rowspan="0">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table'),cell=table.rows[0].cells[0],rect=cell.getBoundingClientRect();
            const target=editor.resizeTarget({target:cell,clientX:rect.left+4,clientY:rect.bottom-1});
            editor.setContent('<p>Grid</p>');editor.placeCaret(editor.editor.querySelector('p'));editor.createTableFromGrid(0,99);
            const grid=editor.editor.querySelector('table');
            return {targetRow:target.row.rowIndex,rows:grid.rows.length,columns:grid.rows[0].cells.length};
        });
        assert.equal(result.targetRow,2);assert.equal(result.rows,1);assert.equal(result.columns,10);
    });

    await check('Table column drag and whole-table drag', async () => {
        await page.evaluate(() => {editor.setContent('<table style="width:90%"><tbody><tr><td>A</td><td>B</td><td>C</td></tr></tbody></table>');});
        const first=page.locator('#xoditor-1 .editor-content td').first();
        const box=await first.boundingBox();
        await page.mouse.move(box.x+box.width-2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width+25,box.y+box.height/2);await page.mouse.up();
        assert.equal(await page.locator('#xoditor-1 col').count(),3);
        const widths=await page.locator('#xoditor-1 col').evaluateAll(cols=>cols.map(col=>parseFloat(col.style.width)));
        assert(widths[0]>widths[1]);
        const last=await page.locator('#xoditor-1 td').last().boundingBox();
        await page.mouse.move(last.x+last.width-2,last.y+last.height/2);await page.mouse.down();await page.mouse.move(last.x+last.width-70,last.y+last.height/2);await page.mouse.up();
        assert(await page.locator('#xoditor-1 table').evaluate(table=>parseFloat(table.style.width)<90));
    });

    await check('Undo/redo, source editing, read-only and independent instances', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<p>First</p>');editor.editor.innerHTML='<p>Second</p>';editor.changed();editor.performUndo();const undo=editor.getContent();editor.performRedo();const redo=editor.getContent();
            editor.toggleHTMLMode();editor.setSourceContent('<p id="source">Source edited</p>');const source=editor.getContent();editor.toggleHTMLMode();
            editor.setReadOnly(true);editor.execCommand('bold');const readonly=editor.editor.contentEditable;
            other.setContent('<p>Other</p>');return {undo,redo,source,visual:editor.getContent(),readonly,other:other.getContent(),changes};
        });
        assert.equal(result.undo,'<p>First</p>');assert.equal(result.redo,'<p>Second</p>');assert.match(result.source,/Source edited/);assert.match(result.visual,/id="source"/);assert.equal(result.readonly,'false');assert.equal(result.other,'<p>Other</p>');assert(result.changes>0);
    });

    await check('Replace all edits text only, leaving links and attributes intact', async () => {
        const html=await page.evaluate(() => {
            editor.setReadOnly(false);editor.setContent('<p><a href="https://example.com/Test">Test</a> Test</p>');editor.showFindReplace(true);
            editor.findDialog.querySelector('[data-field="find"]').value='Test';editor.findDialog.querySelector('[data-field="replace"]').value='Changed';editor.replaceAll();return editor.getContent();
        });
        assert.match(html,/href="https:\/\/example.com\/Test"/);assert.match(html,/>Changed<\/a> Changed/);
    });

    await check('Nested Word lists retain hierarchy and Nepali numbering', async () => {
        const result=await page.evaluate(() => {
            const html='<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">१. </span>Parent</p><p style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">a) </span>Child</p><p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">२. </span>Next</p>';
            const doc=new DOMParser().parseFromString(editor.sanitizeHtml(html,true),'text/html');
            return {parents:doc.body.firstElementChild.children.length,nested:doc.querySelectorAll('ol > li > ol').length,text:doc.body.textContent};
        });
        assert.equal(result.parents,2);assert.equal(result.nested,1);assert.match(result.text,/ParentChildNext/);
    });

    await check('Logical grid supports rowspan/colspan structural edits without data loss', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<table><tbody><tr><td rowspan="2">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td><td>G</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table');editor.selectCell(table.rows[1].cells[0],false);editor.editTable('rowAbove');
            const rowspan=table.rows[0].cells[0].rowSpan;
            editor.selectCell(table.rows[0].cells[1],false);editor.editTable('split');
            const grid=editor.tableMatrix(table);const lengths=grid.grid.map(row=>row.filter(Boolean).length);
            editor.selectCell(table.rows[1].cells[0],false);editor.editTable('columnRight');const width=editor.tableMatrix(table).width;
            editor.selectCell(editor.tableMatrix(table).grid[1][2],false);editor.editTable('deleteColumn');const after=editor.tableMatrix(table);
            return {rowspan,lengths,width,afterWidth:after.width,text:table.textContent};
        });
        assert.equal(result.rowspan,3);assert(result.lengths.every(length=>length===3));assert.equal(result.width,4);assert.equal(result.afterWidth,3);assert.match(result.text,/A/);assert.match(result.text,/B/);assert.match(result.text,/C/);assert.match(result.text,/G/);
    });

    await check('Deleting a spanning origin row preserves the merged cell contents', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<table><tbody><tr><td rowspan="2">Keep</td><td>Delete</td></tr><tr><td>Next</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table');editor.selectCell(table.rows[0].cells[0],false);editor.editTable('deleteRow');
            return {rows:table.rows.length,cells:table.rows[0].cells.length,text:table.textContent};
        });
        assert.equal(result.rows,1);assert.equal(result.cells,2);assert.match(result.text,/Keep/);assert.match(result.text,/Next/);assert.doesNotMatch(result.text,/Delete/);
    });

    await check('Vertical merge/split and inside/outside borders use logical positions', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table');editor.selectCell(table.rows[0].cells[0],false);editor.selectCell(table.rows[1].cells[0],true);editor.editTable('merge');
            const span=editor.activeCell.rowSpan;editor.editTable('split');
            editor.selectCell(table.rows[0].cells[0],false);editor.selectCell(table.rows[1].cells[1],true);editor.applyCellBorders('outside');editor.applyCellBorders('inside');
            return {span,width:editor.tableMatrix(table).width,cells:table.querySelectorAll('td').length,border:table.rows[0].cells[0].style.borderRight,text:table.textContent};
        });
        assert.equal(result.span,2);assert.equal(result.width,2);assert.equal(result.cells,4);assert.match(result.border,/solid/);assert.match(result.text,/A/);assert.match(result.text,/C/);
    });

    await check('Asynchronous image upload returns to its original insertion point', async () => {
        const result=await page.evaluate(async () => {
            editor.setContent('<p id="upload-start">First</p><p id="upload-other">Second</p>');
            editor.placeCaret(editor.editor.querySelector('#upload-start'));
            let resolveUpload;editor.options.uploadImage=()=>new Promise(resolve=>resolveUpload=resolve);
            const pending=editor.insertImageFile(new File(['test'],'test.png',{type:'image/png'}));
            editor.placeCaret(editor.editor.querySelector('#upload-other'));resolveUpload('https://example.test/image.png');await pending;delete editor.options.uploadImage;
            return {first:!!editor.editor.querySelector('#upload-start img'),second:!!editor.editor.querySelector('#upload-other img')};
        });
        assert.equal(result.first,true);assert.equal(result.second,false);
    });

    await check('Failed Word image upload still pastes the text and reports the failure', async () => {
        const result=await page.evaluate(async () => {
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));editor.options.uploadImage=()=>Promise.reject(new Error('failed'));
            const data=new DataTransfer();data.setData('text/html','<p class="MsoNormal">Keep the text<img src="file:///word/image.png"></p>');data.items.add(new File(['test'],'test.png',{type:'image/png'}));
            await editor.pasteContent(window.pasteEvent({clipboardData:data,cancelable:true}));delete editor.options.uploadImage;
            return {text:editor.editor.textContent,notice:editor.notice.textContent};
        });
        assert.match(result.text,/Keep the text/);assert(result.notice.length>0);
    });

    await check('Page layout is exported, isolated, restorable and undoable', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<p>Page</p>');editor.setPageLayout({size:'A4',orientation:'landscape',top:10,right:20,bottom:15,left:25});
            const html=editor.getContent();editor.setContent(html);const restored=editor.pageLayout;
            editor.setPageLayout({size:'Letter',orientation:'portrait',top:12,right:12,bottom:12,left:12});editor.performUndo();
            return {html,restored,undo:editor.pageLayout,bodyPadding:document.body.style.padding};
        });
        assert.match(result.html,/@page/);assert.match(result.html,/A4 landscape/);assert.equal(result.restored.left,25);assert.equal(result.undo.size,'A4');assert.equal(result.bodyPadding,'');
    });

    await check('IME composition commits once and does not rewrite Nepali input', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<p><br></p>');const before=changes;
            editor.editor.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
            editor.editor.querySelector('p').textContent='नेपाली';editor.editor.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'नेपाली'}));
            const during=changes-before;editor.editor.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'नेपाली'}));
            return {during,after:changes-before,text:editor.editor.textContent};
        });
        assert.equal(result.during,0);assert.equal(result.after,1);assert.equal(result.text,'नेपाली');
    });

    await check('Formatting over multiple paragraphs keeps block structure and IDs', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<div id="preserve"><p id="a">One</p><p id="b">Two</p></div>');
            const range=document.createRange();range.setStart(editor.editor.querySelector('#a').firstChild,0);range.setEnd(editor.editor.querySelector('#b').firstChild,3);
            const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();editor.applyTextStyle('font-size','22px');editor.applyTextStyle('color','#cc0000');
            return {paragraphs:editor.editor.querySelectorAll('p').length,invalid:editor.editor.querySelectorAll('span p').length,ids:editor.editor.querySelectorAll('#a,#b').length,text:editor.editor.textContent};
        });
        assert.equal(result.paragraphs,2);assert.equal(result.invalid,0);assert.equal(result.ids,2);assert.equal(result.text,'OneTwo');
    });

    await check('Unicode whole-word and literal punctuation search do not change attributes', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<p data-value="रमेश">रमेश रमेशको [x]</p>');editor.showFindReplace(true);
            editor.findDialog.querySelector('[data-field="find"]').value='रमेश';editor.findDialog.querySelector('[data-field="word"]').checked=true;editor.findDialog.querySelector('[data-field="replace"]').value='नाम';editor.replaceAll();
            editor.findDialog.querySelector('[data-field="word"]').checked=false;editor.findDialog.querySelector('[data-field="find"]').value='[x]';editor.findDialog.querySelector('[data-field="replace"]').value='literal';editor.replaceAll();return editor.getContent();
        });
        assert.match(result,/data-value="रमेश"/);assert.match(result,/नाम रमेशको literal/);
    });

    await check('Find navigation resets, wraps, counts and handles previous results', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Alpha beta Alpha</p>');editor.showFindReplace(true);
            const find=editor.findDialog.querySelector('[data-field="find"]');find.value='Alpha';editor.findNext();const first=getSelection().toString(),one=editor.findDialog.querySelector('[role="status"]').textContent;
            editor.findNext();const two=editor.findDialog.querySelector('[role="status"]').textContent;editor.findNext();const wrap=editor.findDialog.querySelector('[role="status"]').textContent;
            editor.findNext(-1);const previous=editor.findDialog.querySelector('[role="status"]').textContent;
            find.value='beta';editor.findNext();const changed=getSelection().toString();find.value='missing';editor.findNext();const missing=editor.findDialog.querySelector('[role="status"]').textContent;
            return {first,one,two,wrap,previous,changed,missing};
        });
        assert.deepEqual(result,{first:'Alpha',one:'1 of 2',two:'2 of 2',wrap:'1 of 2',previous:'2 of 2',changed:'beta',missing:'No matches'});
    });

    await check('Search crosses inline formatting but respects blocks, cells, breaks and hidden content', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p><b>Hel</b><i>lo</i></p><p>World</p><p>A<br>B</p><table><tr><td>cat</td><td>dog</td></tr></table><p hidden>secret</p>');editor.showFindReplace(true);
            const field=editor.findDialog.querySelector('[data-field="find"]');const count=value=>{field.value=value;return editor.searchMatches().length;};
            const counts=['Hello','HelloWorld','AB','catdog','secret'].map(count);
            field.value='Hello';editor.findNext();const selected=getSelection().toString();editor.findDialog.querySelector('[data-field="replace"]').value='Hi';editor.replace();return {counts,selected,html:editor.getContent()};
        });
        assert.deepEqual(result.counts,[1,0,0,0,0]);assert.equal(result.selected,'Hello');assert.match(result.html,/Hi/);assert.match(result.html,/<p>World<\/p>/);assert.match(result.html,/<td>cat<\/td>/);
    });

    await check('Repeated Replace does not skip matches and replacement text is literal and undoable', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>cat cat cat</p>');editor.showFindReplace(true);editor.findDialog.querySelector('[data-field="find"]').value='cat';editor.findDialog.querySelector('[data-field="replace"]').value='dog';editor.findNext();editor.replace();const first=editor.editor.textContent;editor.replace();const second=editor.editor.textContent;editor.replace();const third=editor.editor.textContent;editor.performUndo();const undo=editor.editor.textContent;editor.performRedo();const redo=editor.editor.textContent;
            editor.setContent('<p data-token="cat">cat <b>cat</b> cat</p>');editor.findDialog.querySelector('[data-field="replace"]').value='<$&>';editor.replaceAll();const literal=editor.getContent();const status=editor.findDialog.querySelector('[role="status"]').textContent;editor.performUndo();const allUndo=editor.editor.textContent;
            return {first,second,third,undo,redo,literal,status,allUndo};
        });
        assert.equal(result.first,'dog cat cat');assert.equal(result.second,'dog dog cat');assert.equal(result.third,'dog dog dog');assert.equal(result.undo,'dog dog cat');assert.equal(result.redo,'dog dog dog');assert.match(result.literal,/data-token="cat"/);assert.equal((result.literal.match(/&lt;\$&amp;&gt;/g)||[]).length,3);assert.equal(result.status,'Replaced 3 matches');assert.equal(result.allUndo,'cat cat cat');
    });

    await check('Whole-word search respects Nepali vowel marks and read-only replacement guards', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>राम रामा रामको राम</p>');editor.showFindReplace(true);editor.findDialog.querySelector('[data-field="find"]').value='राम';editor.findDialog.querySelector('[data-field="word"]').checked=true;const count=editor.searchMatches().length;editor.findDialog.querySelector('[data-field="replace"]').value='नाम';editor.setReadOnly(true);editor.replaceAll();editor.replace();const text=editor.editor.textContent;editor.setReadOnly(false);return {count,text};
        });
        assert.equal(result.count,2);assert.equal(result.text,'राम रामा रामको राम');
    });

    await check('Source changes can be undone and restored without losing template CSS', async () => {
        const result=await page.evaluate(() => {
            editor.setContent('<p>Before source</p><style>p{color:blue}</style>');editor.toggleHTMLMode();editor.setSourceContent('<p>After source</p><style>p{color:blue}</style>');editor.toggleHTMLMode();editor.performUndo();const undo=editor.getContent();editor.performRedo();return {undo,redo:editor.getContent()};
        });
        assert.match(result.undo,/Before source/);assert.match(result.undo,/<style>/);assert.match(result.redo,/After source/);
    });

    await check('Font toolbar reports pixel values for point-based pasted text', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p style="font-size:18pt">Word font</p>');const p=editor.editor.querySelector('p');editor.placeCaret(p);editor.updateToolbarState();
            return {size:editor.getEffectiveFontSize(p),label:editor.toolbar.querySelector('.size-dropdown .dropdown-text').textContent};
        });
        assert.equal(result.size,24);assert.equal(result.label,'24');
    });

    await check('Font selectors initialize from content and follow the cursor', async () => {
        const result=await page.evaluate(()=>{
            const read=()=>({label:editor.toolbar.querySelector('.size-dropdown .dropdown-text').textContent,input:editor.toolbar.querySelector('.custom-size-input').value,selected:Array.from(editor.toolbar.querySelectorAll('.size-item.selected')).map(item=>item.dataset.size),font:editor.toolbar.querySelector('.font-dropdown .dropdown-text').textContent});
            editor.setContent('<p><br></p>');const empty=read();
            editor.setContent('<p style="font-family:Times New Roman;font-size:24px">First</p><p style="font-size:32px">Second</p>');const loaded=read();
            editor.placeCaret(editor.editor.querySelectorAll('p')[1]);editor.updateToolbarState();const moved=read();return {empty,loaded,moved};
        });
        assert.equal(result.empty.label,'18');assert.equal(result.empty.input,'18');assert.deepEqual(result.empty.selected,['18']);
        assert.equal(result.loaded.label,'24');assert.equal(result.loaded.input,'24');assert.deepEqual(result.loaded.selected,['24']);assert.equal(result.loaded.font,'Times New Roman');
        assert.equal(result.moved.label,'32');assert.equal(result.moved.input,'32');assert.deepEqual(result.moved.selected,['32']);
    });

    await check('Inline toolbar commands preserve text and change visible formatting', async () => {
        const result=await page.evaluate(()=>{
            const select=()=>{const range=document.createRange();range.selectNodeContents(editor.editor.querySelector('p'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();};
            editor.setContent('<p>Format me</p>');select();editor.execCommand('bold');select();editor.execCommand('italic');select();editor.execCommand('underline');
            const first=editor.editor.querySelector('p').querySelector('span,b,strong,i,em,u')||editor.editor.querySelector('p');
            const node=Array.from(editor.editor.querySelectorAll('*')).find(item=>item.childNodes.length===1&&item.firstChild.nodeType===3&&item.textContent==='Format me');
            const style=getComputedStyle(node||first);return {text:editor.editor.textContent,weight:style.fontWeight,italic:style.fontStyle,html:editor.getContent()};
        });
        assert.equal(result.text,'Format me');assert(Number(result.weight)>=600||result.weight==='bold');assert.equal(result.italic,'italic');assert.match(result.html,/underline|<u>/);
    });

    await check('Bold and font styles are compacted into one live span', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<table><tbody><tr><td><span style="font-family:Times New Roman;font-size:20px">Styled text</span></td></tr></tbody></table>');
            const text=editor.editor.querySelector('td span').firstChild,range=document.createRange();range.selectNodeContents(text);getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();editor.execCommand('bold');
            const spans=editor.editor.querySelectorAll('td span');const span=spans[0];return {count:spans.length,weight:span.style.fontWeight,font:span.style.fontFamily,size:span.style.fontSize,text:span.textContent,html:editor.getContent()};
        });
        assert.equal(result.count,1);assert.equal(result.weight,'bold');assert.match(result.font,/Times New Roman/);assert.equal(result.size,'20px');assert.equal(result.text,'Styled text');assert.doesNotMatch(result.html,/<span[^>]*>\s*<span/);
    });

    await check('Paragraph/list/link commands, alignment and literal unlink', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Paragraph</p>');editor.placeCaret(editor.editor.querySelector('p'));editor.execCommand('formatBlock','h2');editor.execCommand('justifyCenter');
            const heading=!!editor.editor.querySelector('h2');editor.execCommand('insertUnorderedList');const list=!!editor.editor.querySelector('ul li');
            editor.setContent('<p>Link</p>');const range=document.createRange();range.selectNodeContents(editor.editor.querySelector('p'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();
            document.execCommand('createLink',false,'https://example.test');editor.rememberSelection();editor.execCommand('unlink');
            return {heading,list,links:editor.editor.querySelectorAll('a').length,text:editor.editor.textContent};
        });
        assert.equal(result.heading,true);assert.equal(result.list,true);assert.equal(result.links,0);assert.equal(result.text,'Link');
    });

    await check('In-editor link and image dialogs insert links and images without window.prompt or alert', async () => {
        // Test 1: Link Dialog insertion
        await page.evaluate(() => {
            editor.setContent('<p>Click here for details</p>');
            const p = editor.editor.querySelector('p');
            const range = document.createRange();
            range.setStart(p.firstChild, 6);
            range.setEnd(p.firstChild, 10);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            editor.rememberSelection();
            editor.execCommand('createLink');
        });
        const linkDialog = page.locator('.xoditor .custom-link-dialog');
        assert(await linkDialog.isVisible());
        assert.equal(await linkDialog.locator('[data-field="text"]').inputValue(), 'here');
        await linkDialog.locator('[data-field="url"]').fill('https://example.com/test');
        await linkDialog.locator('[data-field="target"]').check();
        await linkDialog.locator('.custom-dialog-primary').click();
        assert.equal(await linkDialog.count(), 0);

        const linkResult = await page.evaluate(() => {
            const a = editor.editor.querySelector('a');
            return {
                href: a ? a.getAttribute('href') : null,
                text: a ? a.textContent : null,
                target: a ? a.getAttribute('target') : null,
                rel: a ? a.getAttribute('rel') : null
            };
        });
        assert.equal(linkResult.href, 'https://example.com/test');
        assert.equal(linkResult.text, 'here');
        assert.equal(linkResult.target, '_blank');
        assert.equal(linkResult.rel, 'noopener noreferrer');

        // Test 2: Edit existing link
        await page.evaluate(() => {
            const a = editor.editor.querySelector('a');
            const range = document.createRange();
            range.selectNodeContents(a);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            editor.rememberSelection();
            editor.execCommand('createLink');
        });
        assert(await linkDialog.isVisible());
        assert.equal(await linkDialog.locator('[data-field="url"]').inputValue(), 'https://example.com/test');
        assert.equal(await linkDialog.locator('[data-field="text"]').inputValue(), 'here');
        assert.equal(await linkDialog.locator('[data-field="target"]').isChecked(), true);
        assert(await linkDialog.locator('.custom-dialog-danger').isVisible());
        await linkDialog.locator('.custom-dialog-danger').click();
        assert.equal(await linkDialog.count(), 0);
        assert.equal(await page.evaluate(() => editor.editor.querySelectorAll('a').length), 0);

        // Test 3: Image Dialog insertion
        await page.evaluate(() => {
            editor.setContent('<p>Image below</p>');
            editor.placeCaret(editor.editor.querySelector('p'));
            editor.execCommand('insertImage');
        });
        const imageDialog = page.locator('.xoditor .custom-image-dialog');
        assert(await imageDialog.isVisible());
        await imageDialog.locator('[data-field="url"]').fill('https://example.com/photo.png');
        await imageDialog.locator('[data-field="alt"]').fill('Scenic photo');
        await imageDialog.locator('.custom-dialog-primary').click();
        assert.equal(await imageDialog.count(), 0);

        const imgResult = await page.evaluate(() => {
            const img = editor.editor.querySelector('img');
            return {
                src: img ? img.getAttribute('src') : null,
                alt: img ? img.getAttribute('alt') : null
            };
        });
        assert.equal(imgResult.src, 'https://example.com/photo.png');
        assert.equal(imgResult.alt, 'Scenic photo');
    });

    await check('Enter in custom font size applies it without submitting the Darta form', async () => {
        await page.evaluate(()=>{
            editor.setContent('<p>Size input</p>');const range=document.createRange();range.selectNodeContents(editor.editor.querySelector('p'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);editor.rememberSelection();
        });
        await page.locator('#xoditor-1 .size-dropdown .word-dropdown-btn').click({position:{x:76,y:17}});
        await page.locator('#xoditor-1 .custom-size-input').fill('26');await page.locator('#xoditor-1 .custom-size-input').press('Enter');
        const result=await page.evaluate(()=>({submits,html:editor.getContent()}));assert.equal(result.submits,0);assert.match(result.html,/26px/);
    });

    await check('Page-layout first change can be undone to the default document', async () => {
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Plain</p>');editor.setPageLayout({size:'Letter',orientation:'landscape',top:10,right:10,bottom:10,left:10});editor.performUndo();return {layout:editor.pageLayout,html:editor.getContent(),padding:editor.editor.style.padding};
        });
        assert.equal(result.layout,null);assert.equal(result.padding,'');assert.doesNotMatch(result.html,/layout-data/);
    });

    await check('Read-only mode rejects programmatic formatting, tables and paste', async () => {
        const result=await page.evaluate(async ()=>{
            editor.setContent('<p>Immutable</p>');editor.setReadOnly(true);editor.applyTextStyle('font-size','48px');editor.createTableFromGrid(2,2);editor.insertMarkup('<p>Injected</p>');
            const data=new DataTransfer();data.setData('text/plain','Pasted');await editor.pasteContent(window.pasteEvent({clipboardData:data}));
            const html=editor.getContent();editor.setReadOnly(false);return html;
        });
        assert.equal(result,'<p>Immutable</p>');
    });

    await check('Zoom is visual only and proportional image resizing works while zoomed', async () => {
        await page.evaluate(async ()=>{
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));const canvas=document.createElement('canvas');canvas.width=80;canvas.height=40;
            const blob=await new Promise(resolve=>canvas.toBlob(resolve));await editor.insertImageFile(new File([blob],'zoom.png',{type:'image/png'}));
            const dropdown=editor.toolbar.querySelector('.zoom-dropdown');editor.applyZoom('150%',dropdown.querySelector('.word-dropdown-btn'),dropdown.querySelector('.word-dropdown-menu'));
        });
        const image=page.locator('#xoditor-1 .editor-content img');await image.evaluate(img=>img.decode());const before=await image.boundingBox();
        await page.mouse.move(before.x+before.width-2,before.y+before.height-2);await page.mouse.down();await page.mouse.move(before.x+before.width+25,before.y+before.height+12);await page.mouse.up();
        const after=await image.boundingBox();assert(after.width>before.width);assert(Math.abs(after.width/after.height-2)<0.05);
        const html=await page.evaluate(()=>editor.getContent());assert.doesNotMatch(html,/zoom:/);
        await page.evaluate(()=>{editor.editor.style.zoom='100%';editor.options.zoom=100;});
    });

    await check('Formatting after keyboard Enter does not build nested cell div chains', async () => {
        await page.evaluate(()=>{editor.setContent('<table><tbody><tr><td><br></td></tr></tbody></table>');editor.placeCaret(editor.editor.querySelector('td'));});
        await page.keyboard.type('First');await page.keyboard.press('Enter');await page.keyboard.type('Second');await page.keyboard.press('Enter');await page.keyboard.type('Third');
        const result=await page.evaluate(()=>({text:editor.editor.textContent,chains:editor.editor.querySelectorAll('td div div div div').length}));
        assert.match(result.text,/First/);assert.match(result.text,/Second/);assert.match(result.text,/Third/);assert.equal(result.chains,0);
        await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Header-row insertion stays in its row group and rowspan zero respects that group',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<table><thead><tr><th rowspan="0">Heading</th><th>Other heading</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
            const table=editor.editor.querySelector('table'),matrix=editor.tableMatrix(table);const bodyFirst=matrix.grid[1][0].textContent;
            editor.selectCell(table.tHead.rows[0].cells[1],false);editor.editTable('rowBelow');return {headers:table.tHead.rows.length,bodyRows:table.tBodies[0].rows.length,bodyFirst};
        });
        assert.equal(result.headers,2);assert.equal(result.bodyRows,1);assert.equal(result.bodyFirst,'A');
    });

    await check('Outer-table edits do not remove a nested table column group',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<table id="outer"><tbody><tr><td><table id="inner"><colgroup><col style="width:20%"><col style="width:80%"></colgroup><tbody><tr><td>Inner A</td><td>Inner B</td></tr></tbody></table></td><td>Outer B</td></tr></tbody></table>');
            const outer=editor.editor.querySelector('#outer');editor.selectCell(outer.rows[0].cells[1],false);editor.editTable('columnRight');
            return {cols:editor.editor.querySelectorAll('#inner col').length,width:editor.editor.querySelector('#inner col').style.width};
        });
        assert.equal(result.cols,2);assert.equal(result.width,'20%');
    });

    await check('Print action exports template CSS, page settings and relative-URL base',async()=>{
        await page.evaluate(()=>{
            editor.setContent('<p>Print check</p><style>p{color:blue}</style>');editor.setPageLayout({size:'A4',orientation:'landscape',top:10,right:10,bottom:10,left:10});
            const open=window.open;window.originalTestOpen=open;window.open=function(...args){const popup=open.apply(this,args);window.lastPrintPopup=popup;popup.print=()=>window.printedHtml=popup.document.documentElement.outerHTML;return popup;};editor.printContent();
        });
        await page.waitForFunction(()=>!!window.printedHtml);
        const html=await page.evaluate(()=>{const html=window.printedHtml;window.lastPrintPopup.close();window.open=window.originalTestOpen;editor.setContent('<p>After source</p>');return html;});
        assert.match(html,/Print check/);assert.match(html,/A4 landscape/);assert.match(html,/p\{color:blue\}/);assert.match(html,/<base/);
    });

    await check('Print proceeds when an image never finishes loading',async()=>{
        await page.evaluate(()=>{
            editor.setContent('<p>Print despite stalled image</p>');
            const original=window.open;window.printTimeoutOriginalOpen=original;
            window.open=function(...args){const popup=original.apply(this,args);window.printTimeoutPopup=popup;popup.print=()=>window.printTimeoutResult=popup.document.body.textContent;Object.defineProperty(popup.document,'images',{value:[{complete:false,addEventListener(){}}]});return popup;};
            editor.printContent();
        });
        await page.waitForFunction(()=>!!window.printTimeoutResult,{timeout:8000});
        assert.match(await page.evaluate(()=>window.printTimeoutResult),/Print despite stalled image/);
        await page.evaluate(()=>{window.printTimeoutPopup.close();window.open=window.printTimeoutOriginalOpen;});
    });

    if(engine==='chromium')await check('PDF print uses exported landscape A4 page dimensions',async()=>{
        const print=await browser.newPage();await print.setContent('<style>@page{size:A4 landscape;margin:10mm}</style><p>नेपाली print fixture</p>');
        const pdf=await print.pdf({preferCSSPageSize:true});await print.close();
        const match=/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString('latin1'));
        assert(match);assert(Math.abs(Number(match[1])-841.89)<2);assert(Math.abs(Number(match[2])-595.28)<2);
    });

    await check('Code view has line numbers, colored tokens, folding and matching tags',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<div>\n    <p class="sample">Text</p>\n</div>');editor.toggleHTMLMode();
            const cm=editor.codeMirror;cm.setCursor({line:0,ch:2});cm.refresh();
            const tokens=Array.from(editor.codePanel.querySelectorAll('.cm-tag,.cm-attribute,.cm-string')).length;
            cm.foldCode({line:0,ch:0});const folded=cm.getAllMarks().some(mark=>mark.__isFold);cm.execCommand('unfoldAll');
            return {numbers:cm.getOption('lineNumbers'),tokens,folded,matching:editor.tagNameMarks?.length===2,close:cm.getOption('autoCloseTags')};
        });
        assert.equal(result.numbers,true);assert(result.tokens>0);assert.equal(result.folded,true);assert.equal(result.matching,true);assert.equal(result.close,true);
    });

    await check('HTML formatter is undoable and preserves source content',async()=>{
        const result=await page.evaluate(async()=>{
            editor.setSourceContent('<div><p>Text</p><p>More</p></div>');const before=editor.getContent();await editor.formatSource();
            const formatted=editor.getContent();editor.codeMirror.undo();const undo=editor.getContent();editor.codeMirror.redo();
            return {before,formatted,undo,redo:editor.getContent(),notice:editor.notice.textContent};
        });
        assert.match(result.formatted,/\n/);assert.equal(result.undo,result.before);assert.equal(result.redo,result.formatted);assert.match(result.notice,/formatted/);
    });

    await check('Formatter uses four spaces, multiline attributes and safe CSS declarations',async()=>{
        const result=await page.evaluate(async()=>{
            const source='<div id="outer"><section class="long-class-name-for-formatting" data-description="A long attribute value with spaces &amp; symbols" title="Keep this attribute exactly"><p style="color: red; font-family: Kalimati, Arial; background-image: url(\'data:image/png;base64,AAA;BBB\'); --label: \'a;b\';">Hello <strong>नेपाली</strong> world &amp; text.</p></section></div>';
            const output=await editor.formatHtmlSource(source);
            const before=new DOMParser().parseFromString(source,'text/html'),after=new DOMParser().parseFromString(output,'text/html');
            const attributes=doc=>Array.from(doc.body.querySelectorAll('*')).map(node=>Array.from(node.attributes).filter(attr=>attr.name!=='style').map(attr=>[attr.name,attr.value]));
            return {output,beforeText:Array.from(before.querySelector('p').childNodes).map(node=>node.textContent).join(''),afterText:Array.from(after.querySelector('p').childNodes).map(node=>node.textContent).join(''),beforeAttrs:attributes(before),afterAttrs:attributes(after),css:after.querySelector('p').style.cssText,beforeCss:before.querySelector('p').style.cssText,again:await editor.formatHtmlSource(output)};
        });
        assert.match(result.output,/\n {4}<section/);assert.match(result.output,/\n {4}<\/section>/);assert.match(result.output,/\n +data-description=/);
        assert.match(result.output,/style="color: red;\n +font-family:/);assert.match(result.output,/AAA;BBB/);assert.match(result.output,/a;b/);
        assert.equal(result.beforeText,result.afterText);assert.deepEqual(result.beforeAttrs,result.afterAttrs);assert.equal(result.css,result.beforeCss);assert.equal(result.again,result.output);
    });

    await check('Source auto-closes HTML tags and read-only blocks source typing',async()=>{
        await page.evaluate(()=>{editor.setSourceContent('');editor.codeMirror.focus();});
        await page.keyboard.type('<div>');
        assert.match(await page.evaluate(()=>editor.getContent()),/<div>\s*<\/div>/);
        await page.evaluate(()=>editor.setReadOnly(true));await page.keyboard.type('blocked');
        assert.doesNotMatch(await page.evaluate(()=>editor.getContent()),/blocked/);
        await page.evaluate(()=>{editor.setReadOnly(false);editor.toggleHTMLMode();editor.setContent('<p>After source</p>');});
    });

    await check('Nested Nepali subject spans inherit bold and allow regular-font weight synthesis',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p style="text-align:center"><span style="color:black;font-size:18px"><span style="font-weight:bold"><span style="font-family:Kalimati,Arial,Helvetica;font-size:18px">विषय: सिफारिस सम्बन्धमा।</span></span></span></p>');
            const inner=editor.editor.querySelector('span span span'),style=getComputedStyle(inner);
            return {weight:style.fontWeight,synthesis:style.fontSynthesis,html:editor.getContent()};
        });
        assert(Number(result.weight)>=600||result.weight==='bold');assert.match(result.synthesis,/weight/);assert.match(result.html,/font-weight:\s*bold/);
        await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Formatter preserves entity-quoted CSS, attribute values and raw text',async()=>{
        const result=await page.evaluate(async()=>{
            const input='<div data-note="A &quot;quote&quot; &amp; value" title="line 1\nline 2" style="content: &quot;a;b&quot;; color: red; --note: &quot;x;y&quot;;"><span>Keep  two spaces</span><!--keep comment--><pre>  raw\n    text</pre><script>const text = "<tag>";</script></div>';
            const output=await editor.formatHtmlSource(input),again=await editor.formatHtmlSource(output);
            const before=new DOMParser().parseFromString(input,'text/html'),after=new DOMParser().parseFromString(output,'text/html');
            return {output,again,title:after.querySelector('div').getAttribute('title'),beforeTitle:before.querySelector('div').getAttribute('title'),css:after.querySelector('div').style.cssText,beforeCss:before.querySelector('div').style.cssText,text:after.querySelector('span').textContent,raw:after.querySelector('pre').textContent,script:after.querySelector('script').textContent};
        });
        assert.equal(result.output,result.again);assert.equal(result.title,result.beforeTitle);assert.equal(result.css,result.beforeCss);assert.equal(result.text,'Keep  two spaces');assert.equal(result.raw,'  raw\n    text');assert.equal(result.script,'const text = "<tag>";');assert.match(result.output,/<!--keep comment-->/);
    });

    await check('Source find/replace and go-to-line commands are bundled with cursor position',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Find target</p>');editor.toggleHTMLMode();editor.codeMirror.setCursor({line:0,ch:3});
            editor.codeMirror.execCommand('find');const find=!!editor.codePanel.querySelector('.CodeMirror-dialog');editor.codePanel.querySelector('.CodeMirror-dialog input')?.dispatchEvent(new KeyboardEvent('keydown',{keyCode:27,bubbles:true}));
            return {find,replace:typeof CodeMirror.commands.replace,jump:typeof CodeMirror.commands.jumpToLine,position:editor.sourcePosition.textContent};
        });
        assert.equal(result.find,true);assert.equal(result.replace,'function');assert.equal(result.jump,'function');assert.match(result.position,/Line 1, column 4/);
        await page.evaluate(()=>{editor.toggleHTMLMode();editor.setContent('<p>After source</p>');});
    });

    await check('Symbol insertion preserves selection and supports undo',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Price </p>');const text=editor.editor.querySelector('p').firstChild;const range=document.createRange();range.setStart(text,text.length);range.collapse(true);editor.savedRange=range;editor.restoreSelection();editor.showSymbols();
            Array.from(editor.symbolPanel.querySelectorAll('button')).find(button=>button.textContent==='₹').click();const inserted=editor.editor.textContent;editor.performUndo();return {inserted,undo:editor.editor.textContent};
        });
        assert.equal(result.inserted,'Price ₹');assert.equal(result.undo,'Price ');await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Invalid HTML formatting leaves source and undo history unchanged',async()=>{
        const result=await page.evaluate(async()=>{
            editor.setContent('<p>Original</p>');editor.toggleHTMLMode();editor.setSourceContent('<div><span></div>');const before=editor.getContent();await editor.formatSource();
            return {before,after:editor.getContent(),notice:editor.notice.textContent};
        });
        assert.equal(result.after,result.before);assert.match(result.notice,/could not be formatted/);
    });

    await check('Asynchronous formatting never overwrites newer source edits',async()=>{
        const result=await page.evaluate(async()=>{
            editor.setSourceContent('<p>Start</p>');const original=editor.formatHtmlSource;let resolve;
            editor.formatHtmlSource=()=>new Promise(done=>resolve=done);const pending=editor.formatSource();editor.setSourceContent('<p>Newer edit</p>');resolve('<p>Old result</p>');await pending;editor.formatHtmlSource=original;
            return {html:editor.getContent(),notice:editor.notice.textContent};
        });
        assert.equal(result.html,'<p>Newer edit</p>');assert.match(result.notice,/Content changed/);
        await page.evaluate(()=>{editor.toggleHTMLMode();editor.setContent('<p>After source</p>');});
    });

    await check('HTML download contains document HTML rather than source editor markup',async()=>{
        const downloadPromise=page.waitForEvent('download');
        await page.evaluate(()=>{editor.setContent('<p>Download नेपाली</p>');editor.downloadHtml();});
        const download=await downloadPromise;assert.equal(download.suggestedFilename(),'document.html');
        const stream=await download.createReadStream();let value='';for await(const part of stream)value+=part.toString('utf8');
        assert.match(value,/Download नेपाली/);assert.doesNotMatch(value,/CodeMirror|custom-code-panel/);await download.delete();
        await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Toolbar icons render offline with accessible labels and consistent button sizes',async()=>{
        const result=await page.evaluate(()=>{
            const buttons=Array.from(editor.toolbar.querySelectorAll('button.word-toolbar-btn'));
            const before=buttons.every(button=>!!button.querySelector('svg')&&!!button.getAttribute('aria-label'));
            editor.enterFullscreen();const fullscreen=!!editor.toolbar.querySelector('[aria-label="Exit fullscreen"] svg');editor.exitFullscreen();
            return {before,fullscreen,missing:editor.toolbar.querySelectorAll('i.fa').length,height:getComputedStyle(buttons[0]).height};
        });
        assert.equal(result.before,true);assert.equal(result.fullscreen,true);assert.equal(result.missing,0);assert.equal(result.height,'30px');
    });

    await check('Font sizes show px and line spacing has an accessible icon control',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p>Spacing</p>');editor.placeCaret(editor.editor.querySelector('p'));editor.updateToolbarState();
            const control=editor.toolbar.querySelector('[aria-label="Line spacing"]');control.value='1.5';control.dispatchEvent(new Event('change'));
            return {label:editor.toolbar.querySelector('.size-dropdown .dropdown-text').textContent,icon:!!control.parentElement.querySelector('svg'),height:editor.editor.querySelector('p').style.lineHeight};
        });
        assert.match(result.label,/^\d+$/);assert.equal(result.icon,true);assert.equal(result.height,'1.5');await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Font selectors have wider rendered buttons and numeric-only size options',async()=>{
        const result=await page.evaluate(()=>({font:editor.toolbar.querySelector('.font-dropdown button').getBoundingClientRect().width,size:editor.toolbar.querySelector('.size-dropdown button').getBoundingClientRect().width,items:Array.from(editor.toolbar.querySelectorAll('.size-item')).map(item=>item.textContent.trim())}));
        assert.equal(result.font,180);assert.equal(result.size,90);assert(result.items.every(value=>/^\d+$/.test(value)));
    });

    await check('Export compacts redundant font spans without changing text, IDs or line breaks',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p><span style="font-family:Times New Roman"><span style="font-size:18px">Word</span></span>&lt;div&gt;<span style="font-size:14px">A<br></span><span style="font-size:14px">B</span><span id="keep"><span style="font-size:20px">C</span></span></p>');
            const before=editor.editor.textContent,live=editor.editor.innerHTML,html=editor.getContent(),doc=new DOMParser().parseFromString(html,'text/html');
            return {before,after:doc.body.textContent,html,liveSame:live===editor.editor.innerHTML,spans:doc.querySelectorAll('span').length,br:doc.querySelectorAll('br').length,id:!!doc.querySelector('#keep')};
        });
        assert.equal(result.before,result.after);assert.equal(result.liveSame,true);assert.equal(result.br,1);assert.equal(result.id,true);assert.equal(result.spans,4);assert.match(result.html,/&lt;div&gt;/);
    });

    await check('Successive font changes on an empty paragraph avoid unnecessary typing spans',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<p><br></p>');editor.placeCaret(editor.editor.querySelector('p'));editor.applyTextStyle('font-family','Times New Roman');editor.applyTextStyle('font-size','18px');editor.applyTextStyle('font-size','24px');
            return {spans:editor.editor.querySelectorAll('span').length,html:editor.getContent()};
        });
        assert.equal(result.spans,0);assert.match(result.html,/24px/);await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Enter creates p paragraphs while Shift+Enter creates a soft break',async()=>{
        await page.evaluate(()=>{editor.setContent('<p>First</p>');const text=editor.editor.querySelector('p').firstChild;const range=document.createRange();range.setStart(text,text.length);range.collapse(true);editor.savedRange=range;editor.restoreSelection();});
        await page.keyboard.press('Enter');await page.keyboard.type('Second');await page.keyboard.press('Shift+Enter');await page.keyboard.type('Third');
        const result=await page.evaluate(()=>({paragraphs:editor.editor.querySelectorAll('p').length,divs:editor.editor.querySelectorAll('div').length,breaks:editor.editor.querySelectorAll('br').length,text:editor.editor.textContent}));
        assert.equal(result.paragraphs,2);assert.equal(result.divs,0);assert(result.breaks>=1);assert.match(result.text,/Second/);assert.match(result.text,/Third/);
    });

    await check('Enter inherits the active inline style, including bare pasted spans',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<span style="font-family:Times New Roman;font-size:22px;font-weight:bold;color:rgb(12, 34, 56)">First</span><span style="font-family:Times New Roman"></span>Second');
            const text=Array.from(editor.editor.childNodes).find(node=>node.nodeType===3&&node.data==='Second');
            const range=document.createRange();range.setStart(text,0);range.collapse(true);editor.editor.focus();getSelection().removeAllRanges();getSelection().addRange(range);editor.rememberSelection();
            return true;
        });
        assert.equal(result,true);await page.keyboard.press('Enter');await page.keyboard.type('New text');
        const output=await page.evaluate(()=>{
            const paragraphs=editor.editor.querySelectorAll(':scope > p');const next=paragraphs[1];const style=getComputedStyle(next);
            return {count:paragraphs.length,text:next.textContent,family:style.fontFamily,size:style.fontSize,weight:style.fontWeight,color:style.color,html:editor.getContent()};
        });
        assert.equal(output.count,2);assert.equal(output.text,'New textSecond');assert.match(output.family,/Times New Roman/);assert.equal(output.size,'22px');assert(Number(output.weight)>=600);assert.equal(output.color,'rgb(12, 34, 56)');assert.match(output.html,/<p[^>]*font-family/);
    });

    await check('Fixed template footer stays inside the editor preview but is preserved for export',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<div><p>Letter content</p><div id="footerDiv">Footer</div></div><style>#footerDiv{position:fixed;bottom:0;left:0;width:100%}</style>');
            const preview=getComputedStyle(editor.editor.querySelector('#footerDiv')).position;
            const html=editor.getContent();
            return {preview,html};
        });
        assert.equal(result.preview,'static');assert.match(result.html,/position:fixed/);
    });

    await check('Line spacing applies to legacy div lines and overrides inline line-height',async()=>{
        const result=await page.evaluate(()=>{
            editor.setContent('<div><span style="font-size:20px;line-height:1">Legacy</span></div>');editor.placeCaret(editor.editor.querySelector('span'));editor.applyLineSpacing('2');
            const span=editor.editor.querySelector('span');return {block:editor.editor.querySelector('div').style.lineHeight,inline:span.style.lineHeight,computed:getComputedStyle(span).lineHeight};
        });
        assert.equal(result.block,'2');assert.equal(result.inline,'inherit');assert.equal(result.computed,'40px');await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Opening HTML view automatically formats source without changing text',async()=>{
        const result=await page.evaluate(async()=>{
            editor.setContent('<div><section><p>Hello <strong>नेपाली</strong> text</p></section></div>');editor.options.autoFormatSource=true;editor.toggleHTMLMode();await editor.sourceFormattingReady;
            const source=editor.getContent();editor.toggleHTMLMode();editor.options.autoFormatSource=false;return {source,text:editor.editor.textContent};
        });
        assert.match(result.source,/\n {4}<section/);assert.equal(result.text.replace(/\n\s*/g,''),'Hello नेपाली text');await page.evaluate(()=>editor.setContent('<p>After source</p>'));
    });

    await check('Matching-tag colors cover names only, not brackets or attributes',async()=>{
        const result=await page.evaluate(async()=>{
            editor.setContent('<section class="test"><p>Text</p></section>');editor.toggleHTMLMode();await editor.sourceFormattingReady;editor.codeMirror.setCursor({line:0,ch:3});
            return editor.tagNameMarks.map(mark=>{const range=mark.find();return editor.codeMirror.getRange(range.from,range.to);});
        });
        assert.deepEqual(result,['section','section']);await page.evaluate(()=>{editor.toggleHTMLMode();editor.setContent('<p>After source</p>');});
    });

    await check('Spelling proofing scans words, provides Word suggestions, adds to user dictionary and skips Nepali text', async () => {
        const result = await page.evaluate(async () => {
            editor.setContent('<p>This is a test with a dictonary and good sugestion in नेपाली भाषा.</p>');
            const isDictKnown = editor.isWordInDictionary('dictionary');
            const isWrongKnown = editor.isWordInDictionary('dictonary');
            const suggestions = editor.getWordSuggestions('dictonary');
            const sugestionSuggs = editor.getWordSuggestions('sugestion');
            const erfectSuggs = editor.getWordSuggestions('erfect');
            
            const scan = editor.scanMisspelledWords();
            const flaggedWords = scan.map(s => s.word);
            
            // Test spell dialog
            editor.showSpellCheckDialog();
            const dialog = editor.container.querySelector('.custom-spelling-dialog');
            const contextSentence = dialog.querySelector('.custom-spelling-sentence').textContent;
            const flaggedInDialog = dialog.querySelector('.custom-spelling-flagged').textContent;
            const displayedSuggestions = Array.from(dialog.querySelectorAll('.custom-spelling-sugg-item')).map(it => it.textContent);
            
            // Click Change on the first suggestion
            const changeBtn = dialog.querySelector('.custom-spelling-btn-primary');
            changeBtn.click();
            const afterChangeHtml = editor.getContent();
            
            // Add custom word to personal dictionary
            editor.addToUserDictionary('karta');
            const isCustomKnown = editor.isWordInDictionary('karta');
            
            // Close dialog
            dialog.remove();
            editor.spellDialog = null;
            
            return {
                isDictKnown,
                isWrongKnown,
                suggestions,
                sugestionSuggs,
                erfectSuggs,
                flaggedWords,
                flaggedInDialog,
                displayedSuggestions,
                afterChangeHtml,
                isCustomKnown
            };
        });
        assert.equal(result.isDictKnown, true);
        assert.equal(result.isWrongKnown, false);
        assert(result.suggestions.includes('dictionary'));
        assert(result.sugestionSuggs.includes('suggestion'));
        assert(result.erfectSuggs.includes('perfect'));
        assert.deepEqual(result.flaggedWords, ['dictonary', 'sugestion']);
        assert.equal(result.flaggedInDialog, 'dictonary');
        assert(result.displayedSuggestions.includes('dictionary'));
        assert.match(result.afterChangeHtml, /dictionary/);
        assert.equal(result.isCustomKnown, true);
        await page.evaluate(() => editor.setContent('<p>After source</p>'));
    });

    await check('Word ribbon groups tools, switches accessible tabs and keeps commands working', async () => {
        await page.evaluate(()=>{const field=document.createElement('textarea');field.id='ribbon-test';field.value='<p>Ribbon text</p>';document.body.appendChild(field);window.ribbonEditor=new Xoditor(field,{autoSave:false});});
        const ribbon=page.locator('.word-ribbon').last();
        assert(await ribbon.locator('.ribbon-quick-access').getByRole('button',{name:'Edit HTML',exact:true}).isVisible());
        assert.equal(await ribbon.locator('[role="tabpanel"] [title="Edit HTML"]').count(),0);
        assert.equal(await ribbon.locator('[role="tab"]').count(),6);assert.equal(await ribbon.locator('[role="tabpanel"]:visible').count(),1);
        assert.equal(await ribbon.locator('[role="tab"][aria-selected="true"]').textContent(),'Home');
        await ribbon.getByRole('tab',{name:'Insert',exact:true}).click();assert(await ribbon.getByRole('button',{name:'Insert Table',exact:true}).isVisible());
        await ribbon.getByRole('tab',{name:'Insert',exact:true}).press('ArrowRight');assert.equal(await ribbon.locator('[role="tab"][aria-selected="true"]').textContent(),'Layout');
        await ribbon.getByRole('tab',{name:'Home',exact:true}).click();
        await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(ribbonEditor.editor.querySelector('p'));getSelection().removeAllRanges();getSelection().addRange(range);ribbonEditor.rememberSelection();});
        await ribbon.getByRole('button',{name:'Bold (Ctrl+B)',exact:true}).click();
        assert(await page.evaluate(()=>Array.from(ribbonEditor.editor.querySelectorAll('b,strong,span')).some(node=>Number(getComputedStyle(node).fontWeight)>=600)));
        await page.setViewportSize({width:390,height:800});await ribbon.getByRole('tab',{name:'Home',exact:true}).click();
        assert(await ribbon.locator('.custom-size-input').isVisible());
        await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{ribbonEditor.destroy();document.querySelector('#ribbon-test').remove();});
    });

    await check('Nested formatting spans and whitespace spans collapse into single consolidated spans', async () => {
        const result = await page.evaluate(() => {
            const previous = editor.getContent();
            const snippet = `<p>
    <span style="font-weight: bold; text-decoration-line: underline; font-style: italic;">
        <span style="font-family: &quot;Times New Roman&quot;; font-size: 25px;">sjdfbasldf asdkfnasldkfn asdfasd lkasdnfl kasndflk skldnfas</span>
        <span style="font-size: 25px;"> </span>
    </span>
</p>
<p style="font-family: &quot;Times New Roman&quot;;">
    <span style="font-weight: bold; text-decoration-line: underline; font-style: italic;">
        <span style="font-size: 25px;">laksdnfalksdfn</span>
    </span>
</p>
<p style="font-family: &quot;Times New Roman&quot;;">
    <span style="font-weight: bold; text-decoration-line: underline; font-style: italic;">
        <span style="font-size: 25px;">sdkfnalsdkfnasldkfn alksdnfalksdnf akldsnflkasnd</span>
    </span>
</p>
<p style="font-family: &quot;Times New Roman&quot;; font-size: 25px;">
    <span style="font-size: 25px; font-weight: bold; text-decoration-line: underline; font-style: italic;">sdfasd asdfasd asdfad sasdfadfsadfasdf sdfasdfasdf</span>
</p>`;
            editor.setContent(snippet);
            const content = editor.getContent();
            const doc = new DOMParser().parseFromString(content, 'text/html');
            const paragraphs = Array.from(doc.querySelectorAll('p'));
            const nestedSpans = doc.querySelectorAll('span span').length;
            const p1Spans = paragraphs[0].querySelectorAll('span').length;
            const p2Spans = paragraphs[1].querySelectorAll('span').length;
            const p3Spans = paragraphs[2].querySelectorAll('span').length;
            const p4Spans = paragraphs[3].querySelectorAll('span').length;
            editor.setContent(previous);
            return {
                nestedSpans,
                p1Spans,
                p2Spans,
                p3Spans,
                p4Spans,
                content
            };
        });
        assert.equal(result.nestedSpans, 0);
        assert.equal(result.p1Spans, 1);
        assert.equal(result.p2Spans, 1);
        assert.equal(result.p3Spans, 1);
        assert.equal(result.p4Spans, 1);
    });

    await check('Enter on styled empty line moves down on first press and ensures breaks in empty paragraphs', async () => {
        await page.evaluate(() => {
            editor.setContent('<p style="text-align: center; font-weight: 700; font-family: &quot;Times New Roman&quot;, Times, serif; font-size: 16px; color: rgb(0, 0, 0);"><br></p>');
            editor.placeCaret(editor.editor.querySelector('p'));
        });
        await page.locator('#xoditor-1 .editor-content').press('Enter');
        const res = await page.evaluate(() => {
            const ps = Array.from(editor.editor.querySelectorAll('p'));
            const rect0 = ps[0]?.getBoundingClientRect(), rect1 = ps[1]?.getBoundingClientRect();
            return {
                count: ps.length,
                p0HasBr: !!ps[0]?.querySelector('br'),
                p1HasBr: !!ps[1]?.querySelector('br'),
                p0Height: rect0?.height || 0,
                p1Height: rect1?.height || 0,
                p1Top: rect1?.top || 0,
                p0Top: rect0?.top || 0
            };
        });
        assert.equal(res.count, 2);
        assert.equal(res.p0HasBr, true);
        assert.equal(res.p1HasBr, true);
        assert(res.p0Height > 0);
        assert(res.p1Height > 0);
        assert(res.p1Top > res.p0Top);
        await page.keyboard.type('2');
        const typed = await page.evaluate(() => editor.getContent());
        assert.match(typed, /<p[^>]*>[\s\S]*?2[\s\S]*?<\/p>/);
        assert.doesNotMatch(typed, /<p[^>]*>\s*<\/p>/);
        await page.evaluate(() => editor.setContent('<p>After source</p>'));
    });

    await check('Destroy restores textarea and prevents form submission from toolbar buttons', async () => {
        const result=await page.evaluate(() => {editor.destroy();editor.destroy();return {value:document.querySelector('#first').value,display:document.querySelector('#first').style.display,submits,remaining:document.querySelectorAll('.xoditor').length};});
        assert.match(result.value,/After source/);assert.equal(result.display,'');assert.equal(result.submits,0);assert.equal(result.remaining,1);
    });
    await check('Custom cell padding survives reselection, export and undo/redo', async () => {
        const result = await page.evaluate(() => {
            const host = document.createElement('textarea'); document.body.appendChild(host);
            const ed = new Xoditor(host, {autoSave:false});
            ed.setContent('<table><tbody><tr><td>पहिलो</td><td>Second</td></tr></tbody></table>');
            ed.selectCell(ed.editor.querySelector('td'), false);
            ed.applyTablePadding('8 12 16 20');
            const applied = ed.editor.querySelector('td').style.padding;
            ed.selectCell(ed.editor.querySelectorAll('td')[1], false);
            ed.selectCell(ed.editor.querySelector('td'), false);
            const restored = ed.tablePaddingInput.value;
            const html = ed.getContent();
            ed.performUndo(); const undone = ed.editor.querySelector('td').style.padding;
            ed.performRedo(); const redone = ed.editor.querySelector('td').style.padding;
            ed.setContent(html); const loaded = ed.editor.querySelector('td').style.padding;
            ed.destroy(); host.remove(); return {applied,restored,undone,redone,loaded};
        });
        assert.equal(result.applied,'8px 12px 16px 20px');
        assert.equal(result.restored,'8 12 16 20');
        assert.equal(result.undone,'');
        assert.equal(result.redone,result.applied);
        assert.equal(result.loaded,result.applied);
    });

    if (fs.existsSync(path.resolve(root,'../gwp_front/js/xoditor.js'))) {
    await page.addScriptTag({path:path.resolve(root,'../gwp_front/js/xoditor.js')});
    await page.addScriptTag({path:path.resolve(root,'../gwp_front/js/sunEditor.js')});
    await check('Darta adapter recreates modal editors and preserves host save/load API', async () => {
        const result=await page.evaluate(() => {
            const adapter=createKartaSunEditor('#first',{autoHeight:true,minHeight:200});
            adapter.value='<p>Modal content</p>';adapter.setReadOnly(true);
            const value=adapter.getEditorValue(),readOnly=adapter.editor.contentEditable;adapter.destroy();
            const reopened=createKartaSunEditor('#first',{});const reopenedValue=reopened.value;reopened.destroy();
            return {value,readOnly,reopenedValue};
        });
        assert.equal(result.value,'<p>Modal content</p>');assert.equal(result.readOnly,'false');assert.equal(result.reopenedValue,result.value);
    });
    }
    assert.deepEqual(errors,[]);
    await browser.close();
    console.log('All browser checks passed in ' + engine + '.');
})().catch(error => {console.error(error);process.exit(1);});
