import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDailyTimeline} from './analysis.js';
import {analyzePeriods,buildDailySignals,mergePeriodSignals,scorePeriod,buildPeriodSignals} from './affinity/index.js';

const message=(sender,text,timestamp)=>({sender,text,timestamp});

test('groups messages by exported local date and counts both speakers and turns',()=>{
 const days=analyzeDailyTimeline([
  message('我','你好','2026-10-21 09:00:00'),
  message('我','周末有空吗？','2026-10-21 09:01:00'),
  message('林小雨','我也很开心见到你。','2026-10-21 09:02:00'),
  message('林小雨','请别再联系我。','2026-10-22 18:00:00'),
 ],'我','林小雨').days;
 assert.equal(days.length,2);
 assert.deepEqual([days[0].messages.length,days[0].selfMessages,days[0].targetMessages,days[0].turns],[3,2,1,2]);
 assert.equal(days[0].activityScore,100);
 assert.equal(days[0].positivePoints,6);
 assert.equal(days[0].emotionalSharingTurns,1);
 // 关系分析 v3（规则层）：正向亲近表达使当天高于中性 50；明确边界当天封顶 30。
 assert.equal(days[0].affinityScore,53);
 assert(days[0].affinityLow<=53&&days[0].affinityHigh>=53);
 assert.equal(days[1].affinityScore,30);
 assert.equal(days[1].affinityBoundary,true);
 assert.equal(days[1].affinityChange,-23);
 assert.match(days[0].reason,/周末计划/);
 assert.match(days[1].affinityNote,/出现明确边界，当天指数封顶 30/);
});

test('does not infer affinity from message volume and skips unparseable dates',()=>{
 const result=analyzeDailyTimeline([
  message('我','哈哈哈哈','bad timestamp'),
  message('我','今天好忙','2026/10/21 09:00'),
  message('林小雨','收到','2026/10/21 09:01'),
 ],'我','林小雨');
 assert.equal(result.days.length,1);
 // 只有一个简短回合：各维度收缩到中性附近，可信度低；不再使用旧版“低频日 32 分”。
 assert.equal(result.days[0].affinityScore,43);
 assert.equal(result.days[0].affinityReliability,'low');
 assert.equal(result.days[0].perfunctoryReplies,0);
 assert.equal('limitations' in result,false);
});

test('converts explicitly zoned timestamps into China calendar dates',()=>{
 const result=analyzeDailyTimeline([message('我','晚安','2026-10-30T05:30:00Z')],'我','林小雨');
 assert.equal(result.days[0].date,'2026-10-30');
 // 对方当天没有回合：不评分（null），而不是给出先验 50 或旧版的中性 32。
 assert.equal(result.days[0].affinityScore,null);
 assert.match(result.days[0].affinityNote,/不评分（不是 0 分）/);
});

test('groups numeric Unix second and millisecond timestamps by China date',()=>{
 const result=analyzeDailyTimeline([
  message('我','秒级',1793338200),
  message('林小雨','毫秒级',1793338200000),
 ],'我','林小雨');
 assert.equal(result.days.length,1);
 assert.equal(result.days[0].date,'2026-10-30');
 assert.equal(result.days[0].messages.length,2);
});

test('separates target-side engagement cues from chat activity volume',()=>{
 const result=analyzeDailyTimeline([
  message('我','消息很多，但这是我发出的。','2026-10-29 09:00:00'),
  message('林小雨','你周末有空吗？','2026-10-29 09:01:00'),
 ],'我','林小雨');
 assert.equal(result.days[0].activityScore,100);
 assert.equal(result.days[0].affinityScore,44);
 assert.equal(result.days[0].targetQuestions,1);
 assert.match(result.days[0].affinityNote,/^关系指数 44（80% 区间/);
});

const longChat=()=>{const rows=[];const texts=[['我','你周末有空吗？'],['林小雨','有空呀，你想去哪？'],['我','我终于通过考试了！'],['林小雨','恭喜你！太厉害了，是哪门考试呀？'],['我','我今天有点累'],['林小雨','辛苦啦，早点休息'],['林小雨','我最近在学做饭，挺开心的']];
 for(let day=0;day<40;day++)texts.forEach(([sender,text],i)=>{if((day+i)%5===0&&i>3)return;const date=new Date(Date.UTC(2026,8,1+day,1+i*0.1*10));rows.push({sender,text,timestamp:date.toISOString(),messageId:'m'+day+'-'+i});});
 return {messages:rows,self:'我',target:'林小雨',interactionCorrections:[]};};

test('daily index is the v3 rule-layer score of that day, and months are summed day signals',()=>{
 const contact=longChat(),timeline=analyzeDailyTimeline(contact.messages,contact.self,contact.target);
 const days=buildDailySignals(contact);
 for(const day of timeline.days){const signals=days.find(item=>item.key===day.date);assert.equal(day.affinityScore,scorePeriod(signals).index,day.date);}
 const months=buildPeriodSignals(contact,{granularity:'month'});
 for(const month of months){const merged=mergePeriodSignals(timeline.days.filter(day=>day.date.startsWith(month.key)).map(day=>day.v3Signals));assert.equal(scorePeriod(merged).index,scorePeriod(month).index,month.key);}
 const [all]=analyzePeriods(contact,'all');
 assert.equal(scorePeriod(mergePeriodSignals(timeline.days.map(day=>day.v3Signals))).index,all.index);
});
