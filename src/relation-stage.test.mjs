import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from './relation-stage.js';

const day=(date,affinityScore,extra={})=>({date,affinityScore,turns:6,targetTurns:4,selfStarts:3,targetStarts:2,emotionalSharingTurns:0,appeasementReplies:0,targetShares:1,positiveCues:1,...extra});
const days=(count,score,extra)=>Array.from({length:count},(_,index)=>day('2026-11-'+(String(index+1).padStart(2,'0')),score,extra));
const message=(sender,text,timestamp='2026-11-01 10:00')=>({sender,text,timestamp});
const contact=(extra={})=>({id:'c1',self:'我',target:'对方',messages:[],profileSummary:[],...extra});

test('未确认发言人或空记录时给出待定而不是崩溃',()=>{
 for(const value of [undefined,null,{},contact({self:'',target:''}),contact({self:'我',target:'我'})]){
  const result=E.buildRelationStage(value,{});
  assert.equal(result.stage,'unknown');assert.equal(result.label,'待定');assert.equal(result.confidence,0);
  assert(result.reasons.some(reason=>reason.code==='identity_missing'));
 }
 assert.equal(E.buildRelationStage(contact({messages:[]}),{}).stage,'stranger','没有可评分互动时按陌生人处理');
});

test('单日互动判为陌生人，三到四天判为路人',()=>{
 assert.equal(E.buildRelationStage(contact({messages:[message('我','在吗'),message('对方','嗯')]}),{days:days(1,50)}).stage,'stranger');
 const light=E.buildRelationStage(contact(),{days:days(3,35)});
 assert.equal(light.stage,'acquaintance');
 assert(light.band[0]<=35&&light.band[1]>=35);
});

test('朋友与好朋友按互动天数、平均分和互相主动区分',()=>{
 const friend=E.buildRelationStage(contact(),{days:days(6,45)});
 assert.equal(friend.stage,'friend');
 assert.equal(friend.autoStage,'friend');
 assert(friend.reasons.some(reason=>reason.code==='regular'));
 const boundary=E.buildRelationStage(contact(),{days:days(13,54.9)});
 assert.equal(boundary.stage,'friend','平均分 54.9 未达好朋友门槛');
 const close=E.buildRelationStage(contact(),{days:days(13,60,{emotionalSharingTurns:2})});
 assert.equal(close.stage,'closeFriend');
 assert(close.reasons.some(reason=>reason.code==='stable'));
 assert(close.confidence>=0&&close.confidence<=1);
});

test('工作话题占多数且没有情绪分享时判为同事',()=>{
 const messages=[];
 for(let index=0;index<8;index++)messages.push(message('我','今天加班改方案',('2026-11-0'+(index%5+1))+' 10:00'));
 messages.push(message('对方','周报发我一下','2026-11-01 11:00'));
 messages.push(message('对方','排期确认了吗','2026-11-02 11:00'));
 const result=E.buildRelationStage(contact({messages}),{days:days(5,44,{targetShares:0})});
 assert.equal(result.stage,'colleague');
 assert(result.metrics.workRatio>=0.6);
});

test('单方强信号判为暗恋，双方强信号判为暧昧',()=>{
 const crushMessages=[message('我','有点想你','2026-11-01 22:10'),message('我','你最近好吗，我喜欢你说话的方式','2026-11-02 22:10'),message('对方','还行','2026-11-02 22:20')];
 const crush=E.buildRelationStage(contact({messages:crushMessages}),{days:days(4,48,{selfStarts:8,targetStarts:2})});
 assert.equal(crush.stage,'crush');
 assert(crush.reasons.some(reason=>reason.code==='one_sided'));
 const mutualMessages=[...crushMessages,message('对方','我也想你','2026-11-03 23:10')];
 const mutual=E.buildRelationStage(contact({messages:mutualMessages}),{days:days(4,52)});
 assert.equal(mutual.stage,'ambiguous');
 assert(mutual.reasons.some(reason=>reason.code==='mutual'));
});

test('出现明确情侣称呼时判为对象并可查看原文',()=>{
 const messages=[message('我','我们在一起吧','2026-11-05 20:00'),message('对方','好，我答应做你女朋友','2026-11-05 20:05')];
 const result=E.buildRelationStage(contact({messages}),{days:days(3,50)});
 assert.equal(result.stage,'partner');
 const reason=result.reasons.find(item=>item.code==='commit');
 assert(reason.evidence.quote.includes('女朋友'));
});

test('人工设定优先于自动判定，且重算不会把它冲掉',()=>{
 const base=contact({messages:[]}),manual=E.changeRelationProfile(base,{type:'setStage',stage:'ambiguous',note:'双方都说破了但没确认'},1700000000000);
 const result=E.buildRelationStage(manual,{days:days(6,45)});
 assert.equal(result.stage,'ambiguous');
 assert.equal(result.manual,true);
 assert.equal(result.confidence,1);
 assert.deepEqual(result.band,[50,100],'人工设定后证据区间改用该阶段自身的区间');
 assert.equal(result.autoStage,'friend');
 assert(result.reasons[0].text.includes('你手动设定'));
 const later=E.buildRelationStage(manual,{days:days(13,70,{emotionalSharingTurns:5})});
 assert.equal(later.stage,'ambiguous','自动判定变化后仍保留人工设定');
 assert.equal(later.autoStage,'closeFriend');
 const cleared=E.changeRelationProfile(manual,{type:'clearStage'});
 assert.equal(E.buildRelationStage(cleared,{days:days(6,45)}).stage,'friend');
});

test('关系画像字段可保存、截断并拒绝未知阶段',()=>{
 const updated=E.changeRelationProfile(contact(),{type:'setProfile',label:'  小林  ',context:'大学同学，聊工作和电影',expectation:'想先做稳定的朋友'},1700000000000);
 assert.equal(updated.relationProfile.label,'小林');
 assert.equal(E.relationProfile(updated).expectation,'想先做稳定的朋友');
 assert.equal(updated.relationProfileUpdatedAt,1700000000000);
 const long=E.changeRelationProfile(contact(),{type:'setField',field:'label',value:'名'.repeat(120)});
 assert.equal(Array.from(long.relationProfile.label).length,60);
 assert.throws(()=>E.changeRelationProfile(contact(),{type:'setStage',stage:'恋人'}),/未知的关系阶段/);
 assert.throws(()=>E.changeRelationProfile(contact(),{type:'remove'}),/未知的关系画像操作/);
});

test('不带问号的疑问句、否定与口语称呼按同一口径处理',()=>{
 const noMark=contact({messages:[message('对方','你有男票吗')]});
 assert.notEqual(E.buildRelationStage(noMark,{days:days(6,45)}).stage,'partner','省略问号的疑问句不是关系确认');
 const denied=contact({messages:[message('我','我没有男友')]});
 assert.notEqual(E.buildRelationStage(denied,{days:days(6,45)}).stage,'partner','否定表述不是关系确认');
 const colloquial=contact({messages:[message('对方','我男票今天来接我')]});
 assert.equal(E.buildRelationStage(colloquial,{days:days(6,45)}).stage,'partner','男票/女票属于明确关系称呼');
});

test('八档阶段定义自洽：标签唯一、区间落在 0–100 且下限不大于上限',()=>{
 const options=E.relationStageOptions();
 assert.equal(options.length,8);
 assert.equal(new Set(options.map(option=>option.label)).size,8,'八档标签不能重复');
 const auto=E.buildRelationStage(contact(),{days:days(6,45)});
 assert(auto.band[0]>=0&&auto.band[1]<=100,'证据区间必须落在 0–100');
 assert(auto.band[0]<=auto.band[1]);
 for(const option of options){
  assert.equal(E.isRelationStage(option.key),true);
  assert.equal(E.relationStageLabel(option.key),option.label);
 }
 assert.equal(E.relationStageLabel('soulmate'),'待定');
 assert.equal(E.isRelationStage('soulmate'),false);
});

test('疑问、否定与过往表述不算关系确认，真实确认才判对象',()=>{
 const asked=contact({messages:[message('对方','你有男朋友吗？'),message('我','没有')]});
 assert.notEqual(E.buildRelationStage(asked,{days:days(6,45)}).stage,'partner','疑问句不是关系确认');
 const past=contact({messages:[message('对方','我前对象昨天来找我')]});
 assert.notEqual(E.buildRelationStage(past,{days:days(6,45)}).stage,'partner','过往表述不是当前关系');
 const real=contact({messages:[message('对方','我男朋友今天来接我')]});
 const realStage=E.buildRelationStage(real,{days:days(6,45)});
 assert.equal(realStage.stage,'partner');
 const mixed=contact({messages:[message('对方','我前对象昨天来找我'),message('对方','我男朋友今天来接我')]});
 const mixedStage=E.buildRelationStage(mixed,{days:days(6,45)});
 assert.equal(mixedStage.stage,'partner');
 assert(mixedStage.reasons.find(r=>r.code==='commit').text.includes('已排除 1 条'),'被排除的表述要在证据句里点名');
});
