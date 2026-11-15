/** Offline-capable compiler. Uses bundled, licensed runtime snapshots from v1.
 * Source keeps conventional imports for inspection; this compiler resolves them
 * to local ESM. No runtime CDN, network calls, bundler, or font download is needed.
 */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,cp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageOffline} from './package-offline.mjs';
const require=createRequire(import.meta.url);
let ts;
try {ts=require('typescript')} catch {
  const {execFileSync}=await import('node:child_process');
  ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));
}
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out+'/app',{recursive:true});
for(const name of await readdir(root+'/src')) {
  if(!/\.tsx?$/.test(name))continue;
  const source=await readFile(root+'/src/'+name,'utf8');
  let code=ts.transpileModule(source,{fileName:name,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  code=code.replace(/from ["'](react(?:\/jsx-runtime)?|react-dom\/client)["']/g,"from '../vendor/react-runtime.js'")
    .replace(/from ["']three["']/g,"from '../vendor/three.js'")
    .replace(/from (["'])(\.\/[^"']+?)\1/g,(_,q,p)=>`from ${q}${p.endsWith('.js')?p:p+'.js'}${q}`)
    .replace(/import ['"]\.\/styles\.css['"];?/g,'')
    .replace(/import\.meta\.env\.PROD/g,'true');
  await writeFile(out+'/app/'+name.replace(/\.tsx?$/,'.js'),code);
}
await cp(root+'/vendor',out+'/vendor',{recursive:true});await cp(root+'/public',out,{recursive:true});
await cp(root+'/src/styles.css',out+'/styles.css');
await writeFile(out+'/index.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7f2e9"><meta name="description" content="A cinematic, interactive pendulum atelier. Explore oscillations, measure gravity and bridge mechanics with electrical oscillations."><title>Time in Motion | Sakura Atelier</title><link rel="icon" href="./favicon.svg"><link rel="manifest" href="./manifest.webmanifest"><link rel="stylesheet" href="./styles.css"></head><body><div id="root"></div><noscript>This interactive laboratory needs JavaScript. Source and physics notes are included in the download.</noscript><script type="module" src="./app/main.js"></script></body></html>`);
await packageOffline();
await rm(root+'/docs',{recursive:true,force:true});await cp(out,root+'/docs',{recursive:true});
console.log('Built dist/ and GitHub Pages docs/ using local runtime snapshots.');
