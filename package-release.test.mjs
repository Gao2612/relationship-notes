import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { collectReleaseFiles, zipStage, crc32 } from './tools/package-release.mjs';
function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'missing end of central directory');
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const size = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extra = buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    assert.equal(buffer.readUInt32LE(offset), 0x04034b50);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const raw = buffer.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    assert.equal(crc32(data), crc, name + ' crc');
    entries.push({ name, data: data.toString('utf8') });
    cursor += 46 + nameLength + extra;
  }
  return entries;
}
test('ZIP is written without PowerShell, uses forward slashes and round-trips content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'relationship-package-test-'));
  try {
    const stage = join(root, 'stage');
    await mkdir(join(stage, 'src', 'shared'), { recursive: true });
    await writeFile(join(stage, 'src', 'entry.js'), 'export const fixture=true;'.repeat(50));
    await writeFile(join(stage, 'src', 'shared', '文本.js'), '关系手记');
    await writeFile(join(stage, 'empty.txt'), '');
    const archive = join(root, 'artifact.zip');
    await zipStage(stage, archive);
    const entries = readZip(await readFile(archive));
    assert.deepEqual(
      entries.map(entry => entry.name),
      ['empty.txt', 'src/entry.js', 'src/shared/文本.js']
    );
    assert.equal(entries[1].data, 'export const fixture=true;'.repeat(50));
    assert.equal(entries[2].data, '关系手记');
    await assert.rejects(zipStage(stage, archive), /已存在/);
  } finally {
    if (dirname(resolve(root)) !== resolve(tmpdir())) throw Error('Unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
test('crc32 matches the reference value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});
test('release selection includes nested runtime imports and docs but excludes dependencies, archives and tests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'relationship-package-test-'));
  try {
    for (const file of [
      'package.json',
      'README.md',
      'src/entry.js',
      'src/shared/text.js',
      'src/entry.test.mjs',
      'node_modules/secret.js',
      'docs/archive/legacy/page.js',
      'docs/HOST-API.md'
    ]) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), 'fixture');
    }
    const selected = await collectReleaseFiles(root, { files: ['src/**/*.js'] });
    assert.deepEqual(selected, ['README.md', 'docs/HOST-API.md', 'package.json', 'src/entry.js', 'src/shared/text.js']);
  } finally {
    const checked = resolve(root);
    if (dirname(checked) !== resolve(tmpdir()) || !checked.includes('relationship-package-test-'))
      throw Error('Unsafe test cleanup');
    await rm(checked, { recursive: true, force: true });
  }
});
