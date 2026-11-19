// 真实 DOM 冒烟测试：在 jsdom 中用真实 React 18 渲染构建产物 client.js，
// 走一遍“载入内置示例 → 确认身份 → 导入 → 浏览全部页面 → 重新打开后从 IndexedDB 恢复”。
// 只覆盖渲染装配与主流程，不替代各模块的行为测试。环境见 src/test-support/dom-harness.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorkspace, closeAllWindows, wait } from './src/test-support/dom-harness.mjs';

test(
  'built client renders in a real DOM, imports the sample chat, shows every page and restores from IndexedDB',
  { timeout: 60000 },
  async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => {
      const message = String(args[0]);
      if (!/not wrapped in act/.test(message)) errors.push(message.slice(0, 500));
    };
    try {
      const first = openWorkspace();
      await first.mount();
      assert.match(first.text(), /三步开始/);
      assert.ok(first.d.querySelector('.rnw'), '工作区根节点');

      await first.click('载入内置示例聊天（虚构）');
      await wait(500);
      assert.match(first.text(), /确认聊天双方/);
      const identity = [...first.d.querySelectorAll('select')].filter(select =>
        [...select.options].some(option => option.textContent === '小禾')
      );
      assert.equal(identity.length, 2, '“我”与“联系人”两个选择框');
      await first.choose(identity[0], '我');
      await first.choose(identity[1], '小禾');
      await first.click('确认并导入');
      await wait(500);
      assert.match(first.text(), /导入完成/);
      assert.match(first.text(), /小禾/);

      const pages = {
        联系人: /联系人档案/,
        记录与评分: /关系互动指数/,
        关系分析: /80% 区间/,
        每日历程: /关系指数与互动趋势/,
        互动评分: /互动评分与识别证据/,
        打分依据: /打分依据/,
        '周/月复盘': /沟通复盘/,
        记录列表: /可核对的行为记录/,
        评分规则: /评分规则（关系分析 v3）/,
        沟通: /你好，最近怎么样？/,
        当前目标: /我的行动计划/,
        进展记录: /已完成的行动/,
        设置: /我的表达档案/
      };
      for (const [label, expected] of Object.entries(pages)) {
        await first.click(label);
        assert.match(first.text(), expected, label);
      }
      await wait(800); // 等 350ms 防抖保存落盘。
      await first.close();

      const second = openWorkspace();
      await second.mount();
      await wait(500);
      assert.match(second.text(), /小禾/, '重新打开后从 IndexedDB 恢复联系人');
      assert.match(second.text(), /5 条消息/);
      await second.close();

      assert.deepEqual(errors, [], 'React / 控制台错误');
    } finally {
      console.error = originalError;
      closeAllWindows();
    }
  }
);
