const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.resolve(root, '../gwp_front/js/vendor/xoditor');
for (const directory of ['dist']) {
    fs.mkdirSync(path.join(destination, directory), {recursive:true});
    for (const file of fs.readdirSync(path.join(root, directory))) {
        const source = path.join(root, directory, file);
        if (fs.statSync(source).isFile()) fs.copyFileSync(source, path.join(destination, directory, file));
    }
}
// GWP uses its shared js/fonts directory.
fs.rmSync(path.join(destination,'fonts'),{recursive:true,force:true});
// Remove obsolete page-specific copies from the earlier trial.
fs.rmSync(path.join(destination,'vendor'),{recursive:true,force:true});
console.log('Xoditor assets copied to gwp_front/js/vendor/xoditor');
