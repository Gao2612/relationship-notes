import test from 'node:test';
import assert from 'node:assert/strict';
import {boundary,negative} from './interaction-boundary.js';

test('直接停止联系请求包含礼貌问句，拒绝不会被问号抹掉',()=>{
 for(const text of ['不要再联系我','请别再发消息给我','我不想见面','你不要再打扰我','你可以不要再联系我吗？','能不能别再给我发消息？','你能不能不要再联系我？','我们不要再联系了']){
  assert.equal(boundary(text),true,text);
  assert.equal(negative(text),true,text);
 }
});

test('询问对方意愿、转述和引用不成为发送者自己的边界',()=>{
 for(const text of ['你是不是不想见面？','你是否不喜欢我？','是不是你不想聊天？','她说不要再联系我','朋友说：我不想见面。','“不要再联系我”是电影台词','他说了「不要再联系我」']){
  assert.equal(boundary(text),false,text);
  assert.equal(negative(text),false,text);
 }
 assert.equal(boundary('她说不要再联系我。我不想见面。'),true);
});

test('双重否定安抚与过去已经结束的负向状态不当作当前拒绝',()=>{
 for(const text of ['我不是不喜欢你','我没有不想见你','不是不要联系我','我并非不想聊天','我没有说过不喜欢你','我以前不喜欢你，现在喜欢你了','不喜欢你是以前的事了','之前我不想见你，现在我很想见你','我对你没有生气','我并没有觉得和你聊天很烦']){
  assert.equal(boundary(text),false,text);
  assert.equal(negative(text),false,text);
 }
 for(const text of ['我不是不喜欢你。但是不要再联系我。','以前我不想见你，现在我不想继续联系','不是不要联系我，但请别再发消息'])assert.equal(boundary(text),true,text);
});

test('对方案或行为的不喜欢与明确个人拒绝区分',()=>{
 for(const text of ['我不喜欢你的方案','我不喜欢你这样熬夜','我不想见你妈妈','我不想联系客户','我不想继续工作','今天项目让我很生气','你不喜欢我吗？'])assert.equal(negative(text),false,text);
 for(const text of ['不喜欢你','我不想见你','不想和你聊','跟你聊天让我不舒服','你让我很生气'])assert.equal(negative(text),true,text);
});

test('同条消息独立正向和后续边界同时存在时仍保留边界',()=>{
 for(const text of ['我喜欢你。你不要再打扰我','我不是不喜欢你，但不要再联系我','我不想聊天，你明天几点下班？']){
  assert.equal(boundary(text),true,text);
  assert.equal(negative(text),true,text);
 }
});
