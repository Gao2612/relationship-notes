import {messageIdentity} from './message-identity.js';
const signature=f=>[f.field,f.quote||'',f.value].join('|');
const hash=value=>{let result=2166136261;for(const c of value)result=Math.imul(result^c.charCodeAt(0),16777619);return (result>>>0).toString(36);};
export function profileMessageId(message){return messageIdentity(message);}
export function profileExpiryTime(value){if(value==null||value==='')return null;if(typeof value==='number')return Number.isFinite(value)?value:NaN;if(typeof value!=='string')return NaN;if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const date=new Date(value+'T00:00:00+08:00');if(!Number.isFinite(date.getTime())||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)!==value)return NaN;return date.getTime()+86400000-1;}const time=Date.parse(value);return Number.isFinite(time)?time:NaN;}
export function profileFactStatus(fact,now=Date.now()){const status=fact.status||(fact.obsolete?'archived':'active');if(status!=='active')return status;if(['completed','cancelled','expired'].includes(fact.planState))return fact.planState;const expiry=profileExpiryTime(fact.expiresAt);return expiry!==null&&Number.isFinite(expiry)&&now>expiry?'expired':status;}
export function isProfileFactCurrent(fact,now=Date.now()){return !fact.obsolete&&profileFactStatus(fact,now)==='active';}
export function profileKind(field){return ({interests:'interest',preferences:'interest',style:'style',boundary:'boundary',followup:'followup',recent:'followup',agreement:'followup',inference:'inference'})[field]||'fact';}
export function profileRows(contact,now=Date.now()){return (contact.profileSummary||[]).map((f,index)=>({...f,uid:f.uid||'fact-'+hash(signature(f)+'|'+index),storedStatus:f.status||(f.obsolete?'archived':'active'),status:profileFactStatus(f,now),effectiveAt:f.effectiveAt||f.editedAt||f.message?.timestamp||null}));}
const canonicalProfileRows=contact=>profileRows(contact).map(({storedStatus,...fact})=>({...fact,status:storedStatus}));
export function changeProfile(contact,action,now=Date.now()){
 const rows=canonicalProfileRows(contact),index=rows.findIndex(f=>f.uid===action.uid),current=rows[index],effectiveStatus=current?profileFactStatus(current,now):null,dismissed=new Set(contact.profileDismissed||[]);let next=rows;
 const newFact=(field,value,extra={})=>({uid:action.newUid||'fact-'+now+'-'+Math.random().toString(36).slice(2,9),field,kind:profileKind(field),provenance:'user',confidence:field==='inference'?null:1,sourceMessageIds:[],value:value.trim(),quote:'',manual:true,confirmed:true,status:'active',effectiveAt:action.effectiveAt||now,createdAt:now,...extra});
 if(action.type==='add'&&action.value?.trim())next=[...rows,newFact(action.field,action.value)];
 else if(current){
  const transition=(status,extra={})=>rows.map((f,i)=>i===index?{...f,status,obsolete:status!=='active',manual:true,...extra,lifecycleHistory:[...(f.lifecycleHistory||[]),{from:effectiveStatus,to:status,at:now}]}:f);
  if(['complete','cancel'].includes(action.type)&&['active','expired'].includes(effectiveStatus)&&['followup','recent','agreement','plans'].includes(current.field))next=transition(action.type==='complete'?'completed':'cancelled',{planState:action.type==='complete'?'completed':'cancelled',effectiveUntil:now});
  if(action.type==='expire'&&effectiveStatus==='active')next=transition('expired',{expiresAt:now-1,effectiveUntil:now});
  if(action.type==='reopen'&&['completed','cancelled','expired'].includes(effectiveStatus))next=transition('active',{planState:'active',expiresAt:null,effectiveUntil:null});
  if(action.type==='setExpiry'&&['active','expired'].includes(effectiveStatus)){const expiry=profileExpiryTime(action.expiresAt);if(Number.isNaN(expiry))throw new Error('到期日期无效，请选择有效日期。');next=rows.map((f,i)=>i===index?{...f,expiresAt:action.expiresAt||null,editedAt:now}:f);}
  if(action.type==='edit'&&action.value?.trim())next=rows.map((f,i)=>i===index?{...f,value:action.value.trim(),status:f.status==='pending'?'active':f.status,manual:true,confirmed:true,editedAt:now,revisions:[...(f.revisions||[]),{value:f.value,status:f.status,at:now}]}:f);
  if(action.type==='update'&&action.value?.trim()){next=rows.map((f,i)=>i===index?{...f,status:'superseded',obsolete:true,manual:true,effectiveUntil:action.effectiveAt||now}:f);next.push(newFact(current.field,action.value,{supersedes:current.uid}));}
  if(action.type==='archive'&&current.status!=='deleted')next=rows.map((f,i)=>i===index?{...f,status:'archived',archivedFrom:f.status,obsolete:true,manual:true,archivedAt:now}:f);
  if(action.type==='restore'&&current.status==='archived'&&current.archivedFrom==='pending')next=rows.map((f,i)=>i===index?{...f,status:'pending',obsolete:false,confirmed:false,restoredAt:now}:f);
  else if((action.type==='restore'&&['archived','superseded'].includes(current.status))||(action.type==='accept'&&current.status==='pending')){
   const successors=new Set([current.uid]);
   if(action.type==='restore'&&!action.keepBoth){let changed=true;while(changed){changed=false;for(const fact of rows)if(fact.field===current.field&&successors.has(fact.supersedes)&&!successors.has(fact.uid)){successors.add(fact.uid);changed=true;}}}
   const replaced=action.type==='accept'&&action.replaceCurrent?rows.filter(f=>f.uid!==current.uid&&f.field===current.field&&f.status==='active'):[];
   const time=f=>{const value=f.effectiveAt||f.createdAt||0;if(typeof value==='number')return value;const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:0;};
   const latest=replaced.reduce((prior,f)=>!prior||time(f)>=time(prior)?f:prior,null),replacedIds=new Set(replaced.map(f=>f.uid));
   next=rows.map((f,i)=>i===index?{...f,status:'active',obsolete:false,manual:true,confirmed:true,effectiveUntil:null,restoredAt:now,...(latest?{supersedes:latest.uid}:{})}:(action.type==='restore'&&!action.keepBoth&&successors.has(f.uid)&&f.status==='active')||replacedIds.has(f.uid)?{...f,status:'superseded',obsolete:true,manual:true,effectiveUntil:action.effectiveAt||now}:f);
  }
  if(action.type==='delete'){dismissed.add(current.field+'|'+current.quote);next=rows.map((f,i)=>i===index?{...f,status:'deleted',manual:true,deletedAt:now,deletedFrom:f.status}:f);}
  if(action.type==='undoDelete'){dismissed.delete(current.field+'|'+current.quote);next=rows.map((f,i)=>i===index?{...f,status:f.deletedFrom||'active',deletedAt:null,manual:true}:f);}
 }
 return {...contact,profileSummary:next,profileDismissed:[...dismissed],profileSummaryUpdatedAt:now};
}
export function mergeProfileAnalysis(contact,generated,now=Date.now()){
 const rows=canonicalProfileRows(contact),dismissed=new Set(contact.profileDismissed||[]),next=[...rows];
 for(const fact of generated){if(dismissed.has(fact.field+'|'+(fact.quote||''))||next.some(f=>f.field===fact.field&&(f.value===fact.value||(f.quote&&f.quote===fact.quote))))continue;
 next.push({...fact,uid:'fact-'+hash(signature(fact)),kind:fact.kind||profileKind(fact.field),provenance:'model',manual:false,confidence:Number.isFinite(fact.confidence)?Math.max(0,Math.min(1,fact.confidence)):null,sourceMessageIds:fact.sourceMessageIds|| (fact.message?[profileMessageId(fact.message)]:[]),status:'pending',confirmed:false,effectiveAt:fact.message?.timestamp||now,createdAt:now});
 }
 return {...contact,profileSummary:next,profileSummaryUpdatedAt:now};
}
