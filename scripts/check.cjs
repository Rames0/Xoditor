const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const file of ['src/index.mjs','src/modules/extensions.mjs','src/xoditor.js','src/xoditor-enhancements.js','dist/xoditor.min.js','tests/browser.test.cjs','tests/run-matrix.cjs','scripts/deploy-gwp.cjs']){
    const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
    if(result.status!==0)throw new Error('Invalid JavaScript in '+file+'\n'+result.stderr);
}
JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const vendor=path.resolve(root,'../gwp_front/js/vendor/xoditor');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let checked=0;
if(process.argv.includes('--deployed')) for(const directory of ['dist'])for(const name of fs.readdirSync(path.join(root,directory))){
    const source=path.join(root,directory,name);if(!fs.statSync(source).isFile())continue;
    const deployed=path.join(vendor,directory,name);
    if(!fs.existsSync(deployed)||hash(source)!==hash(deployed))throw new Error('Deployed asset mismatch: '+directory+'/'+name);checked++;
}
console.log('Syntax, package files and '+checked+' deployed asset checks passed.');
