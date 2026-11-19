import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAffinityHandler,
  validateAffinityInput,
  validateAffinityResult,
  parseModelJson,
  systemPrompt,
  AFFINITY_DIMENSIONS
} from './affinity-service.js';
import { apply as applyHost } from './index.js';

const body = {
  self: '我',
  target: '小禾',
  week: { start: '2026-10-05', end: '2026-10-11' },
  sampled: { total: 3, sent: 3 },
  messages: [
    { id: 'a', sender: '我', text: '我今天面试通过了！' },
    { id: 'b', sender: '小禾', text: '太好了！恭喜你，是哪家公司呀？' },
    { id: 'c', sender: '小禾', text: '我最近也有点焦虑，工作压力好大' }
  ]
};
const dim = (rating, evidence = [{ messageId: 'b', quote: '恭喜你', note: '对好消息表示祝贺并追问' }]) => ({
  rating,
  confidence: 'medium',
  evidence,
  inference: '可能是在表达关心，也可能只是礼貌回应。',
  alternatives: '也可能是聊天习惯。'
});
const good = () => ({
  dimensions: {
    responsiveness: dim(4),
    disclosure: dim(4, [{ messageId: 'c', quote: '工作压力好大', note: '分享了自己的压力感受' }]),
    reciprocity: dim(3),
    positivity: dim(5),
    engagement: dim(3),
    friction: { ...dim(null, []), repaired: null }
  },
  boundary: { present: false, evidence: [] },
  summary: '我方分享面试结果，对方祝贺并追问，随后谈到自己的工作压力。',
  uncertainties: '只有三条消息，样本很小。'
});
const request = payload =>
  new Request('http://local/api/relationship-notes/affinity-analysis', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
const fakeLlm = (text, { reason = 'stop' } = {}) => {
  const calls = [];
  return {
    calls,
    async prepareCall(options) {
      calls.push(options);
      return {
        config: {},
        async *stream(input) {
          calls.push(input);
          yield { type: 'text-delta', index: 0, text };
          yield { type: 'finish', reason };
        }
      };
    }
  };
};
const selection = () => ({ provider: 'p', model: 'm' });

test('accepts a well-formed analysis and returns only the normalised shape', async () => {
  const llm = fakeLlm(JSON.stringify(good())),
    response = await createAffinityHandler(llm, { defaultSelection: selection })(request(body)),
    data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(Object.keys(data.analysis.dimensions).sort(), [...AFFINITY_DIMENSIONS].sort());
  assert.equal(data.analysis.dimensions.positivity.evidence[0].sender, '小禾');
  assert.equal(llm.calls[0].temperature, 0.1);
  const system = llm.calls[1].messages[0].content[0].text;
  assert.match(system, /“小禾”对“我”/);
  assert.match(system, /不可信资料/);
  assert.doesNotMatch(system, /\$\{target\}/);
});

test('rejects fabricated quotes, quotes from the wrong message and ratings without evidence', () => {
  const fake = good();
  fake.dimensions.responsiveness.evidence = [{ messageId: 'b', quote: '我好喜欢你', note: '' }];
  assert.throws(() => validateAffinityResult(fake, body), /引用与原文不一致/);
  const wrong = good();
  wrong.dimensions.responsiveness.evidence = [{ messageId: 'a', quote: '恭喜你', note: '' }];
  assert.throws(() => validateAffinityResult(wrong, body), /引用与原文不一致/);
  const bare = good();
  bare.dimensions.engagement = { ...dim(4, []) };
  assert.throws(() => validateAffinityResult(bare, body), /缺少原文依据/);
});

test('rejects probabilities, certainty about feelings and attachment diagnoses', () => {
  for (const text of ['这说明他喜欢你。', '好感度约 80%', '对方是回避型依恋', '肯定是对你有意思']) {
    const result = good();
    result.dimensions.positivity.inference = text;
    assert.throws(() => validateAffinityResult(result, body), /确定性判断/, text);
  }
  const hedged = good();
  hedged.dimensions.positivity.inference = '可能是在为你高兴，也可能只是礼貌。';
  assert.doesNotThrow(() => validateAffinityResult(hedged, body));
});

test('boundary must quote the other person and ratings must be integers 1–5 or null', () => {
  const self = good();
  self.boundary = { present: true, evidence: [{ messageId: 'a', quote: '面试通过', note: '' }] };
  assert.throws(() => validateAffinityResult(self, body), /不属于对方/);
  const empty = good();
  empty.boundary = { present: true, evidence: [] };
  assert.throws(() => validateAffinityResult(empty, body), /缺少原文依据/);
  for (const rating of [0, 6, 3.5, '4']) {
    const r = good();
    r.dimensions.disclosure.rating = rating;
    assert.throws(() => validateAffinityResult(r, body), /1至5/);
  }
  const extra = good();
  extra.dimensions.love = dim(5);
  assert.throws(() => validateAffinityResult(extra, body), /维度无效/);
});

test('validates the request: pair, ids, sizes, unknown fields and messages from the other person', () => {
  assert.doesNotThrow(() => validateAffinityInput(structuredClone(body)));
  assert.throws(() => validateAffinityInput({ ...body, extra: 1 }), /字段格式无效/);
  assert.throws(
    () => validateAffinityInput({ ...body, messages: [...body.messages, { id: 'a', sender: '我', text: '重复' }] }),
    /编号无效/
  );
  assert.throws(
    () => validateAffinityInput({ ...body, messages: [{ id: 'x', sender: '第三人', text: 'hi' }] }),
    /身份或编号无效/
  );
  assert.throws(
    () => validateAffinityInput({ ...body, messages: [{ id: 'x', sender: '我', text: '只有我' }] }),
    /没有对方的消息/
  );
  assert.throws(
    () =>
      validateAffinityInput({
        ...body,
        messages: Array.from({ length: 81 }, (_, i) => ({ id: 'm' + i, sender: i % 2 ? '我' : '小禾', text: '嗯' }))
      }),
    /1至80/
  );
  assert.throws(
    () => validateAffinityInput({ ...body, week: { start: '2026-10-11', end: '2026-10-05' } }),
    /周范围无效/
  );
});

test('maps model failures to the documented HTTP statuses', async () => {
  const run = async (llm, options = { defaultSelection: selection }, payload = body) => {
    const response = await createAffinityHandler(llm, options)(request(payload));
    return [response.status, (await response.json()).error];
  };
  assert.deepEqual(await run(fakeLlm('不是JSON')), [502, '模型没有返回有效JSON。']);
  assert.deepEqual(await run(fakeLlm(JSON.stringify(good()), { reason: 'length' })), [502, '模型未完成分析。']);
  assert.deepEqual(await run(fakeLlm('{}'), { defaultSelection: () => null }), [503, '请先选择DSH模型。']);
  const fake = good();
  fake.dimensions.responsiveness.evidence = [{ messageId: 'b', quote: '编造', note: '' }];
  assert.equal((await run(fakeLlm(JSON.stringify(fake))))[0], 502);
  const get = await createAffinityHandler(fakeLlm('{}'), { defaultSelection: selection })(
    new Request('http://local/x', { method: 'GET' })
  );
  assert.equal(get.status, 405);
});

test('tolerates fenced JSON and builds a prompt with the real names', () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.match(systemPrompt(body), /除 reciprocity（双方是否对等）外，其余维度都评定“小禾”对“我”/);
});

test('the published host entry registers the affinity route', () => {
  const routes = [];
  const scope = {
    connection: { fetch: { register: r => routes.push(r) } },
    tools: { register() {} },
    llm: {},
    agentDefaultModel: { currentSelection: () => null },
    attachments: {}
  };
  applyHost({
    inject(_names, callback) {
      return callback(scope);
    }
  });
  const route = routes.find(r => r.path === '/api/relationship-notes/affinity-analysis');
  assert.ok(route);
  assert.deepEqual(route.methods, ['POST']);
  assert.equal(route.requestBody, 'buffered');
});
