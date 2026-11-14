/** npm run pack — zip the loadable extension and create a SHA-256 checksum. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { zipSync } from 'fflate';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const files = {};
async function walk(dir, prefix = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative + '/');
    else files[relative] = new Uint8Array(await fs.readFile(path.join(dir, entry.name)));
  }
}
await walk(path.join(root, 'extension'));
files['安装说明.md'] = new Uint8Array(await fs.readFile(path.join(root, 'docs/INSTALL.zh-CN.md')));
const filename = `QRCS-${manifest.version}.zip`;
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
const zip = zipSync(files, { level: 9 });
await fs.writeFile(path.join(root, 'dist', filename), zip);
await fs.writeFile(path.join(root, 'dist', filename + '.sha256'), crypto.createHash('sha256').update(zip).digest('hex') + '  ' + filename + '\n');
console.log(`已打包 ${Object.keys(files).length} 个文件：dist/${filename}（${zip.length} 字节）`);
