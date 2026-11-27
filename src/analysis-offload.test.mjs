import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from './client-engine.js';
import { createAnalysisOffload, rehydrate, runWorkerJob, slimMessages, OPS } from './analysis-offload.js';

const lines = [
  '你好，最近怎么样？',
  '我住在杭州，我喜欢摄影。',
  '哈哈哈',
  '要不要周末一起去爬山？',
  '好呀！',
  '你喜欢吃什么？'
];
function makeContact(count, extra = {}) {
  const messages = [];
  let time = Date.UTC(2025, 0, 6, 1);
  for (let i = 0; i < count; i++) {
    time += i % 9 === 0 ? 86400000 : 90000;
    messages.push({
      id: 'm' + i,
      sender: i % 3 ? '小禾' : '我',
      text: lines[i % lines.length],
      timestamp: new Date(time + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19),
      attachments: i === 1 ? [{ name: 'a.png', blob: { size: 1 } }] : undefined
    });
  }
  return { id: 'c', self: '我', target: '小禾', messages, interactionCorrections: [], ...extra };
}

// 计数的 E：记录主线程上真正执行了几次重计算。
function countingEngine() {
  const calls = {};
  const E = Object.create(engine);
  for (const op of Object.keys(OPS))
    E[op] = (...args) => {
      calls[op] = (calls[op] || 0) + 1;
      return engine[op](...args);
    };
  return { E, calls };
}

// 进程内的假 Worker：结构化克隆 + 异步投递，跑真实的 runWorkerJob。
function fakeWorker({ fail = false } = {}) {
  const created = [];
  const create = () => {
    const worker = {
      posted: 0,
      onmessage: null,
      onerror: null,
      postMessage(data) {
        worker.posted++;
        const job = structuredClone(data);
        setTimeout(() => {
          if (fail) return worker.onerror?.(new Error('boom'));
          runWorkerJob(engine, job, message => worker.onmessage?.({ data: structuredClone(message) }));
        }, 0);
      },
      terminate() {
        worker.terminated = true;
      }
    };
    created.push(worker);
    return worker;
  };
  return { create, created };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('small contacts and missing Worker stay on the synchronous path', () => {
  const { E } = countingEngine();
  const { create, created } = fakeWorker();
  const offload = createAnalysisOffload(E, { createWorker: create, threshold: 100 });
  const contact = makeContact(30);
  assert.equal(offload.isReady(contact), true);
  offload.warm(contact);
  assert.equal(created.length, 0, '小联系人不启动 Worker');
  const noWorker = createAnalysisOffload(E, { threshold: 1 });
  assert.equal(noWorker.isReady(makeContact(30)), true);
  assert.deepEqual(
    noWorker.engine.analyzeConversation(contact.messages, '我', '小禾'),
    engine.analyzeConversation(contact.messages, '我', '小禾')
  );
});

test('wrappers install on getter-only module namespaces (esbuild bundles)', () => {
  const calls = {};
  const E = {};
  for (const key of Object.keys(engine))
    Object.defineProperty(E, key, {
      enumerable: true,
      get: () =>
        OPS[key]
          ? (...args) => {
              calls[key] = (calls[key] || 0) + 1;
              return engine[key](...args);
            }
          : engine[key]
    });
  const offload = createAnalysisOffload(E, {});
  const contact = makeContact(40);
  assert.notEqual(offload.engine.analyzeConversation, E.analyzeConversation, '包装函数已安装');
  offload.engine.analyzeConversation(contact.messages, '我', '小禾');
  offload.engine.analyzeConversation(contact.messages, '我', '小禾');
  assert.equal(calls.analyzeConversation, 1);
  assert.equal(typeof offload.engine.isAnalysisReady, 'function');
  assert.equal(typeof offload.engine.computeAsync, 'function');
});

test('synchronous calls are memoized by input identity', () => {
  const { E, calls } = countingEngine();
  const offload = createAnalysisOffload(E, {});
  const contact = makeContact(60);
  const a = offload.engine.analyzeDailyTimeline(contact.messages, '我', '小禾', []);
  const b = offload.engine.analyzeDailyTimeline(contact.messages, '我', '小禾', contact.interactionCorrections);
  assert.equal(a, b, '空纠正数组视为相同输入');
  assert.equal(calls.analyzeDailyTimeline, 1);
  offload.engine.analyzeDailyTimeline([...contact.messages], '我', '小禾', []);
  assert.equal(calls.analyzeDailyTimeline, 2, '新的消息数组重新计算');
  offload.engine.analyzePeriodsCached({ ...contact }, 'all');
  offload.engine.analyzePeriodsCached({ ...contact, note: 'x' }, 'all');
  assert.equal(calls.analyzePeriodsCached, 1, '无关字段变化不重算');
});

test('large contacts are analysed in the worker; results match and keep message identity', async () => {
  const { E, calls } = countingEngine();
  const { create, created } = fakeWorker();
  const offload = createAnalysisOffload(E, { createWorker: create, threshold: 100 });
  const contact = makeContact(400);
  let notified = 0;
  offload.subscribe(() => notified++);
  assert.equal(offload.isReady(contact), false);
  offload.warm(contact);
  offload.warm(contact);
  assert.equal(created.length, 1);
  assert.equal(created[0].posted, 1, '同一份数据不重复投递');
  await settle();
  assert.equal(offload.isReady(contact), true);
  assert.ok(notified >= 1);

  const timeline = offload.engine.analyzeDailyTimeline(contact.messages, '我', '小禾', []);
  const expected = engine.analyzeDailyTimeline(contact.messages, '我', '小禾', []);
  assert.deepEqual(JSON.parse(JSON.stringify(timeline)), JSON.parse(JSON.stringify(expected)));
  for (const op of ['analyzeConversation']) assert.ok(offload.engine[op](contact.messages, '我', '小禾'));
  assert.deepEqual(
    JSON.parse(JSON.stringify(offload.engine.analyzeRelationshipCached(contact))),
    JSON.parse(JSON.stringify(engine.analyzeRelationship(contact)))
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(offload.engine.buildRelationStage(contact, { now: Date.now() }))),
    JSON.parse(JSON.stringify(engine.buildRelationStage(contact)))
  );
  assert.equal(
    offload.engine.timelineDayCount(contact.messages, '我', '小禾', []),
    engine.timelineDayCount(contact.messages, '我', '小禾', [])
  );
  offload.engine.analyzePeriodsCached(contact, 'week');
  offload.engine.analyzePeriodsCached(contact, 'month');
  offload.engine.analyzeInteractionEvidence(contact);
  assert.deepEqual(calls, {}, '预计算完成后主线程不再执行重计算');

  // 结果里的消息引用回到原始对象（与同步计算一致），附件等对象字段不丢。
  const originals = new Set(contact.messages);
  const found = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(visit);
    if ('sender' in value && 'text' in value && 'timestamp' in value) found.push(value);
    Object.values(value).forEach(visit);
  };
  visit(timeline);
  assert.ok(found.length > 0);
  assert.ok(
    found.every(m => originals.has(m) || m.attachments === contact.messages[Number(m.id.slice(1))].attachments)
  );
  assert.ok(found.every(m => !('__rn' in m)));
});

test('AI-only changes serve the previous result while the worker recomputes', async () => {
  const { E, calls } = countingEngine();
  const { create, created } = fakeWorker();
  const offload = createAnalysisOffload(E, { createWorker: create, threshold: 100 });
  const contact = makeContact(300);
  offload.warm(contact);
  await settle();
  const before = offload.engine.analyzeRelationshipCached(contact);
  const withAi = { ...contact, affinityV3: { modelVersion: 1, weeks: {} } };
  assert.equal(offload.isReady(withAi), true, '同一份聊天仍可直接显示');
  assert.equal(offload.engine.analyzeRelationshipCached(withAi), before, '先给旧结果');
  assert.equal(calls.analyzeRelationshipCached, undefined, '不在主线程重算');
  await settle();
  assert.ok(created[0].posted >= 2, '后台重算');
  assert.notEqual(offload.engine.analyzeRelationshipCached(withAi), undefined);
  assert.equal(calls.analyzeRelationshipCached, undefined);
  // 换了消息就必须重新等待。
  assert.equal(offload.isReady({ ...contact, messages: [...contact.messages] }), false);
});

test('worker failure falls back to synchronous analysis', async () => {
  const { E } = countingEngine();
  const { create } = fakeWorker({ fail: true });
  const offload = createAnalysisOffload(E, { createWorker: create, threshold: 100 });
  const contact = makeContact(300);
  offload.warm(contact);
  assert.equal(offload.isReady(contact), false);
  await settle();
  assert.equal(offload.isReady(contact), true, 'Worker 出错后退回同步，不会一直等待');
  assert.equal(offload.workerActive, false);
  const throwing = createAnalysisOffload(E, {
    createWorker: () => {
      throw new Error('CSP');
    },
    threshold: 100
  });
  throwing.warm(contact);
  assert.equal(throwing.isReady(contact), true);
});

test('computeAsync runs in the worker for large inputs and matches the synchronous result', async () => {
  const { E, calls } = countingEngine();
  const { create } = fakeWorker();
  const offload = createAnalysisOffload(E, { createWorker: create, threshold: 100 });
  const contact = makeContact(300);
  const subset = contact.messages.filter((_, i) => i % 2);
  const result = await offload.engine.computeAsync('analyzeDailyTimeline', subset, '我', '小禾', []);
  assert.equal(calls.analyzeDailyTimeline, undefined);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    JSON.parse(JSON.stringify(engine.analyzeDailyTimeline(subset, '我', '小禾', [])))
  );
  const small = await offload.engine.computeAsync('analyzeConversation', subset.slice(0, 10), '我', '小禾');
  assert.ok(small);
  assert.equal(calls.analyzeConversation, 1, '小输入直接同步算');
});

test('slimMessages drops object fields and rehydrate restores them', () => {
  const messages = [
    { id: 'a', text: 'x', tags: ['t'], attachments: [{ blob: 1 }] },
    { id: 'b', text: 'y' }
  ];
  const slim = slimMessages(messages);
  assert.deepEqual(slim[0], { __rn: 0, id: 'a', text: 'x', tags: ['t'] });
  const back = rehydrate({ list: [slim[1], { ...slim[0], _at: 5 }] }, messages);
  assert.equal(back.list[0], messages[1]);
  assert.equal(back.list[1].attachments, messages[0].attachments);
  assert.equal(back.list[1]._at, 5);
  assert.equal('__rn' in back.list[1], false);
});
