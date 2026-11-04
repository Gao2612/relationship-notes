import {profileMessageId} from './profile-lifecycle.js';
import {summarizeSelfProfile} from './self-profile.js';
export const AUTO_ANALYSIS_VERSION=2;
const hash=value=>{let a=2166136261,b=2246822519;for(const c of value){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),3266489917);}return (a>>>0).toString(36)+(b>>>0).toString(36);};
const modelKey=state=>typeof state.provider==='string'&&state.provider.trim()&&typeof state.model==='string'&&state.model.trim()?JSON.stringify([state.provider,state.model]):'';
const identityKey=contact=>JSON.stringify([contact?.id,contact?.self,contact?.target]);
const planCache=new WeakMap();
export function buildAutoAnalysisPlan(contact){
 const messages=contact.messages||[],identity=JSON.stringify([contact.self,contact.target]),cached=planCache.get(messages);if(cached?.identity===identity)return cached.plan;
 const segments=[],messageEnds=[];
 for(const message of messages){if(![contact.self,contact.target].includes(message.sender)||typeof message.text!=='string'||!message.text.trim())continue;const sourceMessageId=String(profileMessageId(message));let offset=0,part=0;
  while(offset<message.text.length){let end=Math.min(offset+2000,message.text.length);if(end<message.text.length&&/[\uD800-\uDBFF]/.test(message.text[end-1]))end--;const text=message.text.slice(offset,end),id='segment-'+hash(sourceMessageId)+'-'+part++;
   segments.push({id,sender:message.sender,text,sourceMessageId,fingerprint:hash(JSON.stringify([sourceMessageId,message.sender,message.timestamp,text,part]))});offset=end;
  }messageEnds.push(segments.length);
 }
 const plan={segments,messageEnds,fingerprints:segments.map(s=>s.fingerprint),totalMessages:messageEnds.length};planCache.set(messages,{identity,plan});return plan;
}
export function nextHistoryBatch(plan,start){const rows=[];let length=0;for(const segment of plan.segments.slice(start)){if(rows.length&&(rows.length>=100||length+segment.text.length>20000))break;rows.push(segment);length+=segment.text.length;}return rows;}
export function reconcileAutoAnalysis(contact,selection){
 const plan=buildAutoAnalysisPlan(contact),key=modelKey(selection),identity=identityKey(contact),old=contact.autoAnalysis||{},compatible=old.version===AUTO_ANALYSIS_VERSION&&old.modelKey===key&&old.identity===identity;
 let common=0;if(compatible)while(common<plan.fingerprints.length&&old.fingerprints?.[common]===plan.fingerprints[common])common++;
 const checkpoints=compatible?(Array.isArray(old.checkpoints)?old.checkpoints:[]).filter(c=>c&&Number.isInteger(c.end)&&c.end>0&&c.end<=common&&typeof c.memory==='string'&&c.memory.length<=4000).sort((a,b)=>a.end-b.end):[],covered=checkpoints.at(-1)?.end||0;
 const changed=!compatible||common!==(old.fingerprints?.length||0)||common!==plan.fingerprints.length;
 return {...(compatible?old:{}),version:AUTO_ANALYSIS_VERSION,modelKey:key,identity,fingerprints:plan.fingerprints,checkpoints,coveredSegments:covered,coveredMessages:plan.messageEnds.filter(end=>end<=covered).length,totalSegments:plan.segments.length,totalMessages:plan.totalMessages,memory:checkpoints.at(-1)?.memory||'',paused:old.paused===true,...(changed?{finalSignature:'',interpretations:[],attempts:0,nextRetryAt:0,error:''}:{})};
}
const finalKey=(cache,plan,profile)=>hash(JSON.stringify([cache.modelKey,cache.identity,cache.memory,plan.fingerprints.slice(-20),profile]));
export function isAutoAnalysisResultCurrent(contact,state,now=Date.now()){const cache=contact?.autoAnalysis;if(!cache||!['complete','paused'].includes(cache.status)||cache.modelKey!==modelKey(state)||cache.identity!==identityKey(contact))return false;const plan=buildAutoAnalysisPlan(contact);return Array.isArray(cache.fingerprints)&&Array.isArray(cache.interpretations)&&cache.fingerprints.length===plan.fingerprints.length&&cache.fingerprints.every((value,index)=>value===plan.fingerprints[index])&&cache.finalSignature===finalKey(cache,plan,summarizeSelfProfile(state.selfProfile,now));}
export function createAutoAnalysisScheduler({getState,subscribe,updateContact,request,persist=async()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let stopped=true,busy=false,scheduled=false,unsubscribe=()=>{},timer=null,active=null;
 const patch=(id,changes)=>updateContact(id,contact=>({...contact,autoAnalysis:{...(contact.autoAnalysis||{}),...changes}}));
 const current=id=>getState().contacts.find(c=>c.id===id);
 const valid=task=>!stopped&&!task.controller.signal.aborted&&active===task&&current(task.id)?.messages===task.messages&&identityKey(current(task.id))===task.identity&&modelKey(getState())===task.modelKey;
 const phaseValid=task=>valid(task)&&(task.phase!=='final'||JSON.stringify(summarizeSelfProfile(getState().selfProfile,now()))===task.voice);
 const call=(path,body,signal)=>{let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(new DOMException('分析已取消。','AbortError'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});return Promise.race([cancelled,Promise.resolve().then(()=>{signal.throwIfAborted();return request(path,body,signal);})]).finally(()=>signal.removeEventListener('abort',abort));};
 function wake(){if(stopped)return;if(active&&!phaseValid(active))active.controller.abort();if(busy||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void run();});}
 function schedule(delay){if(timer)clearTimer(timer);timer=setTimer(()=>{timer=null;wake();},Math.max(1,delay));}
 async function run(){
  if(stopped||busy)return;const state=getState();if(!state.persistenceReady||state.persistenceReadOnly)return;const key=modelKey(state),contacts=state.contacts.filter(c=>!c.isSample);let work=null,nextRetry=Infinity;
  for(const contact of contacts){const plan=buildAutoAnalysisPlan(contact);if(!plan.segments.length){if(contact.autoAnalysis&&contact.autoAnalysis.status!=='empty')patch(contact.id,{status:'empty',fingerprints:[],checkpoints:[],memory:'',interpretations:[],finalSignature:'',totalSegments:0,totalMessages:0,coveredSegments:0,coveredMessages:0});continue;}
   if(!key){if(contact.autoAnalysis?.status!=='waiting-model')patch(contact.id,{status:'waiting-model',totalMessages:plan.totalMessages});continue;}
   const cache=reconcileAutoAnalysis(contact,state),profile=summarizeSelfProfile(state.selfProfile,now());if(cache.paused)continue;if(cache.status==='waiting-model'&&cache.waitingSelection===key+'|'+(state.modelCatalogRevision||0))continue;if(cache.attempts>=3)continue;if(cache.nextRetryAt>now()){nextRetry=Math.min(nextRetry,cache.nextRetryAt);continue;}
   if(cache.coveredSegments===plan.segments.length&&cache.finalSignature===finalKey(cache,plan,profile)){if(cache.status!=='complete')patch(contact.id,{status:'complete'});continue;}
   work={contact,plan,cache,profile};break;
  }
  if(!work){if(Number.isFinite(nextRetry))schedule(nextRetry-now());return;}
  busy=true;const {contact,plan,cache,profile}=work,task={id:contact.id,messages:contact.messages,identity:identityKey(contact),modelKey:key,controller:new AbortController(),phase:cache.coveredSegments<plan.segments.length?'history':'final',voice:JSON.stringify(profile)};active=task;
  try{
   patch(contact.id,{...cache,status:task.phase==='history'?'summarizing':'interpreting',error:''});
   if(task.phase==='history'){
    const batch=nextHistoryBatch(plan,cache.coveredSegments),result=await call('analysis-history',{provider:state.provider,model:state.model,self:contact.self,target:contact.target,messages:batch.map(({id,sender,text})=>({id,sender,text})),memory:cache.memory},task.controller.signal);
    if(!valid(task))return;if(typeof result.memory!=='string'||result.memory.length>4000)throw Error('历史归纳返回了无效记忆。');
    const end=cache.coveredSegments+batch.length;patch(contact.id,{checkpoints:[...cache.checkpoints,{end,memory:result.memory}],memory:result.memory,coveredSegments:end,coveredMessages:plan.messageEnds.filter(value=>value<=end).length,status:'queued',attempts:0,nextRetryAt:0});
   }else{
    const recent=plan.segments.slice(-20),result=await call('interpretation',{provider:state.provider,model:state.model,self:contact.self,target:contact.target,messages:recent.map(({id,sender,text})=>({id,sender,text})),historyMemory:cache.memory,selfProfile:profile},task.controller.signal);
    if(!phaseValid(task))return;if(!Array.isArray(result.interpretations)||result.interpretations.length<2||result.interpretations.length>3)throw Error('解释结果不完整。');const sources=new Map(recent.map(segment=>[segment.id,segment]));
    const interpretations=result.interpretations.map(item=>{if(!item||!['explanation','uncertainty','reply'].every(key=>typeof item[key]==='string'&&item[key].trim())||!Array.isArray(item.evidence)||!item.evidence.length||item.evidence.length>3)throw Error('解释结果缺少有效字段或原文引用。');return {...item,evidence:item.evidence.map(e=>{const segment=sources.get(e.messageId);if(!segment||typeof e.quote!=='string'||!e.quote.trim()||!segment.text.includes(e.quote))throw Error('解释引用未通过原文核对。');return {...e,messageId:segment.sourceMessageId};})};});
    patch(contact.id,{interpretations,finalSignature:finalKey(cache,plan,profile),status:'complete',attempts:0,nextRetryAt:0,completedAt:now()});
   }
   try{await persist();}catch(error){throw Object.assign(new Error('本机分析进度保存失败，请释放空间后重试。'),{storageFailure:true});}
  }catch(error){if(phaseValid(task)&&error.name!=='AbortError'){if([400,503].includes(error.status)&&/模型|服务商|提供商|provider|model/i.test(error.message||'')){patch(contact.id,{status:'waiting-model',waitingSelection:key+'|'+(state.modelCatalogRevision||0),error:error.message,attempts:0,nextRetryAt:0});}else{const attempts=error.storageFailure?3:(cache.attempts||0)+1;patch(contact.id,{status:attempts>=3?'error':'retry-wait',attempts,nextRetryAt:attempts>=3?0:now()+[1000,5000,15000][attempts-1],error:error.message||'自动分析失败。'});}}}
  finally{if(active===task)active=null;busy=false;if(!stopped)wake();}
 }
 return {start(){if(!stopped)return;stopped=false;unsubscribe=subscribe(wake);wake();},stop(){stopped=true;unsubscribe();active?.controller.abort();if(timer)clearTimer(timer);timer=null;},pause(id){patch(id,{paused:true,status:'paused'});if(active?.id===id)active.controller.abort();wake();},resume(id){patch(id,{paused:false,status:'queued',waitingSelection:'',attempts:0,nextRetryAt:0,error:''});wake();},wake};
}
