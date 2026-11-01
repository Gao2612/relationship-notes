import {copyFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {textPairs} from './src/workspace.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const dictionaries=Object.fromEntries(['zh','en'].map((language,index)=>{
 const dict=Object.fromEntries(Object.entries(textPairs).map(([key,pair])=>{if(!pair[index])throw Error('Missing locale '+key);return [key,pair[index]];}));
 writeFileSync(new URL('./locale/'+language+'.json',import.meta.url),JSON.stringify({_generated:'Generated from src/workspace.js textPairs; edit the source.',meta:{title:dict.nav,description:dict.privacy},...dict},null,2)+'\n');
 return [language,dict];
}));
const worker=(await build({absWorkingDir:root,entryPoints:['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'],bundle:true,format:'iife',globalName:'PDFWorker',platform:'browser',target:'chrome120',minify:true,write:false})).outputFiles[0].text;
const result=await build({
 absWorkingDir:root,
 stdin:{contents:`import * as React from 'react';import * as E from './src/client-engine.js';import {createPlugin} from './src/workspace.js';export default createPlugin(React,E,${JSON.stringify(dictionaries)});`,resolveDir:root,sourcefile:'client-entry.js'},
 bundle:true,format:'iife',globalName:'RelationshipNotesPlugin',platform:'browser',target:'chrome120',external:['react'],charset:'utf8',write:false,
 inject:['rn:pdf-runtime'],
 plugins:[{name:'pdf-runtime',setup(api){
  api.onResolve({filter:/^rn:pdf-runtime$/},()=>({path:'pdf-runtime',namespace:'rn'}));
  api.onLoad({filter:/.*/,namespace:'rn'},()=>({contents:`export * as PDFJS from 'pdfjs-dist/legacy/build/pdf.mjs';export const PDF_WORKER_SOURCE=${JSON.stringify(worker)};`,resolveDir:root,loader:'js'}));
 }}],
 banner:{js:"window.__ModuleLoader__.load({id:'@local/relationship-notes',factory(require){"},
 footer:{js:'return RelationshipNotesPlugin.default;}});'},
});
const client=result.outputFiles[0].text;
new Function(client);
copyFileSync(new URL('../LICENSE',import.meta.resolve('pdfjs-dist')),new URL('./PDFJS-LICENSE.md',import.meta.url));
writeFileSync(new URL('./client.js',import.meta.url),client);
console.log('BUILD bundled native React client; '+Object.keys(textPairs).length+' en/zh locale keys');
