const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const assets = new Set(['/src/index.mjs', '/src/modules/extensions.mjs', '/dist/xoditor.min.js']);
const server = http.createServer((request, response) => {
    if (request.url === '/') {
        response.setHeader('Content-Type', 'text/html');
        return response.end('<textarea id="one"></textarea><textarea id="two"></textarea>');
    }
    if (!assets.has(request.url)) {
        response.statusCode = 404;
        return response.end();
    }
    response.setHeader('Content-Type', 'text/javascript');
    fs.createReadStream(path.join(root, request.url)).pipe(response);
});

(async () => {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const executablePath = process.env.TEST_CHROMIUM_EXECUTABLE ??
        ['/usr/bin/brave-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => fs.existsSync(file));
    const browser = await chromium.launch({executablePath});
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port);
        const result = await page.evaluate(async () => {
            const {Xoditor} = await import('/src/index.mjs');
            const changes = [];
            let disposed = 0;
            const first = new Xoditor('#one', {
                autoSave: false,
                plugins: [editor => {
                    editor.registerCommand('fixture:insert', ed => ed.insertMarkup('<p>नमस्ते</p>'));
                    return () => disposed++;
                }]
            });
            const second = new Xoditor('#two', {autoSave: false});
            first.on('change', ({html}) => changes.push(html));
            first.execute('fixture:insert');
            first.setReadOnly(true);
            first.execute('fixture:insert');
            const firstText = first.getText();
            const secondText = second.getText();
            first.destroy();
            first.destroy();
            second.destroy();
            return {firstText, secondText, changes, disposed};
        });
        assert.deepEqual(result, {
            firstText: 'नमस्ते', secondText: '',
            changes: ['<p>नमस्ते</p>'], disposed: 1
        });
        console.log('PASS browser module import, plugin command, change event, read-only and cleanup');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => server.close());
