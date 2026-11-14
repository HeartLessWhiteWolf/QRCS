/** Verify shipped bytes match extension/ and no test fixture/hook is shipped. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const filename = `QRCS-${manifest.version}.zip`;
const zip = await fs.readFile(path.join(root, 'dist', filename));
const files = unzipSync(zip);
const expected = [];
async function walk(dir, prefix = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/');
    else { expected.push(name); assert.deepEqual(Buffer.from(files[name] || []), await fs.readFile(path.join(dir, entry.name)), name); }
  }
}
await walk(path.join(root, 'extension'));
expected.push('安装说明.md');
assert.deepEqual(Object.keys(files).sort(), expected.sort());
assert.deepEqual(Buffer.from(files['安装说明.md']), await fs.readFile(path.join(root, 'docs/INSTALL.zh-CN.md')));
assert.equal(JSON.parse(new TextDecoder().decode(files['manifest.json'])).background.service_worker, 'background.js');
assert.doesNotMatch(new TextDecoder().decode(files['background.js']), /qrcsTest/);
const sha = (await fs.readFile(path.join(root, 'dist', filename + '.sha256'), 'utf8')).split(' ')[0];
assert.equal(sha, crypto.createHash('sha256').update(zip).digest('hex'));
console.log(`发行包校验通过：${expected.length} 个文件与源码一致，无测试入口，SHA-256 一致。`);
