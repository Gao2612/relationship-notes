// 大体量聊天走 Web Worker：导入 4000 条消息后，需要整段分析的页面先显示“正在后台分析”，
// 其他页面照常可用；Worker 回复后自动显示结果。环境见 src/test-support/dom-harness.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorkspace, closeAllWindows, wait } from './src/test-support/dom-harness.mjs';

test.afterEach(() => closeAllWindows());

function bigChat(count) {
  const texts = [
    '你好呀，最近怎么样？',
    '我最近在学摄影，你呢？',
    '哈哈好呀',
    '周末一起去爬山吗？',
    '好的！',
    '今天有点累'
  ];
  const rows = [];
  let time = Date.UTC(2025, 0, 6, 1);
  for (let i = 0; i < count; i++) {
    time += i % 12 === 0 ? 86400000 : 60000;
    const stamp = new Date(time + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
    rows.push(`[${stamp}] ${i % 3 ? '小禾' : '我'}: ${texts[i % texts.length]}`);
  }
  return rows.join('\n');
}

test('large chats are analysed in the background worker without blocking navigation', { timeout: 120000 }, async () => {
  const p = openWorkspace({ fresh: true, worker: true });
  await p.mount();
  const { d } = p;
  await p.importText('大聊天.txt', bigChat(4000));
  const identity = [...d.querySelectorAll('select')].filter(select =>
    [...select.options].some(option => option.textContent === '小禾')
  );
  assert.equal(identity.length, 2);
  await p.choose(identity[0], '我');
  await p.choose(identity[1], '小禾');
  p.workerControl.hold();
  await p.click('确认并导入');
  await wait(300);
  assert.match(p.text(), /导入完成/);
  assert.match(p.text(), /正在后台统计有记录的日期（4000 条消息）/, '导入结果页的日期统计在后台进行');

  await p.click('记录与评分');
  assert.match(p.text(), /正在后台分析 4000 条消息/);
  assert.ok(d.querySelector('#rn-panel [role=status]'), '等待状态对读屏可见');
  await p.click('每日历程');
  assert.match(p.text(), /正在后台分析 4000 条消息/);
  await p.click('设置');
  assert.match(p.text(), /我的表达档案/, '不需要整段分析的页面照常可用');
  await p.click('沟通');
  assert.match(p.text(), /哈哈好呀/, '会话照常显示');
  assert.ok(p.workerControl.jobs >= 1, '已把分析交给 Worker');

  p.workerControl.release();
  await wait(1500);
  await p.click('记录与评分');
  await p.click('关系分析');
  assert.doesNotMatch(p.text(), /正在后台分析/);
  assert.match(p.text(), /关系互动指数/);
  await p.click('每日历程');
  assert.match(p.text(), /关系指数与互动趋势/);
  await p.click('互动评分');
  assert.match(p.text(), /互动评分与识别证据/);
  await p.click('联系人');
  await p.click('关系阶段');
  assert.doesNotMatch(p.text(), /正在后台分析/);
  await p.close();
});
