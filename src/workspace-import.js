// Import-queue side-effect module: polls the DSH host queue, imports pending conversations,
// persists them before acknowledging, and retries when the acknowledgement fails.
// Extracted from workspace.js; it imports nothing from it.
export function startImportQueue({E,store,set,persistence,savedDraft,resetDraft,cancel}){
 const seen=new Set(),pendingAck=new Set();let stopped=false,busy=false,abort=null;
 const poll=async()=>{
 if(stopped||busy)return;busy=true;abort=new AbortController();
 try{
 const response=await fetch('api/relationship-notes/import/read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:abort.signal});
 if(!response.ok)return;const data=await response.json();if(stopped||!data.ok)return;
 if(!persistence.ready())await persistence.readyPromise;if(stopped)return;const existingVersions=new Set(store.getSnapshot().contacts.map(c=>c.importVersion).filter(Boolean));for(const value of data.values||[])if(existingVersions.has(value.version)){seen.add(value.version);pendingAck.add(value.version);}const imported=E.consumeImports(data.values,seen,E.extractFacts);
 if(imported.length){for(const contact of imported)if(contact.importVersion)pendingAck.add(contact.importVersion);const s=store.getSnapshot(),drafts={...(s.drafts||{})};if(s.selectedId)drafts[s.selectedId]=savedDraft(s);cancel();set({contacts:[...s.contacts,...imported],selectedId:imported.at(-1).id,drafts,...resetDraft(),status:'已从 DSH 对话导入 '+imported.length+' 份聊天记录。'});}
 if(pendingAck.size){await persistence.flush();if(stopped)return;const versions=[...pendingAck];const ack=await fetch('api/relationship-notes/import/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versions}),signal:abort.signal});if(ack.ok){for(const version of versions)pendingAck.delete(version);}else if(!stopped){const result=await ack.json().catch(()=>null);set({status:'聊天已导入，但宿主队列确认失败；将自动重试：'+(result?.error||'稍后重试。')});}}
 }catch(error){if(!stopped&&error.name!=='AbortError')set({status:'聊天导入尚未确认保存，将自动重试。'});}finally{busy=false;abort=null;}
 };
 poll();const timer=setInterval(poll,3000);
 return ()=>{stopped=true;clearInterval(timer);abort?.abort();};
}
