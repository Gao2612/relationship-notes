// 构建产物中的分析 Worker：取出 client.js 内嵌的 ANALYSIS_WORKER_SOURCE，在隔离的 self 环境中执行，
// 结果须与主线程同步计算一致。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as E from './src/client-engine.js';
import { slimMessages, rehydrate } from './src/analysis-offload.js';

const client = readFileSync(new URL('./client.js', import.meta.url), 'utf8');

function workerSource() {
  const start = client.indexOf('ANALYSIS_WORKER_SOURCE = ');
  assert.ok(start > 0, 'client.js 内嵌了分析 Worker');
  const quote = client[start + 'ANALYSIS_WORKER_SOURCE = '.length];
  let i = start + 'ANALYSIS_WORKER_SOURCE = '.length + 1;
  while (client[i] !== quote) i += client[i] === '\\' ? 2 : 1;
  return vm.runInNewContext(client.slice(start + 'ANALYSIS_WORKER_SOURCE = '.length, i + 1));
}

test('embedded analysis worker answers a job with results equal to the synchronous engine', async () => {
  const source = workerSource();
  assert.doesNotMatch(source, /createElement|useState|indexedDB|fetch\(/, 'Worker 只含分析纯模块');
  assert.ok(source.length < 200 * 1024, 'Worker 体积 < 200KB');
  const replies = [];
  const self = { postMessage: message => replies.push(structuredClone(message)) };
  vm.runInNewContext(source, { self, Intl, Date, Math, JSON, Map, Set, WeakMap, Array, Object, String, Number });
  assert.equal(typeof self.onmessage, 'function');

  const messages = [];
  let time = Date.UTC(2025, 2, 3, 1);
  const texts = ['你好呀', '我最近在学摄影，你呢？', '哈哈好呀', '周末一起去爬山吗？', '好的！'];
  for (let i = 0; i < 200; i++) {
    time += i % 8 === 0 ? 86400000 : 120000;
    messages.push({
      id: 'm' + i,
      sender: i % 2 ? '小禾' : '我',
      text: texts[i % texts.length],
      timestamp: new Date(time + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19)
    });
  }
  const contact = { id: 'c', self: '我', target: '小禾', messages, interactionCorrections: [] };
  self.onmessage({
    data: structuredClone({
      id: 7,
      contact: { id: 'c', self: '我', target: '小禾', interactionCorrections: [] },
      messages: slimMessages(messages),
      calls: [
        ['analyzeDailyTimeline', [{ $: 'messages' }, '我', '小禾', []]],
        ['analyzeRelationshipCached', [{ $: 'contact' }]],
        ['analyzeInteractionEvidence', [{ $: 'contact' }]],
        ['buildRelationStage', [{ $: 'contact' }]],
        ['nope', []]
      ]
    })
  });
  assert.equal(replies.at(-1).done, true);
  const value = index => rehydrate(replies.find(r => r.index === index).value, messages);
  const plain = x => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plain(value(0)), plain(E.analyzeDailyTimeline(messages, '我', '小禾', [])));
  assert.deepEqual(plain(value(1)), plain(E.analyzeRelationship(contact)));
  assert.deepEqual(plain(value(2)), plain(E.analyzeInteractionEvidence(contact)));
  assert.deepEqual(plain(value(3)), plain(E.buildRelationStage(contact)));
  assert.match(replies.find(r => r.index === 4).error, /未知分析/);
});
