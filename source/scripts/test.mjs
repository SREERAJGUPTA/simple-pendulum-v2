/** Small offline runner for this project's synchronous Vitest-style tests.
 * It executes the unchanged original test cases plus the advanced test cases.
 * This is not Vitest; supported assertion semantics are explicit below.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const temp=root+'/.test-output';await mkdir(temp,{recursive:true});
await writeFile(temp+'/harness.mjs',`import assert from 'node:assert/strict';
export const results=[];let stack=[],before=[],after=[];const old=new Map();
export const describe=(name,fn)=>{stack.push(name);fn();stack.pop()};
export const beforeEach=fn=>before.push(fn);export const afterEach=fn=>after.push(fn);
export function it(name,fn){try{for(const f of before)f();fn();results.push({name:[...stack,name].join(' / '),status:'passed'})}catch(e){results.push({name:[...stack,name].join(' / '),status:'failed',error:e.stack})}finally{for(const f of after)f()}}
it.each=values=>(name,fn)=>values.forEach(v=>it(name.replace('%s',String(v)),()=>fn(v)));
export const vi={stubGlobal:(key,val)=>{if(!old.has(key))old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value:val,writable:true,configurable:true})},unstubAllGlobals:()=>{for(const [k,d] of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}old.clear()}};
export function expect(actual){return {
 toBe:v=>assert.ok(Object.is(actual,v),String(actual)+' is not '+String(v)),
 toEqual:v=>assert.deepStrictEqual(actual,v),
 toMatchObject:v=>{for(const k of Object.keys(v))assert.deepStrictEqual(actual[k],v[k])},
 toBeCloseTo:(v,d=2)=>assert.ok(Math.abs(actual-v)<.5*10**(-d),actual+' is not close to '+v+' at '+d+' digits'),
 toBeLessThan:v=>assert.ok(actual<v,actual+' is not < '+v),
 toBeLessThanOrEqual:v=>assert.ok(actual<=v,actual+' is not <= '+v),
 toBeGreaterThan:v=>assert.ok(actual>v,actual+' is not > '+v),
 toBeGreaterThanOrEqual:v=>assert.ok(actual>=v,actual+' is not >= '+v),
 toBeNull:()=>assert.equal(actual,null),toThrow:()=>assert.throws(actual),
 toHaveLength:n=>assert.equal(actual.length,n),toContain:s=>assert.ok(actual.includes(s)),
 not:{toContain:s=>assert.ok(!actual.includes(s))}
}}
`);
for(const file of ['physics.test.ts','records.test.ts','advanced.test.ts']){
 let code=ts.transpileModule(await readFile(root+'/tests/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/from ['"]vitest['"]/g,"from './harness.mjs'").replace(/from ['"]\.\.\/src\/([^'"]+)['"]/g,"from '../dist/app/$1.js'");
 const output=temp+'/'+file.replace('.ts','.mjs');await writeFile(output,code);await import(output+'?v='+Date.now());
}
const {results}=await import(temp+'/harness.mjs');
const failures=results.filter(r=>r.status!=='passed');
const report={runner:'Project offline synchronous assertion runner (not Vitest)',date:new Date().toISOString(),passed:results.length-failures.length,total:results.length,checks:results};
await mkdir(root+'/verification',{recursive:true});await writeFile(root+'/verification/science-tests.json',JSON.stringify(report,null,2));
console.log(report.passed+'/'+report.total+' checks passed.');for(const fail of failures)console.error(fail.name,fail.error);
if(failures.length)process.exitCode=1;
