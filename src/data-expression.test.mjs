import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 AFFINITY_RULE_TEXT,RULE_SECTIONS,parseAffinityRule,joinAffinityRule,splitRuleClauses,splitRuleTerms,splitRuleLines,joinRuleLines,scoreBucketState
} from './workspace.js';

const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8');

test('无记录缺口与「有记录但低分」在趋势判定上分开，低分日仍是实心点',()=>{
 assert.equal(scoreBucketState({recorded:false,averageAffinity:null}),'gap');
 assert.equal(scoreBucketState({recorded:true,averageAffinity:null}),'no-score');
 assert.equal(scoreBucketState({recorded:true,averageAffinity:21}),'low');
 assert.equal(scoreBucketState({recorded:true,averageAffinity:71}),'scored');
 assert.notEqual(scoreBucketState({recorded:false,averageAffinity:null}),scoreBucketState({recorded:true,averageAffinity:21}));
 assert.match(source,/const makeBucket=label=>\(\{label,self:0,target:0,messages:0,scoreTotal:0,scoreDays:0,averageAffinity:null,recorded:false\}\)/);
 assert.match(source,/bucket\.recorded=bucket\.messages>0;return bucket;\}\);/);
 assert.match(source,/gapIndexes=buckets\.map\(\(bucket,index\)=>bucket\.averageAffinity===null\?index:-1\)/);
 assert.match(source,/strokeDasharray:'2 2'/,'缺口用空心虚线点，不落在分数线的连续实线上');
 assert.match(source,/实心点与实线：有记录时段的均分，低分同样是实线/);
 assert.match(source,/缺口 = 该时段没有聊天记录，不代表分数下降。/);
});

test('日历把无记录日画成虚线空心格，有记录的低分日保留实线边框按钮',()=>{
 assert.match(source,/className:'rn-day-gap',title:date\+' 当天无记录（缺口），不代表分数下降'/);
 assert.match(source,/\.rn-day-gap\{[^}]*border:1px dashed/);
 assert.match(source,/\.rn-day\[data-level="0"\]\{border-color:/);
 assert.match(source,/虚线空心格：当天无记录（缺口），不代表分数下降。/);
 assert.match(source,/缺口=无记录，不代表分数下降/);
});

test('三个图表都带 role=img 与可读标签，数据表兜底保留',()=>{
 const openings=source.match(/h\('svg',\{className:'rn-annual-chart'[^}]*\}/g)||[];
 assert.equal(openings.length,3,'每日历程仍是 3 张图');
 for(const opening of openings){
  assert.match(opening,/role:'img'/);
  assert.match(opening,/'aria-label':/);
  assert.match(opening,/'aria-labelledby':'rn-(?:score|bar|pie)-chart-title rn-(?:score|bar|pie)-chart-desc'/);
 }
 assert.equal((source.match(/h\('title',\{id:'rn-(?:score|bar|pie)-chart-title'\}/g)||[]).length,3);
 assert.equal((source.match(/h\('desc',\{id:'rn-(?:score|bar|pie)-chart-desc'\}/g)||[]).length,3);
 assert.match(source,/查看完整数据表（'\+buckets\.length\+' 行）/);
});

test('评分规则改成逐项卡片，原始数值与措辞逐字保留且可原样拼回',()=>{
 assert.equal(RULE_SECTIONS.length,11);
 assert.deepEqual(RULE_SECTIONS.map(section=>section.title),['好感线索分','互动均衡分','主动开口','回复间隔','敷衍程度','单方独白','摩擦/冷战','交流轮次','直接提问','第一人称分享','明确边界']);
 assert.equal(RULE_SECTIONS[1].value,'round(100 × (1 − |我方条数 − 对方条数| ÷ 总条数))');
 const parsed=parseAffinityRule();
 assert.equal(parsed.terms.length,13,'公式包括时延去重共 13 个加减项');
 assert.equal(parsed.notes.length,5,'封顶/折算/低频/加权/纠正 5 条口径');
 assert.equal(joinAffinityRule(parsed),AFFINITY_RULE_TEXT,'拆项拼回必须与原规则逐字一致');
 assert.equal(splitRuleClauses(AFFINITY_RULE_TEXT).length,6);
 for(const term of parsed.terms)assert.ok(term.text.length<=60,'公式单项过长：'+term.text);
 assert.deepEqual(splitRuleTerms('38 + 1 × A − 2 × B').map(term=>term.sign+':'+term.text),[':38','+:1 × A','−:2 × B']);
 for(const note of parsed.notes){
  const lines=splitRuleLines(note);
  assert.equal(joinRuleLines(lines),note,'断行不得改动原文');
  for(const line of lines)assert.ok(line.length<=70,'口径断行过长：'+line);
 }
 for(const section of RULE_SECTIONS.filter(item=>item.detail)){
  assert.equal(splitRuleClauses(section.detail).join('；'),section.detail);
  for(const clause of splitRuleClauses(section.detail)){
   const lines=splitRuleLines(clause);
   assert.equal(joinRuleLines(lines),clause);
   for(const line of lines)assert.ok(line.length<=70,'说明断行过长：'+line);
  }
 }
 for(const rule of ['扣分合计最多 −60','结果限制在 0–100','直接记中性 32 分','与「单方独白 −18」取较大值，不叠加','一两句寒暄撑不起整月','每处扣 30（最多 60）','总分封顶 48'])assert.ok(AFFINITY_RULE_TEXT.includes(rule)||RULE_SECTIONS.some(section=>(section.detail||'').includes(rule)),'规则措辞缺失：'+rule);
});

test('评分规则页不再用两列表格，公式单独成等宽块',()=>{
 assert.doesNotMatch(source,/if\(tab==='rules'\)return box\('评分与识别规则',h\('table'/);
 assert.match(source,/className:'rn-rules'/);
 assert.match(source,/className:'rn-rule-card'/);
 assert.match(source,/className:'rn-rule-formula'/);
 assert.match(source,/className:'rn-rule-value'/);
 assert.match(source,/\.rn-rule-value\{font-family:ui-monospace/);
 assert.match(source,/\.rn-rule-formula li\{font-family:ui-monospace/);
 assert.equal((source.match(/\.rn-rule-card\{/g)||[]).length>=1,true);
});

test('互动投入均分与互动均衡分各带口径说明，并声明不是同一标尺',()=>{
 assert.match(source,/'口径：只比较双方发言条数是否接近，100 表示条数持平。'/);
 assert.match(source,/'口径：按回应、提问、分享及回合计算投入，38 分起算，明确正向表达另列证据。'/);
 assert.match(source,/互动均衡分与互动投入均分不是同一标尺，不可直接相比/);
 const why=source.indexOf("className:'rn-metric-why'");
 const note=source.indexOf('互动均衡分按双方发言条数计算；投入分结合上下文');
 assert.ok(why>0&&note>why,'口径解释应贴在指标附近');
 assert.equal((source.match(/互动均衡分按双方发言条数计算；投入分结合上下文/g)||[]).length,1,'解释从页底移走后不应重复');
 const box=source.slice(source.indexOf("box('统计依据'"),source.indexOf("button('查看每日历程'"));
 assert.ok(!box.includes('互动均衡分按双方发言条数计算'),'「统计依据」不再重复口径解释');
});

test('每日历程首屏只留主趋势图与关键数字，日历和其余图表默认收起',()=>{
 assert.match(source,/const \[moreOpen,setMoreOpen\]=React\.useState\(false\);/);
 assert.match(source,/const buildAnnualPanel=\(\)=>box\('好感度与互动趋势'/);
 const panel=source.slice(source.indexOf("const buildAnnualPanel=()=>box('好感度与互动趋势'"));
 const fold=panel.indexOf("h('details',{className:'rn-more',open:moreOpen,onToggle:");
 assert.ok(fold>0,'缺少「展开更多分析」折叠');
 assert.ok(panel.indexOf('keyFigures')>0&&panel.indexOf('keyFigures')<fold,'关键数字留在首屏');
 assert.ok(panel.indexOf('scoreGraphic')>0&&panel.indexOf('scoreGraphic')<fold,'主趋势图留在首屏');
 assert.ok(panel.indexOf('barGraphic')>0&&panel.indexOf('barGraphic')<fold,'消息量图与趋势图并排留在首屏');
 assert.match(source,/className:'rn-annual-top'/,'首屏两图应双列并排');
 for(const hidden of ['pieGraphic','fullTable','calendar'])assert.ok(panel.indexOf(hidden)>fold,hidden+' 应折叠');
 assert.match(source,/setMoreOpen\(true\);setSelectedDate\(date\)/,'点图表时段应自动展开折叠区');
});
