import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const pkg=JSON.parse(read('./package.json'));
const client=read('./client.js');
new Function(client);
assert.match(client,/window\.__ModuleLoader__\.load/);
const appSource=read('./src/workspace.js');
assert.doesNotMatch(appSource,/ctx\.styles|iframe|dangerouslySetInnerHTML|localStorage|sessionStorage/);
assert.match(appSource,/ctx\.subdsh\.register/);
assert.doesNotMatch(client,/sidebar\.panellist|sidebar\.workspaces|ctx\.slots/);
assert.match(client,/消息均衡度|互动评分/);
assert.match(client,/useSyncExternalStore/);
assert.match(client,/AbortController/);
assert.match(pkg.version,/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
for(const p of ['index.js','reply-service.js','src/analysis.js','client.js','cordis.patch.yml','icon.svg'])assert(existsSync(new URL(p,import.meta.url)),p);
const zh=JSON.parse(read('./locale/zh.json')),en=JSON.parse(read('./locale/en.json'));
assert.deepEqual(Object.keys(zh).sort(),Object.keys(en).sort());
console.log('PASS packaged factory, native sidebar, source files, locales, cancellation and no embedded credential/storage UI');
const fs=await import('node:fs/promises');
const tests=(await fs.readdir(new URL('./src/',import.meta.url),{recursive:true})).filter(name=>name.endsWith('.test.mjs')).map(name=>'src/'+name.replaceAll('\\','/'));
tests.push(...(await fs.readdir(new URL('.',import.meta.url))).filter(name=>name.endsWith('.test.mjs')));
const childEnv={...process.env};
delete childEnv.NODE_TEST_CONTEXT;
delete childEnv.NODE_OPTIONS;
let totalPass=0,totalFail=0;
const failures=[];
for(const p of tests.sort()){
 const r=spawnSync(process.execPath,['--test','--test-reporter=tap',fileURLToPath(new URL(p,import.meta.url))],{encoding:'utf8',env:childEnv});
 const out=(r.stdout||'')+(r.stderr||'');
 if(/skipping running files/.test(out)){failures.push(p+' (child skipped running files)');continue;}
 const pass=Number((/# pass (\d+)/.exec(out)||[])[1]);
 const fail=Number((/# fail (\d+)/.exec(out)||[])[1]);
 if(!/^# pass \d+$/m.test(out)){failures.push(p+' (no test report emitted)');continue;}
 totalPass+=pass;totalFail+=fail;
 if(fail>0||r.status!==0||pass===0)failures.push(p+' ('+pass+' pass / '+fail+' fail)\n'+out.split('\n').filter(l=>/^not ok |error:|Error:|expected|actual/.test(l)).slice(0,12).join('\n'));
}
if(failures.length)console.error('FAILED:\n'+failures.join('\n\n'));
console.log('REAL COUNTS: '+totalPass+' pass / '+totalFail+' fail across '+tests.length+' test files');
assert.deepEqual(failures,[],'test failures');
console.log('PASS Relationship Notes '+pkg.version+' verification ('+tests.length+' test files, '+totalPass+' assertions pass)');
