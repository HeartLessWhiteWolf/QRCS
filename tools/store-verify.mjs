/** Validate submission assets. Missing public URLs are reported, never fabricated. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { unzipSync } from 'fflate';
import { localizedManifest } from './localized-manifest.mjs';
import { checkVersions } from './check-versions.mjs';
import { checkPrivacyPage } from './privacy-check.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await checkVersions(root);
const output = path.join(root, 'publishing');
const publisher = JSON.parse(await fs.readFile(path.join(output, 'publisher.json'), 'utf8'));
const listing = JSON.parse(await fs.readFile(path.join(output, 'store-listing.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const report = { checkedAt: new Date().toISOString(), version: manifest.version, checks: [], errors: [], networkPending: [], manualPending: [], pending: [], readyForSubmission: false };
const pass = text => { report.checks.push(text); console.log('PASS: ' + text); };
assert.equal(publisher.extensionVersion, manifest.version);
const localized = await localizedManifest(manifest, listing.language);
assert.equal(listing.name, localized.name); assert.equal(listing.shortDescription, localized.description);
assert.ok(Array.from(listing.description).length >= 250 && Array.from(listing.description).length <= 10000);
assert.ok(listing.searchTerms.length <= 7 && listing.searchTerms.every(term => Array.from(term).length <= 30));
assert.equal(listing.language, 'zh-CN');
pass(`商店描述 ${Array.from(listing.description).length} 字符、搜索词 ${listing.searchTerms.length} 个，名称与短描述和 manifest 一致`);
assert.ok(publisher.publisherName && Array.from(publisher.publisherName).length <= 50);
assert.match(publisher.supportEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
assert.equal(listing.publisher, publisher.publisherName); assert.equal(listing.supportEmail, publisher.supportEmail);
pass('发布者与公开支持邮箱已填写，文案元数据一致');
const expected = new Map([
  ['logo-128.png', [128, 128]], ['logo-300.png', [300, 300]],
  ['promo-small-440x280.png', [440, 280]], ['promo-large-1400x560.png', [1400, 560]],
  ...[1, 2, 3, 4].map((n, i) => [`screenshot-0${n}-${['result', 'selection', 'text', 'wifi'][i]}-1280x800.png`, [1280, 800]])
]);
for (const [name, dimensions] of expected) {
  const png = PNG.sync.read(await fs.readFile(path.join(output, 'assets', name)));
  assert.deepEqual([png.width, png.height], dimensions, name);
  pass(`${name}: ${png.width}×${png.height}`);
}
const allScreens = (await fs.readdir(path.join(output, 'assets'))).filter(name => name.startsWith('screenshot-'));
assert.equal(allScreens.length, 4); assert.ok(allScreens.length <= 6);
const build = JSON.parse(await fs.readFile(path.join(output, 'evidence/build-report.json'), 'utf8'));
for (const entry of build.images) {
  const bytes = await fs.readFile(path.join(output, entry.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
}
pass('4 张真实截图在商店数量上限内，全部图像与生成证据 SHA-256 一致');
const policy = await fs.readFile(path.join(output, 'privacy-policy.zh-CN.md'), 'utf8');
assert.ok(policy.includes(publisher.publisherName) && policy.includes(publisher.supportEmail));
assert.doesNotMatch(policy, /\{\{[^}]+\}\}|【待填写/);
for (const file of ['index.html', 'privacy.html', 'support.html', 'demo.html']) {
  const html = await fs.readFile(path.join(output, 'privacy-site', file), 'utf8');
  assert.doesNotMatch(html, /\{\{[^}]+\}\}|【待填写|<script\b|<link[^>]+href=["']https?:|<img[^>]+src=["']https?:/i);
  if (file === 'privacy.html' || file === 'support.html') assert.ok(html.includes(publisher.publisherName) && html.includes(publisher.supportEmail));
}
pass('4 个静态页面没有未替换占位符、执行脚本、远程字体或外链图像，隐私政策署名正确');
const packagePath = path.join(root, `dist/QRCS-${manifest.version}.zip`);
const bytes = await fs.readFile(packagePath), shipped = unzipSync(bytes);
const shippedManifest = JSON.parse(new TextDecoder().decode(shipped['manifest.json']));
assert.deepEqual(shippedManifest, manifest);
assert.equal(shippedManifest.background.service_worker, 'background.js');
assert.ok(!Object.keys(shipped).some(name => /store-background|test-background|fixtures|publisher\.json|privacy-site/.test(name)));
const checksum = (await fs.readFile(packagePath + '.sha256', 'utf8')).split(' ')[0];
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), checksum);
pass('独立扩展 ZIP 版本、入口与 SHA-256 正确，不含测试入口或商店个人资料');
if (!publisher.privacyPolicyURL) report.errors.push('缺少 privacyPolicyURL：请填写真实公开 HTTPS 隐私页地址。');
else {
  const url = new URL(publisher.privacyPolicyURL);
  assert.equal(url.protocol, 'https:');
  assert.ok(!/^(localhost|127\.|example\.|.*\.example$)/.test(url.hostname));
  const privacy = await checkPrivacyPage(url, publisher.supportEmail);
  if (privacy.status === 'passed') pass(privacy.message);
  else if (privacy.status === 'network-unverified') report.networkPending.push(privacy.message);
  else report.errors.push(privacy.message);
}
report.manualPending.push('在正式 Microsoft Edge 中完成提交版本的原生菜单/工具栏最终验收，并核对 Partner Center 账号、市场和实际表单。');
report.pending = [...report.networkPending, ...report.manualPending];
report.readyForSubmission = report.errors.length === 0 && report.pending.length === 0;
await fs.writeFile(path.join(output, 'evidence/preflight.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`材料校验完成：${report.checks.length} 项通过；${report.errors.length} 项错误；${report.networkPending.length} 项网络待验证；${report.manualPending.length} 项人工待办。`);
for (const error of report.errors) console.error('FAIL: ' + error);
for (const pending of report.networkPending) console.log('NETWORK_PENDING: ' + pending);
for (const pending of report.manualPending) console.log('MANUAL_PENDING: ' + pending);
process.exitCode = report.errors.length ? 1 : report.networkPending.length ? 2 : 0;
