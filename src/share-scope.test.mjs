import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShareScopePreview,normalizeShareScope,shareScopeDay} from './share-scope.js';
import {createProfileBridgeSnapshot} from './profile-bridge.js';
test('explicit inclusive date scope uses Shanghai and excludes unknown timestamps',()=>{
 const contact={id:'c',self:'我',target:'你',messages:[{id:'1',sender:'你',text:'跨日',timestamp:'2026-01-01T18:00:00Z'},{id:'2',sender:'我',text:'未知'},{id:'3',sender:'你',text:'另一天',timestamp:'2026-01-03 12:00:00'}]};
 const options={since:'2026-01-02',until:'2026-01-02',limit:100},preview=buildShareScopePreview(contact,options),snapshot=createProfileBridgeSnapshot(contact,options);
 assert.equal(preview.messageCount,1);assert.equal(preview.excludedUnknownTime,1);assert.equal(snapshot.messages[0].text,'跨日');assert.equal(shareScopeDay('2026-01-01T18:00:00Z'),'2026-01-02');
});
test('default and selected preview exactly match bounded snapshot truncation',()=>{
 const contact={id:'c',self:'我',target:'你',messages:Array.from({length:510},(_,i)=>({id:'m'+i,sender:'你',text:i===509?'字'.repeat(2200):'内容'+i,timestamp:'2026-01-02 12:00:00'}))};
 for(const limit of [1,100,500]){const preview=buildShareScopePreview(contact,{limit}),snapshot=createProfileBridgeSnapshot(contact,{limit});assert.equal(preview.messageCount,snapshot.messages.length);assert.equal(preview.truncatedMessages,510-limit);assert.equal(preview.textTruncatedCount,1);assert.equal(snapshot.messages.at(-1).text.length,2000);}
 assert.equal(createProfileBridgeSnapshot(contact).messages.length,500);
});
test('invalid date and count cannot silently broaden a shared scope',()=>{
 for(const value of [{since:'2026-02-30'},{since:'2026-03-01',until:'2026-01-01'},{limit:501},{limit:0},{limit:'nonsense'}])assert.throws(()=>normalizeShareScope(value));
});
