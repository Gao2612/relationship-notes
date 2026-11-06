import {shanghaiDateKey} from './shared/dates.js';
import {scoringMessage} from './interaction-context.js';
import {isProfileFactCurrent} from './profile-lifecycle.js';
// Observable local heuristics only. No relationship, attraction or response-time inference.
import {isInteractionExcluded,interactionCorrectionIndex} from './interaction-metrics.js';
const validPair=(self,target)=>typeof self==='string'&&typeof target==='string'&&self.trim()&&target.trim()&&self.trim()!==target.trim();
const selected=(messages,self,target)=>validPair(self,target)&&Array.isArray(messages)?messages.filter(m=>m&&typeof m.text==='string'&&scoringMessage(m)&&(m.sender===self||m.sender===target)):[];
import {question,sharing,boundary,acknowledgment,positive,negative,interactionScore,engagementSignals,engagementDays} from './interaction-signals.js';
const positiveCue={test:positive},negativeCue={test:negative};
const topics=[['工作',/(工作|上班|加班|项目|报告|论文|考试|作业|方案|设计稿)/],['日常',/(今天|最近|吃饭|睡觉|下班|天气|回家)/],['周末计划',/(周末|休息日|下周|明天|约吗|有空|见面|一起去)/],['兴趣活动',/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|看展)/]];
const dayKey=shanghaiDateKey;
/** Daily activity and explicitly worded target-side affinity cues. Counts are evidence, not mind-reading. */
export function analyzeDailyTimeline(messages,self,target,corrections=[]){
 const list=selected(messages,self,target),groups=new Map();corrections=interactionCorrectionIndex(corrections,list);
 for(const message of list){const date=dayKey(message.timestamp);if(!date)continue;let day=groups.get(date);if(!day){day={date,messages:[],selfMessages:0,targetMessages:0,turns:0,selfTurns:0,targetTurns:0,questions:0,shares:0,acknowledgments:0,targetQuestions:0,targetShares:0,positiveCues:0,negativeCues:0,affinityEvidence:[]};groups.set(date,day);}
  day.messages.push(message);if(message.sender===self)day.selfMessages++;else day.targetMessages++;
  if(day.lastSender!==message.sender){day.turns++;if(message.sender===self)day.selfTurns++;else day.targetTurns++;day.lastSender=message.sender;}
  if(question(message.text)&&(message.sender!==target||!isInteractionExcluded(message,'question',corrections)))day.questions++;if(sharing(message.text)&&(message.sender!==target||!isInteractionExcluded(message,'sharing',corrections)))day.shares++;if(acknowledgment(message.text))day.acknowledgments++;
  if(message.sender===target){const asks=question(message.text)&&!isInteractionExcluded(message,'question',corrections),shares=sharing(message.text)&&!isInteractionExcluded(message,'sharing',corrections),pos=positiveCue.test(message.text)&&!isInteractionExcluded(message,'positive',corrections),neg=negativeCue.test(message.text)&&!isInteractionExcluded(message,'boundary',corrections);if(asks)day.targetQuestions++;if(shares)day.targetShares++;if(pos)day.positiveCues++;if(neg)day.negativeCues++;if(day.affinityEvidence.length<6){if(pos||neg)day.affinityEvidence.push({kind:pos?'positive':'negative',quote:message.text,message});else if(asks)day.affinityEvidence.push({kind:'question',quote:message.text,message});else if(shares)day.affinityEvidence.push({kind:'sharing',quote:message.text,message});}}
 }
 const days=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date));if(!days.length)return {days:[],averageMessages:0};
 const engagements=engagementDays(engagementSignals(list,self,(message,kind)=>isInteractionExcluded(message,kind,corrections)));
 for(const day of days){
  const engagement=engagements.get(day.date);
  day.selfTurns=engagement.selfTurns;
  day.targetTurns=engagement.targetTurns;
  day.turns=day.selfTurns+day.targetTurns;
 }
 const averageMessages=days.reduce((sum,day)=>sum+day.messages.length,0)/days.length,maxMessages=Math.max(...days.map(day=>day.messages.length)),maxTurns=Math.max(...days.map(day=>day.turns));let previousAffinity=null;
 for(const day of days){day.activityScore=Math.round(70*day.messages.length/maxMessages+30*day.turns/maxTurns);day.activityDelta=Math.round(day.messages.length-averageMessages);const engagement=engagements.get(day.date);Object.assign(day,{scenes:engagement.scenes,answeredTurns:engagement.answeredTurns,continuedTurns:engagement.continuedTurns,selfTurns:engagement.selfTurns,strongConflict:engagement.strongConflict,selfStarts:engagement.selfStarts,targetStarts:engagement.targetStarts,medianReplyMinutes:engagement.medianMinutes,slowReplies:engagement.slowReplies,perfunctoryReplies:engagement.perfunctoryReplies,lowContentReplies:engagement.lowContentReplies,targetTurns:engagement.targetTurns,conflictReplies:engagement.conflictReplies,appeasementReplies:engagement.appeasementReplies,replySamples:engagement.replySamples,initiator:engagement.selfStarts===engagement.targetStarts?'balanced':engagement.targetStarts>engagement.selfStarts?'target':'self'});const signalCount=day.positiveCues+day.negativeCues+day.targetQuestions+day.targetShares+day.perfunctoryReplies+day.slowReplies+day.targetStarts+day.selfStarts;day.affinityScore=interactionScore({positive:day.positiveCues,boundary:day.negativeCues,question:day.targetQuestions,sharing:day.targetShares,...engagement,messages:day.messages.length,selfMessages:day.selfMessages,targetMessages:day.targetMessages});day.engagementScore=interactionScore({positive:0,boundary:day.negativeCues,question:day.targetQuestions,sharing:day.targetShares,...engagement,messages:day.messages.length,selfMessages:day.selfMessages,targetMessages:day.targetMessages});day.affinitySignalCount=signalCount;day.affinityChange=day.affinityScore===null||previousAffinity===null?null:day.affinityScore-previousAffinity;if(day.affinityScore!==null)previousAffinity=day.affinityScore;
  const topicHits=topics.filter(([,rule])=>day.messages.some(message=>rule.test(message.text))).map(([label])=>label).slice(0,2),volume=day.activityDelta>0?`高于活跃日均 ${day.activityDelta} 条`:day.activityDelta<0?`低于活跃日均 ${Math.abs(day.activityDelta)} 条`:'接近日均消息量';
  const signals=[];if(day.questions)signals.push(`${day.questions} 条提问`);if(day.shares)signals.push(`${day.shares} 条第一人称分享`);if(day.acknowledgments)signals.push(`${day.acknowledgments} 条简短确认`);if(topicHits.length)signals.push(`话题涉及${topicHits.join('、')}`);
  day.reason=`共 ${day.messages.length} 条消息（你 ${day.selfMessages} / 对方 ${day.targetMessages}），${volume}${signals.length?'；话题线索：'+signals.join('，'):''}。`;
  if(day.affinityScore===null)day.affinityNote='';else{const minutes=day.medianReplyMinutes,interval=minutes===null?'':minutes<60?`${minutes} 分钟`:`${(minutes/60).toFixed(1)} 小时`,extra=[];if(day.perfunctoryReplies)extra.push(`敷衍或收尾式回合 ${day.perfunctoryReplies} 轮`);if(day.lowContentReplies)extra.push(`低信息量回合 ${day.lowContentReplies} 轮`);if(day.slowReplies)extra.push(`超过 2 小时才回 ${day.slowReplies} 次`);if(day.conflictReplies)extra.push(`反讽或赌气 ${day.conflictReplies} 处`);if(day.appeasementReplies)extra.push(`事后解释 ${day.appeasementReplies} 条`);if(day.targetTurns===1&&day.selfTurns>=2)extra.push('对方只回 1 轮，我方多轮独白');if(!day.targetTurns&&day.messages.length)extra.push('对方整日未开口，记为冷场');if(interval)extra.push(`回复中位间隔 ${interval}`);day.affinityNote=(day.targetTurns<=1&&day.messages.length<6?'（样本过少，仅供参考）':'')+`对方正向表达 ${day.positiveCues} 条、负向或拒绝表达 ${day.negativeCues} 条、提问 ${day.targetQuestions} 条、自我分享 ${day.targetShares} 条${extra.length?'；'+extra.join('、'):''}；开口主动 对方 ${day.targetStarts} 次 / 你 ${day.selfStarts} 次。`;}
 }
 return {days,averageMessages:Math.round(averageMessages*10)/10};
}
const ev=(message,type,index)=>({id:`${type}-${index}`,type,label:({question:'直接提问',sharing:'第一人称分享',boundary:'明确边界',context:'回复依据',acknowledgment:'简短确认'})[type],quote:message.text,message});
export function analyzeConversation(messages,self,target){
 const list=selected(messages,self,target),evidence=[];let selfCount=0,targetCount=0,selfTurns=0,targetTurns=0,prior=null;
 list.forEach((m,i)=>{if(m.sender===self)selfCount++;else targetCount++;if(m.sender!==prior){if(m.sender===self)selfTurns++;else targetTurns++;prior=m.sender;}for(const [type,detect] of [['question',question],['sharing',sharing],['boundary',boundary],['acknowledgment',acknowledgment]])if(detect(m.text))evidence.push(ev(m,type,i));});
 const turns=selfTurns+targetTurns,balanceScore=selfCount&&targetCount?Math.round(100*(1-Math.abs(selfTurns-targetTurns)/turns)):null;
 // Keep legacy turn balance for compatibility; message balance captures unequal bursts.
 const messageBalanceScore=selfCount&&targetCount?Math.round(100*(1-Math.abs(selfCount-targetCount)/list.length)):null;
 const questionCount=evidence.filter(e=>e.type==='question').length,sharingCount=evidence.filter(e=>e.type==='sharing').length,boundaryCount=evidence.filter(e=>e.type==='boundary').length,acknowledgmentCount=evidence.filter(e=>e.type==='acknowledgment').length;
 const engagement=engagementSignals(list,self);
 const scoringTurns=engagement.selfTurns+engagement.targetTurns;
 return {scoringTurns,total:list.length,selfCount,targetCount,turns,selfTurns,targetTurns,balanceScore,messageBalanceScore,questionCount,sharingCount,boundaryCount,acknowledgmentCount,evidence,summary:`所选记录共 ${list.length} 条、${scoringTurns} 个发言回合；识别到 ${questionCount} 条提问、${sharingCount} 条第一人称分享、${boundaryCount} 条明确边界、${acknowledgmentCount} 条简短确认。`};
}
const boundedLimit=value=>Number.isFinite(Number(value))?Math.min(500,Math.max(1,Math.floor(Number(value)))):160;
const clip=(text,n)=>Array.from(text).slice(0,n).join('');
export function buildReplyContext({messages=[],self,target,facts=[],profileSummary,scenario='continue',tone='gentle',intent='',limit=160}={}){
 if(!validPair(self,target))throw new Error('请选择两个不同的发言人');
 const list=selected(messages,self,target);
 return {self:clip(self,100),target:clip(target,100),messages:list.slice(-40).map(m=>({sender:m.sender,text:clip(m.text,2000),timestamp:typeof m.timestamp==='string'?clip(m.timestamp,100):'',line:m.line,endLine:m.endLine,file:typeof m.file==='string'?clip(m.file,200):'',messageIndex:m.messageIndex})),facts:(Array.isArray(profileSummary)?profileSummary.filter(f=>isProfileFactCurrent(f)&&(f.provenance!=='model'||f.confirmed===true)&&f.field!=='inference'&&f.kind!=='inference'):Array.isArray(facts)?facts:[]).slice(0,20).map(f=>clip(typeof f==='string'?f:typeof f?.value==='string'?f.value:'',300)).filter(Boolean),scenario:['continue','question','invite','boundary','reconnect','care','clarify','apologize'].includes(scenario)?scenario:'continue',tone:['gentle','casual','concise','warm','direct'].includes(tone)?tone:'gentle',intent:clip(typeof intent==='string'?intent:'',500),limit:boundedLimit(limit),boundary:list.some(m=>m.sender===target&&boundary(m.text))};
}
export function generateLocalDraft(input={}){
 const context=buildReplyContext(input),list=selected(input.messages,input.self,input.target),incoming=list.filter(m=>m.sender===input.target),last=incoming.at(-1),stop=incoming.find(m=>boundary(m.text));
 let draft='',reason='',evidence=[];
 if(stop){draft='收到，我尊重你的意愿，不再打扰。';reason='原文出现明确边界，优先确认并停止主动联系。';evidence=[ev(stop,'boundary',list.indexOf(stop))];}
 else if(last){
  evidence=[ev(last,question(last.text)?'question':sharing(last.text)?'sharing':'context',list.indexOf(last))];
  const hobby=/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行)/.exec(last.text);
  const work=/(报告|项目|论文|考试|加班|工作|作业|方案|设计稿)/.exec(last.text);
  if(question(last.text)){draft=hobby?`你问到${hobby[0]}，我想先认真回答你的问题。`:'看到你的问题了，我想先认真想想再回答你。';reason='对方最后一条包含问题；本地无法知道你的真实答案，发送前请补上自己的回答。';}
  else if(work){draft=`你提到${work[0]}，先忙手头的事，方便时再聊。`;reason='承接对方明确提及的任务，不假设进度或压力。';}
  else if(hobby){draft=`你提到${hobby[0]}，最近有什么想分享的吗？`;reason='承接对方最后一条中的兴趣词，不编造共同经历。';}
  else{draft='看到你说的了，如果你愿意，我想再听你说说。';reason='没有足够明确的主题，使用不施压的承接。';}
 }else{const topic=context.facts.find(f=>/(摄影|爬山|跑步|游泳|电影|音乐|阅读)/.test(f));const word=topic&&/(摄影|爬山|跑步|游泳|电影|音乐|阅读)/.exec(topic)?.[0];draft=word?`想和你聊聊${word}，方便时再聊。`:'最近怎么样？方便的时候再聊。';reason=word?'使用你提供的事实作为话题，未推断对方近况。':'没有对方发言作为依据，使用中性的开场。';}
 if(!stop){
  const topic=/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|报告|项目|论文|考试|工作|作业|方案|设计稿)/.exec(context.intent)?.[0];
  const incomingTopic=/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|报告|项目|论文|考试|工作|作业|方案|设计稿)/.exec(last?.text||'')?.[0];
  const chosen=topic||incomingTopic;
  // User intent supplies a topic from a closed vocabulary, never assertions or instructions.
  if(topic&&!question(last?.text||'')){draft=`我想和你聊聊${topic}，你方便时再说。`;reason+=' 已采用你填写的意图中的话题词；其他自由文本未直接写入回复。';}
  if(context.scenario==='question'){draft=chosen?`关于${chosen}，你最近有什么想分享的吗？`:'最近有什么你想聊的话题吗？';reason+=' 当前场景为轻量提问，不预设对方答案。';}
  if(context.scenario==='invite'){draft=chosen?`如果你愿意，找个方便的时间聊聊${chosen}怎么样？`:'如果你愿意，找个方便的时间聊聊怎么样？';reason+=' 邀请保留对方选择，不假设已约定时间或地点。';}
  if(context.scenario==='boundary'){draft='我想先暂停聊天，之后有需要我会再联系你。';reason='按你选择的场景表达己方边界，不推断对方态度。';}
  if(context.tone==='direct'&&context.scenario!=='boundary')draft=question(last?.text||'')&&context.scenario==='continue'?(chosen?`关于${chosen}的问题，我需要想清楚再回答。`:'这个问题，我需要想清楚再回答。'):chosen?`我想聊聊${chosen}。你愿意吗？`:'我想继续聊聊。你愿意吗？';
  if(context.tone==='concise')draft=context.scenario==='boundary'?'我想先暂停聊天。':question(last?.text||'')&&context.scenario==='continue'?(chosen?`关于${chosen}，我想想再回答。`:'我想想再回答。'):chosen?`${chosen}，方便聊聊吗？`:'方便聊聊吗？';
  reason+=' 本地只支持有限话题、场景和语气规则，不会推断你的真实答案；发送前请核对。';
 }
 return {draft:clip(draft,context.limit),reason,evidence,mode:'local',boundary:Boolean(stop)};
}
