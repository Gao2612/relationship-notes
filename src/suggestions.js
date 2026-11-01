const clipSuggestion=(value,n=160)=>Array.from(String(value||'').trim()).slice(0,n).join('');
const rules=[['兴趣',/(摄影|爬山|跑步|游泳|电影|音乐|画画|阅读|旅行|做饭|游戏|骑行|看展|咖啡)/],['工作学习',/(工作|上班|加班|项目|报告|论文|考试|作业|方案|设计稿|学习)/],['近期活动',/(今天|最近|昨天|周末|明天|计划|打算|去了|参加)/]];
const asks=text=>/[?？]|(?:吗|么|如何|为什么|怎么|是否|什么|哪[里个天])/.test(text);
export function suggestNextSteps(contact,{now=Date.now(),max=5}={}){
 const msgs=(contact?.messages||[]).filter(m=>(m.sender===contact.self||m.sender===contact.target)&&typeof m.text==='string'&&m.text.trim()),last=msgs.at(-1),out=[];
 const add=(type,text,basis,risk='轻量建议；对方可以不接这个话题。',confidence=.55)=>out.push({id:`${type}-${out.length+1}`,type,text,basis,confidence,risk});
 if(last?.sender===contact.target&&asks(last.text))add('reply','先回答对方刚提出的问题，再补一句简短的自己的想法。',[{description:'对方最后一条消息包含问题',messageIndex:msgs.length-1,quote:clipSuggestion(last.text)}],'需要你补入真实答案；不要让模型代替你编答案。',.9);
 if(last){for(const [label,rx] of rules){const match=rx.exec(last.text);if(match){add('topic',`接着聊${label}里的“${match[0]}”，问对方最近最想分享哪一部分。`,[{description:'延续最近话题',messageIndex:msgs.length-1,quote:clipSuggestion(last.text)}],'如果对方刚表达忙碌或想结束，可以先不追问。',.78);break;}}}
 const facts=(contact.profileSummary||[]).filter(f=>f.status==='active'&&!f.obsolete),interest=facts.find(f=>f.field==='interests'||f.field==='preferences');
 if(interest&&out.length<max)add('topic',`从已确认的兴趣“${clipSuggestion(interest.value,55)}”里选一个具体、容易回答的问题。`,[{description:'已确认联系人资料',factId:interest.uid,quote:clipSuggestion(interest.quote||interest.value)}],'资料可能过时，先结合近期聊天判断是否合适。',.7);
 const pending=msgs.filter(m=>m.sender===contact.self).at(-1);if(pending&&last?.sender===contact.target&&msgs.indexOf(pending)>msgs.indexOf(last)){}else if(pending&&last?.sender===contact.self)add('nextStep','给对方留出回应空间；之后可回到双方最近都参与的话题。',[{description:'最近一条记录来自你',messageIndex:msgs.length-1,quote:clipSuggestion(last.text)}],'不需要连续追发。',.66);
 if(!out.length&&last)add('topic','可以回应对方刚分享的内容，并问一个容易回答、也容易略过的问题。',[{description:'依据最近一条对话',messageIndex:msgs.length-1,quote:clipSuggestion(last.text)}],'通用建议，依据有限。',.35);
 const age=now,plans=(contact.selfProfile?.plans||[]).filter(p=>p.text);for(const plan of plans.slice(0,1))if(out.length<max)add('topic',`若与你当前意图相符，可以自然分享自己的计划：“${clipSuggestion(plan.text,70)}”。`,[{description:'你的档案中的计划',refId:'selfProfile.plan'}],'仅在计划仍准确且你愿意分享时使用。',.55);
 return {suggestions:out.slice(0,max),disclaimer:'这是依据已导入内容生成的可能话题，不代表对方真实想法，也不能准确预测回应。'};
}

