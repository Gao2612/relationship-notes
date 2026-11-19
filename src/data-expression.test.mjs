import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreBucketState } from './workspace.js';
import { RECOGNITION_RULES } from './views/scoring-rules.js';
import * as E from './client-engine.js';
// 无 DOM 的最小 React：createElement 生成树，renderToStaticMarkup 输出带 class 的文本，足以核对文案与结构。
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) })
};
const renderToStaticMarkup = node =>
  node === null || node === undefined || node === false
    ? ''
    : typeof node !== 'object'
      ? String(node)
      : typeof node.type === 'function'
        ? renderToStaticMarkup(node.type(node.props))
        : '<' +
          node.type +
          (node.props.className ? ' class="' + node.props.className + '"' : '') +
          '>' +
          node.children.map(renderToStaticMarkup).join('') +
          '</' +
          node.type +
          '>';

const source = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8');

test('无记录缺口与「有记录但低分」在趋势判定上分开，低分日仍是实心点', () => {
  assert.equal(scoreBucketState({ recorded: false, averageAffinity: null }), 'gap');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: null }), 'no-score');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: 21 }), 'low');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: 71 }), 'scored');
  assert.notEqual(
    scoreBucketState({ recorded: false, averageAffinity: null }),
    scoreBucketState({ recorded: true, averageAffinity: 21 })
  );
  assert.match(
    source,
    /const makeBucket=label=>\(\{label,self:0,target:0,messages:0,scoreTotal:0,scoreDays:0,averageAffinity:null,recorded:false\}\)/
  );
  assert.match(source, /bucket\.recorded=bucket\.messages>0;return bucket;\}\);/);
  assert.match(source, /gapIndexes=buckets\.map\(\(bucket,index\)=>bucket\.averageAffinity===null\?index:-1\)/);
  assert.match(source, /strokeDasharray:'2 2'/, '缺口用空心虚线点，不落在分数线的连续实线上');
  assert.match(source, /实心点与实线：已评分时段的关系指数，低分同样是实线/);
  assert.match(source, /缺口 = 该时段没有聊天记录，不代表分数下降。/);
});

test('日历把无记录日画成虚线空心格，有记录的低分日保留实线边框按钮', () => {
  assert.match(source, /className:'rn-day-gap',title:date\+' 当天无记录（缺口），不代表分数下降'/);
  assert.match(source, /\.rn-day-gap\{[^}]*border:1px dashed/);
  assert.match(source, /\.rn-day\[data-level="0"\]\{border-color:/);
  assert.match(source, /虚线空心格：当天无记录（缺口），不代表分数下降。/);
  assert.match(source, /缺口=无记录，不代表分数下降/);
});

test('三个图表都带 role=img 与可读标签，数据表兜底保留', () => {
  const openings = source.match(/h\('svg',\{className:'rn-annual-chart'[^}]*\}/g) || [];
  assert.equal(openings.length, 3, '每日历程仍是 3 张图');
  for (const opening of openings) {
    assert.match(opening, /role:'img'/);
    assert.match(opening, /'aria-label':/);
    assert.match(opening, /'aria-labelledby':'rn-(?:score|bar|pie)-chart-title rn-(?:score|bar|pie)-chart-desc'/);
  }
  assert.equal((source.match(/h\('title',\{id:'rn-(?:score|bar|pie)-chart-title'\}/g) || []).length, 3);
  assert.equal((source.match(/h\('desc',\{id:'rn-(?:score|bar|pie)-chart-desc'\}/g) || []).length, 3);
  assert.match(source, /查看完整数据表（'\+buckets\.length\+' 行）/);
});

test('评分规则页展示 v3 公式：数值取自模型常量，不另写一份数字', () => {
  const Rules = E.createScoringRulesView(React, E),
    html = renderToStaticMarkup(React.createElement(Rules, { onRegenerate() {}, onOpenInsight() {} }));
  assert.match(html, /评分规则（关系分析 v3）/);
  for (const d of E.DIMENSIONS) {
    assert.ok(html.includes(d.label), d.label);
    assert.ok(html.includes(Math.round(d.weight * 100) + '%'), d.key);
  }
  assert.ok(html.includes('d = (n·x + ' + E.PRIOR_STRENGTH + '·' + E.PRIOR + ')'));
  assert.ok(html.includes('不超过 ' + E.BOUNDARY_CAP));
  assert.ok(html.includes('±' + E.MAX_SHIFT));
  assert.ok(html.includes('不是“对方喜欢你的概率”'));
  assert.equal(RECOGNITION_RULES.length, 11);
  for (const rule of RECOGNITION_RULES) assert.ok(html.includes(rule.title), rule.id);
  // 旧版 v2.3 的计分口径不再出现在规则页。
  for (const legacy of ['38 分起算', '直接记中性 32 分', '总分封顶 48', '正向四项合计最多 +45'])
    assert.ok(!html.includes(legacy), legacy);
  assert.match(source, /if\(tab==='rules'\)return h\(ScoringRulesView,/);
});

test('评分规则页使用卡片布局，公式单独成块', () => {
  assert.match(source, /\.rn-rule-value\{font-family:ui-monospace/);
  assert.equal((source.match(/\.rn-rule-card\{/g) || []).length >= 1, true);
  const html = renderToStaticMarkup(React.createElement(E.createScoringRulesView(React, E), {}));
  assert.match(html, /class="rn-rules"/);
  assert.match(html, /class="rn-rule-card"/);
  assert.match(html, /class="rn-rule-value"/);
});

test('关系指数与互动均衡分各带口径说明，并声明不是同一标尺', () => {
  assert.match(source, /'口径：只比较双方发言条数是否接近，100 表示条数持平。'/);
  assert.match(source, /'口径：关系分析 v3 规则层，把全部回合合并后评分；50 为缺少证据时的中性值。'/);
  assert.match(source, /互动均衡分与关系指数不是同一标尺，不可直接相比/);
  const why = source.indexOf("className:'rn-metric-why'");
  const note = source.indexOf('互动均衡分按双方发言条数计算；关系指数（关系分析 v3）');
  assert.ok(why > 0 && note > why, '口径解释应贴在指标附近');
  assert.equal(
    (source.match(/互动均衡分按双方发言条数计算；关系指数（关系分析 v3）/g) || []).length,
    1,
    '解释从页底移走后不应重复'
  );
  const box = source.slice(source.indexOf("box('统计依据'"), source.indexOf("button('查看每日历程'"));
  assert.ok(!box.includes('互动均衡分按双方发言条数计算'), '「统计依据」不再重复口径解释');
});

test('每日历程首屏只留主趋势图与关键数字，日历和其余图表默认收起', () => {
  assert.match(source, /const \[moreOpen,setMoreOpen\]=React\.useState\(false\);/);
  assert.match(source, /const buildAnnualPanel=\(\)=>box\('关系指数与互动趋势'/);
  const panel = source.slice(source.indexOf("const buildAnnualPanel=()=>box('关系指数与互动趋势'"));
  const fold = panel.indexOf("h('details',{className:'rn-more',open:moreOpen,onToggle:");
  assert.ok(fold > 0, '缺少「展开更多分析」折叠');
  assert.ok(panel.indexOf('keyFigures') > 0 && panel.indexOf('keyFigures') < fold, '关键数字留在首屏');
  assert.ok(panel.indexOf('scoreGraphic') > 0 && panel.indexOf('scoreGraphic') < fold, '主趋势图留在首屏');
  assert.ok(panel.indexOf('barGraphic') > 0 && panel.indexOf('barGraphic') < fold, '消息量图与趋势图并排留在首屏');
  assert.match(source, /className:'rn-annual-top'/, '首屏两图应双列并排');
  for (const hidden of ['pieGraphic', 'fullTable', 'calendar'])
    assert.ok(panel.indexOf(hidden) > fold, hidden + ' 应折叠');
  assert.match(source, /setMoreOpen\(true\);setSelectedDate\(date\)/, '点图表时段应自动展开折叠区');
});
