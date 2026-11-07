import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatChatDayKey,formatChatTimestamp} from './workspace.js';

const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8');
const interpretationSource=readFileSync(new URL('./interpretation-view.js',import.meta.url),'utf8');
const builtClient=readFileSync(new URL('../client.js',import.meta.url),'utf8');

test('chat history renders the whole transcript instead of only the latest twelve messages',()=>{
 assert.match(source,/const latestMessages=React\.useMemo\(\(\)=>contact\?contactMessages\.filter/);
 assert.doesNotMatch(source,/latestMessages=contactMessages\.slice\(-12\)/);
});

test('conversation header omits the count and paired sender names',()=>{
 assert.doesNotMatch(source,/条历史 · \$\{contact\.self\} ↔ \$\{contact\.target\}/);
});

test('conversation layout responds to the plugin container width and keeps the image pane beside chat',()=>{
 assert.match(source,/className:'rn-session-shell'/);
 assert.match(source,/复制草稿'[\s\S]*?\{className:'primary'\}\)\)\),h\('section',\{className:'rn-session-pane rn-session-compose'/);
 assert.match(source,/h\('aside',\{className:'rn-session-right'/);
 assert.match(source,/\.rn-session-shell\{[^}]*container-type:inline-size/);
 assert.match(source,/\.rn-session-list-pane\{grid-area:list!important/);
 assert.match(source,/\.rn-session-main\{grid-area:main!important/);
 assert.match(source,/\.rn-session-right\{grid-area:right!important/);
 assert.doesNotMatch(source,/\.rn-session-(?:main|right)\{[^}]*grid-(?:column|row):auto!important/);
 assert.match(source,/@container rn-session-shell \(max-width: 760px\)[\s\S]*?grid-template-areas:"main right"/);
 assert.match(source,/@container rn-session-shell \(max-width: 420px\)[\s\S]*?grid-template-areas:"main" "right"/);
 assert.doesNotMatch(source,/@media\(max-width:420px\)\{\.rnw #rn-panel \.rn-session\{/);
 assert.doesNotMatch(source,/width:calc\(100vw - 240px\)/);
});

test('formats local exported timestamps and converts Unix or zoned timestamps to China time',()=>{
 assert.match(source,/function Replies\(\{s,contact\}\)\{[\s\S]*?const formatTimestamp=/);
 assert.equal(formatChatTimestamp('2026-10-30 05:01:00'),'10/30 05:01');
 assert.equal(formatChatTimestamp('2026-10-30T05:30:00Z'),'10/30 13:30');
 assert.equal(formatChatTimestamp(1793338200),'10/30 13:30');
 assert.deepEqual([1793358084,1793358386,1793358405,1793358420].map(formatChatTimestamp),['10/30 19:01','10/30 19:06','10/30 19:06','10/30 19:07']);
});

test('groups chat day separators by China date for local, zoned and Unix timestamps',()=>{
 assert.equal(formatChatDayKey('2026-10-30 19:01:24'),'2026-10-30');
 assert.equal(formatChatDayKey('2026-10-30T18:00:00Z'),'2026-10-31');
 assert.equal(formatChatDayKey('2026-10-30T23:30:00-06:00'),'2026-10-31');
 assert.equal(formatChatDayKey(1793358084),'2026-10-30');
});

test('renders analysis and raw-history timestamps through the China-time formatter',()=>{
 assert.match(source,/const source=m=>h\('div',\{className:'rn-muted'\},\[m\?\.sender,m\?\.timestamp!==undefined\?formatChatTimestamp\(m\.timestamp\)/);
 assert.match(source,/function Replies\(\{s,contact\}\)\{const formatTimestamp=formatChatTimestamp;/);
 assert.match(builtClient,/function formatChatTimestamp\(value\)/);
 assert.match(builtClient,/function formatChatDayKey\(value\)/);
});

test('daily interaction view labels affinity as an evidence-based cue and keeps summaries regenerable',()=>{
 assert.match(source,/本地规则识别到|它不等于真实好感|不代表真实心理|无法从聊天记录证明真实原因|仅凭消息数量无法判断聊天量变化的原因/);
 assert.match(source,/重新生成当天总结|正在生成…/);
 assert.match(source,/生成当天总结/);
 assert.match(source,/known\[day\.date\+'#'\+channel\]\?\.version!==4/);
 assert.match(source,/version:4/);
});

test('UI 修复批次：字号阶梯、显示开关变量、命中区与长文本换行',()=>{
 assert.match(source,/\.rnw\{display:block;font-family:[^}]*font-size:var\(--rn-font,13px\)/);
 assert.match(source,/\.rnw button,\.rnw input,\.rnw select,\.rnw textarea\{font-family:inherit;font-size:var\(--rn-font,13px\)/);
 assert.match(source,/\.rnw h1\{font-size:24px/);
 assert.match(source,/\.rnw h3\{font-size:14px/);
 assert.match(source,/\.rnw h2\{font-size:16px/);
 assert.match(source,/\.rn-metric strong\{display:block;font-size:20px/);
 assert.match(source,/\.rn-session\{[^}]*gap:var\(--rn-gap,14px\)/);
 assert.doesNotMatch(source,/font-size:10px/);
 assert.doesNotMatch(source,/font-size:10\.8333px/);
 assert.doesNotMatch(source,/font-size:11px/);
 assert.doesNotMatch(source,/font-size:27px/);
 assert.match(source,/min-height:44px;min-width:44px/);
 assert.match(source,/\.rn-session-message-body\{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word\}/);
 assert.match(source,/\.rn-session-message-meta\{[^}]*color:#556659;font-size:12px\}/);
});

test('本批：44px 命中区不被通用收缩规则清零，焦点只在键盘切换时进入页内 tablist',()=>{
 assert.doesNotMatch(source,/\.rnw :where\(#rn-panel \*\)\{min-width:0/);
 assert.match(source,/pointer-events:none/);
 assert.match(source,/\.rnw :where\(\.rn-day\)\{width:100%;height:100%;min-width:0;min-height:60px;display:flex;flex-direction:column;align-items:flex-start\}/);
 assert.match(source,/\.rnw :where\(\.rn-metric\)\{min-width:130px\}/);
 assert.match(source,/\.rnw :where\(button,\[role="button"\]\):not\(\.rn-day\)\{display:inline-flex;align-items:center;min-height:44px;min-width:44px;position:relative\}/);
 assert.match(source,/focusMode\.current=fromKeyboard\?'group':'none'/);
 assert.match(source,/focusMode\.current=fromKeyboard\?'context':'none'/);
 assert.match(source,/rn-tab-rn-group-tabs-'\+route\.group\.id/);
});

test('首次使用给出可点击的三步引导并暴露内置虚构示例',()=>{
 assert.match(source,/function StartGuide\(\)/);
 assert.match(source,/const loadSample=\(\)=>importFile\(new File\(\[E\.sampleChat\]/);
 assert.match(source,/载入内置示例聊天（虚构）/);
 assert.match(source,/三步开始/);
 assert.match(source,/导入聊天'[\s\S]{0,200}?确认身份'[\s\S]{0,200}?查看评分与时间线/);
 assert.match(source,/\(\)=>nav\('import','file'\)/);
 assert.match(source,/\(\)=>nav\('import','identity'\)/);
 assert.match(source,/\(\)=>nav\('behavior','metrics'\)/);
 assert.match(source,/!s\.contacts\.length&&route\.item\.id==='profile'&&route\.tab==='basic'&&h\(StartGuide,\{\}\)/);
});

test('无数据时导入聊天进入主界面，会话侧栏去重并对齐导航命名',()=>{
 assert.match(source,/!s\.contacts\.length&&button\('导入聊天',\(\)=>nav\('import','file'\)/);
 assert.match(source,/rn-session-links'[\s\S]{0,120}?'相关页面'[\s\S]{0,160}?关系观察'[\s\S]{0,120}?每日历程'/);
 assert.doesNotMatch(source,/行为与好感度/);
 assert.doesNotMatch(source,/关系概览/);
 assert.match(source,/rn-session-links'[\s\S]{0,160}?nav\('behavior','metrics'\)/);
});

test('未配置模型与空行动计划都给出可执行的下一步而不是空转',()=>{
 assert.match(source,/尚未配置模型，暂时不能生成 AI 草稿/);
 assert.match(source,/未配置模型时不会调用模型，也不会推断对方的真实想法/);
 assert.match(source,/button\('去设置选择模型',\(\)=>nav\('settings','general'\)/);
 assert.match(source,/button\('复制提示词',copyPrompt\)/);
 assert.match(source,/查看如何配置/);
 assert.match(interpretationSource,/未配置模型，自动分析保持等待/);
 assert.match(interpretationSource,/onOpenSettings/);
 assert.match(source,/还没有行动计划/);
 assert.match(source,/手动添加目标/);
 assert.match(source,/查看最近对话/);
 assert.match(source,/查看记录列表/);
 assert.match(source,/目前不会自动从聊天记录生成目标/);
});

test('本批：导航压成两层、tab 语义统一、切换后焦点与设置菜单关闭',()=>{
 assert.equal((source.match(/role:'tab'/g)||[]).length,1);
 assert.equal((source.match(/'aria-selected':/g)||[]).length,1);
 assert.equal((source.match(/aria-controls':'rn-panel'/g)||[]).length,1);
 assert.doesNotMatch(source,/role:'tab'[^)]*aria-pressed/);
 assert.doesNotMatch(source,/featureItems/);
 assert.match(source,/function SettingsMenu\(\)/);
 assert.match(source,/event\.key==='Escape'/);
 assert.match(source,/document\.addEventListener\('pointerdown',onPointerDown\)/);
 assert.match(source,/details\?\.querySelector\('button'\)\?\.focus\(\)/);
 assert.match(source,/summaryRef\.current\?\.focus\(\)/);
 assert.match(source,/id:'rn-panel',ref:panelRef,tabIndex:-1/);
 assert.match(source,/document\.getElementById\('rn-tab-rn-context-tabs-'\+n\.id\+'__'\+route\.tab\)/);
 assert.match(source,/focus\(\{preventScroll:true\}\)/);
 assert.match(source,/\.rn-settings-menu>summary\{[^}]*min-width:44px;min-height:44px/);
 assert.match(source,/\[evidenceOrder,setEvidenceOrder\]=React\.useState\('desc'\)/);
});
