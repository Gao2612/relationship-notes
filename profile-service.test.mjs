import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileState,createProfileHandler,createProfileTools,apply} from './profile-service.js';
import {createProfileBridgeSnapshot} from './src/profile-bridge.js';
import {profileMessageId} from './src/profile-lifecycle.js';

const snapshot=()=>({contact:{id:'c1',self:'我',target:'对方'},facts:[{id:'f1',field:'interests',value:'喜欢摄影',quote:'我喜欢摄影',sourceMessageIds:['m1'],confirmed:true}],messages:[{id:'m1',sender:'对方',text:'我喜欢摄影，周末会去拍照。',timestamp:'2026-11-01'},{id:'m2',sender:'我',text:'我也喜欢拍照',timestamp:''}]});
const call=(state,action,body)=>createProfileHandler(state,action)(new Request('http://localhost',{method:'POST',body:JSON.stringify(body)}));
async function shared(state){assert.equal((await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:snapshot()})).status,200);return createProfileTools(state);}

test('profile tools require explicit live sharing and reject other contacts',async()=>{
 let clock=0;const state=createProfileState(()=>clock),tools=createProfileTools(state);
 await assert.rejects(tools[0].execute({}),/开启/);await shared(state);
 assert.equal((await tools[0].execute({contactId:'c1'})).facts.length,1);
 await assert.rejects(tools[0].execute({contactId:'c2'}),/当前联系人/);
 clock=60_001;await assert.rejects(tools[0].execute({}),/开启/);assert.equal(state.snapshot,null);
});
test('sharing rejects unconfirmed facts and is exclusive across windows',async()=>{
 const state=createProfileState();await shared(state);
 assert.equal((await call(state,'sync',{clientId:'tab2',enabled:true,snapshot:snapshot()})).status,409);
 await call(state,'sync',{clientId:'tab2',enabled:false});assert(state.snapshot);
 const unsafe=snapshot();unsafe.facts[0].confirmed=false;
 assert.equal((await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:unsafe})).status,400);
 await call(state,'sync',{clientId:'tab1',enabled:false});assert.equal(state.snapshot,null);
});
test('search is bounded to shared contact and proposal requires an exact target-side quote',async()=>{
 const state=createProfileState(),tools=await shared(state);
 assert.equal((await tools[1].execute({query:'摄影'})).matches[0].id,'m1');
 const input={field:'interests',value:'喜欢摄影',sourceMessageId:'m1',quote:'我喜欢摄影',confidence:.9};
 const proposal=await tools[2].execute(input);assert.equal(proposal.status,'pending');assert.equal(state.snapshot.facts.length,1);
 assert.equal((await tools[2].execute(input)).id,proposal.id);assert.equal(state.pending.length,1);
 await assert.rejects(tools[2].execute({...input,quote:'她一定喜欢我'}),/连续原文/);
 await assert.rejects(tools[2].execute({...input,sourceMessageId:'m2',quote:'我也喜欢拍照'}),/联系人/);
 assert.equal((await call(state,'pending',{clientId:'tab2',contactId:'c1'})).status,403);
 assert.equal((await call(state,'pending',{clientId:'tab1',contactId:'c2'})).status,403);
 const pending=await (await call(state,'pending',{clientId:'tab1',contactId:'c1'})).json();assert.equal(pending.values[0].provenance,'model');
 await call(state,'ack',{clientId:'tab1',contactId:'c1',ids:[proposal.id]});assert.equal(state.pending.length,0);
});
test('switching authorized contact drops prior pending proposals',async()=>{
 const state=createProfileState(),tools=await shared(state);await tools[2].execute({field:'interests',value:'摄影',sourceMessageId:'m1',quote:'我喜欢摄影',confidence:.9});
 const next=snapshot();next.contact.id='c2';await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:next});assert.equal(state.pending.length,0);await assert.rejects(tools[0].execute({contactId:'c1'}),/当前联系人/);
});
test('refreshing a shared snapshot drops candidates whose source was changed or removed',async()=>{
 const state=createProfileState(),tools=await shared(state),proposal={field:'interests',value:'摄影',sourceMessageId:'m1',quote:'我喜欢摄影',confidence:.9};
 await tools[2].execute(proposal);await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:snapshot()});assert.equal(state.pending.length,1);
 const edited=snapshot();edited.messages[0].text='消息已编辑';await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:edited});assert.equal(state.pending.length,0);
 await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:snapshot()});await tools[2].execute(proposal);const removed=snapshot();removed.messages=removed.messages.slice(1);await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:removed});assert.equal(state.pending.length,0);
 for(const contactId of ['',null,0])await assert.rejects(tools[0].execute({contactId}),/无效/);
});
test('user confirmation never promotes an inference or behavioral pattern into factual output',async()=>{
 const state=createProfileState(),data=snapshot();data.facts.push({...data.facts[0],id:'inference',field:'inference',value:'可能比较忙',confidence:.4},{...data.facts[0],id:'style',field:'style',value:'回复比较简短'});await call(state,'sync',{clientId:'tab1',enabled:true,snapshot:data});const result=await createProfileTools(state)[0].execute({});assert.equal(result.facts.length,1);assert.equal(result.patterns.length,1);assert.equal(result.inferences.length,1);assert.equal(result.inferences[0].interpretationOnly,true);assert.equal(result.inferences[0].confidence,.4);
});
test('browser snapshot excludes unconfirmed profiles, strangers and media',()=>{
 const c={id:'c1',self:'我',target:'对方',messages:[{sender:'其他',text:'不共享'},{sender:'对方',text:'我喜欢摄影',timestamp:'2026-11-01',attachments:[{file:'private'}]}],profileSummary:[{uid:'a',field:'interests',value:'摄影',status:'active',confirmed:true},{uid:'b',field:'job',value:'猜测职业',status:'active'},{uid:'c',field:'city',value:'杭州',status:'pending',confirmed:true}]};
 const result=createProfileBridgeSnapshot(c);assert.equal(result.messages.length,1);assert(!('attachments' in result.messages[0]));assert.equal(result.facts.length,1);assert.equal(result.facts[0].id,'a');assert.equal(result.messages[0].id,profileMessageId(c.messages[1]));
});
test('host registers three authenticated connection routes and three tools',()=>{
 const routes=[],tools=[];apply({inject(deps,fn){assert.deepEqual(deps,['connection','tools']);return fn({connection:{fetch:{register:r=>routes.push(r)}},tools:{register:t=>tools.push(t)}});}});
 assert.equal(routes.length,3);assert.equal(tools.length,3);assert(routes.every(r=>r.methods[0]==='POST'));assert(tools.some(t=>t.name==='relationship_notes_propose_fact'));
});
