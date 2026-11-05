// Pure, explicit selection for the opt-in host snapshot. Dates use Asia/Shanghai.
import {profileMessageId} from './profile-lifecycle.js';
import {shanghaiDateKey} from './shared/dates.js';
export const shareScopeDay=shanghaiDateKey;
export function normalizeShareScope(options={}){
 const date=value=>{if(value===undefined||value===null||value==='')return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||shanghaiDateKey(value)!==value)throw new RangeError('共享日期无效。');return value;};
 const since=date(options.since),until=date(options.until),limit=options.limit===undefined?500:Number(options.limit);
 if(since&&until&&since>until)throw new RangeError('共享开始日期不能晚于结束日期。');
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new RangeError('共享消息上限必须为1至500条。');
 return {since,until,limit};
}
export function selectShareScopeMessages(contact,options={}){
 const scope=normalizeShareScope(options),seen=new Set(),all=(contact?.messages||[]).filter(m=>{if(!(m.sender===contact.self||m.sender===contact.target)||!String(m.text||'').trim())return false;const id=profileMessageId(m);if(seen.has(id))return false;seen.add(id);return true;});
 let excludedUnknownTime=0;
 const eligible=all.filter(m=>{if(!scope.since&&!scope.until)return true;const day=shareScopeDay(m.timestamp);if(!day){excludedUnknownTime++;return false;}return (!scope.since||day>=scope.since)&&(!scope.until||day<=scope.until);});
 return {messages:eligible.slice(-scope.limit),scope,totalCount:all.length,eligibleCount:eligible.length,excludedUnknownTime};
}
export function buildShareScopePreview(contact,options={}){
 const selected=selectShareScopeMessages(contact,options),messages=selected.messages,times=messages.map(m=>m.timestamp).filter(t=>shareScopeDay(t));
 return {contact:{id:String(contact?.id||''),self:String(contact?.self||''),target:String(contact?.target||'')},...selected.scope,messageCount:messages.length,totalCount:selected.totalCount,eligibleCount:selected.eligibleCount,firstTimestamp:times[0]??null,lastTimestamp:times.at(-1)??null,truncatedMessages:Math.max(0,selected.eligibleCount-messages.length),textTruncatedCount:messages.filter(m=>String(m.text).length>2000).length,excludedUnknownTime:selected.excludedUnknownTime,includedUnknownTime:messages.filter(m=>!shareScopeDay(m.timestamp)).length,maxTextLength:2000};
}
