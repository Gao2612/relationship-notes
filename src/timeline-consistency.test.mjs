import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from './client-engine.js';

const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8');
const start=source.indexOf('  async function analyzeTimeline(');
const end=source.indexOf('  function commitImport()',start);
const functionSource=source.slice(start,end);

for(const change of ['none','messages','corrections','identity','delete']){
 test('时间线响应校验 '+change,async()=>{
  const contact={id:'c',self:'我',target:'对方',messages:[{sender:'我',text:'你好',timestamp:'2026-11-06 09:00'},{sender:'对方',text:'我喜欢摄影',timestamp:'2026-11-06 09:01'}]};
  let state={contacts:[contact]},respond;
  const run=new Function('store','set','E','hostPost','messageMediaKind','mediaLabels','cleanTimelineDisplayText','let timelineController=null,timelineRequest=0;'+functionSource+'return analyzeTimeline;')(
   {getSnapshot:()=>state},patch=>{state={...state,...patch};},E,
   ()=>new Promise(resolve=>{respond=resolve;}),()=>null,{},text=>text);
  const pending=run('c');
  if(change==='messages')state.contacts=[{...contact,messages:[...contact.messages]}];
  if(change==='corrections')state.contacts=[{...contact,interactionCorrections:[]}];
  if(change==='identity')state.contacts=[{...contact,target:'另一人'}];
  if(change==='delete')state.contacts=[];
  respond(Response.json({ok:true,days:[{date:'2026-11-06',summary:'旧分析',activityReason:'说明',affinityContext:'线索'}]}));
  await pending;
  assert.equal(Boolean(state.contacts[0]?.timelineAnalysis),change==='none');
 });
}

test('会话每日评分沿用人工纠正并随纠正刷新缓存',()=>{
 const begin=source.indexOf('   const daily=React.useMemo');
 const finish=source.indexOf('\n',begin);
 const statement=source.slice(begin,finish);
 let cached;
 const React={useMemo(factory,dependencies){
  if(cached&&dependencies.every((value,index)=>value===cached.dependencies[index]))return cached.value;
  const value=factory();cached={value,dependencies};return value;
 }};
 const messages=[{sender:'我',text:'你好',timestamp:'2026-11-06 09:00'},{sender:'对方',text:'你喜欢摄影吗？',timestamp:'2026-11-06 09:01'}];
 let contact={self:'我',target:'对方',messages};
 const evidence=E.analyzeInteractionMetrics(contact).indicators.find(item=>item.kind==='question').evidence[0];
 const render=new Function('React','E','contact','contactMessages',statement+'return daily;');
 const before=render(React,E,contact,messages);
 contact=E.correctInteraction(contact,{kind:'question',key:evidence.key,excluded:true},0);
 const after=render(React,E,contact,messages);
 assert.equal(before.days[0].targetQuestions,1);
 assert.equal(after.days[0].targetQuestions,0);
});
