// 真实 DOM 测试环境：在 jsdom 中用真实 React 18 渲染构建产物 client.js。
// 不发网络请求（fetch 固定返回本地 404）；IndexedDB 由 fake-indexeddb 提供。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const clientSource = readFileSync(new URL('../../client.js', import.meta.url), 'utf8');
export const wait = ms => act(async () => new Promise(resolve => setTimeout(resolve, ms)));

const opened = [];

/** 关闭全部窗口，清掉导入轮询等定时器，避免进程挂起。 */
export function closeAllWindows() {
  for (const w of opened.splice(0)) w.close();
}

/** 打开一个新的工作区页面；fresh=true 时换用空的 IndexedDB。 */
/**
 * 在 jsdom 中模拟 Blob URL + Web Worker：Worker 源码在独立的 vm 上下文里执行，消息经结构化克隆异步投递。
 * hold() 之后 Worker 的回复会被扣住，release() 再一次性放行，用来观察“正在后台分析”状态。
 */
function installWorker(w) {
  const blobs = new Map();
  let seq = 0;
  const control = { jobs: 0, held: [], holding: false };
  control.hold = () => (control.holding = true);
  control.release = () => {
    control.holding = false;
    for (const deliver of control.held.splice(0)) deliver();
  };
  w.URL.createObjectURL = blob => {
    const url = 'blob:rn/' + ++seq;
    blobs.set(url, blob);
    return url;
  };
  w.URL.revokeObjectURL = url => blobs.delete(url);
  w.Worker = class Worker {
    constructor(url) {
      const blob = blobs.get(url);
      if (!blob) throw new Error('unknown blob url');
      this.onmessage = null;
      this.onerror = null;
      const self = {
        postMessage: message => {
          const data = structuredClone(message);
          const deliver = () => setTimeout(() => this.onmessage?.({ data }), 0);
          if (control.holding) control.held.push(deliver);
          else deliver();
        }
      };
      this.ready = blob.text().then(source => {
        vm.runInNewContext(source, { self, Intl, Date, Math, JSON, Map, Set, WeakMap, Array, Object, String, Number });
        return self;
      });
    }
    postMessage(data) {
      control.jobs++;
      const copy = structuredClone(data);
      this.ready.then(self => setTimeout(() => self.onmessage({ data: copy }), 0));
    }
    terminate() {}
  };
  return control;
}

export function openWorkspace({ fresh = false, worker = false } = {}) {
  if (fresh) globalThis.indexedDB = new IDBFactory();
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
  const workerControl = worker ? installWorker(w) : null;
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
  const press = async (target, key, init = {}) => {
    await act(async () => {
      target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    });
    await wait(50);
  };
  const importSample = async () => {
    await click('载入内置示例聊天（虚构）');
    await wait(500);
    const identity = [...d.querySelectorAll('select')].filter(select =>
      [...select.options].some(option => option.textContent === '小禾')
    );
    assert.equal(identity.length, 2, '“我”与“联系人”两个选择框');
    await choose(identity[0], '我');
    await choose(identity[1], '小禾');
    await click('确认并导入');
    await wait(500);
  };
  const importText = async (name, text) => {
    await click('聊天导入');
    const input = d.querySelector('input[type=file]');
    assert.ok(input, '文件输入框');
    const file = new w.File([text], name, { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new w.Event('change', { bubbles: true }));
    });
    await wait(600);
  };
  return {
    workerControl,
    importText,
    w,
    d,
    text,
    click,
    choose,
    press,
    importSample,
    buttons,
    button: label => buttons().find(b => b.textContent.trim() === label),
    async mount() {
      await act(async () => root.render(React.createElement(() => registrations[0].render())));
      await wait(300);
    },
    async close() {
      await act(async () => root.unmount());
    }
  };
}
