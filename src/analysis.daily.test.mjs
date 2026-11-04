import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDailyTimeline} from './analysis.js';

const message=(sender,text,timestamp)=>({sender,text,timestamp});

test('groups messages by exported local date and counts both speakers and turns',()=>{
 const days=analyzeDailyTimeline([
  message('我','你好','2026-10-21 09:00:00'),
  message('我','周末有空吗？','2026-10-21 09:01:00'),
  message('田子夜','我也很开心见到你。','2026-10-21 09:02:00'),
  message('田子夜','请别再联系我。','2026-10-22 18:00:00'),
 ],'我','田子夜').days;
 assert.equal(days.length,2);
 assert.deepEqual([days[0].messages.length,days[0].selfMessages,days[0].targetMessages,days[0].turns],[3,2,1,2]);
 assert.equal(days[0].activityScore,100);
 assert.equal(days[0].affinityScore,46);
 assert.equal(days[1].affinityScore,24);
 assert.equal(days[1].affinityChange,-22);
 assert.match(days[0].reason,/周末计划/);
 assert.match(days[1].affinityNote,/负向或拒绝表达 1 条/);
});

test('does not infer affinity from message volume and skips unparseable dates',()=>{
 const result=analyzeDailyTimeline([
  message('我','哈哈哈哈','bad timestamp'),
  message('我','今天好忙','2026/10/21 09:00'),
  message('田子夜','收到','2026/10/21 09:01'),
 ],'我','田子夜');
 assert.equal(result.days.length,1);
 assert.equal(result.days[0].affinityScore,6);
 assert.match(result.days[0].affinityNote,/敷衍或收尾式回合 1 轮/);
 assert.equal('limitations' in result,false);
});

test('converts explicitly zoned timestamps into China calendar dates',()=>{
 const result=analyzeDailyTimeline([message('我','晚安','2026-10-30T05:30:00Z')],'我','田子夜');
 assert.equal(result.days[0].date,'2026-10-30');
});

test('groups numeric Unix second and millisecond timestamps by China date',()=>{
 const result=analyzeDailyTimeline([
  message('我','秒级',1793338200),
  message('田子夜','毫秒级',1793338200000),
 ],'我','田子夜');
 assert.equal(result.days.length,1);
 assert.equal(result.days[0].date,'2026-10-30');
 assert.equal(result.days[0].messages.length,2);
});

test('separates target-side engagement cues from chat activity volume',()=>{
 const result=analyzeDailyTimeline([
  message('我','消息很多，但这是我发出的。','2026-10-29 09:00:00'),
  message('田子夜','你周末有空吗？','2026-10-29 09:01:00'),
 ],'我','田子夜');
 assert.equal(result.days[0].activityScore,100);
 assert.equal(result.days[0].affinityScore,32);
 assert.equal(result.days[0].targetQuestions,1);
 assert.match(result.days[0].affinityNote,/提问 1 条/);
});
