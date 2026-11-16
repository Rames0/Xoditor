const fs=require('node:fs'),path=require('node:path');
const {minify}=require('terser');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'vendor');
fs.mkdirSync(destination,{recursive:true});
(async()=>{
 const cm=path.dirname(require.resolve('codemirror/package.json'));
 const files=['lib/codemirror.js','mode/xml/xml.js','mode/javascript/javascript.js','mode/css/css.js','mode/htmlmixed/htmlmixed.js','addon/fold/foldcode.js','addon/fold/foldgutter.js','addon/fold/xml-fold.js','addon/fold/brace-fold.js','addon/fold/comment-fold.js','addon/edit/matchtags.js','addon/edit/closetag.js','addon/edit/matchbrackets.js','addon/edit/closebrackets.js'];
 files.push('addon/dialog/dialog.js','addon/search/searchcursor.js','addon/search/search.js','addon/search/jump-to-line.js');
 const code=files.map(file=>fs.readFileSync(path.join(cm,file),'utf8')).join('\n');
 fs.writeFileSync(path.join(destination,'codemirror.min.js'),'/* CodeMirror 5.65.21, MIT; see ../THIRD_PARTY_NOTICES.md */\n'+(await minify(code)).code+'\n');
 fs.writeFileSync(path.join(destination,'codemirror.css'),['lib/codemirror.css','addon/fold/foldgutter.css','addon/dialog/dialog.css'].map(file=>fs.readFileSync(path.join(cm,file),'utf8')).join('\n'));
 const prettier=path.dirname(require.resolve('prettier/package.json'));
 fs.writeFileSync(path.join(destination,'prettier-html.min.js'),'/* Prettier 3.8.3, MIT; see ../THIRD_PARTY_NOTICES.md */\n'+['standalone.js','plugins/html.js','plugins/postcss.js'].map(file=>fs.readFileSync(path.join(prettier,file),'utf8')).join('\n'));
 fs.writeFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),'# Third-party notices\n\n## CodeMirror\n\n'+fs.readFileSync(path.join(cm,'LICENSE'),'utf8')+'\n## Prettier\n\n'+fs.readFileSync(path.join(prettier,'LICENSE'),'utf8'));
 console.log('Built local CodeMirror and HTML formatter assets.');
})().catch(error=>{console.error(error);process.exitCode=1;});
