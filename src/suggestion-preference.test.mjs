import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestNextSteps} from './suggestions.js';
const base={self:'我',target:'对方',messages:[{sender:'对方',text:'嗯，今天就这样吧'}]};
test('a negative quotation cannot seed a positive game topic from a mixed summary',()=>{
 const result=suggestNextSteps({...base,profileSummary:[{uid:'f',field:'interests',value:'喜欢玩农场类游戏，会买肥料、种活动种子，但不爱玩其他游戏、麻将、剧本杀和狼人杀。',quote:'没有没有，我本来对游戏啊、麻将啥的都不感兴趣',status:'active',confirmed:true}]});
 assert(!result.suggestions.some(s=>/农场|麻将|剧本杀|狼人杀/.test(s.text)));assert(!result.suggestions.some(s=>s.basis?.some(b=>b.factId==='f')));
});
test('a locally positive farm preference produces a concrete question with its own supporting clause',()=>{
 const quote='我不爱其他游戏，但喜欢玩农场',result=suggestNextSteps({...base,profileSummary:[{uid:'f',field:'interests',value:'喜欢农场，不爱其他游戏及麻将',quote,status:'active',confirmed:true}]});
 const suggestion=result.suggestions.find(s=>s.basis?.some(b=>b.factId==='f'));assert.equal(suggestion.text,'最近还有玩农场吗？');assert.equal(suggestion.basis[0].quote,'喜欢玩农场');assert(quote.includes(suggestion.basis[0].quote));assert(!/麻将/.test(suggestion.text));
});
test('a latest negative preference is acknowledged rather than turned into a new game prompt',()=>{
 const result=suggestNextSteps({...base,messages:[{sender:'对方',text:'我对游戏和麻将都不感兴趣'}]});
 assert.equal(result.suggestions.length,1);assert.equal(result.suggestions[0].type,'reply');assert.match(result.suggestions[0].text,/先不聊/);
});
