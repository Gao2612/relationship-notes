// 关系分析 v3 · 编排：规则层周汇总 + 已缓存的 AI 周分析 → 每周评分、长期变化、可解释证据。
// 事实与推断严格分开：
//   fact      规则层统计与原文（可点击回到上下文）
//   ai-quote  AI 引用的原文（宿主已逐字校验）及其对该句的客观描述
//   inference AI 的解释性推断，附置信度与替代解释，界面以不同样式标出
import {buildWeeklySignals,buildTurns} from './weekly-signals.js';
import {scoreWeek,DIMENSIONS,FRICTION,MODEL_VERSION} from './model.js';
import {longitudinal} from './longitudinal.js';
import {messageIdentity} from '../message-identity.js';
import {shanghaiDateKey} from '../shared/dates.js';
import {weekStartKey} from './weekly-signals.js';
export {DIMENSIONS,FRICTION,MODEL_VERSION} from './model.js';
export {languageStyleMatching,functionWordRates} from './lsm.js';
export {buildWeeklySignals,buildTurns,weekStartKey} from './weekly-signals.js';
export {scoreWeek,ruleDimensions,fuseDimension,shrink} from './model.js';
export {longitudinal,trend,changePoints,ewma} from './longitudinal.js';

export const AI_RESULT_VERSION=1;
export const AI_MAX_MESSAGES=80,AI_MAX_CHARS=300,AI_DIMENSIONS=['responsiveness','disclosure','reciprocity','positivity','engagement','friction'];

function hashText(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(36);}
const clip=(text,n)=>{const chars=Array.from(String(text||'').replace(/\s+/g,' ').trim());return chars.length>n?chars.slice(0,n).join(''):chars.join('');};

/** 某周发送给模型的消息：≤80 条，优先保留对方有信号的回合及其前一轮我方消息，其余按时间均匀抽样。 */
export function selectWeekMessages(contact,weekStart,{max=AI_MAX_MESSAGES,turns:all=buildTurns(contact)}={}){
 const turns=all.filter(t=>t.week===weekStart);
 const rows=turns.flatMap((turn,ti)=>turn.messages.map(m=>({m,ti,turn})));
 if(rows.length<=max)return {rows,sampled:false,total:rows.length};
 const keep=new Set();
 turns.forEach((turn,ti)=>{const s=turn.signals;if(turn.role==='target'&&(s.disclosure||s.conflict||s.repair||s.boundary||s.positiveWeight>=4||s.question)){keep.add(ti);if(ti>0)keep.add(ti-1);}});
 let picked=rows.filter(r=>keep.has(r.ti));
 if(picked.length>max)picked=picked.filter((_,i)=>i%Math.ceil(picked.length/max)===0);
 const rest=rows.filter(r=>!keep.has(r.ti)),room=max-picked.length;
 if(room>0&&rest.length){const step=rest.length/room;for(let i=0;i<room&&Math.floor(i*step)<rest.length;i++)picked.push(rest[Math.floor(i*step)]);}
 const order=new Map(rows.map((r,i)=>[r,i]));picked.sort((a,b)=>order.get(a)-order.get(b));
 return {rows:picked.slice(0,max),sampled:true,total:rows.length};
}

export function buildAffinityRequest(contact,weekStart,{previousSummary,turns}={}){
 const {rows,sampled,total}=selectWeekMessages(contact,weekStart,{turns});
 const messages=rows.map(({m})=>({id:clip(messageIdentity(m),200),sender:m.sender,text:clip(m.text,AI_MAX_CHARS)})).filter(m=>m.text);
 const body={self:clip(contact.self,100),target:clip(contact.target,100),week:{start:weekStart,end:shiftDays(weekStart,6)},messages,sampled:{total,sent:messages.length}};
 if(previousSummary)body.previousSummary=clip(previousSummary,600);
 return body;
}
function shiftDays(key,days){const d=new Date(key+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function weekFingerprint(contact,weekStart,turns=buildTurns(contact)){
 const rows=turns.filter(t=>t.week===weekStart).flatMap(t=>t.messages);
 return hashText(rows.map(m=>messageIdentity(m)+'\u0001'+m.text).join('\u0002'));
}

/** 读取仍有效的 AI 周结果（版本与消息指纹都匹配）。 */
export function cachedAiWeek(contact,weekStart,fingerprint=weekFingerprint(contact,weekStart)){
 const entry=contact.affinityV3?.weeks?.[weekStart];
 return entry&&entry.version===AI_RESULT_VERSION&&entry.fingerprint===fingerprint&&entry.result?entry:null;
}
export function storeAiWeek(contact,weekStart,{result,provider,model,fingerprint,request},now=Date.now()){
 const weeks={...(contact.affinityV3?.weeks||{})};
 weeks[weekStart]={version:AI_RESULT_VERSION,fingerprint,result,provider,model,analyzedAt:now,sampled:request?.sampled||null};
 return {...contact,affinityV3:{modelVersion:MODEL_VERSION,weeks}};
}

const byId=contact=>{const map=new Map();for(const m of contact.messages||[])map.set(messageIdentity(m),m);return map;};

/** 为单周生成可解释记录。 */
export function explainWeek(scored,week,ai,contact){
 const messages=byId(contact),one=key=>{
  const dim=key==='friction'?FRICTION:DIMENSIONS.find(d=>d.key===key),fused=key==='friction'?null:scored.dims[key];
  const facts=(week.evidence[key]||[]).map(e=>({...e,type:'fact',message:e.messageId?messages.get(e.messageId)||null:null}));
  const aiDim=ai?.dimensions?.[key];
  const observations=(aiDim?.evidence||[]).map(e=>({type:'ai-quote',messageId:e.messageId,quote:e.quote,note:e.note||'',message:messages.get(e.messageId)||null}));
  const inference=aiDim&&aiDim.inference?{type:'inference',text:aiDim.inference,alternatives:aiDim.alternatives||'',confidence:aiDim.confidence,rating:aiDim.rating}:null;
  return {key,label:dim.label,definition:dim.definition,rule:dim.rule,refs:dim.refs,fused,facts,observations,inference};
 };
 return {dimensions:[...DIMENSIONS.map(d=>one(d.key)),one('friction')],
  boundary:{facts:(week.evidence.boundary||[]).map(e=>({...e,type:'fact',message:messages.get(e.messageId)||null})),
   ai:(ai?.boundary?.evidence||[]).map(e=>({type:'ai-quote',messageId:e.messageId,quote:e.quote,note:e.note||'',message:messages.get(e.messageId)||null}))},
  summary:ai?.summary||'',uncertainties:ai?.uncertainties||''};
}

/** 完整分析。返回每周评分、长期变化、待 AI 分析的周。 */
export function analyzeRelationship(contact={}){
 const turns=buildTurns(contact),weeks=buildWeeklySignals(contact,turns),scored=[],pending=[];
 const byWeek=new Map();for(const t of turns){if(!byWeek.has(t.week))byWeek.set(t.week,[]);byWeek.get(t.week).push(t);}
 for(const week of weeks){
  const fingerprint=weekFingerprint(contact,week.start,byWeek.get(week.start)||[]),cached=cachedAiWeek(contact,week.start,fingerprint);
  const result=scoreWeek(week,cached?.result||null);result.fingerprint=fingerprint;result.ai=cached?{provider:cached.provider,model:cached.model,analyzedAt:cached.analyzedAt,sampled:cached.sampled}:null;
  result.week=week;scored.push(result);// 模型需要对方至少一条消息才能评定；没有对方消息的周只显示规则层。
  if(!cached&&week.target.turns>0)pending.push(week.start);
 }
 const series=longitudinal(scored);
 const coverage=scored.length?scored.filter(s=>s.ai).length/scored.length:0;
 return {modelVersion:MODEL_VERSION,turns,weeks:scored,...series,pending,coverage,boundaryWeeks:scored.filter(s=>s.boundary.rule).map(s=>s.start),reviewWeeks:scored.filter(s=>s.boundary.needsReview).map(s=>s.start)};
}
export function currentWeekKey(now=Date.now()){return weekStartKey(shanghaiDateKey(now));}
