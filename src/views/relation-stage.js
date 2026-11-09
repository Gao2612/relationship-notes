export function createRelationStageView(React,E){
 const h=React.createElement;
 return function RelationStageView({contact,onAction,onEvidence,now}){
  const profile=E.relationProfile(contact);
  const [label,setLabel]=React.useState(profile.label);
  const [context,setContext]=React.useState(profile.context);
  const [expectation,setExpectation]=React.useState(profile.expectation);
  const [stage,setStage]=React.useState(profile.stageOverride?profile.stageOverride.stage:'');
  const [note,setNote]=React.useState(profile.stageOverride?profile.stageOverride.note:'');
  React.useEffect(()=>{const next=E.relationProfile(contact);setLabel(next.label);setContext(next.context);setExpectation(next.expectation);setStage(next.stageOverride?next.stageOverride.stage:'');setNote(next.stageOverride?next.stageOverride.note:'');},[contact?.id]);
  const result=E.buildRelationStage(contact,{now}),percent=Math.round(result.confidence*100);
  const metrics=[['互动天数',result.metrics.days],['回合数',result.metrics.turns],['平均线索分',result.metrics.averageScore===null?'—':result.metrics.averageScore],['对方主动占比',Math.round(result.metrics.targetInitRatio*100)+'%'],['情绪分享轮次',result.metrics.emotionalSharingTurns],['事后解释',result.metrics.repairs]];
  return h('section',{className:'rn-box'},
   h('h2',null,'关系画像与阶段'),
   h('p',{className:'rn-stage-current'},'当前阶段：',h('strong',null,result.label),result.manual?' · 你手动设定':' · 自动判定 · 可信度 '+percent+'%'),
   result.manual&&h('p',{className:'rn-muted'},'自动判定为「'+result.autoLabel+'」，已被你的设定覆盖；重新分析不会改写它。'),
   result.stage==='unknown'
    ?h('p',{role:'status'},'还没有确认两个不同的发言人，无法判定阶段。')
    :h('div',null,
     h('p',null,'证据区间：线索分 '+(result.band?result.band[0]+'–'+result.band[1]:'—')+(result.metrics.averageScore===null?'':'（本次 '+result.metrics.averageScore+'）')),
     h('ul',{className:'rn-stage-reasons'},...result.reasons.map((reason,index)=>h('li',{key:index},reason.text,reason.evidence&&onEvidence&&h('button',{type:'button',onClick:()=>onEvidence(reason.evidence)},'查看原文')))),
     h('dl',{className:'rn-stage-metrics'},...metrics.flatMap(([key,value])=>[h('dt',{key},key),h('dd',{key:key+'-value'},String(value))]))),
   h('div',{className:'rn-form'},
    h('label',null,'对方称谓（你怎么称呼 TA）',h('input',{value:label,maxLength:60,'aria-label':'对方称谓',placeholder:'例如：小林 / 组长 / 老妈',onChange:event=>setLabel(event.target.value)})),
    h('label',null,'相处语境（在哪认识、平时聊什么）',h('textarea',{value:context,rows:2,maxLength:300,'aria-label':'相处语境',onChange:event=>setContext(event.target.value)})),
    h('label',null,'期望走向（你想把关系带到哪）',h('textarea',{value:expectation,rows:2,maxLength:300,'aria-label':'期望走向',onChange:event=>setExpectation(event.target.value)}))),
   h('div',{className:'rn-actions'},h('button',{type:'button',className:'primary',onClick:()=>onAction({type:'setProfile',label,context,expectation})},'保存关系画像')),
   h('div',{className:'rn-form'},
    h('label',null,'手动设定阶段',h('select',{value:stage,'aria-label':'手动设定阶段',onChange:event=>setStage(event.target.value)},h('option',{value:''},'不手动设定（按规则自动判定）'),...E.relationStageOptions().map(option=>h('option',{key:option.key,value:option.key},option.label)))),
    h('label',null,'设定原因（会写进判定依据）',h('input',{value:note,maxLength:200,'aria-label':'设定原因',onChange:event=>setNote(event.target.value)}))),
   h('div',{className:'rn-actions'},
    h('button',{type:'button',disabled:!stage,onClick:()=>onAction({type:'setStage',stage,note})},'保存阶段设定'),
    result.manual&&h('button',{type:'button',onClick:()=>onAction({type:'clearStage'})},'清除手动设定')),
   h('p',{className:'rn-muted'},result.disclaimer));
 };
}
