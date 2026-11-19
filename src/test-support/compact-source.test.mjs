import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compactSource } from './compact-source.mjs';

test('removes layout whitespace and comments but keeps identifier separators', () => {
  assert.equal(compactSource('const a = 1;\n// note\nif (a) {\n  return b; /* x */\n}'), 'const a=1;if(a){return b;}');
  assert.equal(compactSource('async function f() { await  g(); }'), 'async function f(){await g();}');
});

test('keeps string, template and regex literals byte for byte', () => {
  assert.equal(compactSource('x = \'a  b\' + "c  d";'), 'x=\'a  b\'+"c  d";');
  assert.equal(compactSource('t = `a ${ b + `c ${ d }` }  e`;'), 't=`a ${b+`c ${d}`}  e`;');
  assert.equal(compactSource('r = /a b[/ ]c/gi.test(s) ? 1 : x / y;'), 'r=/a b[/ ]c/gi.test(s)?1:x/y;');
  assert.equal(compactSource("s = '//' + `/*`;"), "s='//'+`/*`;");
});

test('hand-compacted and Prettier-style layouts normalize to the same text', () => {
  const compact = "const f=(a,b)=>{if(!a)return b;return h('div',{className:'x y'},a);};";
  const pretty = "const f = (a, b) => {\n  if (!a) return b;\n  return h('div', { className: 'x y' }, a);\n};\n";
  assert.equal(compactSource(pretty), compactSource(compact));
});

test('compacted workspace source is still valid JavaScript', () => {
  const source = readFileSync(new URL('../workspace.js', import.meta.url), 'utf8');
  const compact = compactSource(source);
  assert.ok(compact.length < source.length);
  // 去掉 import/export 后按函数体解析，确认规范化没有破坏语法（测试会截取片段 eval）。
  const body = compact.replace(/^import[^;]*;/gm, '').replace(/export (const|function|default)/g, '$1');
  assert.doesNotThrow(() => new Function(body.replace(/import\{[^}]*\}from'[^']*';/g, '')));
});
