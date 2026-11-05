import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspacePersistence} from './workspace-persistence.js';
import {createWorkspaceStore} from './navigation.js';

// Minimal IndexedDB stub: one object store, request succeeding on a microtask.
function createFakeIndexedDB(){
 const data=new Map();
 const db={
  objectStoreNames:{contains:name=>name==='workspace'},
  createObjectStore(){},
  close(){},
  transaction(){
   const tx={error:null,oncomplete:null,onerror:null,onabort:null};
   const complete=()=>queueMicrotask(()=>tx.oncomplete?.());
   tx.objectStore=()=>({
    get(key){const request={result:data.get(key)??null,error:null,onsuccess:null,onerror:null};queueMicrotask(()=>request.onsuccess?.());return request;},
    put(value,key){data.set(key,value);complete();},
    delete(key){data.delete(key);complete();},
   });
   return tx;
  },
 };
 return {data,open(){const request={result:db,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};queueMicrotask(()=>request.onsuccess?.());return request;}};
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
