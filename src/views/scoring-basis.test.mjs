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
const statusText=nodes=>nodes.filter(node=>node.props.role==='status').flatMap(node=>node.children).filter(child=>typeof child==='string').join('');

test('逐项拆解与单日指数同源：维度贡献之和 × 摩擦系数（边界封顶）等于当天指数',()=>{
 const c=contact(),days=timelineOf(c).days;
 assert(days.length>=3);
 for(const d of days){
  if(d.affinityScore===null)continue;
  const basis=E.basisRows(d.v3,E.DIMENSIONS);
  assert.equal(basis.rows.length,E.DIMENSIONS.length);
  for(const row of basis.rows)assert.ok(Math.abs(row.contribution-100*row.weight*row.estimate)<1e-9);
  assert.equal(Math.round(d.affinityBoundary?Math.min(basis.raw,E.BOUNDARY_CAP):basis.raw),d.affinityScore,'拆解必须等于当天指数 '+d.date);
 }
});
test('对方整天零回合不评分，不再使用旧版的中性 32',()=>{
 const c=contact(),zero=timelineOf(c).days.find(d=>d.date==='2026-06-04');
 assert.equal(zero.targetTurns,0);
 assert.equal(zero.affinityScore,null);
 const nodes=harness(E.createScoringBasisView).render({contact:c,date:'2026-06-04',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 assert.match(statusText(nodes),/对方当天没有可评分的回合/);
 assert.ok(!statusText(nodes).includes('32'));
});
test('跨对话段的有效短答保留回应依据，慢回复只作统计',()=>{
 const c=contact(),days=timelineOf(c).days,day=days.find(d=>d.date==='2026-06-06');
 assert.equal(day.responsiveTurns,1);
 assert.equal(day.slowReplies,1);
 assert.notEqual(day.affinityScore,null);
 assert.equal(day.v3Signals.bids.toward,1,'“嗯”接住了跨段的提问');
 const nodes=harness(E.createScoringBasisView).render({contact:c,date:'2026-06-06',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 assert.match(statusText(nodes),/^当天关系指数 \d+/);
 assert.ok(JSON.stringify(nodes.map(node=>node.children)).includes('转向 1'));
});
test('打分依据页展示条数回合与关系指数，可翻日和回链每日历程与规则',()=>{
 const c=contact(),days=timelineOf(c).days,last=days.at(-1);
 let changed,opened,rules=0,insight=0;
 const app=harness(E.createScoringBasisView);
 const nodes=app.render({contact:c,date:'',onDateChange:value=>changed=value,onOpenDaily:value=>opened=value,onOpenRules:()=>rules++,onOpenInsight:()=>insight++});
 const text=JSON.stringify(nodes.map(node=>node.children));
 assert(text.includes('当天条数')&&text.includes('交流轮次')&&text.includes('关系指数')&&text.includes('80% 区间'));
 const rows=nodes.filter(node=>node.type==='tr');
 assert.equal(rows.length,1+E.DIMENSIONS.length+2,'表头、六个维度、摩擦与边界');
 for(const d of E.DIMENSIONS)assert(text.includes(d.label),d.label);
 assert(text.includes('所在周')&&text.includes('所在月'));
 const prev=nodes.find(node=>node.props['aria-label']==='前一天'),next=nodes.find(node=>node.props['aria-label']==='后一天');
 assert.equal(prev.props.style.minHeight,44);assert(prev.props.style.minWidth>=44);assert(next);
 if(days.length>1){prev.props.onClick();assert.equal(changed,days.at(-2).date);}
 nodes.find(node=>node.type==='button'&&node.children.includes('查看当天聊天记录')).props.onClick();assert.equal(opened,last.date);
 nodes.find(node=>node.type==='button'&&node.children.includes('查看完整评分规则')).props.onClick();assert.equal(rules,1);
 nodes.find(node=>node.type==='button'&&node.children.includes('查看关系分析（含 AI 评定）')).props.onClick();assert.equal(insight,1);
});
test('指定没有记录的日期时退回最近有记录日并说明',()=>{
 const c=contact(),app=harness(E.createScoringBasisView),nodes=app.render({contact:c,date:'2026-08-08',onDateChange(){},onOpenDaily(){},onOpenRules(){}});
 const text=JSON.stringify(nodes.map(node=>node.children));
 assert(text.includes('没有可识别的记录'));
});
test('依据页的规则观测与每日历程同源（回应、开示、主动开启）',()=>{
 const messages=Array.from({length:6},(_,i)=>[
  {sender:'我',text:'你几点出门？',timestamp:'2026-11-07 09:'+String(i*2).padStart(2,'0')},
  {sender:'对方',text:'八点',timestamp:'2026-11-07 09:'+String(i*2+1).padStart(2,'0')}
 ]).flat();
 const c={self:'我',target:'对方',messages};
 const day=timelineOf(c).days[0];
 assert.equal(day.responsiveTurns,6);
 assert.equal(day.v3Signals.bids.toward,6);
 assert.equal(day.v3.dims.responsiveness.rule,1);
 const text=JSON.stringify(harness(E.createScoringBasisView).render({contact:c,date:day.date}).map(node=>node.children));
 assert(text.includes('转向 6'));
 assert(text.includes('关系指数 '+day.affinityScore));
});
test('分项显示两位小数，原始分项仍精确合计',()=>{
 const c={self:'我',target:'对方',messages:[
  {sender:'对方',text:'我今天买了一本书',timestamp:'2026-11-07 07:00'},
  {sender:'我',text:'你几点出门？',timestamp:'2026-11-07 09:30'},
  {sender:'对方',text:'八点',timestamp:'2026-11-07 09:31'}
 ]};
 const day=timelineOf(c).days[0],basis=E.basisRows(day.v3,E.DIMENSIONS);
 assert.equal(Math.round(basis.raw),day.affinityScore);
 const result=JSON.stringify(harness(E.createScoringBasisView).render({contact:c}));
 assert.ok(!/\d\.\d{3,}/.test(result.replace(/"[^"]*\d{4}-\d{2}-\d{2}[^"]*"/g,'')),'显示值最多两位小数');
});
test('拆分消息气泡仍按回合解释，样本少时可信度低',()=>{
 const c={self:'我',target:'对方',messages:[
  {sender:'我',text:'天气变化很大',timestamp:'2026-11-07 09:00'},
  ...['嗯','嗯','嗯'].map((text,i)=>({sender:'对方',text,timestamp:'2026-11-07 09:0'+(i+1)}))
 ]};
 const day=timelineOf(c).days[0];
 assert.equal(day.messages.length,4);
 assert.equal(day.turns,2);
 assert.equal(day.targetTurns,1);
 assert.equal(day.affinityReliability,'low');
 const nodes=harness(E.createScoringBasisView).render({contact:c});
 assert.match(statusText(nodes),/样本少，可信度低/);
});
