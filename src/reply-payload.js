import {analyzeDailyTimeline} from './analysis.js';
import {summarizeSelfProfile} from './self-profile.js';
import {suggestNextSteps} from './suggestions.js';
const retrievalStopWords=new Set('这个 那个 什么 怎么 为什么 可以 可能 应该 我们 你们 他们 自己 现在 今天 明天 昨天 最近 之前 以后 时候 一下 一些 一个 一点 一起 已经 还是 就是 不是 没有 但是 因为 所以 然后 如果 觉得 知道 回复 回答 帮我 帮忙 生成 说说 聊聊 想聊 继续 话题 内容 对方 记录 历史 关于 希望 表达 的事 的话'.split(' '));
const retrievalEnglishStop=new Set('the and that this with have from what when where how you your are was were for not but can could would should please reply message about'.split(' '));
function retrievalTerms(value){const result=new Set();for(const run of String(value||'').toLowerCase().match(/[\p{Script=Han}]+|[a-z][a-z0-9_-]{2,}/gu)||[]){if(/^[a-z]/.test(run)){if(!retrievalEnglishStop.has(run))result.add(run);continue;}for(let i=0;i<run.length-1;i++){const term=run.slice(i,i+2);if(!retrievalStopWords.has(term))result.add(term);}}return [...result];}
export function retrieveRelatedMessages(messages,self,target,intent){
 const intentTerms=retrievalTerms(intent);if(!intentTerms.length)return [];
 const pair=messages.filter(message=>message.sender===self||message.sender===target),recent=pair.slice(-12),recentTerms=retrievalTerms(recent.map(message=>message.text).join(' ')),key=message=>JSON.stringify([message.sender,message.text,message.timestamp??'']),excluded=new Set(recent.map(key)),seen=new Set();
 return pair.slice(0,-12).map((message,index)=>{const text=String(message.text||'').toLowerCase(),hits=intentTerms.filter(term=>text.includes(term)).length;return {message,index,score:hits?hits*4+Math.min(4,recentTerms.filter(term=>text.includes(term)).length):0};}).filter(row=>{if(!row.score||!String(row.message.text||'').trim())return false;const id=key(row.message);if(excluded.has(id)||seen.has(id))return false;seen.add(id);return true;}).sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,8).map(({message})=>({sender:message.sender,text:String(message.text).slice(0,500),timestamp:message.timestamp==null?'':String(message.timestamp).slice(0,50)}));
}
export function buildReplyPayload(state, contact) {
 const daily=analyzeDailyTimeline(contact.messages,contact.self,contact.target,contact.interactionCorrections||[]);
 const dailyTimeline=daily.days.map(day=>{const ai=contact.timelineAnalysis?.[day.date],aiReason=ai?` AI 分析摘要：${ai.summary} 活跃原因：${ai.activityReason} 互动线索：${ai.affinityContext}`:'';return {date:day.date,messages:day.messages.length,self:day.selfMessages,target:day.targetMessages,turns:day.turns,activityScore:day.activityScore,affinityScore:day.affinityScore,affinityChange:day.affinityChange,reason:`${day.reason} ${day.affinityNote}${aiReason}`.slice(0,360),affinityEvidence:day.affinityEvidence.slice(0,3).map(item=>item.quote.slice(0,100))};});
 const selfProfile=summarizeSelfProfile(state.selfProfile||contact.selfProfile||{}),suggestions=suggestNextSteps({...contact,selfProfile});
 const payload={provider:state.provider,model:state.model,self:contact.self,target:contact.target,messages:contact.messages.filter(m=>m.sender===contact.self||m.sender===contact.target).slice(-12).map(m=>({sender:m.sender,text:m.text.slice(0,500),timestamp:typeof m.timestamp==='string'?m.timestamp.slice(0,50):''})),facts:(Array.isArray(contact.profileSummary)?contact.profileSummary.filter(f=>!f.obsolete&&f.field!=='inference'&&f.kind!=='inference'&&(!f.status||f.status==='active')):contact.facts||[]).slice(0,12).map(f=>({field:f.field,value:f.value.slice(0,500)})),selfProfile,suggestions:suggestions.suggestions,suggestionDisclaimer:suggestions.disclaimer,relatedMessages:retrieveRelatedMessages(contact.messages,contact.self,contact.target,state.intent),dailyTimeline,scenario:state.scenario,tone:state.tone,intent:state.intent.slice(0,500)};
 for(const f of (contact.profileSummary||[]).filter(f=>['archived','superseded'].includes(f.status)).slice(-6))payload.facts.push({field:'资料更新',value:('旧资料“'+f.value+'”已'+(f.status==='superseded'?'被更新':'归档或移除')+'，仅属于历史情况，不作为当前偏好或习惯。').slice(0,500)});
 while(JSON.stringify(payload).length>60000 && payload.relatedMessages.length)payload.relatedMessages.pop();
 while(JSON.stringify(payload).length>60000 && payload.messages.length>1)payload.messages.shift();
 while(JSON.stringify(payload).length>60000 && payload.facts.length)payload.facts.pop();
 // Keep every daily record when possible; reasons are the first data trimmed if the host payload is too large.
 if(JSON.stringify(payload).length>60000){for(const day of payload.dailyTimeline){day.reason='';day.affinityEvidence=[];}}
 if(JSON.stringify(payload).length>60000)throw new Error('聊天时间线过长，无法安全发送给模型。');
 return payload;
}
