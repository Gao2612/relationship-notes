import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileAnalysisHandler} from './reply-service.js';
const input={target:'联系人',messages:[{id:0,text:'我喜欢做饭'}]};
const request=body=>new Request('http://localhost/api/relationship-notes/profile-analysis',{method:'POST',body:JSON.stringify(body)});
for(const mode of [undefined,'summary'])test('profile analysis accepts '+(mode||'omitted extraction mode'),async()=>{
 let called=false;
 const llm={listProviders:()=>[{id:'p'}],listModels:async()=>[{id:'m'}],prepareCall:async()=>{called=true;return {config:{},stream:async function*(){yield {type:'text-delta',text:JSON.stringify({facts:[{field:'interests',value:'喜欢做饭',id:0,quote:'我喜欢做饭'}]})};yield {type:'finish',reason:'stop'};}};}};
 const response=await createProfileAnalysisHandler(llm,{defaultSelection:()=>({provider:'p',model:'m'})})(request({...input,...(mode?{mode}:{})}));
 assert.equal(response.status,200);assert.equal(called,true);assert.equal((await response.json()).facts.length,1);
});
test('profile rejects unknown keys and invalid modes before model call',async()=>{
 const llm={prepareCall:()=>{throw Error('must not call model');}};
 for(const body of [{...input,extra:true},{...input,mode:'invalid'}])assert.equal((await createProfileAnalysisHandler(llm)(request(body))).status,400);
});
