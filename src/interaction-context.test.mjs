import test from 'node:test';
import assert from 'node:assert/strict';
import {question,sharing,engagementSignals} from './interaction-signals.js';
import {analyzeInteractionMetrics,correctInteraction} from './interaction-metrics.js';
import {analyzeDailyTimeline} from './analysis.js';
import {sceneGroups} from './interaction-context.js';

const message=(sender,text,time)=>({sender,text,timestamp:'2026-11-01 '+time,type:1});

test('短答案、接受建议和具体评价保留上下文依据',()=>{
 for(const [previous,reply] of [['几点出门？','八点'],['要不要试试？','可以！'],['晚饭加了点辣椒','看着都很香']]){
  const result=engagementSignals([message('我',previous,'09:00'),message('对方',reply,'09:01')],'我');
  assert.equal(result.perfunctoryReplies,0);
  assert.equal(result.lowContentReplies,0);
  assert.ok(Object.values(result.turnEvidence[0].context).some(Boolean));
 }
});

test('单次应和与笑声中性，持续无回应才触发短回复处罚',()=>{
 for(const text of ['好','可以','哈哈哈哈']){
  const result=engagementSignals([message('我','收到资料了','09:00'),message('对方',text,'09:01')],'我');
  assert.equal(result.perfunctoryReplies,0);
 }
 const messages=['09:00','09:02','09:04'].flatMap((time,index)=>[message('我','补充资料',time),message('对方','嗯','09:0'+(index*2+1))]);
 const result=engagementSignals(messages,'我');
 assert.equal(result.perfunctoryReplies,1);
});

test('口语经历、计划和主语变化可识别为分享',()=>{
 for(const text of ['我俩吃了面条','我老看纪录片','我就记得小时候的事情','我还减肥了','我已经好久没有吃甜食了'])assert.equal(sharing(text),true,text);
 assert.equal(sharing('他俩吃了面条'),false);
});

test('否定应答和请第三人询问不算直接提问',()=>{
 assert.equal(question('没有没有'),false);
 assert.equal(question('你问问同事要不要权限'),false);
 assert.equal(question('没有没有，你几点出门？'),true);
});

test('系统、图片和通话占位不形成主动开口或短回复',()=>{
 const messages=[{...message('对方','新增了联系人','09:00'),type:10000},{...message('对方','几点出门？','09:01'),type:3},{...message('对方','【音视频通话】','09:02'),type:50},message('我','准备出门了','09:03')];
 const contact={messages,self:'我',target:'对方'};
 const result=analyzeInteractionMetrics(contact);
 assert.equal(result.messages,1);
 assert.equal(result.targetStarts,0);
 assert.equal(result.targetTurns,0);
 assert.equal(analyzeDailyTimeline(messages,'我','对方').days[0].messages.length,1);
});

test('对话段按场景分组，保留同段普通回复',()=>{
 const messages=[message('我','交接资料准备好了','09:00'),message('对方','明天处理','09:01'),message('对方','早餐真香','12:00')];
 const groups=sceneGroups(messages);
 assert.equal(groups.work.length,2);
 assert.equal(groups.daily.length,1);
 assert.equal(groups.work[1],messages[1]);
 assert.equal(messages.length,3);
});

test('投入分排除明确正向项，正向证据独立保留',()=>{
 const messages=[message('我','一起出门吧','09:00'),message('对方','喜欢你','09:01'),message('我','聊聊近况','09:02'),message('对方','我最近喜欢看电影','09:03')];
 const result=analyzeInteractionMetrics({messages,self:'我',target:'对方'});
 assert.equal(result.indicators.find(item=>item.kind==='positive').count,1);
 assert.ok(result.engagementScore<result.score);
 assert.equal(result.scenes.daily+result.scenes.work+result.scenes.mixed+result.scenes.unknown,result.targetTurns);
});


test('回答和承接的上下文依据支持纠正恢复',()=>{
 for(const [kind,previous,reply] of [['answer','几点出门？','八点'],['continuation','这个面条真香','面条美味']]){
  const contact={self:'我',target:'对方',messages:[message('我',previous,'09:00'),message('对方',reply,'09:01')]};
  const indicator=analyzeInteractionMetrics(contact).indicators.find(item=>item.kind===kind);
  assert.equal(indicator.count,1);
  const action={kind,key:indicator.evidence[0].key,excluded:true};
  const corrected=correctInteraction(contact,action,0);
  assert.equal(analyzeInteractionMetrics(corrected).indicators.find(item=>item.kind===kind).count,0);
  const restored=correctInteraction(corrected,{...action,excluded:false},1);
  assert.equal(analyzeInteractionMetrics(restored).indicators.find(item=>item.kind===kind).count,1);
 }
});
