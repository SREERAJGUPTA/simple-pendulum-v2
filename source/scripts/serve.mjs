/** Dependency-free, loopback-only static preview of the prebuilt docs directory. */
import http from 'node:http';
import path from 'node:path';
import {stat,readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs'));
const port=Number(process.env.PORT||8000);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be an integer from 1024 to 65535.');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain;charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=path.resolve(root,'.'+rel);
  if(target!==root&&!target.startsWith(root+path.sep))throw new Error('Outside site root');
  if((await stat(target)).isDirectory())target=path.join(target,'index.html');
  target=await realpath(target);
  if(!target.startsWith(root+path.sep))throw new Error('Outside site root');
  const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found. Open the site root.');}
});
server.on('error',e=>{console.error('Preview could not start:',e.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log(`Sakura Atelier: http://127.0.0.1:${port}\nPress Ctrl+C to stop. No install or build is needed to preview docs/.`));
