import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMediaUrls} from './workspace-media.js';
import {createDebounced} from './evidence-list.js';

const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8');

test('宿主适配器调用传入对象而非已编码字符串',()=>{
 assert.doesNotMatch(source,/(?:hostPost|httpPost)\([^,]+,JSON\.stringify/);
});

test('行为页面初始化声明全部状态并缓存未变化的统计输入',()=>{
 const start=source.indexOf('  function Behavior({contact,tab,s}){');
 const end=source.indexOf('if(!contact)return empty();',start);
 const prefix=source.slice(start,end);
 const hooks=[];
 let cursor=0,calculations=0;
 const React={
  useRef:value=>({current:value}),
  useState:value=>[value,()=>{}],
  useEffect:()=>{},
  useMemo(factory,dependencies){
   const index=cursor++;
   const old=hooks[index];
   if(old&&dependencies.every((value,i)=>value===old.dependencies[i]))return old.value;
   const value=factory();hooks[index]={dependencies,value};return value;
  },
 };
 const E={analyzeDailyTimeline:()=>{calculations++;return {days:[]};},analyzeConversation:()=>{calculations++;return {};}};
 const render=new Function('React','E','createDebounced','EVIDENCE_SEARCH_DELAY','formatChatDayKey','contact','"use strict";'+prefix+'return null;}return Behavior({contact,tab:"daily",s:{}});');
 const contact={messages:[],self:'我',target:'对方'};
 render(React,E,createDebounced,200,()=> '2026-11-06',contact);
 cursor=0;
 render(React,E,createDebounced,200,()=> '2026-11-06',contact);
 assert.equal(calculations,2);
 cursor=0;
 render(React,E,createDebounced,200,()=> '2026-11-06',{...contact,messages:[]});
 assert.equal(calculations,4);
});

test('媒体 URL 保留撤销引用并在移除或卸载时失效',async()=>{
 const urls=createMediaUrls();
 const file=new Blob(['media']);
 const url=urls(file);
 assert.equal(urls(file),url);
 urls.retain({undoData:{file}});
 assert.equal(await (await fetch(url)).text(),'media');
 urls.retain({});
 await assert.rejects(fetch(url));
 const replacement=urls(file);
 assert.notEqual(replacement,url);
 urls.dispose();
 urls.dispose();
 await assert.rejects(fetch(replacement));
});
