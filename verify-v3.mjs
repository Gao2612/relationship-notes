import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
assert.equal(pkg.private,false);
for(const path of ['index.js','reply-service.js','import-service.js','src/self-profile.js','src/suggestions.js'])assert(existsSync(new URL(path,import.meta.url)),path);
console.log('PASS package metadata and required source files');
