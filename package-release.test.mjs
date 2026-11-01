import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {collectReleaseFiles,zipStage} from './tools/package-release.mjs';
import {execFileSync} from 'node:child_process';
test('Windows ZIP entries use portable forward slashes', {skip:process.platform!=='win32'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'relationship-package-test-'));
 try{
  const stage=join(root,'stage');await mkdir(join(stage,'src'),{recursive:true});await writeFile(join(stage,'src','entry.js'),'export const fixture=true;');
  const archive=join(root,'artifact.zip');zipStage(stage,archive);const literal=archive.replaceAll("'","''");
  const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead('"+literal+"'); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }"],{encoding:'utf8',windowsHide:true});
  assert.equal(result.trim(),'src/entry.js');
 }finally{if(dirname(resolve(root))!==resolve(tmpdir()))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true});}
});
test('release selection includes nested runtime imports and docs but excludes dependencies, archives and tests',async()=>{
 const root=await mkdtemp(join(tmpdir(),'relationship-package-test-'));
 try{for(const file of ['package.json','README.md','src/entry.js','src/shared/text.js','src/entry.test.mjs','node_modules/secret.js','docs/archive/legacy/page.js','docs/HOST-API.md']){await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),'fixture');}
 const selected=await collectReleaseFiles(root,{files:['src/**/*.js']});
 assert.deepEqual(selected,['README.md','docs/HOST-API.md','package.json','src/entry.js','src/shared/text.js']);
 }finally{const checked=resolve(root);if(dirname(checked)!==resolve(tmpdir())||!checked.includes('relationship-package-test-'))throw Error('Unsafe test cleanup');await rm(checked,{recursive:true,force:true});}
});
