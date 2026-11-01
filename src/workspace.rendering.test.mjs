import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatChatDayKey,formatChatTimestamp} from './workspace.js';

const source=readFileSync(new URL('./workspace.js',import.meta.url),'utf8');
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
 assert.match(source,/known\[day\.date\]\?\.version!==4/);
 assert.match(source,/version:4/);
});
