/** Pack store materials separately from the extension upload ZIP. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from 'fflate';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const output = path.join(root, 'publishing');
const preflight = JSON.parse(await fs.readFile(path.join(output, 'evidence/preflight.json'), 'utf8'));
assert.equal(preflight.version, manifest.version);
const files = {};
async function walk(dir, prefix = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/');
    else files[name] = new Uint8Array(await fs.readFile(path.join(dir, entry.name)));
  }
}
await walk(output);
const extensionName = `QRCS-${manifest.version}.zip`;
files['upload/' + extensionName] = new Uint8Array(await fs.readFile(path.join(root, 'dist', extensionName)));
files['upload/' + extensionName + '.sha256'] = new Uint8Array(await fs.readFile(path.join(root, 'dist', extensionName + '.sha256')));
const sums = Object.entries(files).map(([name, data]) => crypto.createHash('sha256').update(data).digest('hex') + '  ' + name).join('\n') + '\n';
files['SHA256SUMS.txt'] = new TextEncoder().encode(sums);
const zip = zipSync(files, { level: 9 });
const filename = `QRCS-${manifest.version}-store-materials.zip`;
await fs.writeFile(path.join(root, 'dist', filename), zip);
await fs.writeFile(path.join(root, 'dist', filename + '.sha256'), crypto.createHash('sha256').update(zip).digest('hex') + '  ' + filename + '\n');
const restored = unzipSync(zip);
assert.deepEqual(Object.keys(restored).sort(), Object.keys(files).sort());
for (const [name, data] of Object.entries(files)) assert.deepEqual(restored[name], data, name);
assert.ok(restored['upload/' + extensionName] && restored['privacy-site/privacy.html'] && restored['assets/logo-300.png']);
console.log(`发布材料包已生成并回读验证：dist/${filename}，${Object.keys(files).length} 个文件，${zip.length} 字节。`);
console.log('Packages 页面只上传包内 upload/' + extensionName + '；整个材料 ZIP 不是扩展运行包。');
const siteFiles = {};
for (const name of ['index.html', 'privacy.html', 'support.html', 'demo.html']) siteFiles[name] = new Uint8Array(await fs.readFile(path.join(output, 'privacy-site', name)));
const siteZip = zipSync(siteFiles, { level: 9 });
const siteName = `QRCS-${manifest.version}-privacy-site.zip`;
await fs.writeFile(path.join(root, 'dist', siteName), siteZip);
await fs.writeFile(path.join(root, 'dist', siteName + '.sha256'), crypto.createHash('sha256').update(siteZip).digest('hex') + '  ' + siteName + '\n');
assert.deepEqual(Object.keys(unzipSync(siteZip)).sort(), Object.keys(siteFiles).sort());
console.log(`隐私网页单独打包：dist/${siteName}，4 个可直接上传的 HTML 页面。`);
