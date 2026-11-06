import test from 'node:test';
import assert from 'node:assert/strict';
import {interactionScoreBreakdown,engagementSignals,question,conflict,appeasement} from './interaction-signals.js';
import {analyzeDailyTimeline,analyzeConversation} from './analysis.js';
import {analyzeInteractionMetrics,correctInteraction} from './interaction-metrics.js';

const message=(sender,text,time)=>({sender,text,timestamp:'2026-11-06 '+time});

test('封顶、去重、低频覆盖的展示明细之和等于最终分',()=>{
 const base={messages:20,selfMessages:10,targetMessages:10,targetTurns:5,selfTurns:5};
 for(const boundary of [0,1,4])for(const conflictReplies of [0,1,3])for(const slowReplies of [0,1,4]){
  const result=interactionScoreBreakdown({...base,boundary,conflictReplies,appeasementReplies:2,slowReplies,medianMinutes:400,positive:4,question:5,sharing:3});
  assert.equal(result.items.reduce((total,item)=>total+item.delta,0),result.score);
 }
 for(const counts of [{messages:1,selfMessages:1},{messages:2,selfMessages:1,targetMessages:1,targetTurns:1,selfTurns:1}]){
  const result=interactionScoreBreakdown(counts);
  assert.equal(result.items.reduce((total,item)=>total+item.delta,0),result.score);
 }
});

test('日历与依据页的回合、单轮扣分采用同一输入',()=>{
 const messages=['09:00','09:04','09:08'].map(time=>message('我','我在准备资料',time));
 messages.push(message('对方','今天准备把资料全部整理完成','09:09'));
 const day=analyzeDailyTimeline(messages,'我','对方').days[0];
 assert.equal(day.selfTurns,3);
 assert.equal(day.turns,4);
 assert.equal(analyzeConversation(messages,'我','对方').scoringTurns,day.turns);
 const result=interactionScoreBreakdown({messages:day.messages.length,selfMessages:day.selfMessages,targetMessages:day.targetMessages,selfTurns:day.selfTurns,targetTurns:day.targetTurns,selfStarts:day.selfStarts,targetStarts:day.targetStarts,medianMinutes:day.medianReplyMinutes,strongConflict:day.strongConflict});
 assert.equal(result.score,day.affinityScore);
});

test('引用和转述不构成摩擦或解释，保留自己的独立表达',()=>{
 for(const text of ['她说“随便你”','电影台词是“呵呵”','他告诉我‘没别的意思’']){
  assert.equal(conflict(text),false,text);
  assert.equal(appeasement(text),false,text);
 }
 assert.equal(conflict('她说“随便你”。我现在真的无语'),true);
});

test('道谢不遮挡独立问题，反问与纯道谢仍被排除',()=>{
 for(const text of ['谢谢你，你今天几点下班？','谢了。要不要一起吃饭？','你几点下班？谢谢你'])assert.equal(question(text),true,text);
 for(const text of ['谢谢你？','谢了','你以为我不知道吗？'])assert.equal(question(text),false,text);
});

test('较强摩擦要求同段重复或先摩擦后解释',()=>{
 const paired=(first,second,lastTime)=>[message('对方',first,'09:00'),message('我','我明白你说的事情了','09:01'),message('对方',second,lastTime)];
 assert.equal(engagementSignals(paired('随便你','无语','09:02'),'我').strongConflict,true);
 assert.equal(engagementSignals(paired('随便你','没别的意思','09:02'),'我').strongConflict,true);
 assert.equal(engagementSignals(paired('没别的意思','随便你','09:02'),'我').strongConflict,false);
 assert.equal(engagementSignals(paired('随便你','无语','12:00'),'我').strongConflict,false);
 assert.equal(engagementSignals(paired('随便你','没别的意思','12:00'),'我').strongConflict,false);
});

test('慢回复次数与中位时延负向处罚去重',()=>{
 const result=interactionScoreBreakdown({messages:20,selfMessages:10,targetMessages:10,targetTurns:5,selfTurns:5,slowReplies:1,medianMinutes:400});
 assert.equal(result.score,26);
 assert.equal(result.items.find(item=>item.key==='latencyOverlap').delta,5);
 const heavier=interactionScoreBreakdown({messages:20,selfMessages:10,targetMessages:10,targetTurns:5,selfTurns:5,slowReplies:4,medianMinutes:400});
 assert.equal(heavier.score,18);
});

test('明确负向、摩擦和解释不重复计入低信息量',()=>{
 for(const text of ['呵呵','随便你','不喜欢你','没啥啊']){
  const result=engagementSignals([message('对方',text,'09:00')],'我');
  assert.equal(result.perfunctoryReplies,0,text);
  assert.equal(result.lowContentReplies,0,text);
 }
});

test('新增四类回合信号支持纠正恢复且每日总体一致',()=>{
 for(const [kind,text] of [['perfunctory','收到'],['lowContent','就那样'],['conflict','随便你'],['appeasement','没别的意思']]){
  const messages=['perfunctory','lowContent'].includes(kind)?[message('我','补充资料','09:00'),message('对方',text,'09:01'),message('我','补充资料','09:02'),message('对方',text,'09:03'),message('我','补充资料','09:04'),message('对方',text,'09:05')]:[message('我','你好','09:00'),message('对方',text,'09:01')];
  const contact={self:'我',target:'对方',messages};
  const indicator=analyzeInteractionMetrics(contact).indicators.find(item=>item.kind===kind);
  assert.equal(indicator.count,1,kind);
  const action={kind,key:indicator.evidence[0].key,excluded:true};
  const corrected=correctInteraction(contact,action,0);
  const overall=analyzeInteractionMetrics(corrected);
  assert.equal(overall.indicators.find(item=>item.kind===kind).count,0);
  assert.equal(overall.score,analyzeDailyTimeline(corrected.messages,'我','对方',corrected.interactionCorrections).days[0].affinityScore);
  const restored=correctInteraction(corrected,{...action,excluded:false},1);
  assert.equal(analyzeInteractionMetrics(restored).indicators.find(item=>item.kind===kind).count,1);
 }
});

test('跨消息合并回合的纠正绑定首消息，保留其他回合',()=>{
 const contact={self:'我',target:'对方',messages:[message('对方','随便你','09:00'),message('对方','无语','09:01'),message('我','明白了','09:02'),message('对方','你看着办','09:03')]};
 const before=analyzeInteractionMetrics(contact);
 const rows=before.indicators.find(item=>item.kind==='conflict').evidence;
 assert.equal(rows.length,2);
 assert.equal(before.strongConflict,true);
 const after=analyzeInteractionMetrics(correctInteraction(contact,{kind:'conflict',key:rows[0].key,excluded:true},0));
 assert.equal(after.conflictReplies,1);
 assert.equal(after.strongConflict,false);
 assert.equal(after.indicators.find(item=>item.kind==='conflict').evidence[0].quote,'随便你 无语');
});
