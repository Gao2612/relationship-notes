import test from 'node:test';
import assert from 'node:assert/strict';
import {profileExpiryTime,profileFactStatus,isProfileFactCurrent,changeProfile,profileRows} from './profile-lifecycle.js';

test('date-only expiry ends at the Shanghai day boundary and invalid calendar dates are rejected',()=>{
 const expiry=profileExpiryTime('2026-11-01');assert.equal(expiry,Date.parse('2026-11-01T23:59:59.999+08:00'));assert.equal(profileFactStatus({status:'active',expiresAt:'2026-11-01'},expiry),'active');assert.equal(profileFactStatus({status:'active',expiresAt:'2026-11-01'},expiry+1),'expired');assert(Number.isNaN(profileExpiryTime('2026-02-30')));assert(Number.isNaN(profileExpiryTime('nonsense')));
});
test('plan completion, cancellation and reopening preserve history and exclude finished suggestions',()=>{
 const contact={profileSummary:[{uid:'f',field:'followup',value:'周末爬山',status:'active',confirmed:true}]};let done=changeProfile(contact,{type:'complete',uid:'f'},100);assert.equal(done.profileSummary[0].status,'completed');assert(!isProfileFactCurrent(done.profileSummary[0],200));assert.equal(done.profileSummary[0].lifecycleHistory[0].from,'active');let active=changeProfile(done,{type:'reopen',uid:'f'},200);assert(isProfileFactCurrent(active.profileSummary[0],200));assert.equal(active.profileSummary[0].expiresAt,null);const cancelled=changeProfile(active,{type:'cancel',uid:'f'},300);assert.equal(cancelled.profileSummary[0].status,'cancelled');assert(!isProfileFactCurrent(cancelled.profileSummary[0],300));
});
test('explicit expiration and date management preserve the fact and can reopen it',()=>{
 const contact={profileSummary:[{uid:'f',field:'city',value:'杭州',status:'active'}]},expired=changeProfile(contact,{type:'expire',uid:'f'},100);assert.equal(expired.profileSummary[0].value,'杭州');assert.equal(profileRows(expired,200)[0].status,'expired');assert.throws(()=>changeProfile(contact,{type:'setExpiry',uid:'f',expiresAt:'2026-02-30'}),/无效/);const dated=changeProfile(contact,{type:'setExpiry',uid:'f',expiresAt:'2026-11-01'},100);assert.equal(profileRows(dated,Date.parse('2026-11-02T00:00:00+08:00'))[0].status,'expired');assert(isProfileFactCurrent(changeProfile(dated,{type:'reopen',uid:'f'},Date.parse('2026-11-02T00:00:00+08:00')).profileSummary[0]));
});
test('pending and deleted candidates cannot bypass confirmation using plan state transitions',()=>{
 for(const status of ['pending','deleted','archived','superseded']){let contact={profileSummary:[{uid:'f',field:'followup',value:'计划',status,confirmed:false}]};for(const type of ['complete','cancel','expire','setExpiry','reopen']){contact=changeProfile(contact,{type,uid:'f',expiresAt:'2026-11-01'},100);assert.equal(contact.profileSummary[0].status,status);}}
 const pending={profileSummary:[{uid:'f',field:'followup',value:'计划',status:'pending',confirmed:false}]},archived=changeProfile(pending,{type:'archive',uid:'f'},100),restored=changeProfile(archived,{type:'restore',uid:'f'},200);assert.equal(restored.profileSummary[0].status,'pending');assert.equal(restored.profileSummary[0].confirmed,false);
 const deleted={profileSummary:[{uid:'f',field:'followup',value:'计划',status:'deleted'}]};assert.equal(changeProfile(deleted,{type:'archive',uid:'f'},100).profileSummary[0].status,'deleted');
});
test('editing an unrelated fact never persists derived expiry or storedStatus',()=>{
 const contact={profileSummary:[{uid:'old',field:'city',value:'杭州',status:'active',expiresAt:1},{uid:'other',field:'job',value:'设计师',status:'active'}]},changed=changeProfile(contact,{type:'edit',uid:'other',value:'工程师'},100);assert.equal(changed.profileSummary[0].status,'active');assert(!('storedStatus' in changed.profileSummary[0]));assert.equal(profileRows(changed,100)[0].status,'expired');
});
