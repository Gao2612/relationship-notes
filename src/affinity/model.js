// 关系分析 v3 · 评分模型（纯函数）。
//
// 设计原则
// 1. 维度化：以人际亲密过程模型（Reis & Shaver 1988；Laurenceau 等 1998）为骨架，
//    把“好感”拆成可分别观察的互动过程，而不是直接猜测心理状态。
// 2. 证据收缩：每个维度按证据量向中性先验 0.5 收缩（Beta-二项式的经验贝叶斯形式），
//    小样本不会给出极端值，并据此给出区间。
// 3. 近似等权：没有带标签数据可拟合权重时，采用理论排序下接近等权的权重。
//    Dawes（1979, American Psychologist 34:571–582）表明此类“不当线性模型”在缺乏校准数据时稳健。
// 4. AI 只做有引用的补充：LLM 评分必须附逐字原文（宿主端校验），以伪计数融合，且偏离规则层不超过 MAX_SHIFT；
//    AI 不能单独触发边界封顶，只能提示用户核对。
export const MODEL_VERSION='3.0';
export const PRIOR=0.5,PRIOR_STRENGTH=4,MAX_SHIFT=0.25,DISAGREE_AT=0.35,Z80=1.2816;
export const LLM_CONFIDENCE=Object.freeze({low:0.5,medium:1,high:1.5});
export const LLM_PSEUDO_COUNT=4;

const ref=(text,url)=>({text,url});
export const DIMENSIONS=Object.freeze([
 {key:'responsiveness',label:'回应性',weight:0.28,llm:true,
  definition:'对方是否接住你的提问与分享：理解内容、认可、表达关心。',
  rule:'我方提问/分享（连接邀请）后，对方下一回合回答或承接的比例：toward ÷ (toward + away + against)；未回复不计入分母（文字聊天可异步）。',
  refs:[ref('Reis, Clark & Holmes (2004). Perceived partner responsiveness as an organizing construct. Handbook of Closeness and Intimacy.'),ref('Laurenceau, Barrett & Pietromonaco (1998). JPSP 74(5):1238–1251.','https://doi.org/10.1037/0022-3514.74.5.1238'),ref('Gottman & Driver (2005). Dysfunctional marital conflict and everyday marital interaction. J Divorce & Remarriage 43(3–4):63–77.','https://doi.org/10.1300/J087v43n03_04')]},
 {key:'disclosure',label:'自我开示',weight:0.18,llm:true,
  definition:'对方主动讲述自己的经历、想法与感受；感受类开示比事实类更能预测亲密感。',
  rule:'(对方分享回合 + 0.5 × 感受分享回合) ÷ (0.6 × 对方回合)，上限 1。0.6 为饱和参数（产品设定）。',
  refs:[ref('Collins & Miller (1994). Self-disclosure and liking: A meta-analytic review. Psychological Bulletin 116(3):457–475.','https://doi.org/10.1037/0033-2909.116.3.457'),ref('Laurenceau, Barrett & Pietromonaco (1998). JPSP 74(5):1238–1251.','https://doi.org/10.1037/0022-3514.74.5.1238')]},
 {key:'reciprocity',label:'相互性',weight:0.16,llm:true,
  definition:'双方在分享、提问与主动开启对话上是否大致对等。',
  rule:'分享率、提问率、主动开启次数三项各取 1 − |a−b| ÷ (a+b)，再取平均（只看对等，不看谁多）。',
  refs:[ref('Sprecher, Treger, Wondra, Hilaire & Wallpe (2013). Taking turns: Reciprocal self-disclosure promotes liking in initial interactions. JESP 49:860–866.','https://doi.org/10.1016/j.jesp.2013.03.017')]},
 {key:'positivity',label:'积极回应',weight:0.14,llm:true,
  definition:'对方的积极、支持性表达，以及在你分享好消息时的积极建设性回应。',
  rule:'0.5 × min(1, 正向分值 ÷ (2 × 对方回合)) + 0.5 × 好消息获积极回应比例（无此情境时只用前一项）。',
  refs:[ref('Gable, Reis, Impett & Asher (2004). What do you do when things go right? JPSP 87(2):228–245.','https://doi.org/10.1037/0022-3514.87.2.228')]},
 {key:'engagement',label:'主动投入',weight:0.14,llm:true,
  definition:'对方主动开启对话、提问、发出“连接邀请”的程度。',
  rule:'0.5 × 对方主动开启占比 + 0.5 × min(1, 对方邀请回合 ÷ (0.5 × 对方回合))。',
  refs:[ref('Gottman & Driver (2005). J Divorce & Remarriage 43(3–4):63–77.','https://doi.org/10.1300/J087v43n03_04'),ref('Stafford & Canary (1991). Maintenance strategies and romantic relationship type. JSPR 8(2):145–159.','https://doi.org/10.1177/0265407591082001')]},
 {key:'coordination',label:'语言同步',weight:0.10,llm:false,
  definition:'双方虚词使用风格的相似度（LSM）。只作弱信号：中文为近似词表。',
  rule:'九类虚词每 100 字使用率的 1 − |p1−p2| ÷ (p1+p2) 的平均；任一方少于 40 字不计算。',
  refs:[ref('Ireland, Slatcher, Eastwick, Scissors, Finkel & Pennebaker (2011). Language style matching predicts relationship initiation and stability. Psychological Science 22(1):39–44.','https://doi.org/10.1177/0956797610392928')]},
]);
export const FRICTION={key:'friction',label:'摩擦与修复',
 definition:'对方的批评、防御、冷淡等摩擦表达，以及之后是否解释或缓和。摩擦按比例降低综合指数。',
 rule:'摩擦强度 = min(1, 2 × (摩擦回合 + 0.5 × 连续缺少回应回合) ÷ max(4, 对方回合))；修复后按 (1 − 0.5 × 修复比例) 减轻。综合指数 × (1 − 0.6 × 摩擦)。',
 refs:[ref('Gottman & Levenson (1992). Marital processes predictive of later dissolution. JPSP 63(2):221–233.','https://doi.org/10.1037/0022-3514.63.2.221'),ref('Salvatore, Kuo, Steele, Simpson & Collins (2011). Recovering from conflict in romantic relationships. Psychological Science 22(3):376–383.','https://doi.org/10.1177/0956797610397055')]};
export const BOUNDARY_CAP=30;

const clamp01=v=>Math.max(0,Math.min(1,v));
const ratio=(a,b)=>a+b>0?1-Math.abs(a-b)/(a+b):null;
const mean=values=>{const list=values.filter(v=>v!==null&&Number.isFinite(v));return list.length?list.reduce((s,v)=>s+v,0)/list.length:null;};

/** 规则层原始维度值（0–1 或 null）与证据量 n。 */
export function ruleDimensions(week){
 const s=week.self,t=week.target,b=week.bids,out={};
 const bidN=b.toward+b.away+b.against;
 out.responsiveness={value:bidN?b.toward/bidN:null,n:bidN};
 out.disclosure={value:t.turns?clamp01((t.disclosure+0.5*t.emotional)/(0.6*t.turns)):null,n:t.turns};
 const rate=(x,turns)=>turns?x/turns:0;
 const recip=[ratio(rate(s.disclosure,s.turns),rate(t.disclosure,t.turns)),ratio(rate(s.questions,s.turns),rate(t.questions,t.turns)),ratio(s.starts,t.starts)];
 out.reciprocity={value:s.turns&&t.turns?mean(recip):null,n:s.disclosure+t.disclosure+s.questions+t.questions+s.starts+t.starts};
 const pos=t.turns?clamp01(t.positivePoints/(2*t.turns)):null,cap=week.capitalization.opportunities?week.capitalization.constructive/week.capitalization.opportunities:null;
 out.positivity={value:pos===null?null:cap===null?pos:0.5*pos+0.5*cap,n:t.turns+week.capitalization.opportunities};
 const startShare=s.starts+t.starts?t.starts/(s.starts+t.starts):null,bidRate=t.turns?clamp01(t.bids/(0.5*t.turns)):null;
 out.engagement={value:mean([startShare,bidRate]),n:s.starts+t.starts+t.turns};
 out.coordination={value:week.lsm,n:week.lsm===null?0:Math.min(12,Math.floor((week.lsmChars||0)/20))};
 const frictionRaw=t.turns?clamp01(2*(t.conflict+0.5*t.empty)/Math.max(4,t.turns)):0,repair=t.conflict?clamp01(t.repair/t.conflict):0;
 out.friction={value:frictionRaw*(1-0.5*repair),raw:frictionRaw,repair,n:t.turns};
 out.boundary={present:t.boundary>0,count:t.boundary};
 return out;
}

/** 经验贝叶斯收缩：(n·x + k·prior) ÷ (n + k)；同时给出近似标准误。 */
export function shrink(value,n,{prior=PRIOR,strength=PRIOR_STRENGTH}={}){
 const x=value===null||!Number.isFinite(value)?prior:value,count=value===null?0:Math.max(0,n);
 const est=(count*x+strength*prior)/(count+strength);
 return {estimate:est,se:Math.sqrt(est*(1-est)/(count+strength)),n:count};
}
const ratingToUnit=r=>Number.isInteger(r)&&r>=1&&r<=5?(r-1)/4:null;

/**
 * 融合单个维度：规则层（n 个观测）+ AI 评分（伪计数 = 4 × 置信度权重，只在有已校验引用时生效）。
 * 融合结果相对规则层收缩值的偏移被限制在 ±MAX_SHIFT。
 */
export function fuseDimension(rule,ai,{prior=PRIOR}={}){
 const base=shrink(rule.value,rule.n,{prior});
 const aiUnit=ai&&Array.isArray(ai.evidence)&&ai.evidence.length?ratingToUnit(ai.rating):null;
 if(aiUnit===null)return {...base,rule:rule.value,ruleN:rule.n,ai:null,aiConfidence:null,source:'rule',shifted:0,disagreement:false};
 const m=LLM_PSEUDO_COUNT*(LLM_CONFIDENCE[ai.confidence]||LLM_CONFIDENCE.low),ruleCount=rule.value===null?0:rule.n,ruleValue=rule.value===null?prior:rule.value;
 let est=(ruleCount*ruleValue+PRIOR_STRENGTH*prior+m*aiUnit)/(ruleCount+PRIOR_STRENGTH+m);
 const shifted=Math.max(-MAX_SHIFT,Math.min(MAX_SHIFT,est-base.estimate));est=base.estimate+shifted;
 const total=ruleCount+PRIOR_STRENGTH+m;
 return {estimate:est,se:Math.sqrt(est*(1-est)/total),n:ruleCount,rule:rule.value,ruleN:rule.n,ai:aiUnit,aiConfidence:ai.confidence,source:'fused',shifted,
  disagreement:rule.value!==null&&rule.n>=3&&Math.abs(aiUnit-rule.value)>DISAGREE_AT};
}

/**
 * 时段评分（日、周、月、年或全部记录通用）：维度融合 → 综合指数（0–100）与 80% 区间 → 摩擦折减 → 边界封顶。
 * 对方在该时段没有任何回合时，互动过程无从观察：index / low / high 为 null（未评分），而不是给出先验值 50。
 */
export function scoreWeek(week,aiResult=null){
 const rule=ruleDimensions(week),ai=aiResult?.dimensions||{},dims={};
 for(const d of DIMENSIONS)dims[d.key]=fuseDimension(rule[d.key],d.llm?ai[d.key]:null);
 // 摩擦：先验 0（没有证据时视为无摩擦）；AI 摩擦评分 1=无，5=频繁，同样需引用并受偏移上限约束。
 const fr=rule.friction,frBase=fr.n?(fr.n*fr.value)/(fr.n+PRIOR_STRENGTH):0;let friction=frBase,frAi=null;
 const aiF=ai.friction;if(aiF&&Array.isArray(aiF.evidence)&&aiF.evidence.length&&ratingToUnit(aiF.rating)!==null){
  frAi=ratingToUnit(aiF.rating);const m=LLM_PSEUDO_COUNT*(LLM_CONFIDENCE[aiF.confidence]||LLM_CONFIDENCE.low);
  const fused=(fr.n*fr.value+m*frAi)/(fr.n+PRIOR_STRENGTH+m);friction=frBase+Math.max(-MAX_SHIFT,Math.min(MAX_SHIFT,fused-frBase));
  if(aiF.repaired===true)friction*=0.75;
 }
 const totalW=DIMENSIONS.reduce((s,d)=>s+d.weight,0);
 const P=DIMENSIONS.reduce((s,d)=>s+d.weight*dims[d.key].estimate,0)/totalW;
 const seP=Math.sqrt(DIMENSIONS.reduce((s,d)=>s+(d.weight*dims[d.key].se)**2,0))/totalW;
 const factor=1-0.6*friction;
 let index=100*P*factor,low=100*Math.max(0,P-Z80*seP)*factor,high=100*Math.min(1,P+Z80*seP)*factor;
 const boundary=rule.boundary.present,aiBoundary=Boolean(aiResult?.boundary?.present&&aiResult.boundary.evidence?.length);
 if(boundary){index=Math.min(index,BOUNDARY_CAP);low=Math.min(low,BOUNDARY_CAP);high=Math.min(high,BOUNDARY_CAP);}
 const evidenceN=DIMENSIONS.reduce((s,d)=>s+dims[d.key].n,0);
 const scored=week.target.turns>0;
 return {key:week.key??week.start,granularity:week.granularity||'week',start:week.start,end:week.end,scored,index:scored?Math.round(index):null,low:scored?Math.round(low):null,high:scored?Math.round(high):null,se:100*seP*factor,factor,
  dims,friction:{estimate:friction,rule:fr.value,raw:fr.raw,repair:fr.repair,ai:frAi,n:fr.n},
  boundary:{rule:boundary,count:rule.boundary.count,ai:aiBoundary,needsReview:aiBoundary&&!boundary},
  // 可信度按对方回合数与连接邀请数判断（各维度共享同一批回合，不能简单相加）。
  reliability:!scored?'none':week.target.turns>=20&&dims.responsiveness.n>=5?'high':week.target.turns>=8?'medium':'low',evidenceN,targetTurns:week.target.turns,aiUsed:Boolean(aiResult),messages:week.messages};
}

/** 与 scoreWeek 相同，名称更通用：任意时段的 v3 评分。 */
export const scorePeriod=scoreWeek;
