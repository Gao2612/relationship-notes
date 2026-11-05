// Browser-side, opt-in snapshot builder. Never include media or other contacts.
import {profileMessageId,isProfileFactCurrent,profileExpiryTime} from './profile-lifecycle.js';
import {selectShareScopeMessages} from './share-scope.js';
const bridgeClip=(v,n)=>String(v??'').slice(0,n);
const bridgeFields=new Set(['city','job','daily','recent','agreement','interests','preferences','style','boundary','followup','inference']);
export function profileBridgeMessageId(message){return String(profileMessageId(message)).slice(0,200);}
export function createProfileBridgeSnapshot(contact,options={}){
 const seen=new Set(),messages=[];
 for(const m of selectShareScopeMessages(contact,options).messages){const id=profileBridgeMessageId(m);if(seen.has(id))continue;seen.add(id);messages.push({id,sender:bridgeClip(m.sender,100),text:bridgeClip(m.text,2000),timestamp:bridgeClip(m.timestamp,100)});}
 const facts=(contact.profileSummary||[]).filter(f=>bridgeFields.has(f.field)&&isProfileFactCurrent(f)&&(f.confirmed===true||f.manual===true)).slice(0,100).map((f,i)=>({id:bridgeClip(f.uid||'fact-'+i,200),field:f.field,value:bridgeClip(f.value,1000),quote:bridgeClip(f.quote,1000),sourceMessageIds:(f.sourceMessageIds||[]).slice(0,20).map(id=>bridgeClip(id,200)),confidence:Number.isFinite(f.confidence)?Math.max(0,Math.min(1,f.confidence)):null,confirmed:true,...(Number.isFinite(profileExpiryTime(f.expiresAt))?{expiresAt:f.expiresAt}:{})}));
 return {contact:{id:bridgeClip(contact.id,200),self:bridgeClip(contact.self,100),target:bridgeClip(contact.target,100)},facts,messages};
}
