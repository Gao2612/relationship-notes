import test from 'node:test';
import assert from 'node:assert/strict';
import {createInterpretationHandler} from './interpretation-service.js';
const input=()=>({provider:'p',model:'m',self:'我',target:'对方',messages:[{id:'a',sender:'对方',text:'今天有点忙，改天聊吧'}]});
const output=()=>({interpretations:[{explanation:'可能当前确实忙碌。',uncertainty:'无法知道具体安排。',evidence:[{messageId:'a',quote:'今天有点忙'}],reply:'好，你先忙。'},{explanation:'也可能希望先暂停这个话题。',uncertainty:'需要后续实际表达才能确认。',evidence:[{messageId:'a',quote:'改天聊吧'}],reply:'嗯，等方便再说。'}]});
function llm(result,finish=true){return {async prepareCall(){return {config:{},async *stream(){yield {type:'text-delta',text:JSON.stringify(result)};if(finish)yield {type:'finish',reason:'stop'};}};}};}
const request=body=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body)});
test('returns alternative interpretations only after an explicit request, with verified quotes',async()=>{const response=await createInterpretationHandler(llm(output()))(request(input()));assert.equal(response.status,200);assert.equal((await response.json()).interpretations.length,2);});
test('rejects fabricated evidence and deterministic affinity claims',async()=>{for(const mutate of [r=>r.interpretations[0].evidence[0].quote='我喜欢你',r=>r.interpretations[0].evidence[0].messageId='missing',r=>r.interpretations[0].explanation='她一定喜欢你']){const result=output();mutate(result);const response=await createInterpretationHandler(llm(result))(request(input()));assert.equal(response.status,502);assert.equal((await response.json()).ok,false);}});
test('rejects unknown fields, too many messages and cross-person messages before calling the model',async()=>{for(const mutate of [b=>b.extra=true,b=>b.messages[0].sender='第三人',b=>b.messages=Array(21).fill(b.messages[0])]){const body=input();mutate(body);const response=await createInterpretationHandler({prepareCall(){throw Error('should not call');}})(request(body));assert.equal(response.status,400);}});
test('requires a completed model response and valid structured output',async()=>{for(const [result,finish] of [[output(),false],[{interpretations:[]},true],[{...output(),unknown:true},true]]){const response=await createInterpretationHandler(llm(result,finish))(request(input()));assert.equal((await response.json()).ok,false);}});
test('bounds a model provider that ignores cancellation',async()=>{
 const handler=createInterpretationHandler({prepareCall(){return new Promise(()=>{});}},{timeoutMs:5});
 assert.equal((await handler(request(input()))).status,504);
 const controller=new AbortController(),req=new Request('http://localhost/api',{method:'POST',body:JSON.stringify(input()),signal:controller.signal});controller.abort();assert.equal((await handler(req)).status,499);
});
test('accepts complete text block output and rejects invalid self profiles or same trimmed identity',async()=>{
 const provider={async prepareCall(){return {config:{},async *stream(){yield {type:'block-end',block:{type:'text',text:JSON.stringify(output())}};yield {type:'finish',reason:'stop'};}};}};
 assert.equal((await createInterpretationHandler(provider)(request(input()))).status,200);
 for(const profile of [null,[],42])assert.equal((await createInterpretationHandler(provider)(request({...input(),selfProfile:profile}))).status,400);
 assert.equal((await createInterpretationHandler(provider)(request({...input(),self:' 对方 '}))).status,400);
});
