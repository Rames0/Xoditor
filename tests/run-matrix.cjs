const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root=path.resolve(__dirname,'..');
function getBrowsers() {
    if (process.env.TEST_BROWSERS) return process.env.TEST_BROWSERS.split(',');
    try {
        const check = spawnSync(process.execPath, ['-e', 'const {firefox} = require("playwright"); firefox.launch({headless:true}).then(b => b.close().then(() => process.exit(0))).catch(() => process.exit(1));'], {timeout: 4000});
        if (check.status === 0) return ['chromium', 'firefox'];
    } catch {}
    return ['chromium'];
}
const browsers=getBrowsers();
const variants=process.argv.includes('--dist')?['dist']:['source','dist'];
const results=[];
for(const browser of browsers)for(const variant of variants){
    const started=Date.now();
    const env={...process.env,TEST_BROWSER:browser};if(variant==='dist')env.TEST_EDITOR_DIST='1';else delete env.TEST_EDITOR_DIST;
    const result=spawnSync(process.execPath,[path.join(__dirname,'browser.test.cjs')],{cwd:root,env,encoding:'utf8',timeout:180000});
    const stdout=result.stdout||'',stderr=result.stderr||'';
    process.stdout.write('\n'+browser+' / '+variant+'\n'+stdout);if(stderr)process.stderr.write(stderr);
    results.push({browser,variant,status:result.status===0?'passed':'failed',checks:(stdout.match(/^PASS /gm)||[]).length,durationMs:Date.now()-started,error:result.error?.message||null});
}
const report={timestamp:new Date().toISOString(),results,totalChecks:results.reduce((sum,result)=>sum+result.checks,0)};
const destination=path.join(root,'test-results');fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'verification.json'),JSON.stringify(report,null,2)+'\n');
if(results.some(result=>result.status!=='passed'))process.exitCode=1;
else console.log('\nVerified '+report.totalChecks+' scenario runs across '+results.length+' configurations.');
