import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_CSS } from './workspace-theme.js';
import { css } from './workspace.js';

const source = readFileSync(new URL('./workspace.js', import.meta.url), 'utf8');

test('theme layer is appended after the legacy styles so it wins the cascade', () => {
  assert.ok(css.includes(THEME_CSS));
  assert.match(source, /`\+THEME_CSS\+SESSION_LAYOUT_CSS\+INSIGHT_CSS;/);
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

test('identity step pre-selects only a reliable two-person split and offers a swap', () => {
  assert.match(source, /function guessIdentity\(messages\)\{[\s\S]*?if\(senders\.length!==2\)return \{\};/);
  assert.match(source, /button\('⇄ 交换',\(\)=>set\(\{self:s\.target,target:s\.self\}\)/);
});

test('status is shown as a dismissible live region and errors are not auto-hidden', () => {
  assert.match(source, /function StatusToast\(\{text,busy,onClose\}\)/);
  assert.match(source, /role:'status','aria-live':'polite'/);
  assert.match(source, /if\(busy\|\|\/失败\|错误\|无法\|不能\|请\/\.test\(text\)\)return;/);
});

test('source filter disables empty channels and the compose box supports Ctrl/Cmd+Enter', () => {
  assert.match(source, /className:'rn-actions rn-source-filter',role:'group'/);
  assert.match(source, /disabled:key!=='all'&&sourceChoice!==key&&!sourceCounts\[key\]/);
  assert.match(source, /e\.key==='Enter'&&\(e\.ctrlKey\|\|e\.metaKey\)&&!e\.nativeEvent\?\.isComposing/);
});
