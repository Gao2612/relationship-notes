import {readdir,readFile,mkdir,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {resolve,relative,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const digest=value=>createHash('sha256').update(value).digest('hex');
function glob(pattern){let value='';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'&&pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;value+='(?:.*/)?';}else value+='.*';}else if(c==='*')value+='[^/]*';else value+=c.replace(/[.+?^${}()|[\]\\]/g,'\\$&');}return new RegExp('^'+value+'$');}
export async function collectReleaseFiles(root,pkg){
 const patterns=(pkg.files||[]).map(glob),files=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=join(dir,entry.name),name=relative(root,full).split(sep).join('/');if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(!['node_modules','.git'].includes(entry.name)&&!name.startsWith('docs/archive')&&!name.startsWith('tools/backups')&&!name.startsWith('tools/generated'))await walk(full);}else if(patterns.some(p=>p.test(name))||name==='package.json'||/^(?:README|LICENSE)(?:\..*)?$/i.test(name)||(/\.md$/i.test(name)&&(!name.includes('/')||name.startsWith('docs/'))))files.push(name);}}
 await walk(root);return files.sort();
}
export function zipStage(stage,archive){
 const literal=value=>"'"+value.replaceAll("'","''")+"'";
 const script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem;"+' $stagePath='+literal(stage)+'; $archive=[IO.Compression.ZipFile]::Open('+literal(archive)+',[IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $stagePath -Recurse -File | ForEach-Object { $entryName=$_.FullName.Substring($stagePath.Length+1).Replace([char]92,[char]47); [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$_.FullName,$entryName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose() }';
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{stdio:'inherit',windowsHide:true});
}
async function main(){
 const args=process.argv.slice(2),outIndex=args.indexOf('--out');
 if(outIndex<0||!args[outIndex+1])throw Error('Usage: node tools/package-release.mjs --out <delivery-directory> [--dry-run]');
 const root=fileURLToPath(new URL('../',import.meta.url)),pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),files=await collectReleaseFiles(root,pkg);
 for(const required of ['index.js','client.js','cordis.patch.yml','package.json'])if(!files.includes(required))throw Error('Missing release entry: '+required);
 if(args.includes('--dry-run')){console.log(JSON.stringify({version:pkg.version,files},null,2));return;}
 const output=resolve(args[outIndex+1]);await mkdir(output,{recursive:true});
 const stem='relationship-notes-'+pkg.version,archive=join(output,stem+'.zip');
 try{await stat(archive);throw Error('Release archive already exists; choose a fresh output directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const built=(await stat(join(root,'client.js'))).mtimeMs;
 const buildInputs=[...files.filter(f=>f.startsWith('src/')&&f.endsWith('.js')),'build.mjs','package.json','pnpm-lock.yaml'];
 for(const file of buildInputs)if((await stat(join(root,file))).mtimeMs>built)throw Error('Build input newer than client.js; run build before packaging: '+file);
 const stage=await mkdtemp(join(output,'.relationship-stage-'));
 try{
  const manifest={name:pkg.name,version:pkg.version,files:[]};
  for(const file of files){const bytes=await readFile(join(root,file));await mkdir(dirname(join(stage,file)),{recursive:true});await writeFile(join(stage,file),bytes);manifest.files.push({path:file,bytes:bytes.length,sha256:digest(bytes)});}
  const serialized=JSON.stringify(manifest,null,2)+'\n';await writeFile(join(stage,'RELEASE-MANIFEST.json'),serialized);
  zipStage(stage,archive);
  const hash=digest(await readFile(archive));await writeFile(join(output,stem+'.sha256'),hash+'  '+stem+'.zip\n');await writeFile(join(output,stem+'.manifest.json'),serialized);
  console.log(JSON.stringify({archive,sha256:hash,files:files.length},null,2));
 }finally{const checked=resolve(stage);if(dirname(checked)!==output||!checked.startsWith(join(output,'.relationship-stage-')))throw Error('Refusing cleanup outside release staging directory.');await rm(checked,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
