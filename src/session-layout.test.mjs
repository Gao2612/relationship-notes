import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionPaneLayout, SESSION_BREAKPOINTS } from './session-layout.js';
import { css } from './workspace.js';
import { compactSource } from './test-support/compact-source.mjs';

const source = compactSource(readFileSync(new URL('./workspace.js', import.meta.url), 'utf8'));

test('wide layout: list and tools are inline and the buttons mirror the user toggles', () => {
  assert.deepEqual(sessionPaneLayout(1200), {
    listMode: 'inline',
    toolsMode: 'inline',
    listVisible: true,
    toolsVisible: true,
    classes: []
  });
  const hidden = sessionPaneLayout(1200, { listHidden: true, toolsHidden: true });
  assert.equal(hidden.listVisible, false);
  assert.equal(hidden.toolsVisible, false);
  assert.deepEqual(hidden.classes, ['list-hidden', 'right-hidden']);
});

test('compact and phone layouts never report a hidden list as selected', () => {
  for (const width of [900, 760, 620, 390]) {
    const layout = sessionPaneLayout(width, { listHidden: false });
    assert.equal(layout.listMode, 'drawer', String(width));
    assert.equal(layout.listVisible, false, 'list is hidden by the container query at ' + width);
    assert.deepEqual(sessionPaneLayout(width, { listDrawer: true }).classes.includes('list-open'), true);
  }
});

test('phone layout reports tools as hidden until opened; wider layouts can collapse them', () => {
  assert.equal(sessionPaneLayout(390).toolsVisible, false);
  assert.deepEqual(sessionPaneLayout(390, { toolsOpen: true }).classes, ['right-open']);
  assert.equal(sessionPaneLayout(621).toolsMode, 'inline');
  assert.equal(sessionPaneLayout(621, { toolsOpen: true, toolsHidden: true }).toolsVisible, false);
});

test('unmeasured width falls back to the wide layout used by the first CSS frame', () => {
  assert.equal(sessionPaneLayout(0).listMode, 'inline');
  assert.equal(sessionPaneLayout(undefined).toolsMode, 'inline');
});

test('breakpoints stay in sync with the container queries in the stylesheet', () => {
  assert.match(
    css,
    new RegExp(
      '@container rn-session-shell \\(max-width:' +
        SESSION_BREAKPOINTS.compact +
        'px\\)\\{\\.rnw #rn-panel \\.rn-session\\{[^}]*\\}\\.rnw #rn-panel \\.rn-session-list-pane\\{display:none!important\\}'
    )
  );
  assert.match(
    css,
    new RegExp(
      '@container rn-session-shell \\(max-width:' +
        SESSION_BREAKPOINTS.narrow +
        'px\\)\\{\\.rnw #rn-panel \\.rn-session\\{[^}]*\\}\\.rnw #rn-panel \\.rn-session-right\\{display:none!important\\}'
    )
  );
  assert.match(css, /\.list-open \.rn-session-list-pane\{display:block!important/);
});

// 「☰ 列表」的 aria-pressed / aria-expanded 随实际可见性翻转见 workspace-dom-behavior.test.mjs。
test('session toolbar buttons are driven by actual visibility, not by stored toggles', () => {
  assert.match(
    source,
    /button\(layout\.toolsVisible\?'收起工具':'工具',toggleTools,\{'aria-pressed':layout\.toolsVisible/
  );
  assert.doesNotMatch(source, /'aria-pressed':!listHidden/);
});
