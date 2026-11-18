const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['dist', 'src', 'vendor', 'fonts', 'site', 'tools-table.html', 'robots.txt', 'sitemap.xml', 'googlebf2522c5c08a9d4b.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace('../gwp_front/css/bootstrapV5_3_3/css/bootstrap.min.css', 'vendor/bootstrap.min.css');
fs.writeFileSync(path.join(output, 'index.html'), index);
console.log('Static site built in public/');
