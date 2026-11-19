// 用户可见行为的真实 DOM 测试，取代 workspace.rendering / workspace-theme / session-layout /
// data-expression 中原先按源码文本匹配的对应断言。环境见 src/test-support/dom-harness.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorkspace, closeAllWindows, wait } from './src/test-support/dom-harness.mjs';

const options = { timeout: 60000 };
test.afterEach(() => closeAllWindows());

const selectedTab = (d, list) =>
  [...d.querySelectorAll('[role=tablist]')[list].querySelectorAll('[role=tab]')]
    .filter(tab => tab.getAttribute('aria-selected') === 'true')
    .map(tab => tab.textContent.trim());

test('navigation exposes two tablists that control #rn-panel with exactly one selected tab each', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  const { d } = p;
  const check = () => {
    const lists = [...d.querySelectorAll('[role=tablist]')];
    assert.equal(lists.length, 2, '一级与二级导航');
    for (const list of lists) {
      const tabs = [...list.querySelectorAll('[role=tab]')];
      assert.ok(tabs.length > 1);
      assert.equal(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true').length, 1);
      for (const tab of tabs) {
        assert.equal(tab.getAttribute('aria-controls'), 'rn-panel');
        assert.equal(tab.hasAttribute('aria-pressed'), false, 'tab 用 aria-selected，不用 aria-pressed');
        assert.match(tab.id, /^rn-tab-rn-(?:group|context)-tabs-/);
      }
    }
    const panel = d.getElementById('rn-panel');
    assert.equal(panel.getAttribute('role'), 'tabpanel');
    assert.equal(panel.getAttribute('tabindex'), '-1');
  };
  check();
  assert.deepEqual(selectedTab(d, 0), ['联系人']);
  await p.click('记录与评分');
  check();
  assert.deepEqual(selectedTab(d, 0), ['记录与评分']);
  assert.ok(d.getElementById('rn-tab-rn-group-tabs-records'));
  await p.click('互动评分');
  check();
  assert.deepEqual(selectedTab(d, 1), ['互动评分']);
});

test('start guide steps navigate to import, identity and scoring', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  const { d } = p;
  assert.match(p.text(), /三步开始/);
  assert.match(p.text(), /导入聊天.*确认身份.*查看评分与时间线/);
  const guideButton = label =>
    [...d.querySelectorAll('ol li button, li button')].find(b => b.textContent.trim() === label);
  const go = async label => {
    const target = guideButton(label);
    assert.ok(target, label);
    target.click();
    await wait(150);
  };
  await go('导入聊天');
  assert.deepEqual(selectedTab(d, 1), ['导入文件']);
  await p.click('联系人');
  await go('确认身份');
  assert.deepEqual(selectedTab(d, 1), ['身份确认']);
  await p.click('联系人');
  await go('查看评分与时间线');
  assert.deepEqual(selectedTab(d, 0), ['记录与评分']);
  assert.deepEqual(selectedTab(d, 1), ['互动评分']);
  // 没有联系人时页头只给出导入入口，不显示无效的联系人选择。
  assert.ok(p.button('导入聊天'));
});

test('identity step preselects “我”, swaps with ⇄ and shows a polite status toast after import', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  const { d } = p;
  await p.click('载入内置示例聊天（虚构）');
  await wait(500);
  const identity = () =>
    [...d.querySelectorAll('select')]
      .filter(select => [...select.options].some(option => option.textContent === '小禾'))
      .map(select => select.value);
  assert.deepEqual(identity(), ['我', '小禾'], '只有两位发言人且能识别“我”时自动预选');
  await p.click('⇄ 交换');
  assert.deepEqual(identity(), ['小禾', '我']);
  await p.click('⇄ 交换');
  await p.click('确认并导入');
  await wait(500);
  const toast = d.querySelector('.rn-toast');
  assert.ok(toast, '导入后出现提示条');
  assert.equal(toast.getAttribute('role'), 'status');
  assert.equal(toast.getAttribute('aria-live'), 'polite');
  const close = toast.querySelector('button[aria-label="关闭提示"]');
  assert.ok(close);
  close.click();
  await wait(100);
  assert.equal(d.querySelector('.rn-toast'), null, '点 × 关闭提示条');
});

test('daily timeline: source filter, accessible charts, gap markers and folded details', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  await p.importSample();
  await p.click('记录与评分');
  await p.click('每日历程');
  const { d } = p;

  const filter = d.querySelector('.rn-source-filter');
  assert.equal(filter.getAttribute('role'), 'group');
  const sources = [...filter.querySelectorAll('button')];
  assert.deepEqual(
    sources.map(b => b.textContent.trim()),
    ['全部 5 条', '微信 5 条', 'QQ 0 条']
  );
  assert.deepEqual(
    sources.map(b => b.getAttribute('aria-pressed')),
    ['true', 'false', 'false']
  );
  assert.equal(sources[2].disabled, true, '无记录的来源自动禁用');
  assert.equal(sources[1].disabled, false);

  for (const chart of ['score', 'bar', 'pie']) {
    assert.ok(d.getElementById('rn-' + chart + '-chart-title'), chart + ' title');
    assert.ok(d.getElementById('rn-' + chart + '-chart-desc'), chart + ' desc');
  }
  assert.equal(d.querySelectorAll('[id$="-chart-title"]').length, 3, '每日历程仍是 3 张图');
  const charts = [...d.querySelectorAll('svg.rn-annual-chart')];
  assert.equal(charts.length, 3);
  for (const chart of charts) {
    assert.equal(chart.getAttribute('role'), 'img');
    assert.ok(chart.getAttribute('aria-label'));
    const [title, desc] = chart.getAttribute('aria-labelledby').split(' ');
    assert.match(title, /^rn-(?:score|bar|pie)-chart-title$/);
    assert.equal(desc, title.replace('-title', '-desc'));
    assert.ok(d.getElementById(title) && d.getElementById(desc));
  }
  const titles = [...d.querySelectorAll('svg title')].map(t => t.textContent);
  assert.ok(
    titles.some(t => /无记录（缺口），不代表分数下降/.test(t)),
    '缺口单独标注'
  );
  assert.ok(titles.some(t => /关系指数 51/.test(t)));

  const fold = [...d.querySelectorAll('details')].find(el =>
    /展开更多分析/.test(el.querySelector('summary')?.textContent || '')
  );
  assert.ok(fold, '「展开更多分析」折叠区');
  assert.equal(fold.open, false, '默认折叠');
  assert.ok(!fold.contains(d.getElementById('rn-score-chart-title')), '主趋势图留在首屏');
  assert.ok(!fold.contains(d.getElementById('rn-bar-chart-title')), '消息量图留在首屏');
  assert.ok(fold.contains(d.getElementById('rn-pie-chart-title')), '占比图在折叠区');
  const table = [...fold.querySelectorAll('summary')].find(s => /查看完整数据表（\d+ 行）/.test(s.textContent));
  assert.ok(table, '完整数据表入口');
  const rows = Number(/（(\d+) 行）/.exec(table.textContent)[1]);
  assert.equal(table.parentElement.querySelectorAll('tbody tr').length, rows, '行数与入口文字一致');
});

test('reply drafts without a model explain why and link to model settings', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  await p.importSample();
  await p.click('沟通');
  assert.match(p.text(), /尚未配置模型，暂时不能生成 AI 草稿/);
  assert.match(p.text(), /未配置模型时不会调用模型，也不会推断对方的真实想法/);
  assert.ok(p.button('复制提示词'));
  assert.match(p.text(), /查看如何配置/);
  await p.click('去设置选择模型');
  assert.deepEqual(selectedTab(p.d, 0), ['设置']);
  assert.match(p.text(), /回复设置与模型授权/);
});

test('session list toggle keeps aria-pressed / aria-expanded in sync with visibility', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  await p.importSample();
  await p.click('沟通');
  await p.click('会话');
  const toggle = () => p.button('☰ 列表');
  assert.ok(p.d.querySelector('.rn-session-shell'));
  assert.ok(p.d.querySelector('aside.rn-session-right'));
  const before = toggle().getAttribute('aria-pressed');
  assert.equal(toggle().getAttribute('aria-expanded'), before);
  await p.click('☰ 列表');
  const after = toggle().getAttribute('aria-pressed');
  assert.notEqual(after, before, '点击后状态翻转');
  assert.equal(toggle().getAttribute('aria-expanded'), after);
  assert.equal(toggle().getAttribute('aria-label'), after === 'true' ? '隐藏会话列表' : '显示会话列表');
});

test('settings menu opens, closes on Escape and returns focus to its summary', options, async () => {
  const p = openWorkspace({ fresh: true });
  await p.mount();
  const { d, w } = p;
  const menu = d.querySelector('details.rn-settings-menu');
  const summary = menu.querySelector('summary');
  assert.equal(summary.getAttribute('aria-label'), '设置');
  assert.deepEqual(
    [...menu.querySelectorAll('button')].map(b => b.textContent.trim()),
    ['聊天导入', '通用设置']
  );
  menu.open = true;
  menu.dispatchEvent(new w.Event('toggle'));
  await wait(50);
  await p.press(d, 'Escape');
  assert.equal(menu.open, false, 'Esc 关闭菜单');
  assert.equal(d.activeElement, summary, '焦点回到菜单按钮');
});
