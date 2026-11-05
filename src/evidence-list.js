/**
 * 记录列表（可核对的行为记录）的纯逻辑：排序、筛选、搜索、分页、防抖。
 * 与 UI 解耦，便于单元测试，也不依赖 React / DOM。
 */

/** 每页最多渲染的记录行数：首屏 DOM 行数与滚动高度不再随记录总数线性膨胀。 */
export const EVIDENCE_PAGE_SIZE = 50;

/** 搜索输入的防抖延迟（毫秒），要求 ≥200ms。 */
export const EVIDENCE_SEARCH_DELAY = 220;

/** 记录类型筛选：保留全部 / 提问 / 第一人称分享 / 边界 / 简短确认五类。 */
export const EVIDENCE_FILTERS = [
  ['all', '全部记录'],
  ['question', '直接提问'],
  ['sharing', '第一人称分享'],
  ['boundary', '明确边界'],
  ['acknowledgment', '简短确认'],
];

/**
 * 把一条记录的时间戳换算成可比较的毫秒值；无法识别时返回 null。
 * 兼容 Unix 秒/毫秒、ISO 字符串与「2026-03-14 21:02:00」这类本地时间。
 */
export function evidenceTime(record) {
  const value = record?.message?.timestamp ?? record?.timestamp ?? record?.message?.time ?? null;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value.trim()))) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number < 1e12 ? number * 1000 : number;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const local = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (local) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = local;
    const utc = Date.UTC(+year, +month - 1, +day, +hour - 8, +minute, +second);
    return Number.isFinite(utc) ? utc : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 排序：默认 `desc`（最新在上）。有可识别时间的记录按时间比较，
 * 时间相同或无法识别时按原始顺序（即导入顺序）稳定排列，保证结果可预期。
 */
export function sortEvidence(records, order = 'desc') {
  const list = Array.isArray(records) ? records : [];
  const direction = order === 'asc' ? 1 : -1;
  const entries = list.map((record, index) => ({ record, index, time: evidenceTime(record) }));
  const timed = entries.filter(entry => entry.time !== null);
  const untimed = entries.filter(entry => entry.time === null);
  timed.sort((left, right) => (left.time === right.time ? left.index - right.index : (left.time - right.time) * direction));
  // 时间缺失的记录不参与方向反转，始终按导入顺序排在末尾，排序结果才可预期。
  return [...timed, ...untimed].map(entry => entry.record);
}

/** 归一化搜索词：去首尾空白并转小写，空串表示不过滤。 */
export function normalizeQuery(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** 一条记录参与搜索的文本：消息原文优先，其次标签、发言人、来源文件与时间。 */
export function evidenceSearchText(record) {
  const message = record?.message || {};
  return [
    record?.quote,
    message.text,
    record?.label,
    message.sender,
    message.file,
  ].filter(Boolean).join('\n').toLowerCase();
}

/** 关键词是否命中记录原文（空关键词一律视为命中）。 */
export function matchesEvidence(record, query) {
  const keyword = normalizeQuery(query);
  if (!keyword) return true;
  return evidenceSearchText(record).includes(keyword);
}

/** 类型筛选与关键词搜索可叠加；返回过滤后的记录（保持传入顺序）。 */
export function filterEvidence(records, { type = 'all', query = '' } = {}) {
  const list = Array.isArray(records) ? records : [];
  return list.filter(record => (type === 'all' || record?.type === type) && matchesEvidence(record, query));
}

/**
 * 分页：页码从 1 开始并被夹到合法区间；空列表也返回 1 页。
 * 返回值自带 start/end，方便 UI 显示「第 X–Y 条 / 共 N 条」。
 */
export function paginateEvidence(records, page = 1, pageSize = EVIDENCE_PAGE_SIZE) {
  const list = Array.isArray(records) ? records : [];
  const size = Math.max(1, Math.trunc(Number(pageSize)) || EVIDENCE_PAGE_SIZE);
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const requested = Math.trunc(Number(page)) || 1;
  const current = Math.min(Math.max(1, requested), pageCount);
  const start = (current - 1) * size;
  return {
    page: current,
    pageCount,
    pageSize: size,
    total,
    start,
    end: Math.min(start + size, total),
    items: list.slice(start, start + size),
  };
}

/**
 * 防抖包装：多次调用只保留最后一次，延迟 `delay` 毫秒执行。
 * 调度器可注入，测试里用假定时器即可稳定断言，不必等真实时间。
 */
export function createDebounced(fn, delay = EVIDENCE_SEARCH_DELAY, scheduler = {}) {
  const schedule = typeof scheduler.set === 'function' ? scheduler.set : (callback, wait) => setTimeout(callback, wait);
  const cancel = typeof scheduler.clear === 'function' ? scheduler.clear : handle => clearTimeout(handle);
  let handle = null;
  const debounced = (...args) => {
    if (handle !== null) cancel(handle);
    handle = schedule(() => {
      handle = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (handle !== null) cancel(handle);
    handle = null;
  };
  debounced.pending = () => handle !== null;
  return debounced;
}

/** 排序方向的中文标注，用于表头按钮文案。 */
export function orderLabel(order) {
  return order === 'asc' ? '最早在上' : '最新在上';
}

/** 记录列表的整体视图：先排序，再按类型+关键词过滤，最后切页。 */
export function buildEvidenceView(records, { order = 'desc', type = 'all', query = '', page = 1, pageSize = EVIDENCE_PAGE_SIZE } = {}) {
  const sorted = sortEvidence(records, order);
  const filtered = filterEvidence(sorted, { type, query });
  const paged = paginateEvidence(filtered, page, pageSize);
  return {
    ...paged,
    order,
    type,
    query: String(query ?? '').trim(),
    filtered,
    empty: filtered.length === 0,
    searching: Boolean(normalizeQuery(query)),
  };
}
