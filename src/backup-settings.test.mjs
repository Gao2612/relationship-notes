import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as engine from './engine.js';
import * as navigation from './navigation.js';
import * as selfProfile from './self-profile.js';
import * as messageIdentity from './message-identity.js';
import * as persistence from './persistence-schema.js';
import {PERSISTED_KEYS as persistedKeys} from './workspace-persistence.js';

const source=fs.readFileSync(new URL('./workspace.js',import.meta.url),'utf8');
const settingsSource='const ShareScopeView=()=>null,SelfPlanView=()=>null,selected=s=>s.contacts.find(c=>c.id===s.selectedId);'+source.slice(source.indexOf('function SelfProfileEditor({s})'),source.indexOf('  function TabStrip'));
const E={...engine,...navigation,...selfProfile,...persistence,...messageIdentity};
function harness(initial={}){
 let state={...E.createWorkspaceStore().getSnapshot(),models:[],...initial},hooks=[],cursor=0,download;
 const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
 const React={useRef:current=>({current}),useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=initial;return [hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;}];}};
 const set=patch=>{state={...state,...patch};};
 const Settings=new Function('React','h','box','select','button','muted','store','set','persistedKeys','persistableState','downloadObjectUrl','E','assertStorageSpace','cancel','formatChatDayKey','models','URL','document','setTimeout',settingsSource+';return Settings;')(React,h,(title,...children)=>h('section',{},title,...children),(label,value,options,onChange)=>h('select',{label,value,onChange}), (label,onClick,props)=>h('button',{...props,onClick},label),text=>h('p',{},text),{getSnapshot:()=>state},set,persistedKeys,s=>Object.fromEntries(persistedKeys.map(k=>[k,s[k]])),blob=>{download=blob;},E,async()=>{},()=>{},value=>String(value).slice(0,10),()=>{},{createObjectURL(blob){download=blob;return 'blob:test';},revokeObjectURL(){}},{createElement(){return {click(){}};}},()=>{});
 function render(){cursor=0;return Settings({s:state});}
 function nodes(node,out=[]){if(node&&typeof node==='object'){out.push(node);for(const child of node.children||[])nodes(child,out);}return out;}
 const button=label=>nodes(render()).find(n=>n.type==='button'&&n.children.includes(label));
 async function read(record){const file=new File([JSON.stringify(record)],'backup.json',{type:'application/json'}),input=nodes(render()).find(n=>n.props['aria-label']==='选择项目备份');input.props.onChange({target:{files:[file],value:''}});for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
 return {button,read,get state(){return state;},get download(){return download;},render,nodes};
}
const contact=()=>({id:'person',self:'我',target:'对方',messages:[{sender:'对方',text:'你好',timestamp:'2026-02-25 12:00:00'}]});
test('new feedback, expiry and review preferences survive backup without restoring authorization',async()=>{const c={...contact(),topicFeedback:[{suggestionId:'topic-a',status:'discussed',at:1}],profileSummary:[{uid:'f',field:'followup',value:'已处理事项',status:'completed',lifecycleHistory:[{from:'active',to:'completed',at:1}]}]},source=harness({contacts:[c],selectedId:c.id,sharedContactId:c.id,shareScope:{since:'2026-01-01',until:'2026-12-31',limit:30},reviewPreferences:{person:{period:'month',anchor:'2026-11-01'}},selfProfile:{plans:[{text:'旅行',when:'周末',planState:'cancelled',expiresAt:'2026-12-01'}],samples:[{text:'我编辑后的回复',note:'像我'}]}});await source.button('导出完整项目').props.onClick();const record=JSON.parse(await source.download.text()),target=harness();await target.read(record);await target.button('恢复此备份').props.onClick();assert.deepEqual(target.state.contacts[0].topicFeedback,c.topicFeedback);assert.equal(target.state.contacts[0].profileSummary[0].status,'completed');assert.equal(target.state.selfProfile.plans[0].planState,'cancelled');assert.equal(target.state.selfProfile.plans[0].when,'周末');assert.equal(target.state.shareScope.limit,30);assert.equal(target.state.reviewPreferences.person.period,'month');assert.equal(target.state.sharedContactId,'');});
test('media-free backup retains self profile and correction history without binary copies',async()=>{
 const file=new File(['private-image'],'photo.jpg',{type:'image/jpeg'}),c={...contact(),selfAvatarFile:file,targetAvatarData:'data:image/jpeg;base64,AAAA',sessionPhoto:'data:image/jpeg;base64,AAAA',mediaAssets:[{file}],interactionCorrections:[{kind:'question',key:'k',excluded:true,at:123}]};
 c.messages[0].attachments=[{kind:'image',file,fileName:'photo.jpg'}];
 const source=harness({contacts:[c],selfProfile:{voice:{tone:['自然']},samples:[{text:'好呀'}]}});
 source.nodes(source.render()).find(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props.checked===true).props.onChange({target:{checked:false}});
 await source.button('导出完整项目').props.onClick();const record=JSON.parse(await source.download.text()),copy=record.state.contacts[0];
 assert.equal(copy.selfAvatarFile,null);assert.equal(copy.targetAvatarData,null);assert.equal(copy.messages[0].attachments[0].file,null);assert.deepEqual(copy.interactionCorrections,c.interactionCorrections);assert.equal(record.state.selfProfile.samples[0].text,'好呀');
 const target=harness();await target.read(record);await target.button('恢复此备份').props.onClick();assert.equal(target.state.selfProfile.voice.tone[0],'自然');
});

test('complete project export and restore preserves binary avatars, media, summaries and drafts',async()=>{
 const file=new File([new Uint8Array([0,255,13,42])],'avatar.jpg',{type:'image/jpeg',lastModified:123});
 const c={...contact(),targetAvatarFile:file,mediaAssets:[{file}],sessionPhoto:'data:image/png;base64,AAAA',profileSummary:[{field:'interests',value:'喜欢花',quote:'我喜欢花'}],timelineAnalysis:{'2026-02-25':{summary:'聊花'}}};
 const source=harness({contacts:[c],selectedId:c.id,draft:'草稿',drafts:{person:{draft:'保存草稿'}},goals:[{id:'g',title:'买花',contactId:c.id}],displayFontSize:17,photoFit:'contain'});
 await source.button('导出完整项目').props.onClick();const backup=JSON.parse(await source.download.text());
 const target=harness();await target.read(backup);assert.ok(target.button('恢复此备份'));await target.button('恢复此备份').props.onClick();
 const restored=target.state.contacts[0];assert.equal(restored.targetAvatarFile.name,'avatar.jpg');assert.deepEqual([...new Uint8Array(await restored.targetAvatarFile.arrayBuffer())],[0,255,13,42]);assert.deepEqual([...new Uint8Array(await restored.mediaAssets[0].file.arrayBuffer())],[0,255,13,42]);assert.equal(restored.sessionPhoto,c.sessionPhoto);assert.deepEqual(restored.profileSummary,c.profileSummary);assert.deepEqual(restored.timelineAnalysis,c.timelineAnalysis);assert.equal(target.state.draft,'草稿');assert.equal(target.state.drafts.person.draft,'保存草稿');assert.equal(target.state.displayFontSize,17);assert.equal(target.state.photoFit,'contain');assert.equal(target.state.goals[0].title,'买花');
});

test('invalid schema and duplicated contact IDs leave the current project untouched',async()=>{
 const c=contact(),current=harness({contacts:[c]});
 for(const record of [{format:'other',version:1,state:{contacts:[],goals:[]}},{format:'relationship-notes-backup',version:2,state:{contacts:[],goals:[]}},{format:'relationship-notes-backup',version:1,state:{contacts:[c,c],goals:[]}},{format:'relationship-notes-backup',version:1,state:{contacts:[{...c,messages:[{sender:'我'}]}],goals:[]}}]){await current.read(record);assert.equal(current.button('恢复此备份'),undefined);assert.strictEqual(current.state.contacts[0],c);}
});

test('restoring an older backup resets omitted persisted fields and clears transient undo contexts',async()=>{
 const previous=contact(),target=harness({contacts:[previous],draftVersions:[{text:'旧候选'}],previousDraft:'旧版',drafts:{person:{draft:'旧稿'}},undoImportContacts:[previous],undoMessageContact:previous,replyContextMessages:previous.messages});
 await target.read({format:'relationship-notes-backup',version:1,state:{contacts:[],goals:[]}});await target.button('恢复此备份').props.onClick();
 const defaults=E.createWorkspaceStore().getSnapshot();assert.deepEqual(target.state.draftVersions,defaults.draftVersions);assert.equal(target.state.previousDraft,defaults.previousDraft);assert.deepEqual(target.state.drafts,defaults.drafts);assert.equal(target.state.undoImportContacts,null);assert.equal(target.state.undoMessageContact,null);assert.equal(target.state.replyContextMessages,null);assert.equal(target.state.selectedId,'');
 await target.button('撤销本次恢复').props.onClick();assert.equal(target.state.contacts[0].id,'person');assert.equal(target.state.drafts.person.draft,'旧稿');
});

test('restoring and re-exporting retains future state metadata without restoring a shared-contact authorization',async()=>{
 const target=harness();await target.read({format:'relationship-notes-backup',version:1,state:{contacts:[],goals:[],futurePreference:{enabled:true},sharedContactId:'private'}});await target.button('恢复此备份').props.onClick();assert.deepEqual(target.state.persistenceExtensions.futurePreference,{enabled:true});assert(!target.state.persistenceExtensions.sharedContactId);await target.button('导出完整项目').props.onClick();const record=JSON.parse(await target.download.text());assert.equal(record.schemaVersion,2);assert.deepEqual(record.state.futurePreference,{enabled:true});assert(!record.state.sharedContactId);
});
