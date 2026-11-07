import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../client-engine.js';
function harness(factory){let cursor=0,hooks=[];const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useRef:value=>({current:value}),useEffect(){},useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>hooks[i]=value];}};const Component=factory(React,E),nodes=(node,out=[])=>{if(node&&typeof node==='object'){if(typeof node.type==='function')return nodes(node.type(node.props),out);out.push(node);for(const child of node.children||[])nodes(child,out);}return out;};return {render(props){cursor=0;return nodes(Component(props));}};}
const sum=nodes=>nodes.filter(node=>node.type==='button').length;
function contact(){
 const messages=[{sender:'我',text:'在吗',timestamp:'2026-06-04 10:00'},{sender:'我',text:'今天忙不忙',timestamp:'2026-06-04 10:02'},{sender:'我',text:'在吗',timestamp:'2026-06-06 10:00'},{sender:'我',text:'今天忙不忙',timestamp:'2026-06-06 10:02'},{sender:'对方',text:'嗯',timestamp:'2026-06-06 12:50'},{sender:'我',text:'想和你聊聊电影，最近有什么想看的吗？',timestamp:'2026-07-01 09:00'},{sender:'对方',text:'还行',timestamp:'2026-07-01 09:05'},{sender:'我',text:'那我们一起去看吧',timestamp:'2026-07-01 09:06'},{sender:'对方',text:'看看',timestamp:'2026-07-01 09:07'}];
 return E.ensureContactMessageIds({id:'person',self:'我',target:'对方',messages,profileSummary:[]});
}
const timelineOf=c=>E.analyzeDailyTimeline(c.messages,c.self,c.target,c.interactionCorrections||[]);
const countsOf=d=>({positivePoints:d.positivePoints,emotionalSharingTurns:d.emotionalSharingTurns,positiveTurns:d.positiveTurns,questionTurns:d.questionTurns,sharingTurns:d.sharingTurns,boundaryTurns:d.boundaryTurns,responsiveTurns:d.responsiveTurns,answeredTurns:d.answeredTurns,continuedTurns:d.continuedTurns,strongConflict:d.strongConflict,positive:d.positiveCues,boundary:d.negativeCues,question:d.targetQuestions,sharing:d.targetShares,selfStarts:d.selfStarts,targetStarts:d.targetStarts,medianMinutes:d.medianReplyMinutes,slowReplies:d.slowReplies,perfunctoryReplies:d.perfunctoryReplies,lowContentReplies:d.lowContentReplies,targetTurns:d.targetTurns,selfTurns:d.selfTurns,conflictReplies:d.conflictReplies,appeasementReplies:d.appeasementReplies,messages:d.messages.length,selfMessages:d.selfMessages,targetMessages:d.targetMessages});
test('逐项拆解与单日总分同源，且各项增减分相加等于当天分',()=>{
 const c=contact(),days=timelineOf(c).days;
 assert(days.length>=3);
 for(const d of days){
  const result=E.interactionScoreBreakdown(countsOf(d));
  assert.equal(result.score,d.affinityScore,'拆解分必须等于每日分 '+d.date);
  const total=result.items.reduce((sum,item)=>sum+item.delta,0);
  assert.ok(Math.abs(total-result.score)<1e-9,'各项相加必须等于总分 '+d.date);
  assert(result.items.some(item=>item.key==='quiet'));
  assert(result.items.some(item=>item.key==='coldCap'));
 }
});
test('对方整天零回合记中性 32，不再虚设静默扣分',()=>{
 const c=contact(),zero=timelineOf(c).days.find(d=>d.date==='2026-06-04'),result=E.interactionScoreBreakdown(countsOf(zero));
 assert.equal(zero.targetTurns,0);
 assert.equal(result.quiet,true);
 assert.equal(result.score,32);
 assert.ok(!result.items.some(item=>item.key==='silent'&&item.delta<0));
 assert.equal(result.items.find(item=>item.key==='quiet').delta,32-result.computed);
});
test('跨对话段的有效短答保留回应依据，慢回复只作统计',()=>{
 const c=contact(),days=timelineOf(c).days,day=days.find(d=>d.date==='2026-06-06'),result=E.interactionScoreBreakdown(countsOf(day));
 assert.equal(result.quiet,false);
 assert.equal(day.responsiveTurns,1);
 assert.ok(result.score>32);
 assert.equal(result.items.find(item=>item.key==='empty').hit,false);
 assert.equal(day.slowReplies,1);
 assert.ok(!result.items.some(item=>['slow','latency','latencyOverlap'].includes(item.key)&&item.delta!==0));
 const conclusion=harness(E.createScoringBasisView).render({contact:c,date:'2026-06-06',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 assert(conclusion.some(node=>node.props.role==='status'&&node.children.some(child=>typeof child==='string'&&child.includes('有效回应'))));
});
test('打分依据页展示条数回合与最终分，可翻日和回链每日历程',()=>{
 const c=contact(),days=timelineOf(c).days,last=days.at(-1);
 let changed,opened,rules=0;
 const app=harness(E.createScoringBasisView);
 const nodes=app.render({contact:c,date:'',onDateChange:value=>changed=value,onOpenDaily:value=>opened=value,onOpenRules:()=>rules++});
 const text=JSON.stringify(nodes.map(node=>node.children));
 assert(text.includes('当天条数')&&text.includes('交流轮次')&&text.includes('最终分'));
 const rows=nodes.filter(node=>node.type==='tr');
 assert.equal(rows.length,E.interactionScoreBreakdown(countsOf(last)).items.length+1,'表头及所有实际计分项均应呈现');
 assert(JSON.stringify(nodes.map(node=>node.children)).includes('未命中'),'未命中的项也要列出并标注');
 const prev=nodes.find(node=>node.props['aria-label']==='前一天'),next=nodes.find(node=>node.props['aria-label']==='后一天');
 assert.equal(prev.props.style.minHeight,44);assert(prev.props.style.minWidth>=44);
 if(days.length>1){prev.props.onClick();assert.equal(changed,days.at(-2).date);}
 const open=nodes.find(node=>node.type==='button'&&node.children.includes('查看当天聊天记录'));
 open.props.onClick();assert.equal(opened,last.date);
 const ruleButton=nodes.find(node=>node.type==='button'&&node.children.includes('查看完整评分规则'));
 ruleButton.props.onClick();assert.equal(rules,1);
});
test('指定没有记录的日期时退回最近有记录日并说明',()=>{
 const c=contact(),app=harness(E.createScoringBasisView),nodes=app.render({contact:c,date:'2026-08-08',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 const text=JSON.stringify(nodes.map(node=>node.children));
 assert(text.includes('没有可识别的记录'));
});


test('依据页传入回合与有效回应，与日分保持一致',()=>{
 const messages=Array.from({length:6},(_,i)=>[
  {sender:'我',text:'你几点出门？',timestamp:'2026-11-07 09:'+String(i*2).padStart(2,'0')},
  {sender:'对方',text:'八点',timestamp:'2026-11-07 09:'+String(i*2+1).padStart(2,'0')}
 ]).flat();
 const c={self:'我',target:'对方',messages};
 const day=timelineOf(c).days[0];
 assert.equal(day.responsiveTurns,6);
 let passed,computed;
 const engine={...E,interactionScoreBreakdown(counts){passed=counts;computed=E.interactionScoreBreakdown(counts);return computed;}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)})};
 E.createScoringBasisView(React,engine)({contact:c,date:day.date});
 assert.equal(passed.responsiveTurns,6);
 for(const field of ['positiveTurns','positivePoints','questionTurns','sharingTurns','emotionalSharingTurns','boundaryTurns'])assert.equal(passed[field],day[field],field);
 assert.equal(computed.score,day.affinityScore);
 assert.ok(computed.items.some(item=>item.key==='response'&&item.delta>0));
});


test('分项显示两位小数，原始分项仍精确合计',()=>{
 const c={self:'我',target:'对方',messages:[
  {sender:'对方',text:'我今天买了一本书',timestamp:'2026-11-07 07:00'},
  {sender:'我',text:'你几点出门？',timestamp:'2026-11-07 09:30'},
  {sender:'对方',text:'八点',timestamp:'2026-11-07 09:31'}
 ]};
 const day=timelineOf(c).days[0],breakdown=E.interactionScoreBreakdown(countsOf(day));
 assert.equal(breakdown.items.find(item=>item.key==='initiative').delta,2/3);
 assert.ok(Math.abs(breakdown.items.reduce((sum,item)=>sum+item.delta,0)-day.affinityScore)<1e-9);
 const result=JSON.stringify(harness(E.createScoringBasisView).render({contact:c}));
 assert.ok(result.includes('+0.67'));
 assert.ok(!result.includes('+0.666666'));
});


test('拆分消息气泡仍按回合解释低频日',()=>{
 const c={self:'我',target:'对方',messages:[
  {sender:'我',text:'天气变化很大',timestamp:'2026-11-07 09:00'},
  ...['嗯','嗯','嗯'].map((text,i)=>({sender:'对方',text,timestamp:'2026-11-07 09:0'+(i+1)}))
 ]};
 const day=timelineOf(c).days[0];
 assert.equal(day.messages.length,4);
 assert.equal(day.turns,2);
 assert.equal(day.affinityScore,32);
 const nodes=harness(E.createScoringBasisView).render({contact:c});
 assert.ok(nodes.some(node=>node.props.role==='status'&&node.children.some(child=>typeof child==='string'&&child.includes('双方合计只有 2 个回合'))));
});
