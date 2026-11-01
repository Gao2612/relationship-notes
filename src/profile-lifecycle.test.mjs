import test from 'node:test';
import assert from 'node:assert/strict';
import {profileRows,changeProfile,mergeProfileAnalysis} from './profile-lifecycle.js';
const base=()=>({profileSummary:[{field:'job',value:'原工作',quote:'原文',message:{timestamp:'2026-02-25 12:00:00'}}]});
test('correction keeps stable identity; new situation retains old dated history',()=>{
 let c=base(),uid=profileRows(c)[0].uid;
 c=changeProfile(c,{type:'edit',uid,value:'纠正工作'},100);
 assert.equal(c.profileSummary[0].uid,uid);assert.equal(c.profileSummary[0].value,'纠正工作');
 c=changeProfile(c,{type:'update',uid,value:'新工作',effectiveAt:'2026-10-31 12:00:00',newUid:'new'},200);
 assert.equal(c.profileSummary[0].status,'superseded');assert.equal(c.profileSummary[0].effectiveUntil,'2026-10-31 12:00:00');
 assert.equal(c.profileSummary[1].status,'active');assert.equal(c.profileSummary[1].supersedes,uid);
});
test('archived and deleted entries stay out of active facts, deletion is undoable',()=>{
 let c=base(),uid=profileRows(c)[0].uid;
 c=changeProfile(c,{type:'archive',uid},100);assert.equal(c.profileSummary[0].status,'archived');
 c=changeProfile(c,{type:'delete',uid},200);assert.equal(c.profileSummary[0].status,'deleted');assert(c.profileDismissed.includes('job|原文'));
 c=changeProfile(c,{type:'undoDelete',uid},300);assert.equal(c.profileSummary[0].status,'archived');assert(!c.profileDismissed.includes('job|原文'));
 c=changeProfile(c,{type:'restore',uid},400);assert.equal(c.profileSummary[0].status,'active');assert.equal(c.profileSummary[0].obsolete,false);
});
test('analysis cannot silently reactivate archived or corrected fields',()=>{
 let c=base(),uid=profileRows(c)[0].uid;c=changeProfile(c,{type:'archive',uid},100);
 c=mergeProfileAnalysis(c,[{field:'job',value:'原工作',quote:'原文'},{field:'job',value:'模型猜到的新工作',quote:'新依据'}],200);
 assert.equal(c.profileSummary.length,2);assert.equal(c.profileSummary[0].status,'archived');assert.equal(c.profileSummary[1].status,'pending');
 c=changeProfile(c,{type:'accept',uid:c.profileSummary[1].uid},300);assert.equal(c.profileSummary[1].status,'active');
});
test('deleted analysis cannot reappear and editing pending explicitly adopts it',()=>{
 let c=base(),uid=profileRows(c)[0].uid;c=changeProfile(c,{type:'delete',uid},100);
 c=mergeProfileAnalysis(c,[{field:'job',value:'原工作',quote:'原文'},{field:'job',value:'新内容',quote:'新文'}],200);
 assert.equal(c.profileSummary.length,2);assert.equal(c.profileSummary[1].status,'pending');
 c=changeProfile(c,{type:'edit',uid:c.profileSummary[1].uid,value:'确认的新内容'},300);assert.equal(c.profileSummary[1].status,'active');
});

test('restoring an old version supersedes every active descendant but leaves unrelated facts',()=>{
 let c=base(),uid=profileRows(c)[0].uid;
 c=changeProfile(c,{type:'update',uid,value:'第二份工作',newUid:'second'},100);
 c=changeProfile(c,{type:'update',uid:'second',value:'第三份工作',newUid:'third'},200);
 c=changeProfile(c,{type:'add',field:'daily',value:'每天散步',newUid:'habit'},250);
 c=changeProfile(c,{type:'restore',uid},300);
 assert.equal(c.profileSummary.find(f=>f.uid===uid).status,'active');
 assert.equal(c.profileSummary.find(f=>f.uid===uid).effectiveUntil,null);
 assert.equal(c.profileSummary.find(f=>f.uid==='third').status,'superseded');
 assert.equal(c.profileSummary.find(f=>f.uid==='third').effectiveUntil,300);
 assert.equal(c.profileSummary.find(f=>f.uid==='habit').status,'active');
 assert.equal(c.profileSummary.filter(f=>f.field==='job'&&f.status==='active').length,1);
});

test('restore keepBoth explicitly allows active predecessor and successor',()=>{
 let c=base(),uid=profileRows(c)[0].uid;
 c=changeProfile(c,{type:'update',uid,value:'兼职工作',newUid:'second'},100);
 c=changeProfile(c,{type:'restore',uid,keepBoth:true},200);
 assert.equal(c.profileSummary.filter(f=>f.status==='active').length,2);
});

test('multiple independent habits and interests stay active alongside manual facts',()=>{
 let c={profileSummary:[{uid:'a',field:'daily',value:'带午饭',quote:'我带饭',manual:true,status:'active'},{uid:'b',field:'interests',value:'看综艺',quote:'喜欢综艺',manual:true,status:'active'},{uid:'c',field:'preferences',value:'少糖',quote:'不爱甜',manual:true,status:'active'}]};
 c=mergeProfileAnalysis(c,[{field:'daily',value:'睡前看农场',quote:'睡前看农场'},{field:'interests',value:'喜欢散步',quote:'我喜欢散步'},{field:'preferences',value:'喜欢清淡',quote:'喜欢清淡'},{field:'recent',value:'最近忙',quote:'最近很忙'},{field:'agreement',value:'周末见',quote:'周末见'}],100);
 assert(c.profileSummary.slice(0,3).every(f=>f.status==='active'));
 assert(c.profileSummary.slice(3).every(f=>f.status==='pending'&&f.provenance==='model'&&!f.confirmed));
});

test('single-value cities and jobs require confirmation even against nonmanual facts',()=>{
 const c=mergeProfileAnalysis({profileSummary:[{field:'city',value:'郑州',quote:'在郑州'},{field:'job',value:'会计',quote:'我是会计'}]},[{field:'city',value:'上海',quote:'搬到上海'},{field:'job',value:'教师',quote:'现在教书'}],100);
 assert.deepEqual(c.profileSummary.slice(2).map(f=>f.status),['pending','pending']);
});

test('archive and deletion prevent the same multivalue fact from resurfacing',()=>{
 let c={profileSummary:[{uid:'habit',field:'daily',value:'旧习惯',quote:'以前习惯',status:'active'},{uid:'interest',field:'interests',value:'旧爱好',quote:'以前爱好',status:'active'}]};
 c=changeProfile(c,{type:'archive',uid:'habit'},100);c=changeProfile(c,{type:'delete',uid:'interest'},100);
 c=mergeProfileAnalysis(c,[{field:'daily',value:'旧习惯',quote:'改写依据'},{field:'interests',value:'改写旧爱好',quote:'以前爱好'},{field:'daily',value:'独立新习惯',quote:'新证据'}],200);
 assert.equal(c.profileSummary.length,3);assert.equal(c.profileSummary[0].status,'archived');assert.equal(c.profileSummary[1].status,'deleted');assert.equal(c.profileSummary[2].status,'pending');
});

test('accept replacing current supersedes same-field actives and links newest effective record',()=>{
 const original={profileSummary:[{uid:'newer',field:'job',value:'新兼职',status:'active',effectiveAt:'2026-10-20 10:00:00'},{uid:'older',field:'job',value:'旧工作',status:'active',effectiveAt:'2026-02-01 10:00:00'},{uid:'city',field:'city',value:'郑州',status:'active'},{uid:'proposal',field:'job',value:'待确认工作',status:'pending'}]};
 const c=changeProfile(original,{type:'accept',uid:'proposal',replaceCurrent:true,effectiveAt:'2026-10-31 12:00:00'},100);
 assert.equal(c.profileSummary.find(f=>f.uid==='proposal').supersedes,'newer');
 assert.equal(c.profileSummary.find(f=>f.uid==='proposal').status,'active');
 for(const uid of ['newer','older']){const row=c.profileSummary.find(f=>f.uid===uid);assert.equal(row.status,'superseded');assert.equal(row.effectiveUntil,'2026-10-31 12:00:00');}
 assert.equal(c.profileSummary.find(f=>f.uid==='city').status,'active');
 assert.equal(original.profileSummary[0].status,'active');
});

test('accept defaults to coexistence without superseding existing active records',()=>{
 const c=changeProfile({profileSummary:[{uid:'current',field:'job',value:'当前工作',status:'active'},{uid:'proposal',field:'job',value:'兼职',status:'pending'}]},{type:'accept',uid:'proposal'},100);
 assert(c.profileSummary.every(f=>f.status==='active'));
 assert.equal(c.profileSummary[1].supersedes,undefined);
});
