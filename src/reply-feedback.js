import {normalizeSelfProfile} from './self-profile.js';
export function approveReplySample(profile,{text,note=''},now=Date.now()){
 const value=String(text||'').trim();if(!value)throw Error('回复样例不能为空。');if(Array.from(value).length>240)throw Error('样例最多240字，请先精简后保存。');
 const current=normalizeSelfProfile(profile);
 return {...current,...profile,samples:[{text:value,note:String(note).trim().slice(0,100)},...current.samples.filter(s=>s.text!==value)].slice(0,8),updatedAt:new Date(now).toISOString()};
}
