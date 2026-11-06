// Media side-effect module: the object URL registry, media-kind classification and
// the revocable download helper used by the backup export. Imports nothing from workspace.js.
export const MEDIA_LABELS={image:'图片',video:'视频',audio:'语音',sticker:'表情',file:'文件'};
// One object URL per File/Blob for the lifetime of the page; URLs are stable across renders.
export function createMediaUrls(){
 const urls=new Map();
 const resolve=file=>{
  if(!file)return '';
  if(!urls.has(file))urls.set(file,URL.createObjectURL(file));
  return urls.get(file);
 };
 // 保留当前状态和撤销快照引用的媒体，释放已移除的资源。
 resolve.retain=root=>{
  const retained=new Set(),seen=new WeakSet();
  const visit=value=>{
   if(!value||typeof value!=='object'||seen.has(value))return;
   seen.add(value);
   if(value instanceof Blob){retained.add(value);return;}
   for(const child of Object.values(value))visit(child);
  };
  visit(root);
  for(const [file,url] of urls){
   if(!retained.has(file)){URL.revokeObjectURL(url);urls.delete(file);}
  }
 };
 resolve.dispose=()=>{
  for(const url of urls.values())URL.revokeObjectURL(url);
  urls.clear();
 };
 return resolve;
}
export  const mediaKind=message=>{for(const value of [...(message?.attachments||[]).map(item=>item.kind),message?.typeName,message?.type]){const kind=String(value??'').toLowerCase();if(kind==='3'||kind.includes('image')||kind.includes('图片')||kind.includes('图像'))return'image';if(kind==='43'||kind.includes('video')||kind.includes('视频'))return'video';if(kind==='34'||kind.includes('audio')||kind.includes('voice')||kind.includes('语音'))return'audio';if(kind==='47'||kind.includes('sticker')||kind.includes('emoji')||kind.includes('表情'))return'sticker';}return null;};
// Triggers a browser download from an in-memory blob and revokes the URL afterwards.
export function downloadObjectUrl(blob,filename,revokeDelay=60000){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),revokeDelay);
}
