import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateWorkspaceRecord,migrateBackupRecord,persistenceExtensions,withoutPersistenceMedia,resolveProfileResponseFact} from './persistence-schema.js';

test('v1 migration preserves unknown state, contact and profile metadata while normalizing voice',()=>{
 const source={schemaVersion:1,savedAt:123,extraEnvelope:'keep',state:{contacts:[{id:'c',custom:{a:1},profileSummary:[{uid:'f',status:'pending',custom:'keep'}]}],goals:[],futureSetting:{mode:'keep'},selfProfile:{custom:'keep',voice:{tone:['自然'],emoji:'invalid',futureVoice:'keep'},samples:[{text:'嗯，好呀',custom:'keep'}]}}};
 const migrated=migrateWorkspaceRecord(source);assert.equal(migrated.schemaVersion,2);assert.equal(migrated.extraEnvelope,'keep');assert.equal(migrated.state.contacts[0].profileSummary[0].status,'pending');assert.deepEqual(migrated.state.futureSetting,source.state.futureSetting);assert.equal(migrated.state.selfProfile.voice.emoji,'rare');assert.equal(migrated.state.selfProfile.voice.futureVoice,'keep');assert.equal(migrated.state.selfProfile.samples[0].custom,'keep');assert.equal(source.schemaVersion,1);assert.equal(source.state.selfProfile.voice.emoji,'invalid');
 const ext=persistenceExtensions(migrated.state,['contacts','goals','selfProfile']);assert.deepEqual(ext.futureSetting,{mode:'keep'});assert(!('contacts' in ext));
});
test('old backups and current records migrate; future versions are rejected rather than overwritten',()=>{
 const old={format:'relationship-notes-backup',version:1,state:{contacts:[],goals:[],extra:'keep'}};const result=migrateBackupRecord(old);assert.equal(result.schemaVersion,2);assert.equal(result.state.extra,'keep');assert(result.state.selfProfile.voice);assert.equal(migrateWorkspaceRecord({schemaVersion:2,state:result.state}).schemaVersion,2);
 assert.throws(()=>migrateWorkspaceRecord({schemaVersion:3,state:{}}),/版本/);assert.throws(()=>migrateBackupRecord({...old,schemaVersion:3}),/版本/);assert.throws(()=>migrateBackupRecord({...old,version:2}),/备份/);
 assert.deepEqual(persistenceExtensions({sharedContactId:'c',profileBridgeStatus:'active',future:'keep'},[]),{future:'keep'});
});
test('quota fallback handles the envelope and keeps chats and unknown metadata without media copies',()=>{
 const file=new Blob(['private']),source={schemaVersion:2,savedAt:123,custom:'keep',state:{extra:'keep',contacts:[{id:'c',selfAvatarFile:file,targetAvatarData:'data:image/png;base64,AAAA',mediaAssets:[{file}],messages:[{text:'消息正文',custom:1,attachments:[{kind:'image',file,fileName:'photo.png'}]}]}]}};
 const reduced=withoutPersistenceMedia(source);assert.equal(reduced.custom,'keep');assert.equal(reduced.state.extra,'keep');assert.equal(reduced.state.contacts[0].messages[0].text,'消息正文');assert.equal(reduced.state.contacts[0].messages[0].custom,1);assert.equal(reduced.state.contacts[0].messages[0].attachments[0].fileName,'photo.png');assert.equal(reduced.state.contacts[0].messages[0].attachments[0].file,null);assert.equal(reduced.state.contacts[0].selfAvatarFile,null);assert.equal(reduced.state.contacts[0].targetAvatarData,null);assert.strictEqual(source.state.contacts[0].selfAvatarFile,file);
});
test('profile reply resolves the request snapshot after sorting and rejects edited or removed sources',()=>{
 const a={id:'stable-a',sender:'对方',text:'我喜欢摄影',timestamp:'2026-11-01'},b={id:'stable-b',sender:'对方',text:'我在杭州',timestamp:'2026-10-31'},request=new Map([[0,{...a,stableId:'stable-a'}],[1,{...b,stableId:'stable-b'}]]),fact={id:0,quote:'我喜欢摄影',field:'interests',value:'摄影'};
 const resolved=resolveProfileResponseFact(fact,request,[b,a],'对方');assert.strictEqual(resolved.message,a);assert.deepEqual(resolved.sourceMessageIds,['stable-a']);assert.equal(resolveProfileResponseFact(fact,request,[b,{...a,text:'原文被编辑'}],'对方'),null);assert.equal(resolveProfileResponseFact({...fact,quote:'编造'},request,[a,b],'对方'),null);assert.equal(resolveProfileResponseFact(fact,request,[],'对方'),null);
 assert.equal(resolveProfileResponseFact(fact,request,[{...a,id:'other-source'}],'对方'),null);
 assert.equal(resolveProfileResponseFact(fact,request,[a,{...a}],'对方'),null);
});
test('normalizing sparse samples and plans keeps metadata attached to its own item',()=>{
 const record=migrateWorkspaceRecord({schemaVersion:1,state:{contacts:[],goals:[],selfProfile:{samples:[{text:'',owner:'invalid'},{text:'好呀',owner:'valid'}],plans:[{text:'',tag:'invalid'},{text:'周末爬山',tag:'valid'}]}}});assert.deepEqual(record.state.selfProfile.samples.map(s=>[s.text,s.owner]),[['好呀','valid']]);assert.deepEqual(record.state.selfProfile.plans.map(p=>[p.text,p.tag]),[['周末爬山','valid']]);
});
