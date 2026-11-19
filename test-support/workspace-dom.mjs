// 共享的真实 DOM 测试夹具：在 jsdom 中用真实 React 18 渲染构建产物 client.js，
// 宿主只提供 subdsh 容器与 locale，IndexedDB 由 fake-indexeddb 提供，fetch 默认返回本地 404。
// 这里只放装配与交互工具；断言写在各个 *.test.mjs 里。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

// react-dom 在模块加载时检测 DOM 能力（canUseDOM、input 事件支持等）。先给它一个 window，
// 否则它会退回旧版 IE 的 input 事件补丁，文本框上的键盘事件会报错。
const bootstrap = new JSDOM('<!doctype html>');
globalThis.window = bootstrap.window;
globalThis.document = bootstrap.window.document;
const { createRoot } = await import('react-dom/client');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
export const wait = ms => act(async () => new Promise(resolve => setTimeout(resolve, ms)));

const opened = [];
/** 关闭所有打开过的窗口，清掉导入轮询等定时器，避免进程挂起。放在 finally / test.after 里调用。 */
export function closeAllWorkspaces() {
  for (const w of opened.splice(0)) w.close();
}

/**
 * 打开一个工作区。
 * @param {object} [options]
 * @param {IDBFactory} [options.indexedDB] 传入同一个实例即可模拟“关闭后重新打开”；缺省时每次都是空数据库。
 * @param {(url: string, init: object, w: Window) => Promise<Response>} [options.fetch] 替换宿主网络请求。
 * @param {boolean} [options.reducedMotion] matchMedia('(prefers-reduced-motion: reduce)') 的结果。
 * @param {number} [options.sessionWidth] 会话外壳 .rn-session-shell 的测量宽度（jsdom 不做布局，默认 0 = 未测量）。
 */
export function openWorkspace({ indexedDB = new IDBFactory(), fetch, reducedMotion = false, sessionWidth = 0 } = {}) {
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
  const animations = [];
  w.HTMLElement.prototype.animate = function (keyframes, timing) {
    animations.push({ node: this, keyframes, timing });
    return { cancel() {}, finished: Promise.resolve() };
  };
  w.matchMedia = query => ({
    matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reducedMotion : false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  });
  w.indexedDB = indexedDB;
  w.IDBKeyRange = IDBKeyRange;
  const requests = [];
  w.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return fetch ? fetch(String(url), init, w) : new w.Response('{}', { status: 404 });
  };
  const downloads = [];
  w.URL.createObjectURL = blob => {
    downloads.push(blob);
    return 'blob:test/' + downloads.length;
  };
  w.URL.revokeObjectURL = () => {};
  const realRect = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    const rect = realRect.call(this);
    return this.classList?.contains('rn-session-shell') ? { ...rect, width: sessionWidth } : rect;
  };
  const copied = [];
  const clipboard = { fails: false };
  Object.defineProperty(w.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async value => {
        if (clipboard.fails) throw new w.DOMException('denied', 'NotAllowedError');
        copied.push(value);
      }
    }
  });
  // react-dom 与插件都在全局 window/document/indexedDB 上工作。
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;

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
  const rootNode = d.getElementById('root');
  const root = createRoot(rootNode);
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  /** 根节点去掉 <style> 后的可见文本，空白折叠为单个空格。 */
  const text = (node = rootNode) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('style').forEach(style => style.remove());
    return normalize(copy.textContent);
  };
  const all = selector => [...rootNode.querySelectorAll(selector)];
  const buttons = () => all('button');
  const labelOf = node => normalize(node.textContent);
  const findButton = label =>
    buttons().find(button => (label instanceof RegExp ? label.test(labelOf(button)) : labelOf(button) === label));
  const fire = async (node, event) => {
    await act(async () => {
      node.dispatchEvent(event);
    });
  };
  const click = async (target, settle = 150) => {
    const node = typeof target === 'string' || target instanceof RegExp ? findButton(target) : target;
    assert.ok(node, '找不到按钮：' + target + '；现有：' + buttons().map(labelOf).join(' | '));
    await fire(node, new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(settle);
  };
  const setValue = async (node, value) => {
    const proto =
      node instanceof w.HTMLSelectElement
        ? w.HTMLSelectElement.prototype
        : node instanceof w.HTMLTextAreaElement
          ? w.HTMLTextAreaElement.prototype
          : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
    await fire(node, new w.Event(node instanceof w.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const key = async (node, keyName, init = {}) => {
    await fire(node, new w.KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...init }));
  };
  const chooseFile = async (input, file) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await fire(input, new w.Event('change', { bubbles: true }));
  };
  /** 简短描述一个节点，用于断言消息（不要把 DOM 节点直接交给 assert.equal：失败时 inspect 整个 jsdom 会耗尽内存）。 */
  const describe = node =>
    !node
      ? String(node)
      : node === d.body
        ? 'body'
        : node.tagName.toLowerCase() +
          (node.id ? '#' + node.id : '') +
          (node.className && typeof node.className === 'string'
            ? '.' + node.className.trim().split(/\s+/).join('.')
            : '') +
          ' “' +
          normalize(node.textContent).slice(0, 30) +
          '”';
  const ws = {
    w,
    describe,
    /** 断言当前焦点就是 node。 */
    assertFocus(node, message) {
      assert.ok(
        d.activeElement === node,
        (message ? message + '：' : '') + '焦点在 ' + describe(d.activeElement) + '，应在 ' + describe(node)
      );
    },
    /** 让焦点回到 body（jsdom 中 body.focus() 无效，只能让当前元素失焦）。 */
    blur() {
      d.activeElement?.blur?.();
    },
    d,
    root: rootNode,
    React,
    text,
    all,
    buttons,
    findButton,
    labelOf,
    click,
    setValue,
    key,
    fire,
    chooseFile,
    requests,
    downloads,
    copied,
    /** 设为 true 时 navigator.clipboard.writeText 抛错。 */
    clipboard,
    animations,
    /** 插件实际挂载到页面里的样式表文本。 */
    styles: () =>
      all('style')
        .map(style => style.textContent)
        .join('\n'),
    async mount() {
      await act(async () => root.render(React.createElement(() => registrations[0].render())));
      await wait(300);
    },
    async close() {
      await act(async () => root.unmount());
    },
    /** 打开一级分组下的某个页面（按导航按钮的文字）。 */
    async open(label) {
      await click(label);
    },
    /** 载入内置虚构示例并以“我 / 小禾”确认导入。 */
    async importSample() {
      await click('载入内置示例聊天（虚构）');
      await wait(500);
      await ws.confirmIdentity('我', '小禾');
    },
    /** 在“确认身份”步骤选择双方并导入。 */
    async confirmIdentity(self, target) {
      const identity = all('select').filter(select => [...select.options].some(o => o.textContent === target));
      assert.equal(identity.length, 2, '“我”与“联系人”两个选择框');
      await setValue(identity[0], self);
      await setValue(identity[1], target);
      await click('确认并导入');
      await wait(500);
    },
    /** 通过“粘贴聊天记录”导入一段 TXT 聊天（格式同内置示例：`[YYYY-MM-DD HH:mm] 发送者: 内容`）。 */
    async importText(chat, self, target) {
      const settings = rootNode.querySelector('.rn-settings-menu');
      settings.open = true;
      await fire(settings, new w.Event('toggle'));
      await click('聊天导入');
      const area = all('textarea').find(node => node.getAttribute('aria-label') === '粘贴 TXT 或 JSON 聊天记录');
      assert.ok(area, '粘贴聊天记录输入框');
      area.value = chat;
      await click('读取粘贴内容', 500);
      await ws.confirmIdentity(self, target);
    }
  };
  return ws;
}

/**
 * 在打开工作区之前，把一份已保存的工作区快照写进 IndexedDB（与插件自己的持久化格式一致），
 * 用于从任意初始状态开始测试。返回的 IDBFactory 交给 openWorkspace({ indexedDB })。
 */
export async function seedWorkspace(state, { indexedDB = new IDBFactory(), schemaVersion = 2 } = {}) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('dsh-relationship-notes', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put({ schemaVersion, savedAt: Date.now(), state }, 'current');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return indexedDB;
}

/** 把 console.error 收集起来（忽略 React 的 act 提示），用于断言渲染期间没有报错。 */
export function captureConsoleErrors() {
  const errors = [];
  const original = console.error;
  console.error = (...args) => {
    const message = String(args[0]);
    if (!/not wrapped in act/.test(message)) errors.push(message.slice(0, 500));
  };
  return {
    errors,
    restore() {
      console.error = original;
    }
  };
}
