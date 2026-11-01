import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlugin,textPairs} from './workspace.js';
import * as E from './client-engine.js';

test('registers Relationship Notes in the Sub DSH module registry without host sidebar slots',()=>{
  const registered=[];
  const React={useState(value){return [value,()=>{}];},createElement(type,props,...children){return {type,props:props||{},children};},useSyncExternalStore(_subscribe,getSnapshot){return getSnapshot();},useEffect(){},useRef(current){return {current};}};
  const plugin=createPlugin(React,E,Object.fromEntries(Object.entries(textPairs).map(([key,pair])=>[key,pair[0]])));
  assert.deepEqual(plugin.inject,['locale','subdsh']);
  plugin.apply({
    locale:{bind:()=>key=>key==='nav'?'关系手记':key,register(){}},
    subdsh:{register(entry){registered.push(entry);return()=>{};}},
    effect(fn,label){if(label==='local-relationship-notes: module')fn();},
  });
  assert.equal(registered.length,1);
  assert.equal(registered[0].id,'relationship-notes');
  assert.equal(registered[0].label,'关系手记');
  assert.equal(typeof registered[0].render,'function');
  const render=node=>typeof node?.type==='function'?render(node.type(node.props)):node&&typeof node==='object'?{...node,children:node.children?.map(render)||[]}:node;
  const page=render(registered[0].render()),tablists=[];
  const visit=node=>{if(!node||typeof node!=='object')return;if(node.props?.role==='tablist')tablists.push(node.props.className);for(const child of node.children||[])visit(child);};
  visit(page);
  assert.deepEqual(tablists,['rn-tabs rn-group-tabs','rn-tabs rn-context-tabs']);
});

test('current DSH container contract is extended only with supported module registration',()=>{
  const effects=[],registered=[];
  const React={useState(value){return [value,()=>{}];},createElement(type,props,...children){return {type,props:props||{},children};},useSyncExternalStore(_subscribe,getSnapshot){return getSnapshot();},useEffect(){},useRef(current){return {current};}};
  const plugin=createPlugin(React,E,Object.fromEntries(Object.entries(textPairs).map(([key,pair])=>[key,pair[0]])));
  plugin.apply({locale:{bind:()=>key=>key,register(){}},subdsh:{register(entry){registered.push(entry);return()=>{};}},effect(fn,label){effects.push({fn,label});if(label==='local-relationship-notes: module')fn();}});
  assert.equal(registered.length,1);
  assert.equal(registered[0].id,'relationship-notes');
  assert.equal(effects.some(item=>String(item.fn).includes('registerTool')),false);
});
