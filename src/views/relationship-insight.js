// 关系分析（v3）视图：规则统计 + AI 上下文评定 + 长期变化 + 可核对证据。
// 视觉上严格区分三类内容：
//   [原文事实] 规则层计数与原文（可打开上下文）
//   [AI 引用]  AI 引用并经宿主逐字校验的原文 + 对这句话的客观描述
//   [AI 推断]  AI 的可能解释，带置信度与替代解释
export function createRelationshipInsightView(React,E){
 const h=React.createElement;
 const pct=v=>v===null||v===undefined||!Number.isFinite(v)?'—':Math.round(v*100);
 const fmt=(v,d=1)=>v===null||v===undefined||!Number.isFinite(v)?'—':(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d);
 const TREND={rising:['上升','rn-tone-up'],falling:['下降','rn-tone-down'],stable:['大致稳定','rn-tone-flat'],insufficient:['数据不足','rn-tone-flat']};
 const RELIABILITY={high:'证据较充分',medium:'证据一般',low:'证据较少',none:'未评分'};
 const scored=p=>Boolean(p)&&!p.gap&&Number.isFinite(p.index);
 const CONF={low:'低',medium:'中',high:'高'};
 const tag=(kind,text)=>h('span',{className:'rn-tag rn-tag-'+kind},text);
 const btn=(label,onClick,props={})=>h('button',{type:'button',onClick,...props},label);

 function percentileOf(weeks,value){const list=weeks.filter(scored).map(w=>w.index);if(list.length<3||value===null)return null;return Math.round(100*list.filter(v=>v<value).length/list.length);}

 function TrendChart({points,changePoints,selected,onSelect}){
  const data=points;if(!data.length)return null;
  const W=720,H=220,L=36,R=12,T=14,B=30,x=i=>L+(data.length===1?(W-L-R)/2:i*(W-L-R)/(data.length-1)),y=v=>T+(100-v)*(H-T-B)/100;
  const band=[],line=[],ew=[];data.forEach((p,i)=>{if(!scored(p))return;band.push([x(i),y(p.high),y(p.low)]);line.push([x(i),y(p.index)]);if(p.ewma!==null)ew.push([x(i),y(p.ewma)]);});
  const path=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=band.length?'M'+band.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')+' L'+[...band].reverse().map(p=>p[0].toFixed(1)+' '+p[2].toFixed(1)).join(' L')+' Z':'';
  const cpStarts=new Set(changePoints.map(c=>c.start)),labelEvery=Math.max(1,Math.ceil(data.length/8));
  return h('svg',{className:'rn-insight-chart',viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'每周关系互动指数与 80% 区间；虚线为平滑趋势；竖线为检测到的变化点'},
   ...[0,25,50,75,100].map(v=>h('g',{key:'g'+v},h('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),className:'rn-insight-grid'}),h('text',{x:L-6,y:y(v)+4,textAnchor:'end',className:'rn-insight-axis'},v))),
   area&&h('path',{d:area,className:'rn-insight-band'}),
   ...data.map((p,i)=>cpStarts.has(p.start)?h('line',{key:'cp'+i,x1:x(i),x2:x(i),y1:T,y2:H-B,className:'rn-insight-cp'}):null),
   ew.length>1&&h('path',{d:path(ew),className:'rn-insight-ewma'}),
   line.length>1&&h('path',{d:path(line),className:'rn-insight-line'}),
   ...data.map((p,i)=>!scored(p)?h('circle',{key:'p'+i,cx:x(i),cy:H-B-4,r:2.5,className:'rn-insight-gap'},h('title',null,p.gap?p.start+' 无记录（缺口）':p.start+' 对方没有发言，未评分')):
    h('circle',{key:'p'+i,cx:x(i),cy:y(p.index),r:p.start===selected?6:4,className:'rn-insight-dot'+(p.start===selected?' selected':''),tabIndex:0,role:'button','aria-label':`${p.start} 周：${p.index}（区间 ${p.low}–${p.high}）`,
     onClick:()=>onSelect(p.start),onKeyDown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.start);}}},h('title',null,`${p.start} 周：${p.index}（80% 区间 ${p.low}–${p.high}）`))),
   ...data.map((p,i)=>i%labelEvery===0||i===data.length-1?h('text',{key:'l'+i,x:x(i),y:H-8,textAnchor:'middle',className:'rn-insight-axis'},p.start.slice(5)):null));
 }

 function Quote({item,onEvidence}){
  return h('li',{className:'rn-insight-quote'},
   h('div',{className:'rn-insight-quote-head'},item.type==='fact'?tag('fact','原文事实'):tag('ai','AI 引用'),item.label&&h('span',null,item.label),item.sender&&h('small',null,item.sender==='target'||item.sender==='self'?(item.sender==='target'?'对方':'我'):item.sender)),
   item.quote&&h('blockquote',null,item.quote),
   item.value&&h('p',{className:'rn-insight-count'},item.value),
   item.note&&h('p',{className:'rn-insight-note'},item.note),
   item.message&&btn('查看原文上下文',()=>onEvidence({messageId:item.messageId,message:item.message,quote:item.quote}),{className:'rn-insight-open'}));
 }

 function Dimension({d,open,onToggle,onEvidence}){
  const f=d.fused,isFriction=d.key==='friction',value=isFriction?d.friction.estimate:f.estimate;
  return h('section',{className:'rn-insight-dim'+(open?' open':'')},
   h('button',{type:'button',className:'rn-insight-dim-head',onClick:onToggle,'aria-expanded':open},
    h('span',{className:'rn-insight-dim-name'},d.label),
    h('span',{className:'rn-insight-bar'+(isFriction?' friction':''),'aria-hidden':true},h('i',{style:{width:pct(value)+'%'}}),
     !isFriction&&f.rule!==null&&h('b',{className:'rn-insight-tick rule',style:{left:pct(f.rule)+'%'},title:'规则层原始值'}),
     !isFriction&&f.ai!==null&&h('b',{className:'rn-insight-tick ai',style:{left:pct(f.ai)+'%'},title:'AI 评定'})),
    h('span',{className:'rn-insight-dim-val'},pct(value)),
    h('span',{className:'rn-insight-dim-meta'},isFriction?`规则 ${pct(d.friction.rule)} · AI ${pct(d.friction.ai)}`:`规则 ${pct(f.rule)}（n=${f.ruleN}）· AI ${pct(f.ai)}${f.aiConfidence?'（置信'+CONF[f.aiConfidence]+'）':''}`),
    !isFriction&&f.disagreement&&h('span',{className:'rn-insight-flag'},'规则与 AI 不一致，请核对')),
   open&&h('div',{className:'rn-insight-dim-body'},
    h('p',null,d.definition),
    h('details',{className:'rn-insight-method'},h('summary',null,'计算方法与研究依据'),h('p',null,h('strong',null,'规则层：'),d.rule),
     !isFriction&&h('p',null,h('strong',null,'融合：'),'规则观测按证据量向中性 0.5 收缩；AI 评分须附逐字原文，以“4 × 置信度”的伪计数加入，且最多使该维度偏移 ±25 分。'),
     h('ul',{className:'rn-insight-refs'},...d.refs.map((r,i)=>h('li',{key:i},r.url?h('a',{href:r.url,target:'_blank',rel:'noreferrer'},r.text):r.text)))),
    h('div',{className:'rn-insight-columns'},
     h('div',null,h('h4',null,tag('fact','原文事实'),' 规则层观察'),d.facts.length?h('ul',{className:'rn-insight-quotes'},...d.facts.map((item,i)=>h(Quote,{key:i,item,onEvidence}))):h('p',{className:'rn-muted'},'本周没有该维度的规则命中。')),
     h('div',null,h('h4',null,tag('ai','AI 引用'),' 上下文评定'),d.observations.length?h('ul',{className:'rn-insight-quotes'},...d.observations.map((item,i)=>h(Quote,{key:i,item,onEvidence}))):h('p',{className:'rn-muted'},d.inference?'AI 认为证据不足，未评分。':'本周尚未进行 AI 分析。'),
      d.inference&&h('div',{className:'rn-insight-inference'},h('div',null,tag('inference','AI 推断'),h('small',null,`评分 ${d.inference.rating??'—'}/5 · 置信 ${CONF[d.inference.confidence]||'—'}`)),h('p',null,d.inference.text),d.inference.alternatives&&h('p',{className:'rn-insight-alt'},h('strong',null,'其他可能：'),d.inference.alternatives))))));
 }

 return function RelationshipInsightView({contact,busy,progress,error,modelReady,onRun,onCancel,onEvidence,onConfigure}){
  const analysis=contact?E.analyzeRelationshipCached(contact):null;
  const [selected,setSelected]=React.useState(null),[openDim,setOpenDim]=React.useState('responsiveness');
  if(!analysis||!analysis.weeks.length)return h('section',{className:'rn-box'},h('h2',null,'关系分析'),h('p',{className:'rn-muted'},'还没有双方可分析的聊天记录。'));
  const weeks=analysis.weeks,current=analysis.current,pick=weeks.find(w=>w.start===selected)||current||weeks.at(-1);
  if(!current)return h('section',{className:'rn-box'},h('h2',null,'关系分析'),h('p',{className:'rn-muted'},'对方还没有可评分的回合：关系指数需要观察对方的回应，暂不评分。'));
  const aiEntry=contact.affinityV3?.weeks?.[pick.start],ai=aiEntry&&pick.ai?aiEntry.result:null;
  const explain=E.explainWeek(pick,pick.week,ai,contact);
  const dims=explain.dimensions.map(d=>d.key==='friction'?{...d,friction:pick.friction}:d);
  const tr=analysis.trend,[trendLabel,trendTone]=TREND[tr.direction],rank=percentileOf(weeks,current.ewma??current.index);
  const pending=analysis.pending.length;
  return h('div',{className:'rn-insight'},
   analysis.boundaryWeeks.length>0&&h('div',{className:'rn-insight-alert',role:'alert'},h('strong',null,'检测到明确的拒绝或边界表达'),h('p',null,`出现在 ${analysis.boundaryWeeks.join('、')} 这几周。相关周的指数已封顶 30。请优先尊重对方表达的边界，不建议依据其他信号继续推进。`)),
   analysis.reviewWeeks.length>0&&h('div',{className:'rn-insight-alert soft'},h('strong',null,'AI 提示可能存在边界表达，请人工核对'),h('p',null,`${analysis.reviewWeeks.join('、')}：规则层未识别到，AI 引用了原文。AI 不会单独触发封顶。`)),
   h('section',{className:'rn-box rn-insight-hero'},
    h('div',{className:'rn-insight-hero-main'},
     h('div',null,h('small',{className:'rn-muted'},'关系互动指数 · 最近一周（平滑）'),h('div',{className:'rn-insight-score'},h('strong',null,Math.round(current.ewma??current.index)),h('span',null,'/ 100')),
      h('p',{className:'rn-muted'},`本周 ${current.index}，80% 区间 ${current.low}–${current.high} · ${RELIABILITY[current.reliability]}（对方 ${current.targetTurns} 个回合）`)),
     h('ul',{className:'rn-insight-facts'},
      h('li',null,h('span',null,'长期趋势'),h('strong',{className:trendTone},trendLabel),tr.slope!==undefined&&h('small',null,`${fmt(tr.slope)} 分/周（80% 区间 ${fmt(tr.low)}～${fmt(tr.high)}，近 ${tr.weeks} 周）`)),
      h('li',null,h('span',null,'相对你们自己的历史'),h('strong',null,rank===null?'—':`高于 ${rank}% 的周`),h('small',null,`共 ${weeks.filter(scored).length} 个已评分周`)),
      h('li',null,h('span',null,'AI 上下文分析'),h('strong',null,`${weeks.filter(w=>w.ai).length} / ${weeks.length} 周`),h('small',null,pending?`${pending} 周待分析`:'全部已分析')))),
    h('div',{className:'rn-insight-actions'},
     busy?h('div',{className:'rn-insight-progress',role:'status'},h('span',null,progress||'正在分析…'),btn('取消',onCancel)):
      modelReady?btn(pending?`AI 分析 ${pending} 周`:'已全部分析',onRun,{className:'primary',disabled:!pending}):h('div',{className:'rn-insight-progress'},h('span',null,'未配置模型：当前只显示规则层结果。'),btn('去设置模型',onConfigure,{className:'primary'})),
     error&&h('p',{className:'rn-error',role:'alert'},error),
     h('p',{className:'rn-insight-legend'},tag('fact','原文事实'),' 规则统计与可核对的原文　',tag('ai','AI 引用'),' 经逐字校验的原文　',tag('inference','AI 推断'),' 可能的解释，可能有误')),
    h('p',{className:'rn-insight-disclaimer'},'指数概括可观察的互动过程（回应、开示、相互性、积极回应、主动投入、语言同步与摩擦），不是“对方喜欢你的概率”。权重来自文献的理论排序，未经你们的数据校准。')),
   h('section',{className:'rn-box'},h('h2',null,'长期变化'),
    h(TrendChart,{points:analysis.points,changePoints:analysis.changePoints,selected:pick.start,onSelect:setSelected}),
    h('p',{className:'rn-insight-chart-legend'},h('span',{className:'sw line'}),'每周指数　',h('span',{className:'sw band'}),'80% 区间　',h('span',{className:'sw ewma'}),'平滑趋势（EWMA）　',h('span',{className:'sw cp'}),'检测到的变化点　',h('span',{className:'sw gap'}),'无记录或未评分的周'),
    analysis.phases.length>1?h('ol',{className:'rn-insight-phases'},...analysis.phases.map((p,i)=>h('li',{key:i},h('div',null,h('strong',null,`${p.start} ～ ${p.end}`),h('small',null,`${p.weeks} 周 · 均值 ${p.index}`),p.change!==undefined&&h('span',{className:p.change>0?'rn-tone-up':'rn-tone-down'},`${fmt(p.change,0)} 分`)),
     p.drivers?.length>0&&h('p',null,'主要变化来自：',p.drivers.map(d=>`${d.label}${d.delta>0?'↑':'↓'}（${fmt(d.impact)} 分）`).join('，'))))):
     h('p',{className:'rn-muted'},analysis.points.filter(scored).length<6?'至少 6 个有记录周后才进行变化点检测。':'未检测到持续的阶段性变化。')),
   h('section',{className:'rn-box'},h('h2',null,`${pick.start} ～ ${pick.end} 的分析依据`),
    h('div',{className:'rn-insight-week-head'},h('span',null,scored(pick)?`指数 ${pick.index}（80% 区间 ${pick.low}–${pick.high}）`:'未评分：对方本周没有发言'),h('span',null,`${pick.messages} 条消息 · ${RELIABILITY[pick.reliability]}`),
     pick.ai?h('span',null,`AI：${pick.ai.model||'DSH 模型'}${pick.ai.sampled&&pick.ai.sampled.sent<pick.ai.sampled.total?`（抽样 ${pick.ai.sampled.sent}/${pick.ai.sampled.total} 条）`:''}`):h('span',null,'仅规则层'),
     weeks.length>1&&h('label',{className:'rn-insight-week-pick'},'选择周',h('select',{value:pick.start,onChange:e=>setSelected(e.target.value)},...[...weeks].reverse().map(w=>h('option',{key:w.start,value:w.start},`${w.start}（${w.index??'未评分'}）`))))),
    explain.summary&&h('div',{className:'rn-insight-summary'},tag('ai','AI 摘要'),h('p',null,explain.summary),explain.uncertainties&&h('p',{className:'rn-insight-alt'},h('strong',null,'局限：'),explain.uncertainties)),
    h('div',{className:'rn-insight-dims'},...dims.map(d=>h(Dimension,{key:d.key,d,open:openDim===d.key,onToggle:()=>setOpenDim(openDim===d.key?'':d.key),onEvidence}))),
    (explain.boundary.facts.length>0||explain.boundary.ai.length>0)&&h('div',{className:'rn-insight-boundary'},h('h4',null,'边界相关原文'),h('ul',{className:'rn-insight-quotes'},...[...explain.boundary.facts,...explain.boundary.ai].map((item,i)=>h(Quote,{key:i,item,onEvidence}))))),
   h('details',{className:'rn-more rn-insight-about'},h('summary',null,'方法、权重与局限'),
    h('table',null,h('thead',null,h('tr',null,h('th',null,'维度'),h('th',null,'权重'),h('th',null,'AI 参与'))),h('tbody',null,...E.DIMENSIONS.map(d=>h('tr',{key:d.key},h('td',null,d.label),h('td',null,Math.round(d.weight*100)+'%'),h('td',null,d.llm?'是':'否'))),h('tr',null,h('td',null,'摩擦与修复'),h('td',null,'× (1 − 0.6 × 摩擦)'),h('td',null,'是')))),
    h('ul',null,
     h('li',null,'综合指数 = 100 × Σ 权重 × 维度估计 × (1 − 0.6 × 摩擦)；明确边界的周最高 30。区间由各维度的二项标准误合成（80%）。'),
     h('li',null,'维度估计按证据量向 0.5 收缩：(n·x + 4·0.5)/(n + 4)，样本少时自然接近中性，不会出现极端值。'),
     h('li',null,'权重按理论重要性排序、接近等权：在没有带标签数据拟合时，这类“不当线性模型”更稳健（Dawes, 1979, American Psychologist 34:571–582）。'),
     h('li',null,'AI 评分必须逐字引用原文（宿主校验，伪造即丢弃），不能输出概率、不能诊断依恋或人格；温度 0.1。AI 只做有限权重的补充，不能单独触发边界封顶。LLM 适合零样本心理文本标注，但与人工一致性有限（Rathje 等, 2024, PNAS；Ziems 等, 2024, Computational Linguistics）。'),
     h('li',null,'趋势：近 8 个有记录周的加权最小二乘斜率；变化点：自启动 CUSUM（k=0.5σ，h=3σ，σ 取相邻周差估计）。都是统计描述，不代表原因。'),
     h('li',null,'局限：文字缺少语气与线下互动；回复慢或消息短不等于冷淡（Morey 等, 2013, Computers in Human Behavior 指出沟通方式与依恋差异有关）；中文虚词表为近似；未经你们的真实结果校准。'),
     h('li',null,'每日历程、互动评分、打分依据和月/年图表使用同一套 v3 规则层公式；AI 评定按周缓存，只融合到本页的周指数中。'))));
 };
}
