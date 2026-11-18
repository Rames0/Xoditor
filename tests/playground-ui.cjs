const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const text = 'नेपाली कार्यालय २०८३ | English 2026';
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/playground-bilingual.html'), 'utf8');
const url = process.env.XODITOR_URL || 'http://127.0.0.1:8765/';
const browserPath = process.env.TEST_CHROMIUM_EXECUTABLE || (fs.existsSync('/usr/bin/brave-browser') ? '/usr/bin/brave-browser' : undefined);

(async () => {
    const browser = await chromium.launch({executablePath: browserPath});
    const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    const editor = page.locator('.editor-content');
    const bold = page.getByRole('button', {name: 'Bold (Ctrl+B)', exact: true});
    const artifactDir = path.resolve(__dirname, '../test-results/playground');
    fs.mkdirSync(artifactDir, {recursive: true});
    const paste = async html => {
        await page.evaluate(async html => {
            await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type: 'text/html'})})]);
        }, html);
        await page.keyboard.press('Control+v');
    };
    const select = async (selector, value) => {
        await editor.locator(selector).first().evaluate((block, value) => {
            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const offset = node.data.indexOf(value);
                if (offset < 0) continue;
                const range = document.createRange();
                range.setStart(node, offset);
                range.setEnd(node, offset + value.length);
                getSelection().removeAllRanges();
                getSelection().addRange(range);
                return;
            }
            throw Error('Text missing: ' + value);
        }, value);
    };
    const checkMarkup = async html => {
        assert.doesNotMatch(html, /<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]\b)[\s\S])*?<(?:p|ol|ul|table)\b/i);
        const structure = await page.evaluate(html => {
            const body = new DOMParser().parseFromString(html, 'text/html').body;
            const nodes = [...body.children];
            const heading = nodes.find(node => node.textContent === 'Fixture heading');
            return {
                tags: nodes.slice(nodes.indexOf(heading), nodes.indexOf(heading) + 4).map(node => node.tagName),
                text: heading?.nextElementSibling?.textContent,
                fonts: [...(heading?.nextElementSibling?.querySelectorAll('span') || [])].map(node => node.style.fontFamily),
                list: body.querySelector('ol > li > ul > li')?.textContent,
                spans: [...body.querySelectorAll('[colspan],[rowspan]')].map(node => node.getAttribute('colspan') || node.getAttribute('rowspan')),
                image: body.querySelector('img[alt="Fixture image"]')?.getAttribute('src')
            };
        }, html);
        assert.deepEqual(structure, {tags: ['H2', 'P', 'OL', 'TABLE'], text, fonts: ['Kalimati', 'Arial'], list: 'Nested', spans: ['2', '2'], image: 'data:image/png;base64,' + png});
    };
    const replace = async html => {
        await editor.click();
        await page.keyboard.press('Control+a');
        await paste(html);
    };
    const weight = (selector, word) => editor.locator(selector).first().evaluate((block, word) => {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if (walker.currentNode.data.includes(word)) return Number(getComputedStyle(walker.currentNode.parentElement).fontWeight);
        }
        throw Error('Text missing: ' + word);
    }, word);
    const cases = {
        'rich-replace-export': async () => {
            assert.equal(await editor.locator(':scope > h2').count(), 1);
            await replace(fixture);
            assert.equal(await editor.locator(':scope > h2').count(), 1);
            await checkMarkup(await editor.innerHTML());
            assert(await editor.locator('img[alt="Fixture image"]').evaluate(async image => {
                await image.decode();
                return image.naturalWidth > 0;
            }));
            const downloading = page.waitForEvent('download');
            await page.getByRole('button', {name: 'Download document HTML'}).click();
            const download = await downloading;
            const exported = path.join(artifactDir, 'downloaded-document.html');
            await download.saveAs(exported);
            await checkMarkup(fs.readFileSync(exported, 'utf8'));
        },
        'empty-paste': async () => {
            await editor.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await paste(fixture);
            await checkMarkup(await editor.innerHTML());
        },
        'partial-heading-paste': async () => {
            const original = await editor.locator(':scope > h2').textContent();
            await editor.click();
            await select('h2', 'little room');
            await paste(fixture);
            await checkMarkup(await editor.innerHTML());
            assert.equal(await editor.locator(':scope > h2').first().textContent(), original.split('little room')[0]);
            assert.equal(await editor.locator(':scope > h2').nth(2).textContent(), original.split('little room')[1]);
        },
        'paragraph-bold': async () => {
            await replace('<p>Before <span style="font-weight:700">target</span> after</p>');
            await select('p', 'target');
            await page.keyboard.press('Control+b');
            assert((await weight('p', 'target')) < 600);
            await bold.click();
            assert((await weight('p', 'target')) >= 600);
            assert.equal(await editor.locator('p').textContent(), 'Before target after');
        },
        'heading-bold': async () => {
            await replace('<h2>Before target after</h2>');
            await select('h2', 'target');
            await bold.click();
            assert((await weight('h2', 'target')) < 600);
            await page.keyboard.press('Control+b');
            assert((await weight('h2', 'target')) >= 600);
            assert.equal(await editor.locator('h2').textContent(), 'Before target after');
        },
        'paste-bold-history': async () => {
            await replace('<p>Fresh pasted target</p>');
            await select('p', 'target');
            await page.keyboard.press('Control+b');
            assert((await weight('p', 'target')) >= 600);
            for (const method of ['keyboard', 'toolbar']) {
                if (method === 'keyboard') await page.keyboard.press('Control+z');
                else await page.getByRole('button', {name: /^Undo/}).click();
                assert.equal(await editor.locator('p').textContent(), 'Fresh pasted target');
                assert((await weight('p', 'target')) < 600);
                if (method === 'keyboard') await page.keyboard.press('Control+y');
                else await page.getByRole('button', {name: /^Redo/}).click();
                assert((await weight('p', 'target')) >= 600);
            }
        },
        'bold-input-equivalence': async () => {
            const fixtures = [
                {html: '<p>Before target after</p>', block: 'p', expected: 700},
                {html: '<h2>Before target after</h2>', block: 'h2', expected: 400},
                {html: '<h2>Before <span style="font-weight: normal">target</span> after</h2>', block: 'h2', expected: 700}
            ];
            for (const {html, block, expected} of fixtures) {
                for (const action of ['keyboard', 'toolbar']) {
                    await replace(html);
                    await select(block, 'target');
                    if (action === 'keyboard') await page.keyboard.press('Control+b');
                    else await bold.click();
                    assert.equal(await weight(block, 'target'), expected);
                    assert.equal(await editor.locator(block).textContent(), 'Before target after');
                    assert.equal(await bold.getAttribute('aria-pressed'), String(expected >= 600));
                }
            }
        },
        'partial-heading-bold-keeps-inline-formatting': async () => {
            await replace('<h2><em><u>Before target after</u></em></h2>');
            await select('h2', 'target');
            await bold.click();
            assert.equal(await weight('h2', 'target'), 400);
            assert.equal(await weight('h2', 'Before'), 700);
            assert.equal(await weight('h2', 'after'), 700);
            assert.equal(await editor.locator('h2 em u').textContent(), 'Before target after');
            await page.keyboard.press('Control+b');
            assert.equal(await weight('h2', 'target'), 700);
        },
        'heading-bold-after-redo': async () => {
            await replace('<h2>Shared fixture</h2><p>Fixture paragraph</p>');
            const heading = editor.locator('h2');
            await heading.click();
            const selectLine = async () => {
                await page.keyboard.press('Home');
                await page.keyboard.press('Shift+End');
            };
            const steps = [];
            const snapshot = async label => {
                const result = await heading.evaluate(node => {
                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
                    let text;
                    do { text = walker.nextNode(); } while (text && !text.length);
                    const button = document.querySelector('[title="Bold (Ctrl+B)"]');
                    return {
                        markup: node.outerHTML,
                        text: node.textContent,
                        weight: Number(getComputedStyle(text.parentElement).fontWeight),
                        active: button.classList.contains('active'),
                        pressed: button.getAttribute('aria-pressed'),
                        selection: getSelection().toString()
                    };
                });
                steps.push(result);
                console.log(label, JSON.stringify(result));
            };
            await selectLine();
            await snapshot('selected');
            await page.keyboard.press('Control+b');
            await snapshot('Ctrl+B');
            await page.keyboard.press('Control+z');
            await snapshot('Undo');
            await page.keyboard.press('Control+Shift+z');
            await snapshot('Redo');
            await selectLine();
            await snapshot('reselected');
            await bold.click();
            await snapshot('first click');
            assert.equal(steps[5].weight, 700);
            await bold.click();
            await snapshot('second click');
            assert.deepEqual(steps.map(step => step.weight), [700, 400, 700, 400, 400, 700, 400]);
            assert.deepEqual(steps.map(step => step.active), [true, false, true, false, false, true, false]);
            assert.deepEqual(steps.map(step => step.pressed), steps.map(step => String(step.active)));
            assert(steps.every(step => step.text === 'Shared fixture'));
            assert.equal(await heading.count(), 1);
            assert.equal(await editor.locator('p').textContent(), 'Fixture paragraph');
            await editor.locator('p').click();
            assert.equal(await bold.evaluate(node => node.classList.contains('active')), false);
        },
        'ribbon-keyboard': async () => {
            await editor.click();
            await select('h2', 'little room');
            await page.keyboard.press('Alt+F10');
            const tab = page.locator('.ribbon-tabs [role=tab]:focus');
            assert.equal(await tab.count(), 1);
            assert(await tab.evaluate(node => getComputedStyle(node).outlineStyle !== 'none'));
            for (let i = 0; i < 25 && !(await bold.evaluate(node => node === document.activeElement)); i++) {
                await page.keyboard.press('Tab');
            }
            assert(await bold.evaluate(node => node.matches(':focus-visible') && getComputedStyle(node).outlineStyle !== 'none'));
            await page.keyboard.press('Enter');
            assert((await weight('h2', 'little room')) < 600);
            await page.keyboard.press('Escape');
            assert(await editor.evaluate(node => node === document.activeElement && getSelection().toString() === 'little room'));
        }
    };
    try {
        for (const [name, run] of Object.entries(cases)) {
            if (process.env.TEST_CASE && name !== process.env.TEST_CASE) continue;
            await context.tracing.start({screenshots: true, snapshots: true});
            try {
                await page.goto(url);
                await editor.waitFor();
                await run();
                console.log('PASS ' + name);
                await context.tracing.stop();
            } catch (error) {
                console.error('FAIL ' + name + '\n' + error);
                process.exitCode = 1;
                await page.screenshot({path: path.join(artifactDir, name + '.png')});
                await context.tracing.stop({path: path.join(artifactDir, name + '.zip')});
            }
        }
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
