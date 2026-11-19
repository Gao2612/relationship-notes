import test from 'node:test';
import assert from 'node:assert/strict';
import { createIcon, ICON_NAMES } from './icons.js';
import { NAVIGATION } from '../navigation.js';
import { THEME_CSS } from '../workspace-theme.js';
import { openWorkspace, closeAllWorkspaces } from '../../test-support/workspace-dom.mjs';

const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() })
};

test.afterEach(() => closeAllWorkspaces());

test('every level-one navigation entry has an icon and icons are decorative by default', () => {
  const Icon = createIcon(React);
  for (const group of NAVIGATION) {
    assert.ok(ICON_NAMES.includes(group.id), group.id);
    const svg = Icon({ name: group.id });
    assert.equal(svg.type, 'svg');
    assert.equal(svg.props['aria-hidden'], true);
    assert.equal(svg.props.stroke, 'currentColor');
  }
  assert.equal(Icon({ name: 'missing' }), null);
  assert.equal(Icon({ name: 'book', title: '关系手记' }).props.role, 'img');
});

test('the header shows who the relationship is with and its pulse, linking to the analysis', async () => {
  const ws = openWorkspace();
  await ws.mount();
  const strip = () => ws.root.querySelector('.rn-head .rn-identity-strip');
  assert.match(ws.text(strip()), /关系手记导入一段聊天，开始记录你们的关系/);
  assert.equal(ws.root.querySelector('.rn-pulse'), null, '没有联系人时没有脉搏');

  await ws.importSample();
  assert.equal(ws.text(strip().querySelector('.rn-identity-name')), '小禾');
  assert.deepEqual(
    [...strip().querySelector('.rn-head-sub').children].map(span => ws.text(span)),
    ['虚构示例', '5 条消息', '最近聊天 10-21']
  );
  const pulse = ws.root.querySelector('.rn-head .rn-pulse');
  assert.match(pulse.getAttribute('aria-label'), /^关系指数 \d+，查看关系分析$/);
  assert.ok(pulse.querySelector('svg polyline, svg circle'), '画出最近的指数走势');
  await ws.click(pulse);
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-context-tabs [aria-selected="true"]')), '关系分析');
});

test('design tokens keep one accent per meaning and the phone layout moves navigation to the bottom', () => {
  for (const token of [
    '--rn-brand:#3E8A7E',
    '--rn-pulse:#B95C7E',
    '--rn-ai:#4361A8',
    '--rn-amber:#B07A22',
    '--rn-font-num:'
  ])
    assert.ok(THEME_CSS.includes(token), token);
  assert.match(
    THEME_CSS,
    /@media\(max-width:620px\)\{[\s\S]*?\.rn-tabs\.rn-group-tabs\{position:fixed;left:0;right:0;bottom:0/
  );
  assert.match(THEME_CSS, /env\(safe-area-inset-bottom\)/);
  // 分区不再统一套阴影：阴影只给浮层
  assert.match(THEME_CSS, /\.rnw \.rn-box\{[^}]*box-shadow:none!important/);
});

test('page changes animate once and respect reduced motion', async () => {
  const ws = openWorkspace();
  await ws.mount();
  assert.equal(ws.animations.length, 0, '首次渲染不播放');
  await ws.click('记录与评分');
  assert.equal(ws.animations.length, 1, '每次切换页面播放一次');
  assert.equal(ws.animations[0].node.id, 'rn-panel');
  assert.deepEqual(JSON.parse(JSON.stringify(ws.animations[0].keyframes.at(-1))), { opacity: 1, transform: 'none' });

  const reduced = openWorkspace({ reducedMotion: true });
  await reduced.mount();
  await reduced.click('记录与评分');
  await reduced.click('沟通');
  assert.equal(reduced.animations.length, 0, '减少动态效果时不播放');
});
