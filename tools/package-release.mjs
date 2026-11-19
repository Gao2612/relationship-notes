import { readdir, readFile, mkdir, mkdtemp, copyFile, writeFile, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as zlib from 'node:zlib';
import { createHash } from 'node:crypto';

function globPattern(pattern) {
  const parts = pattern
    .split('/')
    .map(part => (part === '**' ? '(?:[^/]+/)*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')));
  return new RegExp('^' + parts.join('/').replaceAll('(?:[^/]+/)*/', '(?:[^/]+/)*') + '$');
}

export async function collectReleaseFiles(root, pkg) {
  const patterns = pkg.files.map(globPattern);
  const selected = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).split(sep).join('/');
      if (entry.isSymbolicLink() || ['.git', 'node_modules'].includes(entry.name) || path === 'docs/archive') continue;
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile() || /\.test\.|\.before-|(?:^|\/)standalone\./.test(path)) continue;
      const documentation =
        /^(?:README(?:\.(?:en|ja))?\.md|LICENSE(?:\.md)?|package\.json|PDFJS-LICENSE\.md)$/.test(path) ||
        (path.startsWith('docs/') && path.endsWith('.md'));
      if (documentation || patterns.some(pattern => pattern.test(path))) selected.push(path);
    }
  }
  await visit(root);
  return selected.sort();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(data) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(data) >>> 0;
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

async function listStageFiles(stage) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(stage);
  return files.sort();
}

// 纯 Node 实现的 ZIP 写入（deflate，UTF-8 文件名，条目路径统一为正斜杠），不依赖 PowerShell，Windows / macOS / Linux 通用。
export async function zipStage(stage, archive) {
  if (existsSync(archive)) throw new Error('压缩包已存在，请使用新的输出目录。');
  const root = resolve(stage);
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of await listStageFiles(root)) {
    const name = Buffer.from(relative(root, file).split(sep).join('/'), 'utf8');
    const data = await readFile(file);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const stored = compressed.length >= data.length;
    const body = stored ? data : compressed;
    const { time, date } = dosDateTime((await stat(file)).mtime);
    const crc = crc32(data);
    if (offset + body.length > 0xffffffff || data.length > 0xffffffff) throw new Error('文件过大，超出 ZIP 限制。');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(stored ? 0 : 8, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(header, name, body);
    central.push(entry, name);
    offset += header.length + name.length + body.length;
  }
  const count = central.length / 2;
  if (count > 0xffff) throw new Error('文件过多，超出 ZIP 限制。');
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(archive, Buffer.concat([...local, directory, end]), { flag: 'wx' });
}

async function main(args) {
  const outputIndex = args.indexOf('--out');
  const dryRun = args.includes('--dry-run');
  const allowed = args.filter(
    (value, index) => value !== '--dry-run' && index !== outputIndex && index !== outputIndex + 1
  );
  if (outputIndex < 0 || !args[outputIndex + 1] || args[outputIndex + 1].startsWith('--') || allowed.length)
    throw new Error('用法 node tools/package-release.mjs --out <输出目录> [--dry-run]');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(args[outputIndex + 1]);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version)) throw new Error('项目版本格式无效。');
  const files = await collectReleaseFiles(root, pkg);
  const client = await stat(join(root, 'client.js'));
  for (const file of files.filter(file => file.startsWith('src/') && file.endsWith('.js'))) {
    if ((await stat(join(root, file))).mtimeMs > client.mtimeMs) throw new Error('源码比客户端产物新，请先运行构建。');
  }
  if (dryRun) {
    console.log(files.join('\n'));
    return;
  }
  await mkdir(output, { recursive: true });
  const base = 'relationship-notes-' + pkg.version;
  const archive = join(output, base + '.zip');
  const checksum = join(output, base + '.sha256');
  const manifest = join(output, base + '.manifest.json');
  if ([archive, checksum, manifest].some(existsSync)) throw new Error('输出文件已存在，请使用新的输出目录。');
  const stage = await mkdtemp(join(output, '.stage-'));
  try {
    const entries = [];
    for (const file of files) {
      const target = join(stage, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(root, file), target);
      const data = await readFile(target);
      entries.push({ path: file, size: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
    await zipStage(stage, archive);
    const digest = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    await writeFile(checksum, digest + '  ' + base + '.zip\n', { flag: 'wx' });
    await writeFile(manifest, JSON.stringify({ version: pkg.version, files: entries }, null, 2) + '\n', { flag: 'wx' });
    console.log(archive);
  } finally {
    // 暂存目录由本进程创建，删除前核对父目录与名称。
    if (dirname(stage) !== output || !relative(output, stage).startsWith('.stage-'))
      throw new Error('暂存目录校验失败。');
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv.slice(2));
}
