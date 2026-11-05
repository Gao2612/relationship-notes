import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeImports} from './auto-import.js';
import {extractFacts} from './engine.js';
const record={version:'session-1',self:'我',target:'小禾',messages:[{sender:'我',text:'你好'},{sender:'小禾',text:'我喜欢摄影。'}]};
test('imports both speakers and preserves evidence without duplicating a polled record',()=>{const seen=new Set();const first=consumeImports([record],seen,extractFacts);assert.equal(first.length,1);assert.equal(first[0].importVersion,record.version);assert.equal(first[0].messages.length,2);assert.equal(first[0].facts[0].value,'摄影');assert.equal(first[0].messages[1].file,'DSH 会话');assert.deepEqual(consumeImports([record],seen,extractFacts),[]);});
test('malformed and oversized records are rejected without blocking other records',()=>{const seen=new Set();const result=consumeImports([{...record,version:'bad',messages:[]},record,{...record,version:'foreign',messages:[...record.messages,{sender:'他',text:'无关'}]}],seen,extractFacts);assert.equal(result.length,1);assert.equal(result[0].target,'小禾');assert.equal(seen.has('bad'),true);});
