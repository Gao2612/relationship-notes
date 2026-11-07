import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {apply as applyHost} from './index.js';

test('built client factory executes and mounts a renderable DSH module',()=>{
 const entries=[],registrations=[];
 const React={useState:v=>[v,()=>{}],useRef:current=>({current}),useEffect(){},useSyncExternalStore:(_subscribe,snapshot)=>snapshot(),createElement:(type,props,...children)=>({type,props:props||{},children})};
 // PDF.js uses the browser DOMMatrix constructor at module initialization.
 // No rendering/media APIs are invoked by this workspace mounting smoke test.
 const sandbox={console,URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,DOMException,Blob,Response,Request,Headers,ReadableStream,setTimeout,clearTimeout,DOMMatrix:class DOMMatrix{},performance,window:{__ModuleLoader__:{load:entry=>entries.push(entry)}}};
 vm.runInNewContext(readFileSync(new URL('./client.js',import.meta.url),'utf8'),sandbox,{timeout:10000,filename:'client.js'});
 assert.equal(entries.length,1);
 assert.equal(entries[0].id,'dsh-relationship-notes');
 const required=[];
 const plugin=entries[0].factory(name=>{required.push(name);assert.equal(name,'react');return React;});
 assert.deepEqual(required,['react']);
 assert.deepEqual(Array.from(plugin.inject),['locale','subdsh']);
 plugin.apply({locale:{bind:()=>key=>key,register(){}},subdsh:{register:entry=>{registrations.push(entry);return()=>{};}},effect(fn,label){if(label==='local-relationship-notes: module')fn();}});
 assert.equal(registrations.length,1);
 assert.equal(registrations[0].id,'relationship-notes');
 const resolve=node=>Array.isArray(node)?node.map(resolve):node&&typeof node==='object'?typeof node.type==='function'?resolve(node.type(node.props)):{...node,children:node.children.map(resolve)}:node;
 const page=resolve(registrations[0].render());
 assert.equal(typeof page.type,'string');
 assert.match(page.props.className,/rnw/);
});

test('published host entry registers executable routes and tools together',()=>{
 const routes=[],tools=[];
 const scope={connection:{fetch:{register:r=>routes.push(r)}},tools:{register:t=>tools.push(t)},llm:{},agentDefaultModel:{currentSelection:()=>null},attachments:{}};
 applyHost({inject(_names,callback){return callback(scope);}});
 assert.equal(new Set(routes.map(r=>r.path)).size,routes.length);
 for(const route of routes){assert.equal(typeof route.fetch,'function');assert.deepEqual(route.methods,['POST']);}
 for(const path of ['/reply','/profile-analysis','/interpretation','/import/read','/profile/sync'])assert(routes.some(r=>r.path==='/api/relationship-notes'+path),path);
 assert(tools.some(t=>t.name==='relationship_notes_import'));
 assert(tools.some(t=>t.name==='relationship_notes_profile_get'));
});
