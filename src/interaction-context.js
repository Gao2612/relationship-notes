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
  const value=message.timestamp;
  const numeric=typeof value==='number'||/^\d{10,13}$/.test(String(value));
  const time=numeric?Number(value)*(Number(value)<1e12?1000:1):Date.parse(String(value).replace(' ','T'));
  if(!Number.isFinite(time)||previous===null||time<previous||time-previous>=7200000)flush();
  segment.push(message);
  previous=Number.isFinite(time)?time:null;
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
 const affirmative=acknowledgment&&(previousQuestion||/试试|尝尝|尝一尝|一起|要不|帮我|麻烦|请|看看|发给/.test(previous));
 const answer=previousQuestion&&!/^(?:哈+|呵+|不知道|随便)[!！。\s]*$/.test(body);
 const prior=terms(previous),current=terms(body);
 const continuation=[...current].some(term=>prior.has(term));
 const detail=/看着.{0,4}香|美味|加上.{0,4}香|一直在拍|人多|的$|会比.{0,8}(?:辣|贵|便宜|好)/.test(body);
 return {answer,affirmative,continuation:continuation||detail&&Boolean(previous)};
}
