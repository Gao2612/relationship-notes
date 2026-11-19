import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionPaneLayout, SESSION_BREAKPOINTS } from './session-layout.js';
import { css } from './workspace.js';

import { openWorkspace, closeAllWorkspaces } from '../test-support/workspace-dom.mjs';

test.afterEach(() => closeAllWorkspaces());

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

test('session toolbar buttons are driven by actual visibility, not by stored toggles', async () => {
  const toolbar = async sessionWidth => {
    const ws = openWorkspace({ sessionWidth });
    await ws.mount();
    await ws.importSample();
    await ws.click('沟通');
    const state = () => {
      const list = ws.findButton('☰ 列表'),
        tools = ws.findButton(/^(?:收起工具|工具)$/);
      return {
        list: list.getAttribute('aria-pressed'),
        tools: [ws.labelOf(tools), tools.getAttribute('aria-pressed')]
      };
    };
    return { ws, state };
  };
  // 宽屏：列表与工具栏都在，按钮按下；点按后跟着收起。
  const wide = await toolbar(1200);
  assert.deepEqual(wide.state(), { list: 'true', tools: ['收起工具', 'true'] });
  await wide.ws.click('☰ 列表');
  await wide.ws.click('收起工具');
  assert.deepEqual(wide.state(), { list: 'false', tools: ['工具', 'false'] });

  // 中等宽度：列表被容器查询藏起，虽然没有手动收起，按钮也不能显示为按下；打开抽屉后才按下。
  const compact = await toolbar(800);
  assert.deepEqual(compact.state(), { list: 'false', tools: ['收起工具', 'true'] });
  await compact.ws.click('☰ 列表');
  assert.equal(compact.state().list, 'true');

  // 手机宽度：工具栏默认不可见。
  const phone = await toolbar(390);
  assert.deepEqual(phone.state(), { list: 'false', tools: ['工具', 'false'] });
  await phone.ws.click('工具');
  assert.deepEqual(phone.state().tools, ['收起工具', 'true']);
});
