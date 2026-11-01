// Evidence keys survive message sorting and incremental import; no body is logged.
export function interactionEvidenceKey(message){
 const text=JSON.stringify([message.sender,String(message.timestamp??''),message.text]);
 let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return 'interaction-'+(hash>>>0).toString(36);
}
const detectors={
 question:text=>/[?？]|(?:如何|为什么|怎么|是否|什么|哪[里个天]|吗\s*$)/.test(text),
 sharing:text=>/(?:^|[，。！？\n])\s*我(?:最近|今天|昨天|平时|正在|现在|很|比较|一直|打算|计划)*(?:喜欢|爱好|偏好|在|去了|参加|完成|住|从事|学|看了|做了)/.test(text),
 positive:text=>/(?<!不)(喜欢你|想见你|想你|谢谢你|辛苦你了|期待见你|抱抱)/.test(text),
 boundary:text=>/(不要再联系|别再联系|别打扰|停止联系|我不想(?:再)?(?:聊天|见面|联系)|不喜欢你)/.test(text),
};
const labels={question:'对方提问',sharing:'对方自我分享',positive:'对方明确正向表达',boundary:'对方明确负向表达或边界'};
export function isInteractionExcluded(message,kind,corrections=[]){return corrections.findLast(c=>c.key===interactionEvidenceKey(message)&&c.kind===kind)?.excluded===true;}
export function analyzeInteractionMetrics(contact={}){
 const messages=(contact.messages||[]).filter(m=>m&&typeof m.text==='string'&&(m.sender===contact.self||m.sender===contact.target));
 const corrections=contact.interactionCorrections||[],indicators=Object.entries(detectors).map(([kind,detect])=>{
  const evidence=messages.filter(m=>m.sender===contact.target&&detect(m.text)).map(message=>{
   const key=interactionEvidenceKey(message),correction=corrections.findLast(c=>c.key===key&&c.kind===kind);
   return {key,kind,message,quote:message.text,excluded:correction?.excluded===true,correction};
  });return {kind,label:labels[kind],count:evidence.filter(e=>!e.excluded).length,evidence};
 });
 const counts=Object.fromEntries(indicators.map(i=>[i.kind,i.count])),signals=Object.values(counts).reduce((a,b)=>a+b,0);
 let turns=0,prior;for(const m of messages){if(m.sender!==prior)turns++;prior=m.sender;}
 return {messages:messages.length,turns,indicators,score:signals?Math.max(0,Math.min(100,50+12*counts.positive-18*counts.boundary+5*counts.question+4*counts.sharing)):null,confidence:Math.min(.8,signals/20),disclaimer:'互动线索指数仅汇总已识别表达，不是好感概率；置信度仅表示线索数量。'};
}
export function correctInteraction(contact,action,now=Date.now()){
 if(!Object.hasOwn(detectors,action.kind)||typeof action.key!=='string')throw Error('互动纠正无效。');
 const found=analyzeInteractionMetrics(contact).indicators.find(i=>i.kind===action.kind)?.evidence.some(e=>e.key===action.key);
 if(!found)throw Error('原文已不存在，无法纠正。');
 return {...contact,interactionCorrections:[...(contact.interactionCorrections||[]),{key:action.key,kind:action.kind,excluded:action.excluded===true,note:String(action.note||'').slice(0,300),at:now}]};
}
