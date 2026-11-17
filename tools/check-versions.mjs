/** Check every release version before packaging; never rewrite metadata silently. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function checkVersions(root = projectRoot) {
  const files = ['extension/manifest.json', 'package.json', 'package-lock.json', 'publishing/publisher.json'];
  const documents = await Promise.all(files.map(async file => {
    try { return JSON.parse(await fs.readFile(path.join(root, file), 'utf8')); }
    catch (error) { throw new Error(`无法读取版本元数据 ${file}：${error.message}`); }
  }));
  const [manifest, pkg, lock, publisher] = documents;
  const expected = manifest?.version;
  if (typeof expected !== 'string' || !expected.trim()) throw new Error('extension/manifest.json.version 缺失；请先填写扩展版本。');
  const fields = [
    ['package.json.version', pkg?.version],
    ['package-lock.json.version', lock?.version],
    ['package-lock.json.packages[""].version', lock?.packages?.['']?.version],
    ['publishing/publisher.json.extensionVersion', publisher?.extensionVersion]
  ];
  const mismatches = fields.filter(([, value]) => value !== expected);
  if (mismatches.length) throw new Error(`版本不一致，以 extension/manifest.json.version = ${expected} 为准：\n` +
    mismatches.map(([field, value]) => `- ${field} = ${JSON.stringify(value) ?? '(缺失)'}；请改为 ${expected}`).join('\n'));
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(`版本一致：${await checkVersions()}（4 个文件，5 个版本字段）。`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
