// One conservative signal vocabulary for daily and overall views.
export const question=text=>{text=directText(text);return /[?？]|(?:吗|么|如何|为什么|怎么|是否|什么|哪[里个天])/.test(text);};
export function boundary(text){
 // Reported speech and quoted text are not evidence of this sender's wishes.
 text=text.replace(/[“「『"][^”」』"]*[”」』"]/g,'');
 return text.split(/[。！!\n]/).some(part=>{
  // A separate follow-up question must not cancel a preceding direct refusal.
  part=part.replace(/[，,][^，,]*[?？]\s*$/, '');
  if(/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part))return false;
  if(/[?？]|是不是|是否|能不能|可不可以|你.*(?:不想|不要|别再)/.test(part))return false;
  return /(?:请)?(?:不要|别)(?:再)?(?:联系我|给我发|发消息|发信息|打扰我|找我)|我不想(?:再)?(?:见面|见你|聊天|联系|继续)|请别再发|停止联系|不再联系我/.test(part);
 });
}
export const sharing=text=>{text=directText(text);return !question(text)&&/(?:^|[。！？!?，,\n])\s*我(?:最近|今天|昨天|刚刚|刚|正在|现在|周末|平时|已经|打算|计划|很|比较|最|一直|在)*(?:喜欢|爱好|偏好|去了|去过|参加|完成|忙着|在|住在|从事|学|买了|看了|吃了|做了|整理|拍了|写了|工作)/.test(text);};
export const acknowledgment=text=>/^(?:(?:好(?:的|呀|啊)?|嗯+|收到|了解|明白(?:了)?|谢谢|没问题|知道了)[，,。！!\s]*)+$/.test(text.trim());
const positivePattern=/(?:(?<!不)喜欢你|想你|想见你|期待(?:见你|和你)|开心(?:和你|见到你|跟你)|高兴(?:和你|见到你)|你真好|好可爱|好漂亮|好厉害|辛苦你了|谢谢你|关心你|担心你|抱抱|亲亲|❤️|❤|🥰|😍|😘)/i;

function directText(text){const value=String(text).replace(/[“「『"][^”」』"]*[”」』"]/g,'');return (value.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g)||[]).filter(part=>!/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part)).join('');}
export function positive(text){const value=directText(text);if(conflict(value))return false;for(const match of value.matchAll(new RegExp(positivePattern.source,'ig'))){if(!/(?:不|没|并非|不是|不太|不想|不再).{0,3}$/.test(value.slice(0,match.index)))return true;}return false;}
export function negative(text){const value=directText(text);return boundary(value)||/(?:不喜欢你|不想(?:再)?(?:见你|和你聊|联系你)|(?:和你(?:聊天|见面|交流)|你让我|我对你).{0,8}(?:不舒服|很烦|生气))/.test(value);}
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
 const body=String(text??'').replace(/\s+/g,' ').trim();
 return CONFLICT_PATTERN.test(body);
}
/** 事后解释、退让式收尾——通常出现在一次摩擦之后。 */
export function appeasement(text){
 const body=String(text??'').replace(/\s+/g,' ').trim();
 return !conflict(body)&&APPEASE_PATTERN.test(body);
}
const BURST_GAP_MINUTES=3;
function toMillis(timestamp){
 if(typeof timestamp==='number'&&Number.isFinite(timestamp))return timestamp<1e12?timestamp*1000:timestamp;
 if(typeof timestamp!=='string')return null;
 const value=timestamp.trim();if(!value)return null;
 if(/^\d{10,13}$/.test(value)){const n=Number(value);return n<1e12?n*1000:n;}
 const parsed=Date.parse(value.includes('T')?value:value.replace(' ','T'));
 return Number.isFinite(parsed)?parsed:null;
}
/** Who opened each conversation block, how fast the other side answered, and how empty those answers were. */
export function engagementSignals(messages,self){
 const list=Array.isArray(messages)?messages:[];
 // 同一人 3 分钟内连发的短句按「一轮发言」合并：微信里分条发送不等于敷衍。
 const turns=[];
 for(const message of list){
  const at=toMillis(message.timestamp),body=String(message.text??'').trim(),last=turns.at(-1);
  if(last&&last.sender===message.sender&&at!==null&&last.at!==null&&at-last.at<=BURST_GAP_MINUTES*60000){last.texts.push(body);last.at=at;}
  else turns.push({sender:message.sender,at,texts:[body],firstAt:at});
 }
 let selfStarts=0,targetStarts=0,previousAt=null,previousSender=null,previousWasSelf=false,lastSelfAt=null,perfunctoryReplies=0,lowContentReplies=0,targetTurns=0,selfTurns=0,conflictReplies=0,appeasementReplies=0;
 const latencies=[];
 for(const turn of turns){
  const at=turn.firstAt,isTarget=turn.sender!==self;
  if(previousSender===null||at===null||previousAt===null||at-previousAt>=SESSION_GAP_MINUTES*60000){if(turn.sender===self)selfStarts++;else targetStarts++;}
  const selfBefore=previousWasSelf;
  if(isTarget){targetTurns++;if(selfBefore&&at!==null&&lastSelfAt!==null&&at>=lastSelfAt)latencies.push((at-lastSelfAt)/60000);const joined=turn.texts.filter(Boolean).join(' ');if(perfunctory(joined))perfunctoryReplies++;else if(lowContent(joined))lowContentReplies++;if(conflict(joined))conflictReplies++;else if(appeasement(joined))appeasementReplies++;}
  if(turn.sender===self){selfTurns++;lastSelfAt=at;previousWasSelf=true;}else previousWasSelf=false;
  previousAt=at??previousAt;previousSender=turn.sender;
 }
 const sorted=[...latencies].sort((a,b)=>a-b),medianMinutes=sorted.length?Math.round(sorted[Math.floor((sorted.length-1)/2)]):null;
 return {selfStarts,targetStarts,medianMinutes,slowReplies:latencies.filter(minutes=>minutes>=SESSION_GAP_MINUTES).length,perfunctoryReplies,lowContentReplies,targetTurns,conflictReplies,appeasementReplies,selfTurns,replySamples:latencies.length};
}
export function interactionScore(counts={}){
 const num=value=>Number.isFinite(value)?value:0;
 const positive=num(counts.positive),boundary=num(counts.boundary),question=num(counts.question),sharing=num(counts.sharing),perfunctoryCount=num(counts.perfunctoryReplies),lowContentCount=num(counts.lowContentReplies),slowReplies=num(counts.slowReplies),selfStarts=num(counts.selfStarts),targetStarts=num(counts.targetStarts),selfMessages=num(counts.selfMessages),targetMessages=num(counts.targetMessages),medianMinutes=Number.isFinite(counts.medianMinutes)?counts.medianMinutes:null;
 const hasMessages=counts.messages===undefined?(selfMessages+targetMessages)>0:num(counts.messages)>0;
 const corpus=positive+boundary+question+sharing+perfunctoryCount+lowContentCount+slowReplies+selfStarts+targetStarts;
 if(!hasMessages&&!corpus)return null;
 const starts=selfStarts+targetStarts,initiative=starts?Math.round((targetStarts/starts-.5)*20):0;
 const latency=medianMinutes===null?0:medianMinutes<=10?6:medianMinutes<=30?3:medianMinutes<=120?0:medianMinutes<=360?-7:-12;
 const oneSided=hasMessages&&targetMessages===0?18:0;
 const imbalance=selfMessages&&targetMessages?Math.min(selfMessages,targetMessages)/Math.max(selfMessages,targetMessages):1;
 const imbalancePenalty=imbalance<.2?8:imbalance<.35?4:0;
 // 正向措辞按「对方发言轮次」计价：只回 1 轮最多认一句（+12），≥2 轮才最多认两句（+24）。
 const targetTurns=num(counts.targetTurns),selfTurns=num(counts.selfTurns);
 const warm=Math.min(45,Math.min(targetTurns>=2?24:12,12*positive)+8*question+6*sharing);
 // 敷衍/低信息量按「轮」的比例计价，避免一天话多就必然砸到 0 分。
 const emptyRate=targetTurns?Math.min(1,(perfunctoryCount+lowContentCount)/targetTurns):0;
 // 她整天一个回合都没有、我方仍有消息：纯独白，按冷场计价（比 oneSided 的 18 分更重，取两者较大值，避免叠加）。
 const silentDay=hasMessages&&targetTurns===0?24:0;
 const cold=Math.min(60,24*boundary+Math.round(32*emptyRate)+5*slowReplies+Math.max(oneSided,silentDay));
 // 摩擦：反讽/赌气一句即扣 30，事后解释一条 −10；当天出现摩擦时总分封顶 48。
 const conflictCount=num(counts.conflictReplies),appeasementCount=num(counts.appeasementReplies);
 // 单句口头「算了/讲啥」不算摩擦；连续反讽，或反讽后紧跟事后解释，才算真吵起来。
 const strong=conflictCount>=2||(conflictCount>=1&&appeasementCount>=1);
 const tension=strong?Math.min(60,30*Math.min(2,conflictCount)+10*Math.min(3,appeasementCount)):Math.min(12,12*conflictCount);
 // 她只回一轮、我方仍连发多轮：独白倾向，按多出的轮次加罚（最多 −16）。
 const thinDay=selfTurns>=2&&targetTurns===1?Math.min(16,8*Math.min(2,selfTurns-1)):0;
 const computed=Math.max(0,Math.min(100,Math.round(38+warm-cold+initiative+latency-imbalancePenalty-tension-thinDay)));
 // 低频日（对方零回合，或当天来回不足 4 条）按中性 32 计：没聊天不等于关系冷，只有明确负向或摩擦才继续往下扣。
 const totalMessages=hasMessages?(counts.messages===undefined?selfMessages+targetMessages:num(counts.messages)):0;
 const quiet=hasMessages&&(targetTurns===0||totalMessages<4)&&!boundary&&!conflictCount&&!positive&&!perfunctoryCount&&!lowContentCount;
 const score=quiet?32:computed;
 return strong?Math.min(score,48):score;
}
