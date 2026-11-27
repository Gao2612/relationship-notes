// 语言风格匹配（Language Style Matching, LSM）的中文近似实现。
//
// 依据：Ireland 等（2011, Psychological Science 22(1):39–44）以虚词使用的相似度定义 LSM，
// 在 86 对情侣的即时消息中，LSM 正向预测 3 个月后关系仍在持续。原研究使用英文 LIWC。
// 中文版 LIWC（Huang 等 2012；Gao 等 2013 简体微博版）类别结构相同，但词表受许可限制，
// 这里只收录常见聊天虚词作为近似，且不做分词（最长匹配计数）。因此：
//  - 结果只作为“风格协调”的弱信号，在综合指数中权重最低；
//  - 双方文字都少于 MIN_CHARS 时不计算（返回 null），避免短样本噪声。
export const LSM_CATEGORIES = Object.freeze({
  ppron: ['我们', '咱们', '你们', '他们', '她们', '我', '咱', '你', '您', '他', '她', '俺'],
  ipron: [
    '这个',
    '那个',
    '这些',
    '那些',
    '这样',
    '那样',
    '什么',
    '哪里',
    '哪儿',
    '自己',
    '别人',
    '大家',
    '这',
    '那',
    '哪',
    '谁'
  ],
  prep: ['关于', '对于', '从', '对', '向', '跟', '给', '把', '被', '往', '比', '离', '按'],
  auxverb: ['可以', '应该', '必须', '可能', '愿意', '会', '能', '要', '想', '敢'],
  adverb: [
    '已经',
    '一直',
    '特别',
    '非常',
    '好像',
    '正在',
    '很',
    '太',
    '真',
    '挺',
    '都',
    '也',
    '还',
    '就',
    '才',
    '又',
    '再',
    '刚',
    '总'
  ],
  conj: ['但是', '可是', '不过', '因为', '所以', '而且', '然后', '如果', '虽然', '或者', '并且', '于是', '还是', '和'],
  negate: ['没有', '不要', '不', '没', '别', '未', '无'],
  quant: ['一些', '很多', '所有', '全部', '一点', '有点', '好多', '每', '几', '多', '少'],
  particle: ['吗', '呢', '吧', '啊', '呀', '哦', '噢', '嘛', '啦', '哈', '嗯', '哎', '欸', '诶', '哇', '喔']
});
export const LSM_MIN_CHARS = 40;
const lexicon = Object.entries(LSM_CATEGORIES)
  .flatMap(([category, words]) => words.map(word => ({ word, category })))
  .sort((a, b) => b.word.length - a.word.length);
const cjk = /[㐀-鿿]/u;
// 按首字索引词表（每组仍按词长降序），逐字匹配时只检查以该字开头的词，结果与整表线性查找相同。
const lexiconByFirst = new Map();
for (const entry of lexicon) {
  const bucket = lexiconByFirst.get(entry.word[0]);
  if (bucket) bucket.push(entry);
  else lexiconByFirst.set(entry.word[0], [entry]);
}
/** 每 100 个汉字中各类虚词的出现次数（最长匹配，类别不重复计数）。 */
export function functionWordRates(text) {
  const source = String(text || ''),
    counts = Object.fromEntries(Object.keys(LSM_CATEGORIES).map(key => [key, 0]));
  let chars = 0;
  for (let i = 0; i < source.length; ) {
    if (!cjk.test(source[i])) {
      i++;
      continue;
    }
    const hit = lexiconByFirst.get(source[i])?.find(entry => source.startsWith(entry.word, i));
    if (hit) {
      counts[hit.category]++;
      chars += hit.word.length;
      i += hit.word.length;
    } else {
      chars++;
      i++;
    }
  }
  const rates = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, chars ? (100 * value) / chars : 0])
  );
  return { chars, counts, rates };
}
/** 由双方虚词计数计算 LSM（计数可按回合相加，因此按日汇总后再合并与直接合并文本的结果相同）。 */
export function lsmFromCounts(self, target, { minChars = LSM_MIN_CHARS } = {}) {
  const a = self || { chars: 0, counts: {} },
    b = target || { chars: 0, counts: {} };
  if (a.chars < minChars || b.chars < minChars)
    return { value: null, selfChars: a.chars, targetChars: b.chars, categories: {} };
  const categories = {};
  for (const key of Object.keys(LSM_CATEGORIES)) {
    const p1 = (100 * (a.counts[key] || 0)) / a.chars,
      p2 = (100 * (b.counts[key] || 0)) / b.chars;
    categories[key] = 1 - Math.abs(p1 - p2) / (p1 + p2 + 0.0001);
  }
  const values = Object.values(categories);
  return {
    value: values.reduce((sum, v) => sum + v, 0) / values.length,
    selfChars: a.chars,
    targetChars: b.chars,
    categories
  };
}
/** 双方 LSM：各类别 1−|p1−p2|/(p1+p2+ε) 的平均值，0–1。 */
export function languageStyleMatching(selfText, targetText, options = {}) {
  return lsmFromCounts(functionWordRates(selfText), functionWordRates(targetText), options);
}
