// 工作区渲染行为：在真实 DOM（jsdom + React 18）里渲染构建产物 client.js 后核对用户可见的结构与交互。
// 样式规则核对的是插件实际挂载的样式表（导出的 css / 页面里的 <style>），不再读 workspace.js 源码文本。
import test from 'node:test';
import assert from 'node:assert/strict';
import { css, hostCss, formatChatDayKey, formatChatTimestamp } from './workspace.js';
import { THEME_CSS, SESSION_LAYOUT_CSS, INSIGHT_CSS } from './workspace-theme.js';
import {
  openWorkspace,
  closeAllWorkspaces,
  captureConsoleErrors,
  seedWorkspace,
  wait
} from '../test-support/workspace-dom.mjs';

test.afterEach(() => closeAllWorkspaces());

/** 生成 `[YYYY-MM-DD HH:mm] 发送者: 内容` 格式的聊天，双方交替发言。 */
const chat = (date, count, { self = '我', target = '阿青', from = 0 } = {}) =>
  Array.from(
    { length: count },
    (_, i) =>
      `[${date} ${String(9 + Math.floor((from + i) / 60)).padStart(2, '0')}:${String((from + i) % 60).padStart(2, '0')}] ` +
      `${i % 2 ? target : self}: 第 ${from + i + 1} 条消息`
  ).join('\n');

async function sampleWorkspace(options) {
  const ws = openWorkspace(options);
  await ws.mount();
  await ws.importSample();
  return ws;
}

test('chat history renders the whole transcript instead of only the latest twelve messages', async () => {
  const ws = openWorkspace();
  await ws.mount();
  await ws.importText(chat('2026-10-21', 30), '我', '阿青');
  await ws.click('沟通');
  const bubbles = ws.all('.rn-session-history .rn-session-message');
  assert.equal(bubbles.length, 30, '30 条双方消息全部渲染');
  assert.match(ws.text(bubbles[0]), /第 1 条消息/);
  assert.match(ws.text(bubbles.at(-1)), /第 30 条消息/);
});

test('conversation header omits the count and paired sender names', async () => {
  const ws = await sampleWorkspace();
  await ws.click('沟通');
  const header = ws.root.querySelector('.rn-session-header');
  assert.ok(header, '会话头部');
  assert.doesNotMatch(ws.text(header), /条历史|我\s*↔\s*小禾/);
});

test('conversation layout responds to the plugin container width and keeps the image pane beside chat', async () => {
  const ws = await sampleWorkspace();
  await ws.click('沟通');
  const shell = ws.root.querySelector('.rn-session-shell');
  assert.ok(shell, '会话外壳是容器查询的容器');
  const session = shell.querySelector(':scope > .rn-session');
  const columns = [...session.children].map(node => node.tagName.toLowerCase() + '.' + node.classList[0]);
  assert.deepEqual(
    columns.filter(name => !name.includes('scrim')),
    ['aside.rn-session-pane', 'main.rn-session-main', 'aside.rn-session-right'],
    '列表、会话主区与右侧图片/工具栏是同一网格的三列'
  );
  assert.ok(session.querySelector('aside.rn-session-right .rn-session-photo'), '图片面板在会话旁边的右栏');

  // 生成本地草稿后，草稿区在上、输入区紧随其后，都在会话主列里。
  await ws.click('生成本地草稿');
  assert.ok(ws.findButton('复制草稿'), '草稿生成后可复制');
  const main = session.querySelector('.rn-session-main');
  const draft = main.querySelector('.rn-session-draft'),
    compose = main.querySelector('section.rn-session-pane.rn-session-compose');
  assert.ok(draft && compose, '草稿与输入区都在会话主列');
  assert.ok(draft.compareDocumentPosition(compose) & ws.w.Node.DOCUMENT_POSITION_FOLLOWING, '输入区在草稿之后');

  // 布局状态体现在外壳的类名上：收起工具 / 列表分别加上 right-hidden / list-hidden。
  assert.equal(shell.className.trim(), 'rn-session-shell');
  await ws.click('收起工具');
  assert.ok(shell.classList.contains('right-hidden'));
  await ws.click('☰ 列表');
  assert.ok(shell.classList.contains('list-hidden'));

  assert.match(css, /\.rn-session-shell\{[^}]*container-type:inline-size/);
  assert.match(css, /\.rn-session-list-pane\{grid-area:list!important/);
  assert.match(css, /\.rn-session-main\{grid-area:main!important/);
  assert.match(css, /\.rn-session-right\{grid-area:right!important/);
  assert.doesNotMatch(css, /\.rn-session-(?:main|right)\{[^}]*grid-(?:column|row):auto!important/);
  assert.match(css, /@container rn-session-shell \(max-width: 760px\)[\s\S]*?grid-template-areas:"main right"/);
  assert.match(css, /@container rn-session-shell \(max-width: 420px\)[\s\S]*?grid-template-areas:"main" "right"/);
  assert.doesNotMatch(css, /@media\(max-width:420px\)\{\.rnw #rn-panel \.rn-session\{/);
  assert.doesNotMatch(css, /width:calc\(100vw - 240px\)/);
});

test('formats local exported timestamps and converts Unix or zoned timestamps to China time', async () => {
  assert.equal(formatChatTimestamp('2026-10-30 05:01:00'), '10/30 05:01');
  assert.equal(formatChatTimestamp('2026-10-30T05:30:00Z'), '10/30 13:30');
  assert.equal(formatChatTimestamp(1793338200), '10/30 13:30');
  assert.deepEqual([1793358084, 1793358386, 1793358405, 1793358420].map(formatChatTimestamp), [
    '10/30 19:01',
    '10/30 19:06',
    '10/30 19:06',
    '10/30 19:07'
  ]);
  // 会话气泡里的时间就是 formatChatTimestamp 的输出（导出的本地时间不做时区换算）。
  const ws = await sampleWorkspace();
  await ws.click('沟通');
  const meta = ws.all('.rn-session-message-meta').map(node => [...node.children].map(part => ws.text(part)));
  assert.deepEqual(meta.slice(0, 2), [
    ['我', '10/21 09:00'],
    ['小禾', '10/21 09:01']
  ]);
});

test('groups chat day separators by China date for local, zoned and Unix timestamps', async () => {
  assert.equal(formatChatDayKey('2026-10-30 19:01:24'), '2026-10-30');
  assert.equal(formatChatDayKey('2026-10-30T18:00:00Z'), '2026-10-31');
  assert.equal(formatChatDayKey('2026-10-30T23:30:00-06:00'), '2026-10-31');
  assert.equal(formatChatDayKey(1793358084), '2026-10-30');
  // UTC 18:00 已是北京时间次日：会话里按北京时间分成两天。
  const ws = openWorkspace();
  await ws.mount();
  const json = JSON.stringify({
    messages: [
      { sender: '我', text: '早', timestamp: '2026-10-30T01:00:00Z' },
      { sender: '阿青', text: '晚上好', timestamp: '2026-10-30T18:00:00Z' }
    ]
  });
  await ws.importText(json, '我', '阿青');
  await ws.click('沟通');
  assert.deepEqual(
    ws.all('.rn-session-day').map(node => ws.text(node)),
    ['2026-10-30', '2026-10-31']
  );
});

test('renders analysis and raw-history timestamps through the China-time formatter', async () => {
  const ws = await sampleWorkspace();
  await ws.click('记录与评分');
  await ws.click('记录列表');
  const sources = ws.all('.rn-source').map(node => ws.text(node));
  assert.ok(sources.length > 0, '记录列表带原文出处');
  for (const line of sources) {
    assert.match(line, /^(?:我|小禾) · 10\/21 09:0\d · 示例对话\.txt/, line);
    assert.doesNotMatch(line, /2026-10-21/, '出处不显示原始时间戳');
  }
});

test('daily interaction view labels affinity as an evidence-based cue and keeps summaries regenerable', async () => {
  const days = [];
  let release;
  const ws = openWorkspace({
    fetch: async (url, init, w) => {
      if (!url.endsWith('/timeline-analysis')) return new w.Response('{}', { status: 404 });
      const body = JSON.parse(init.body);
      days.push(...body.days.map(day => day.date));
      await new Promise(resolve => (release = resolve));
      return w.Response.json({
        ok: true,
        days: body.days.map(day => ({
          date: day.date,
          // 模型偶尔附带的免责/推测句会在显示前去掉，只保留事实总结。
          summary: '聊了周末去爬山的安排。本地规则识别到积极回应，它不等于真实好感。',
          activityReason: '当天消息较多。',
          affinityContext: '对方主动提问。'
        }))
      });
    }
  });
  await ws.mount();
  await ws.importText(chat('2026-10-21', 6), '我', '阿青');
  // 导入后自动分析被宿主挂起：页面显示进度而不是空白。
  await ws.click('记录与评分');
  await ws.click('每日历程');
  assert.match(ws.text(), /正在分析 0 \/ 1 个日期/);
  release();
  await wait(300);
  assert.deepEqual(days, ['2026-10-21']);
  const text = ws.text();
  assert.match(text, /聊了周末去爬山的安排。/);
  assert.doesNotMatch(text, /本地规则识别到|不等于真实好感/);

  // 已有总结仍可手动重新生成：再次请求同一天。
  const regenerate = ws.findButton('生成当天总结');
  assert.ok(regenerate, '当天总结可重新生成');
  await ws.click(regenerate);
  assert.deepEqual(days, ['2026-10-21', '2026-10-21']);
  release();
  await wait(300);
});

test('daily summaries cached by an older analysis version are re-requested instead of shown', async () => {
  const requested = [];
  const message = (date, sender, text) => ({ sender, text, timestamp: date + ' 09:00' });
  const indexedDB = await seedWorkspace({
    contacts: [
      {
        id: 'c1',
        self: '我',
        target: '阿青',
        messages: [
          message('2026-10-20', '我', '早上好'),
          message('2026-10-20', '阿青', '早，今天去爬山吗？'),
          message('2026-10-21', '我', '昨天爬得很开心'),
          message('2026-10-21', '阿青', '下次还一起去')
        ],
        timelineAnalysis: {
          '2026-10-20#wechat': { summary: '当前版本总结', channel: 'wechat', version: 4 },
          '2026-10-21#wechat': { summary: '旧版总结', channel: 'wechat', version: 3 }
        }
      }
    ],
    selectedId: 'c1',
    goals: []
  });
  const ws = openWorkspace({
    indexedDB,
    fetch: async (url, init, w) => {
      if (!url.endsWith('/timeline-analysis')) return new w.Response('{}', { status: 404 });
      requested.push(JSON.parse(init.body).days.map(day => day.date));
      return w.Response.json({ ok: false, error: '测试中不返回' });
    }
  });
  await ws.mount();
  await wait(300);

  // 只有当前版本的缓存算作“已分析”，旧版本那天在继续分析时重新请求。
  const settings = ws.root.querySelector('.rn-settings-menu');
  settings.open = true;
  await ws.fire(settings, new ws.w.Event('toggle'));
  await ws.click('聊天导入');
  await ws.click('导入结果');
  assert.match(ws.text(), /已分析 1 \/ 2 个有记录日期。/);
  await ws.click('继续分析日期', 300);
  assert.ok(requested.length > 0, '继续分析会发出请求');
  for (const dates of requested) assert.deepEqual(dates, ['2026-10-21'], '已是当前版本的日期不重复请求');

  await ws.click('记录与评分');
  await ws.click('每日历程');
  assert.doesNotMatch(ws.text(), /旧版总结/, '旧版本缓存不当作当天总结显示');
  const previousDay = ws.all('button.rn-day').find(day => /^2026-10-20/.test(day.getAttribute('aria-label')));
  await ws.click(previousDay);
  assert.match(ws.text(), /当前版本总结/);
});

test('UI 修复批次：字号阶梯、显示开关变量、命中区与长文本换行', async () => {
  assert.match(css, /\.rnw\{display:block;font-family:[^}]*font-size:var\(--rn-font,13px\)/);
  assert.match(
    css,
    /\.rnw button,\.rnw input,\.rnw select,\.rnw textarea\{font-family:inherit;font-size:var\(--rn-font,13px\)/
  );
  assert.match(css, /\.rnw h1\{font-size:24px/);
  assert.match(css, /\.rnw h3\{font-size:14px/);
  assert.match(css, /\.rnw h2\{font-size:16px/);
  assert.match(css, /\.rn-metric strong\{display:block;font-size:20px/);
  assert.match(css, /\.rn-session\{[^}]*gap:var\(--rn-gap,14px\)/);
  // 字号阶梯约束的是 workspace.js 自带的样式层；主题层（workspace-theme.js）里的图表坐标字号另有测试。
  const layers = THEME_CSS + SESSION_LAYOUT_CSS + INSIGHT_CSS;
  assert.ok(css.endsWith(layers));
  const ownCss = css.slice(0, css.length - layers.length);
  for (const offScale of ['font-size:10px', 'font-size:10.8333px', 'font-size:11px', 'font-size:27px'])
    assert.ok(!ownCss.includes(offScale), offScale);
  assert.match(css, /min-height:44px;min-width:44px/);
  assert.match(
    css,
    /\.rn-session-message-body\{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word\}/
  );
  assert.match(css, /\.rn-session-message-meta\{[^}]*color:#556659;font-size:12px\}/);

  // 字号与密度设置通过 CSS 变量作用到根节点。
  const ws = openWorkspace();
  await ws.mount();
  const main = ws.root.querySelector('main.rnw');
  assert.equal(main.style.getPropertyValue('--rn-font'), '13px');
  assert.equal(main.style.getPropertyValue('--rn-gap'), '14px');
  assert.equal(ws.root.querySelector('main.rnw > style').textContent, hostCss, '页面挂载的是适配宿主变量后的样式表');
});

test('本批：44px 命中区不被通用收缩规则清零，焦点只在键盘切换时进入页内 tablist', async () => {
  assert.doesNotMatch(css, /\.rnw :where\(#rn-panel \*\)\{min-width:0/);
  assert.match(css, /pointer-events:none/);
  assert.match(
    css,
    /\.rnw :where\(\.rn-day\)\{width:100%;height:100%;min-width:0;min-height:60px;display:flex;flex-direction:column;align-items:flex-start\}/
  );
  assert.match(css, /\.rnw :where\(\.rn-metric\)\{min-width:130px\}/);
  assert.match(
    css,
    /\.rnw :where\(button,\[role="button"\]\):not\(\.rn-day\)\{display:inline-flex;align-items:center;min-height:44px;min-width:44px;position:relative\}/
  );

  const ws = await sampleWorkspace();
  const groupTab = id => ws.d.getElementById('rn-tab-rn-group-tabs-' + id);
  const groups = ws.all('.rn-group-tabs [role="tab"]').map(tab => tab.id.replace('rn-tab-rn-group-tabs-', ''));
  assert.ok(groups.length >= 4, '一级分组 tab 的 id 由分组 id 组成');

  // 鼠标点击：切换页面，但焦点不被抢到 tablist 或面板。
  ws.blur();
  await ws.click(groupTab(groups[1]));
  assert.equal(groupTab(groups[1]).getAttribute('aria-selected'), 'true');
  ws.assertFocus(ws.d.body, '点击切换后焦点不移动');

  // 键盘：方向键在一级分组间移动，焦点跟随到新选中的分组 tab。
  await ws.key(groupTab(groups[1]), 'ArrowRight');
  await wait(50);
  assert.equal(groupTab(groups[2]).getAttribute('aria-selected'), 'true');
  ws.assertFocus(groupTab(groups[2]));
  await ws.key(groupTab(groups[2]), 'Home');
  await wait(50);
  ws.assertFocus(groupTab(groups[0]));

  // 页内 tab 同理：键盘切换后焦点落在新的页内 tab 上。
  await ws.click('记录与评分');
  const contextTabs = () => ws.all('.rn-context-tabs [role="tab"]');
  const selected = contextTabs().findIndex(tab => tab.getAttribute('aria-selected') === 'true');
  await ws.key(contextTabs()[selected], 'ArrowRight');
  await wait(50);
  const next = contextTabs()[selected + 1];
  assert.equal(next.getAttribute('aria-selected'), 'true');
  ws.assertFocus(next);
  assert.match(next.id, /^rn-tab-rn-context-tabs-[a-z]+__[a-z]+$/);
});

test('首次使用给出可点击的三步引导并暴露内置虚构示例', async () => {
  const ws = openWorkspace();
  await ws.mount();
  const guide = () => ws.text();
  assert.match(guide(), /三步开始.*导入聊天.*确认身份.*查看评分与时间线.*载入内置示例聊天（虚构）/);
  const steps = () => ws.buttons().filter(b => ['导入聊天', '确认身份', '查看评分与时间线'].includes(ws.labelOf(b)));
  const selectedContextTab = () => ws.labelOf(ws.root.querySelector('.rn-context-tabs [aria-selected="true"]'));

  await ws.click(steps().find(b => ws.labelOf(b) === '确认身份' && !b.closest('.rn-head')));
  assert.equal(selectedContextTab(), '身份确认');
  await ws.click('联系人');
  assert.match(guide(), /三步开始/, '引导只在联系人档案的基本资料页出现');
  await ws.click(steps().find(b => ws.labelOf(b) === '导入聊天' && !b.closest('.rn-head')));
  assert.equal(selectedContextTab(), '导入文件');
  await ws.click('联系人');
  await ws.click('查看评分与时间线');
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-group-tabs [aria-selected="true"]')), '记录与评分');
  assert.equal(selectedContextTab(), '互动评分');

  await ws.click('联系人');
  await ws.click('载入内置示例聊天（虚构）');
  await wait(300);
  assert.match(ws.text(), /确认聊天双方.*示例对话\.txt · 5 条记录/);
});

test('无数据时导入聊天进入主界面，会话侧栏去重并对齐导航命名', async () => {
  const ws = openWorkspace();
  await ws.mount();
  const headImport = ws.buttons().find(b => b.closest('.rn-head') && ws.labelOf(b) === '导入聊天');
  assert.ok(headImport, '无联系人时页头提供“导入聊天”');
  await ws.click(headImport);
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-context-tabs [aria-selected="true"]')), '导入文件');

  const withData = await sampleWorkspace();
  assert.ok(
    !withData.buttons().some(b => b.closest('.rn-head') && ws.labelOf(b) === '导入聊天'),
    '有数据后页头不再重复'
  );
  await withData.click('沟通');
  const links = withData.root.querySelector('.rn-session-links');
  assert.deepEqual(
    [...links.children].map(node => withData.labelOf(node)),
    ['相关页面', '关系观察', '每日历程']
  );
  await withData.click('关系观察');
  assert.equal(withData.labelOf(withData.root.querySelector('.rn-context-tabs [aria-selected="true"]')), '互动评分');
  await withData.click('沟通');
  await withData.click('每日历程');
  assert.equal(withData.labelOf(withData.root.querySelector('.rn-context-tabs [aria-selected="true"]')), '每日历程');

  // 旧导航名称不再出现在任何页面里。
  for (const group of ['联系人', '记录与评分', '沟通', '设置']) {
    await withData.click(group);
    for (const tab of withData.all('.rn-context-tabs [role="tab"]')) {
      await withData.click(tab);
      assert.doesNotMatch(withData.text(), /行为与好感度|关系概览/, group + ' / ' + withData.labelOf(tab));
    }
  }
});

test('未配置模型与空行动计划都给出可执行的下一步而不是空转', async () => {
  const ws = await sampleWorkspace();
  await ws.click('沟通');
  const text = ws.text();
  assert.match(text, /尚未配置模型，暂时不能生成 AI 草稿/);
  assert.match(text, /未配置模型时不会调用模型，也不会推断对方的真实想法/);
  assert.match(text, /查看如何配置/);
  assert.match(text, /未配置模型，自动分析保持等待/);
  assert.equal(ws.findButton('生成回复').disabled, true, '没有模型时“生成回复”不可点');

  await ws.click('复制提示词');
  assert.equal(ws.copied.length, 1, '提示词写入剪贴板');
  assert.match(ws.copied[0], /小禾/);
  assert.match(ws.text(), /提示词已复制/);

  // 回复草稿区与自动分析区的“去设置选择模型”都直达通用设置。
  const toSettings = ws.buttons().filter(b => ws.labelOf(b) === '去设置选择模型');
  assert.equal(toSettings.length, 2);
  await ws.click(toSettings[1]);
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-group-tabs [aria-selected="true"]')), '设置');
  await ws.click('沟通');
  await ws.click(ws.findButton('去设置选择模型'));
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-group-tabs [aria-selected="true"]')), '设置');

  await ws.click('沟通');
  await ws.click('当前目标');
  const goals = ws.text();
  assert.match(goals, /还没有行动计划/);
  assert.match(goals, /目前不会自动从聊天记录生成目标/);
  for (const action of ['手动添加目标', '查看最近对话', '查看记录列表']) assert.ok(ws.findButton(action), action);
  await ws.click('手动添加目标');
  assert.equal(ws.d.activeElement?.tagName, 'INPUT', '“手动添加目标”把焦点放到目标输入框');
  await ws.click('查看最近对话');
  assert.equal(ws.labelOf(ws.root.querySelector('.rn-context-tabs [aria-selected="true"]')), '每日历程');
});

test('本批：导航压成两层、tab 语义统一、切换后焦点与设置菜单关闭', async () => {
  const consoleErrors = captureConsoleErrors();
  try {
    const ws = await sampleWorkspace();
    await ws.click('记录与评分');
    // 只有两层 tablist：一级分组 + 当前分组的页内 tab；每个 tab 都控制同一个面板。
    assert.deepEqual(
      ws.all('[role="tablist"]').map(node => node.className),
      ['rn-tabs rn-group-tabs', 'rn-tabs rn-context-tabs']
    );
    for (const tab of ws.all('[role="tab"]')) {
      assert.equal(tab.getAttribute('aria-controls'), 'rn-panel');
      assert.match(tab.getAttribute('aria-selected'), /^(?:true|false)$/);
      assert.equal(tab.hasAttribute('aria-pressed'), false);
      assert.equal(tab.tabIndex, tab.getAttribute('aria-selected') === 'true' ? 0 : -1);
    }
    const panel = ws.d.getElementById('rn-panel');
    assert.equal(panel.getAttribute('role'), 'tabpanel');
    assert.equal(panel.getAttribute('tabindex'), '-1');

    // 非 tab 的页内跳转把焦点交给面板，便于读屏从新内容开始。
    await ws.click('互动评分');
    ws.blur();
    await ws.click('查看每日历程');
    ws.assertFocus(ws.d.getElementById('rn-panel'));

    // 设置菜单：打开时聚焦第一项，Esc 关闭并把焦点还给 ⚙，点外部关闭。
    const menu = ws.root.querySelector('details.rn-settings-menu');
    const summary = menu.querySelector('summary');
    const openMenu = async () => {
      menu.open = true;
      await ws.fire(menu, new ws.w.Event('toggle'));
    };
    await openMenu();
    ws.assertFocus(menu.querySelector('button'));
    await ws.key(ws.d, 'Escape');
    assert.equal(menu.open, false);
    ws.assertFocus(summary);
    await openMenu();
    await ws.fire(panel, new ws.w.Event('pointerdown', { bubbles: true }));
    assert.equal(menu.open, false, '点击菜单外部关闭');
    await openMenu();
    await ws.click('通用设置');
    assert.equal(menu.open, false, '选择菜单项后关闭');
    assert.equal(ws.labelOf(ws.root.querySelector('.rn-group-tabs [aria-selected="true"]')), '设置');
    assert.match(css, /\.rn-settings-menu>summary\{[^}]*min-width:44px;min-height:44px/);

    // 记录列表默认最新在上。
    await ws.click('记录与评分');
    await ws.click('记录列表');
    const order = ws.buttons().find(b => /^排序：/.test(ws.labelOf(b)));
    assert.equal(order.getAttribute('aria-pressed'), 'true');
    assert.match(order.getAttribute('aria-label'), /当前最新在上/);
    const times = ws.all('.rn-source').map(node => /10\/21 (\d\d:\d\d)/.exec(ws.text(node))[1]);
    assert.deepEqual(times, [...times].sort().reverse(), '证据按时间倒序');
    await ws.click(order);
    const ascending = ws.all('.rn-source').map(node => /10\/21 (\d\d:\d\d)/.exec(ws.text(node))[1]);
    assert.deepEqual(ascending, [...ascending].sort(), '切换后最早在上');

    assert.deepEqual(consoleErrors.errors, [], 'React / 控制台错误');
  } finally {
    consoleErrors.restore();
  }
});
