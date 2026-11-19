import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIcon, ICON_NAMES } from './icons.js';
import { NAVIGATION } from '../navigation.js';
import { THEME_CSS } from '../workspace-theme.js';
import { compactSource } from '../test-support/compact-source.mjs';

const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() })
};
const source = compactSource(readFileSync(new URL('../workspace.js', import.meta.url), 'utf8'));

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

test('the header shows who the relationship is with and its pulse, linking to the analysis', () => {
  assert.match(source, /className:'rn-identity-strip'/);
  assert.match(source, /function Pulse\(\{contact\}\)[\s\S]*?nav\('behavior','insight'\)/);
  assert.match(source, /PULSE_MAX_MESSAGES=40000/);
  assert.match(source, /E\.analyzeRelationshipCached\(contact\)/);
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

test('page changes animate once and respect reduced motion', () => {
  assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\)+return;node\.animate/);
});
