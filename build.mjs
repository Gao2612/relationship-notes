import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build as bundle} from 'esbuild';
import * as E from './src/engine.js';
import * as A from './src/analysis.js';
import * as N from './src/navigation.js';
import * as I from './src/auto-import.js';
import * as P from './src/reply-payload.js';
import * as W from './src/wechat-export.js';
import * as L from './src/profile-lifecycle.js';
import * as S from './src/self-profile.js';
import * as T from './src/suggestions.js';
import {textPairs,css} from './src/workspace.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const baseline=createHash('sha256').update(readFileSync(new URL('../relationship-plugin-prototype/index.html',import.meta.url))).digest('hex');
if(baseline!=='b3d2b90b6f62e9e82ec8db060e7c0099e823c3f525e611fc02a3bf5ea6ca0af1')throw Error('Baseline hash mismatch');
const dictionaries=Object.fromEntries(['zh','en'].map((language,index)=>{const dict=Object.fromEntries(Object.entries(textPairs).map(([key,pair])=>{if(!pair[index])throw Error('Missing locale '+key);return [key,pair[index]];}));const meta={title:dict.nav,description:dict.privacy};writeFileSync(new URL('./locale/'+language+'.json',import.meta.url),JSON.stringify({meta,...dict},null,2)+'\n');return [language,dict];}));
const engine=['engine','analysis','navigation','auto-import','self-profile','suggestions','reply-payload','wechat-export','profile-lifecycle'].map(name=>read('./src/'+name+'.js')
 .replace(/^import \{analyzeDailyTimeline\} from '\.\/analysis\.js';\s*/m,'')
 .replace(/^import \{summarizeSelfProfile\} from '\.\/self-profile\.js';\s*/m,'')
 .replace(/^import \{suggestNextSteps\} from '\.\/suggestions\.js';\s*/m,'')
 .replace(/^export \{[^}]+\};/gm,'')
 .replace(/\bexport (?=(?:async\s+)?(?:const|function|class)\b)/g,'')).join('\n');const page=read('./src/workspace.js');const helpers=page.slice(page.indexOf('export function formatChatDayKey'),page.indexOf('export const css=')).replace(/^export /gm,'');const component=helpers+page.slice(page.indexOf('export function createPlugin')).replace('export function','function');
const names=Object.keys({...E,...A,...N,...I,...P,...W,...L,...S,...T});
const pdfApi=(await bundle({stdin:{contents:"export * from 'pdfjs-dist/legacy/build/pdf.mjs';",resolveDir:process.cwd(),sourcefile:'pdf-api-entry.js'},bundle:true,format:'iife',globalName:'PDFJS',platform:'browser',target:'chrome120',minify:true,write:false})).outputFiles[0].text;
const pdfWorker=(await bundle({entryPoints:['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'],bundle:true,format:'iife',globalName:'PDFWorker',platform:'browser',target:'chrome120',minify:true,write:false})).outputFiles[0].text;
copyFileSync(new URL('../LICENSE',import.meta.resolve('pdfjs-dist')),new URL('./PDFJS-LICENSE.md',import.meta.url));
const client=`window.__ModuleLoader__.load({id:'@local/relationship-notes',factory(require){\n${pdfApi}\nconst PDF_WORKER_SOURCE=${JSON.stringify(pdfWorker)};\n${engine}\nconst css=${JSON.stringify(css)};\n${component}\nreturn createPlugin(require('react'),{${names.join(',')}},${JSON.stringify(dictionaries)});\n}});\n`;
if(/__WORKSPACE|__LOCALES|\/\*__|\bimport\s/.test(client))throw Error('Unresolved module or placeholder');
new Function(client);writeFileSync(new URL('./client.js',import.meta.url),client);
console.log('BUILD native React client; '+Object.keys(textPairs).length+' en/zh locale keys; baseline '+baseline);




