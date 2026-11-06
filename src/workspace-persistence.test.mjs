import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspacePersistence} from './workspace-persistence.js';
import {createWorkspaceStore} from './navigation.js';

// Minimal IndexedDB stub: one object store, request succeeding on a microtask.
function createFakeIndexedDB(){
 const data=new Map();
 let failures=0;
 const db={
  objectStoreNames:{contains:name=>name==='workspace'},
  createObjectStore(){},
  close(){},
  transaction(){
   const tx={error:null,oncomplete:null,onerror:null,onabort:null};
   const complete=()=>queueMicrotask(()=>tx.oncomplete?.());
   tx.objectStore=()=>({
    get(key){const request={result:data.get(key)??null,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>request.onsuccess?.());return request;},
    put(value,key){if(failures>0){failures--;tx.error=new Error('temporary write failure');queueMicrotask(()=>tx.onerror?.());return;}data.set(key,value);complete();},
    delete(key){data.delete(key);complete();},
   });
   return tx;
  },
 };
 return {data,failNextWrite(){failures++;},open(){const request={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
}

test('clear() deletes the stored snapshot and resets the save state',async()=>{
 const fake=createFakeIndexedDB(),previous=globalThis.indexedDB;
 globalThis.indexedDB=fake;
 try{
  const E={WORKSPACE_SCHEMA_VERSION:3,withoutPersistenceMedia:value=>value};
  const store=createWorkspaceStore({contacts:[{id:'c'}],selectedId:'c'});
  const persistence=createWorkspacePersistence({E,store});
  const stop=persistence.start();
  await persistence.readyPromise;
  await persistence.flush();
  assert.ok(fake.data.has('current'),'flush() writes a snapshot');
  await persistence.clear();
  assert.equal(fake.data.has('current'),false,'clear() deletes the database record');
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(fake.data.has('current'),false,'clear() cancels the pending save timer');
  await persistence.flush();
  assert.ok(fake.data.has('current'),'persistence still works after clear()');
  stop();
 }finally{
  if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;
 }
});


test('保存失败后无新增编辑也重试最新快照',async()=>{
 const fake=createFakeIndexedDB(),previous=globalThis.indexedDB;
 globalThis.indexedDB=fake;
 let stop;
 try{
  const store=createWorkspaceStore({contacts:[]});
  const E={WORKSPACE_SCHEMA_VERSION:2,withoutPersistenceMedia:value=>value};
  const persistence=createWorkspacePersistence({E,store});
  stop=persistence.start();
  await persistence.readyPromise;
  fake.failNextWrite();
  store.set({contacts:[{id:'latest'}]});
  await new Promise(resolve=>setTimeout(resolve,1800));
  assert.equal(fake.data.get('current').state.contacts[0].id,'latest');
  assert.equal(store.getSnapshot().persistenceStatus,'');
  await persistence.clear();
  await new Promise(resolve=>setTimeout(resolve,1100));
  assert.equal(fake.data.has('current'),false);
 }finally{
  stop?.();
  if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;
 }
});


test('重试等待期间的新编辑替换旧快照',async()=>{
 const fake=createFakeIndexedDB(),previous=globalThis.indexedDB;
 globalThis.indexedDB=fake;
 let stop;
 try{
  const store=createWorkspaceStore({contacts:[]});
  const persistence=createWorkspacePersistence({E:{WORKSPACE_SCHEMA_VERSION:2,withoutPersistenceMedia:value=>value},store});
  stop=persistence.start();
  await persistence.readyPromise;
  fake.failNextWrite();
  store.set({contacts:[{id:'old'}]});
  await new Promise(resolve=>setTimeout(resolve,500));
  store.set({contacts:[{id:'new'}]});
  await new Promise(resolve=>setTimeout(resolve,1200));
  assert.equal(fake.data.get('current').state.contacts[0].id,'new');
 }finally{
  stop?.();
  if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;
 }
});
