import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestNextSteps} from './suggestions.js';
import {recordTopicFeedback} from './topic-feedback.js';
import {approveReplySample} from './reply-feedback.js';
import {summarizeSelfProfile,changeSelfPlan} from './self-profile.js';
import {buildPeriodReview} from './period-review.js';
import {reviewPeriodRange} from './shared/dates.js';

test('topic feedback survives reload, suppresses repeated topics and can be reset without hiding boundaries',()=>{
 const contact={self:'我',target:'你',messages:[{sender:'你',text:'最近看电影',timestamp:'2026-11-01'}]},topic=suggestNextSteps(contact).suggestions.find(s=>s.type==='topic');
 const muted=JSON.parse(JSON.stringify(recordTopicFeedback(contact,topic,'discussed')));
 const result=suggestNextSteps(muted);assert(!result.suggestions.some(s=>s.text===topic.text));assert.equal(result.suppressed.length,1);
 assert(suggestNextSteps(recordTopicFeedback(muted,topic,'reset')).suggestions.some(s=>s.text===topic.text));
 assert.match(suggestNextSteps({...muted,messages:[{sender:'你',text:'不要再联系我'}]}).suggestions[0].text,/停止/);
});
test('explicit approved replies deduplicate and cap samples while preserving other personal data',()=>{
 const before={voice:{tone:['自然']},interests:['摄影'],custom:'保留',samples:Array.from({length:8},(_,i)=>({text:'样例'+i}))};
 const after=approveReplySample(before,{text:'嗯，改天聊呀',note:'本人认可'});assert.equal(after.samples.length,8);assert.equal(after.samples[0].text,'嗯，改天聊呀');assert.equal(after.custom,'保留');assert.equal(before.samples[0].text,'样例0');
 assert.equal(approveReplySample(after,{text:'嗯，改天聊呀'}).samples.filter(s=>s.text==='嗯，改天聊呀').length,1);assert.throws(()=>approveReplySample(after,{text:' '}));assert.throws(()=>approveReplySample(after,{text:'你'.repeat(241)}));
});
test('completed or expired personal plans stop influencing model context and can reopen',()=>{
 const now=Date.parse('2026-11-02T00:00:00+08:00'),before={plans:[{text:'看展',planState:'active',expiresAt:'2026-11-01'}]};
 assert.equal(summarizeSelfProfile(before,now).plans.length,0);
 const opened=changeSelfPlan(before,0,{type:'reopen'},now);assert.equal(summarizeSelfProfile(opened,now).plans.length,1);
 assert.equal(summarizeSelfProfile(changeSelfPlan(opened,0,{type:'complete'},now),now).plans.length,0);
 assert.throws(()=>changeSelfPlan(opened,0,{type:'setExpiry',expiresAt:'2026-02-30'}));
 const migrated=changeSelfPlan({plans:[{text:'',custom:'空项'},{text:'有效计划',custom:'应保留'}]},0,{type:'complete'},now);
 assert.equal(migrated.plans[0].text,'有效计划');assert.equal(migrated.plans[0].custom,'应保留');assert.equal(migrated.plans[0].planState,'completed');
});
test('Shanghai weekly/monthly review handles boundaries, reply evidence and active followups',()=>{
 assert.deepEqual(reviewPeriodRange('week','2026-11-01'),{start:'2026-10-26',end:'2026-11-01'});
 assert.deepEqual(reviewPeriodRange('month','2024-02-15'),{start:'2024-02-01',end:'2024-02-29'});
 const contact={self:'我',target:'你',messages:[{sender:'你',text:'周末想看电影吗？',timestamp:'2026-10-31 12:00:00'},{sender:'我',text:'可以呀',timestamp:'2026-11-01 12:00:00'},{sender:'你',text:'想去哪？',timestamp:'2026-11-01 13:00:00'},{sender:'你',text:'未知时间',timestamp:'bad'}],profileSummary:[{field:'followup',value:'约看展',status:'active',confirmed:true},{field:'plans',value:'已完成',status:'active',planState:'completed'}]};
 const result=buildPeriodReview(contact,{period:'week',anchor:'2026-11-01'});assert.equal(result.messageCount,3);assert.equal(result.unanswered.length,1);assert.equal(result.unanswered[0].quote,'想去哪？');assert(result.topics.some(t=>t.label==='兴趣活动'));assert.equal(result.followups.length,1);assert.equal(result.unknownDateCount,1);
 assert.equal(buildPeriodReview(null,{anchor:'2026-11-01'}).messageCount,0);
});
