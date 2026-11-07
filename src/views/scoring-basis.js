const MONTH_FOLD_TURNS=20;
const fmtDelta=value=>{const rounded=Math.round(Math.abs(value)*100)/100;return rounded===0?'0':(value>0?'+':'−')+rounded;};
const signedRow=value=>value>0?'rn-scoring-pos':value<0?'rn-scoring-neg':'rn-muted';
const NAV_STYLE={minHeight:44,minWidth:44,fontSize:13};
const SMALL={fontSize:12};
function monthSummary(days,date){
 const month=date.slice(0,7),rows=days.filter(day=>day.date.slice(0,7)===month);
 if(!rows.length)return null;
 let weight=0,weighted=0,turns=0;
 for(const day of rows){const w=Math.max(1,day.targetTurns||1);weight+=w;weighted+=day.affinityScore*w;turns+=day.targetTurns||0;}
 const raw=weighted/weight,folded=turns<MONTH_FOLD_TURNS&&raw>32,score=folded?Math.round(32+(raw-32)*Math.min(1,turns/MONTH_FOLD_TURNS)):Math.round(raw);
 return {month,days:rows.length,turns,raw:Math.round(raw*10)/10,folded,score};
}
function conclusion(day,breakdown){
 const negatives=breakdown.items.filter(item=>item.hit&&item.delta<0&&item.key!=='clamp').sort((a,b)=>a.delta-b.delta);
 const positives=breakdown.items.filter(item=>item.hit&&item.delta>0&&item.key!=='base');
 if(breakdown.quiet){
  const why=day.targetTurns===0?'对方整天一个回合都没开口':'当天双方合计只有 '+((day.selfTurns||0)+(day.targetTurns||0))+' 个回合';
  return '低频日：'+why+'，且没有正向、提问、分享、有效回应、边界、摩擦或短回复证据，按口径直接记中性 32 分（按信号本应为 '+breakdown.computed+' 分，未采用）。';
 }
 if(breakdown.score<32){
  const parts=negatives.slice(0,4).map(item=>item.label+'（'+fmtDelta(item.delta)+'）').join('、');
  const plus=positives.length?positives.map(item=>item.label+'（'+fmtDelta(item.delta)+'）').join('、'):'无正向线索';
  const empty=breakdown.items.find(item=>item.key==='empty');
  return '当天低于 32 分，命中的负向证据：'+parts+'；正向证据：'+plus+'。对方发言 '+(day.targetTurns||0)+' 轮、来回 '+day.messages.length+' 条'+(empty&&empty.hit?'，包含持续短回复证据':'')+'，按实际证据计分。';
 }
 const neg=negatives.length?negatives.slice(0,3).map(item=>item.label+'（'+fmtDelta(item.delta)+'）').join('、'):'无扣分项';
 return '当天得分 '+breakdown.score+'，从 38 起算。加分：'+(positives.map(item=>item.label+'（'+fmtDelta(item.delta)+'）').join('、')||'无')+'；扣分及折算：'+neg+'。完整加减项见下表。';
}
export function createScoringBasisView(React,E){
 const h=React.createElement;
 return function ScoringBasisView({contact,date='',onDateChange,onOpenDaily,onOpenRules}){
  if(!contact)return h('section',{className:'rn-box'},h('h2',null,'打分依据'),h('p',{className:'rn-muted'},'先选择一个联系人。'));
  const timeline=E.analyzeDailyTimeline(contact.messages||[],contact.self,contact.target,contact.interactionCorrections||[]);
  const days=timeline.days||[];
  if(!days.length)return h('section',{className:'rn-box'},h('h2',null,'打分依据'),h('p',{className:'rn-muted'},'当前联系人还没有带日期的聊天记录，无法拆解打分。'));
  const foundIndex=days.findIndex(day=>day.date===date);
  const index=foundIndex>=0?foundIndex:days.length-1;
  const day=days[index];
  const breakdown=E.interactionScoreBreakdown({positivePoints:day.positivePoints,emotionalSharingTurns:day.emotionalSharingTurns,positiveTurns:day.positiveTurns,questionTurns:day.questionTurns,sharingTurns:day.sharingTurns,boundaryTurns:day.boundaryTurns,responsiveTurns:day.responsiveTurns,answeredTurns:day.answeredTurns,continuedTurns:day.continuedTurns,positive:day.positiveCues,boundary:day.negativeCues,question:day.targetQuestions,sharing:day.targetShares,selfStarts:day.selfStarts,targetStarts:day.targetStarts,medianMinutes:day.medianReplyMinutes,slowReplies:day.slowReplies,perfunctoryReplies:day.perfunctoryReplies,lowContentReplies:day.lowContentReplies,targetTurns:day.targetTurns,selfTurns:day.selfTurns,strongConflict:day.strongConflict,conflictReplies:day.conflictReplies,appeasementReplies:day.appeasementReplies,messages:(day.messages||[]).length,selfMessages:day.selfMessages,targetMessages:day.targetMessages});
  const go=step=>{const next=days[index+step];if(next&&onDateChange)onDateChange(next.date);};
  const evidenceCell=item=>{
   if(!item.hit)return h('span',{className:'rn-muted'},'—');
   const list=item.kind?(day.affinityEvidence||[]).filter(row=>row.kind===item.kind):[];
   if(!list.length)return h('span',{className:'rn-muted'},item.kind?'当天该线索没有独立原文':'无逐条原文，可到「每日历程」看当天记录');
   const quotes=list.map((row,i)=>h('blockquote',{key:i,style:SMALL},row.quote));
   return h('details',null,h('summary',{'aria-label':'展开命中原文'},'命中 '+list.length+' 条原文'),...quotes);
  };
  const metrics=[[day.messages.length,'当天条数'],[day.turns,'交流轮次'],[day.targetTurns||0,'对方回合'],[breakdown.score,'最终分'],[breakdown.score>=32?'≥ 32':breakdown.score>=20?'20 ~ 31':'< 20','分数段']];
  const metricCards=metrics.map(([value,label])=>h('div',{className:'rn-metric',key:label},h('span',{className:'rn-muted'},label),h('strong',null,value)));
  const month=monthSummary(days,day.date);
  const title=h('h2',null,'打分依据');
  const dayButtons=h('div',{style:{display:'flex',gap:8,alignItems:'center'}},
   h('button',{type:'button',style:NAV_STYLE,'aria-label':'前一天',disabled:index<=0,onClick:()=>go(-1)},'‹ 前一天'),
   h('button',{type:'button',style:NAV_STYLE,'aria-label':'后一天',disabled:index>=days.length-1,onClick:()=>go(1)},'后一天 ›'));
  const datePicker=h('label',{style:{width:190}},h('span',null,'选择日期'),h('input',{type:'date',value:day.date,'aria-label':'查看某天的打分依据',onChange:event=>onDateChange&&onDateChange(event.target.value)}));
  const quick=[h('button',{type:'button',style:NAV_STYLE,key:'today',onClick:()=>onDateChange&&onDateChange(days[days.length-1].date)},'回到最近有记录日'),h('button',{type:'button',style:NAV_STYLE,key:'daily',onClick:()=>onOpenDaily&&onOpenDaily(day.date)},'查看当天聊天记录')];
  const toolbar=h('div',{className:'rn-form',style:{display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}},dayButtons,datePicker,quick);
  const position=h('p',{className:'rn-muted',style:SMALL},foundIndex>=0?'第 '+(index+1)+' / '+days.length+' 个有记录日。':day.date+' 没有可识别的记录，已显示最近有记录的一天（'+day.date+'）。');
  const why=h('h3',null,'为什么是这个分');
  const whyText=h('p',{role:'status'},conclusion(day,breakdown));
  const monthLine=month?h('p',{className:'rn-muted',style:SMALL},month.month+' 月均：'+month.days+' 个有记录日、对方回合合计 '+month.turns+' 轮，按对方回合加权平均 '+month.raw+' 分；'+(month.folded?'当月回合不足 '+MONTH_FOLD_TURNS+' 轮，高于 32 的部分按「回合数 ÷ '+MONTH_FOLD_TURNS+'」向 32 折算 → '+month.score+' 分。':'未触发小样本折算（仅当回合不足 '+MONTH_FOLD_TURNS+' 轮且均分高于 32 时折算；低于 32 的均分不向上补）')+'。'):null;
  const tableHead=h('thead',null,h('tr',null,...['项名','触发条件','本项增减分','命中原文'].map((label,i)=>h('th',{key:i},label))));
  const rows=breakdown.items.map(item=>h('tr',{key:item.key},
   h('td',null,h('strong',null,item.label),h('div',{className:'rn-muted',style:SMALL},item.detail)),
   h('td',{style:SMALL},item.condition),
   h('td',{className:signedRow(item.delta)},item.hit?h('strong',null,fmtDelta(item.delta)):h('span',{className:'rn-muted'},'未命中')),
   h('td',null,evidenceCell(item))));
  const table=h('table',{'aria-label':'当天打分分项拆解'},tableHead,h('tbody',null,...rows));
  const totalLine=h('p',{className:'rn-muted',style:SMALL},'合计：38 '+breakdown.items.filter(item=>item.key!=='base').map(item=>fmtDelta(item.delta)).join(' ')+' = '+breakdown.score+' 分。结果限制 0–100；负向组最多扣 60，摩擦组最多扣 24；不足 6 回合的正向部分折算，较强摩擦封顶 48，明确边界封顶 32。分项最多显示两位小数，合计使用未舍入值。');
  const links=h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}},
   h('button',{type:'button',style:NAV_STYLE,onClick:()=>onOpenRules&&onOpenRules()},'查看完整评分规则'),
   h('button',{type:'button',style:NAV_STYLE,onClick:()=>onOpenDaily&&onOpenDaily(day.date)},'打开每日历程'));
  const footnote=h('p',{className:'rn-muted',style:SMALL},'本分与每日历程的好感线索日分同源；互动投入分排除正向表达项，另行计算。权重是工程启发式，不表示好感概率，历史记录按新规则重算。');
  return h('section',{className:'rn-box'},title,toolbar,position,h('div',{className:'rn-metrics'},...metricCards),why,whyText,monthLine,h('h3',null,'分项拆解'),table,totalLine,links,footnote);
 };
}
