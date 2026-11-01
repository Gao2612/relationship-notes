import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWechatJson, selectBestWechatExport, normalizeRelativeMediaPath, linkWechatMediaFiles } from './wechat-export.js';

test('parses the full ExportWeChat html.json array and retains message media references',()=>{
  const input=JSON.stringify([
    {sender:'wxid-a',display_name:'Alex',is_send:false,timestamp:1710000000,type:1,text:'hello'},
    {sender:'wxid-a',display_name:'Alex',is_send:false,timestamp:1710000001,type:3,text:'[image]',path:'image\\abc',thumb_path:'image\\abc_thumb',file_name:'abc.jpg',file_type:'image/jpeg',file_size:32},
    {sender:'wxid-me',display_name:'Me',is_send:true,timestamp:1710000002,type:43,text:'[video]',path:'video\\clip',file_name:'clip.mp4',duration:4},
    {sender:'wxid-a',display_name:'Alex',is_send:false,timestamp:1710000003,type:34,text:'[voice]',path:'voice\\voice.mp3',duration:2},
  ]);
  const messages=parseWechatJson(input);
  assert.equal(messages.length,4);
  assert.deepEqual(messages[0],{sender:'Alex',senderId:'wxid-a',isSender:false,timestamp:1710000000,text:'hello',type:1,typeName:'text',attachments:[],index:1});
  assert.deepEqual(messages[1].attachments,[
    {kind:'image',path:'image/abc',thumbnailPath:'image/abc_thumb',fileName:'abc.jpg',mimeType:'image/jpeg',size:32,duration:null},
  ]);
  assert.equal(messages[2].attachments[0].kind,'video');
  assert.equal(messages[2].attachments[0].duration,4);
  assert.equal(messages[3].attachments[0].kind,'audio');
});

test('parses the standalone JSON schema without inventing media paths',()=>{
  const messages=parseWechatJson(JSON.stringify([
    {display_name:'Alex',is_sender:true,time:'2026-10-29 10:00',timestamp:1793268000,type:3,type_name:'图片',content:'[图片]'},
  ]));
  assert.equal(messages.length,1);
  assert.equal(messages[0].sender,'Alex');
  assert.equal(messages[0].isSender,true);
  assert.equal(messages[0].typeName,'图片');
  assert.deepEqual(messages[0].attachments,[]);
});

test('rejects unsafe media paths but preserves every valid record',()=>{
  assert.equal(normalizeRelativeMediaPath('image\\sub\\x.jpg'),'image/sub/x.jpg');
  for(const path of ['../secret.jpg','C:\\private.jpg','\\\\host\\share.jpg','']) assert.equal(normalizeRelativeMediaPath(path),null);
  assert.throws(()=>parseWechatJson(JSON.stringify([{sender:'x',text:'a'},{sender:'y',text:'b',path:'../secret'}])),/path|attachment/i);
});

test('selects the richest full export sidecar instead of summing duplicate exports',()=>{
  const files=[
    {name:'chat.html.json',text:JSON.stringify([{sender:'x',text:'old'}])},
    {name:'chat.json',text:JSON.stringify([{sender:'x',text:'bare'}])},
    {name:'chat (2).html.json',lastModified:10,text:JSON.stringify([{sender:'x',text:'a'},{sender:'x',text:'b',path:'image/a'}])},
    {name:'chat (3).html.json',lastModified:20,text:JSON.stringify([{sender:'x',text:'a'},{sender:'x',text:'b',path:'image/b'}])},
  ];
  const selected=selectBestWechatExport(files);
  assert.equal(selected.messages.length,2);
  assert.equal(selected.name,'chat (3).html.json');
});

test('rejects malformed and unbounded imports',()=>{
  assert.throws(()=>parseWechatJson('not json'));
  assert.throws(()=>parseWechatJson(JSON.stringify({messages:[]})));
  assert.throws(()=>parseWechatJson(JSON.stringify([{sender:'x',text:'a'},{sender:'y',text:'b'}]),{maxMessages:1}));
});

test('links local media by ExportWeChat path or unique basename without reading it',()=>{
  const messages=parseWechatJson(JSON.stringify([
    {sender:'wxid-a',type:3,path:'image/a',file_name:'a'},
    {sender:'wxid-a',type:43,path:'video/clip.mp4',file_name:'clip.mp4'},
    {sender:'wxid-a',type:34,path:'voice/missing.mp3',file_name:'missing.mp3'},
  ]));
  const image={name:'a.jpg',webkitRelativePath:'Export/image/a.jpg'};
  const video={name:'clip.mp4',webkitRelativePath:'Export/video/clip.mp4'};
  const result=linkWechatMediaFiles(messages,[image,video]);
  assert.equal(result.linked,2);assert.equal(result.missing,1);
  assert.equal(result.messages[0].attachments[0].file,image);
  assert.equal(result.messages[1].attachments[0].file,video);
  assert.equal(result.messages[2].attachments[0].file,null);
});

test('does not guess between duplicate attachment basenames',()=>{
  const messages=parseWechatJson(JSON.stringify([{sender:'x',type:3,path:'image/a.jpg',file_name:'a.jpg'}]));
  const files=[{name:'a.jpg',webkitRelativePath:'one/image/a.jpg'},{name:'a.jpg',webkitRelativePath:'two/image/a.jpg'}];
  const result=linkWechatMediaFiles(messages,files);
  assert.equal(result.linked,0);assert.equal(result.missing,1);
});
