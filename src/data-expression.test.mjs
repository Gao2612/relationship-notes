import test from 'node:test';
import assert from 'node:assert/strict';
import { css, scoreBucketState } from './workspace.js';
import { RECOGNITION_RULES } from './views/scoring-rules.js';
import * as E from './client-engine.js';
import { openWorkspace, closeAllWorkspaces } from '../test-support/workspace-dom.mjs';
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

test.afterEach(() => closeAllWorkspaces());

// 每日历程夹具：9 月 28 日、10 月 1 日、10 月 5 日双方都有发言；10 月 3 日只有我发言（有记录但对方无回合，不评分）；
// 其余日期与月份没有记录（缺口）。
const timelineChat = [
  ['2026-09-28', 4, true],
  ['2026-10-01', 6, true],
  ['2026-10-03', 4, false],
  ['2026-10-05', 20, true]
]
  .flatMap(([date, count, replies]) =>
    Array.from(
      { length: count },
      (_, i) =>
        `[${date} 10:${String(i).padStart(2, '0')}] ${i % 2 && replies ? '阿青' : '我'}: ${date} 第 ${i + 1} 条，你喜欢爬山吗？`
    )
  )
  .join('\n');

async function openDaily() {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importText(timelineChat, '我', '阿青');
  await ws.click('记录与评分');
  await ws.click('每日历程');
  return ws;
}
const scoreChart = ws => ws.d.querySelector('svg[aria-labelledby="rn-score-chart-title rn-score-chart-desc"]');
const circleTitles = (svg, dashed) =>
  [...svg.querySelectorAll('circle')]
    .filter(circle => (circle.getAttribute('stroke-dasharray') === '2 2') === dashed)
    .map(circle => circle.querySelector('title')?.textContent);

test('无记录缺口与「有记录但低分」在趋势判定上分开，低分日仍是实心点', async () => {
  assert.equal(scoreBucketState({ recorded: false, averageAffinity: null }), 'gap');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: null }), 'no-score');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: 21 }), 'low');
  assert.equal(scoreBucketState({ recorded: true, averageAffinity: 71 }), 'scored');
  assert.notEqual(
    scoreBucketState({ recorded: false, averageAffinity: null }),
    scoreBucketState({ recorded: true, averageAffinity: 21 })
  );

  // 月视图：没有聊天的月份画成空心虚线点（缺口），已评分月份是实心点，低分也不例外。
  const ws = await openDaily();
  const monthly = scoreChart(ws);
  assert.deepEqual(
    circleTitles(monthly, true),
    ['1', '2', '3', '4', '5', '6', '7', '8', '11', '12'].map(m => m + ' 月：无记录（缺口），不代表分数下降')
  );
  assert.deepEqual(
    circleTitles(monthly, false).map(title => title.replace(/：.*/, '')),
    ['9 月', '10 月']
  );
  const legend = ws.text(monthly.closest('section'));
  assert.match(legend, /实心点与实线：已评分时段的关系指数，低分同样是实线/);
  assert.match(legend, /缺口 = 该时段没有聊天记录，不代表分数下降。/);
  assert.match(ws.text(), /无记录时段（缺口）\s*10 个/);

  // 日视图：有记录但对方没有回合的那天也是空心点，但说明它“有记录、未评分”，不是缺口。
  await ws.click('日');
  const daily = scoreChart(ws);
  assert.deepEqual(circleTitles(daily, true), ['2026-10-03：有记录，但对方没有回合，未评分']);
  assert.equal(circleTitles(daily, false).length, 3);
  assert.match(ws.text(daily.closest('section')), /缺口=无记录，不代表分数下降/);
});

test('日历把无记录日画成虚线空心格，有记录的低分日保留实线边框按钮', async () => {
  const ws = await openDaily();
  const calendar = [...ws.d.querySelectorAll('.rn-calendar-cell')];
  const cell = day =>
    calendar.find(node => node.textContent.startsWith(String(day)) && !node.classList.contains('empty'));
  for (const day of [2, 4, 6]) {
    const gap = cell(day).firstElementChild;
    assert.equal(gap.tagName, 'SPAN', day + ' 日无记录：不可点的空心格');
    assert.ok(gap.classList.contains('rn-day-gap'));
    assert.equal(gap.title, `2026-10-0${day} 当天无记录（缺口），不代表分数下降`);
  }
  for (const day of [1, 3, 5]) {
    const recorded = cell(day).firstElementChild;
    assert.equal(recorded.tagName, 'BUTTON', day + ' 日有记录：可点开当天详情');
    assert.ok(recorded.classList.contains('rn-day'));
  }
  assert.match(ws.text(cell(3)), /未评分/, '有记录但未评分的日子保留实线按钮');
  assert.match(css, /\.rn-day-gap\{[^}]*border:1px dashed/);
  assert.match(css, /\.rn-day\[data-level="0"\]\{border-color:/);
  assert.match(ws.text(), /虚线空心格：当天无记录（缺口），不代表分数下降。/);
});

test('三个图表都带 role=img 与可读标签，数据表兜底保留', async () => {
  const ws = await openDaily();
  const charts = [...ws.d.querySelectorAll('svg.rn-annual-chart')];
  assert.equal(charts.length, 3, '每日历程仍是 3 张图');
  for (const [chart, kind] of charts.map((chart, i) => [chart, ['score', 'bar', 'pie'][i]])) {
    assert.equal(chart.getAttribute('role'), 'img');
    assert.ok(chart.getAttribute('aria-label').length > 10, kind + ' 图有可读标签');
    assert.equal(chart.getAttribute('aria-labelledby'), `rn-${kind}-chart-title rn-${kind}-chart-desc`);
    for (const id of chart.getAttribute('aria-labelledby').split(' ')) {
      const label = ws.d.getElementById(id);
      assert.ok(label && chart.contains(label) && label.textContent.trim(), id + ' 在图内且有文字');
    }
    assert.equal(chart.querySelector(':scope > title').id, `rn-${kind}-chart-title`);
    assert.equal(chart.querySelector(':scope > desc').id, `rn-${kind}-chart-desc`);
  }
  const table = [...ws.d.querySelectorAll('details')].find(node =>
    /查看完整数据表/.test(node.querySelector('summary')?.textContent)
  );
  assert.equal(table.querySelector('summary').textContent, '查看完整数据表（12 行）');
  assert.equal(table.querySelectorAll('tbody tr').length, 12);
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
});

test('评分规则 tab 在工作区里渲染的就是这份规则视图', async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importSample();
  await ws.click('记录与评分');
  await ws.click('评分规则');
  const panel = ws.d.getElementById('rn-panel');
  assert.ok(panel.querySelector('.rn-rules .rn-rule-card .rn-rule-value'));
  assert.match(ws.text(panel), /评分规则（关系分析 v3）/);
  for (const rule of RECOGNITION_RULES) assert.ok(ws.text(panel).includes(rule.title), rule.id);
});

test('评分规则页使用卡片布局，公式单独成块', () => {
  assert.match(css, /\.rn-rule-value\{font-family:ui-monospace/);
  assert.match(css, /\.rn-rule-card\{/);
  const html = renderToStaticMarkup(React.createElement(E.createScoringRulesView(React, E), {}));
  assert.match(html, /class="rn-rules"/);
  assert.match(html, /class="rn-rule-card"/);
  assert.match(html, /class="rn-rule-value"/);
});

test('关系指数与互动均衡分各带口径说明，并声明不是同一标尺', async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importSample();
  await ws.click('记录与评分');
  await ws.click('互动评分');
  const metric = label =>
    [...ws.d.querySelectorAll('.rn-metric')].find(node => node.querySelector('.rn-muted')?.textContent === label);
  assert.equal(
    metric('互动均衡分').querySelector('.rn-metric-note').textContent,
    '口径：只比较双方发言条数是否接近，100 表示条数持平。'
  );
  assert.equal(
    metric('关系指数（全部记录）').querySelector('.rn-metric-note').textContent,
    '口径：关系分析 v3 规则层，把全部回合合并后评分；50 为缺少证据时的中性值。'
  );
  const metrics = metric('互动均衡分').closest('.rn-metrics');
  const scale = ws.d.querySelector('.rn-metric-scale'),
    why = ws.d.querySelector('details.rn-metric-why');
  assert.match(scale.textContent, /互动均衡分与关系指数不是同一标尺，不可直接相比/);
  // 口径解释紧跟指标，而且整页只出现一次，「统计依据」不再重复。
  assert.ok(metrics.nextElementSibling === scale, '「不是同一标尺」紧跟指标');
  assert.ok(scale.nextElementSibling === why, '两个分数的算法说明紧跟其后');
  const note = '互动均衡分按双方发言条数计算；关系指数（关系分析 v3）';
  assert.ok(why.textContent.includes(note));
  assert.equal(ws.text(ws.d.getElementById('rn-panel')).split(note).length - 1, 1, '解释从页底移走后不应重复');
  const basis = [...ws.d.querySelectorAll('.rn-box')].find(
    node => node.querySelector('h2')?.textContent === '统计依据'
  );
  assert.ok(basis, '统计依据');
  assert.ok(!basis.textContent.includes('互动均衡分按双方发言条数计算'), '「统计依据」不再重复口径解释');
});

test('每日历程首屏只留主趋势图与关键数字，日历和其余图表默认收起', async () => {
  const ws = await openDaily();
  const panel = [...ws.d.querySelectorAll('.rn-box')].find(
    node => node.querySelector('h2')?.textContent === '关系指数与互动趋势'
  );
  const more = panel.querySelector('details.rn-more');
  assert.equal(more.open, false, '「展开更多分析」默认收起');
  const outside = node => !more.contains(node);
  assert.ok(outside(panel.querySelector('.rn-annual-figures')), '关键数字留在首屏');
  const top = panel.querySelector('.rn-annual-top');
  assert.ok(outside(top), '首屏两图应双列并排');
  assert.deepEqual(
    [...top.querySelectorAll('svg.rn-annual-chart')].map(svg => svg.getAttribute('aria-labelledby').split('-')[1]),
    ['score', 'bar'],
    '主趋势图与消息量图并排留在首屏'
  );
  assert.ok(more.querySelector('svg[aria-labelledby^="rn-pie-chart"]'), '消息占比图折叠');
  assert.ok(more.querySelector('table'), '完整数据表折叠');
  assert.ok(more.querySelector('.rn-calendar'), '日历折叠');

  // 点图表里的时段：自动展开折叠区并选中该时段的第一天。
  const september = [...top.querySelectorAll('[role="button"]')].find(node =>
    /^9 月，/.test(node.getAttribute('aria-label'))
  );
  ws.w.requestAnimationFrame = () => 0;
  await ws.click(september);
  assert.equal(more.open, true, '点图表时段应自动展开折叠区');
  assert.match(ws.text(), /2026-09-28 · 当天概览/);
  assert.equal(ws.d.querySelector('.rn-calendar-head strong').textContent, '2026 年 9 月');
});
