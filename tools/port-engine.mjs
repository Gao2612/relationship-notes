// One-time prototype migration utility. Never part of build or runtime.
// Requires explicit opt-in, exact known inputs, and an exclusive backup.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
if(args.length!==1||args[0]!=='--overwrite'){
 console.log('One-time migration only. Usage: node tools/port-engine.mjs --overwrite');
 console.log('Requires the approved prototype and unchanged engine baseline; creates a backup before writing.');
 process.exit(args.includes('--help')?0:1);
}
const digest=value=>createHash('sha256').update(value).digest('hex');
const sourceUrl=new URL('../../relationship-plugin-prototype/index.html',import.meta.url);
const targetUrl=new URL('../src/engine.js',import.meta.url);
const sourceBytes=await readFile(sourceUrl),targetBytes=await readFile(targetUrl);
if(digest(sourceBytes)!=='b3d2b90b6f62e9e82ec8db060e7c0099e823c3f525e611fc02a3bf5ea6ca0af1')throw Error('Prototype baseline changed; refusing migration.');
if(digest(targetBytes)!=='13443aa7c38f1726902494c083fb7766e04f4faf345e49345c0da790dfbda256')throw Error('Engine was edited after migration baseline; refusing overwrite.');
const source=sourceBytes.toString('utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
let code=section('const MAX_BYTES=', 'function identityReady()')+'\n'+section("const cityWords=",'function appendText(');
const errors=[...code.matchAll(/throw Error\(('(?:[^'\\]|\\.)*')\)/g)].map(x=>x[1]);
const unique=[...new Set(errors)];
unique.forEach((s,i)=>code=code.replaceAll('throw Error('+s+')','throw new ImportError("parse'+i+'")'));
code=code.replace(/throw Error\('第 '\+\(i\+1\)\+' 行无法识别：请使用“发送者: 正文”或“\[时间\] 发送者”加后续正文。'\)/,'throw new ImportError("line", {line:i+1})');
const backupDirectory=new URL('./backups/',import.meta.url);
await mkdir(backupDirectory,{recursive:true});
const backupUrl=new URL('engine-'+new Date().toISOString().replace(/[:.]/g,'-')+'.js.bak',backupDirectory);
await copyFile(targetUrl,backupUrl,constants.COPYFILE_EXCL);
// Recheck immediately before replacement to detect concurrent edits.
if(digest(await readFile(targetUrl))!==digest(targetBytes))throw Error('Engine changed during migration; refusing overwrite.');
await writeFile(targetUrl,`// Pure port of the approved prototype parser/extractor; no browser or host access.\nexport class ImportError extends Error { constructor(code,details={}) { super(code); this.code=code; this.details=details; } }\n${code}\nexport {MAX_BYTES,MAX_MESSAGES,sampleChat,parseChat,extractFacts};\n`);
await mkdir(new URL('./generated/',import.meta.url),{recursive:true});
await writeFile(new URL('./generated/parser-errors.json',import.meta.url),JSON.stringify(Object.fromEntries(unique.map((s,i)=>['error.parse'+i,JSON.parse('"'+s.slice(1,-1).replaceAll('"','\\"')+'"')])) ,null,2)+'\n');
console.log('Ported exact parser/extractor; '+unique.length+' localized error IDs.');
