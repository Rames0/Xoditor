'use strict';
const samples = {
    brief: `<h2 style="font-size:32px;color:#20342c;">A little room for big ideas.</h2><p style="color:#71806e;font-size:14px;">PROJECT BRIEF &nbsp; / &nbsp; FIELD NOTES NO. 01</p><p>Every good project begins with a conversation. This is a place to collect the important details, give them a little structure, and turn the first draft into something worth sharing.</p><h3>What we're making</h3><p>A considered workspace for people who spend their day with words. <strong>Useful tools. Thoughtful details.</strong> Enough flexibility to make it your own.</p><ul><li>Select this text and try a different font.</li><li>Add a table to organize the next steps.</li><li>Open HTML view to see what is underneath.</li></ul><p style="font-style:italic;color:#68785f;">The best way to understand an editor is to write in it.</p>`,
    table: `<h2>Make a plan. Keep it clear.</h2><p>Click a cell to explore table tools. Add a row, change a border, or drag a column edge.</p><table style="width:100%;border-collapse:collapse;"><tbody><tr><th scope="col" style="border:1px solid #abb8a0;padding:12px;background:#edf2e5;"><strong>Workstream</strong></th><th scope="col" style="border:1px solid #abb8a0;padding:12px;background:#edf2e5;"><strong>Owner</strong></th><th scope="col" style="border:1px solid #abb8a0;padding:12px;background:#edf2e5;"><strong>Next step</strong></th></tr><tr><td style="border:1px solid #abb8a0;padding:12px;">Research</td><td style="border:1px solid #abb8a0;padding:12px;">Design team</td><td style="border:1px solid #abb8a0;padding:12px;">Collect field notes</td></tr><tr><td style="border:1px solid #abb8a0;padding:12px;">Prototype</td><td style="border:1px solid #abb8a0;padding:12px;">Engineering</td><td style="border:1px solid #abb8a0;padding:12px;">Build the first draft</td></tr></tbody></table><p>Tip: use the dedicated table workspace for a larger canvas.</p>`,
    nepali: `<h2 style="font-family:Kalimati;">आफ्ना विचारलाई आकार दिनुहोस्।</h2><p style="font-family:Kalimati;font-size:18px;">लेख्न, सम्पादन गर्न र कागजात तयार पार्न एउटा सरल ठाउँ। यहाँ नेपाली र अङ्ग्रेजी दुवै भाषामा लेख्न सक्नुहुन्छ।</p><h3 style="font-family:Kalimati;">बैठकको कार्यसूची</h3><ol style="font-family:Kalimati;font-size:18px;"><li>अघिल्लो बैठकको समीक्षा</li><li>आगामी कार्यक्रमको योजना</li><li>जिम्मेवारी र समयसीमा निर्धारण</li></ol><p style="font-family:Kalimati;font-size:18px;">माथिको कुनै शब्द छान्नुहोस् र अक्षरको आकार, रङ वा शैली परिवर्तन गरेर हेर्नुहोस्।</p>`
};
const demo = new Xoditor('#live-editor', { height: '500px', defaultFont: 'Arial', defaultFontSize: '16px', autoSave: false, stickyToolbar: false, ribbon: true, onChange: () => { if (!document.getElementById('html-output').hidden) updateOutput(); } });
let currentSample = 'brief';
let loadedContent = '';
const drafts = new Map();
function updateOutput() { document.getElementById('output-code').textContent = demo.getContent(); }
function loadSample(key) {
    if (loadedContent) drafts.set(currentSample, demo.getContent());
    currentSample = key;
    demo.setContent(drafts.get(key) || samples[key]);
    loadedContent = demo.getContent();
    document.querySelectorAll('[data-sample]').forEach(button => {
        const selected = button.dataset.sample === key;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('demo-status').textContent = 'Sample loaded. Your edits are kept when switching samples during this visit.';
    updateOutput();
}
loadSample(currentSample);
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => loadSample(button.dataset.sample)));
document.getElementById('reset-demo').addEventListener('click', () => { if (demo.getContent() !== samples[currentSample] && !confirm('Reset this sample and discard its edits?')) return; drafts.delete(currentSample); loadedContent = ''; loadSample(currentSample); });
document.getElementById('view-output').addEventListener('click', event => {
    const output = document.getElementById('html-output');
    output.hidden = !output.hidden;
    event.currentTarget.textContent = output.hidden ? 'Preview HTML output' : 'Hide HTML preview';
    event.currentTarget.setAttribute('aria-expanded', String(!output.hidden));
    updateOutput();
});
async function copyText(text, button) {
    const previous = button.textContent;
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = previous; }, 1800);
    } catch (_) { document.getElementById('demo-status').textContent = 'Clipboard unavailable. Select and copy the code manually.'; }
}
document.getElementById('copy-install').addEventListener('click', event => copyText(document.getElementById('install-code').textContent, event.currentTarget));
document.getElementById('copy-output').addEventListener('click', event => copyText(demo.getContent(), event.currentTarget));

const credits = document.createElement('span');
credits.textContent = ` · v${Xoditor.version} · Open source · `;
const licenseLink = document.createElement('a');
licenseLink.href = 'LICENSE';
licenseLink.textContent = `${Xoditor.license} license`;
const footerCredit = document.querySelector('.site-footer p');
footerCredit.append(credits, licenseLink);

document.querySelector('.sample-tabs').addEventListener('keydown', event => {
 const buttons = [...document.querySelectorAll('[data-sample]')];
 const index = buttons.indexOf(event.target);
 if (index < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
 event.preventDefault();
 const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
 loadSample(buttons[next].dataset.sample); buttons[next].focus();
});
