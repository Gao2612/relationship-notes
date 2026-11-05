import test from 'node:test';
import assert from 'node:assert/strict';
import {NAVIGATION,resolveNavigation,groupTabs,createWorkspaceStore} from './navigation.js';

const OLD_ROUTES={
  'profile/basic':{group:'contact',item:'profile',tab:'basic'},
  'profile/interests':{group:'contact',item:'profile',tab:'interests'},
  'behavior/daily':{group:'records',item:'behavior',tab:'daily'},
  'behavior/metrics':{group:'records',item:'behavior',tab:'metrics'},
  'behavior/basis':{group:'records',item:'behavior',tab:'basis'},
  'behavior/review':{group:'records',item:'behavior',tab:'review'},
  'behavior/evidence':{group:'records',item:'behavior',tab:'evidence'},
  'behavior/rules':{group:'records',item:'behavior',tab:'rules'},
  'goals/current':{group:'communicate',item:'goals',tab:'current'},
  'goals/progress':{group:'communicate',item:'goals',tab:'progress'},
  'replies/session':{group:'communicate',item:'replies',tab:'session'},
  'settings/general':{group:'manage',item:'settings',tab:'general'},
  'import/file':{group:'manage',item:'import',tab:'file'},
  'import/identity':{group:'manage',item:'import',tab:'identity'},
  'import/result':{group:'manage',item:'import',tab:'result'},
};

test('top navigation is two levels: four level-one entries and page tabs',()=>{
  assert.deepEqual(NAVIGATION.map(group=>group.id),['contact','records','communicate','manage']);
  assert.deepEqual(NAVIGATION.map(group=>group.label),['联系人','记录与评分','沟通','设置']);
  for(const group of NAVIGATION){for(const item of group.items){assert(item.tabs.length>=1,item.id);}const keys=groupTabs(group).map(tab=>tab.key);assert.equal(new Set(keys).size,keys.length,group.id);}
  assert.equal(groupTabs(NAVIGATION.find(group=>group.id==='records')).length,6);
  assert.equal(groupTabs(NAVIGATION.find(group=>group.id==='communicate')).length,3);
});

test('every legacy feature/tab route still resolves to its new location',()=>{
  for(const [route,expected] of Object.entries(OLD_ROUTES)){
    const [feature,tab]=route.split('/'),resolved=resolveNavigation(feature,tab);
    assert.deepEqual({group:resolved.group.id,item:resolved.item.id,tab:resolved.tab},expected,route);
  }
});

test('legacy group-only ids keep resolving without dead links',()=>{
  assert.deepEqual(resolveNavigation('data','interests').group.id,'contact');
  assert.deepEqual(resolveNavigation('observe','rules').group.id,'records');
  assert.deepEqual(resolveNavigation('observe','rules').item.id,'behavior');
  assert.deepEqual(resolveNavigation('observe','progress').item.id,'goals');
  assert.deepEqual(resolveNavigation('manage','file').item.id,'import');
  assert.deepEqual(resolveNavigation('communicate','session').item.id,'replies');
  assert.equal(resolveNavigation('profile','invalid').tab,'basic');
  assert.equal(resolveNavigation('bad','bad').item.id,'profile');
});

test('switching features preserves contacts draft and goals',()=>{
  const s=createWorkspaceStore({contacts:[{id:'a'}],draft:'unfinished',goals:[{id:1}]}),previous=s.getSnapshot();
  s.navigate('observe','metrics');
  assert.notEqual(s.getSnapshot(),previous);
  assert.equal(s.getSnapshot().feature,'behavior');
  s.navigate('profile','sources');
  assert.equal(s.getSnapshot().draft,'unfinished');
  assert.equal(s.getSnapshot().contacts[0].id,'a');
  assert.equal(s.getSnapshot().goals[0].id,1);
});

test('subscriptions are removed and snapshots stable until writes',()=>{
  const s=createWorkspaceStore();let count=0;
  const off=s.subscribe(()=>count++),a=s.getSnapshot();
  assert.equal(a,s.getSnapshot());
  s.set({tone:'direct'});
  assert.equal(count,1);
  off();
  s.navigate('goals');
  assert.equal(count,1);
});
