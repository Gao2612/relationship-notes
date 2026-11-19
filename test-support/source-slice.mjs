// 部分行为测试会从 src/workspace.js 的 createPlugin 闭包里取出一段函数，注入依赖后直接执行
// （这些函数不导出，真实 DOM 也难以稳定构造对应的竞态）。这里按“忽略空白”的锚点定位代码，
// 让这些测试只依赖函数名与语句本身，不依赖缩进、换行或 Prettier 的排版。
import assert from 'node:assert/strict';

const escape = char => char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/** 把一段代码片段变成忽略空白的正则：任意两个非空白字符之间都允许出现空白。 */
export const looseRegExp = (snippet, flags = '') =>
  new RegExp([...snippet.replace(/\s+/g, '')].map(escape).join('\\s*'), flags);

/** 与 String#indexOf 相同，但忽略空白差异。 */
export function indexOfLoose(source, snippet, from = 0) {
  const pattern = looseRegExp(snippet, 'g');
  pattern.lastIndex = from;
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

/** 取出从 start 开始、到其后第一个 end 之前的源码。 */
export function sliceBetween(source, start, end) {
  const from = indexOfLoose(source, start);
  assert.ok(from >= 0, '找不到起点：' + start);
  const to = indexOfLoose(source, end, from + 1);
  assert.ok(to > from, '找不到终点：' + end);
  return source.slice(from, to);
}

/** 取出从 start 开始的一条完整语句：逐行延长，直到能单独通过语法解析。 */
export function statementAt(source, start) {
  const from = indexOfLoose(source, start);
  assert.ok(from >= 0, '找不到语句：' + start);
  for (let end = source.indexOf('\n', from); end !== -1; end = source.indexOf('\n', end + 1)) {
    const statement = source.slice(from, end);
    try {
      new Function(statement);
      return statement + '\n';
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  assert.fail('语句没有结束：' + start);
}
