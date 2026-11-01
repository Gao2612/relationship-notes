import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureMessageIds,ensureContactMessageIds,resolveEvidenceContext,legacyMessageId} from './message-identity.js';
import {sortChatMessages,mergeContactImport} from './engine.js';
import {migrateWorkspaceRecord} from './persistence-schema.js';

const message=(text='你好',timestamp='2026-11-01 10:00:00',extra={})=>({sender:'对方',text,timestamp,file:'微信.json',...extra});
test('same-text occurrences receive distinct persistent ids and sorting retains them',()=>{
 const assigned=ensureMessageIds([message(),message(),message('稍早','2026-10-31 10:00:00')]);assert.equal(new Set(assigned.map(m=>m.messageId)).size,3);assert.deepEqual(ensureMessageIds([message(),message(),message('稍早','2026-10-31 10:00:00')]).map(m=>m.messageId),assigned.map(m=>m.messageId));
 const sorted=sortChatMessages(assigned);assert.equal(sorted[0].messageId,assigned[2].messageId);assert.equal(sorted[1].messageId,assigned[0].messageId);assert.equal(ensureMessageIds(sorted)[2].messageId,assigned[1].messageId);
});
test('full-file reimport is idempotent while added duplicate occurrences and native ids are preserved',()=>{
 const incoming={id:'c',self:'我',target:'对方',messages:[message(),message()]},first=mergeContactImport([],incoming),again=mergeContactImport(first.contacts,incoming);assert.equal(again.added,0);assert.deepEqual(again.contact.messages.map(m=>m.messageId),first.contact.messages.map(m=>m.messageId));
 const third=mergeContactImport(again.contacts,{...incoming,messages:[message(),message(),message()]});assert.equal(third.added,1);assert.equal(new Set(third.contact.messages.map(m=>m.messageId)).size,3);assert.deepEqual(third.contact.messages.slice(0,2).map(m=>m.messageId),first.contact.messages.map(m=>m.messageId));
 const native=mergeContactImport([],{...incoming,messages:[message('你好',undefined,{id:'native1'})]});assert.equal(mergeContactImport(native.contacts,{...incoming,messages:[message('你好',undefined,{id:'native2'})]}).added,1);
});
test('legacy source references migrate uniquely and provide bounded context after restore',()=>{
 const source=message('我喜欢摄影'),contact={id:'c',self:'我',target:'对方',messages:[message('前文'),source,message('后文')],profileSummary:[{uid:'f',field:'interests',value:'摄影',quote:'我喜欢摄影',sourceMessageIds:[legacyMessageId(source)],message:source}]};
 const restored=migrateWorkspaceRecord({schemaVersion:1,state:{contacts:[contact]}}).state.contacts[0],fact=restored.profileSummary[0];assert.equal(fact.sourceMessageIds[0],restored.messages[1].messageId);const context=resolveEvidenceContext(restored,{factId:'f'},{radius:1});assert.equal(context.status,'found');assert.equal(context.context.length,3);assert.equal(context.context[1].focus,true);assert.equal(resolveEvidenceContext(restored,{messageId:legacyMessageId(source)}).status,'found');
});
test('ambiguous legacy quotes, ids and index hints never choose an arbitrary duplicate',()=>{
 const raw=[message(),message()],contact=ensureContactMessageIds({messages:raw});assert.equal(resolveEvidenceContext(contact,{quote:'你好',messageIndex:0}).status,'ambiguous');assert.equal(resolveEvidenceContext(contact,{messageId:legacyMessageId(raw[0])}).status,'ambiguous');assert.equal(resolveEvidenceContext(contact,{messageId:contact.messages[1].messageId}).index,1);
 const broken=ensureContactMessageIds({messages:[message('a',undefined,{messageId:'duplicate'}),message('a',undefined,{messageId:'duplicate'})]});assert.equal(resolveEvidenceContext(broken,{messageId:'duplicate'}).status,'ambiguous');
});
test('stable references reject edited, removed or contradictory source text',()=>{
 const contact=ensureContactMessageIds({messages:[message('原文')]}),id=contact.messages[0].messageId;assert.equal(resolveEvidenceContext(contact,{messageId:id,quote:'其他'}).status,'missing');assert.equal(resolveEvidenceContext({...contact,messages:[]},{messageId:id}).status,'missing');assert.equal(resolveEvidenceContext(contact,{messageIndex:0}).status,'missing');
});
