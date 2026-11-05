import {normalizeSelfProfile} from './self-profile.js';
import {profileMessageId} from './profile-lifecycle.js';
import {ensureContactMessageIds} from './message-identity.js';

export const WORKSPACE_SCHEMA_VERSION=2;
const recordObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function migrateWorkspaceState(state,version=1){
 if(!recordObject(state))throw new Error('本机数据格式无效。');if(![1,2].includes(version))throw Object.assign(new Error('不支持此数据版本，请使用兼容版本的关系手记。'),{code:'UNSUPPORTED_SCHEMA'});
 const raw=recordObject(state.selfProfile)?state.selfProfile:{},normalized=normalizeSelfProfile(raw);
 const preserveList=(key,limit)=>(Array.isArray(raw[key])?raw[key]:[]).map(item=>{const parsed=normalizeSelfProfile({[key]:[item]})[key][0];return parsed?{...(recordObject(item)?item:{}),...parsed}:null;}).filter(Boolean).slice(0,limit);
 const selfProfile={...raw,...normalized,voice:{...(recordObject(raw.voice)?raw.voice:{}),...normalized.voice},samples:preserveList('samples',8),plans:preserveList('plans',12)};
 // Spread the original state: forward-compatible fields, contact metadata and
 // correction history survive migration without changing confirmation states.
 return {...state,selfProfile,...(Array.isArray(state.contacts)?{contacts:state.contacts.map(ensureContactMessageIds)}:{})};
}
export function migrateWorkspaceRecord(record){if(!recordObject(record))throw new Error('本机数据格式无效。');const version=record.schemaVersion??1;return {...record,schemaVersion:WORKSPACE_SCHEMA_VERSION,state:migrateWorkspaceState(record.state,version)};}
export function migrateBackupRecord(record){if(!recordObject(record)||record.format!=='relationship-notes-backup'||record.version!==1)throw new Error('请选择关系手记导出的完整项目备份。');return {...record,schemaVersion:WORKSPACE_SCHEMA_VERSION,state:migrateWorkspaceState(record.state,record.schemaVersion??1)};}
export function persistenceExtensions(state,knownKeys){return Object.fromEntries(Object.entries(state||{}).filter(([key])=>!knownKeys.includes(key)&&!['persistenceExtensions','sharedContactId','profileBridgeStatus','__proto__','constructor','prototype'].includes(key)));}
export function withoutPersistenceMedia(record){
 const state=record.state||{},contacts=(state.contacts||[]).map(contact=>({...contact,selfAvatarFile:null,targetAvatarFile:null,selfAvatarData:null,targetAvatarData:null,sessionPhoto:null,mediaAssets:[],messages:(contact.messages||[]).map(message=>({...message,attachments:(message.attachments||[]).map(attachment=>({...attachment,file:null}))}))}));
 return {...record,state:{...state,contacts}};
}
export function resolveProfileResponseFact(fact,requestMessages,currentMessages,target){
 const captured=requestMessages.get(fact.id);if(!captured||typeof fact.quote!=='string'||!fact.quote.trim()||!captured.text.includes(fact.quote))return null;
 const matches=currentMessages.filter(message=>String(profileMessageId(message))===String(captured.stableId)&&message.sender===target&&message.text===captured.text&&String(message.timestamp)===String(captured.timestamp));
 if(matches.length!==1)return null;return {...fact,message:matches[0],sourceMessageIds:[captured.stableId]};
}
