import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeContactImport} from './engine.js';

test('new import preserves confirmed and obsolete manual profile edits and dismissed facts',()=>{
 const manual={field:'job',value:'用户纠正的工作资料',manual:true,confirmed:true,quote:'原始依据'};
 const obsolete={field:'daily',value:'旧习惯',manual:true,obsolete:true};
 const existing={id:'a',self:'我',target:'林小雨',messages:[{sender:'林小雨',text:'你好',timestamp:'2026-02-25 12:00:00',file:'QQ.json'}],profileSummary:[manual,obsolete,{field:'daily',value:'机器旧摘要',quote:'你好'}],profileDismissed:['interests|已删除依据'],timelineAnalysis:{'2026-02-25':{summary:'旧总结'}}};
 const incoming={self:'我',target:'林小雨',messages:[{sender:'我',text:'新消息',timestamp:'2026-02-26 12:00:00',file:'微信.json'}]};
 const result=mergeContactImport([existing],incoming);
 assert.equal(result.contact.id,'a');
 assert.deepEqual(result.contact.profileSummary,existing.profileSummary);
 assert.equal(result.contact.profileNeedsRefresh,true);
 assert.deepEqual(result.contact.profileDismissed,['interests|已删除依据']);
 assert.equal(result.contact.messages.length,2);
 assert.equal(existing.profileSummary.length,3);
});

test('reimporting identical records leaves synthesized profile intact',()=>{
 const message={sender:'对方',text:'你好',timestamp:'2026-02-25 12:00:00',file:'QQ.json'};
 const profileSummary=[{field:'daily',value:'已整理结果',quote:'你好'}];
 const existing={id:'a',self:'我',target:'对方',messages:[message],profileSummary};
 const result=mergeContactImport([existing],{self:'我',target:'对方',messages:[{...message}]});
 assert.equal(result.added,0);
 assert.deepEqual(result.contact.profileSummary,profileSummary);
});
