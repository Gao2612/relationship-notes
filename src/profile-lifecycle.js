const signature=f=>[f.field,f.quote||'',f.value].join('|');
const hash=value=>{let result=2166136261;for(const c of value)result=Math.imul(result^c.charCodeAt(0),16777619);return (result>>>0).toString(36);};
export function profileRows(contact){return (contact.profileSummary||[]).map((f,index)=>({...f,uid:f.uid||'fact-'+hash(signature(f)+'|'+index),status:f.status||(f.obsolete?'archived':'active'),effectiveAt:f.effectiveAt||f.editedAt||f.message?.timestamp||null}));}
export function changeProfile(contact,action,now=Date.now()){
 const rows=profileRows(contact),index=rows.findIndex(f=>f.uid===action.uid),current=rows[index],dismissed=new Set(contact.profileDismissed||[]);let next=rows;
 const newFact=(field,value,extra={})=>({uid:action.newUid||'fact-'+now+'-'+Math.random().toString(36).slice(2,9),field,value:value.trim(),quote:'',manual:true,confirmed:true,status:'active',effectiveAt:action.effectiveAt||now,createdAt:now,...extra});
 if(action.type==='add'&&action.value?.trim())next=[...rows,newFact(action.field,action.value)];
 else if(current){
  if(action.type==='edit'&&action.value?.trim())next=rows.map((f,i)=>i===index?{...f,value:action.value.trim(),status:f.status==='pending'?'active':f.status,manual:true,confirmed:true,editedAt:now}:f);
  if(action.type==='update'&&action.value?.trim()){next=rows.map((f,i)=>i===index?{...f,status:'superseded',obsolete:true,manual:true,effectiveUntil:action.effectiveAt||now}:f);next.push(newFact(current.field,action.value,{supersedes:current.uid}));}
  if(action.type==='archive')next=rows.map((f,i)=>i===index?{...f,status:'archived',obsolete:true,manual:true,archivedAt:now}:f);
  if(action.type==='restore'||action.type==='accept'){
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
 const rows=profileRows(contact),dismissed=new Set(contact.profileDismissed||[]),next=[...rows];
 for(const fact of generated){if(dismissed.has(fact.field+'|'+(fact.quote||''))||next.some(f=>f.field===fact.field&&(f.value===fact.value||(f.quote&&f.quote===fact.quote))))continue;
 const needsReview=['job','city'].includes(fact.field)&&next.some(f=>f.field===fact.field);
 next.push({...fact,uid:'fact-'+hash(signature(fact)),status:needsReview?'pending':'active',effectiveAt:fact.message?.timestamp||now,createdAt:now});
 }
 return {...contact,profileSummary:next,profileSummaryUpdatedAt:now};
}
