const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const extension = process.argv[2] || 'js';
if (!['js', 'css'].includes(extension)) throw new Error('Expected js or css');
const file = path.join(root, `dist/xoditor.min.${extension}`);
const banner = `/*! Xoditor v${pkg.version} | Open-source rich text editor
 * Developed by Ramesh Maharjan | https://rameshmaharjan.info.np
 * Copyright (c) 2026 Ramesh Maharjan | ${pkg.license} License
 * ${pkg.homepage}
 * Bundled third-party libraries retain their respective licenses.
 */\n`;
const code = fs.readFileSync(file, 'utf8').replace(/\/\*! Xoditor\b[\s\S]*?\*\/\s*/g, '');
fs.writeFileSync(file, banner + code);
