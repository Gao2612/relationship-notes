// 真实 DOM 冒烟测试：在 jsdom 中用真实 React 18 渲染构建产物 client.js，
// 走一遍“载入内置示例 → 确认身份 → 导入 → 浏览全部页面 → 重新打开后从 IndexedDB 恢复”。
// 只覆盖渲染装配与主流程，不替代各模块的行为测试。不发网络请求（fetch 被替换为本地 404）。
// 夹具见 test-support/workspace-dom.mjs，src/*.test.mjs 里的页面行为测试也用它。
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { openWorkspace, closeAllWorkspaces, captureConsoleErrors, wait } from './test-support/workspace-dom.mjs';

test(
  'built client renders in a real DOM, imports the sample chat, shows every page and restores from IndexedDB',
  { timeout: 60000 },
  async () => {
    const consoleErrors = captureConsoleErrors();
    try {
      const indexedDB = new IDBFactory();
      const first = openWorkspace({ indexedDB });
      await first.mount();
      assert.match(first.text(), /三步开始/);
      assert.ok(first.d.querySelector('.rnw'), '工作区根节点');

      await first.click('载入内置示例聊天（虚构）');
      await wait(500);
      assert.match(first.text(), /确认聊天双方/);
      await first.confirmIdentity('我', '小禾');
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
      // 宿主适配器自己做 JSON 编码：请求体是对象，不是再编码一次的字符串。
      assert.ok(first.requests.length > 0, '流程中发出过宿主请求');
      for (const { url, init } of first.requests) {
        assert.match(url, /^api\/relationship-notes\//);
        assert.equal(init.method, 'POST', url);
        assert.equal(typeof JSON.parse(init.body), 'object', url);
      }
      await wait(800); // 等 350ms 防抖保存落盘。
      await first.close();

      const second = openWorkspace({ indexedDB });
      await second.mount();
      await wait(500);
      assert.match(second.text(), /小禾/, '重新打开后从 IndexedDB 恢复联系人');
      assert.match(second.text(), /5 条消息/);
      await second.close();

      assert.deepEqual(consoleErrors.errors, [], 'React / 控制台错误');
    } finally {
      consoleErrors.restore();
      // 失败时也关闭全部窗口，清掉导入轮询等定时器，避免进程挂起。
      closeAllWorkspaces();
    }
  }
);
