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
const countsOf=d=>({positive:d.positiveCues,boundary:d.negativeCues,question:d.targetQuestions,sharing:d.targetShares,selfStarts:d.selfStarts,targetStarts:d.targetStarts,medianMinutes:d.medianReplyMinutes,slowReplies:d.slowReplies,perfunctoryReplies:d.perfunctoryReplies,lowContentReplies:d.lowContentReplies,targetTurns:d.targetTurns,selfTurns:d.selfTurns,conflictReplies:d.conflictReplies,appeasementReplies:d.appeasementReplies,messages:d.messages.length,selfMessages:d.selfMessages,targetMessages:d.targetMessages});
test('逐项拆解与单日总分同源，且各项增减分相加等于当天分',()=>{
 const c=contact(),days=timelineOf(c).days;
 assert(days.length>=3);
 for(const d of days){
  const result=E.interactionScoreBreakdown(countsOf(d));
  assert.equal(result.score,d.affinityScore,'拆解分必须等于每日分 '+d.date);
  const total=result.items.reduce((sum,item)=>sum+item.delta,0);
  assert.equal(total,result.score,'各项相加必须等于总分 '+d.date);
  assert(result.items.some(item=>item.key==='quiet'));
  assert(result.items.some(item=>item.key==='coldCap'));
 }
});
test('对方整天零回合记中性 32，扣分项保留但不真正扣分',()=>{
 const c=contact(),zero=timelineOf(c).days.find(d=>d.date==='2026-06-04'),result=E.interactionScoreBreakdown(countsOf(zero));
 assert.equal(zero.targetTurns,0);
 assert.equal(result.quiet,true);
 assert.equal(result.score,32);
 assert.equal(result.items.find(item=>item.key==='silent').hit,true);
 assert.equal(result.items.find(item=>item.key==='quiet').delta,32-result.computed);
});
test('有对方回合但只有敷衍短句的日子低于 32，并标注命中的扣分项',()=>{
 const c=contact(),days=timelineOf(c).days,day=days.find(d=>d.date==='2026-06-06'),result=E.interactionScoreBreakdown(countsOf(day));
 assert.equal(result.quiet,false);
 assert(result.score<32,'2026-06-06 这类日子应低于基础分');
 assert(result.items.find(item=>item.key==='empty').hit);
 assert(result.items.find(item=>item.key==='slow').hit);
 const conclusion=harness(E.createScoringBasisView).render({contact:c,date:'2026-06-06',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 assert(conclusion.some(node=>node.props.role==='status'&&node.children.some(child=>typeof child==='string'&&child.includes('低于 32 分的原因'))));
});
test('打分依据页展示条数回合与最终分，可翻日和回链每日历程',()=>{
 const c=contact(),days=timelineOf(c).days,last=days.at(-1);
 let changed,opened,rules=0;
 const app=harness(E.createScoringBasisView);
 const nodes=app.render({contact:c,date:'',onDateChange:value=>changed=value,onOpenDaily:value=>opened=value,onOpenRules:()=>rules++});
 const text=JSON.stringify(nodes.map(node=>node.children));
 assert(text.includes('当天条数')&&text.includes('交流轮次')&&text.includes('最终分'));
 const rows=nodes.filter(node=>node.type==='tr');
 assert(rows.length>=15,'拆解表应覆盖全部评分项');
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
