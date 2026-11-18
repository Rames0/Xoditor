const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/office-nepali.html'), 'utf8');

async function measure(browser, name, bundle) {
    const page = await browser.newPage();
    try {
        await page.setContent('<textarea id="editor"></textarea>');
        await page.addScriptTag({path: bundle});
        const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
        const result = await page.evaluate(async ({name, fixture}) => {
            const editor = name === 'Xoditor'
                ? new Xoditor('#editor', {autoSave: false, defaultFont: 'Arial'})
                : Jodit.make('#editor', {askBeforePasteHTML: false, askBeforePasteFromWord: false});
            window.benchmarkExport = () => name === 'Xoditor' ? editor.getContent() : editor.value;
            const surface = editor.editor;
            surface.focus();
            const range = document.createRange();
            range.selectNodeContents(surface);
            range.collapse(false);
            getSelection().removeAllRanges();
            getSelection().addRange(range);
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/html', fixture);
            clipboardData.setData('text/plain', new DOMParser().parseFromString(fixture, 'text/html').body.textContent);
            surface.dispatchEvent(new ClipboardEvent('paste', {clipboardData, bubbles: true, cancelable: true}));
            return {version: name === 'Xoditor' ? Xoditor.version : Jodit.version || null};
        }, {name, fixture});
        await page.waitForFunction(() => document.querySelector('[contenteditable=true] table'), undefined, {timeout: 3000}).catch(error => {
            if (error.name !== 'TimeoutError') throw error;
        });
        const checks = await page.evaluate(() => {
            const instance = document.querySelector('#editor');
            const surface = document.querySelector('[contenteditable=true]');
            // Use the public export from each editor rather than editor-only markup.
            const html = window.benchmarkExport();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return {
                nepaliText: ['रमेश', '१२३', 'सम्बन्ध प्रमाणित'].every(text => doc.body.textContent.includes(text)),
                nestedNumbering: Boolean(doc.querySelector('ol li ol')),
                mergedCells: Boolean(doc.querySelector('td[rowspan="2"]')),
                semanticHeaders: doc.querySelectorAll('th[scope="col"]').length === 2,
                font: [...doc.querySelectorAll('[style]')].some(node => /Kalimati/i.test(node.style.fontFamily)),
                link: Boolean(doc.querySelector('a[href="https://example.com/document"]')),
                cleanOfficeMarkup: !/mso-list|MsoNormal/i.test(html),
                pastedContent: Boolean(surface?.textContent.trim() && instance)
            };
        });
        return {name, ...result, bundleSha256: fingerprint, checks};
    } finally {
        await page.close();
    }
}

(async () => {
    const executablePath = process.env.TEST_CHROMIUM_EXECUTABLE ||
        ['/usr/bin/brave-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => fs.existsSync(file));
    const browser = await chromium.launch({executablePath});
    try {
        const editors = [['Xoditor', path.join(root, 'dist/xoditor.min.js')]];
        if (process.env.JODIT_BUNDLE) editors.push(['Jodit', path.resolve(process.env.JODIT_BUNDLE)]);
        const results = [];
        for (const [name, bundle] of editors) results.push(await measure(browser, name, bundle));
        const report = {fixture: 'office-nepali.html', browser: browser.version(), input: 'synthetic HTML clipboard', results};
        fs.mkdirSync(path.join(root, 'test-results'), {recursive: true});
        fs.writeFileSync(path.join(root, 'test-results/office-benchmark.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify(report, null, 2));
        if (Object.values(results[0].checks).some(pass => !pass)) process.exitCode = 1;
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
