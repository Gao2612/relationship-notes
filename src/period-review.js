import {sortChatMessages} from './engine.js';
import {question} from './interaction-signals.js';
import {shanghaiDateKey,reviewPeriodRange} from './shared/dates.js';
import {profileMessageId,isProfileFactCurrent} from './profile-lifecycle.js';
const topicRules=[['工作学习',/工作|项目|上班|加班|论文|考试|学习|作业/],['兴趣活动',/摄影|电影|音乐|看展|咖啡|游戏|阅读|爬山|跑步|旅行|做饭/],['日常近况',/今天|最近|吃饭|睡觉|下班|天气|回家|周末/]];
export function buildPeriodReview(contact={},options={}){
 contact=contact||{};
 const {period='week',anchor,now=Date.now()}=options,{start,end}=reviewPeriodRange(period,anchor);
 const pair=sortChatMessages((contact.messages||[]).filter(m=>m&&typeof m.text==='string'&&(m.sender===contact.self||m.sender===contact.target)));
 const rows=pair.map((message,index)=>({message,index,date:shanghaiDateKey(message.timestamp)})),selected=rows.filter(r=>r.date&&r.date>=start&&r.date<=end);
 const evidence=m=>({messageId:profileMessageId(m),quote:m.text.slice(0,240)});
 const topics=topicRules.map(([label,rule])=>{const matches=selected.filter(r=>rule.test(r.message.text));const keywords=[...new Set(matches.flatMap(r=>r.message.text.match(new RegExp(rule.source,'g'))||[]))].slice(0,8);return {label,keywords,count:matches.length,evidence:matches.slice(0,3).map(r=>evidence(r.message))};}).filter(t=>t.count);
 const unanswered=selected.filter(r=>r.message.sender===contact.target&&question(r.message.text)&&!pair.slice(r.index+1).some(m=>m.sender===contact.self)).slice(-8).map(r=>evidence(r.message));
 const followups=(contact.profileSummary||[]).filter(f=>['followup','plans','agreement','recent'].includes(f.field)&&isProfileFactCurrent(f,now)&&(f.provenance!=='model'||f.confirmed===true));
 const summary=selected.length?`本期共 ${selected.length} 条消息，记录中出现${topics.length?'“'+[...new Set(topics.flatMap(t=>t.keywords))].slice(0,10).join('、')+'”等话题':'的内容未匹配预设话题，请结合原文查看'}。`:'本期没有可识别日期的聊天记录。';
 return {period,start,end,summary,messageCount:selected.length,selfCount:selected.filter(r=>r.message.sender===contact.self).length,targetCount:selected.filter(r=>r.message.sender===contact.target).length,topics,unanswered,followups,unknownDateCount:rows.filter(r=>!r.date).length,disclaimer:'仅按已有记录整理。未看到后续本人回应不代表问题一定未回答；话题计数可重叠，待跟进项来自当前档案，不代表对方真实想法。'};
}
