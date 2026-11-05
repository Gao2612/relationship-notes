import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as lifecycle from './profile-lifecycle.js';
const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8'),functions=source.slice(source.indexOf('  async function analyzeProfile('),source.indexOf('  function Profile('));
test('profile extraction ignores a response after switching contacts or replacing the same-contact messages',async()=>{
 for(const mutate of [state=>({...state,selectedId:'other'}),state=>({...state,contacts:state.contacts.map(c=>({...c,messages:[...c.messages,{sender:'对方',text:'新的资料'}]}))})]){
  const contact={id:'c',self:'我',target:'对方',messages:[{sender:'对方',text:'我喜欢做饭'}]},initial={selectedId:'c',contacts:[contact]};let state=initial,resolve;
  const api=new Function('store','set','hostPost','E','let profileRequest=0,profileController=null;const selected=s=>s.contacts.find(c=>c.id===s.selectedId);'+functions+';return {analyzeProfile};')({getSnapshot:()=>state},patch=>{state={...state,...patch};},()=>new Promise(r=>resolve=r),lifecycle);
  const pending=api.analyzeProfile(contact);state=mutate(state);resolve(Response.json({ok:true,facts:[{field:'interests',value:'喜欢做饭',id:0,quote:'我喜欢做饭'}]}));await pending;
  assert.equal(state.contacts[0].facts,undefined);assert.equal(state.contacts[0].profileSummary,undefined);assert.doesNotMatch(state.status||'',/已整理|已更新/);
 }
});
