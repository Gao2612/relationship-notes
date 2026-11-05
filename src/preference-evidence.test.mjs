import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPreferenceEvidence,selectPositivePreference,hasNegativePreference,preferenceSummarySupported} from './preference-evidence.js';
test('negative-only source cannot support a mixed positive generated summary',()=>{
 const fact={field:'interests',value:'喜欢农场游戏，不爱其他游戏麻将',quote:'没有没有，我本来对游戏麻将不感兴趣'};
 assert.equal(selectPositivePreference(fact),null);
 assert.equal(extractPreferenceEvidence(fact.quote).negative.length,1);
});
test('negative scopes do not erase a distinct later positive preference',()=>{
 const source='我不喜欢麻将，但后来喜欢玩农场，不玩其他游戏';
 const result=extractPreferenceEvidence(source);assert.equal(result.positive.length,1);assert.equal(result.positive[0].text,'农场');assert.equal(result.negative.length,2);assert(source.includes(result.positive[0].quote));
 const fact={field:'interests',value:'喜欢各种游戏',quote:source};assert.deepEqual(selectPositivePreference(fact),result.positive[0]);
});
test('full screenshot counterexample preserves negative-only source and local positive exception',()=>{
 const quote='没有没有，我本来对游戏啊、麻将啥的都不感兴趣';
 assert.equal(selectPositivePreference({field:'interests',value:'喜欢农场游戏，但不喜欢其他游戏及麻将',quote}),null);assert.equal(hasNegativePreference(quote),true);
 assert.deepEqual(selectPositivePreference({field:'interests',value:'喜欢农场，不爱其他游戏',quote:'我不爱其他游戏，但喜欢玩农场'}),{text:'农场',quote:'喜欢玩农场'});
 assert.equal(extractPreferenceEvidence('喜欢玩农场吗？').positive.length,0);
});
test('explicit likes and dislikes in one message retain separate literal evidence',()=>{
 const result=extractPreferenceEvidence('我喜欢农场游戏，不爱其他游戏麻将');
 assert.deepEqual(result.positive,[{text:'农场游戏',quote:'我喜欢农场游戏'}]);assert.deepEqual(result.negative,[{text:'其他游戏麻将',quote:'不爱其他游戏麻将'}]);
});
test('double negatives, quotes and mere activities do not become confident interests',()=>{
 for(const quote of ['我不是不喜欢农场','她说喜欢农场','我玩了农场','“喜欢麻将”只是玩笑','我以前喜欢麻将','我不是很喜欢麻将'])assert.equal(extractPreferenceEvidence(quote).positive.length,0,quote);
 assert.equal(hasNegativePreference('我对游戏没有兴趣'),true);assert.equal(hasNegativePreference('麻将没什么兴趣'),true);
 assert.equal(selectPositivePreference({field:'interests',value:'喜欢游戏'}),null);
 assert.equal(selectPositivePreference({field:'interests',value:'喜欢咖啡',manual:true}).text,'咖啡');
});
test('common negative preference expressions suppress forced continuation without inventing positives',()=>{
 for(const quote of ['我讨厌麻将','我很反感游戏','游戏没兴趣','对游戏没啥兴趣','对麻将不感冒','游戏我很反感']){assert.equal(hasNegativePreference(quote),true,quote);assert.equal(extractPreferenceEvidence(quote).positive.length,0);}
 for(const quote of ['我不讨厌游戏','我不是没兴趣','我对游戏谈不上喜欢'])assert.equal(extractPreferenceEvidence(quote).positive.length,0,quote);
});
test('summary guard rejects positive/negative contradiction and preserves negative profile data',()=>{
 const quote='没有没有，我本来对游戏啊、麻将啥的都不感兴趣';
 assert.equal(preferenceSummarySupported({field:'interests',value:'喜欢农场游戏，不爱其他游戏麻将',quote}),false);
 assert.equal(preferenceSummarySupported({field:'preferences',value:'对游戏麻将不感兴趣',quote}),true);
 assert.equal(preferenceSummarySupported({field:'interests',value:'农场',quote}),false);
 assert.equal(preferenceSummarySupported({field:'interests',value:'喜欢农场，不爱其他游戏',quote:'我不爱其他游戏，但喜欢玩农场'}),true);
 assert.equal(preferenceSummarySupported({field:'city',value:'杭州',quote:'杭州'}),true);
});
