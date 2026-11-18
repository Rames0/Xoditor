const {chromium} = require('playwright');
const {AxeBuilder} = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async () => {
    const executable = process.env.TEST_CHROMIUM_EXECUTABLE || (fs.existsSync('/usr/bin/brave-browser') ? '/usr/bin/brave-browser' : undefined);
    const browser = await chromium.launch({headless:true, ...(executable ? {executablePath:executable} : {})});
    const reports = [];
    try {
        for (const [layout, width] of [['desktop', 1440], ['mobile', 390]]) {
            const context = await browser.newContext({viewport: {width, height: 844}, hasTouch: layout === 'mobile'});
            for (const file of ['index.html', 'tools-table.html']) {
                const page = await context.newPage();
                await page.goto(pathToFileURL(path.resolve(__dirname,'../public',file)).href);
                await page.waitForSelector('.editor-content');
                const report = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
                reports.push({file, layout, violations:report.violations});
                console.log(layout, file, JSON.stringify(report.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))));
                await page.close();
            }
            await context.close();
        }
        fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
        fs.writeFileSync(path.resolve(__dirname,'../test-results/accessibility.json'),JSON.stringify(reports,null,2));
        if(reports.some(r=>r.violations.some(v=>['critical','serious'].includes(v.impact)))) process.exitCode=1;
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
