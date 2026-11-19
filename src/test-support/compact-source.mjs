// 测试辅助：把 JS 源码规范成“去掉字符串 / 模板 / 正则之外的空白和注释”的紧凑形式，
// 让源码文本断言不受排版影响（例如 Prettier 格式化前后结果相同）。
// 只用于测试中的不变量检查；用户可见行为应优先用 DOM 测试（workspace-dom.test.mjs）。
const identifierChar = /[\p{L}\p{N}_$]/u;
const regexAllowedAfter =
  /[(,=:[!&|?{};+\-*%<>~^]$|^$|\b(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

export function compactSource(source) {
  let out = '';
  let pendingSpace = false;
  let i = 0;
  const braceStack = []; // 记录模板 ${ 嵌套
  const emit = text => {
    if (pendingSpace && identifierChar.test(out.slice(-1)) && identifierChar.test(text[0])) out += ' ';
    pendingSpace = false;
    out += text;
  };
  const readQuoted = quote => {
    let j = i + 1;
    while (j < source.length && source[j] !== quote) j += source[j] === '\\' ? 2 : 1;
    const text = source.slice(i, j + 1);
    i = j + 1;
    return text;
  };
  const readTemplateChunk = () => {
    // 从 ` 或 } 开始，读到 ` 或 ${ 为止
    let j = i + 1;
    while (j < source.length) {
      if (source[j] === '\\') j += 2;
      else if (source[j] === '`') return { text: source.slice(i, j + 1), next: j + 1, open: false };
      else if (source[j] === '$' && source[j + 1] === '{')
        return { text: source.slice(i, j + 2), next: j + 2, open: true };
      else j++;
    }
    return { text: source.slice(i), next: source.length, open: false };
  };
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      pendingSpace = true;
    } else if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 2 || source.length;
      pendingSpace = true;
    } else if (c === "'" || c === '"') {
      emit(readQuoted(c));
    } else if (c === '`') {
      const chunk = readTemplateChunk();
      emit(chunk.text);
      i = chunk.next;
      if (chunk.open) braceStack.push('template');
    } else if (c === '}' && braceStack.at(-1) === 'template') {
      braceStack.pop();
      const chunk = readTemplateChunk();
      emit(chunk.text);
      i = chunk.next;
      if (chunk.open) braceStack.push('template');
    } else if (c === '/' && regexAllowedAfter.test(out)) {
      let j = i + 1,
        inClass = false;
      while (j < source.length && (inClass || source[j] !== '/')) {
        if (source[j] === '\\') j++;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        j++;
      }
      j++;
      while (j < source.length && /[a-z]/i.test(source[j])) j++;
      emit(source.slice(i, j));
      i = j;
    } else {
      if (c === '{') braceStack.push('block');
      else if (c === '}') braceStack.pop();
      emit(c);
      i++;
    }
  }
  return out;
}
