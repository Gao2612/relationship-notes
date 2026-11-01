const clipSuggestion=(value,n=160)=>Array.from(String(value||'').trim()).slice(0,n).join('');
const rules=[['兴趣',/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|看展|咖啡)/],['工作学习',/(工作|上班|加班|项目|报告|论文|考试|作业|方案|设计稿|学习)/],['近期活动',/(今天|最近|昨天|周末|明天|计划|打算|去了|参加)/]];
const asks=text=>/[?？]|(?:吗|么|如何|为什么|怎么|是否|什么|哪[里个天])/.test(text);
export function suggestNextSteps(contact,{now=Date.now(),max=5}={}){
 contact=contact||{};max=Number.isFinite(max)?Math.max(0,Math.min(5,Math.floor(max))):5;
 const msgs=(contact?.messages||[]).filter(m=>(m.sender===contact.self||m.sender===contact.target)&&typeof m.text==='string'&&m.text.trim()),last=msgs.at(-1),out=[];
 const add=(type,text,basis,risk='轻量建议；对方可以不接这个话题。',confidence=.55)=>out.push({id:`${type}-${out.length+1}`,type,text,basis,confidence,risk});
 if(last&&last.sender===contact.self){add('nextStep','先给对方留出回应空间，暂时不用追加话题。',[{description:'最近一条记录来自你',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'不需要连续追发。',.66);return {suggestions:out.slice(0,max),disclaimer:'对方尚未回应不代表拒绝，也无法据此判断真实想法。'};}
 if(last&&last.sender===contact.target&&/(别再联系|不要再联系|不想聊|先不聊|不方便聊|我要休息|我先忙)/.test(last.text)){add('nextStep','简短回应并给对方空间，暂时停止追加话题。',[{description:'对方明确表达暂停或边界',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'尊重对方的停止或暂停要求，不用追问测试关系。',.95);return {suggestions:out.slice(0,max),disclaimer:'以对方明确表达的边界为准，不推测背后的想法。'};}
 if(last&&last.sender===contact.target&&asks(last.text))add('reply','先回答对方刚提出的问题，再补一句简短的自己的想法。',[{description:'对方最后一条消息包含问题',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'需要你补入真实答案；不要让模型代替你编答案。',.9);
 if(last){for(const [label,rx] of rules){const match=rx.exec(last.text);if(match){add('topic',`接着聊${label}里的“${match[0]}”，问对方最近最想分享哪一部分。`,[{description:'延续最近话题',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'如果对方刚表达忙碌或想结束，可以先不追问。',.78);break;}}}
 const facts=(contact.profileSummary||[]).filter(f=>f.status==='active'&&!f.obsolete&&(f.provenance!=='model'||f.confirmed===true)),interest=facts.find(f=>f.field==='interests'||f.field==='preferences');
 if(interest&&out.length<max)add('topic',`从已确认的兴趣“${clipSuggestion(interest.value,55)}”里选一个具体、容易回答的问题。`,[{description:'已确认联系人资料',factId:interest.uid,quote:clipSuggestion(interest.quote||interest.value)}],'资料可能过时，先结合近期聊天判断是否合适。',.7);
 if(!out.length&&last)add('topic','可以回应对方刚分享的内容，并问一个容易回答、也容易略过的问题。',[{description:'依据最近一条对话',messageIndex:contact.messages.indexOf(last),quote:clipSuggestion(last.text)}],'通用建议，依据有限。',.35);
 const followup=facts.find(f=>['followup','recent','agreement'].includes(f.field));if(followup&&out.length<max)add('nextStep',`如果仍然合适，可以轻轻问候此前提到的“${clipSuggestion(followup.value,60)}”进展。`,[{description:'已确认的待跟进事项',factId:followup.uid,quote:clipSuggestion(followup.quote||followup.value)}],'先核对日期与近况，不把旧安排当成现在的约定。',.6);
 const plans=(contact.selfProfile?.plans||[]).filter(p=>p.text);for(const plan of plans.slice(0,1))if(out.length<max)add('topic',`若与你当前意图相符，可以自然分享自己的计划：“${clipSuggestion(plan.text,70)}”。`,[{description:'你的档案中的计划',refId:'selfProfile.plan'}],'仅在计划仍准确且你愿意分享时使用。',.55);
 return {suggestions:out.slice(0,max),disclaimer:'这是依据已导入内容生成的可能话题，不代表对方真实想法，也不能准确预测回应。'};
}
