// Pure port of the approved prototype parser/extractor; no browser or host access.
import {ensureMessageIds,ensureContactMessageIds} from './message-identity.js';
export class ImportError extends Error { constructor(code,details={}) { super(code); this.code=code; this.details=details; } }
const MAX_BYTES=2*1024*1024,MAX_MESSAGES=10000;
const sampleChat='[2026-10-21 09:00] 我: 你好，最近怎么样？\n[2026-10-21 09:01] 小禾: 我住在杭州。我是一名设计师。我喜欢摄影。我偏好清淡口味。我计划下周去爬山。\n[2026-10-21 09:02] 我: 我住在北京，我喜欢游泳。\n[2026-10-21 09:03] 小禾\n我不喜欢跑步。她住在上海。你喜欢摄影吗？\n[2026-10-21 09:04] 小禾: 今天的云很好看。';
function parseChat(text,extension){
 if(!text.trim())throw new ImportError("parse0");
 if(text.includes('\u0000'))throw new ImportError("parse1");
 text=text.replace(/^\uFEFF/,'');const messages=[];
 const add=(sender,body,timestamp,line,endLine,source)=>{if(typeof sender!=='string'||!sender.trim()||sender.length>100||/[\r\n\u0000-\u001f]/.test(sender))throw new ImportError("parse2");if(typeof body!=='string'||!body.trim())throw new ImportError("parse3");if(timestamp!==undefined&&typeof timestamp!=='string')throw new ImportError("parse4");messages.push({sender:sender.trim(),text:body,timestamp:timestamp||'',line,endLine,source});if(messages.length>MAX_MESSAGES)throw new ImportError("parse5");};
 if(extension==='json'){
  let data;try{data=JSON.parse(text)}catch(e){throw new ImportError("parse6")}
  if(!data||Array.isArray(data)||Object.keys(data).length!==1||!Array.isArray(data.messages))throw new ImportError("parse7");
  // Locate each top-level message object without confusing braces inside quoted strings.
  const start=/"messages"\s*:\s*\[/.exec(text);let depth=0,quoted=false,escaped=false,begin=0,ranges=[];
  for(let i=start.index+start[0].length;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c==='{'){if(depth===0)begin=i;depth++}else if(c==='}'){depth--;if(depth===0)ranges.push([begin,i])}else if(c===']'&&depth===0){if(!/^\s*}\s*$/.test(text.slice(i+1)))throw new ImportError("parse8");break;}}
  data.messages.forEach((m,i)=>{if(!m||Array.isArray(m)||typeof m!=='object'||Object.keys(m).some(k=>!['sender','text','timestamp'].includes(k)))throw new ImportError("parse9");const r=ranges[i]||[0,0];add(m.sender,m.text,m.timestamp,text.slice(0,r[0]).split('\n').length,text.slice(0,r[1]).split('\n').length,'JSON messages['+i+']');});
 }else if(extension==='txt'){
  const lines=text.replace(/\r\n?/g,'\n').split('\n');let current=null;
  const stamp='(?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}(?:[ T]\\d{1,2}:\\d{2}(?::\\d{2})?)?|\\d{1,2}:\\d{2}(?::\\d{2})?)';
  const timed=new RegExp('^(?:\\[('+stamp+')\\]|('+stamp+'))\\s+(.+)$');
  const finish=()=>{if(current){add(current.sender,current.body.join('\n'),current.timestamp,current.line,current.endLine,'TXT');current=null}};
  lines.forEach((line,i)=>{let rest=line,timestamp='',tm=timed.exec(rest);if(tm){timestamp=tm[1]||tm[2];rest=tm[3]}
   const head=/^([^:：\r\n]{1,100})[:：](.*)$/.exec(rest);
   if(head||(tm&&rest.trim())){finish();current={sender:head?head[1]:rest.trim(),body:head&&head[2].trim()?[head[2].replace(/^\s/, '')]:[],timestamp,line:i+1,endLine:i+1};}
   else if(current){current.body.push(line);current.endLine=i+1}
   else if(line.trim())throw new ImportError("line", {line:i+1});
  });finish();
 }else throw new ImportError("parse10");
 if(!messages.length)throw new ImportError("parse11");
 return messages;
}

const cityWords='北京|上海|广州|深圳|杭州|成都|南京|苏州|武汉|西安|重庆|天津|长沙|厦门|青岛|宁波|郑州|合肥|福州|济南|昆明|大连|沈阳|珠海|无锡|佛山|东莞|香港|澳门|台北';
const jobWords='产品经理|设计师|程序员|软件工程师|教师|老师|医生|护士|会计|工程师|编辑|记者|厨师|律师|摄影师|翻译|建筑师|兽医';
const hobbyWords='摄影|散步|阅读|读书|跑步|游泳|爬山|徒步|画画|绘画|音乐|电影|做饭|烘焙|骑行|旅行|羽毛球|篮球|足球|网球|园艺|书法|攀岩|陶艺|看展';
function extractFacts(messages){const facts=[];
 for(const m of messages){for(const part of m.text.split(/[。！？!?；;\n]/)){const quote=part.trim();if(!quote)continue;
  // Deliberately conservative: omit questions, negation, reported/third-person/conditional claims.
  if(/[?？]/.test(m.text)||/^(?:我|本人)/.test(quote)===false||/[不没未无别勿莫非否他她你您]|不是|并非|听说|据说|如果|假如|可能|也许|曾经|以前|过去|不再|想过|例如|比如|假设|梦|[“”「」『』"]/.test(quote))continue;
  const rules=[['city',new RegExp('^(?:我|本人)(?:现在|目前)?(?:住在|居住在|现居|定居在)('+cityWords+')(?:市)?$')],['job',new RegExp('^(?:我|本人)(?:现在|目前)?(?:是(?:一名|个)?|的职业是|从事)('+jobWords+')(?:工作)?$')],['interests',new RegExp('^(?:我|本人)(?:喜欢|爱好是|的兴趣是)('+hobbyWords+')(?:[、和及与]('+hobbyWords+'))*$')],['preferences',/^(?:我|本人)(?:偏好|更喜欢)(清淡口味|清淡饮食|安静的环境|安静的地方|无糖饮料|热饮|冷饮|茶|咖啡)$/],['plans',new RegExp('^(?:我|本人)(?:计划|打算|准备)(今天|明天|后天|这周|本周|下周|这个周末|这周末|下个月|本月)(?:去)?('+hobbyWords+')(?:一次)?$')]];
  for(const [field,rule]of rules){const hit=rule.exec(quote);if(hit){facts.push({field,value:field==='interests'?quote.replace(/^(?:我|本人)(?:喜欢|爱好是|的兴趣是)/,''):field==='plans'?hit[1]+(quote.includes('去')?'去':'')+hit[2]:hit[1],quote,message:m});break}}
 }}return facts;
}

export {MAX_BYTES,MAX_MESSAGES,sampleChat,parseChat,extractFacts};

export const categories=['emotion','social','duty','boundary','uncertain'];
export const initialRules={share:{cat:'emotion',manual:false},follow:{cat:'emotion',manual:false},greeting:{cat:'social',manual:false},work:{cat:'duty',manual:false},delay:{cat:'uncertain',manual:false}};
export const defaultSettings={globalTone:'gentle',globalDiscovery:'auto',contactTone:'inherit',contactDiscovery:'inherit'};
export function validateSettings(input){const result={...defaultSettings};for(const key of Object.keys(result)){const allowed=key.includes('Tone')?['gentle','direct']:['review','auto'];if(key.startsWith('contact'))allowed.push('inherit');if(allowed.includes(input?.[key]))result[key]=input[key];}return result;}
export function effective(settings,key){return settings['contact'+key]==='inherit'?settings['global'+key]:settings['contact'+key];}
export function categoryFor(rules,id,scope='contact'){return (scope==='contact'&&rules.contact[id]||rules.global[id])?.cat||'uncertain';}
export function moveRule(rules,id,cat,scope='contact'){if(!categories.includes(cat)||!rules.global[id]||!['contact','global'].includes(scope))return rules;return {...rules,[scope]:{...rules[scope],[id]:{cat,manual:true}}};}
export function inheritRule(rules,id){const contact={...rules.contact};delete contact[id];return {...rules,contact};}
export function discoverRule(rules,settings){if(rules.global.memory)return rules;return {...rules,global:{...rules.global,memory:{cat:effective(settings,'Discovery')==='auto'?'emotion':'uncertain',manual:false}}};}
export function demoScores(enabled,rules,refused=false){if(!enabled)return {emotional:null,interaction:null,index:null,stop:false};const values=Object.keys(rules.global).map(id=>categoryFor(rules,id));const count=cat=>values.filter(x=>x===cat).length;const emotional=count('emotion')*12-count('boundary')*20,interaction=(count('emotion')+count('social')+count('duty'))*5;return {emotional,interaction,index:Math.max(0,Math.min(100,Math.round(20+.8*emotional+.2*interaction))),stop:refused};}
export function adviceMode(demo,rules,refused,romantic=true){if(!demo)return 'none';if(refused)return 'refusal';if(Object.keys(rules.global).some(id=>categoryFor(rules,id)==='boundary'))return 'boundary';if(!romantic)return 'ordinary';return demoScores(true,rules).emotional<=0?'insufficient':'interest';}

// Immutable transaction state. Every read starts a monotonic epoch. Failed and stale
// reads cannot replace the separately committed profile. Clear invalidates in-flight work.
export function newImportState(){return {epoch:0,pending:null,committed:null,error:null,loading:false};}
export function beginImport(state){return {...state,epoch:state.epoch+1,pending:null,error:null,loading:true};}
export function clearImport(state){return {...newImportState(),epoch:state.epoch+1};}
export function failImport(state,ticket,error){return ticket===state.epoch?{...state,pending:null,loading:false,error}:state;}
export function acceptImport(state,ticket,messages,file,isSample=false){if(ticket!==state.epoch)return state;return {...state,loading:false,error:null,pending:{messages:ensureMessageIds(messages.map((m,index)=>({...m,file,messageIndex:index+1}))),isSample}};}
export function identityReady(pending,self,target){return !!pending&&!!self&&!!target&&self!==target&&pending.messages.some(m=>m.sender===self)&&pending.messages.some(m=>m.sender===target);}
export function commitImport(state,self,target){if(!identityReady(state.pending,self,target))throw new ImportError('identity');const messages=state.pending.messages.filter(m=>m.sender===target);return {...state,committed:{self,target,messages,facts:extractFacts(messages),isSample:state.pending.isSample},error:null};}
export function supportedProfileSummary(fact){
 if(!fact||typeof fact.value!=='string'||typeof fact.quote!=='string')return false;
 // A single activity is not enough to label something as an interest.
 return fact.field!=='interests'||/喜欢|喜爱|爱好|爱玩|爱看|爱吃|不爱|不喜欢|偏好|感兴趣/.test(fact.quote);
}
export function sortChatMessages(messages){
 const time=message=>{const value=String(message.timestamp??'').trim();if(/^\d{10,13}$/.test(value)){const n=Number(value);return n<1e12?n*1000:n;}const local=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);if(local)return Date.UTC(+local[1],+local[2]-1,+local[3],+(local[4]||0)-8,+(local[5]||0),+(local[6]||0));const n=Date.parse(value);return Number.isFinite(n)?n:Infinity;};
 return ensureMessageIds(messages).map((message,index)=>({message,index,time:time(message)})).sort((a,b)=>a.time===b.time?a.index-b.index:a.time-b.time).map(row=>row.message);
}
export function mergeContactImport(contacts,incoming){
 const existing=contacts.find(item=>!item.isSample&&!incoming.isSample&&item.self===incoming.self&&item.target===incoming.target);
 if(!existing){const contact=ensureContactMessageIds(incoming);return {contacts:[...contacts,contact],contact,added:contact.messages.length};}
 const key=m=>JSON.stringify([m.file||m.source||'',m.sender,m.timestamp||'',m.text||'',m.id??null]);
 const counts=new Map();for(const m of existing.messages)counts.set(key(m),(counts.get(key(m))||0)+1);
 const seen=new Map(),extra=incoming.messages.filter(m=>{const k=key(m),n=(seen.get(k)||0)+1;seen.set(k,n);return n>(counts.get(k)||0);});
 const messages=sortChatMessages([...ensureMessageIds(existing.messages),...extra]);
 const contact={...existing,messages,pairCount:messages.filter(m=>m.sender===existing.self||m.sender===existing.target).length,facts:extractFacts(messages.filter(m=>m.sender===existing.target)),mediaAssets:[...(existing.mediaAssets||[]),...(incoming.mediaAssets||[])],selfAvatarFile:existing.selfAvatarFile||incoming.selfAvatarFile,targetAvatarFile:existing.targetAvatarFile||incoming.targetAvatarFile};
 if(extra.length){
  // Imported wall times are China local time; epoch and zoned timestamps need
  // the same timezone conversion before selecting summaries to invalidate.
  const dateKey=message=>{const value=String(message.timestamp??'').trim(),local=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.exec(value);if(local)return local[1]+'-'+local[2].padStart(2,'0')+'-'+local[3].padStart(2,'0');const numeric=/^\d{10,13}$/.test(value)?Number(value):null,date=new Date(numeric===null?value:numeric<1e12?numeric*1000:numeric);if(!Number.isFinite(date.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);};
  const affectedDates=new Set(extra.map(dateKey).filter(Boolean));
  if(existing.timelineAnalysis)contact.timelineAnalysis=Object.fromEntries(Object.entries(existing.timelineAnalysis).filter(([date])=>!affectedDates.has(date)));
  delete contact.timelineAnalysisUpdatedAt;
  contact.profileNeedsRefresh=true;
 }

 return {contacts:contacts.map(item=>item.id===existing.id?contact:item),contact,added:extra.length};
}
export function parseQqText(text){
 const lines=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n'),messages=[];let current=null;
 const finish=()=>{if(!current)return;current.text=current.body.join('\n').trim();delete current.body;if(current.text)messages.push(current);current=null;};
 for(let i=0;i<lines.length;i++){
  const match=/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)\s*$/.exec(lines[i]);
  if(match){finish();const sender=match[3].replace(/\s*[（(](?:\d{5,}|[^()（）\s]+@[^()（）\s]+)[）)]$/,'').trim();if(!sender||sender.length>100)throw new ImportError('parse2');current={sender,timestamp:match[1].replaceAll('/','-')+' '+match[2],body:[],line:i+1,endLine:i+1,source:'QQ TXT'};}
  else if(current){current.body.push(lines[i]);current.endLine=i+1;}
 }
 finish();if(!messages.length)throw new ImportError('parse0');if(messages.length>MAX_MESSAGES)throw new ImportError('parse5');return messages;
}
export function decodeFile(bytes,name,size=bytes.byteLength){if(/\.bak$/i.test(name))throw new ImportError('qqBackup');if(!/\.(txt|json)$/i.test(name))throw new ImportError('parse10');if(size>MAX_BYTES||bytes.byteLength>MAX_BYTES)throw new ImportError('size');let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ImportError('encoding');}if(/\.txt$/i.test(name)&&/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s+[^\r\n]+[（(](?:\d{5,}|[^()（）\s]+@[^()（）\s]+)[）)]\s*$/m.test(text))return parseQqText(text);return parseChat(text,name.split('.').pop().toLowerCase());}
