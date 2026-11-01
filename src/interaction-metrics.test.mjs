import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeInteractionMetrics,correctInteraction,interactionEvidenceKey} from './interaction-metrics.js';
import {analyzeDailyTimeline} from './analysis.js';
test('correction excludes a signal without editing evidence and survives reordering',()=>{
 const message={sender:'你',text:'喜欢你',timestamp:'2026-11-01'},contact={self:'我',target:'你',messages:[message]};
 const original=analyzeInteractionMetrics(contact);assert.equal(original.score,62);
 const corrected=correctInteraction(contact,{key:interactionEvidenceKey(message),kind:'positive',excluded:true,note:'引用台词'});
 assert.equal(analyzeInteractionMetrics(corrected).score,null);assert.equal(corrected.messages[0].text,'喜欢你');
 const restored=correctInteraction({...corrected,messages:[{sender:'我',text:'你好'},message]},{key:interactionEvidenceKey(message),kind:'positive',excluded:false});
 assert.equal(analyzeInteractionMetrics(restored).score,62);assert.equal(restored.interactionCorrections.length,2);
 assert.throws(()=>correctInteraction(contact,{key:'missing',kind:'positive'}));
 assert.equal(analyzeDailyTimeline(corrected.messages,corrected.self,corrected.target,corrected.interactionCorrections).days[0].affinityScore,null);
});
test('explicit dislike is not counted as positive wording',()=>{
 const contact={self:'我',target:'你',messages:[{sender:'你',text:'不喜欢你',timestamp:'2026-11-01'}]};
 assert.equal(analyzeInteractionMetrics(contact).indicators.find(i=>i.kind==='positive').count,0);
 assert.equal(analyzeDailyTimeline(contact.messages,'我','你').days[0].positiveCues,0);
});
