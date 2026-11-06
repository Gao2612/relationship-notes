import {scoringMessage} from './interaction-context.js';
import {interactionDetectors as detectors,interactionScore,engagementSignals} from './interaction-signals.js';
// Evidence keys survive message sorting and incremental import; no body is logged.
export function interactionEvidenceKey(message){
 if(typeof message.messageId==='string'&&message.messageId)return 'interaction-id:'+message.messageId;
 return legacyInteractionEvidenceKey(message);
}
export function legacyInteractionEvidenceKey(message){
 const text=JSON.stringify([message.sender,String(message.timestamp??''),message.text]);
 let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return 'interaction-'+(hash>>>0).toString(36);
}
const labels={question:'对方提问',sharing:'对方自我分享',positive:'对方明确正向表达',boundary:'对方明确负向表达或边界',perfunctory:'敷衍或收尾回合',lowContent:'低信息量回合',conflict:'摩擦回合',appeasement:'解释回合',answer:'回答或接受建议',continuation:'承接或补充信息'};
export function interactionCorrectionIndex(corrections=[],messages=[]){
 const legacy=new Map();
 for(const message of messages){
  const key=legacyInteractionEvidenceKey(message);
  legacy.set(key,[...(legacy.get(key)||[]),message]);
 }
 const index=new Map();
 for(const correction of corrections){
  const sources=correction.sources?.length?correction.sources:[{key:correction.key}];
  for(const source of sources){
   const candidates=legacy.get(source.key);
   const key=candidates?.length===1?interactionEvidenceKey(candidates[0]):source.key;
   index.set(key+'|'+correction.kind,{...correction,expectedText:source.text});
  }
 }
 return index;
}
export function isInteractionExcluded(message,kind,corrections=[]){
 const key=interactionEvidenceKey(message);
 const index=corrections instanceof Map?corrections:interactionCorrectionIndex(corrections,[message]);
 const correction=index.get(key+'|'+kind);
 return correction?.excluded===true&&(correction.expectedText===undefined||correction.expectedText===message.text);
}

export function analyzeInteractionMetrics(contact={}){
 const messages=(contact.messages||[]).filter(m=>m&&typeof m.text==='string'&&scoringMessage(m)&&(m.sender===contact.self||m.sender===contact.target));
 const corrections=interactionCorrectionIndex(contact.interactionCorrections||[],messages);
 const engagement=engagementSignals(messages,contact.self,(message,kind)=>isInteractionExcluded(message,kind,corrections));
 const indicators=Object.entries(detectors).map(([kind,detect])=>{
  const evidence=messages.filter(m=>m.sender===contact.target&&detect(m.text)).map(message=>{
   const key=interactionEvidenceKey(message),correction=corrections.get(key+'|'+kind);
   return {key,kind,message,quote:message.text,excluded:correction?.excluded===true,correction};
  });return {kind,label:labels[kind],count:evidence.filter(e=>!e.excluded).length,evidence};
 });
 for(const kind of ['perfunctory','lowContent','conflict','appeasement','answer','continuation']){
  const evidence=engagement.turnEvidence.filter(row=>row.kinds.includes(kind)).map(row=>{
   const key=interactionEvidenceKey(row.message),correction=corrections.get(key+'|'+kind);
   return {...row,key,kind,excluded:!row.applied.includes(kind),correction};
  });
  indicators.push({kind,label:labels[kind],count:evidence.filter(row=>!row.excluded).length,evidence});
 }
 const legacyCounts=new Map();for(const message of messages){const key=legacyInteractionEvidenceKey(message);legacyCounts.set(key,(legacyCounts.get(key)||0)+1);}const ambiguousCorrectionCount=(contact.interactionCorrections||[]).filter(c=>(legacyCounts.get(c.key)||0)>1).length;
 const counts=Object.fromEntries(indicators.map(i=>[i.kind,i.count])),signals=Object.values(counts).reduce((a,b)=>a+b,0);
 let turns=0,prior;for(const m of messages){if(m.sender!==prior)turns++;prior=m.sender;}
 const selfMessages=messages.filter(m=>m.sender===contact.self).length;
 return {engagementScore:interactionScore({...counts,positive:0,...engagement,messages:messages.length,selfMessages,targetMessages:messages.length-selfMessages}),messages:messages.length,turns,indicators,ambiguousCorrectionCount,...engagement,score:interactionScore({...counts,...engagement,messages:messages.length,selfMessages,targetMessages:messages.length-selfMessages}),confidence:Math.min(.8,signals/20),disclaimer:'互动线索指数仅汇总已识别表达，不是好感概率；置信度仅表示线索数量。'};
}
export function correctInteraction(contact,action,now=Date.now()){
 if(!Object.hasOwn(labels,action.kind)||typeof action.key!=='string')throw Error('互动纠正无效。');
 const found=analyzeInteractionMetrics(contact).indicators.find(i=>i.kind===action.kind)?.evidence.find(e=>e.key===action.key);
 if(!found)throw Error('原文已不存在，无法纠正。');
 return {...contact,interactionCorrections:[...(contact.interactionCorrections||[]),{key:action.key,kind:action.kind,excluded:action.excluded===true,note:String(action.note||'').slice(0,300),at:now,...(found.messages?{sources:found.messages.map(message=>({key:interactionEvidenceKey(message),text:message.text}))}:{})}]};
}
