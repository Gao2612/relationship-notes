import {profileExpiryTime} from './profile-lifecycle.js';
const clipSelfProfile=(value,limit)=>Array.from(String(value||'').trim()).slice(0,limit).join('');
export function normalizeSelfProfile(value={}){
 const source=value&&typeof value==='object'?value:{};
 const list=(input,limit,count)=>Array.isArray(input)?input.map(item=>clipSelfProfile(item,limit)).filter(Boolean).slice(0,count):[];
 const samples=Array.isArray(source.samples)?source.samples.map(item=>({text:clipSelfProfile(typeof item==='string'?item:item?.text,240),note:clipSelfProfile(item?.note,100)})).filter(item=>item.text).slice(0,8):[];
 return {voice:{tone:list(source.voice?.tone,40,6),sentenceLength:['short','medium','long'].includes(source.voice?.sentenceLength)?source.voice.sentenceLength:'medium',emoji:['none','rare','often'].includes(source.voice?.emoji)?source.voice.emoji:'rare',particles:list(source.voice?.particles,30,10)},interests:list(source.interests,80,20),plans:Array.isArray(source.plans)?source.plans.map(item=>({text:clipSelfProfile(typeof item==='string'?item:item?.text,120),when:clipSelfProfile(item?.when,60),planState:['active','completed','cancelled','expired'].includes(item?.planState)?item.planState:'active',expiresAt:typeof item?.expiresAt==='string'?clipSelfProfile(item.expiresAt,60):''})).filter(item=>item.text).slice(0,12):[],boundaries:list(source.boundaries,120,20),samples,updatedAt:typeof source.updatedAt==='string'?source.updatedAt:''};
}
export function makeSelfProfile({tone='',sentenceLength='medium',emoji='rare',particles=[],interests=[],plans=[],boundaries=[],samples=[]}={}){return normalizeSelfProfile({voice:{tone:Array.isArray(tone)?tone:String(tone).split(/\n+/).filter(Boolean),sentenceLength,emoji,particles},interests,plans,boundaries,samples,updatedAt:new Date().toISOString()});}
export function summarizeSelfProfile(value,now=Date.now()){
 const p=normalizeSelfProfile(value);
 return {voice:{...p.voice},interests:p.interests,plans:p.plans.filter(plan=>plan.planState==='active'&&(!plan.expiresAt||!Number.isFinite(profileExpiryTime(plan.expiresAt))||profileExpiryTime(plan.expiresAt)>=now)),boundaries:p.boundaries,samples:p.samples.map(s=>s.text),updatedAt:p.updatedAt};
}

export function changeSelfPlan(profile,index,action,now=Date.now()){
 const current=normalizeSelfProfile(profile);if(!Number.isInteger(index)||!current.plans[index]||!['complete','cancel','expire','reopen','setExpiry'].includes(action?.type))throw Error('计划操作无效。');
 const plans=(Array.isArray(profile?.plans)?profile.plans:[]).map(item=>{const normalized=normalizeSelfProfile({plans:[item]}).plans[0];return normalized?{...(item&&typeof item==='object'?item:{}),...normalized}:null;}).filter(Boolean).slice(0,12);
 const plan=plans[index],states={complete:'completed',cancel:'cancelled',expire:'expired',reopen:'active'},next={...plan};
 if(action.type==='setExpiry'){if(action.expiresAt&&!Number.isFinite(profileExpiryTime(action.expiresAt)))throw Error('请选择有效的到期日期。');next.expiresAt=action.expiresAt||'';}else{next.planState=states[action.type];if(action.type==='reopen')next.expiresAt='';}
 return {...current,...profile,plans:plans.map((item,i)=>i===index?next:item),updatedAt:new Date(now).toISOString()};
}
