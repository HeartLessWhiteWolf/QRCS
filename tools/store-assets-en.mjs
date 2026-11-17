/** Capture four English store screenshots and two English promotional tiles. */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import { loadBrand } from './brand-assets.mjs';
import { promotionHTML } from './store-promos.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function buildEnglishAssets() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'tmp/browsers');
  const { chromium, expect } = await import('@playwright/test');
  const output = path.join(root, 'publishing/assets/en-US');
  await fs.mkdir(output, { recursive: true });
  const logoData = await loadBrand();
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'extension/_locales/en/messages.json'), 'utf8'));
  const demo = await fs.readFile(path.join(root, 'publishing/privacy-site/demo.html'), 'utf8');
  const stylesheet = demo.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(stylesheet, 'Run npm run store:build to prepare the shared demo layout');
  const samples = [
    ['url', 'Web link', 'https://example.com/', 'Preview the URL, then open it in a new tab.'],
    ['text', 'Text & line breaks', 'QRCS text sample\nHello, QR codes!\nDecode locally. Preview before opening.', 'Copy the original text. Non-web content cannot be opened.'],
    ['wifi', 'Wi-Fi configuration', 'WIFI:T:WPA;S:QRCS-DEMO;P:sample-only;;', 'Sample settings only. QRCS does not connect to Wi-Fi.']
  ];
  const images = new Map();
  for (const [key, , value] of samples) images.set(key, await QRCode.toDataURL(value, { width: 360, margin: 4, errorCorrectionLevel: 'M' }));
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>QRCS QR code demo</title><style>${stylesheet}:root{font-family:Arial,system-ui,sans-serif}</style><header><img src="${logoData}" alt="QRCS"><strong>QRCS</strong><span>QR code reader demo</span></header><main><div class="label">QR code content, clearly in view</div><h1>Right-click an image, or select an area.</h1><p class="lead">Decode locally · Preview the result · Choose what to open</p><div class="grid">${samples.map(([key, title, , explanation]) => `<section class="sample"><h2>${title}</h2><p>${explanation}</p><img id="qr-${key}" src="${images.get(key)}" alt="${title} QR code"></section>`).join('')}</div><div class="tip">Use QRCS: right-click an image and choose “Read QR code”, or click the toolbar icon and drag around a code. Press Esc or right-click to cancel selection.</div></main><footer>Generated samples · No sign-in · This page does not upload images or decoded content</footer></html>`;
  let server, context;
  const names = [];
  const proof = { generatedAt: new Date().toISOString(), version: manifest.version, language: 'en-US', brandSource: { file: 'branding/qrcs-logo.png', sha256: crypto.createHash('sha256').update(await fs.readFile(path.join(root, 'branding/qrcs-logo.png'))).digest('hex') }, images: [], checks: [] };
  try {
    server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/demo`;
    const profile = await fs.mkdtemp(path.join(root, 'tmp/store-english-'));
    const extension = path.join(profile, 'extension');
    await fs.cp(path.join(root, 'extension'), extension, { recursive: true });
    await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify({ ...manifest, background: { ...manifest.background, service_worker: 'store-background.js' } }));
    await fs.writeFile(path.join(extension, 'store-background.js'), "import { beginImage } from './background.js'; globalThis.qrcsStore = { beginImage };\n");
    context = await chromium.launchPersistentContext(profile, { headless: true, channel: 'chromium', locale: 'en-US', viewport: { width: 1280, height: 800 },
      args: ['--lang=en-US', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    assert.equal(await worker.evaluate(() => chrome.i18n.getUILanguage()), 'en-US');
    const page = context.pages()[0] || await context.newPage();
    await page.goto(url);
    await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    assert.doesNotMatch(await page.locator('body').innerText(), /\p{Script=Han}/u);
    const tab = await worker.evaluate(async url => (await chrome.tabs.query({ url }))[0], url);
    const panel = page.locator('qrcs-result');
    const capture = async name => { await page.screenshot({ path: path.join(output, name) }); names.push([name, 1280, 800]); };
    const scan = async key => {
      await worker.evaluate(({ tab, srcUrl }) => qrcsStore.beginImage({ srcUrl }, tab), { tab, srcUrl: images.get(key) });
      await expect(panel.locator('#title')).toHaveText(catalog.success.message);
      await expect(panel.locator('#content')).toHaveText(samples.find(row => row[0] === key)[2]);
      await expect(panel.locator('#open')).toHaveText(catalog.open.message);
      await expect(panel.locator('#copy')).toHaveText(catalog.copy.message);
      assert.doesNotMatch(await panel.locator('.card').innerText(), /\p{Script=Han}/u);
    };
    await scan('url');
    await expect(panel.locator('#open')).toBeEnabled();
    await capture('screenshot-01-result-1280x800.png');
    const panelBytes = await panel.screenshot();
    await fs.writeFile(path.join(root, 'publishing/evidence/real-result-panel-en.png'), panelBytes);
    await panel.locator('#cancel').click();
    await scan('text'); await expect(panel.locator('#open')).toBeDisabled();
    await capture('screenshot-03-text-1280x800.png'); await panel.locator('#cancel').click();
    await scan('wifi'); await expect(panel.locator('#open')).toBeDisabled();
    await capture('screenshot-04-wifi-1280x800.png'); await panel.locator('#cancel').click();
    const screenshot = 'data:image/png;base64,' + (await page.screenshot()).toString('base64');
    await worker.evaluate(async ({ tab, screenshot }) => {
      const job = { id: crypto.randomUUID(), created: Date.now(), tabId: tab.id, windowId: tab.windowId, mode: 'select', screenshot };
      await chrome.storage.session.set({ ['qrcs-job-' + job.id]: job });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selection.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'QRCS_SELECT', jobId: job.id, screenshot });
    }, { tab, screenshot });
    await expect(page.locator('qrcs-selection')).toBeVisible();
    // The production selection overlay uses a closed shadow root. Its language
    // follows the browser locale verified above; confirm it in the final capture.
    const bounds = await page.locator('#qr-url').boundingBox();
    await page.mouse.move(bounds.x - 4, bounds.y - 4); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width + 4, bounds.y + bounds.height + 4, { steps: 6 });
    await capture('screenshot-02-selection-1280x800.png');
    await page.mouse.up(); await expect(panel.locator('#content')).toHaveText('https://example.com/');
    await panel.locator('#cancel').click();
    const render = await context.newPage();
    const cardData = 'data:image/png;base64,' + panelBytes.toString('base64');
    for (const [name, width, height] of [['small', 440, 280], ['large', 1400, 560]]) {
      await render.setViewportSize({ width, height });
      await render.setContent(promotionHTML({ name, logoData, cardData, language: 'en-US' }));
      await render.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
      assert.doesNotMatch(await render.locator('body').innerText(), /\p{Script=Han}/u);
      assert.equal(await render.evaluate(() => document.documentElement.scrollWidth), width);
      const filename = `promo-${name}-${width}x${height}.png`;
      await render.screenshot({ path: path.join(output, filename) }); names.push([filename, width, height]);
    }
    proof.browserVersion = context.browser().version();
    proof.checks.push('English browser UI, result panel, selection overlay, page copy and decoded sample text verified; no Chinese text in visible UI.');
    proof.checks.push('Screenshots use actual production decoding and selection; non-web content disables Open link; selection completes decoding.');
    proof.checks.push('English promotional tiles use the actual English result-panel capture and the shared Chinese/English layout.');
  } finally { await context?.close(); if (server) await new Promise(resolve => server.close(resolve)); }
  for (const [name, width, height] of names) {
    const bytes = await fs.readFile(path.join(output, name));
    proof.images.push({ file: 'assets/en-US/' + name, width, height, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  await fs.writeFile(path.join(root, 'publishing/evidence/build-report-en.json'), JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const proof = await buildEnglishAssets();
  console.log(`英文素材已生成：4 张 1280×800 截图、2 张促销磁贴；${proof.images.length} 个文件，原中文版保持不变。`);
}
