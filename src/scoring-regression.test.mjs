import test from 'node:test';
import assert from 'node:assert/strict';
import { engagementSignals, question, conflict, appeasement } from './interaction-signals.js';
import { analyzePeriods, DIMENSIONS } from './affinity/index.js';
import { basisRows } from './views/scoring-basis.js';
import { analyzeDailyTimeline, analyzeConversation } from './analysis.js';
import { analyzeInteractionMetrics, correctInteraction } from './interaction-metrics.js';

const message = (sender, text, time) => ({ sender, text, timestamp: '2026-11-06 ' + time });

test('打分依据明细（维度贡献 × 摩擦系数，边界封顶）与当天指数一致', () => {
  for (const reply of ['好的', '你什么意思', '不要再联系我', '谢谢你，我也很开心', '收到']) {
    const messages = [
      message('我', '你周末有空吗？', '09:00'),
      message('对方', reply, '09:01'),
      message('我', '我今天去跑步了', '09:10'),
      message('对方', reply, '09:11')
    ];
    const [day] = analyzePeriods({ self: '我', target: '对方', messages }, 'day'),
      basis = basisRows(day, DIMENSIONS);
    assert.equal(Math.round(day.boundary.rule ? Math.min(basis.raw, 30) : basis.raw), day.index, reply);
  }
});

test('日历与依据页的回合、有效回应采用同一输入', () => {
  const messages = ['09:00', '09:04', '09:08'].map(time => message('我', '我在准备资料', time));
  messages.push(message('对方', '今天准备把资料全部整理完成', '09:09'));
  const day = analyzeDailyTimeline(messages, '我', '对方').days[0];
  assert.equal(day.selfTurns, 3);
  assert.equal(day.turns, 4);
  assert.equal(analyzeConversation(messages, '我', '对方').scoringTurns, day.turns);
  // 依据页直接读取当天的 v3 结果，与日历同源。
  assert.equal(day.v3.index, day.affinityScore);
  assert.equal(day.v3Signals.target.turns, day.targetTurns);
});

test('引用和转述不构成摩擦或解释，保留自己的独立表达', () => {
  for (const text of ['她说“随便你”', '电影台词是“呵呵”', '他告诉我‘没别的意思’']) {
    assert.equal(conflict(text), false, text);
    assert.equal(appeasement(text), false, text);
  }
  assert.equal(conflict('她说“随便你”。我现在真的无语'), true);
});

test('道谢不遮挡独立问题，反问与纯道谢仍被排除', () => {
  for (const text of ['谢谢你，你今天几点下班？', '谢了。要不要一起吃饭？', '你几点下班？谢谢你'])
    assert.equal(question(text), true, text);
  for (const text of ['谢谢你？', '谢了', '你以为我不知道吗？']) assert.equal(question(text), false, text);
});

test('较强摩擦要求同段重复，解释不升级冲突', () => {
  const paired = (first, second, lastTime) => [
    message('对方', first, '09:00'),
    message('我', '我明白你说的事情了', '09:01'),
    message('对方', second, lastTime)
  ];
  assert.equal(engagementSignals(paired('你什么意思', '无语', '09:02'), '我').strongConflict, true);
  assert.equal(engagementSignals(paired('你什么意思', '没别的意思', '09:02'), '我').strongConflict, false);
  assert.equal(engagementSignals(paired('没别的意思', '你什么意思', '09:02'), '我').strongConflict, false);
  assert.equal(engagementSignals(paired('你什么意思', '无语', '12:00'), '我').strongConflict, false);
  assert.equal(engagementSignals(paired('你什么意思', '没别的意思', '12:00'), '我').strongConflict, false);
});

test('时延仅展示，不直接处罚异步沟通', () => {
  const pairs = delay => [
    message('我', '你几点出门？', '09:00'),
    message('对方', '明天八点出门', '09:' + String(delay).padStart(2, '0')),
    message('我', '我今天去跑步了', '13:00'),
    message('对方', '跑了多远呀？', '13:' + String(delay).padStart(2, '0'))
  ];
  const fast = analyzeInteractionMetrics({ self: '我', target: '对方', messages: pairs(1) });
  const slow = analyzeInteractionMetrics({ self: '我', target: '对方', messages: pairs(55) });
  assert.equal(slow.score, fast.score);
});

test('明确负向、摩擦和解释不重复计入低信息量', () => {
  for (const text of ['呵呵', '你什么意思', '不喜欢你', '没啥啊']) {
    const result = engagementSignals([message('对方', text, '09:00')], '我');
    assert.equal(result.perfunctoryReplies, 0, text);
    assert.equal(result.lowContentReplies, 0, text);
  }
});

test('新增四类回合信号支持纠正恢复且每日总体一致', () => {
  for (const [kind, text] of [
    ['perfunctory', '收到'],
    ['lowContent', '就那样'],
    ['conflict', '你什么意思'],
    ['appeasement', '没别的意思']
  ]) {
    const messages = ['perfunctory', 'lowContent'].includes(kind)
      ? [
          message('我', '补充资料', '09:00'),
          message('对方', text, '09:01'),
          message('我', '补充资料', '09:02'),
          message('对方', text, '09:03'),
          message('我', '补充资料', '09:04'),
          message('对方', text, '09:05')
        ]
      : [message('我', '你好', '09:00'), message('对方', text, '09:01')];
    const contact = { self: '我', target: '对方', messages };
    const indicator = analyzeInteractionMetrics(contact).indicators.find(item => item.kind === kind);
    assert.equal(indicator.count, 1, kind);
    const action = { kind, key: indicator.evidence[0].key, excluded: true };
    const corrected = correctInteraction(contact, action, 0);
    const overall = analyzeInteractionMetrics(corrected);
    assert.equal(overall.indicators.find(item => item.kind === kind).count, 0);
    assert.equal(
      overall.score,
      analyzeDailyTimeline(corrected.messages, '我', '对方', corrected.interactionCorrections).days[0].affinityScore
    );
    const restored = correctInteraction(corrected, { ...action, excluded: false }, 1);
    assert.equal(analyzeInteractionMetrics(restored).indicators.find(item => item.kind === kind).count, 1);
  }
});

test('跨消息合并回合的纠正绑定首消息，保留其他回合', () => {
  const contact = {
    self: '我',
    target: '对方',
    messages: [
      message('对方', '你什么意思', '09:00'),
      message('对方', '无语', '09:01'),
      message('我', '明白了', '09:02'),
      message('对方', '关你什么事', '09:03')
    ]
  };
  const before = analyzeInteractionMetrics(contact);
  const rows = before.indicators.find(item => item.kind === 'conflict').evidence;
  assert.equal(rows.length, 2);
  assert.equal(before.strongConflict, true);
  const after = analyzeInteractionMetrics(
    correctInteraction(contact, { kind: 'conflict', key: rows[0].key, excluded: true }, 0)
  );
  assert.equal(after.conflictReplies, 1);
  assert.equal(after.strongConflict, false);
  assert.equal(after.indicators.find(item => item.kind === 'conflict').evidence[0].quote, '你什么意思 无语');
});
