import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { apply as applyHost } from './index.js';

function loadClient() {
  const entries = [];
  const React = {
    useState: v => [v, () => {}],
    useRef: current => ({ current }),
    useEffect() {},
    useMemo: fn => fn(),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children })
  };
  // PDF.js uses the browser DOMMatrix constructor at module initialization.
  // No rendering/media APIs are invoked by this workspace mounting smoke test.
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    AbortController,
    DOMException,
    Blob,
    Response,
    Request,
    Headers,
    ReadableStream,
    setTimeout,
    clearTimeout,
    DOMMatrix: class DOMMatrix {},
    performance,
    window: { __ModuleLoader__: { load: entry => entries.push(entry) } }
  };
  vm.runInNewContext(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), sandbox, {
    timeout: 10000,
    filename: 'client.js'
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'dsh-relationship-notes');
  const required = [];
  const plugin = entries[0].factory(name => {
    required.push(name);
    assert.equal(name, 'react');
    return React;
  });
  assert.deepEqual(required, ['react']);
  return plugin;
}
// Minimal cordis-like host: services map, ctx.get, nested ctx.inject, generator effects.
function fakeHost(services) {
  const effects = [];
  const run = fn => {
    const out = fn();
    if (out && typeof out[Symbol.iterator] === 'function' && typeof out.next === 'function') {
      for (const step of out) void step;
    }
  };
  const make = () => ({
    ...services,
    get: name => services[name],
    effect(fn, label) {
      effects.push(label);
      if (/module|native panel/.test(label || '')) run(fn);
    },
    inject(names, cb) {
      if (names.every(n => services[n])) cb(make());
      return { dispose() {} };
    },
    locale: { bind: () => key => key, register() {} }
  });
  return { ctx: make(), effects };
}
const resolve = node =>
  Array.isArray(node)
    ? node.map(resolve)
    : node && typeof node === 'object'
      ? typeof node.type === 'function'
        ? resolve(node.type(node.props))
        : { ...node, children: node.children.map(resolve) }
      : node;

test('built client factory executes and mounts a renderable DSH module', () => {
  const plugin = loadClient(),
    registrations = [];
  // subdsh is no longer a top-level requirement, so hosts without it can still boot.
  assert.deepEqual(Array.from(plugin.inject), ['locale']);
  const { ctx } = fakeHost({
    subdsh: {
      register: entry => {
        registrations.push(entry);
        return () => {};
      }
    }
  });
  plugin.apply(ctx);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, 'relationship-notes');
  const page = resolve(registrations[0].render());
  assert.equal(typeof page.type, 'string');
  assert.match(page.props.className, /rnw/);
});

test('hosts without subdsh get a native sidebar panel instead of a blocked boot', () => {
  const plugin = loadClient(),
    slots = [];
  const { ctx } = fakeHost({
    slots: {
      inject: (name, fn) => fn(),
      register: (options, component) => {
        slots.push({ options, component });
        return () => {};
      }
    }
  });
  plugin.apply(ctx);
  assert.deepEqual(
    slots.map(s => s.options.name),
    ['main', 'sidebar.panellist']
  );
  assert.equal(slots[0].options.key, 'relationship-notes');
  assert.equal(slots[1].options.id, 'relationship-notes');
  assert.equal(typeof slots[1].options.label, 'function');
  const panel = resolve({ type: slots[0].component, props: {}, children: [] });
  assert.match(panel.props.className, /rn-native-panel/);
  assert.match(panel.children[0].props.className, /rnw/);
});

test('hosts that provide subdsh do not also get the sidebar fallback', () => {
  const plugin = loadClient(),
    slots = [],
    registrations = [];
  const { ctx } = fakeHost({
    subdsh: {
      register: entry => {
        registrations.push(entry);
        return () => {};
      }
    },
    slots: {
      inject: (name, fn) => fn(),
      register: o => {
        slots.push(o);
        return () => {};
      }
    }
  });
  plugin.apply(ctx);
  assert.equal(registrations.length, 1);
  assert.equal(slots.length, 0);
});

test('published host entry registers executable routes and tools together', () => {
  const routes = [],
    tools = [];
  const scope = {
    connection: { fetch: { register: r => routes.push(r) } },
    tools: { register: t => tools.push(t) },
    llm: {},
    agentDefaultModel: { currentSelection: () => null },
    attachments: {}
  };
  applyHost({
    inject(_names, callback) {
      return callback(scope);
    }
  });
  assert.equal(new Set(routes.map(r => r.path)).size, routes.length);
  for (const route of routes) {
    assert.equal(typeof route.fetch, 'function');
    assert.deepEqual(route.methods, ['POST']);
  }
  for (const path of ['/reply', '/profile-analysis', '/interpretation', '/import/read', '/profile/sync'])
    assert(
      routes.some(r => r.path === '/api/relationship-notes' + path),
      path
    );
  assert(tools.some(t => t.name === 'relationship_notes_import'));
  assert(tools.some(t => t.name === 'relationship_notes_profile_get'));
});
