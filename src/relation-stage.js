// 关系阶段：只用可观察的聊天线索做可解释判定，人工设定永远优先。
// 判定结果不写回 contact，避免自动结果冲掉人工覆盖；每次按需重算。
import {analyzeDailyTimeline} from './analysis.js';

export const RELATION_STAGES=[
 {key:'stranger',label:'陌生人',band:[0,32],hint:'还没有形成持续互动'},
 {key:'acquaintance',label:'路人',band:[20,40],hint:'偶尔说两句，没有稳定往来'},
 {key:'colleague',label:'同事',band:[30,48],hint:'话题集中在工作与事务'},
 {key:'friend',label:'朋友',band:[40,58],hint:'有来有回，能聊日常'},
 {key:'closeFriend',label:'好朋友',band:[52,100],hint:'长期稳定，互相主动'},
 {key:'crush',label:'暗恋',band:[45,100],hint:'我方表达明显，对方没有同类信号'},
 {key:'ambiguous',label:'暧昧',band:[50,100],hint:'双方都有超越朋友的信号，关系没有说破'},
 {key:'partner',label:'对象',band:[55,100],hint:'出现明确的情侣称呼或关系确认'},
];
const STAGE_BY_KEY=new Map(RELATION_STAGES.map(stage=>[stage.key,stage]));
const PROFILE_FIELDS=[['label',60],['context',300],['expectation',300]];
const WORK=/(工作|上班|加班|项目|报告|论文|考试|作业|方案|设计稿|会议|客户|同事|领导|老板|周报|需求|上线|排期|面试|入职)/;
const STRONG_ROMANCE=/(想你|好想你|喜欢你|心动|心跳|想见你|宝贝|亲爱的|亲亲|抱抱|做我女朋友|做我男朋友|我女朋友|我男朋友|在一起吧|想娶你|想嫁你)/;
const WEAK_ROMANCE=/(晚安|在吗|在干嘛|吃什么|一起去|一起看|周末有空|小可爱|傻瓜|笨蛋)/;
const COMMIT=/(男朋友|女朋友|老公|老婆|对象|情侣|恋爱关系|我们在一起|我对象|领证|订婚)/;
// 疑问、否定与过往时态不是关系确认：「你有男朋友吗？」「我前男友」都不算证据。
const EXCLUDED_CONTEXT=/(前男友|前女友|前对象|前任|曾经|以前|当初|没有男朋友|没有女朋友|没对象|找不到对象|单身|不是男朋友|不是女朋友)/;
const QUESTION_TAIL=/(吗|嘛|么|呢)?\s*[?？]\s*$/;
const romanceEvidence=(pattern,text)=>pattern.test(text)&&!EXCLUDED_CONTEXT.test(text)&&!QUESTION_TAIL.test(text);
const DAY=86400000;
const clip=(value,max)=>typeof value==='string'?Array.from(value.trim()).slice(0,max).join(''):'';
const timestamp=message=>typeof message?.timestamp==='string'?message.timestamp:'';
const lateNight=message=>{const match=/[T ](\d{2}):\d{2}/.exec(timestamp(message));return Boolean(match)&&['23','00','01','02','03'].includes(match[1]);};

export function relationStageLabel(key){return STAGE_BY_KEY.get(key)?.label||'待定';}
export function isRelationStage(key){return STAGE_BY_KEY.has(key);}
export function relationStageOptions(){return RELATION_STAGES.map(({key,label})=>({key,label}));}

/** 人工维护的关系画像：对方称谓、相处语境、期望走向，以及人工指定的阶段。 */
export function relationProfile(contact){
 const raw=contact?.relationProfile&&typeof contact.relationProfile==='object'?contact.relationProfile:{};
 const override=raw.stageOverride&&isRelationStage(raw.stageOverride.stage)?{stage:raw.stageOverride.stage,note:clip(raw.stageOverride.note,200),at:Number.isFinite(raw.stageOverride.at)?raw.stageOverride.at:null}:null;
 return {label:clip(raw.label,60),context:clip(raw.context,300),expectation:clip(raw.expectation,300),stageOverride:override,updatedAt:Number.isFinite(raw.updatedAt)?raw.updatedAt:null};
}

/** 纯函数地改写关系画像。自动判定只读取这里，永远不会回写覆盖人工设定。 */
export function changeRelationProfile(contact,action={},now=Date.now()){
 if(!contact||typeof contact!=='object')throw new Error('缺少联系人');
 const current=relationProfile(contact),next={...current};
 if(action.type==='setProfile'){for(const [field,max] of PROFILE_FIELDS)if(action[field]!==undefined)next[field]=clip(action[field],max);}
 else if(action.type==='setField'){const field=PROFILE_FIELDS.find(([name])=>name===action.field);if(!field)throw new Error('未知的关系画像字段');next[field[0]]=clip(action.value,field[1]);}
 else if(action.type==='setStage'){if(!isRelationStage(action.stage))throw new Error('未知的关系阶段');next.stageOverride={stage:action.stage,note:clip(action.note,200),at:now};}
 else if(action.type==='clearStage')next.stageOverride=null;
 else throw new Error('未知的关系画像操作');
 next.updatedAt=now;
 return {...contact,relationProfile:next,relationProfileUpdatedAt:now};
}

const timelineCache=new WeakMap();
function contactDays(contact){
 if(Array.isArray(contact?.timelineAnalysis?.days)&&contact.timelineAnalysis.days.length)return contact.timelineAnalysis.days;
 const messages=contact?.messages;
 if(!Array.isArray(messages))return [];
 const cached=timelineCache.get(messages);
 if(cached)return cached;
 const days=analyzeDailyTimeline(messages,contact.self,contact.target,contact.interactionCorrections||[]).days;
 timelineCache.set(messages,days);
 return days;
}

const dayTime=date=>{const value=Date.parse(date+'T00:00:00+08:00');return Number.isFinite(value)?value:NaN;};

function recentMetrics(days,anchorDate){
 const anchor=anchorDate?dayTime(anchorDate):NaN;
 const scored=days.filter(day=>day&&Number.isFinite(day.affinityScore)&&Number(day.targetTurns)>0&&dayTime(day.date)>=0).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const inWindow=Number.isFinite(anchor)?scored.filter(day=>anchor-dayTime(day.date)<=29*DAY):scored.slice(-30);
 const used=inWindow.length?inWindow:scored.slice(-14);
 let weighted=0,weight=0,turns=0,targetTurns=0,selfStarts=0,targetStarts=0,emotional=0,repairs=0,targetShares=0,positiveCues=0;
 for(const day of used){
  const w=Math.max(1,Number(day.targetTurns)||1);
  weighted+=Number(day.affinityScore)*w;weight+=w;
  turns+=Number(day.turns)||0;targetTurns+=Number(day.targetTurns)||0;
  selfStarts+=Number(day.selfStarts)||0;targetStarts+=Number(day.targetStarts)||0;
  emotional+=Number(day.emotionalSharingTurns)||0;repairs+=Number(day.appeasementReplies)||0;
  targetShares+=Number(day.targetShares)||0;positiveCues+=Number(day.positiveCues)||0;
 }
 let averageScore=weight?weighted/weight:null;
 // 与月/年桶同一收缩规则：回合太少时把高分往 32 收，避免单日高分被当成长期关系。
 if(averageScore!==null&&turns<20&&averageScore>32)averageScore=32+(averageScore-32)*turns/20;
 const initiatives=selfStarts+targetStarts;
 return {days:used.length,turns,targetTurns,selfStarts,targetStarts,emotionalSharingTurns:emotional,repairs,targetShares,positiveCues,averageScore:averageScore===null?null:Math.round(averageScore*10)/10,targetInitRatio:initiatives?Math.round(targetStarts/initiatives*100)/100:0,anchor:anchorDate||used.at(-1)?.date||null};
}

function scanSide(contact,anchorDate,isTarget){
 const side={strong:[],weak:[],commit:[],work:0,lateNight:0,total:0};
 if(!contact||!Array.isArray(contact.messages))return side;
 const anchor=anchorDate?dayTime(anchorDate):NaN;
 const start=Number.isFinite(anchor)?anchor-29*DAY:NaN;
 for(const message of contact.messages){
  if(!message||typeof message.text!=='string'||message.sender!==(isTarget?contact.target:contact.self))continue;
  const text=message.text,date=timestamp(message).slice(0,10);
  if(Number.isFinite(start)&&dayTime(date)<start)continue;
  side.total++;
  if(romanceEvidence(STRONG_ROMANCE,text))side.strong.push(message);
  if(WEAK_ROMANCE.test(text))side.weak.push(message);
  if(romanceEvidence(COMMIT,text))side.commit.push(message);
  else if(COMMIT.test(text))side.excluded=(side.excluded||0)+1;
  if(WORK.test(text))side.work++;
  if(lateNight(message))side.lateNight++;
 }
 return side;
}
const evidenceOf=message=>({quote:Array.from(String(message.text)).slice(0,80).join(''),message,messageId:message.messageId});

export function buildRelationStage(contact,options={}){
 const now=Number.isFinite(options.now)?options.now:Date.now();
 const profile=relationProfile(contact);
 const identity=Boolean(contact&&typeof contact.self==='string'&&contact.self.trim()&&typeof contact.target==='string'&&contact.target.trim()&&contact.self.trim()!==contact.target.trim());
 const days=Array.isArray(options.days)?options.days:contactDays(contact);
 const metrics=recentMetrics(days,options.anchor||null);
 const mine=scanSide(contact,metrics.anchor,false),theirs=scanSide(contact,metrics.anchor,true);
 const messageTotal=mine.total+theirs.total,workRatio=messageTotal?Math.round((mine.work+theirs.work)/messageTotal*100)/100:0;
 const base={autoStage:'unknown',autoLabel:'待定',autoConfidence:0,stage:'unknown',label:'待定',confidence:0,manual:false,band:null,reasons:[],metrics:{...metrics,workRatio},profile,anchor:metrics.anchor,disclaimer:'阶段由本地规则从可观察的聊天线索推断，不是对对方想法的确认；你可以手动设定并长期覆盖。'};
 if(!identity)return {...base,reasons:[{code:'identity_missing',text:'还没有确认两个不同的发言人，无法做阶段判定。'}]};

 const reasons=[];
 const push=(code,text,evidence)=>{reasons.push(evidence?{code,text,evidence}:{code,text});};
 push('window',`近 30 天有 ${metrics.days} 天可评分互动、${metrics.turns} 个回合，平均线索分 ${metrics.averageScore===null?'—':metrics.averageScore}（按对方回合加权，样本少于 20 回合时沿用月/年桶的收缩规则）。`);
 let stage='acquaintance',confidence=0.35;
 const commitHits=theirs.commit.length+mine.commit.length,excluded=(theirs.excluded||0)+(mine.excluded||0);
 if(theirs.commit.length||commitHits>=2){
  stage='partner';confidence=0.85;
  push('commit',`出现 ${commitHits} 条明确的情侣称呼或关系确认${excluded?`（已排除 ${excluded} 条疑问/否定/过往表述）`:''}${theirs.commit.length?`（对方 ${theirs.commit.length} 条）`:''}。`,evidenceOf(theirs.commit[0]||mine.commit[0]));
 }else if((mine.strong.length&&theirs.strong.length)||(mine.weak.length>=3&&theirs.weak.length>=3&&theirs.lateNight>=2)){
  stage='ambiguous';confidence=mine.strong.length&&theirs.strong.length?0.75:0.55;
  push('mutual',`双方都有超越朋友的表达：我方 ${mine.strong.length} 条强信号 / ${mine.weak.length} 条弱信号，对方 ${theirs.strong.length} 条强信号 / ${theirs.weak.length} 条弱信号，对方深夜消息 ${theirs.lateNight} 条。`,evidenceOf(theirs.strong[0]||theirs.weak[0]));
 }else if(mine.strong.length>=2&&!theirs.strong.length&&metrics.targetInitRatio<=0.35&&metrics.days>=3){
  stage='crush';confidence=0.6;
  push('one_sided',`我方有 ${mine.strong.length} 条强信号、对方 0 条；对方主动发起占比 ${Math.round(metrics.targetInitRatio*100)}%，属于单向我方表达。`,evidenceOf(mine.strong[0]));
 }else if(workRatio>=0.6&&metrics.emotionalSharingTurns<=1&&!theirs.strong.length){
  stage='colleague';confidence=0.55;
  push('work_context',`近 30 天 ${Math.round(workRatio*100)}% 的消息围绕工作事务，情绪性分享 ${metrics.emotionalSharingTurns} 轮。`);
 }else if(metrics.days>=12&&metrics.averageScore!==null&&metrics.averageScore>=55&&metrics.targetInitRatio>=0.25&&(metrics.emotionalSharingTurns>=3||metrics.repairs>=1||metrics.targetShares>=5)){
  stage='closeFriend';confidence=0.65;
  push('stable',`互动覆盖 ${metrics.days} 天、平均线索分 ${metrics.averageScore}，对方主动发起占比 ${Math.round(metrics.targetInitRatio*100)}%，情绪分享 ${metrics.emotionalSharingTurns} 轮、事后解释 ${metrics.repairs} 次。`);
 }else if(metrics.days>=5&&metrics.turns>=30&&metrics.averageScore!==null&&metrics.averageScore>=40){
  stage='friend';confidence=0.55;
  push('regular',`互动覆盖 ${metrics.days} 天、${metrics.turns} 个回合，平均线索分 ${metrics.averageScore}。`);
 }else if(metrics.days<=1||metrics.turns<8){
  stage='stranger';confidence=0.7;
  push('thin',`只有 ${metrics.days} 天可评分互动、${metrics.turns} 个回合，样本不足以说明稳定往来。`);
 }else{
  stage='acquaintance';confidence=0.4;
  push('light',`互动 ${metrics.days} 天、${metrics.turns} 个回合，还没达到「朋友」的稳定度。`);
 }
 const definition=STAGE_BY_KEY.get(stage),auto={...base,stage,label:definition.label,confidence,autoStage:stage,autoLabel:definition.label,autoConfidence:confidence,band:definition.band,reasons};
 if(!profile.stageOverride)return auto;
 const manual=STAGE_BY_KEY.get(profile.stageOverride.stage);
 return {...auto,stage:profile.stageOverride.stage,label:manual.label,band:manual.band,confidence:1,manual:true,reasons:[{code:'manual',text:`你手动设定为「${manual.label}」${profile.stageOverride.note?`（备注：${profile.stageOverride.note}）`:''}；自动判定为「${auto.label}」，不会覆盖你的设定。`},...auto.reasons]};
}
