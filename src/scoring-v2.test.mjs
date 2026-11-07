import test from 'node:test';
import assert from 'node:assert/strict';
import {interactionScore,interactionScoreBreakdown,engagementSignals,conflict} from './interaction-signals.js';
import {analyzeInteractionMetrics,correctInteraction} from './interaction-metrics.js';
import {analyzeDailyTimeline} from './analysis.js';

// All conversation fixtures are invented; no imported or real contact data is used.
const message=(sender,text,minute,id=String(minute))=>({
 messageId:id,sender,text,
 timestamp:new Date(Date.parse('2026-11-07T09:00:00+08:00')+minute*60000).toISOString(),
});
const contact=messages=>({self:'我',target:'对方',messages});
const report=messages=>analyzeInteractionMetrics(contact(messages));
const pairs=(reply,count=6)=>Array.from({length:count},(_,index)=>[
 message('我','你几点出门？',index*4),
 message('对方',reply,index*4+1),
]).flat();
const assertDailyMatches=person=>{
 const days=analyzeDailyTimeline(person.messages,person.self,person.target,person.interactionCorrections).days;
 assert.equal(days.length,1);
 const overall=analyzeInteractionMetrics(person);
 assert.equal(days[0].affinityScore,overall.score);
 assert.equal(days[0].engagementScore,overall.engagementScore);
 return overall;
};
const base={messages:24,selfMessages:12,targetMessages:12,selfTurns:6,targetTurns:6,selfStarts:2,targetStarts:2};

test('同轮回答并承接只贡献一次有效回应，且回应实际提高评分',()=>{
 const result=report(pairs('明天八点出门'));
 assert.equal(result.answeredTurns,6);
 assert.equal(result.continuedTurns,6);
 assert.equal(result.responsiveTurns,6);
 const scored=interactionScoreBreakdown({...base,...result});
 assert.equal(scored.items.find(item=>item.key==='response').delta,12);
 assert.ok(scored.score>interactionScore({...base,...result,responsiveTurns:0}));
 assertDailyMatches(contact(pairs('明天八点出门')));
});

test('固定互动证据时快慢回复和消息条数失衡不改变分数',()=>{
 const signals={...base,positiveTurns:2,questionTurns:2,sharingTurns:1,responsiveTurns:4};
 const fast=interactionScore({...signals,medianMinutes:1,slowReplies:0});
 assert.equal(interactionScore({...signals,medianMinutes:900,slowReplies:6}),fast);
 assert.equal(interactionScore({...signals,medianMinutes:null,slowReplies:0}),fast);
 assert.equal(interactionScore({...signals,messages:132,selfMessages:120,targetMessages:12}),fast);
 assert.equal(interactionScore({...signals,messages:132,selfMessages:12,targetMessages:120}),fast);
});

test('解释不会加重一次摩擦，也不会把一次摩擦升级为较强摩擦',()=>{
 const before=interactionScore({...base,conflictReplies:1,strongConflict:false});
 assert.equal(interactionScore({...base,conflictReplies:1,appeasementReplies:3,strongConflict:false}),before);
 const messages=[message('对方','随便你',0),message('我','我想听听你的意思',1),message('对方','没别的意思',2)];
 const result=engagementSignals(messages,'我');
 assert.equal(result.conflictReplies,1);
 assert.equal(result.appeasementReplies,1);
 assert.equal(result.strongConflict,false);
 const repeated=engagementSignals([...messages,message('我','继续说说吧',3),message('对方','你什么意思',4)],'我');
 assert.equal(repeated.strongConflict,true);
});

test('同一合并回合重复正向措辞保留消息证据但不刷分',()=>{
 const original=[message('我','这是整理好的资料',0),message('对方','谢谢你',1)];
 const repeated=[...original,message('对方','谢谢你',2),message('对方','谢谢你',3)];
 const one=report(original),many=report(repeated);
 assert.equal(one.positiveTurns,1);
 assert.equal(many.positiveTurns,1);
 assert.equal(many.indicators.find(item=>item.kind==='positive').count,3);
 assert.equal(many.score,one.score);
 assert.equal(many.engagementScore,one.engagementScore);
});

test('单条正向表达只有有限提升，不能代替持续互动样本',()=>{
 const result=report([message('我','周末愉快',0),message('对方','谢谢你',1)]);
 assert.ok(result.score>32);
 assert.ok(result.score<=38,'一条礼貌表达不应直接制造高分');
 const sustained=report(pairs('谢谢你'));
 assert.ok(sustained.score>result.score);
 assert.ok(sustained.score<70,'重复同类措辞有总量上限');
});

test('明确拒绝不被多次正向表达抵消，排除与恢复后日分及总体一致',()=>{
 const messages=pairs('谢谢你，你今天几点下班？');
 messages.push(message('我','再聊一会儿吗',30),message('对方','不要再联系我',31));
 const person=contact(messages),before=assertDailyMatches(person);
 assert.equal(before.boundaryTurns,1);
 assert.ok(before.score<=32);
 const boundary=before.indicators.find(item=>item.kind==='boundary').evidence[0];
 const action={kind:'boundary',key:boundary.key,excluded:true};
 const excluded=correctInteraction(person,action,1),after=assertDailyMatches(excluded);
 assert.equal(after.boundaryTurns,0);
 assert.ok(after.score>before.score);
 const restored=assertDailyMatches(correctInteraction(excluded,{...action,excluded:false},2));
 assert.equal(restored.boundaryTurns,1);
 assert.equal(restored.score,before.score);
});

test('回答与承接纠正遵守并集，逐条排除和恢复确实更新有效回应分',()=>{
 const person=contact(pairs('明天八点出门'));
 const initial=assertDailyMatches(person);
 const answer=initial.indicators.find(item=>item.kind==='answer').evidence[0];
 const continuation=initial.indicators.find(item=>item.kind==='continuation').evidence[0];
 const answerAction={kind:'answer',key:answer.key,excluded:true};
 const continuationAction={kind:'continuation',key:continuation.key,excluded:true};
 const noAnswer=correctInteraction(person,answerAction,1);
 assert.equal(assertDailyMatches(noAnswer).responsiveTurns,initial.responsiveTurns,'承接仍有效，同轮仍应计一次');
 const neither=correctInteraction(noAnswer,continuationAction,2),excluded=assertDailyMatches(neither);
 assert.equal(excluded.responsiveTurns,initial.responsiveTurns-1);
 assert.ok(excluded.score<initial.score);
 const restored=correctInteraction(neither,{...answerAction,excluded:false},3);
 assert.equal(assertDailyMatches(restored).responsiveTurns,initial.responsiveTurns);
 assert.equal(assertDailyMatches(restored).score,initial.score);
});

test('边界或摩擦文本即使形式上回答问题，也不会获得回应奖励',()=>{
 for(const [question,reply] of [['你不喜欢我吗？','不喜欢你'],['你什么意思？','你什么意思']]){
  const result=report([message('我',question,0),message('对方',reply,1)]);
  assert.equal(result.responsiveTurns,0,reply);
 }
});

test('工作和外界压力不自动记为双方冲突',()=>{
 for(const text of ['明天工作太多了，烦死','电脑又死机了，真无语','今天堵车，烦死了']){
  assert.equal(conflict(text),false,text);
  assert.equal(report([message('对方',text,1)]).conflictReplies,0,text);
 }
 for(const text of ['你怎么总是这样，跟你说话烦死了','我的工作关你什么事','我的手机关你什么事'])assert.equal(conflict(text),true,text);
});

test('忙碌、休息和正常结束话题不触发连续短回复处罚',()=>{
 for(const reply of ['在忙','我在开会','困了','先睡了','准备睡了','晚安','先这样','回头再说','明天聊']){
  const result=report(pairs(reply));
  assert.equal(result.perfunctoryReplies,0,reply);
  assert.equal(result.lowContentReplies,0,reply);
  assert.equal(result.conflictReplies,0,reply);
 }
});

test('没有记录和只有不可评分媒体均不编造分数',()=>{
 assert.equal(interactionScore({}),null);
 assert.equal(report([]).score,null);
 const media=[{...message('对方','[图片]',1),type:'3'}, {...message('我','系统提醒',2),type:'10000'}];
 assert.equal(report(media).score,null);
 assert.deepEqual(analyzeDailyTimeline(media,'我','对方').days,[]);
});

test('日分新增回合计数跨午夜归属一致且保留回答上下文',()=>{
 const messages=[
  {...message('我','你几点出门？',0),timestamp:'2026-11-06 23:59'},
  {...message('对方','明天八点出门',1),timestamp:'2026-11-07 00:01'},
  {...message('我','那我提前等你',2),timestamp:'2026-11-07 00:02'},
  {...message('对方','谢谢你',3),timestamp:'2026-11-07 00:03'},
 ];
 const overall=report(messages),days=analyzeDailyTimeline(messages,'我','对方').days;
 assert.equal(days.length,2);
 assert.equal(days[1].answeredTurns,1);
 assert.equal(days[1].responsiveTurns,1);
 for(const key of ['positiveTurns','questionTurns','sharingTurns','boundaryTurns','responsiveTurns','selfTurns','targetTurns']){
  assert.equal(days.reduce((sum,day)=>sum+day[key],0),overall[key],key);
 }
});

test('分项和与最终分一致，含非整数主动/分享/回应、样本折算和各项封顶',()=>{
 for(const targetTurns of [1,2,5,6,12])for(const positiveTurns of [0,1,5])for(const boundaryTurns of [0,1,4])for(const strongConflict of [false,true]){
  const counts={...base,targetTurns,positiveTurns,boundaryTurns,questionTurns:3,sharingTurns:3,responsiveTurns:Math.min(3,targetTurns),perfunctoryReplies:1,lowContentReplies:1,conflictReplies:strongConflict?3:1,strongConflict};
  const breakdown=interactionScoreBreakdown(counts);
  const sum=breakdown.items.reduce((value,item)=>value+item.delta,0);
  assert.ok(Math.abs(sum-breakdown.score)<1e-9,JSON.stringify(counts));
  assert.ok(Number.isInteger(breakdown.score)&&breakdown.score>=0&&breakdown.score<=100);
  if(boundaryTurns)assert.ok(breakdown.score<=32);
  if(strongConflict)assert.ok(breakdown.score<=48);
 }
});
