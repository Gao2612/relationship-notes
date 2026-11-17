import test from 'node:test';
import assert from 'node:assert/strict';
import {engagementSignals,conflict} from './interaction-signals.js';
import {analyzePeriods,buildDailySignals,mergePeriodSignals,scorePeriod,DIMENSIONS,BOUNDARY_CAP} from './affinity/index.js';
import {basisRows} from './views/scoring-basis.js';
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
 return overall;
};

test('同轮回答并承接只贡献一次有效回应，且回应实际提高关系指数',()=>{
 const result=report(pairs('明天八点出门'));
 assert.equal(result.answeredTurns,6);
 assert.equal(result.continuedTurns,6);
 assert.equal(result.responsiveTurns,6);
 assert.equal(result.v3.dims.responsiveness.rule,1,'六次连接邀请全部被接住');
 const person=contact(pairs('明天八点出门')),overall=assertDailyMatches(person);
 const corrections=overall.indicators.filter(item=>item.kind==='answer'||item.kind==='continuation').flatMap(item=>item.evidence.map(row=>({key:row.key,kind:item.kind,excluded:true})));
 const none=analyzeInteractionMetrics({...person,interactionCorrections:corrections});
 assert.equal(none.responsiveTurns,0);
 assert.ok(overall.score>none.score,'回应被排除后指数下降');
});

test('固定互动证据时快慢回复和消息条数失衡不改变关系指数',()=>{
 const build=delay=>Array.from({length:6},(_,index)=>[message('我','你几点出门？',index*400,'s'+index),message('对方','明天八点出门',index*400+delay,'t'+index)]).flat();
 const fast=report(build(1)).score;
 assert.equal(report(build(110)).score,fast,'回复时延不进入任何维度');
 // 同一回合内重复发送相同文字：回合数与虚词比例不变，指数不变。
 const burst=build(1).flatMap(item=>item.sender==='我'?[item,{...item,messageId:item.messageId+'b'},{...item,messageId:item.messageId+'c'}]:[item]);
 assert.equal(report(burst).score,fast,'消息条数失衡不改变指数');
});

test('解释不会加重一次摩擦，只会减轻摩擦，也不会把一次摩擦升级为较强摩擦',()=>{
 const messages=[message('对方','你什么意思',0),message('我','我想听听你的意思',1),message('对方','没别的意思',2)];
 const result=engagementSignals(messages,'我');
 assert.equal(result.conflictReplies,1);
 assert.equal(result.appeasementReplies,1);
 assert.equal(result.strongConflict,false);
 const repeated=engagementSignals([...messages,message('我','继续说说吧',3),message('对方','你什么意思',4)],'我');
 assert.equal(repeated.strongConflict,true);
 const withoutRepair=report([message('我','你周末去哪了？',0),message('对方','你什么意思',1),message('我','随便问问',2),message('对方','哦',3)]);
 const withRepair=report([message('我','你周末去哪了？',0),message('对方','你什么意思',1),message('我','随便问问',2),message('对方','对不起，刚才语气不好',3)]);
 assert.ok(withRepair.v3.friction.estimate<=withoutRepair.v3.friction.estimate,'修复只会减轻摩擦');
 assert.ok(withRepair.score>=withoutRepair.score,'解释不得让指数下降');
});

test('同一合并回合重复正向措辞保留消息证据但不刷分',()=>{
 const original=[message('我','这是整理好的资料',0),message('对方','谢谢你',1)];
 const repeated=[...original,message('对方','谢谢你',2),message('对方','谢谢你',3)];
 const one=report(original),many=report(repeated);
 assert.equal(one.positiveTurns,1);
 assert.equal(many.positiveTurns,1);
 assert.equal(many.indicators.find(item=>item.kind==='positive').count,3);
 assert.equal(many.score,one.score);
});

test('单条正向表达只有有限提升，不能代替持续互动样本',()=>{
 const result=report([message('我','周末愉快',0),message('对方','谢谢你',1)]);
 assert.ok(result.score>=40&&result.score<=58,'一条礼貌表达只能让指数在中性附近变化：'+result.score);
 const thanks=result.indicators.find(item=>item.kind==='positive').evidence[0];
 assert.ok(result.score>analyzeInteractionMetrics({...contact([message('我','周末愉快',0),message('对方','谢谢你',1)]),interactionCorrections:[{key:thanks.key,kind:'positive',excluded:true}]}).score,'正向表达有提升，但只是有限提升');
 assert.equal(result.reliability,'low');
 const sustained=report(pairs('谢谢你'));
 assert.ok(sustained.score<75,'重复同类措辞不会无限抬高指数');
});

test('明确拒绝不被多次正向表达抵消，排除与恢复后日分及总体一致',()=>{
 const messages=pairs('谢谢你，你今天几点下班？');
 messages.push(message('我','再聊一会儿吗',30),message('对方','不要再联系我',31));
 const person=contact(messages),before=assertDailyMatches(person);
 assert.equal(before.boundaryTurns,1);
 assert.ok(before.score<=BOUNDARY_CAP);
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

test('没有记录、只有不可评分媒体或对方没有回合时均不编造分数',()=>{
 assert.equal(report([]).score,null);
 assert.equal(report([message('我','在吗',0),message('我','看到回我',1)]).score,null,'对方没有回合时不评分');
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
 // v3：各日信号相加后的评分与全部记录直接评分一致（连接邀请归入发起回合所在日）。
 assert.equal(scorePeriod(mergePeriodSignals(days.map(day=>day.v3Signals))).index,overall.score);
});

test('打分依据的分项贡献之和 × 摩擦系数与当天指数一致，边界封顶 30',()=>{
 const replies=['明天八点出门','谢谢你','你什么意思','哦','我最近有点难过','不要再联系我','好啊，周末见'];
 let checked=0;
 for(let seed=0;seed<replies.length;seed++){
  const messages=[];for(let i=0;i<12;i++){messages.push(message('我',i%2?'你几点出门？':'我今天去跑步了',seed*100+i*3,'s'+seed+'-'+i),message('对方',replies[(seed+i)%replies.length],seed*100+i*3+1,'t'+seed+'-'+i));}
  for(const day of analyzePeriods(contact(messages),'day')){
   if(!day.scored)continue;const basis=basisRows(day,DIMENSIONS);
   const expected=day.boundary.rule?Math.min(basis.raw,BOUNDARY_CAP):basis.raw;
   assert.equal(Math.round(expected),day.index);
   assert.ok(day.index>=0&&day.index<=100&&day.low<=day.index&&day.index<=day.high);
   if(day.boundary.rule)assert.ok(day.index<=BOUNDARY_CAP);
   checked++;
  }
 }
 assert.ok(checked>0);
});
