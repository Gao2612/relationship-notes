import {shanghaiTimestamp} from './shared/dates.js';
const WORK=/权限|人事|交接|招聘|离职|报销|审批|工资|考勤|项目|客户|合同|工作|上班|加班/;
const DAILY=/吃|饭|香|辣|美味|旅行|旅游|出去玩|电影|音乐|运动|学校|休息|睡|天气|下雨|短袖|照片|拍|朋友圈/;

export function scoringMessage(message){
 const type=String(message.type??'');
 if(type==='10000'||/系统消息/.test(message.typeName||''))return false;
 if(type&&type!=='1'&&!/引用/.test(message.typeName||'')&&type!=='244813135921')return false;
 return !/^(?:【[^】]+】|\[[^\]]+\])$/.test(String(message.text??'').trim());
}

export function interactionScene(text){
 const work=WORK.test(text),daily=DAILY.test(text);
 if(work&&daily)return 'mixed';
 if(work)return 'work';
 if(daily)return 'daily';
 return 'unknown';
}

export function sceneGroups(messages){
 const groups={work:[],daily:[],mixed:[],unknown:[]};
 let segment=[],previous=null;
 const flush=()=>{
  if(!segment.length)return;
  groups[interactionScene(segment.map(message=>message.text).join(' '))].push(...segment);
  segment=[];
 };
 for(const message of messages.filter(scoringMessage)){
  const time=shanghaiTimestamp(message.timestamp);
  if(time===null||previous===null||time<previous||time-previous>=7200000)flush();
  segment.push(message);
  previous=time;
 }
 flush();
 return groups;
}

function terms(text){
 const result=new Set();
 for(const part of String(text).match(/[\u4e00-\u9fff]{2,}/g)||[]){
  for(let i=0;i<part.length-1;i++){
   const term=part.slice(i,i+2);
   if(!/^(我|你|的|了|是|有|不|也|就|这|那|个|啊|呀)/.test(term))result.add(term);
  }
 }
 return result;
}

export function replyContext(previous,text,previousQuestion){
 const body=String(text).trim();
 const acknowledgment=/^(?:可以|行|好|好的|嗯+|对|是|是呀|是了|okk?|收到|没问题)[!！。\s]*$/i.test(body);
 const yesNo=/吗|嘛|是否|要不要|能不能|可不可以|会不会|是不是|有没有|行不行|好不好/.test(previous);
 const affirmative=acknowledgment&&(yesNo||/试试|尝尝|尝一尝|一起|要不|帮我|麻烦|请|看看|发给/.test(previous));
 const prior=terms(previous),current=terms(body);
 const events=[/出门|出发|离开|到达|见面|集合/,/买|购买|下单|购物/,/吃|喝|用餐/,/睡|起床|休息/,/开会|会议/,/完成|做好|交付|审批|处理/,/下雨|下雪|天气/];
 const requested=events.filter(event=>event.test(previous));
 const stated=events.filter(event=>event.test(body));
 const relatedEvent=!requested.length||!stated.length||requested.some(event=>event.test(body));
 const topics=[
  /吃|饭|面条|辣椒|食物|火锅|香|辣|美味|好吃/,
  /拍|照片|摄影|相机|录像|视频/,
  /人多|排队|拥挤|客流|游客|人少/,
  /歌曲|音乐|歌手|唱|专辑/
 ];
 const continuation=[...current].some(term=>prior.has(term))||topics.some(topic=>topic.test(previous)&&topic.test(body));
 let answer=false;
 if(previousQuestion){
  if(/几点|什么时候|啥时候|何时/.test(previous))answer=/[0-9零一二三四五六七八九十两半]+\s*(?:点|时|分|天|号|月)|今天|明天|后天|早上|中午|下午|晚上|周[一二三四五六日天末]|星期/.test(body);
  else if(/在哪|哪里|哪儿|去哪|什么地方/.test(previous))answer=/家里|公司|学校|饭店|餐厅|商场|车站|地铁|[\u4e00-\u9fff]{2,}(?:路|街|市|县|区|店)/.test(body);
  else if(/多少|几个|几人|几位/.test(previous))answer=/[0-9零一二三四五六七八九十百千万两]+/.test(body);
  else if(yesNo)answer=acknowledgment||/^(?:不|没|有|能|不能|会|不会|是|不是|去|不去|要|不要|我不|我会|我去|我可以)/.test(body)||continuation;
  else answer=continuation||/^(?:因为|由于|主要是|原因是)/.test(body);
 }
 return {answer:answer&&relatedEvent,affirmative,continuation};
}


export function directedRequest(text){
 return /^我(?:也|还|就|只是)?(?:想|希望|要求|建议|让|请)(?:让|请)?你(?:早点|晚点|先|再|尽快|赶紧|今天|明天|帮我|把|去|来|做|处理|签|确认|发|问|看|准备)/.test(text.trim());
}
