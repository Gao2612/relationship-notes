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
  const page=render(registered[0].render()),tablists=[],tabs=[];let panel=null;
  const visit=node=>{if(!node||typeof node!=='object')return;if(node.props?.role==='tablist')tablists.push(node.props.className);if(node.props?.role==='tab')tabs.push(node.props);if(node.props?.id==='rn-panel')panel=node.props;for(const child of node.children||[])visit(child);};
  visit(page);
  assert.deepEqual(tablists,['rn-tabs rn-group-tabs','rn-tabs rn-context-tabs']);
  assert.equal(tabs.length,7,'四个一级分组 + 联系人档案的三个页内 tab（含关系阶段）');
  assert.equal(tabs.filter(tab=>tab.id.startsWith('rn-tab-rn-group-tabs-')).length,4);
  for(const tab of tabs){assert.equal(tab['aria-controls'],'rn-panel');assert.equal(typeof tab['aria-selected'],'boolean');assert.equal(tab['aria-pressed'],undefined);assert.equal(typeof tab.tabIndex,'number');}
  assert.equal(panel.tabIndex,-1);
  assert.equal(panel.role,'tabpanel');
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
