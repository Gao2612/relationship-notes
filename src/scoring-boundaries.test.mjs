import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {analyzeInteractionMetrics,correctInteraction} from './interaction-metrics.js';
import {engagementSignals,positive,sharing} from './interaction-signals.js';
import {analyzeDailyTimeline} from './analysis.js';
import {replyContext} from './interaction-context.js';
import {shanghaiTimestamp} from './shared/dates.js';

const message=(id,sender,text,time)=>({messageId:id,sender,text,timestamp:time});

test('更早消息插入同轮后保留纠正，新增独立摩擦仍计数',()=>{
 const self=message('self','我','聊聊今天的事情','2026-11-06 09:00');
 const original=message('old','对方','随便你','2026-11-06 09:02');
 const contact={self:'我',target:'对方',messages:[self,original]};
 const row=analyzeInteractionMetrics(contact).indicators.find(i=>i.kind==='conflict').evidence[0];
 const corrected=correctInteraction(contact,{kind:'conflict',key:row.key,excluded:true},0);
 const inserted=message('new','对方','今天心情一般','2026-11-06 09:01');
 const result=analyzeInteractionMetrics({...corrected,messages:[self,inserted,original]});
 assert.equal(result.conflictReplies,0);
 assert.equal(result.indicators.find(i=>i.kind==='conflict').evidence[0].excluded,true);
 assert.equal(analyzeInteractionMetrics({...corrected,messages:[self,{...inserted,text:'无语'},original]}).conflictReplies,1);
 const updated={...corrected,messages:[self,inserted,original]};
 const newRow=analyzeInteractionMetrics(updated).indicators.find(i=>i.kind==='conflict').evidence[0];
 const restored=correctInteraction(updated,{kind:'conflict',key:newRow.key,excluded:false},1);
 assert.equal(analyzeInteractionMetrics(restored).conflictReplies,1);
});

test('来源文本变化后不套用旧纠正',()=>{
 const original=message('old','对方','随便你','2026-11-06 09:02');
 const contact={self:'我',target:'对方',messages:[original]};
 const row=analyzeInteractionMetrics(contact).indicators.find(i=>i.kind==='conflict').evidence[0];
 const corrected=correctInteraction(contact,{kind:'conflict',key:row.key,excluded:true},0);
 assert.equal(analyzeInteractionMetrics({...corrected,messages:[{...original,text:'无语'}]}).conflictReplies,1);
});

test('跨午夜保留回答与时延，按发生日期汇总主动次数',()=>{
 const messages=[message('a','我','准备休息了吗？','2026-11-05 23:59'),message('b','对方','马上就准备休息了','2026-11-06 00:01')];
 const all=engagementSignals(messages,'我');
 const days=analyzeDailyTimeline(messages,'我','对方').days;
 assert.equal(all.targetStarts,0);
 assert.equal(days[1].targetStarts,0);
 assert.equal(days[1].answeredTurns,1);
 assert.equal(days[1].medianReplyMinutes,2);
 assert.equal(days.reduce((sum,day)=>sum+day.replySamples,0),all.replySamples);
 assert.equal(days.reduce((sum,day)=>sum+day.selfStarts,0),all.selfStarts);
});

test('午夜切分回合但不中断同一对话段，分日回合总数一致',()=>{
 const messages=[message('a','我','继续讨论资料','2026-11-05 23:58'),message('b','我','再补充一点','2026-11-06 00:00'),message('c','对方','收到资料了','2026-11-06 00:01')];
 const all=engagementSignals(messages,'我');
 const days=analyzeDailyTimeline(messages,'我','对方').days;
 assert.equal(days.reduce((sum,day)=>sum+day.selfTurns,0),all.selfTurns);
 assert.equal(days[1].selfStarts,0);
 assert.equal(days[1].medianReplyMinutes,1);
});

test('请求语境共享排除，保留独立的正向和本人计划',()=>{
 for(const text of ['我想你早点把合同签了','我希望你把资料发给我']){
  assert.equal(sharing(text),false);
  assert.equal(positive(text),false);
 }
 assert.equal(positive('我想你了'),true);
 assert.equal(positive('我想你早点签字，谢谢你'),true);
 assert.equal(sharing('我想去看电影'),true);
});

test('答案中的时间特征同时核对事件',()=>{
 assert.equal(replyContext('你几点出门？','我明天买新手机',true).answer,false);
 assert.equal(replyContext('你几点出门？','明天会下雨',true).answer,false);
 assert.equal(replyContext('你几点出门？','明天八点',true).answer,true);
 assert.equal(replyContext('你几点出门？','明天早上出门',true).answer,true);
});

test('统一时间解析处理秒毫秒、本地时间与明确时区',()=>{
 const expected=Date.parse('2026-11-06T09:00:00+08:00');
 for(const value of [expected,expected/1000,String(expected/1000),' 2026-11-06 09:00 ','2026/11/6 09:00:00','2026-11-06T01:00:00Z',new Date(expected)])assert.equal(shanghaiTimestamp(value),expected);
 assert.equal(shanghaiTimestamp('2026-11-06 09:00:00.125678'),expected+125);
 for(const value of ['',null,'bad','2026-02-30 09:00','2026-11-06 25:00'])assert.equal(shanghaiTimestamp(value),null);
});

test('不同系统时区下排序、跨日与混合时间评分相同',()=>{
 const code=`import {sortChatMessages} from './src/engine.js';
 import {engagementSignals} from './src/interaction-signals.js';
 const messages=sortChatMessages([{sender:'对方',text:'收到资料了',timestamp:Date.parse('2026-11-06T09:01:00+08:00')/1000},{sender:'我',text:'准备出门',timestamp:'2026-11-06 09:00'}]);
 const result=engagementSignals(messages,'我');
 console.log(JSON.stringify([result.medianMinutes,result.replySamples,messages[0].sender]));`;
 const root=new URL('../',import.meta.url);
 for(const timezone of ['Asia/Shanghai','UTC','America/New_York']){
  const output=execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:root,env:{...process.env,TZ:timezone},encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),[1,1,'我']);
 }
});
