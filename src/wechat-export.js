// Pure parser for ExportWeChat JSON exports. It never loads files or calls a model.
const WECHAT_MAX_MESSAGES=10000;
const WECHAT_MAX_BYTES=25*1024*1024;
const IMAGE_TYPES=new Set([3,'3','image','Image','图片']);
const VIDEO_TYPES=new Set([43,'43','video','Video','视频']);
const AUDIO_TYPES=new Set([34,'34','voice','audio','Voice','语音']);
const STICKER_TYPES=new Set([47,'47','sticker','emoji','表情包']);

function safeText(value,max=200000){return typeof value==='string'&&value.length<=max?value:'';}
function boolish(value){return value===true||value===1||value==='1'||value==='true';}

export function normalizeRelativeMediaPath(value){
 if(typeof value!=='string'||!value.trim()||value.length>2048||/[\u0000-\u001f]/.test(value))return null;
 const path=value.trim().replace(/\\/g,'/').replace(/\/+/g,'/').replace(/^(?:\.\/)+/,'');
 if(!path||path.startsWith('/')||/^[A-Za-z]:/.test(path))return null;
 const parts=path.split('/');
 if(parts.some(part=>!part||part==='.'||part==='..'))return null;
 return parts.join('/');
}

function attachmentFor(record){
 const rawPath=record.path,rawThumb=record.thumb_path;
 const path=rawPath==null||rawPath===''?null:normalizeRelativeMediaPath(rawPath);
 const thumbnailPath=rawThumb==null||rawThumb===''?null:normalizeRelativeMediaPath(rawThumb);
 if(rawPath&& !path)throw new TypeError('Unsafe attachment path in export.');
 if(rawThumb&& !thumbnailPath)throw new TypeError('Unsafe thumbnail path in export.');
 const type=record.type;
 let kind=IMAGE_TYPES.has(type)?'image':VIDEO_TYPES.has(type)?'video':AUDIO_TYPES.has(type)?'audio':STICKER_TYPES.has(type)?'sticker':'file';
 const mimeType=safeText(record.file_type,120),fileName=safeText(record.file_name,512);
 const mime=mimeType.toLowerCase(),name=fileName.toLowerCase();
 if(kind==='file'){
  if(mime.startsWith('image/')||/\.(?:jpe?g|png|gif|webp|bmp|heic)$/.test(name))kind='image';
  else if(mime.startsWith('video/')||/\.(?:mp4|mov|m4v|webm|mkv)$/.test(name))kind='video';
  else if(mime.startsWith('audio/')||/\.(?:mp3|m4a|wav|aac|amr|ogg)$/.test(name))kind='audio';
 }
 if(!path&&!thumbnailPath&&!fileName&&!mimeType)return null;
 const size=Number.isFinite(record.file_size)?record.file_size:null;
 const duration=Number.isFinite(record.duration)?record.duration:null;
 return [{kind,path,thumbnailPath,fileName:fileName||null,mimeType:mimeType||null,size,duration}];
}

export function parseWechatJson(input,{maxBytes=WECHAT_MAX_BYTES,maxMessages=WECHAT_MAX_MESSAGES}={}){
 if(typeof input!=='string')throw new TypeError('Export must be UTF-8 JSON text.');
 if(new TextEncoder().encode(input).byteLength>maxBytes)throw new RangeError('导出文件超过大小限制。');
 let data;
 try{data=JSON.parse(input)}catch{throw new SyntaxError('Export JSON is malformed.');}
 if(!Array.isArray(data))throw new TypeError('ExportWeChat JSON must be a top-level array.');
 if(data.length===0||data.length>maxMessages)throw new RangeError('消息数量为空或超过上限。');
 return data.map((record,index)=>{
  if(!record||typeof record!=='object'||Array.isArray(record))throw new TypeError(`Message ${index+1} is not an object.`);
  const name=safeText(record.display_name,200).trim();
  const senderId=safeText(record.sender,200).trim();
  const sender=name||senderId||'未知发言人';
  const rawType=record.type??'';
  let typeName=safeText(record.type_name,80);
  if(!typeName){
   if(IMAGE_TYPES.has(rawType))typeName='image';
   else if(VIDEO_TYPES.has(rawType))typeName='video';
   else if(AUDIO_TYPES.has(rawType))typeName='audio';
   else if(STICKER_TYPES.has(rawType))typeName='sticker';
   else if(rawType===1||rawType==='1')typeName='text';
   else typeName='';
  }
  const timestamp=record.timestamp??record.StrTime??record.time??'';
  const text=safeText(record.text??record.content??record.display_content??record.desc??'',200000);
  return {
   sender,senderId:senderId||null,
   isSender:boolish(record.is_send??record.is_sender),
   timestamp,text,type:rawType,typeName,
   attachments:attachmentFor(record)||[],
   index:index+1,
  };
 });
}

/** Extract the complete ExportWeChat transcript embedded in its HTML export.
 * The export's visible DOM is paginated, so only the serialized chatMessages
 * array is authoritative. Never execute HTML scripts while importing.
 */
export function parseWechatHtml(input,{maxBytes=WECHAT_MAX_BYTES,maxMessages=WECHAT_MAX_MESSAGES}={}){
 if(typeof input!=='string')throw new TypeError('Export must be UTF-8 HTML text.');
 if(new TextEncoder().encode(input).byteLength>maxBytes)throw new RangeError('导出文件超过大小限制。');
 const scripts=input.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)||[];
 for(const script of scripts){
  const assignment=/\b(?:const|let|var)\s+chatMessages\s*=\s*\[/i.exec(script);
  if(!assignment)continue;
  const start=assignment.index+assignment[0].lastIndexOf('[');let depth=0,quoted=false,escaped=false;
  for(let i=start;i<script.length;i++){
   const c=script[i];
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"'){quoted=true;continue;}
   if(c==='[')depth++;
   else if(c===']'&&--depth===0)return parseWechatJson(script.slice(start,i+1),{maxBytes,maxMessages});
  }
  throw new SyntaxError('HTML 中的聊天数组不完整。');
 }
 throw new TypeError('HTML 中没有找到完整的 ExportWeChat chatMessages 数据。');
}

export function selectBestWechatExport(files,options={}){
 if(!Array.isArray(files)||!files.length)throw new TypeError('Select an export JSON file.');
 const candidates=[];
 for(const file of files){
  if(!file||typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.json')||typeof file.text!=='string')continue;
  try{
   const messages=parseWechatJson(file.text,options);
   const mediaCount=messages.reduce((sum,m)=>sum+m.attachments.length,0);
   const sidecar=/\.html\.json$/i.test(file.name);
   candidates.push({name:file.name,messages,mediaCount,sidecar,lastModified:Number.isFinite(file.lastModified)?file.lastModified:0});
  }catch{/* Ignore incomplete/truncated variants; select a valid complete export. */}
 }
 if(!candidates.length)throw new TypeError('No complete ExportWeChat JSON export was found.');
 candidates.sort((a,b)=>b.messages.length-a.messages.length||b.mediaCount-a.mediaCount||Number(b.sidecar)-Number(a.sidecar)||b.lastModified-a.lastModified||a.name.localeCompare(b.name));
 return candidates[0];
}

function mediaFilePath(file){
 const value=typeof file.webkitRelativePath==='string'&&file.webkitRelativePath?file.webkitRelativePath:file.name;
 return normalizeRelativeMediaPath(value);
}

/** Attach selected local file handles to parsed records without reading media bytes. */
export function linkWechatMediaFiles(messages,files){
 const exact=new Map(),basename=new Map(),stems=new Map();
 const addUnique=(map,key,file)=>{if(!map.has(key))map.set(key,file);else map.set(key,null);};
 for(const file of files||[]){
  const path=mediaFilePath(file);if(!path)continue;
  const key=path.toLocaleLowerCase();addUnique(exact,key,file);
  const base=path.split('/').at(-1).toLocaleLowerCase();
  addUnique(basename,base,file);
  const dot=base.lastIndexOf('.'),stem=dot>0?base.slice(0,dot):base;
  addUnique(stems,key.slice(0,key.length-base.length)+stem,file);
  addUnique(stems,stem,file);
 }
 let linked=0,missing=0;
 const records=messages.map(message=>({...message,attachments:message.attachments.map(attachment=>{
  const candidates=[attachment.path,attachment.thumbnailPath,attachment.fileName].filter(Boolean);
  let file=null;
  for(const candidate of candidates){
   const path=normalizeRelativeMediaPath(candidate);if(path){const key=path.toLocaleLowerCase();file=exact.get(key)||stems.get(key);if(!file){const parts=path.split('/');for(let i=1;i<parts.length&&!file;i++){const suffix=parts.slice(i).join('/').toLocaleLowerCase();file=exact.get(suffix)||stems.get(suffix);}}}
   if(file)break;
   const base=(candidate.replace(/\\/g,'/').split('/').at(-1)||'').toLocaleLowerCase();
   if(base){const found=basename.get(base);if(found){file=found;break;}}
  }
  if(file)linked++;else missing++;
  return {...attachment,file:file||null};
 })}));
 return {messages:records,linked,missing};
}
