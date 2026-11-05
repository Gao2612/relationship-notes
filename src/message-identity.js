// Stable local identities are assigned once and stored with each message. Native
// exporter ids are retained as legacy aliases, never overwritten by UI indices.
const identityHash=value=>{let a=2166136261,b=2246822519;for(const c of value){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),3266489917);}return (a>>>0).toString(36)+(b>>>0).toString(36);};
const oldHash=value=>{let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);};
export function legacyMessageId(message){return String(message?.id||'message-'+oldHash(JSON.stringify([message?.sender,message?.timestamp,message?.text,message?.file])));}
export function messageIdentity(message){return typeof message?.messageId==='string'&&message.messageId?message.messageId:legacyMessageId(message);}
const identityKey=m=>JSON.stringify([m.sender,m.timestamp??'',m.text??'',m.file||m.source||'',m.id??null]);
function aliases(message){return [...new Set([legacyMessageId(message),...(Array.isArray(message.legacyMessageIds)?message.legacyMessageIds:[])].filter(v=>typeof v==='string'&&v&&v.length<=200))];}
export function ensureMessageIds(messages){
 const used=new Set(),occurrences=new Map();return (messages||[]).map(message=>{const key=identityKey(message),occurrence=(occurrences.get(key)||0)+1;occurrences.set(key,occurrence);let messageId=message.messageId;
  if(typeof messageId!=='string'||!messageId||messageId.length>200||used.has(messageId)){const base='rn-msg-'+identityHash(key);let sequence=occurrence;messageId=base+'-'+sequence;while(used.has(messageId))messageId=base+'-'+(++sequence);}
  used.add(messageId);const legacyMessageIds=aliases(message);if(message.messageId&&message.messageId!==messageId&&!legacyMessageIds.includes(message.messageId))legacyMessageIds.push(message.messageId);return {...message,messageId,legacyMessageIds};
 });
}
export function resolveEvidenceContext(contact,reference={},options={}){
 const messages=contact?.messages||[],radius=Number.isInteger(options.radius)?Math.max(0,Math.min(20,options.radius)):3;
 let ref=typeof reference==='string'?{messageId:reference}:reference||{};
 if(ref.factId){const fact=(contact?.profileSummary||contact?.facts||[]).find(f=>f.uid===ref.factId||f.id===ref.factId);if(!fact)return {status:'missing',reason:'来源资料已不存在。'};ref={...fact,...ref,message:ref.message||fact.message,sourceMessageIds:ref.sourceMessageIds||fact.sourceMessageIds,quote:ref.quote||fact.quote};}
 const quote=typeof ref.quote==='string'?ref.quote:'',source=ref.message||ref;
 const explicit=[ref.messageId,...(Array.isArray(ref.sourceMessageIds)?ref.sourceMessageIds:[])].filter(v=>typeof v==='string'&&v),ids=explicit.length?explicit:[typeof ref.id==='string'?ref.id:null,ref.message?messageIdentity(ref.message):null].filter(v=>typeof v==='string'&&v);
 const matchesSource=message=>(!quote||String(message.text||'').includes(quote))&&(!source.sender||message.sender===source.sender)&&(source.timestamp==null||String(message.timestamp)===String(source.timestamp))&&(!source.file||message.file===source.file)&&(!ref.message?.text||message.text===ref.message.text);
 let matches=[];
 if(ids.length){matches=messages.map((message,index)=>({message,index})).filter(({message})=>ids.some(id=>[messageIdentity(message),...aliases(message)].includes(id))).filter(({message})=>matchesSource(message));}
 else if(quote||ref.message?.text){matches=messages.map((message,index)=>({message,index})).filter(({message})=>matchesSource(message));}
 // Legacy array indices are only corroborating hints, never an authority after
 // sort/edit. A quote that matches multiple records remains ambiguous.
 if(matches.length!==1)return {status:matches.length?'ambiguous':'missing',reason:matches.length?'存在多条相同依据，请重新选择原消息。':'原消息已删除、修改或不在当前记录中。'};
 const {message,index}=matches[0];return {status:'found',messageId:messageIdentity(message),index,message,context:messages.slice(Math.max(0,index-radius),index+radius+1).map((item,offset)=>({index:Math.max(0,index-radius)+offset,message:item,focus:item===message}))};
}
export function ensureContactMessageIds(contact){
 const messages=ensureMessageIds(contact.messages||[]),next={...contact,messages};
 const migrateFact=fact=>{const result=resolveEvidenceContext(next,fact);if(result.status!=='found')return {...fact};return {...fact,sourceMessageIds:[result.messageId],...(fact.message?{message:result.message}:{})};};
 if(Array.isArray(contact.facts))next.facts=contact.facts.map(migrateFact);if(Array.isArray(contact.profileSummary))next.profileSummary=contact.profileSummary.map(migrateFact);return next;
}
