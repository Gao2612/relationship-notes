import test from 'node:test';
import assert from 'node:assert/strict';
import { THEME_CSS, SESSION_LAYOUT_CSS, INSIGHT_CSS } from './workspace-theme.js';
import { css } from './workspace.js';
import { openWorkspace, closeAllWorkspaces, wait } from '../test-support/workspace-dom.mjs';

test.afterEach(() => closeAllWorkspaces());

test('theme layer is appended after the legacy styles so it wins the cascade', () => {
  assert.ok(css.endsWith(THEME_CSS + SESSION_LAYOUT_CSS + INSIGHT_CSS), '主题、会话布局与分析页样式依次追加在最后');
  assert.ok(css.length > (THEME_CSS + SESSION_LAYOUT_CSS + INSIGHT_CSS).length, '前面是旧版基础样式');
});

test('theme colours derive from host variables so dark hosts stay readable', () => {
  for (const token of [
    '--rn-bg:var(--background',
    '--rn-fg:var(--foreground',
    '--rn-line:var(--border',
    '--rn-sub:var(--muted-foreground'
  ])
    assert.ok(THEME_CSS.includes(token), token);
  // 会话区不再写死白底/浅绿底
  assert.match(THEME_CSS, /\.rn-session-history\{background:var\(--rn-surface\)!important/);
  assert.match(THEME_CSS, /\.rn-session-bubble\{background:var\(--rn-bg\)!important/);
});

test('theme keeps keyboard focus visible and honours reduced motion', () => {
  assert.match(THEME_CSS, /:focus-visible\{outline:2px solid/);
  assert.match(THEME_CSS, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(THEME_CSS, /min-height:(?:[0-3]\d|4[0-3])px/);
});

const identitySelects = ws =>
  ws.all('select').filter(select => /哪位是/.test(select.closest('label')?.textContent || ''));
async function pasteChat(ws, chat) {
  const area = ws.all('textarea').find(node => node.getAttribute('aria-label') === '粘贴 TXT 或 JSON 聊天记录');
  area.value = chat;
  await ws.click('读取粘贴内容', 500);
}

test('identity step pre-selects only a reliable two-person split and offers a swap', async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.click(ws.buttons().find(b => b.closest('.rn-head') && ws.labelOf(b) === '导入聊天'));
  await pasteChat(ws, '[2026-10-21 09:00] 我: 早\n[2026-10-21 09:01] 阿青: 早呀');
  assert.deepEqual(
    identitySelects(ws).map(select => select.value),
    ['我', '阿青'],
    '两人且有一方叫“我”时自动预选'
  );
  await ws.click(ws.buttons().find(b => b.getAttribute('aria-label') === '交换双方身份'));
  assert.deepEqual(
    identitySelects(ws).map(select => select.value),
    ['阿青', '我']
  );

  // 三位发言人：不猜，留给用户选择。
  await ws.click('导入文件');
  await pasteChat(ws, '[2026-10-21 09:00] 我: 早\n[2026-10-21 09:01] 阿青: 早呀\n[2026-10-21 09:02] 小禾: 大家好');
  assert.deepEqual(
    identitySelects(ws).map(select => select.value),
    ['', '']
  );
  assert.match(ws.text(), /检测到多位发言人/);
  assert.equal(ws.buttons().find(b => b.getAttribute('aria-label') === '交换双方身份').disabled, true);
});

test('status is shown as a dismissible live region and errors are not auto-hidden', { timeout: 30000 }, async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importSample();
  await ws.click('沟通');
  const toast = () => ws.root.querySelector('.rn-toast');
  await ws.click('复制提示词');
  assert.equal(toast().getAttribute('role'), 'status');
  assert.equal(toast().getAttribute('aria-live'), 'polite');
  assert.equal(ws.text(toast().querySelector('span')), '提示词已复制，可粘贴到 DSH 主对话使用。');
  await ws.click(toast().querySelector('button[aria-label="关闭提示"]'));
  assert.equal(toast(), null, '可手动关闭');

  // 普通提示 6 秒后自动消失；失败提示一直保留到用户关闭。
  await ws.click('复制提示词');
  await wait(6300);
  assert.equal(toast(), null, '成功提示自动消失');
  ws.clipboard.fails = true;
  await ws.click('复制提示词');
  assert.match(ws.text(toast()), /无法复制/);
  assert.ok(toast().classList.contains('rn-toast-error'));
  await wait(6300);
  assert.ok(toast(), '失败提示不会自动隐藏');
});

test('source filter disables empty channels and the compose box supports Ctrl/Cmd+Enter', async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importSample();
  await ws.click('记录与评分');
  await ws.click('每日历程');
  const filter = ws.root.querySelector('.rn-source-filter');
  assert.equal(filter.getAttribute('role'), 'group');
  const sources = [...filter.querySelectorAll('button')].map(b => [
    ws.labelOf(b),
    b.disabled,
    b.getAttribute('aria-pressed')
  ]);
  assert.deepEqual(sources, [
    ['全部 5 条', false, 'true'],
    ['微信 5 条', false, 'false'],
    ['QQ 0 条', true, 'false']
  ]);
  assert.equal(filter.querySelectorAll('button')[2].title, '该来源暂无记录');

  await ws.click('沟通');
  const compose = ws.all('textarea').find(node => node.getAttribute('aria-label') === '回复意图');
  const draft = () => ws.root.querySelector('.rn-session-draft textarea')?.value || '';
  await ws.key(compose, 'Enter');
  await ws.key(compose, 'Enter', { ctrlKey: true, isComposing: true });
  await wait(100);
  assert.equal(draft(), '', '普通回车与输入法组字中的 Ctrl+Enter 不生成');
  await ws.key(compose, 'Enter', { metaKey: true });
  await wait(100);
  assert.notEqual(draft(), '', '⌘+Enter 生成（未配置模型时生成本地草稿）');
  await ws.click('复制草稿');
  assert.equal(ws.copied.at(-1), draft());
});
