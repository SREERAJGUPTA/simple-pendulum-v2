/** Produce a portable HTML with every runtime module embedded in an import map. */
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const imports={};
for (const folder of ['app','vendor']) {
 for(const name of await readdir(path.join(root,'dist',folder))) {
  if(!name.endsWith('.js'))continue;
  const rel=folder+'/'+name;
  let code=await readFile(path.join(root,'dist',rel),'utf8');
  code=code.replace(/(from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\2/g,(all,lead,q,url)=>{
   return lead+q+'atelier/'+path.posix.normalize(path.posix.join(folder,url))+q;
  });
  imports['atelier/'+rel]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
 }
}
const notices=(await readFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8')).replaceAll('-->','-- >');
const css=await readFile(path.join(root,'dist','styles.css'),'utf8');
const html=`<!doctype html><!--\n${notices}\n--><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f8f5ef"><meta name="description" content="A self-contained pendulum laboratory. No internet connection required."><title>Time in Motion | Sakura Atelier</title><style>${css}</style><script type="importmap">${JSON.stringify({imports})}</script></head><body><div id="root"></div><noscript>Enable JavaScript to use this interactive laboratory.</noscript><script type="module">import 'atelier/app/main.js';</script></body></html>`;
await writeFile(path.join(root,'Time-in-Motion-Sakura.html'),html);
console.log('Built self-contained Time-in-Motion-Sakura.html',Buffer.byteLength(html),'bytes');
