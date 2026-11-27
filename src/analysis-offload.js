// 把耗时的整段分析放到 Web Worker 里预先算好，主线程照旧同步调用，只是读缓存。
//
// - 只包装下方 OPS 中的纯函数；结果只取决于列出的参数 / 联系人字段（已逐个核对实现）。
// - 同步调用总能得到正确结果：缓存命中直接返回；否则在主线程当场计算（与以前相同）。
// - 大联系人（消息数 ≥ threshold）且 Worker 可用时，warm(contact) 在后台计算全部常用分析；
//   isReady(contact) 为 false 期间，界面应显示“正在后台分析”而不是调用这些函数。
// - 只有 AI 评定、阶段设置等附加字段变化时，先返回同一份聊天上次的结果（stale-while-revalidate），
//   并在后台重算，避免每存一周 AI 结果就让整页回到等待状态。
// - Worker 不可用（测试、jsdom、宿主 CSP 禁止 blob Worker）或运行出错时，自动退回主线程同步计算。

const CORE = ['messages', 'self', 'target', 'interactionCorrections'];
const WITH_AI = [...CORE, 'affinityV3'];
const STAGE = [...CORE, 'relationProfile', 'timelineAnalysis'];

/**
 * 每个可分流函数：args 描述每个参数如何参与缓存键：
 *   'messages' 消息数组（按引用）、'value' 原始值、'list' 数组（按引用，空数组视为同一个）、
 *   字段数组 = 联系人参数（按这些字段的引用）、'ignore' 不参与（例如 buildRelationStage 未使用的 now）。
 */
export const OPS = {
  analyzeDailyTimeline: { args: ['messages', 'value', 'value', 'list'] },
  analyzeConversation: { args: ['messages', 'value', 'value'] },
  timelineDayCount: { args: ['messages', 'value', 'value', 'list'] },
  analyzePeriodsCached: { args: [WITH_AI, 'value'] },
  analyzeRelationshipCached: { args: [WITH_AI] },
  analyzeInteractionMetrics: { args: [CORE] },
  analyzeInteractionEvidence: { args: [CORE] },
  buildRelationStage: { args: [STAGE, 'ignore'] }
};

/** 后台为一个联系人预先计算的调用（与界面中的实际调用参数一致）。 */
export function warmCalls(contact) {
  const corrections = contact.interactionCorrections || [];
  return [
    ['analyzeDailyTimeline', [contact.messages, contact.self, contact.target, corrections]],
    ['timelineDayCount', [contact.messages, contact.self, contact.target, corrections]],
    ['analyzeConversation', [contact.messages, contact.self, contact.target]],
    ['analyzePeriodsCached', [contact, 'all']],
    ['analyzePeriodsCached', [contact, 'week']],
    ['analyzePeriodsCached', [contact, 'month']],
    ['analyzeRelationshipCached', [contact]],
    ['analyzeInteractionEvidence', [contact]],
    ['buildRelationStage', [contact]]
  ];
}

const isPrimitive = value => value === null || (typeof value !== 'object' && typeof value !== 'function');

/** 只保留分析会读取的字段：原始值与原始值数组；附件、文件等对象字段不进 Worker。__rn 记录原始下标。 */
export function slimMessages(messages) {
  return messages.map((message, index) => {
    const slim = { __rn: index };
    if (message && typeof message === 'object')
      for (const key of Object.keys(message)) {
        const value = message[key];
        if (isPrimitive(value) || (Array.isArray(value) && value.every(isPrimitive))) slim[key] = value;
      }
    return slim;
  });
}

function sameAsOriginal(copy, original) {
  for (const key of Object.keys(copy)) {
    if (key === '__rn') continue;
    const a = copy[key],
      b = original[key];
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length || a.some((item, i) => item !== b[i])) return false;
    } else if (a !== b && !(Number.isNaN(a) && Number.isNaN(b))) return false;
  }
  return true;
}

/**
 * 把 Worker 结果里的消息副本换回主线程的原始消息：与原消息字段相同的副本直接用原对象（保持引用，
 * 与同步计算一致）；带派生字段的副本（例如 {...m,_at}）补回被精简掉的对象字段。
 */
export function rehydrate(value, originals, seen = new Map()) {
  if (isPrimitive(value)) return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(rehydrate(item, originals, seen));
    return out;
  }
  if (typeof value.__rn === 'number' && originals[value.__rn]) {
    const original = originals[value.__rn];
    if (sameAsOriginal(value, original)) {
      seen.set(value, original);
      return original;
    }
    const out = {};
    seen.set(value, out);
    for (const key of Object.keys(original)) if (!(key in value)) out[key] = original[key];
    for (const key of Object.keys(value)) if (key !== '__rn') out[key] = rehydrate(value[key], originals, seen);
    return out;
  }
  const out = Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = rehydrate(value[key], originals, seen);
  return out;
}

/** Worker 一侧：执行一批调用，参数中的 {$contact}/{$messages} 换成同一份精简数据。 */
export function runWorkerJob(E, job, post) {
  const messages = job.messages,
    contact = { ...job.contact, messages },
    resolve = arg =>
      arg && typeof arg === 'object' && arg.$ === 'contact' ? contact : arg && arg.$ === 'messages' ? messages : arg;
  job.calls.forEach(([op, args], index) => {
    if (!OPS[op]) return post({ job: job.id, index, error: '未知分析：' + op });
    try {
      post({ job: job.id, index, value: E[op](...args.map(resolve)) });
    } catch (error) {
      post({ job: job.id, index, error: String(error?.message || error) });
    }
  });
  post({ job: job.id, done: true });
}

export function createAnalysisOffload(E, { createWorker = null, threshold = 3000, cacheSize = 64 } = {}) {
  const ids = new WeakMap();
  let nextId = 1;
  const ref = value => {
    if (isPrimitive(value)) return JSON.stringify(value === undefined ? null : value);
    if (Array.isArray(value) && value.length === 0) return 'E';
    if (!ids.has(value)) ids.set(value, '#' + nextId++);
    return ids.get(value);
  };
  const contactKey = (contact, fields) =>
    contact && typeof contact === 'object'
      ? '{' +
        fields.map(field => ref(field === 'interactionCorrections' ? contact[field] || [] : contact[field])).join(',') +
        '}'
      : ref(contact);
  const keyOf = (op, args) =>
    op +
    '(' +
    OPS[op].args
      .map((kind, i) =>
        kind === 'ignore'
          ? '_'
          : Array.isArray(kind)
            ? contactKey(args[i], kind)
            : ref(kind === 'list' ? args[i] || [] : args[i])
      )
      .join(';') +
    ')';
  // 同一份聊天（CORE 字段相同）上次的结果，用于附加字段变化时先返回旧结果。
  const staleKeyOf = (op, args) => {
    const spec = OPS[op].args;
    if (!spec.some(kind => Array.isArray(kind) && kind !== CORE)) return null;
    return (
      op +
      '~(' +
      spec
        .map((kind, i) =>
          kind === 'ignore'
            ? '_'
            : Array.isArray(kind)
              ? contactKey(args[i], CORE)
              : ref(kind === 'list' ? args[i] || [] : args[i])
        )
        .join(';') +
      ')'
    );
  };

  const cache = new Map(),
    stale = new Map();
  const remember = (map, key, value) => {
    map.delete(key);
    map.set(key, value);
    while (map.size > cacheSize) map.delete(map.keys().next().value);
  };
  const listeners = new Set();
  let version = 0;
  const notify = () => {
    version++;
    for (const listener of listeners) listener();
  };

  let worker = null,
    workerFailed = !createWorker,
    jobSeq = 0;
  const jobs = new Map(); // job id → { contactKey, calls, messages, remaining }
  const inFlight = new Map(); // core key → job id
  const ready = new Set(); // 已完成预计算的 CORE 键

  const fail = () => {
    workerFailed = true;
    try {
      worker?.terminate();
    } catch {}
    worker = null;
    const pending = [...jobs.values()];
    jobs.clear();
    inFlight.clear();
    for (const job of pending) job.onDone?.();
    notify(); // 退回同步计算后，等待中的页面可以直接渲染
  };
  const ensureWorker = () => {
    if (worker || workerFailed) return worker;
    try {
      worker = createWorker();
      worker.onmessage = event => receive(event.data);
      worker.onerror = fail;
    } catch {
      fail();
    }
    return worker;
  };
  const receive = message => {
    const job = jobs.get(message?.job);
    if (!job) return;
    if (message.done) {
      jobs.delete(message.job);
      if (job.onDone) return job.onDone();
      if (inFlight.get(job.core) === message.job) inFlight.delete(job.core);
      ready.add(job.core);
      notify();
      return;
    }
    const call = job.calls[message.index];
    if (!call || message.error) return; // 出错的那一项留给主线程按需同步计算
    const value = rehydrate(message.value, job.messages);
    remember(cache, call.key, value);
    if (call.staleKey) remember(stale, call.staleKey, value);
  };

  const large = contact => Array.isArray(contact?.messages) && contact.messages.length >= threshold;
  const offloading = contact => large(contact) && !workerFailed && Boolean(createWorker);

  function warm(contact) {
    if (!offloading(contact) || !ensureWorker()) return;
    const calls = warmCalls(contact)
      .map(([op, args]) => ({ op, args, key: keyOf(op, args), staleKey: staleKeyOf(op, args) }))
      .filter(call => !cache.has(call.key));
    const core = contactKey(contact, CORE);
    if (!calls.length) {
      if (!ready.has(core)) {
        ready.add(core);
        notify();
      }
      return;
    }
    const pendingKey = core + '|' + calls.map(call => call.key).join('|');
    if (inFlight.get(core) && jobs.get(inFlight.get(core))?.pendingKey === pendingKey) return;
    const id = ++jobSeq;
    jobs.set(id, { core, calls, messages: contact.messages, pendingKey });
    inFlight.set(core, id);
    post(id, contact, contact.messages, calls);
  }

  function post(id, contact, messages, calls) {
    const slim = {};
    if (contact) for (const key of Object.keys(contact)) if (key !== 'messages') slim[key] = contact[key];
    const encode = arg => (contact && arg === contact ? { $: 'contact' } : arg === messages ? { $: 'messages' } : arg);
    try {
      worker.postMessage({
        id,
        contact: structuredSafe(slim),
        messages: slimMessages(messages),
        calls: calls.map(call => [call.op, call.args.map(encode)])
      });
    } catch {
      fail();
    }
  }

  /** 是否可以同步调用分析而不卡住界面：小联系人、无 Worker、或同一份聊天已有（可能稍旧的）结果。 */
  function isReady(contact) {
    if (!offloading(contact)) return true;
    return ready.has(contactKey(contact, CORE));
  }

  // 打包后的模块命名空间（esbuild）只有 getter；继承的访问器属性不能直接赋值覆盖，必须用 defineProperty。
  const engine = Object.create(E);
  const define = (name, value) =>
    Object.defineProperty(engine, name, { value, writable: true, configurable: true, enumerable: true });
  define('computeAsync', (op, ...args) => compute(op, ...args));
  define('isAnalysisReady', contact => isReady(contact));
  for (const op of Object.keys(OPS)) {
    if (typeof E[op] !== 'function') continue;
    const original = E[op];
    define(op, function (...args) {
      const key = keyOf(op, args);
      if (cache.has(key)) return cache.get(key);
      const staleKey = staleKeyOf(op, args),
        contactArg = args.find(arg => arg && typeof arg === 'object' && !Array.isArray(arg) && 'messages' in arg);
      if (staleKey && contactArg && offloading(contactArg) && stale.has(staleKey)) {
        warm(contactArg); // 附加字段变了：先给旧结果，后台重算
        return stale.get(staleKey);
      }
      const value = original.apply(this, args);
      remember(cache, key, value);
      if (staleKey) remember(stale, staleKey, value);
      return value;
    });
  }

  /** 异步计算（用于按钮触发的整段分析）：Worker 可用时在后台算，否则在主线程算。 */
  function compute(op, ...args) {
    const key = keyOf(op, args);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    const contact = args.find(
        arg => arg && typeof arg === 'object' && !Array.isArray(arg) && Array.isArray(arg.messages)
      ),
      messages = args.find(Array.isArray) || contact?.messages;
    const sync = () => engine[op](...args);
    if (!messages || messages.length < threshold || !createWorker || workerFailed || !ensureWorker())
      return Promise.resolve().then(sync);
    return new Promise(resolve => {
      const id = ++jobSeq,
        call = { op, args, key, staleKey: staleKeyOf(op, args) };
      jobs.set(id, {
        core: null,
        calls: [call],
        messages,
        onDone: () => resolve(cache.has(key) ? cache.get(key) : sync())
      });
      post(id, contact && contact.messages === messages ? contact : null, messages, [call]);
    });
  }

  return {
    engine,
    warm,
    isReady,
    compute,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    get workerActive() {
      return Boolean(worker) && !workerFailed;
    },
    dispose() {
      try {
        worker?.terminate();
      } catch {}
      worker = null;
      workerFailed = true;
      listeners.clear();
    }
  };
}

// 联系人的其余字段（档案、AI 结果等）原样传给 Worker；去掉无法结构化克隆的值（函数、File 以外的特殊对象由浏览器负责）。
function structuredSafe(value) {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.map(structuredSafe);
  if (typeof value === 'function') return undefined;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
  const out = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (typeof item !== 'function') out[key] = structuredSafe(item);
  }
  return out;
}
