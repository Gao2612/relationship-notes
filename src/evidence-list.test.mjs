import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_PAGE_SIZE,
  EVIDENCE_SEARCH_DELAY,
  buildEvidenceView,
  createDebounced,
  evidenceTime,
  filterEvidence,
  matchesEvidence,
  normalizeQuery,
  orderLabel,
  paginateEvidence,
  sortEvidence,
} from './evidence-list.js';

const record = (id, type, text, timestamp) => ({ id, type, label: type, quote: text, message: { sender: '我方', text, timestamp } });

// 用少量可稳定断言的样本，不引入真实聊天数据。
const sample = [
  record('a', 'question', '你到哪了', '2026-03-14 09:00:00'),
  record('b', 'sharing', '我今天去跑步了', '2026-03-14 21:00:00'),
  record('c', 'boundary', '请不要再联系我', '2026-11-04 20:00:00'),
  record('d', 'acknowledgment', '嗯嗯好', '2026-03-15 08:00:00'),
];

test('默认按时间倒序：最新记录在最上', () => {
  assert.deepEqual(sortEvidence(sample).map(item => item.id), ['c', 'd', 'b', 'a']);
  assert.deepEqual(sortEvidence(sample, 'asc').map(item => item.id), ['a', 'b', 'd', 'c']);
});

test('时间相同或缺失时按原始顺序稳定排列', () => {
  const items = [record('x', 'question', '一', '2026-03-14 10:00:00'), record('y', 'question', '二', '2026-03-14 10:00:00'), record('z', 'question', '三', undefined)];
  assert.deepEqual(sortEvidence(items).map(item => item.id), ['x', 'y', 'z']);
  assert.deepEqual(sortEvidence(items, 'asc').map(item => item.id), ['x', 'y', 'z']);
});

test('识别秒级/毫秒级 Unix 时间戳与本地时间字符串', () => {
  assert.equal(evidenceTime({ message: { timestamp: 1793358084 } }), 1793358084000);
  assert.equal(evidenceTime({ message: { timestamp: '1793358084' } }), 1793358084000);
  assert.equal(evidenceTime({ message: { timestamp: 1793358084000 } }), 1793358084000);
  assert.equal(evidenceTime({ message: { timestamp: '2026-03-14 21:02:00' } }), Date.UTC(2026, 2, 14, 13, 2, 0));
  assert.equal(evidenceTime({ message: {} }), null);
});

test('关键词搜索匹配消息原文，大小写与空白被归一化', () => {
  assert.equal(normalizeQuery('  跑步  '), '跑步');
  assert.equal(matchesEvidence(sample[1], '跑步'), true);
  assert.equal(matchesEvidence(sample[1], '  '), true);
  assert.equal(matchesEvidence(sample[1], '看电影'), false);
  const keyword = record('e', 'question', 'Hello THERE', '2026-03-14 10:00:00');
  assert.equal(matchesEvidence(keyword, 'hello there'), true);
});

test('类型筛选与关键词搜索可以叠加', () => {
  assert.deepEqual(filterEvidence(sample, { type: 'question' }).map(item => item.id), ['a']);
  assert.deepEqual(filterEvidence(sample, { type: 'all', query: '跑步' }).map(item => item.id), ['b']);
  assert.deepEqual(filterEvidence(sample, { type: 'sharing', query: '跑步' }).map(item => item.id), ['b']);
  assert.deepEqual(filterEvidence(sample, { type: 'boundary', query: '跑步' }), []);
});

test('分页每页最多 50 行，页码被夹到合法区间', () => {
  assert.equal(EVIDENCE_PAGE_SIZE, 50);
  const many = Array.from({ length: 372 }, (_, index) => record('r' + index, 'question', '第 ' + index + ' 条', '2026-03-14 10:00:00'));
  const first = paginateEvidence(many, 1);
  assert.equal(first.pageCount, 8);
  assert.equal(first.items.length, 50);
  assert.equal(first.start, 0);
  assert.equal(first.end, 50);
  const last = paginateEvidence(many, 8);
  assert.equal(last.items.length, 22);
  assert.equal(last.start, 350);
  assert.deepEqual(paginateEvidence(many, 99).page, 8);
  assert.deepEqual(paginateEvidence(many, 0).page, 1);
  const empty = paginateEvidence([], 3);
  assert.deepEqual([empty.page, empty.pageCount, empty.items.length], [1, 1, 0]);
});

test('buildEvidenceView 组合排序、筛选、搜索与分页', () => {
  const view = buildEvidenceView(sample, { order: 'desc', type: 'all', query: '', page: 1 });
  assert.deepEqual(view.items.map(item => item.id), ['c', 'd', 'b', 'a']);
  assert.equal(view.total, 4);
  const filtered = buildEvidenceView(sample, { type: 'question', query: '到哪' });
  assert.deepEqual(filtered.items.map(item => item.id), ['a']);
  assert.equal(filtered.empty, false);
  assert.equal(filtered.searching, true);
  const missing = buildEvidenceView(sample, { query: '不存在的关键词' });
  assert.equal(missing.empty, true);
  assert.equal(missing.items.length, 0);
  assert.equal(missing.pageCount, 1);
});

test('检索防抖：连续输入只执行最后一次，且延迟不低于 200ms', () => {
  assert.ok(EVIDENCE_SEARCH_DELAY >= 200);
  const queue = [];
  const scheduler = { set: (callback, wait) => { queue.push({ callback, wait }); return queue.length; }, clear: () => {} };
  const seen = [];
  const debounced = createDebounced(value => seen.push(value), EVIDENCE_SEARCH_DELAY, scheduler);
  debounced('a');
  debounced('ab');
  debounced('abc');
  assert.deepEqual(seen, []);
  assert.equal(queue.length, 3);
  assert.equal(queue[0].wait, EVIDENCE_SEARCH_DELAY);
  queue.at(-1).callback();
  assert.deepEqual(seen, ['abc']);
  assert.equal(debounced.pending(), false);
});

test('排序方向有明确中文标注，供表头切换按钮使用', () => {
  assert.equal(orderLabel('desc'), '最新在上');
  assert.equal(orderLabel('asc'), '最早在上');
  assert.equal(orderLabel(), '最新在上');
});
