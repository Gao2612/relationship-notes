// 分析性能基准：生成 N 条虚构聊天（默认 20000），测量主要分析函数的耗时。
// 用法：node tools/bench-analysis.mjs [条数]    （pnpm run bench）
// 只用于本地比较优化前后，不属于测试，数字随机器而变。
import * as E from '../src/client-engine.js';

const count = Number(process.argv[2]) || 20000;
const lines = [
  '你好，最近怎么样？',
  '我住在杭州，我喜欢摄影。',
  '哈哈哈',
  '今天好累啊，加班到很晚',
  '要不要周末一起去爬山？',
  '好呀！',
  '对不起，刚才没看到消息',
  '你喜欢吃什么？',
  '我也是这么想的',
  '嗯',
  '这部电影真的很好看，你看过吗',
  '晚安'
];
const messages = [];
let time = Date.UTC(2024, 0, 1, 1);
for (let i = 0; i < count; i++) {
  time += i % 40 === 0 ? 86400000 * 1.3 : 60000 * (1 + (i % 7));
  const timestamp = new Date(time + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
  messages.push({ id: 'm' + i, sender: i % 3 ? '小禾' : '我', text: lines[(i * 7) % lines.length], timestamp });
}
const contact = { id: 'c', self: '我', target: '小禾', messages, interactionCorrections: [] };
const measure = (name, fn) => {
  const start = performance.now();
  fn();
  console.log(name.padEnd(28), (performance.now() - start).toFixed(0).padStart(6) + ' ms');
};
console.log(count + ' 条消息');
measure('analyzeDailyTimeline', () => E.analyzeDailyTimeline(messages, '我', '小禾', []));
measure('analyzeConversation', () => E.analyzeConversation(messages, '我', '小禾'));
measure('analyzeRelationship', () => E.analyzeRelationship(contact));
for (const granularity of ['day', 'week', 'month', 'year', 'all'])
  measure('analyzePeriods ' + granularity, () => E.analyzePeriods(contact, granularity));
