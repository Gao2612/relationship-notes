// 真实 DOM 冒烟测试：在 jsdom 中用真实 React 18 渲染构建产物 client.js，
// 走一遍“载入内置示例 → 确认身份 → 导入 → 浏览全部页面 → 重新打开后从 IndexedDB 恢复”。
// 只覆盖渲染装配与主流程，不替代各模块的行为测试。不发网络请求（fetch 被替换为本地 404）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const clientSource = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
const wait = ms => act(async () => new Promise(resolve => setTimeout(resolve, ms)));

const opened = [];
function openWorkspace() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const w = dom.window;
  opened.push(w);
  for (const key of [
    'Response',
    'Request',
    'Headers',
    'ReadableStream',
    'TextEncoder',
    'TextDecoder',
    'structuredClone'
  ])
    w[key] ??= globalThis[key];
  // jsdom 的 Blob 没有 text()/arrayBuffer()，用其自带的 FileReader 补齐。
  const readAs = (blob, kind) =>
    new Promise((resolve, reject) => {
      const reader = new w.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader[kind](blob);
    });
  w.Blob.prototype.arrayBuffer ??= function () {
    return readAs(this, 'readAsArrayBuffer');
  };
  w.Blob.prototype.text ??= function () {
    return readAs(this, 'readAsText');
  };
  w.DOMMatrix ??= class DOMMatrix {};
  w.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.indexedDB = globalThis.indexedDB;
  w.IDBKeyRange = globalThis.IDBKeyRange;
  w.fetch = async () => new w.Response('{}', { status: 404 });
  // react-dom 在全局 window/document 上工作。
  globalThis.window = w;
  globalThis.document = w.document;

  const entries = [];
  w.__ModuleLoader__ = { load: entry => entries.push(entry) };
  w.eval(clientSource);
  assert.equal(entries.length, 1);
  const plugin = entries[0].factory(name => {
    assert.equal(name, 'react');
    return React;
  });
  const registrations = [];
  const services = {
    subdsh: {
      register: entry => {
        registrations.push(entry);
        return () => {};
      }
    }
  };
  const ctx = () => ({
    ...services,
    get: name => services[name],
    effect(fn) {
      const out = fn();
      if (out && typeof out.next === 'function') for (const step of out) void step;
    },
    inject(names, callback) {
      if (names.every(name => services[name])) callback(ctx());
      return { dispose() {} };
    },
    locale: { bind: () => key => key, register() {} }
  });
  plugin.apply(ctx());
  assert.equal(registrations.length, 1);

  const d = w.document;
  const root = createRoot(d.getElementById('root'));
  const text = () => {
    const copy = d.getElementById('root').cloneNode(true);
    copy.querySelectorAll('style').forEach(style => style.remove());
    return copy.textContent.replace(/\s+/g, ' ');
  };
  const buttons = () => [...d.querySelectorAll('button')];
  const click = async label => {
    const target = buttons().find(button => button.textContent.trim() === label);
    assert.ok(
      target,
      '找不到按钮：' +
        label +
        '；现有：' +
        buttons()
          .map(b => b.textContent.trim())
          .join(' | ')
    );
    await act(async () => {
      target.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    });
    await wait(150);
  };
  const choose = async (select, value) => {
    const setter = Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set;
    await act(async () => {
      setter.call(select, value);
      select.dispatchEvent(new w.Event('change', { bubbles: true }));
    });
  };
  return {
    w,
    d,
    text,
    click,
    choose,
    async mount() {
      await act(async () => root.render(React.createElement(() => registrations[0].render())));
      await wait(300);
    },
    async close() {
      await act(async () => root.unmount());
    }
  };
}

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
      // 失败时也关闭全部窗口，清掉导入轮询等定时器，避免进程挂起。
      for (const w of opened.splice(0)) w.close();
    }
  }
);
