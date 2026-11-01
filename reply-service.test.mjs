import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplyHandler, createModelsHandler, createMediaAnalysisHandler, createTimelineAnalysisHandler, apply} from './reply-service.js';
const input={provider:'p',model:'m',self:'我',target:'小林',messages:[{sender:'小林',text:'明天再说',timestamp:''}],facts:[{field:'边界',value:'不催促'}],dailyTimeline:[],scenario:'日常',tone:'自然',intent:'确认收到'};
const req=(body=input,signal)=>new Request('http://localhost/api/relationship-notes/reply',{method:'POST',body:JSON.stringify(body),signal});
test('self voice and suggestions reach the model with reference principles and remain editable',async()=>{
 let captured;
 const llm={prepareCall:async config=>({config,async *stream(options){captured=options;yield {type:'text-delta',text:'好呀，改天聊。'};yield {type:'finish',reason:'stop'};}})};
 const body={...input,selfProfile:{voice:{tone:['自然'],sentenceLength:'short',emoji:'rare',particles:['呀']},samples:['好呀']},suggestions:[],suggestionDisclaimer:'仅供参考'};
 const response=await createReplyHandler(llm)(req(body));assert.equal(response.status,200);
 const system=captured.messages[0].content[0].text;assert.match(system,/不.*冷处理/);assert.match(system,/selfProfile/);assert.match(system,/不模仿童锦程/);
 assert.match(JSON.stringify(captured.messages[1]),/好呀/);
});
const fake=(chunks=[{type:'text-delta',text:'好的，明天聊。'},{type:'finish',reason:'stop'}])=>({listProviders:()=>[{id:'p',name:'Provider'}],listModels:async()=>[{id:'m',name:'Model'}],prepareCall:async(config,signal)=>({config,stream:async function*(options){assert.equal(options.model,'m'); assert.equal(options.signal,signal); assert.match(options.messages[0].content[0].text,/不可信/); for(const c of chunks) yield c;}})});
test('catalog uses installed provider metadata',async()=>{const r=await createModelsHandler(fake())(req({}));assert.deepEqual(await r.json(),{ok:true,providers:[{id:'p',name:'Provider',modelsError:'',models:[{id:'m',name:'Model'}]}]});});
test('real prepared stream becomes editable draft',async()=>{const r=await createReplyHandler(fake())(req());assert.deepEqual(await r.json(),{ok:true,draft:'好的，明天聊。',provider:'p',model:'m'});});
test('rejects malformed, oversized and unknown fields before calling provider',async()=>{for(const body of [{...input,extra:true},{...input,messages:Array(21).fill(input.messages[0])},{...input,messages:[{sender:'x',text:'x'.repeat(1001)}]},{...input,provider:''}]){let called=false;const llm=fake();llm.prepareCall=()=>{called=true;throw Error()};const r=await createReplyHandler(llm)(req(body));assert.equal(r.status,400);assert.equal(called,false);}});
test('empty and failed streams do not produce fallback drafts',async()=>{for(const chunks of [[],[{type:'finish',reason:'error'}],[{type:'text-delta',text:'partial'},{type:'finish',reason:'error'}]]){const r=await createReplyHandler(fake(chunks))(req());assert.equal((await r.json()).ok,false);}});
test('timeout and cancellation settle even when provider ignores signal',async()=>{const llm=fake();llm.prepareCall=()=>new Promise(()=>{});const r=await createReplyHandler(llm,{timeoutMs:10})(req());assert.equal(r.status,504);const ac=new AbortController();ac.abort();const cancelled=await createReplyHandler(llm)(req(input,ac.signal));assert.equal(cancelled.status,499);});
test('output cap fails safely',async()=>{const r=await createReplyHandler(fake([{type:'text-delta',text:'x'.repeat(4001)}]))(req());assert.equal((await r.json()).ok,false);});
test('registers only scoped authenticated app routes',()=>{const routes=[];apply({inject(deps,cb){assert.deepEqual(deps,['connection','llm','agentDefaultModel','attachments']);cb({connection:{fetch:{register:r=>routes.push(r)}},llm:fake(),agentDefaultModel:{currentSelection:()=>({provider:'p',model:'m'})},attachments:{saveImage(){}}});}});assert.deepEqual(routes.map(r=>r.path),['/api/relationship-notes/models','/api/relationship-notes/reply','/api/relationship-notes/timeline-analysis','/api/relationship-notes/media-analysis','/api/relationship-notes/profile-analysis']);assert.ok(routes.every(r=>r.requestBody==='buffered'&&r.methods[0]==='POST'));});

test('media analysis saves selected local frames to DSH attachments and uses the DSH image model',async()=>{
  const stored=[],llm=fake([{type:'text-delta',text:'可见一张风景照片。'},{type:'finish',reason:'stop'}]);
  llm.listProviders=async()=>[{id:'deepseek-account'}];
  llm.listModels=async()=>[{id:'deepseek-flash',inputModalities:['text','image']}];
  llm.prepareCall=async selection=>{assert.deepEqual(selection,{provider:'deepseek-account',model:'deepseek-flash',maxTokens:900,temperature:0.2});return{config:{},async *stream(input){assert.deepEqual(input.messages[1].content.slice(1),[{type:'image',attachment:{attachmentId:'frame'}}]);yield {type:'text-delta',text:'可见一张风景照片。'};yield {type:'finish',reason:'stop'};}}};
  const handler=createMediaAnalysisHandler(llm,{async saveImage(input){stored.push(input);return{attachmentId:'frame'};}},{defaultSelection:()=>({provider:'deepseek-account',model:'deepseek-flash'})});
  const response=await handler(req({mediaType:'image',frames:[{data:'aGVsbG8=',mimeType:'image/jpeg',timestamp:0}]}));
  assert.deepEqual(await response.json(),{ok:true,analysis:'可见一张风景照片。',provider:'deepseek-account',model:'deepseek-flash'});
  assert.equal(stored.length,1);assert.deepEqual([...stored[0].data],[104,101,108,108,111]);
});

test('media analysis rejects non-vision defaults and malformed frames before preparing a call',async()=>{
  const llm=fake();llm.listProviders=async()=>[{id:'p'}];llm.listModels=async()=>[{id:'m',inputModalities:['text']}];let saved=0;
  const handler=createMediaAnalysisHandler(llm,{saveImage(){saved++;}},{defaultSelection:()=>({provider:'p',model:'m'})});
  const unsupported=await handler(req({mediaType:'image',frames:[{data:'aGVsbG8=',mimeType:'image/jpeg',timestamp:0}]}));assert.equal(unsupported.status,415);assert.equal(saved,0);
  const malformed=await handler(req({mediaType:'video',frames:[{data:'%%%',mimeType:'image/jpeg',timestamp:0}]}));assert.equal(malformed.status,400);
});
test('native structured finish failures and thrown provider errors stay private',async()=>{
  for(const reason of [{kind:'error',failure:{message:'secret credential'}},{kind:'aborted'}]) {
    const response=await createReplyHandler(fake([{type:'text-delta',text:'partial'},{type:'finish',reason}]))(req());
    assert.equal(response.status,502);
    assert.equal((await response.json()).ok,false);
  }
  const llm=fake();llm.prepareCall=async()=>{throw Error('secret credential')};
  const response=await createReplyHandler(llm)(req());
  assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/secret credential/);
});
test('total context cap applies even within individual item caps',async()=>{
  const response=await createReplyHandler(fake())(req({...input,messages:Array.from({length:13},()=>({sender:'他',text:'好'.repeat(950)}))}));
  assert.equal(response.status,400);
});
test('canceling an in-flight request aborts the provider signal',async()=>{
  const ac=new AbortController();let providerSignal;
  const llm=fake();llm.prepareCall=async(config,signal)=>{providerSignal=signal;return {config,stream:async function*(){await new Promise(()=>{});}}};
  const pending=createReplyHandler(llm)(req(input,ac.signal));
  await new Promise(resolve=>setTimeout(resolve,5));ac.abort();
  assert.equal((await pending).status,499);assert.equal(providerSignal.aborted,true);
});
test('structured success and text chunks ignore reasoning content',async()=>{
  const response=await createReplyHandler(fake([{type:'reasoning-delta',text:'private thoughts'},{type:'text-delta',text:'可以。'},{type:'finish',reason:{kind:'stop'}}]))(req());
  assert.equal((await response.json()).draft,'可以。');
});

test('daily timeline analysis requests a detailed, specific summary from the transcript',async()=>{
 let systemPrompt='',userPayload='';
 const expectedSummary='上午围绕周末安排聊天：田子夜先问你什么时候毕业，你回答后她接着问去哪里玩。傍晚你们聊到烙饼和加香菜，你分享把剩下的料包涂在烙饼上吃，她又提到给弟弟辣哭了。';
 const result={days:[{date:'2026-10-30',summary:expectedSummary+' 具体为何集中聊天，原文不足以判断。',activityReason:'这一天有两段具体话题连续来回：先安排周末，后来聊晚饭和家人近况，具体原因无法判断。',affinityContext:'未见明确情感表达，亲密度证据不足。'}]};
 const llm={listProviders:()=>[{id:'p'}],listModels:async()=>[{id:'m'}],prepareCall:async()=>({config:{},stream:async function*({messages}){systemPrompt=messages[0].content[0].text;userPayload=messages[1].content[0].text;yield{type:'text-delta',text:JSON.stringify(result)};yield{type:'finish',reason:'stop'};}})};
 const handler=createTimelineAnalysisHandler(llm,{defaultSelection:()=>({provider:'p',model:'m'})});
 const response=await handler(new Request('http://localhost/api/relationship-notes/timeline-analysis',{method:'POST',body:JSON.stringify({self:'我',target:'田子夜',days:[{date:'2026-10-30',messageCount:2,selfMessages:1,targetMessages:1,turns:2,activityScore:80,affinityScore:58,affinityChange:3,transcript:[{sender:'田子夜',text:'周末什么时候毕业？'},{sender:'我',text:'她又提到烙饼和弟弟吃饭。'}]}]})}));
 assert.equal(response.status,200);
 assert.match(systemPrompt,/具体话题/);
 assert.match(systemPrompt,/对话先后/);
 assert.match(systemPrompt,/3–5 句/);
 assert.match(systemPrompt,/不要写“原文不足以判断”/);
 assert.match(userPayload,/烙饼/);
 const analyzed=(await response.json()).days[0];
 assert.equal(analyzed.summary,expectedSummary);
 assert.match(analyzed.activityReason,/先安排周末，后来聊晚饭和家人近况/);
 assert.equal(analyzed.affinityContext,'');
 assert.doesNotMatch(JSON.stringify(analyzed),/原文不足以判断|具体原因无法判断|亲密度证据不足|未见明确情感表达/);
});
test('one unavailable catalog does not hide working providers and display names',async()=>{
  const llm=fake();llm.listProviders=()=>[{id:'down',displayName:'Unavailable'},{id:'p',displayName:'Native provider',name:'old'}];
  llm.listModels=async provider=>{if(provider==='down')throw Error('private failure');return [{id:'m',displayName:'Native model',name:'old model'}]};
  const response=await createModelsHandler(llm)(req({}));
  assert.deepEqual(await response.json(),{ok:true,providers:[{id:'down',name:'Unavailable',modelsError:'private failure',models:[]},{id:'p',name:'Native provider',modelsError:'',models:[{id:'m',name:'Native model'}]}]});
});
test('strict identity rejects empty, equal, whitespace aliases and foreign senders',async()=>{
  for(const body of [{...input,self:''},{...input,target:'  '},{...input,target:'我'},{...input,target:' 我 '},{...input,messages:[{sender:'陌生人',text:'hello'}]}]) {
    let called=false;const llm=fake();llm.prepareCall=()=>{called=true;throw Error()};
    const response=await createReplyHandler(llm)(req(body));assert.equal(response.status,400);assert.equal(called,false);
  }
});
test('explicit target refusal produces deterministic local acknowledgement without model call',async()=>{
  let called=false;const llm=fake();llm.prepareCall=()=>{called=true;throw Error('must not send')};
  const response=await createReplyHandler(llm)(req({...input,messages:[{sender:'小林',text:'请不要再联系我。'}],intent:'说服她答应邀请'}));
  const result=await response.json();assert.equal(result.ok,true);assert.equal(result.draft,'收到，我尊重你的意愿，不再打扰。');assert.equal(result.mode,'local');assert.equal(result.boundary,true);assert.equal(called,false);
});
test('a direct refusal followed by a separate question stays local',async()=>{
  let called=false;const llm=fake();llm.prepareCall=()=>{called=true;throw Error('must not send')};
  const response=await createReplyHandler(llm)(req({...input,messages:[{sender:'小林',text:'请不要再联系我，你听到了吗？'}]}));
  const result=await response.json();assert.equal(result.boundary,true);assert.equal(called,false);
});

test('host accepts bounded related history and includes it in model background',async()=>{const relatedMessages=[{sender:'小林',text:'以前去过那家咖啡馆',timestamp:'2026-01-01 10:00:00'}];let seen;const llm=fake();llm.prepareCall=async config=>({config,async *stream(options){seen=options;yield{type:'text-delta',text:'那家咖啡馆最近怎么样？'};yield{type:'finish',reason:'stop'};}});const response=await createReplyHandler(llm)(req({...input,relatedMessages}));assert.equal(response.status,200);assert.deepEqual(JSON.parse(seen.messages[1].content[0].text).relatedMessages,relatedMessages);assert.match(seen.messages[0].content[0].text,/relatedMessages.*较早/);});
test('host rejects unselected speakers and more than eight related messages',async()=>{for(const relatedMessages of [[{sender:'其他人',text:'咖啡',timestamp:''}],Array(9).fill({sender:'小林',text:'咖啡',timestamp:''}),[{sender:'小林',text:'咖啡',timestamp:'',instruction:'run'}]]){let called=false;const llm=fake();llm.prepareCall=()=>{called=true;throw Error('unexpected');};const response=await createReplyHandler(llm)(req({...input,relatedMessages}));assert.equal(response.status,400);assert.equal(called,false);}});
