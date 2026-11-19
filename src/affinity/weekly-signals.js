// 关系分析 v3 · 规则层：按周汇总双方可观察的互动事实。
// 只做计数与原文定位，不解释心理。每条证据都带 messageId 与原文，供界面回到上下文核对。
import { scoringMessage } from '../interaction-context.js';
import {
  question,
  sharing,
  emotionalSharing,
  positiveSignal,
  conflict,
  appeasement,
  negative,
  engagementSignals
} from '../interaction-signals.js';
import { interactionCorrectionIndex, isInteractionExcluded } from '../interaction-metrics.js';
import { shanghaiTimestamp, shanghaiDateKey } from '../shared/dates.js';
import { messageIdentity } from '../message-identity.js';
import { functionWordRates, lsmFromCounts, LSM_CATEGORIES } from './lsm.js';

export const TURN_MERGE_MINUTES = 3; // 与现有评分一致：同一人 3 分钟内连发合并为一轮
export const SESSION_GAP_MINUTES = 120; // 与现有评分一致：间隔 ≥2 小时开启新对话段
export const EVIDENCE_PER_KIND = 4;
// 好消息/积极事件（用于识别 capitalization 情境，Gable 等 2004）。只作为“我方分享好消息”的候选。
// 修复：只会减轻摩擦，误判代价低，因此在 v3 层补充常见致歉/澄清说法；摩擦词表不扩展（误判代价高，交给 AI 层）。
const APOLOGY = /(对不起|抱歉|不好意思|我错了|是我不对|我不是那个意思|不是针对你|别生气|刚才.{0,6}(?:冲|不好|过分|急))/;
const GOOD_NEWS =
  /(好消息|太好了|开心|高兴|成功|通过了|过了|拿到|录取|升职|加薪|中了|搞定|完成了|终于|获奖|得奖|被夸|表扬)/;

/** 周一为一周开始，返回该周周一的上海日期 YYYY-MM-DD。 */
export function weekStartKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
  const date = new Date(dateKey + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function addDays(dateKey, days) {
  const date = new Date(dateKey + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const clip = (text, n) => {
  const chars = Array.from(String(text || ''));
  return chars.length > n ? chars.slice(0, n).join('') + '…' : chars.join('');
};
function evidenceOf(turn, kind, label) {
  const message = turn.messages.find(m => m.text?.trim()) || turn.messages[0];
  return {
    kind,
    label,
    messageId: messageIdentity(message),
    quote: clip(turn.text, 140),
    sender: turn.role,
    timestamp: message.timestamp ?? null,
    source: 'rule'
  };
}

const emptyWords = () => ({ chars: 0, counts: Object.fromEntries(Object.keys(LSM_CATEGORIES).map(key => [key, 0])) });
/** 空的时段汇总。day / week / month / year / all 使用同一结构，计数可直接相加。 */
export function emptyPeriod(start, end = start, key = start) {
  return {
    key,
    start,
    end,
    messages: 0,
    messageIds: [],
    self: {
      turns: 0,
      chars: 0,
      disclosure: 0,
      emotional: 0,
      questions: 0,
      bids: 0,
      starts: 0,
      goodNews: 0,
      words: emptyWords()
    },
    target: {
      turns: 0,
      chars: 0,
      disclosure: 0,
      emotional: 0,
      questions: 0,
      bids: 0,
      starts: 0,
      positivePoints: 0,
      positiveTurns: 0,
      responsive: 0,
      conflict: 0,
      repair: 0,
      boundary: 0,
      empty: 0,
      words: emptyWords()
    },
    bids: { toward: 0, away: 0, against: 0, unanswered: 0 },
    capitalization: { opportunities: 0, constructive: 0 },
    evidence: {
      responsiveness: [],
      disclosure: [],
      reciprocity: [],
      positivity: [],
      engagement: [],
      friction: [],
      boundary: []
    }
  };
}
// 每个维度最多 6 条，每种类型最多 2 条：正反两类例子都能看到，而不是只看到最早出现的那几条。
export const EVIDENCE_PER_DIMENSION = 6;
function pushEvidence(week, dimension, item) {
  const list = week.evidence[dimension];
  if (
    list.length >= EVIDENCE_PER_DIMENSION ||
    list.filter(e => e.kind === item.kind).length >= 2 ||
    list.some(e => e.messageId === item.messageId && e.kind === item.kind)
  )
    return;
  list.push(item);
}

/**
 * 把双方消息合并为回合，并标注规则层信号。
 * 对方回合的“回答/承接/摩擦/解释/敷衍”沿用现有 engagementSignals 的判定与人工纠正，保持两套评分口径一致。
 */
export function buildTurns(contact = {}) {
  const self = contact.self,
    target = contact.target,
    messages = Array.isArray(contact.messages) ? contact.messages : [];
  if (!self || !target || self === target) return [];
  const list = messages
    .filter(m => m && typeof m.text === 'string' && scoringMessage(m) && (m.sender === self || m.sender === target))
    .map((m, index) => ({ m, index, at: shanghaiTimestamp(m.timestamp) }))
    .filter(row => row.at !== null)
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(row => ({ ...row.m, _at: row.at }));
  const corrections = interactionCorrectionIndex(contact.interactionCorrections || [], list);
  const excluded = (message, kind) => isInteractionExcluded(message, kind, corrections);
  const engagement = engagementSignals(list, self, excluded);
  const targetTurnInfo = new Map();
  for (const turn of engagement.turnEvidence || []) targetTurnInfo.set(messageIdentity(turn.message), turn);
  const turns = [];
  let previous = null;
  for (const message of list) {
    const role = message.sender === self ? 'self' : 'target',
      at = message._at;
    const sameTurn = previous && previous.role === role && at - previous.lastAt <= TURN_MERGE_MINUTES * 60000;
    if (sameTurn) {
      previous.messages.push(message);
      previous.lastAt = at;
      continue;
    }
    const newSession = !previous || at - previous.lastAt >= SESSION_GAP_MINUTES * 60000;
    previous = { role, messages: [message], at, lastAt: at, newSession };
    turns.push(previous);
  }
  for (const turn of turns) {
    turn.text = turn.messages
      .map(m => String(m.text || '').trim())
      .filter(Boolean)
      .join(' ');
    turn.date = shanghaiDateKey(turn.messages[0].timestamp);
    turn.week = weekStartKey(turn.date);
    turn.words = functionWordRates(turn.text);
    const any = (detect, kind) =>
      turn.messages.some(m => detect(m.text) && !(turn.role === 'target' && excluded(m, kind)));
    const signals = {
      question: any(question, 'question'),
      disclosure: any(sharing, 'sharing'),
      emotional: any(emotionalSharing, 'sharing'),
      boundary: any(negative, 'boundary'),
      positiveWeight: Math.max(
        0,
        ...turn.messages.map(m =>
          turn.role === 'target' && excluded(m, 'positive') ? 0 : positiveSignal(m.text).weight
        )
      )
    };
    if (turn.role === 'target') {
      // 对方回合可能被 engagementSignals 以首条消息为键记录；合并口径不同时退回本地探测。
      const info = turnInfoFor(turn, targetTurnInfo);
      const applied = info?.applied || [];
      signals.responsive =
        !signals.boundary &&
        !applied.includes('conflict') &&
        (applied.includes('answer') || applied.includes('continuation'));
      signals.conflict = info ? applied.includes('conflict') : conflict(turn.text);
      signals.repair = (info ? applied.includes('appeasement') : appeasement(turn.text)) || APOLOGY.test(turn.text);
      signals.empty = applied.includes('perfunctory') || applied.includes('lowContent');
    } else {
      // 我方好消息：现有分享词表较保守，这里额外认可“第一人称 + 积极事件”的表述（只用于 capitalization 情境识别）。
      signals.goodNews = GOOD_NEWS.test(turn.text) && /我/.test(turn.text);
      if (signals.goodNews) signals.disclosure = true;
    }
    // “连接邀请”（bid）：提问或主动分享，Gottman & Driver（2005）的 bids 概念在文字聊天中的可观察近似。
    signals.bid = signals.question || signals.disclosure;
    turn.signals = signals;
  }
  return turns;
}
function turnInfoFor(turn, map) {
  for (const message of turn.messages) {
    const info = map.get(messageIdentity(message));
    if (info) return info;
  }
  return null;
}

/** 时段键：day = 日期，week = 周一日期，month = YYYY-MM，year = YYYY，all = 全部记录。 */
export const PERIODS = Object.freeze(['day', 'week', 'month', 'year', 'all']);
export function periodKey(turn, granularity) {
  if (!turn.date) return null;
  if (granularity === 'day') return turn.date;
  if (granularity === 'week') return turn.week;
  if (granularity === 'month') return turn.date.slice(0, 7);
  if (granularity === 'year') return turn.date.slice(0, 4);
  if (granularity === 'all') return 'all';
  throw new Error('未知时段：' + granularity);
}
function periodRange(key, granularity, turns) {
  if (granularity === 'day') return [key, key];
  if (granularity === 'week') return [key, addDays(key, 6)];
  if (granularity === 'month') {
    const [y, m] = key.split('-').map(Number);
    return [key + '-01', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)];
  }
  if (granularity === 'year') return [key + '-01-01', key + '-12-31'];
  const dates = turns
    .map(t => t.date)
    .filter(Boolean)
    .sort();
  return [dates[0] || null, dates.at(-1) || null];
}
function addWords(into, from) {
  into.chars += from.chars;
  for (const key of Object.keys(into.counts)) into.counts[key] += from.counts[key] || 0;
}
function finishPeriod(period) {
  const lsm = lsmFromCounts(period.self.words, period.target.words);
  period.lsm = lsm.value;
  period.lsmChars = Math.min(lsm.selfChars, lsm.targetChars);
  period.evidence.reciprocity = period.evidence.reciprocity.filter(e => e.kind !== 'counts');
  pushReciprocityEvidence(period);
  return period;
}

/**
 * 按时段聚合规则层信号；没有任何消息的时段不生成（界面显示为缺口，而非 0 分）。
 * 连接邀请、好消息情境与主动开启都归入发起回合所在的时段，因此按日汇总后再相加，与直接按周/月计算结果一致。
 */
export function buildPeriodSignals(contact = {}, { granularity = 'week', turns = buildTurns(contact) } = {}) {
  const periods = new Map(),
    members = new Map();
  const periodOf = turn => {
    const key = periodKey(turn, granularity);
    if (!key) return null;
    if (!periods.has(key)) {
      periods.set(key, emptyPeriod(null, null, key));
      members.set(key, []);
    }
    members.get(key).push(turn);
    return periods.get(key);
  };
  turns.forEach((turn, i) => {
    const week = periodOf(turn);
    if (!week) return;
    const side = week[turn.role],
      s = turn.signals;
    week.messages += turn.messages.length;
    for (const m of turn.messages) week.messageIds.push(messageIdentity(m));
    side.turns++;
    side.chars += Array.from(turn.text).length;
    addWords(side.words, turn.words || functionWordRates(turn.text));
    if (turn.newSession) side.starts++;
    if (s.disclosure) side.disclosure++;
    if (s.emotional) side.emotional++;
    if (s.question) side.questions++;
    if (s.bid) side.bids++;
    if (turn.role === 'target') {
      if (s.disclosure)
        pushEvidence(
          week,
          'disclosure',
          evidenceOf(
            turn,
            s.emotional ? 'emotional' : 'disclosure',
            s.emotional ? '对方分享了自己的感受' : '对方分享了自己的经历或想法'
          )
        );
      if (s.positiveWeight) {
        side.positivePoints += s.positiveWeight;
        side.positiveTurns++;
        pushEvidence(
          week,
          'positivity',
          evidenceOf(
            turn,
            'positive',
            s.positiveWeight >= 6 ? '直接的亲近表达' : s.positiveWeight >= 4 ? '支持或具体感谢' : '礼貌或轻度积极表达'
          )
        );
      }
      if (s.responsive) side.responsive++;
      if (s.conflict) {
        side.conflict++;
        pushEvidence(week, 'friction', evidenceOf(turn, 'conflict', '摩擦表达'));
      }
      if (s.repair) {
        side.repair++;
        pushEvidence(week, 'friction', evidenceOf(turn, 'repair', '解释或缓和'));
      }
      if (s.boundary) {
        side.boundary++;
        pushEvidence(week, 'boundary', evidenceOf(turn, 'boundary', '明确的拒绝或边界'));
      }
      if (s.empty) {
        side.empty++;
        pushEvidence(week, 'friction', evidenceOf(turn, 'empty', '敷衍或低信息量回合'));
      }
      if (turn.newSession || s.question)
        pushEvidence(
          week,
          'engagement',
          evidenceOf(turn, turn.newSession ? 'start' : 'question', turn.newSession ? '对方主动开启对话' : '对方提问')
        );
    } else if (s.goodNews) side.goodNews++;
    // 我方连接邀请 → 下一回合对方的回应方式（toward / away / against / 未回复）。
    if (turn.role === 'self' && s.bid) {
      const next = turns[i + 1];
      if (!next || next.role !== 'target' || next.at - turn.lastAt >= 24 * 3600000) week.bids.unanswered++;
      else if (next.signals.boundary || next.signals.conflict) {
        week.bids.against++;
        pushEvidence(week, 'responsiveness', evidenceOf(next, 'against', '对我方提问/分享的回应带有摩擦或拒绝'));
      }
      // 转向（turning toward）包括回答/承接，也包括表达支持或就该话题追问（Gottman & Driver 2005 的编码定义）。
      else if (
        next.signals.responsive ||
        next.signals.positiveWeight >= 4 ||
        (next.signals.question && !next.newSession)
      ) {
        week.bids.toward++;
        pushEvidence(week, 'responsiveness', evidenceOf(next, 'toward', '回答或承接了我方的提问/分享'));
      } else {
        week.bids.away++;
        pushEvidence(
          week,
          'responsiveness',
          evidenceOf(next, 'away', '规则未识别为直接回应（可能是自然的话题切换，也可能漏判）')
        );
      }
      if (s.goodNews && next?.role === 'target' && next.at - turn.lastAt < 24 * 3600000) {
        week.capitalization.opportunities++;
        if (
          !next.signals.conflict &&
          (next.signals.positiveWeight >= 4 ||
            (next.signals.question && next.signals.positiveWeight >= 1) ||
            (next.signals.responsive && next.signals.positiveWeight >= 1))
        )
          week.capitalization.constructive++;
      }
    }
  });
  for (const [key, period] of periods) {
    const [start, end] = periodRange(key, granularity, members.get(key));
    period.start = start;
    period.end = end;
    period.granularity = granularity;
    finishPeriod(period);
  }
  return [...periods.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}
export function buildWeeklySignals(contact = {}, turns = buildTurns(contact)) {
  return buildPeriodSignals(contact, { granularity: 'week', turns });
}
export function buildDailySignals(contact = {}, turns = buildTurns(contact)) {
  return buildPeriodSignals(contact, { granularity: 'day', turns });
}

/** 相加多个时段（例如按日汇总成月份或最近 30 天）。计数可加；LSM 由虚词计数重新计算；证据按同一上限重新挑选。 */
export function mergePeriodSignals(list, { key = 'merged', start, end, granularity = 'custom' } = {}) {
  const rows = (list || []).filter(Boolean),
    out = emptyPeriod(start ?? rows[0]?.start ?? null, end ?? rows.at(-1)?.end ?? null, key);
  out.granularity = granularity;
  for (const p of rows) {
    out.messages += p.messages || 0;
    out.messageIds.push(...(p.messageIds || []));
    for (const role of ['self', 'target'])
      for (const [field, value] of Object.entries(p[role] || {})) {
        if (field === 'words') addWords(out[role].words, value);
        else if (typeof value === 'number') out[role][field] = (out[role][field] || 0) + value;
      }
    for (const field of Object.keys(out.bids)) out.bids[field] += p.bids?.[field] || 0;
    for (const field of Object.keys(out.capitalization)) out.capitalization[field] += p.capitalization?.[field] || 0;
    for (const [dim, items] of Object.entries(p.evidence || {}))
      if (dim !== 'reciprocity') for (const item of items) pushEvidence(out, dim, item);
  }
  return finishPeriod(out);
}
function pushReciprocityEvidence(week) {
  const s = week.self,
    t = week.target;
  week.evidence.reciprocity.push(
    { kind: 'counts', label: '双方分享回合', value: `我方 ${s.disclosure} / 对方 ${t.disclosure}`, source: 'rule' },
    { kind: 'counts', label: '双方主动开启对话', value: `我方 ${s.starts} / 对方 ${t.starts}`, source: 'rule' },
    { kind: 'counts', label: '双方提问回合', value: `我方 ${s.questions} / 对方 ${t.questions}`, source: 'rule' }
  );
}
