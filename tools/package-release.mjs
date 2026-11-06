import {readdir,readFile,mkdir,mkdtemp,copyFile,writeFile,stat,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

function globPattern(pattern){
 const parts=pattern.split('/').map(part=>part==='**'?'(?:[^/]+/)*':part.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','[^/]*'));
 return new RegExp('^'+parts.join('/').replaceAll('(?:[^/]+/)*/','(?:[^/]+/)*')+'$');
}

export async function collectReleaseFiles(root,pkg){
 const patterns=pkg.files.map(globPattern);
 const selected=[];
 async function visit(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  for(const entry of entries){
   const absolute=join(directory,entry.name);
   const path=relative(root,absolute).split(sep).join('/');
   if(entry.isSymbolicLink()||['.git','node_modules'].includes(entry.name)||path==='docs/archive')continue;
   if(entry.isDirectory()){await visit(absolute);continue;}
   if(!entry.isFile()||/\.test\.|\.before-|(?:^|\/)standalone\./.test(path))continue;
   const documentation=/^(?:README\.md|LICENSE(?:\.md)?|package\.json|PDFJS-LICENSE\.md)$/.test(path)||path.startsWith('docs/')&&path.endsWith('.md');
   if(documentation||patterns.some(pattern=>pattern.test(path)))selected.push(path);
  }
 }
 await visit(root);
 return selected.sort();
}

export function zipStage(stage,archive){
 if(existsSync(archive))throw new Error('压缩包已存在，请使用新的输出目录。');
 const literal=value=>"'"+resolve(value).replaceAll("'","''")+"'";
 const command=`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stage=${literal(stage)}
$archive=${literal(archive)}
$zip=[IO.Compression.ZipFile]::Open($archive,[IO.Compression.ZipArchiveMode]::Create)
try {
 Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
  $name=$_.FullName.Substring($stage.Length).TrimStart([char]92,[char]47).Replace([char]92,[char]47)
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$name,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
 }
} finally { $zip.Dispose() }`;
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:'pipe'});
}

async function main(args){
 const outputIndex=args.indexOf('--out');
 const dryRun=args.includes('--dry-run');
 const allowed=args.filter((value,index)=>value!=='--dry-run'&&index!==outputIndex&&index!==outputIndex+1);
 if(outputIndex<0||!args[outputIndex+1]||args[outputIndex+1].startsWith('--')||allowed.length)throw new Error('用法 node tools/package-release.mjs --out <输出目录> [--dry-run]');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const output=resolve(args[outputIndex+1]);
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version))throw new Error('项目版本格式无效。');
 const files=await collectReleaseFiles(root,pkg);
 const client=await stat(join(root,'client.js'));
 for(const file of files.filter(file=>file.startsWith('src/')&&file.endsWith('.js'))){
  if((await stat(join(root,file))).mtimeMs>client.mtimeMs)throw new Error('源码比客户端产物新，请先运行构建。');
 }
 if(dryRun){console.log(files.join('\n'));return;}
 await mkdir(output,{recursive:true});
 const base='relationship-notes-'+pkg.version;
 const archive=join(output,base+'.zip');
 const checksum=join(output,base+'.sha256');
 const manifest=join(output,base+'.manifest.json');
 if([archive,checksum,manifest].some(existsSync))throw new Error('输出文件已存在，请使用新的输出目录。');
 const stage=await mkdtemp(join(output,'.stage-'));
 try{
  const entries=[];
  for(const file of files){
   const target=join(stage,file);
   await mkdir(dirname(target),{recursive:true});
   await copyFile(join(root,file),target);
   const data=await readFile(target);
   entries.push({path:file,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  }
  zipStage(stage,archive);
  const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(checksum,digest+'  '+base+'.zip\n',{flag:'wx'});
  await writeFile(manifest,JSON.stringify({version:pkg.version,files:entries},null,2)+'\n',{flag:'wx'});
  console.log(archive);
 }finally{
  // 暂存目录由本进程创建，删除前核对父目录与名称。
  if(dirname(stage)!==output||!relative(output,stage).startsWith('.stage-'))throw new Error('暂存目录校验失败。');
  await rm(stage,{recursive:true,force:true});
 }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 await main(process.argv.slice(2));
}
