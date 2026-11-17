// 「打分依据」页：把某一天的关系指数（关系分析 v3，规则层）逐项拆开，并给出所在周、所在月的同口径结果。
const NAV_STYLE={minHeight:44,minWidth:44,fontSize:13};
const SMALL={fontSize:12};
const round2=value=>Math.round(value*100)/100;
const fmt=value=>value===null||value===undefined||!Number.isFinite(value)?'—':String(round2(value));
const RELIABILITY={high:'可信度高',medium:'可信度中',low:'样本少，可信度低',none:'未评分'};

/** 把单个时段的 v3 结果拆成可核对的行：每个维度的贡献之和 × 摩擦系数 = 指数（封顶前）。 */
export function basisRows(result,dimensions){
 if(!result)return {rows:[],sum:0,factor:1,raw:null};
 const rows=dimensions.map(d=>{const dim=result.dims[d.key];return {key:d.key,label:d.label,weight:d.weight,rule:dim.rule,n:dim.n,estimate:dim.estimate,contribution:100*d.weight*dim.estimate};});
 const sum=rows.reduce((total,row)=>total+row.contribution,0),factor=1-0.6*result.friction.estimate;
 return {rows,sum,factor,raw:sum*factor};
}

function conclusion(day,result,basis){
 if(!result)return '当天没有可识别的回合。';
 if(!result.scored)return `对方当天没有可评分的回合（我方 ${day.selfTurns||0} 个回合），互动过程无从观察，不评分。这不是 0 分，也不会拉低月、年结果。`;
 const sorted=[...basis.rows].sort((a,b)=>(b.estimate-0.5)-(a.estimate-0.5)),high=sorted.filter(row=>row.estimate>0.55).slice(0,2),low=sorted.filter(row=>row.estimate<0.45).reverse().slice(0,2);
 const parts=[`当天关系指数 ${result.index}（80% 区间 ${result.low}–${result.high}，${RELIABILITY[result.reliability]}）。`];
 if(high.length)parts.push('高于中性的维度：'+high.map(row=>row.label+' '+fmt(row.estimate)).join('、')+'。');
 if(low.length)parts.push('低于中性的维度：'+low.map(row=>row.label+' '+fmt(row.estimate)).join('、')+'。');
 if(!high.length&&!low.length)parts.push('各维度都接近中性 0.5：当天证据较少，估计被收缩到中性附近。');
 if(result.friction.estimate>0)parts.push(`摩擦 ${fmt(result.friction.estimate)}，指数乘以 ${fmt(basis.factor)}。`);
 if(result.boundary.rule)parts.push('当天出现明确的拒绝或边界表达，指数封顶 30。');
 return parts.join('');
}

export function createScoringBasisView(React,E){
 const h=React.createElement;
 return function ScoringBasisView({contact,date='',onDateChange,onOpenDaily,onOpenRules,onOpenInsight}){
  if(!contact)return h('section',{className:'rn-box'},h('h2',null,'打分依据'),h('p',{className:'rn-muted'},'先选择一个联系人。'));
  const timeline=E.analyzeDailyTimeline(contact.messages||[],contact.self,contact.target,contact.interactionCorrections||[]);
  const days=timeline.days||[];
  if(!days.length)return h('section',{className:'rn-box'},h('h2',null,'打分依据'),h('p',{className:'rn-muted'},'当前联系人还没有带日期的聊天记录，无法拆解打分。'));
  const foundIndex=days.findIndex(day=>day.date===date);
  const index=foundIndex>=0?foundIndex:days.length-1;
  const day=days[index],result=day.v3||null,basis=basisRows(result,E.DIMENSIONS),signals=day.v3Signals;
  const weekKey=E.weekStartKey(day.date),week=E.analyzePeriodsCached(contact,'week').find(item=>item.key===weekKey),month=E.analyzePeriodsCached(contact,'month').find(item=>item.key===day.date.slice(0,7));
  const go=step=>{const next=days[index+step];if(next&&onDateChange)onDateChange(next.date);};
  const quotes=key=>{
   const list=(signals?.evidence?.[key]||[]).filter(item=>item.quote);
   if(!list.length)return h('span',{className:'rn-muted'},'—');
   return h('details',null,h('summary',{'aria-label':'展开命中原文'},list.length+' 条原文'),...list.map((item,i)=>h('blockquote',{key:i,style:SMALL},h('small',{className:'rn-muted'},item.label+'：'),item.quote)));
  };
  const facts=signals?{
   responsiveness:`我方邀请 ${signals.bids.toward+signals.bids.away+signals.bids.against+signals.bids.unanswered} 次：转向 ${signals.bids.toward}、转离 ${signals.bids.away}、对立 ${signals.bids.against}、未回复 ${signals.bids.unanswered}`,
   disclosure:`对方分享 ${signals.target.disclosure} 回合（感受 ${signals.target.emotional}），对方 ${signals.target.turns} 个回合`,
   reciprocity:`分享 我 ${signals.self.disclosure}/对方 ${signals.target.disclosure}；提问 我 ${signals.self.questions}/对方 ${signals.target.questions}；主动开启 我 ${signals.self.starts}/对方 ${signals.target.starts}`,
   positivity:`正向分值 ${signals.target.positivePoints}；好消息 ${signals.capitalization.opportunities} 次，获积极回应 ${signals.capitalization.constructive} 次`,
   engagement:`对方主动开启 ${signals.target.starts} 次，提问或分享 ${signals.target.bids} 回合`,
   coordination:signals.lsm===null?`字数不足（较少一方 ${signals.lsmChars} 字，需 ≥ 40）`:`LSM ${fmt(signals.lsm)}（较少一方 ${signals.lsmChars} 字）`}:{};
  const metrics=[[day.messages.length,'当天条数'],[day.turns,'交流轮次'],[day.targetTurns||0,'对方回合'],[result?.scored?result.index:'未评分','关系指数'],[result?.scored?`${result.low}–${result.high}`:'—','80% 区间']];
  const metricCards=metrics.map(([value,label])=>h('div',{className:'rn-metric',key:label},h('span',{className:'rn-muted'},label),h('strong',null,value)));
  const toolbar=h('div',{className:'rn-form',style:{display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}},
   h('div',{style:{display:'flex',gap:8,alignItems:'center'}},
    h('button',{type:'button',style:NAV_STYLE,'aria-label':'前一天',disabled:index<=0,onClick:()=>go(-1)},'‹ 前一天'),
    h('button',{type:'button',style:NAV_STYLE,'aria-label':'后一天',disabled:index>=days.length-1,onClick:()=>go(1)},'后一天 ›')),
   h('label',{style:{width:190}},h('span',null,'选择日期'),h('input',{type:'date',value:day.date,'aria-label':'查看某天的打分依据',onChange:event=>onDateChange&&onDateChange(event.target.value)})),
   h('button',{type:'button',style:NAV_STYLE,onClick:()=>onDateChange&&onDateChange(days[days.length-1].date)},'回到最近有记录日'),
   h('button',{type:'button',style:NAV_STYLE,onClick:()=>onOpenDaily&&onOpenDaily(day.date)},'查看当天聊天记录'));
  const position=h('p',{className:'rn-muted',style:SMALL},foundIndex>=0?'第 '+(index+1)+' / '+days.length+' 个有记录日。':day.date+' 没有可识别的记录，已显示最近有记录的一天（'+day.date+'）。');
  const tableHead=h('thead',null,h('tr',null,...['维度','规则观测','x','证据量 n','收缩估计 d','权重','贡献 100·w·d','命中原文'].map((label,i)=>h('th',{key:i},label))));
  const rows=basis.rows.map(row=>h('tr',{key:row.key},
   h('td',null,h('strong',null,row.label)),h('td',{style:SMALL},facts[row.key]||'—'),h('td',null,fmt(row.rule)),h('td',null,row.n),h('td',null,h('strong',null,fmt(row.estimate))),h('td',null,Math.round(row.weight*100)+'%'),h('td',null,fmt(row.contribution)),h('td',null,quotes(row.key))));
  const frictionRow=result&&h('tr',{key:'friction'},h('td',null,h('strong',null,'摩擦与修复')),h('td',{style:SMALL},signals?`摩擦 ${signals.target.conflict}、敷衍或低信息量 ${signals.target.empty}、修复 ${signals.target.repair}`:'—'),h('td',null,fmt(result.friction.rule)),h('td',null,result.friction.n),h('td',null,h('strong',null,fmt(result.friction.estimate))),h('td',null,'—'),h('td',null,'× '+fmt(basis.factor)),h('td',null,quotes('friction')));
  const boundaryRow=result&&h('tr',{key:'boundary'},h('td',null,h('strong',null,'明确边界')),h('td',{style:SMALL},result.boundary.rule?`${result.boundary.count} 个回合`:'未出现'),h('td',null,'—'),h('td',null,'—'),h('td',null,'—'),h('td',null,'—'),h('td',null,result.boundary.rule?'封顶 30':'—'),h('td',null,quotes('boundary')));
  const table=h('table',{'aria-label':'当天关系指数分项拆解'},tableHead,h('tbody',null,...rows,frictionRow,boundaryRow));
  const total=result?.scored?h('p',{className:'rn-muted',style:SMALL},`合计：Σ 贡献 ${fmt(basis.sum)} × 摩擦系数 ${fmt(basis.factor)} = ${fmt(basis.raw)}${result.boundary.rule?' → 边界封顶 30':''} → 关系指数 ${result.index}。维度估计 d = (n·x + 4·0.5) ÷ (n + 4)，没有观测时 d = 0.5。`):null;
  const periodLine=h('p',{className:'rn-muted',style:SMALL},
   `所在周（${weekKey} 起）：${week?.scored?week.index+'（'+(week.ai?'已融合 AI 评定':'仅规则层')+'）':'未评分'}；所在月（${day.date.slice(0,7)}）：${month?.scored?month.index:'未评分'}。月指数把当月各日信号相加后整体评分，不是日指数的平均。`);
  return h('section',{className:'rn-box'},h('h2',null,'打分依据'),toolbar,position,h('div',{className:'rn-metrics'},...metricCards),
   h('h3',null,'为什么是这个分'),h('p',{role:'status'},conclusion(day,result,basis)),periodLine,
   h('h3',null,'分项拆解（关系分析 v3 · 规则层）'),table,total,
   h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}},
    h('button',{type:'button',style:NAV_STYLE,onClick:()=>onOpenRules&&onOpenRules()},'查看完整评分规则'),
    onOpenInsight&&h('button',{type:'button',style:NAV_STYLE,onClick:onOpenInsight},'查看关系分析（含 AI 评定）'),
    h('button',{type:'button',style:NAV_STYLE,onClick:()=>onOpenDaily&&onOpenDaily(day.date)},'打开每日历程')),
   h('p',{className:'rn-muted',style:SMALL},'与每日历程、互动评分、月/年图表和关系分析页同一套公式。AI 评定按周进行，只在关系分析页的周指数中融合。权重与参数未经真实结果校准，不表示好感概率。'));
 };
}
