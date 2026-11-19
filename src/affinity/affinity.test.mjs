import test from 'node:test';
import assert from 'node:assert/strict';
import { languageStyleMatching, functionWordRates } from './lsm.js';
import { ruleDimensions, shrink, fuseDimension, scoreWeek, DIMENSIONS, MAX_SHIFT, BOUNDARY_CAP } from './model.js';
import { buildWeeklySignals, buildTurns, weekStartKey } from './weekly-signals.js';
import { longitudinal, trend, changePoints, withGaps, ewma } from './longitudinal.js';
import {
  analyzeRelationship,
  buildAffinityRequest,
  storeAiWeek,
  cachedAiWeek,
  explainWeek,
  weekFingerprint,
  selectWeekMessages
} from './index.js';

let seq = 0;
const msg = (sender, text, timestamp) => ({ sender, text, timestamp, messageId: 'id-' + ++seq });
const contact = messages => ({ self: '我', target: '小禾', messages });
// 一周内：我分享好消息→对方祝贺追问；我提问→对方回答；对方主动开启并分享感受。
const warmWeek = day => [
  msg('我', '我今天面试通过了，好开心！', `${day} 10:00:00`),
  msg('小禾', '太好了！恭喜你，是哪家公司呀？', `${day} 10:05:00`),
  msg('我', '周末你有什么安排？', `${day} 11:00:00`),
  msg('小禾', '周末打算去爬山，你要一起吗？', `${day} 11:04:00`),
  msg('小禾', '我最近工作压力好大，有点焦虑', `${day} 20:00:00`),
  msg('我', '辛苦了，要不要聊聊发生了什么？', `${day} 20:06:00`),
  msg('小禾', '谢谢你愿意听我说，真的很感动', `${day} 20:10:00`)
];
const coolWeek = day => [
  msg('我', '我今天面试通过了，好开心！', `${day} 10:00:00`),
  msg('小禾', '哦', `${day} 13:05:00`),
  msg('我', '周末你有什么安排？', `${day} 14:00:00`),
  msg('小禾', '嗯', `${day} 18:04:00`),
  msg('我', '我最近在学做饭，昨天做了红烧肉', `${day} 20:00:00`),
  msg('小禾', '行', `${day} 23:10:00`)
];

test('LSM is symmetric, bounded and refuses tiny samples', () => {
  const a = '我觉得你说的对呀，但是我们还是要再想想吧，这个事情真的很重要啊，你觉得呢？我也不知道怎么办才好。',
    b = '你说的我都懂呢，可是我们也不能太着急吧，这个事情真的很难啊，我觉得还是要慢慢来，你别担心。';
  const ab = languageStyleMatching(a, b),
    ba = languageStyleMatching(b, a);
  assert.ok(ab.value > 0.4 && ab.value <= 1);
  assert.equal(Number(ab.value.toFixed(6)), Number(ba.value.toFixed(6)));
  assert.equal(languageStyleMatching('好', '嗯').value, null);
  assert.equal(functionWordRates('我们和你们').counts.ppron, 2);
});

test('weeks start on Monday in Shanghai time and empty weeks become gaps, not zeros', () => {
  assert.equal(weekStartKey('2026-10-11'), '2026-10-05');
  assert.equal(weekStartKey('2026-10-12'), '2026-10-12');
  const result = analyzeRelationship(contact([...warmWeek('2026-10-06'), ...warmWeek('2026-10-27')]));
  assert.deepEqual(
    result.points.map(p => (p.gap ? 'gap' : p.start)),
    ['2026-10-05', 'gap', 'gap', '2026-10-26']
  );
});

test('rule layer distinguishes turning toward from turning away', () => {
  const warm = ruleDimensions(buildWeeklySignals(contact(warmWeek('2026-10-06')))[0]),
    cool = ruleDimensions(buildWeeklySignals(contact(coolWeek('2026-10-06')))[0]);
  assert.ok(warm.responsiveness.value > cool.responsiveness.value, 'responsiveness');
  assert.ok(warm.disclosure.value > cool.disclosure.value, 'disclosure');
  assert.ok(warm.positivity.value > cool.positivity.value, 'positivity');
  const week = buildWeeklySignals(contact(warmWeek('2026-10-06')))[0];
  assert.equal(week.capitalization.opportunities, 1);
  assert.equal(week.capitalization.constructive, 1);
  assert.ok(week.evidence.responsiveness.every(e => e.messageId && e.quote && e.source === 'rule'));
});

test('shrinkage pulls small samples toward 0.5 and narrows with more evidence', () => {
  assert.equal(shrink(null, 0).estimate, 0.5);
  const small = shrink(1, 1),
    large = shrink(1, 40);
  assert.ok(small.estimate < large.estimate && small.estimate > 0.5);
  assert.ok(shrink(0.8, 40).se < shrink(0.8, 4).se);
});

test('AI ratings need quotes, are weighted by confidence and cannot move a dimension more than MAX_SHIFT', () => {
  const rule = { value: 0.2, n: 20 };
  assert.equal(fuseDimension(rule, { rating: 5, confidence: 'high', evidence: [] }).source, 'rule');
  const low = fuseDimension(rule, { rating: 5, confidence: 'low', evidence: [{ messageId: 'x', quote: 'q' }] }),
    high = fuseDimension(rule, { rating: 5, confidence: 'high', evidence: [{ messageId: 'x', quote: 'q' }] });
  assert.ok(high.estimate > low.estimate);
  const weak = fuseDimension(
    { value: 0, n: 1 },
    { rating: 5, confidence: 'high', evidence: [{ messageId: 'x', quote: 'q' }] }
  );
  assert.ok(Math.abs(weak.shifted) <= MAX_SHIFT + 1e-9);
  assert.equal(
    fuseDimension(
      { value: 0.1, n: 10 },
      { rating: 5, confidence: 'medium', evidence: [{ messageId: 'x', quote: 'q' }] }
    ).disagreement,
    true
  );
});

test('weights sum to 1 and the composite stays within its 80% interval', () => {
  assert.equal(Number(DIMENSIONS.reduce((s, d) => s + d.weight, 0).toFixed(6)), 1);
  const scored = scoreWeek(buildWeeklySignals(contact(warmWeek('2026-10-06')))[0]);
  assert.ok(scored.low <= scored.index && scored.index <= scored.high);
  assert.ok(
    scoreWeek(buildWeeklySignals(contact(warmWeek('2026-10-06')))[0]).index >
      scoreWeek(buildWeeklySignals(contact(coolWeek('2026-10-06')))[0]).index
  );
});

test('explicit boundaries cap the week; an AI-only boundary asks for review instead of capping', () => {
  const messages = [...warmWeek('2026-10-06'), msg('小禾', '以后别再联系我了', `2026-10-08 09:00:00`)];
  const capped = scoreWeek(buildWeeklySignals(contact(messages))[0]);
  assert.equal(capped.boundary.rule, true);
  assert.ok(capped.index <= BOUNDARY_CAP && capped.high <= BOUNDARY_CAP);
  const week = buildWeeklySignals(contact(warmWeek('2026-10-06')))[0];
  const aiOnly = scoreWeek(week, {
    dimensions: {},
    boundary: { present: true, evidence: [{ messageId: 'x', quote: 'q' }] }
  });
  assert.equal(aiOnly.boundary.needsReview, true);
  assert.ok(aiOnly.index > BOUNDARY_CAP);
});

test('friction lowers the index and visible repair softens it', () => {
  const base = warmWeek('2026-10-06'),
    hostile = [
      ...base,
      msg('我', '你怎么又迟到了', `2026-10-09 10:00:00`),
      msg('小禾', '你烦死了', `2026-10-09 10:02:00`)
    ];
  const repaired = [
    ...hostile,
    msg('我', '好吧', `2026-10-09 10:10:00`),
    msg('小禾', '对不起，刚才我语气不好，不是针对你', `2026-10-09 10:20:00`)
  ];
  const a = scoreWeek(buildWeeklySignals(contact(base))[0]),
    b = scoreWeek(buildWeeklySignals(contact(hostile))[0]),
    c = scoreWeek(buildWeeklySignals(contact(repaired))[0]);
  assert.ok(b.friction.estimate > 0, 'friction detected');
  assert.ok(b.index < a.index);
  assert.ok(c.friction.estimate <= b.friction.estimate);
});

test('AI friction with quotes fills a gap the rule lexicon misses, within the shift limit', () => {
  const messages = [
    ...warmWeek('2026-10-06'),
    msg('我', '你怎么又迟到了', `2026-10-09 10:00:00`),
    msg('小禾', '你有病吧', `2026-10-09 10:02:00`)
  ];
  const week = buildWeeklySignals(contact(messages))[0],
    ruleOnly = scoreWeek(week);
  assert.equal(ruleOnly.friction.estimate, 0, 'rule lexicon misses this');
  const id = messages.at(-1).messageId,
    withAi = scoreWeek(week, {
      dimensions: {
        friction: { rating: 4, confidence: 'high', evidence: [{ messageId: id, quote: '你有病吧' }], repaired: false }
      },
      boundary: { present: false, evidence: [] }
    });
  assert.ok(withAi.friction.estimate > 0 && withAi.friction.estimate <= MAX_SHIFT + 1e-9);
  assert.ok(withAi.index < ruleOnly.index);
  const noQuote = scoreWeek(week, {
    dimensions: { friction: { rating: 5, confidence: 'high', evidence: [] } },
    boundary: { present: false, evidence: [] }
  });
  assert.equal(noQuote.friction.estimate, 0, 'AI without quotes is ignored');
});

test('trend needs four weeks and reports rising only when the interval excludes zero', () => {
  const pts = ys =>
    ys.map((y, i) => ({
      start: `2026-0${1 + Math.floor(i / 4)}-${String(1 + (i % 4) * 7).padStart(2, '0')}`,
      index: y,
      se: 3
    }));
  assert.equal(trend(pts([40, 42, 41])).direction, 'insufficient');
  const up = trend([
    { start: '2026-01-05', index: 30, se: 3 },
    { start: '2026-01-12', index: 36, se: 3 },
    { start: '2026-01-19', index: 41, se: 3 },
    { start: '2026-01-26', index: 47, se: 3 },
    { start: '2026-02-02', index: 52, se: 3 }
  ]);
  assert.equal(up.direction, 'rising');
  assert.ok(up.low > 0);
  const flat = trend([
    { start: '2026-01-05', index: 40, se: 3 },
    { start: '2026-01-12', index: 44, se: 3 },
    { start: '2026-01-19', index: 39, se: 3 },
    { start: '2026-01-26', index: 43, se: 3 },
    { start: '2026-02-02', index: 41, se: 3 }
  ]);
  assert.equal(flat.direction, 'stable');
  assert.deepEqual(ewma([10, null, 20], 0.5), [10, 10, 15]);
});

test('CUSUM finds a sustained shift and phases name the dimensions that moved', () => {
  const contactMessages = [];
  for (const day of ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22']) contactMessages.push(...coolWeek(day));
  for (const day of ['2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20']) contactMessages.push(...warmWeek(day));
  const result = analyzeRelationship(contact(contactMessages));
  assert.ok(result.changePoints.length >= 1, 'change point');
  assert.equal(result.changePoints[0].direction, 'up');
  assert.ok(result.phases.length >= 2);
  const last = result.phases.at(-1);
  assert.ok(last.change > 0);
  assert.ok(last.drivers.length >= 1 && last.drivers[0].impact > 0);
  assert.equal(changePoints(withGaps(result.weeks.slice(0, 4))).length, 0, 'needs six weeks');
  const noisy = [40, 44, 38, 42, 41, 39, 43, 40, 42, 38, 44, 39].map((index, i) => ({
    start: new Date(Date.UTC(2026, 0, 5 + 7 * i)).toISOString().slice(0, 10),
    index,
    se: 6
  }));
  assert.deepEqual(changePoints(noisy), [], 'no false alarm on a noisy stable series');
});

test('AI week cache is keyed by message fingerprint and invalidated by edits', () => {
  const c = contact(warmWeek('2026-10-06')),
    week = '2026-10-05',
    fp = weekFingerprint(c, week);
  const stored = storeAiWeek(
    c,
    week,
    {
      result: { dimensions: {}, boundary: { present: false, evidence: [] }, summary: 's', uncertainties: '' },
      provider: 'p',
      model: 'm',
      fingerprint: fp
    },
    1
  );
  assert.ok(cachedAiWeek(stored, week));
  assert.equal(analyzeRelationship(stored).pending.length, 0);
  const edited = { ...stored, messages: [...stored.messages, msg('小禾', '新消息', `2026-10-07 09:00:00`)] };
  assert.equal(cachedAiWeek(edited, week), null);
  assert.deepEqual(analyzeRelationship(edited).pending, [week]);
});

test('AI request is bounded, keeps ids, and prefers turns with signals when sampling', () => {
  const many = [];
  for (let i = 0; i < 120; i++)
    many.push(
      msg(
        i % 2 ? '小禾' : '我',
        i === 61 ? '我最近很难过，想和你说说' : '嗯嗯',
        `2026-10-06 ${String(8 + Math.floor(i / 10)).padStart(2, '0')}:${String((i % 10) * 5).padStart(2, '0')}:00`
      )
    );
  const c = contact(many),
    req = buildAffinityRequest(c, '2026-10-05');
  assert.ok(req.messages.length <= 80);
  assert.equal(req.sampled.total, 120);
  assert.ok(
    req.messages.some(m => m.text.includes('难过')),
    'signal turn kept'
  );
  assert.ok(req.messages.every(m => m.id && ['我', '小禾'].includes(m.sender) && m.text.length <= 300));
  assert.equal(selectWeekMessages(contact(warmWeek('2026-10-06')), '2026-10-05').sampled, false);
});

test('explanations keep facts, AI quotes and AI inferences separate', () => {
  const c = contact(warmWeek('2026-10-06')),
    r = analyzeRelationship(c),
    scored = r.weeks[0];
  const ai = {
    dimensions: {
      responsiveness: {
        rating: 4,
        confidence: 'medium',
        evidence: [{ messageId: c.messages[1].messageId, quote: '恭喜你', note: '祝贺并追问' }],
        inference: '可能在为你高兴。',
        alternatives: '也可能是礼貌。'
      }
    },
    boundary: { present: false, evidence: [] },
    summary: '',
    uncertainties: ''
  };
  const ex = explainWeek(scored, scored.week, ai, c),
    resp = ex.dimensions.find(d => d.key === 'responsiveness');
  assert.ok(resp.facts.length && resp.facts.every(f => f.type === 'fact'));
  assert.equal(resp.observations[0].type, 'ai-quote');
  assert.equal(resp.observations[0].message.text, c.messages[1].text);
  assert.equal(resp.inference.type, 'inference');
  assert.equal(resp.inference.confidence, 'medium');
  assert.ok(ex.dimensions.find(d => d.key === 'friction'));
});

test('turn building merges bursts within three minutes and ignores other senders', () => {
  const turns = buildTurns({
    self: '我',
    target: '小禾',
    messages: [
      msg('我', 'a', '2026-10-06 10:00:00'),
      msg('我', 'b', '2026-10-06 10:02:00'),
      msg('路人', 'c', '2026-10-06 10:03:00'),
      msg('小禾', 'd', '2026-10-06 10:04:00')
    ]
  });
  assert.deepEqual(
    turns.map(t => [t.role, t.messages.length]),
    [
      ['self', 2],
      ['target', 1]
    ]
  );
});

// ── 统一到 v3：任意粒度共用同一套规则层 ──
import {
  analyzePeriods,
  buildDailySignals,
  buildPeriodSignals,
  mergePeriodSignals,
  scorePeriod,
  isScored,
  lsmFromCounts
} from './index.js';
test('日、周、月、年、全部记录共用同一公式：按日信号相加与直接按时段计算完全一致', () => {
  const c = contact([...warmWeek('2026-10-05'), ...coolWeek('2026-10-12'), ...warmWeek('2026-11-02')]);
  const turns = buildTurns(c),
    days = buildDailySignals(c, turns);
  const keyOf = {
    week: key => weekStartKey(key),
    month: key => key.slice(0, 7),
    year: key => key.slice(0, 4),
    all: () => 'all'
  };
  for (const granularity of ['week', 'month', 'year', 'all'])
    for (const period of buildPeriodSignals(c, { granularity, turns })) {
      const merged = mergePeriodSignals(days.filter(day => keyOf[granularity](day.key) === period.key));
      for (const field of ['messages', 'lsm', 'lsmChars'])
        assert.equal(merged[field], period[field], granularity + ' ' + field);
      assert.deepEqual(
        [merged.self.turns, merged.target.turns, merged.bids, merged.capitalization],
        [period.self.turns, period.target.turns, period.bids, period.capitalization]
      );
      assert.equal(scorePeriod(merged).index, scorePeriod(period).index, granularity + ' ' + period.key);
    }
  const weeks = analyzePeriods(c, 'week');
  assert.deepEqual(
    weeks.map(w => w.index),
    analyzeRelationship(c).weeks.map(w => w.index),
    '周粒度与关系分析页一致'
  );
  assert.equal(analyzePeriods(c, 'all').length, 1);
  assert.throws(() => analyzePeriods(c, 'quarter'));
});
test('对方没有回合的时段不评分（不是先验 50），长期变化把它当作缺口', () => {
  const c = contact([
    ...warmWeek('2026-10-05'),
    msg('我', '在吗', '2026-10-13 09:00'),
    msg('我', '看到回我', '2026-10-13 09:01'),
    ...warmWeek('2026-10-19')
  ]);
  const result = analyzeRelationship(c),
    silent = result.weeks.find(w => w.start === '2026-10-12');
  assert.equal(silent.scored, false);
  assert.equal(silent.index, null);
  assert.equal(silent.reliability, 'none');
  assert.equal(isScored(silent), false);
  assert.ok(result.points.filter(isScored).every(p => Number.isFinite(p.index)));
  assert.equal(result.current.start, '2026-10-19');
});
test('LSM 由虚词计数计算，与直接比较文本一致', () => {
  const a = '我们今天一起去看电影吧，你觉得怎么样呢？我也很想去，可是有点累了。',
    b = '好呀，我也想去看，不过今天有点忙，我们明天再去吧，你觉得呢？';
  assert.deepEqual(lsmFromCounts(functionWordRates(a), functionWordRates(b)), languageStyleMatching(a, b));
});
