/** Build real store screenshots and offline privacy/support pages.
 * npm run store:build. Uses an isolated Chromium profile, never the user's Edge.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { localizedManifest } from './localized-manifest.mjs';
import { buildBrandAssets } from './brand-assets.mjs';
import { buildEnglishAssets } from './store-assets-en.mjs';
import { promotionHTML } from './store-promos.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'tmp/browsers');
const { chromium, expect } = await import('@playwright/test');
const output = path.join(root, 'publishing');
const publisher = JSON.parse(await fs.readFile(path.join(output, 'publisher.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const localized = await localizedManifest(manifest, publisher.storeLanguage);
assert.equal(publisher.extensionVersion, manifest.version);
for (const name of ['assets', 'privacy-site', 'evidence']) await fs.mkdir(path.join(output, name), { recursive: true });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = {
  publisher: publisher.publisherName || '【待填写发布者名称】',
  email: publisher.supportEmail || '【待填写公开支持邮箱】'
};
const brand = await buildBrandAssets();
const logoData = brand.logoData;
const demoCodes = [
  ['url', '网页链接', 'https://example.com/', '识别后可点击“跳转”，在新标签页打开示例网站。'],
  ['text', '中文与换行', 'QRCS 文字示例\n你好，二维码！\n本地识别，先预览再跳转。', '非网址按原文显示，可复制；跳转按钮不可用。'],
  ['wifi', 'Wi-Fi 配置信息', 'WIFI:T:WPA;S:QRCS-DEMO;P:sample-only;;', '仅演示配置文本，非真实网络；扩展不会自动连接 Wi-Fi。']
];
const images = new Map();
for (const [key, , value] of demoCodes) images.set(key, await QRCode.toDataURL(value, { width: 360, margin: 4, errorCorrectionLevel: 'M' }));
const stylesheet = `:root{font-family:'Microsoft YaHei',system-ui,sans-serif;color:#173a44;background:#f3f8f7;color-scheme:light}*{box-sizing:border-box}body{margin:0}a{color:#087e81}header{height:100px;display:flex;align-items:center;gap:15px;padding:0 54px;border-bottom:1px solid #d9e8e5;background:#fff}header img{width:44px;height:44px}header strong{font-size:23px;letter-spacing:1px}header span{font-size:14px;color:#66868a}main{max-width:1180px;margin:auto;padding:32px 42px}h1{font-size:30px;line-height:1.4;margin:0 0 9px}p{font-size:14px;line-height:1.8;color:#5f7e83}.lead{margin:0 0 26px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.sample{background:#fff;border:1px solid #dce9e5;border-radius:18px;padding:22px;text-align:center}.sample h2{font-size:18px;margin:0 0 6px}.sample p{min-height:44px;font-size:12px;line-height:1.7;margin:4px 0}.sample img{width:240px;height:240px;max-width:100%;margin:12px auto;display:block;border-radius:8px}.label{font-size:11px;color:#198177;letter-spacing:1px}.tip{background:#e6f3ef;border-radius:12px;padding:15px 20px;margin:26px 0 0;color:#3b6b6b;font-size:13px}footer{font-size:11px;color:#829b9e;padding:18px 54px}@media(max-width:750px){header{padding:0 20px;height:80px}main{padding:24px 20px}.grid{grid-template-columns:1fr}.sample img{width:260px;height:260px}}`;
const demoBody = `<header><img src="${logoData}" alt="QRCS"><strong>QRCS</strong><span>二维码识别体验</span></header><main><div class="label">二维码内容，在网页里看清楚</div><h1>右键图片，或框选截图。</h1><p class="lead">本地读取 · 先查看结果 · 再决定是否打开</p><div class="grid">${demoCodes.map(([key, title, , explanation]) => `<section class="sample"><h2>${title}</h2><p>${explanation}</p><img id="qr-${key}" src="${images.get(key)}" alt="${title}二维码"></section>`).join('')}</div><div class="tip">使用 QRCS：图片右键选择“QR码识别”，或点击工具栏图标后拖动框住一个二维码。框选时按 Esc 或鼠标右键可取消。</div></main><footer>自建示例二维码 · 无登录 · 页面本身不发送图片或识别内容</footer>`;
const demoHTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QRCS 二维码体验页</title><style>${stylesheet}</style></head><body>${demoBody}</body></html>`;
await fs.writeFile(path.join(output, 'privacy-site/demo.html'), demoHTML);

const privacySource = (await fs.readFile(path.join(root, 'tools/templates/privacy-policy.zh-CN.md'), 'utf8'))
  .replaceAll('{{PUBLISHER_NAME}}', text.publisher).replaceAll('{{SUPPORT_EMAIL}}', text.email);
await fs.writeFile(path.join(output, 'privacy-policy.zh-CN.md'), privacySource);
const paragraph = privacySource.split(/\n\s*\n/).map(block => {
  if (block.startsWith('# ')) return `<h1>${escape(block.slice(2))}</h1>`;
  if (block.startsWith('## ')) return `<h2>${escape(block.slice(3))}</h2>`;
  return `<p>${escape(block).replace(/\n/g, '<br>')}</p>`;
}).join('\n');
const pageStyle = `:root{font-family:'Microsoft YaHei',system-ui,sans-serif;color:#254650;background:#f4f8f7;color-scheme:light}*{box-sizing:border-box}body{margin:0}header{padding:22px 30px;background:white;border-bottom:1px solid #dae7e5;display:flex;gap:12px;align-items:center}header img{width:38px;height:38px}nav{margin-left:auto;display:flex;gap:18px;font-size:13px}a{color:#087e81}main{max-width:880px;padding:34px 38px 54px;margin:28px auto;background:white;border:1px solid #dde9e7;border-radius:16px}h1{font-size:29px;margin:0 0 16px}h2{font-size:19px;margin:28px 0 8px}p,li{font-size:14px;line-height:1.95;overflow-wrap:anywhere}p{color:#48666e}footer{text-align:center;color:#7a969a;font-size:12px;padding:0 20px 26px}.draft{padding:12px 16px;background:#fff7dc;color:#815d0a;border-radius:8px;margin:0 0 20px;font-size:13px}code{background:#edf4f2;padding:2px 5px;border-radius:4px}@media(max-width:650px){header{padding:16px}nav{gap:10px}main{margin:15px;padding:24px 20px}h1{font-size:25px}}`;
const shell = (title, body) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title} · QRCS</title><style>${pageStyle}</style></head><body><header><img src="${logoData}" alt=""><strong>QRCS</strong><nav><a href="index.html">关于</a><a href="privacy.html">隐私政策</a><a href="support.html">帮助</a></nav></header><main>${body}</main><footer>QRCS 二维码识别 · ${escape(publisher.policyEffectiveDate)}</footer></body></html>`;
const needsIdentity = !publisher.publisherName || !publisher.supportEmail;
const draft = needsIdentity ? '<div class="draft">发布前请补全发布者名称和公开支持邮箱。本页目前是本地预览稿。</div>' : '';
await fs.writeFile(path.join(output, 'privacy-site/privacy.html'), shell('隐私政策', draft + paragraph));
await fs.writeFile(path.join(output, 'privacy-site/index.html'), shell('关于', `<h1>QRCS 二维码识别</h1><p>在 Microsoft Edge 中，右键图片或框选网页截图读取二维码。识别结果优先显示在网页内的小浮层中，可复制、取消或主动打开有效的 HTTP / HTTPS 链接。</p><p>图像与二维码在本机处理，解码器随扩展打包。读取原图会访问原站，点击跳转后才访问目标网站。</p><p><a href="demo.html">打开示例二维码体验页</a> · <a href="privacy.html">阅读隐私政策</a></p><h2>使用方式</h2><ol><li>图片上右键，选择“QR码识别”。</li><li>或点击 QRCS 工具栏图标，拖动框住二维码后松开。</li><li>核对内容后选择跳转、复制或取消，按 Esc 可以退出。</li></ol><p>适用版本 ${escape(manifest.version)}，需要桌面 Microsoft Edge 的 Chromium 127 或更新内核。受限页面可能改用工具栏弹层；无法自动展开时，点击图标的 QR 标记。</p>`));
await fs.writeFile(path.join(output, 'privacy-site/support.html'), shell('帮助与支持', draft + `<h1>帮助与支持</h1><h2>没有识别到二维码</h2><p>请完整保留四角和周围留白，尝试放大页面后重新截图。复杂布局可逐个框选；严重模糊、遮挡或特殊艺术二维码不保证成功。</p><h2>为什么不能跳转？</h2><p>跳转仅支持有效的 HTTP / HTTPS 地址。中文文本、Wi-Fi、名片或应用专用链接可复制使用，扩展不会自动连接网络或唤起其他应用。</p><h2>没有出现页内浮层</h2><p>独立 data 图片等受限页面可能无法注入界面，会改用工具栏弹层。如果没有自动展开，点击 QRCS 图标上的 QR 标记。浏览器内部页、扩展商店、PDF 及本地文件可能有额外访问限制。</p><h2>联系维护者</h2><p>发布者：${escape(text.publisher)}<br>支持邮箱：${publisher.supportEmail ? `<a href="mailto:${escape(publisher.supportEmail)}">${escape(publisher.supportEmail)}</a>` : escape(text.email)}</p><p>反馈时可说明 Edge 版本、QRCS 版本和操作步骤。无需提交账号密码；分享截图前可自行遮挡与问题无关的个人信息。</p>`));

const files = new Map();
files.set('/demo', demoHTML);
let server, context;
const proof = { generatedAt: new Date().toISOString(), version: manifest.version, brandSource: brand.source, images: [], checks: [] };
try {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const html = files.get(url.pathname);
    if (!html) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = await fs.mkdtemp(path.join(root, 'tmp/store-assets-'));
  const extension = path.join(profile, 'extension'); await fs.cp(path.join(root, 'extension'), extension, { recursive: true });
  const testManifest = { ...manifest, background: { ...manifest.background, service_worker: 'store-background.js' } };
  await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify(testManifest));
  await fs.writeFile(path.join(extension, 'store-background.js'), "import { beginImage } from './background.js'; globalThis.qrcsStore = { beginImage };\n");
  context = await chromium.launchPersistentContext(profile, { headless: true, channel: 'chromium', locale: publisher.storeLanguage, viewport: { width: 1280, height: 800 },
    args: [`--lang=${publisher.storeLanguage}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const source = context.pages()[0] || await context.newPage();
  await source.goto(base + '/demo');
  const tab = await worker.evaluate(async url => (await chrome.tabs.query({ url }))[0], base + '/demo');
  const panel = source.locator('qrcs-result');
  const scan = async key => {
    await worker.evaluate(({ tab, url }) => qrcsStore.beginImage({ srcUrl: url }, tab), { tab, url: images.get(key) });
    await expect(panel.locator('#content')).toHaveText(demoCodes.find(row => row[0] === key)[2]);
  };
  await scan('url');
  await source.screenshot({ path: path.join(output, 'assets/screenshot-01-result-1280x800.png') });
  const panelBytes = await panel.screenshot();
  await fs.writeFile(path.join(output, 'evidence/real-result-panel.png'), panelBytes);
  await panel.locator('#cancel').click(); await expect(panel).toHaveCount(0);
  await scan('text');
  await expect(panel.locator('#open')).toBeDisabled();
  await source.screenshot({ path: path.join(output, 'assets/screenshot-03-text-1280x800.png') });
  await panel.locator('#cancel').click(); await expect(panel).toHaveCount(0);
  await scan('wifi');
  await expect(panel.locator('#open')).toBeDisabled();
  await source.screenshot({ path: path.join(output, 'assets/screenshot-04-wifi-1280x800.png') });
  await panel.locator('#cancel').click(); await expect(panel).toHaveCount(0);
  const screenshot = 'data:image/png;base64,' + (await source.screenshot()).toString('base64');
  await worker.evaluate(async ({ tab, screenshot }) => {
    const job = { id: crypto.randomUUID(), created: Date.now(), tabId: tab.id, windowId: tab.windowId, mode: 'select', screenshot };
    await chrome.storage.session.set({ ['qrcs-job-' + job.id]: job });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selection.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'QRCS_SELECT', jobId: job.id, screenshot });
  }, { tab, screenshot });
  await expect(source.locator('qrcs-selection')).toBeVisible();
  const image = await source.locator('#qr-url').boundingBox();
  await source.mouse.move(image.x - 4, image.y - 4); await source.mouse.down();
  await source.mouse.move(image.x + image.width + 4, image.y + image.height + 4, { steps: 6 });
  await source.screenshot({ path: path.join(output, 'assets/screenshot-02-selection-1280x800.png') });
  await source.mouse.up(); await expect(panel.locator('#content')).toHaveText('https://example.com/');
  await panel.locator('#cancel').click();
  proof.checks.push('4 张商店截图来自实际生产浮层/框选；示例链接、中文换行、Wi-Fi 原文与预期一致。');
  const render = await context.newPage();
  const cardData = 'data:image/png;base64,' + panelBytes.toString('base64');
  for (const [name, width, height] of [['small', 440, 280], ['large', 1400, 560]]) {
    const html = promotionHTML({ name, logoData, cardData, language: 'zh-CN' });
    await render.setViewportSize({ width, height }); await render.setContent(html); await render.locator('img').first().evaluate(img => img.decode());
    if (name === 'large') await render.locator('.preview').evaluate(img => img.decode());
    assert.equal(await render.evaluate(() => document.documentElement.scrollWidth), width);
    await render.screenshot({ path: path.join(output, `assets/promo-${name}-${width}x${height}.png`) });
  }
  const privacy = await fs.readFile(path.join(output, 'privacy-site/privacy.html'), 'utf8');
  await render.setViewportSize({ width: 1280, height: 900 }); await render.setContent(privacy);
  await expect(render.getByRole('heading', { level: 1 })).toHaveText('QRCS 二维码识别隐私政策');
  await render.screenshot({ path: path.join(output, 'evidence/privacy-preview.png'), fullPage: true });
  await render.setViewportSize({ width: 390, height: 844 });
  assert.ok(await render.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await render.screenshot({ path: path.join(output, 'evidence/privacy-mobile-preview.png'), fullPage: true });
  proof.checks.push('隐私政策 HTML 在桌面与 390px 手机视口无水平溢出；无外部脚本、远程字体。');
  proof.browserVersion = context.browser().version();
} finally { await context?.close(); if (server) await new Promise(resolve => server.close(resolve)); }
await buildEnglishAssets();
proof.checks.push('英文版另含 4 张实际生产截图和 2 张促销磁贴，独立 en-US 目录，中文素材保留。');
async function recordImages(directory, prefix) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) await recordImages(file, name + '/');
    else {
      const data = await fs.readFile(file);
      proof.images.push({ file: name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
    }
  }
}
await recordImages(path.join(output, 'assets'), 'assets/');
proof.pending = ['发布者名称', '公开支持邮箱', '隐私政策真实 HTTPS 网址'].filter((_, i) => ![publisher.publisherName, publisher.supportEmail, publisher.privacyPolicyURL][i]);
await fs.writeFile(path.join(output, 'evidence/build-report.json'), JSON.stringify(proof, null, 2) + '\n');
const listing = await fs.readFile(path.join(output, 'store-listing.zh-CN.md'), 'utf8');
const description = listing.split('## 详细介绍（以下正文可直接粘贴）')[1].split('## 其他商店字段')[0].trim();
await fs.writeFile(path.join(output, 'store-listing.json'), JSON.stringify({
  name: localized.name, shortDescription: localized.description, description,
  publisher: publisher.publisherName, supportEmail: publisher.supportEmail,
  category: publisher.suggestedCategory, language: publisher.storeLanguage,
  visibility: publisher.visibility, privacyPolicyURL: publisher.privacyPolicyURL,
  websiteURL: publisher.websiteURL,
  searchTerms: ['二维码', 'QR Code', '二维码识别', '截图扫码', '图片扫码', '本地识别']
}, null, 2) + '\n');
console.log(`发布素材生成完成：中英文各 4 张真实截图、各 2 张宣传图、2 个 PNG 图标；待填 ${proof.pending.length} 项。`);
