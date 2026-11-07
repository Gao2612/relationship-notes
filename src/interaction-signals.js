import {boundary,negative} from './interaction-boundary.js';
export {boundary,negative} from './interaction-boundary.js';
import {shanghaiTimestamp,shanghaiDateKey} from './shared/dates.js';
import {scoringMessage,sceneGroups,replyContext,directedRequest} from './interaction-context.js';
// One conservative signal vocabulary for daily and overall views.
// 「?」不等于提问：反问、道谢、赌气都带问号，先排除这些句式再判。
const RHETORICAL=/(?:谢谢你|谢了|就这|讲啥道理|讲道理|难道|难不成|你以为|谁不知道|还用说|凭什么|有什么好|何必|岂不是|可不是|至于吗|行了吧|算了|呵呵|随便你)/;
// 只有「等一个答复」才算提问：句末问号、句末「吗」，或明确的征询说法。
// 「啥／咋／几天」这类词在陈述句里到处都是（咋过这么快、我啥时候出去玩了、干几天走了），不能当提问。
const ASK_STRONG=/(?:干嘛|干啥|干什么|做什么|去哪儿|去哪里|在哪儿|在哪里|几点|多少钱|多少个?人|为什么|为啥|要不要|能不能|可不可以|会不会|是不是|对不对|好不好|有没有|行不行|在不在|有空吗|可以吗|咋了|怎么了|咋回事|怎么办|怎么样)/;
function stripTail(text){
 let value=String(text);
 for(let i=0;i<3;i+=1){
  const next=value.replace(/[\s。！!…~～，,]+$/,'').replace(/(?:\[[^\[\]]{1,12}\]|【[^【】]{1,12}】)$/,'');
  if(next===value)break;
  value=next;
 }
 return value;
}
export const question=text=>{
 text=directText(text);
 if(!text)return false;
 const clauses=(text.match(/[^，,。！!；;\n?？]+[?？]?/g)||[]).map(part=>part.replace(/^(?:谢谢你|谢了)[呀啊啦哦~～\s]*/,''));
 return clauses.some(clause=>{
 if(!clause.replace(/[?？\s]/g,'')||RHETORICAL.test(clause)||boundary(clause))return false;
 const body=stripTail(clause);
 if(/^(?:没有)+[。！!\s]*$/.test(body)||/(?:问问|问一下|替我问|帮我问)/.test(body))return false;
 if(/[?？]/.test(clause))return true;
 if(/(?:吗|嘛)$/.test(body))return true;
 if(/(?:不|没)(?:怎么样|如何)$/.test(body))return false;
 return ASK_STRONG.test(body);
 });
};
export function emotionalSharing(text){
 return directText(text).split(/[。！？!?，,\n]/).some(part=>{
  if(question(part)||directedRequest(part)||/如果|假如|要是|假设/.test(part))return false;
  return /^\s*我(?:(?:最近|今天|昨天|现在|其实|真的|一直|有点|有些|很|特别|非常|感到|觉得|挺|也|还|不太|并不|不怎么|没有那么))*?(?:开心|难过|紧张|害怕|担心|失落|委屈|幸福|安心|焦虑|孤独|伤心|兴奋|沮丧|压力很大)/.test(part);
 });
}
export function sharing(text){
 const direct=directText(text);
 return emotionalSharing(direct)||direct.split(/[。！？!?，,\n]/).some(text=>{
  text=text.trim();
  if(question(text)||directedRequest(text)||/如果|假如|要是|假设/.test(text))return false;
  return (/(?:^|[。！？!?，,\n])\s*我(?:俩|们|已经|最近|今天|昨天|老|就|还|也|只|突然|都|自己|好久|一直|现在|以前|以前在|在学校的时候)*(?:吃|喝|买|看|去|想|记得|忘了|累|饿|减肥|忍住|休息|没有吃)/.test(text)||/(?:^|[。！？!?，,\n])\s*我(?:最近|今天|昨天|刚刚|刚|正在|现在|周末|平时|已经|打算|计划|很|比较|最|一直|在)*(?:喜欢|爱好|偏好|去了|去过|参加|完成|忙着|在|住在|从事|学|买了|看了|吃了|做了|整理|拍了|写了|工作)/.test(text));
 });
}

export const acknowledgment=text=>/^(?:(?:好(?:的|呀|啊)?|嗯+|收到|了解|明白(?:了)?|谢谢|没问题|知道了)[，,。！!\s]*)+$/.test(text.trim());
function directText(text){const value=String(text).replace(/[“「『‘"][^”」』’"]*[”」』’"]/g,'');return (value.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g)||[]).filter(part=>!/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part)).join('');}
const positivePatterns=[
 {kind:'affection',label:'明确亲近表达',weight:6,pattern:/(?:喜欢你(?!的|们)|爱你(?!的|们)|想你(?=了|啦|呀|啊|呢|哦|[。！!，,\s]|$)|想见你|期待(?:见你|和你见面)|开心(?:和你|见到你|跟你)|高兴(?:和你|见到你)|(?:愿意|想|会)(?:一直)?陪(?:着)?你)/g},
 {kind:'support',label:'关心、支持或具体感谢',weight:4,pattern:/(?:关心你|担心你|心疼你|我(?:能)?理解你(?:的感受|的心情|的难处)|我(?:愿意|可以)听你说|我(?:会|愿意)支持你|(?:为你|替你)(?:开心|高兴)|恭喜你|祝贺你|(?:谢谢|感谢)你(?:一直|这么|那么|愿意|耐心|特意|陪|帮|听|关心|支持)|你(?:真的|真|太|好|很)(?:好|可爱|漂亮|厉害|体贴|温柔))/g},
 {kind:'courtesy',label:'礼貌或一般积极表达',weight:1,pattern:/(?:谢谢(?:你)?|谢了|辛苦(?:你)?了|抱抱|亲亲|❤️|❤|🥰|😍|😘)/g}
];
export function positiveSignal(text){
 let best={kind:'none',label:'未识别正向表达',weight:0};
 for(const part of directText(text).split(/[。！？!?，,\n]/)){
  if(directedRequest(part)||conflict(part)||/如果|假如|要是|假设/.test(part)||/^\s*(?:他|她|他们|她们|同事|朋友|小猫|小狗)/.test(part))continue;
  for(const signal of positivePatterns){
   for(const match of part.matchAll(new RegExp(signal.pattern.source,'g'))){
    const prefix=part.slice(0,match.index);
    if(/(?:不|没|未|别|并非|不是|不用|无需|不必).{0,4}$/.test(prefix))continue;
    // The sender must express the sentiment, rather than ask whether the addressee does.
    if(/(?:是不是|是否|难道|会不会|你说|你觉得)/.test(prefix))continue;
    if(signal.weight>best.weight)best={kind:signal.kind,label:signal.label,weight:signal.weight};
   }
  }
 }
 return best;
}
export const positive=text=>positiveSignal(text).weight>0;


export const interactionDetectors={question,sharing,positive,boundary:negative};
// 收尾式/敷衍措辞：明确只想结束对话，或只有应和、没有信息量。
const brushOffPattern=/^(?:在忙|忙|有点忙|很忙|加班|没空|没时间|回头(?:再)?说|晚点(?:再)?说|再说吧|改天(?:再)?聊|先这样|不聊了|困了|睡了)[。！!，,~～…\s]*$/;
const fillerOnlyPattern=/^(?:嗯+|哦+|噢+|喔+|啊+|嗯嗯|哈+|呵+|嘿嘿|好吧|行吧|行|可以|好的|好|收到|了解|明白了|知道了|没事|随你|都行|不知道)[。！!，,~～…\s]*$/;
const emojiOnlyPattern=/^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]+$/u;
const PLACEHOLDER_PATTERN=/^(?:【[^】]{1,8}】|\[[^\]]{1,8}\]|.*\.(?:jpg|jpeg|png|gif|webp|mp4|amr|silk|mp3))$/i;
export function isPlaceholder(text){return PLACEHOLDER_PATTERN.test(String(text??'').replace(/<[^>]*>/g,'').trim());}
export function perfunctory(text){
 const body=String(text??'').replace(/\s+/g,' ').trim();
 if(isPlaceholder(body))return false;
 if(!body)return true;
 if(question(body)||positive(body))return false;
 if(brushOffPattern.test(body)||fillerOnlyPattern.test(body))return true;
 return emojiOnlyPattern.test(body);
}
export function lowContent(text){
 const body=String(text??'').trim();
 if(isPlaceholder(body))return false;
 if(!body||question(body)||positive(body)||sharing(body))return false;
 return body.replace(/[。！!，,、~～…？?\s]/g,'').length<=5;
}
const SESSION_GAP_MINUTES=120;
const CONFLICT_PATTERN=/(?:那我还得|我还得谢谢|行了吧|随便你|都行看你|你看着办|关你什么事|跟你有关系|你什么意思|别说了|算了(?:不说了|别说了)|无语|烦死|想太多|自作多情|说得好像|呵呵|怎么着|你赢了|不想说|懒得说|别问我)/;
const APPEASE_PATTERN=/(?:我只是(?:说|讲|着急|觉得|随口)|没啥啊|没别的意思|你别多想|不是那个意思|我说的是(?:工作|事情)|你决定(?:好)?就行|随口一说)/;
/** 反讽、赌气、明确不快的措辞。 */
export function conflict(text){
 const body=directText(text).replace(/\s+/g,' ').trim();
 const external=/工作|加班|客户|老板|同事|堵车|天气|考试|作业|系统|电脑|手机|自己/;
 const directed=/你让我|你怎么|你总是|你又|跟你|对你|烦死你|随便你|关你什么事|你什么意思|你看着办|你赢了|别问我/;
 if(external.test(body)&&!directed.test(body))return false;
 return body.split(/[。！？!?，,\n]/).some(part=>{
  // 外界压力和对自己失误的抱怨不自动成为双方关系摩擦。
  if(external.test(part)&&!directed.test(part))return false;
  return CONFLICT_PATTERN.test(part);
 });
}
/** 事后解释、退让式收尾——通常出现在一次摩擦之后。 */
export function appeasement(text){
 const body=directText(text).replace(/\s+/g,' ').trim();
 return !conflict(body)&&APPEASE_PATTERN.test(body);
}
const BURST_GAP_MINUTES=3;
const toMillis=shanghaiTimestamp;
/** Who opened each conversation block, how fast the other side answered, and how empty those answers were. */
export function engagementSignals(messages,self,isExcluded){
 const list=Array.isArray(messages)?messages.filter(scoringMessage):[];
 const assignments=new WeakMap();
 for(const [scene,rows] of Object.entries(sceneGroups(list)))for(const row of rows)assignments.set(row,scene);
 const turns=[];
 for(const message of list){
  const at=toMillis(message.timestamp),last=turns.at(-1);
  if(last&&last.sender===message.sender&&at!==null&&last.at!==null&&at>=last.at&&at-last.at<=BURST_GAP_MINUTES*60000&&shanghaiDateKey(message.timestamp)===shanghaiDateKey(last.messages[0].timestamp)){
   last.messages.push(message);last.at=at;
  }else turns.push({sender:message.sender,at,firstAt:at,messages:[message]});
 }
 let selfStarts=0,targetStarts=0,previousAt=null,previousSender=null,previousWasSelf=false,lastSelfAt=null;
 let perfunctoryReplies=0,lowContentReplies=0,targetTurns=0,selfTurns=0,conflictReplies=0,appeasementReplies=0;
 let sessionConflicts=0,strongConflict=false,previousText='',emptyStreak=0;
 const scenes={work:0,daily:0,mixed:0,unknown:0};
 const startsByScene={work:0,daily:0,mixed:0,unknown:0};
 let answeredTurns=0,continuedTurns=0,responsiveTurns=0;
 let positiveTurns=0,questionTurns=0,sharingTurns=0,boundaryTurns=0,positivePoints=0,emotionalSharingTurns=0;
 const latencies=[],turnEvidence=[],events=[];
 for(const turn of turns){
  const before={selfStarts,targetStarts,perfunctoryReplies,lowContentReplies,targetTurns,selfTurns,conflictReplies,appeasementReplies,answeredTurns,continuedTurns,responsiveTurns,positiveTurns,questionTurns,sharingTurns,boundaryTurns,positivePoints,emotionalSharingTurns};
  const latencyStart=latencies.length;
  let turnStrong=false;
  const excluded=kind=>{
   const detectors={conflict,appeasement,perfunctory,lowContent};
   let relevant=turn.messages;
   if(detectors[kind])relevant=turn.messages.filter(message=>detectors[kind](message.text));
   if(kind==='answer'||kind==='continuation')relevant=turn.messages.filter(message=>{
    const context=replyContext(previousText,message.text,question(previousText));
    return kind==='answer'?context.answer||context.affirmative:context.continuation;
   });
   if(!relevant.length)relevant=turn.messages;
   return relevant.every(message=>isExcluded?.(message,kind));
  };
  const at=turn.firstAt,isTarget=turn.sender!==self;
  const newSession=previousSender===null||at===null||previousAt===null||at-previousAt>=SESSION_GAP_MINUTES*60000;
  if(newSession){
   if(isTarget)targetStarts++;else selfStarts++;
   sessionConflicts=0;emptyStreak=0;
  }
  if(isTarget){
   targetTurns++;
   if(previousWasSelf&&at!==null&&lastSelfAt!==null&&at>=lastSelfAt)latencies.push((at-lastSelfAt)/60000);
   const joined=turn.messages.map(message=>String(message.text??'').trim()).filter(Boolean).join(' ');
   const message=turn.messages[0];
   const scene=assignments.get(message)||'unknown';
   scenes[scene]++;
   if(newSession)startsByScene[scene]++;
   const rawContext=replyContext(previousWasSelf?previousText:'',joined,previousWasSelf&&question(previousText));
   const excludeAnswer=excluded('answer'),excludeContinuation=excluded('continuation');
   const context={answer:rawContext.answer&&!excludeAnswer,affirmative:rawContext.affirmative&&!excludeAnswer,continuation:rawContext.continuation&&!excludeContinuation};
   if(context.answer||context.affirmative)answeredTurns++;
   if(context.continuation)continuedTurns++;
   const detectedConflict=conflict(joined),detectedAppeasement=appeasement(joined);
   const hasSpecificNegative=detectedConflict||detectedAppeasement||negative(joined);
   const laughter=/^(?:哈+|嘿嘿)[。！!\s]*$/.test(joined);
   const ordinaryPause=/^(?:我(?:现在)?(?:在|有点)?|今天)?(?:在忙|忙|有点忙|很忙|加班|开会|没空|没时间|困了|睡了|先睡了|准备睡了|要睡了|休息了|晚安|回头再说|晚点再说|先这样|改天再聊|明天聊|晚点聊|回头聊|先忙了|稍后聊|晚点再聊|回头再聊|不聊了|再说吧)[。！!，,~～…\s]*$/.test(joined);
   const generic=!ordinaryPause&&(perfunctory(joined)||lowContent(joined));
   emptyStreak=generic&&!context.answer&&!context.affirmative&&!context.continuation&&!laughter?emptyStreak+1:0;
   const detectedPerfunctory=!ordinaryPause&&!hasSpecificNegative&&!laughter&&!context.answer&&!context.affirmative&&emptyStreak>=3&&perfunctory(joined);
   const detectedLowContent=!hasSpecificNegative&&!detectedPerfunctory&&emptyStreak>=3&&!context.answer&&!context.continuation&&lowContent(joined);
   const detected={answer:rawContext.answer||rawContext.affirmative,continuation:rawContext.continuation,conflict:detectedConflict,appeasement:detectedAppeasement,perfunctory:detectedPerfunctory,lowContent:detectedLowContent};
   const kinds=Object.keys(detected).filter(kind=>detected[kind]);
   const applied=kinds.filter(kind=>!excluded(kind));
   const hasSignal=(kind,detect)=>turn.messages.some(message=>detect(message.text)&&!isExcluded?.(message,kind));
   const hasBoundary=hasSignal('boundary',negative);
   if(hasBoundary)boundaryTurns++;
   const positiveWeight=Math.max(0,...turn.messages.map(message=>isExcluded?.(message,'positive')?0:positiveSignal(message.text).weight));
   if(positiveWeight){positiveTurns++;positivePoints+=positiveWeight;}
   if(hasSignal('question',question))questionTurns++;
   if(hasSignal('sharing',sharing))sharingTurns++;
   if(hasSignal('sharing',emotionalSharing))emotionalSharingTurns++;
   // 同一回合回答并承接只计一次；拒绝和摩擦不再赚取回应奖励。
   if(!hasBoundary&&!applied.includes('conflict')&&(applied.includes('answer')||applied.includes('continuation')))responsiveTurns++;
   turnEvidence.push({message,messages:turn.messages,quote:joined,kinds,applied,scene,context});
   if(applied.includes('perfunctory'))perfunctoryReplies++;
   if(applied.includes('lowContent'))lowContentReplies++;
   if(applied.includes('conflict')){conflictReplies++;sessionConflicts++;}
   if(applied.includes('appeasement'))appeasementReplies++;
   if(sessionConflicts>=2){strongConflict=true;turnStrong=true;}
  }
  if(isTarget)previousWasSelf=false;
  else{selfTurns++;lastSelfAt=turn.at;previousWasSelf=true;}
  const after={selfStarts,targetStarts,perfunctoryReplies,lowContentReplies,targetTurns,selfTurns,conflictReplies,appeasementReplies,answeredTurns,continuedTurns,responsiveTurns,positiveTurns,questionTurns,sharingTurns,boundaryTurns,positivePoints,emotionalSharingTurns};
  events.push({date:shanghaiDateKey(turn.messages[0].timestamp),counts:Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]])),latencies:latencies.slice(latencyStart),strongConflict:turnStrong,scene:assignments.get(turn.messages[0])||'unknown'});
  previousAt=turn.at??previousAt;
  previousSender=turn.sender;
  previousText=turn.messages.map(message=>String(message.text??'')).join(' ');
 }
 const sorted=[...latencies].sort((a,b)=>a-b);
 const medianMinutes=sorted.length?Math.round(sorted[Math.floor((sorted.length-1)/2)]):null;
 return {selfStarts,targetStarts,medianMinutes,slowReplies:latencies.filter(minutes=>minutes>=SESSION_GAP_MINUTES).length,perfunctoryReplies,lowContentReplies,targetTurns,conflictReplies,appeasementReplies,selfTurns,replySamples:latencies.length,strongConflict,turnEvidence,scenes,startsByScene,answeredTurns,continuedTurns,responsiveTurns,positiveTurns,questionTurns,sharingTurns,boundaryTurns,positivePoints,emotionalSharingTurns,events};
}
/** 与 interactionScore 同一套算式，但逐项返回，供「打分依据」页展示。 */
export function interactionScoreBreakdown(counts={}){
 // Product heuristics, not empirically calibrated attraction probabilities.
 const num=value=>Number.isFinite(value)?Math.max(0,value):0;
 const targetTurns=num(counts.targetTurns),selfTurns=num(counts.selfTurns);
 const selfMessages=num(counts.selfMessages),targetMessages=num(counts.targetMessages);
 const totalMessages=counts.messages===undefined?selfMessages+targetMessages:num(counts.messages);
 const turnCount=kind=>Math.min(targetTurns,Number.isFinite(counts[kind+'Turns'])?num(counts[kind+'Turns']):num(counts[kind]));
 const positive=turnCount('positive'),question=turnCount('question'),sharing=turnCount('sharing'),boundary=turnCount('boundary');
 const perfunctoryCount=num(counts.perfunctoryReplies),lowContentCount=num(counts.lowContentReplies);
 const responsiveTurns=Math.min(targetTurns,num(counts.responsiveTurns));
 const conflictCount=num(counts.conflictReplies),appeasementCount=num(counts.appeasementReplies);
 const selfStarts=num(counts.selfStarts),targetStarts=num(counts.targetStarts);
 if(!totalMessages&&!targetTurns&&!selfTurns)return null;
 const positivePoints=Number.isFinite(counts.positivePoints)?Math.min(6*positive,num(counts.positivePoints)):6*positive;
 const emotionalSharingTurns=Math.min(sharing,num(counts.emotionalSharingTurns));
 const positiveBonus=Math.min(18,positivePoints),questionBonus=Math.min(8,2*question),sharingBonus=Math.min(10,2.5*sharing+1.5*emotionalSharingTurns);
 const responseBonus=Math.min(12,12*responsiveTurns/Math.max(4,targetTurns));
 const rawWarm=positiveBonus+questionBonus+sharingBonus+responseBonus,warm=Math.min(45,rawWarm);
 const initiative=selfTurns>0&&targetTurns>0?4*targetStarts/(selfStarts+targetStarts+4):0;
 const emptyRate=targetTurns?Math.min(1,(perfunctoryCount+lowContentCount)/targetTurns):0;
 const emptyPenalty=Math.round(16*emptyRate),rawCold=24*boundary+emptyPenalty,cold=Math.min(60,rawCold);
 const strong=typeof counts.strongConflict==='boolean'?counts.strongConflict:conflictCount>=2;
 const rawTension=(strong?12:8)*conflictCount,tension=Math.min(strong?24:8,rawTension);
 const rawTotal=38+warm+initiative-cold-tension;
 const computed=Math.max(0,Math.min(100,Math.round(rawTotal)));
 const quiet=totalMessages>0&&(targetTurns===0||selfTurns+targetTurns<4)&&!positive&&!question&&!sharing&&!responsiveTurns&&!boundary&&!conflictCount&&!perfunctoryCount&&!lowContentCount;
 const picked=quiet?32:computed,evidenceWeight=Math.min(1,targetTurns/6);
 const adjusted=picked>32?Math.round(32+(picked-32)*evidenceWeight):picked;
 const conflictCapped=strong?Math.min(adjusted,48):adjusted;
 const score=boundary>0?Math.min(conflictCapped,32):conflictCapped;
 const medianMinutes=Number.isFinite(counts.medianMinutes)?counts.medianMinutes:null;
 const items=[];
 const add=(key,label,condition,delta,detail,kind)=>items.push({key,label,condition,delta,hit:delta!==0,detail,...(kind?{kind}:{})});
 add('base','基础分','沿用 38 起算；小样本向 32 折算',38,'38');
 add('positive','正向措辞','每回合取最强一项：礼貌 +1、关心支持或具体感谢 +4、明确亲近 +6；合计最多 +18',positiveBonus,'对方正向措辞 '+positive+' 回合，原始加分 '+positivePoints,'positive');
 add('question','对方提问','每个命中回合 +2，最多 +8',questionBonus,'对方提问 '+question+' 回合','question');
 add('sharing','对方自我分享','普通分享每回合 +2.5；其中第一人称感受分享再 +1.5；合计最多 +10',sharingBonus,'对方分享 '+sharing+' 回合，其中感受分享 '+emotionalSharingTurns+' 回合','sharing');
 add('response','有效回应','回答或承接取并集，12 × 有效回应回合 ÷ max(4,对方回合)，最多 +12',responseBonus,'有效回应 '+responsiveTurns+' / '+targetTurns+' 回合');
 add('warmCap','正向合计上限 +45','四项加分总计最多 45',warm-rawWarm,'原正向合计 '+Number(rawWarm.toFixed(2)));
 add('initiative','主动开口','双方均有发言时，4 × 对方开口次数 ÷ (双方开口次数 + 4)',initiative,'对方主动 '+targetStarts+' 次 / 我方 '+selfStarts+' 次');
 add('boundary','负向或拒绝措辞','每个命中回合 −24，最终分不超过 32',-24*boundary,'负向或边界 '+boundary+' 回合','negative');
 add('empty','连续缺少有效回应','已识别敷衍或低信息量回合占比 × −16，同轮不重复',-emptyPenalty,'敷衍 '+perfunctoryCount+' 轮，低信息量 '+lowContentCount+' 轮');
 add('coldCap','负向组上限 −60','边界与短回复组最多扣 60',rawCold-cold,'原扣分 '+rawCold);
 add('tension','摩擦','普通摩擦最多 −8；同段重复摩擦每轮 −12，最多 −24；解释不扣分',-tension,'摩擦 '+conflictCount+' 轮，解释 '+appeasementCount+' 轮');
 add('latency','回复间隔（仅展示）','时延不直接加减分',0,medianMinutes===null?'无可用样本':'中位间隔 '+medianMinutes+' 分钟');
 add('clamp','取整与范围限制','四舍五入，限制 0–100',computed-rawTotal,'未取整合计 '+Number(rawTotal.toFixed(2)));
 add('quiet','低频日','少量记录且无可评分信号时记 32',picked-computed,quiet?'低频日按 32 记':'未触发低频覆盖');
 add('sampleAdjustment','小样本折算','超过 32 的部分乘以 min(1,对方回合数 ÷ 6)',adjusted-picked,'对方 '+targetTurns+' 回合；折算系数 '+evidenceWeight.toFixed(2));
 add('strongCap','重复摩擦封顶 48','同段至少两个摩擦回合时，最终不超过 48',conflictCapped-adjusted,strong?'触发同段重复摩擦':'未触发');
 add('boundaryCap','明确边界封顶 32','存在未被排除的负向或拒绝证据时，不被正向信号抵消',score-conflictCapped,boundary?'触发边界上限':'未触发');
 return {score,computed,picked,quiet,strong,items,evidenceWeight,formulaVersion:'2.1',counts:{positive,positivePoints,emotionalSharingTurns,boundary,question,sharing,perfunctoryCount,lowContentCount,responsiveTurns,selfStarts,targetStarts,selfMessages,targetMessages,medianMinutes,targetTurns,selfTurns,conflictCount,appeasementCount,totalMessages}};
}
export function interactionScore(counts={}){
 const result=interactionScoreBreakdown(counts);
 return result===null?null:result.score;
}


export function engagementDays(result){
 const days=new Map();
 for(const event of result.events){
  if(!event.date)continue;
  if(!days.has(event.date))days.set(event.date,{latencies:[],strongConflict:false,scenes:{work:0,daily:0,mixed:0,unknown:0}});
  const day=days.get(event.date);
  for(const [key,value] of Object.entries(event.counts))day[key]=(day[key]||0)+value;
  day.latencies.push(...event.latencies);
  day.strongConflict ||= event.strongConflict;
  day.scenes[event.scene]+=event.counts.targetTurns;
 }
 for(const day of days.values()){
  const sorted=day.latencies.slice().sort((a,b)=>a-b);
  day.medianMinutes=sorted.length?Math.round(sorted[Math.floor((sorted.length-1)/2)]):null;
  day.slowReplies=sorted.filter(minutes=>minutes>=SESSION_GAP_MINUTES).length;
  day.replySamples=sorted.length;
 }
 return days;
}
