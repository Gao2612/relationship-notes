import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../client-engine.js';

const React = {
  useState: v => [v, () => {}],
  useMemo: fn => fn(),
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() })
};
const render = node =>
  Array.isArray(node)
    ? node.map(render)
    : node && typeof node === 'object'
      ? typeof node.type === 'function'
        ? render(node.type({ ...node.props, children: node.children }))
        : { ...node, children: node.children.map(render) }
      : node;
const text = node =>
  Array.isArray(node)
    ? node.map(text).join('')
    : node && typeof node === 'object'
      ? text(node.children)
      : node === false || node === null || node === undefined
        ? ''
        : String(node);
let seq = 0;
const msg = (sender, t, ts) => ({ sender, text: t, timestamp: ts, messageId: 'v' + ++seq });
const contact = extra => ({
  id: 'c',
  self: '我',
  target: '小禾',
  messages: [
    msg('我', '周末你有什么安排？', '2026-10-06 10:00:00'),
    msg('小禾', '周末打算去爬山，你要一起吗？', '2026-10-06 10:03:00'),
    msg('小禾', '我最近工作压力好大', '2026-10-06 20:00:00'),
    ...extra
  ]
});

test('renders the index, legend of evidence types and a model hint when no model is configured', () => {
  const View = E.createRelationshipInsightView(React, E);
  const tree = render(
    View({
      contact: contact([]),
      busy: false,
      modelReady: false,
      onRun() {},
      onCancel() {},
      onEvidence() {},
      onConfigure() {}
    })
  );
  const all = text(tree);
  for (const label of [
    '关系互动指数',
    '原文事实',
    'AI 引用',
    'AI 推断',
    '长期变化',
    '未配置模型',
    '不是“对方喜欢你的概率”'
  ])
    assert.ok(all.includes(label), label);
});

test('a boundary week shows a prominent alert and the run button counts pending weeks', () => {
  const View = E.createRelationshipInsightView(React, E);
  const tree = render(
    View({
      contact: contact([msg('小禾', '以后别再联系我了', '2026-10-07 09:00:00')]),
      busy: false,
      modelReady: true,
      onRun() {},
      onCancel() {},
      onEvidence() {}
    })
  );
  const all = text(tree);
  assert.ok(all.includes('检测到明确的拒绝或边界表达'));
  assert.ok(all.includes('AI 分析 1 周'));
});

test('empty contacts render an explanatory empty state', () => {
  const View = E.createRelationshipInsightView(React, E);
  assert.match(
    text(render(View({ contact: { id: 'x', self: '我', target: '小禾', messages: [] } }))),
    /还没有双方可分析的聊天记录/
  );
});
