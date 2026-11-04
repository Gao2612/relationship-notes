import {selectPositivePreference,extractPreferenceEvidence} from './preference-evidence.js';
import {applyTopicFeedback} from './topic-feedback.js';
import {isProfileFactCurrent,profileExpiryTime,profileMessageId} from './profile-lifecycle.js';
const clipSuggestion=(value,n=160)=>Array.from(String(value||'').trim()).slice(0,n).join('');
const rules=[['兴趣',/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|看展|咖啡)/],['工作学习',/(工作|上班|加班|项目|报告|论文|考试|作业|方案|设计稿|学习)/],['近期活动',/(今天|最近|昨天|周末|明天|计划|打算|去了|参加)/]];
const asks=text=>/[?？]|(?:吗|么|如何|为什么|怎么|是否|什么|哪[里个天])/.test(text);
function preferenceQuestion(text){
 const templates=[[/农场|种菜|种植/,'最近还有玩农场吗？'],[/摄影|拍照/,'最近有拍到自己满意的照片吗？'],[/电影/,'最近有没有想看的电影？'],[/音乐|听歌|唱歌/,'最近有没有一直在听的歌？'],[/咖啡/,'最近有喝到想推荐的咖啡吗？'],[/看展/,'最近有没有想去看的展？'],[/阅读|读书|小说/,'最近在看什么书呀？'],[/爬山|徒步/,'最近有没有想走的路线？'],[/做饭|烘焙/,'最近有没有想试着做的东西？'],[/麻将/,'最近还有打麻将吗？'],[/剧本杀/,'最近有碰到喜欢的本吗？'],[/狼人杀/,'最近还有玩狼人杀吗？'],[/游戏/,'最近主要在玩哪款游戏呀？']];
 return templates.find(([rule])=>rule.test(text))?.[1]||null;
}
export function suggestNextSteps(contact,{now=Date.now(),max=5}={}){
 contact=contact||{};max=Number.isFinite(max)?Math.max(0,Math.min(5,Math.floor(max))):5;
 const msgs=(contact?.messages||[]).filter(m=>(m.sender===contact.self||m.sender===contact.target)&&typeof m.text==='string'&&m.text.trim()),last=msgs.at(-1),out=[];
 const add=(type,text,basis,risk='轻量建议；对方可以不接这个话题。',confidence=.55)=>out.push({id:`${type}-${out.length+1}`,type,text,basis,confidence,risk});
 if(last&&last.sender===contact.self){add('nextStep','先给对方留出回应空间，暂时不用追加话题。',[{description:'最近一条记录来自你',messageId:profileMessageId(last),messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'不需要连续追发。',.66);return {suggestions:out.slice(0,max),disclaimer:'对方尚未回应不代表拒绝，也无法据此判断真实想法。'};}
 if(last&&last.sender===contact.target&&/(别再联系|不要再联系|不想聊|先不聊|不方便聊|我要休息|我先忙)/.test(last.text)){add('nextStep','简短回应并给对方空间，暂时停止追加话题。',[{description:'对方明确表达暂停或边界',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'尊重对方的停止或暂停要求，不用追问测试关系。',.95);return {suggestions:out.slice(0,max),disclaimer:'以对方明确表达的边界为准，不推测背后的想法。'};}
 if(last&&last.sender===contact.target&&asks(last.text))add('reply','先回答对方刚提出的问题，再补一句简短的自己的想法。',[{description:'对方最后一条消息包含问题',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'需要你补入真实答案；不要让模型代替你编答案。',.9);
 const recentPreference=extractPreferenceEvidence(last?.text||'');
 if(last?.sender===contact.target&&recentPreference.negative.length&&!recentPreference.positive.length){add('reply','可以先接一句：“了解，那这些就先不聊啦。”',[{description:'对方刚明确表达了不感兴趣的内容',messageId:profileMessageId(last),quote:clipSuggestion(recentPreference.negative[0].quote)}],'先回应对方的偏好，不追问或推销对方已否定的话题。',.8);return {suggestions:out.slice(0,max),disclaimer:'依据对方刚刚明确说出的偏好，避免把否定表达反过来当成兴趣。'};}
 if(last){const positive=recentPreference.positive.map(pref=>({...pref,question:preferenceQuestion(pref.text)})).find(pref=>pref.question);
  if(positive)add('topic',positive.question,[{description:'延续对方刚明确表达的兴趣',messageId:profileMessageId(last),quote:clipSuggestion(positive.quote)}],'只围绕明确喜欢的部分，不扩展到同句中被否定的项目。',.8);
  else if(!recentPreference.negative.length)for(const [label,rx] of rules){const match=rx.exec(last.text);if(match){const question=label==='兴趣'?preferenceQuestion(match[0]):'刚才说到'+match[0]+'，你还有什么想分享的吗？';if(question)add('topic',question,[{description:'延续最近实际提及的话题，不据此认定为爱好',messageId:profileMessageId(last),quote:clipSuggestion(last.text)}],'结合对方当前回应判断；不要求继续这个话题。',.65);break;}}
 }
 const facts=(contact.profileSummary||[]).filter(f=>isProfileFactCurrent(f,now)&&(f.provenance!=='model'||f.confirmed===true));
 const interests=facts.map(fact=>({fact,pref:selectPositivePreference(fact)})).filter(row=>row.pref).map(row=>({...row,question:preferenceQuestion(row.pref.text)})),interest=interests.find(row=>row.question&&!out.some(item=>item.text===row.question));
 if(interest&&out.length<max)add('topic',interest.question,[{description:interest.fact.quote?'已确认兴趣的直接正向依据':'你手动确认的兴趣：'+interest.pref.text,factId:interest.fact.uid,quote:interest.fact.quote?clipSuggestion(interest.pref.quote):''}],'先轻轻确认近况，不把历史兴趣当作当前正在做的事。',.7);
 if(!out.length&&last)add('topic','可以回应对方刚分享的内容，并问一个容易回答、也容易略过的问题。',[{description:'依据最近一条对话',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'通用建议，依据有限。',.35);
 const followup=facts.find(f=>['followup','recent','agreement'].includes(f.field));if(followup&&out.length<max)add('nextStep',`如果仍然合适，可以轻轻问候此前提到的“${clipSuggestion(followup.value,60)}”进展。`,[{description:'已确认的待跟进事项',factId:followup.uid,quote:clipSuggestion(followup.quote||followup.value)}],'先核对日期与近况，不把旧安排当成现在的约定。',.6);
 const plans=(contact.selfProfile?.plans||[]).filter(p=>p.text&&!['completed','cancelled','expired'].includes(p.planState)&&(!p.expiresAt||!Number.isFinite(profileExpiryTime(p.expiresAt))||profileExpiryTime(p.expiresAt)>=now));for(const plan of plans.slice(0,1))if(out.length<max)add('topic',`若与你当前意图相符，可以自然分享自己的计划：“${clipSuggestion(plan.text,70)}”。`,[{description:'你的档案中的计划',refId:'selfProfile.plan'}],'仅在计划仍准确且你愿意分享时使用。',.55);
 const reviewed=applyTopicFeedback(out,contact.topicFeedback||[]);return {...reviewed,suggestions:reviewed.suggestions.slice(0,max),disclaimer:'这是依据已导入内容生成的可能话题，不代表对方真实想法，也不能准确预测回应。'};
}
