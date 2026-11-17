/** Isolated Chromium tests, never attaches to the user's browser.
 * Native menu/action gestures and activeTab screenshot grants still need Edge QA.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const language = process.env.QRCS_TEST_LANGUAGE || 'zh-CN';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'tmp/browsers');
const { chromium, expect } = await import('@playwright/test');
await fs.mkdir(path.join(root, 'tmp/fixtures'), { recursive: true });
await fs.mkdir(path.join(root, 'docs/screenshots'), { recursive: true });
const styledFixture = await fs.readFile(path.join(root, 'tests/fixtures/styled-gradient-logo.png'));
await fs.writeFile(path.join(root, 'tmp/fixtures/styled.png'), styledFixture);
await fs.writeFile(path.join(root, 'tmp/fixtures/styled.html'), '<!doctype html><meta charset="utf-8"><title>美化二维码测试</title><style>body{margin:0;background:#151a1e;color:#bfc9cd;font:16px sans-serif}p{padding:20px}img{display:block;width:500px;height:500px;margin:80px auto}</style><p>QRCS 美化二维码识别回归</p><img src="styled.png" alt="自建渐变圆点图标二维码">');
let server, context, passed = 0;
const errors = [];
async function check(name, run) { await run(); passed++; console.log(`PASS ${passed}: ${name}`); }
try {
  try {
    const response = await fetch('http://127.0.0.1:8765/index.html');
    if (!(await response.text()).includes('QRCS 浏览器验收样本')) throw new Error('Port 8765 is occupied');
  } catch (error) {
    if (error.message.includes('occupied')) throw error;
    server = spawn(process.execPath, ['tools/fixtures.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture server did not start')), 15000);
      server.once('error', reject);
      server.stdout.on('data', data => { if (data.toString().includes('8765')) { clearTimeout(timer); resolve(); } });
      server.stderr.on('data', data => { clearTimeout(timer); reject(new Error(data.toString())); });
    });
  }
  const profile = await fs.mkdtemp(path.join(root, 'tmp/browser-test-'));
  const testExtension = path.join(profile, 'test-extension');
  await fs.cp(path.join(root, 'extension'), testExtension, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(testExtension, 'manifest.json'), 'utf8'));
  manifest.background.service_worker = 'test-background.js';
  await fs.writeFile(path.join(testExtension, 'manifest.json'), JSON.stringify(manifest));
  await fs.writeFile(path.join(testExtension, 'test-background.js'), "import { beginImage, beginSelection, presentJob, handleContextMenu } from './background.js'; globalThis.qrcsTest = { beginImage, beginSelection, presentJob, handleContextMenu };\n");
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, locale: language, viewport: { width: 1400, height: 1000 },
    args: [`--lang=${language}`, `--disable-extensions-except=${testExtension}`, `--load-extension=${testExtension}`] });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const messages = await worker.evaluate(() => Object.fromEntries(['copied', 'selectionRetrySmall', 'noCodeTitle', 'screenshotResults', 'close'].map(key => [key, chrome.i18n.getMessage(key)])));
  const source = context.pages()[0] || await context.newPage();
  await source.goto('http://127.0.0.1:8765/index.html');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1:8765/index.html' }))[0]);
  const panel = source.locator('qrcs-result');
  const windows = () => worker.evaluate(async () => (await chrome.windows.getAll()).map(w => w.id));
  const initialWindows = await windows();
  const closePanel = async () => { await panel.locator('#cancel').click(); await expect(panel).toHaveCount(0); };
  const imageView = async srcUrl => { await worker.evaluate(({ srcUrl, tab }) => qrcsTest.handleContextMenu({ menuItemId: 'qrcs-image', mediaType: 'image', srcUrl }, tab), { srcUrl, tab }); await expect(panel).toBeVisible(); };
  const makeJob = async (extra, screenshot) => {
    const job = { id: crypto.randomUUID(), created: Date.now(), tabId: tab.id, windowId: tab.windowId, screenshot, ...extra };
    await worker.evaluate(job => chrome.storage.session.set({ ['qrcs-job-' + job.id]: job }), job); return job;
  };
  const present = async (extra, screenshot) => { const job = await makeJob(extra, screenshot); await worker.evaluate(job => qrcsTest.presentJob(job), job); return job; };
  const standalone = async (extra, screenshot) => {
    const job = await makeJob(extra, screenshot); const page = await context.newPage();
    await page.setViewportSize({ width: 420, height: 560 }); await page.goto(`chrome-extension://${extensionId}/scanner.html?job=${job.id}&compact=1`); return page;
  };
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'extension/_locales', language === 'zh-CN' ? 'zh_CN' : 'en', 'messages.json'), 'utf8'));
  await check('实际浏览器语言、manifest 与工具栏界面文案一致', async () => {
    assert.equal(await worker.evaluate(() => chrome.i18n.getUILanguage()), language);
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().name), catalog.extensionName.message);
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().description), catalog.extensionDescription.message);
    const page = await standalone({ mode: 'error', error: catalog.errorCancelled.message });
    await expect(page).toHaveTitle(catalog.extensionName.message);
    await expect(page.locator('html')).toHaveAttribute('lang', catalog.uiLanguage.message);
    await expect(page.locator('#error-message')).toHaveText(catalog.errorCancelled.message);
    await expect(page.locator('#error-cancel')).toHaveText(catalog.cancel.message);
    await expect(page.locator('#stage')).toHaveAttribute('aria-label', catalog.screenshotRegion.message);
    await expect(page.locator('#screenshot')).toHaveAttribute('alt', catalog.screenshotToRead.message);
    await page.locator('#error-cancel').click();
  });
  await check('不可见解码页的 HTTP 错误占位符使用当前语言', async () => {
    await present({ mode: 'image', imageUrl: 'http://127.0.0.1:8765/missing.png' });
    await expect(panel.locator('#summary')).toHaveText(catalog.errorImageDenied.message.replace('$status$', '404'));
    await expect(panel.locator('#cancel')).toHaveText(catalog.cancel.message);
    await expect(panel).toHaveAttribute('lang', catalog.uiLanguage.message);
    await closePanel();
  });
  await check('右键处理 → 页内小浮层，真实后台解码、复制与实际跳转', async () => {
    await imageView('http://127.0.0.1:8765/url.png');
    await expect(panel.locator('#content')).toHaveText('http://127.0.0.1:8765/destination.html?from=qrcs');
    await expect(panel.locator('#open')).toBeEnabled();
    await panel.locator('#copy').click(); await expect(panel.locator('#feedback')).toHaveText(messages.copied);
    const bounds = await panel.boundingBox(); assert.ok(bounds.width <= 420 && bounds.height < 450, JSON.stringify(bounds));
    await source.screenshot({ path: path.join(root, 'docs/screenshots/inpage-result.png') });
    const newTab = context.waitForEvent('page'); await panel.locator('#open').click(); const target = await newTab;
    await target.waitForURL('http://127.0.0.1:8765/destination.html?from=qrcs');
    await expect(target.locator('h1')).toHaveText('QRCS 跳转验证成功'); await target.close();
    await expect(panel).toHaveCount(0);
  });
  await check('中文换行保留、非网址禁用跳转、取消移除浮层', async () => {
    await imageView('http://127.0.0.1:8765/text.png');
    await expect(panel.locator('#content')).toHaveText('QRCS 中文测试\n第二行：你好，世界！');
    await expect(panel.locator('#open')).toBeDisabled(); await closePanel();
  });
  await check('HTML 载荷为纯文本，不能插入可执行元素', async () => {
    await imageView('http://127.0.0.1:8765/html.png');
    await expect(panel.locator('#content')).toHaveText('<img src=x onerror=alert(1)>');
    assert.equal(await panel.locator('#content img').count(), 0); await closePanel();
  });
  await check('data 图片读取与 Esc 移除页内结果', async () => {
    const data = await fs.readFile(path.join(root, 'tmp/fixtures/inverted.png'));
    await imageView('data:image/png;base64,' + data.toString('base64'));
    await expect(panel.locator('#content')).toHaveText('https://example.com/inverted');
    await source.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
  });
  await source.bringToFront();
  const screenshot = 'data:image/png;base64,' + (await source.screenshot()).toString('base64');
  const selectOnPage = async screenshot => {
    const job = await makeJob({ mode: 'select' }, screenshot);
    await worker.evaluate(async ({ job }) => {
      await chrome.scripting.executeScript({ target: { tabId: job.tabId }, files: ['selection.js'] });
      await chrome.tabs.sendMessage(job.tabId, { type: 'QRCS_SELECT', jobId: job.id, screenshot: job.screenshot });
    }, { job }); return job;
  };
  await check('网页真实拖动框选 → 同页结果，不创建独立窗口', async () => {
    await selectOnPage(screenshot); const bounds = await source.locator('img').first().boundingBox();
    await source.mouse.move(bounds.x, bounds.y); await source.mouse.down(); await source.mouse.move(bounds.x + bounds.width, bounds.y + bounds.height, { steps: 6 }); await source.mouse.up();
    await expect(panel.locator('#content')).toHaveText('http://127.0.0.1:8765/destination.html?from=qrcs', { timeout: 30000 });
    await expect(source.locator('qrcs-selection')).toHaveCount(0); assert.deepEqual(await windows(), initialWindows); await closePanel();
  });
  await check('工具栏紧凑框选界面：小选区提示、反向拖动、缩放', async () => {
    const page = await standalone({ mode: 'select' }, screenshot);
    await page.locator('#screenshot').evaluate(img => img.decode()); let bounds = await page.locator('#stage').boundingBox();
    await page.mouse.move(bounds.x + 10, bounds.y + 10); await page.mouse.down(); await page.mouse.move(bounds.x + 12, bounds.y + 12); await page.mouse.up();
    await expect(page.locator('#select-hint')).toHaveText(messages.selectionRetrySmall);
    bounds = await page.locator('#stage').boundingBox();
    const image = await source.locator('img').nth(1).boundingBox(), sx = bounds.width / 1400, sy = bounds.height / 1000;
    await page.mouse.move(bounds.x + (image.x + image.width) * sx, bounds.y + (image.y + image.height) * sy); await page.mouse.down();
    await page.mouse.move(bounds.x + image.x * sx, bounds.y + image.y * sy, { steps: 6 }); await page.mouse.up();
    await expect(page.locator('#content')).toHaveText('QRCS 中文测试\n第二行：你好，世界！'); await page.locator('#cancel').click();
  });
  await check('空白选区显示错误和重新框选入口', async () => {
    await present({ mode: 'crop', rect: { x: .8, y: .8, width: .15, height: .15 } }, screenshot);
    await expect(panel.locator('#title')).toHaveText(messages.noCodeTitle); await expect(panel.locator('#retry')).toBeVisible(); await closePanel();
  });
  await check('多二维码结果可切换，来源标明网页截图', async () => {
    await present({ mode: 'image', imageUrl: 'http://127.0.0.1:8765/missing.png' }, screenshot);
    await expect(panel.locator('#summary')).toHaveText(messages.screenshotResults); const texts = [];
    for (const button of await panel.locator('#tabs button').all()) { await button.click(); texts.push(await panel.locator('#content').textContent()); }
    for (const expected of ['QRCS 中文测试\n第二行：你好，世界！', 'http://127.0.0.1:8765/destination.html?from=qrcs', 'https://example.com/inverted', '<img src=x onerror=alert(1)>']) assert.ok(texts.includes(expected), JSON.stringify(texts));
    await closePanel();
  });
  await check('Esc 撤销框选并清除临时任务', async () => {
    const job = await selectOnPage(screenshot); await source.keyboard.press('Escape'); await expect(source.locator('qrcs-selection')).toHaveCount(0);
    await expect.poll(() => worker.evaluate(async id => Object.keys(await chrome.storage.session.get('qrcs-job-' + id)).length, job.id)).toBe(0);
  });
  const expectJobGone = async id => {
    await expect.poll(() => worker.evaluate(async id => Object.keys(await chrome.storage.session.get('qrcs-job-' + id)).length, id)).toBe(0);
  };
  for (const dragging of [false, true]) await check('网页右键取消' + (dragging ? '进行中的拖动' : '未开始的框选') + '，清除任务且不识别', async () => {
    const job = await selectOnPage(screenshot);
    await source.mouse.move(250, 300);
    if (dragging) { await source.mouse.down(); await source.mouse.move(550, 600); }
    await source.mouse.click(550, 600, { button: 'right' });
    await expect(source.locator('qrcs-selection')).toHaveCount(0);
    if (dragging) await source.mouse.up();
    await expectJobGone(job.id); await expect(panel).toHaveCount(0);
  });
  for (const dragging of [false, true]) await check('工具栏右键取消' + (dragging ? '进行中的拖动' : '未开始的框选') + '，关闭并清除任务', async () => {
    const page = await standalone({ mode: 'select' }, screenshot);
    const id = new URL(page.url()).searchParams.get('job');
    await expect(page.locator('#select')).toBeVisible();
    const bounds = await page.locator('#stage').boundingBox();
    await page.mouse.move(bounds.x + 20, bounds.y + 20);
    if (dragging) { await page.mouse.down(); await page.mouse.move(bounds.x + 150, bounds.y + 80); }
    const closed = page.waitForEvent('close');
    await page.mouse.click(bounds.x + 150, bounds.y + 80, { button: 'right' }).catch(error => { if (!page.isClosed()) throw error; });
    await closed; await expectJobGone(id);
  });
  await check('工具栏结果右键仍可使用，不误取消识别结果', async () => {
    const page = await standalone({ mode: 'image', imageUrl: 'http://127.0.0.1:8765/text.png' });
    await expect(page.locator('#content')).toHaveText('QRCS 中文测试\n第二行：你好，世界！');
    await page.locator('#content').click({ button: 'right' });
    assert.equal(page.isClosed(), false); await expect(page.locator('#result')).toBeVisible();
    await Promise.all([page.waitForEvent('close'), page.locator('#cancel').click()]);
  });
  await check('非图片右键菜单进入框选兜底，可右键取消', async () => {
    await source.bringToFront();
    await worker.evaluate(async ({ tab, screenshot }) => {
      const capture = chrome.tabs.captureVisibleTab;
      chrome.tabs.captureVisibleTab = async () => screenshot;
      try { await qrcsTest.handleContextMenu({ menuItemId: 'qrcs-image' }, tab); }
      finally { chrome.tabs.captureVisibleTab = capture; }
    }, { tab, screenshot });
    await expect(source.locator('qrcs-selection')).toBeVisible();
    await source.mouse.click(500, 500, { button: 'right' });
    await expect(source.locator('qrcs-selection')).toHaveCount(0); await expect(panel).toHaveCount(0);
  });
  const styledURL = 'https://example.com/?qrcs=styled-gradient-logo';
  await check('美化二维码经不可见页面解码，显示页内小浮层', async () => {
    await source.goto('http://127.0.0.1:8765/styled.html'); await imageView('http://127.0.0.1:8765/styled.png');
    await expect(panel.locator('#content')).toHaveText(styledURL); await expect(panel.locator('#open')).toBeEnabled();
    await source.screenshot({ path: path.join(root, 'docs/screenshots/inpage-styled.png') }); await closePanel();
  });
  await check('完全离线时美化码截图裁剪仍可解码', async () => {
    await context.setOffline(true);
    try {
      await present({ mode: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 } }, 'data:image/png;base64,' + styledFixture.toString('base64'));
      await expect(panel.locator('#content')).toHaveText(styledURL); await closePanel();
    } finally { await context.setOffline(false); }
  });
  await check('原图失败后从整页截图识别美化码', async () => {
    const image = PNG.sync.read(styledFixture), full = new PNG({ width: 1400, height: 1000 });
    for (let i = 0; i < full.data.length; i += 4) full.data.set([12, 12, 12, 255], i);
    PNG.bitblt(image, full, 0, 0, 500, 500, 858, 247);
    await present({ mode: 'image', imageUrl: 'http://127.0.0.1:8765/missing.png' }, 'data:image/png;base64,' + PNG.sync.write(full).toString('base64'));
    await expect(panel.locator('#content')).toHaveText(styledURL); await closePanel();
  });
  await check('窄页面浮层不超出视口，关闭按钮可用', async () => {
    await source.setViewportSize({ width: 360, height: 640 }); await imageView('http://127.0.0.1:8765/text.png');
    const bounds = await panel.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360 && bounds.width <= 332);
    await panel.getByRole('button', { name: messages.close, exact: true }).click(); await expect(panel).toHaveCount(0); await source.setViewportSize({ width: 1400, height: 1000 });
  });
  await check('识别结果从未新增系统窗口或结果标签页', async () => {
    assert.deepEqual(await windows(), initialWindows);
    const tabs = await worker.evaluate(() => chrome.tabs.query({})); assert.equal(tabs.length, 1, JSON.stringify(tabs.map(t => t.url)));
  });
  await check('受限 data 页面只配置工具栏弹层，没有新系统窗口', async () => {
    const imageUrl = 'data:image/png;base64,' + styledFixture.toString('base64'); await source.goto(imageUrl);
    const currentTab = await worker.evaluate(id => chrome.tabs.get(id), tab.id);
    await worker.evaluate(({ srcUrl, tab }) => qrcsTest.beginImage({ srcUrl }, tab), { srcUrl: imageUrl, tab: currentTab });
    const popup = await worker.evaluate(id => chrome.action.getPopup({ tabId: id }), tab.id);
    assert.ok(popup.includes('scanner.html?job=') && popup.includes('compact=1'), popup); assert.deepEqual(await windows(), initialWindows);
    const page = await context.newPage(); await page.setViewportSize({ width: 420, height: 560 }); await page.goto(popup);
    await expect(page.locator('#content')).toHaveText(styledURL); await page.screenshot({ path: path.join(root, 'docs/screenshots/toolbar-result.png') });
    await page.locator('#cancel').click();
    await expect.poll(() => worker.evaluate(id => chrome.action.getPopup({ tabId: id }), tab.id)).toBe('');
  });
  await check('没有未捕获的页面错误', async () => { assert.deepEqual(errors, []); });
  await fs.writeFile(path.join(root, 'docs/browser-test-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), version: manifest.version, language, browserVersion: context.browser().version(), passed, failed: 0,
    scope: '独立 Chromium。生产右键处理函数、不可见页面解码、真实页内框选/结果/复制/跳转、受限页工具栏配置与紧凑界面；无新增系统窗口。截图由测试浏览器提供，未覆盖真实 Edge 原生菜单/工具栏手势和 activeTab 截屏授权。' }, null, 2) + '\n');
  console.log(`集成测试通过：${passed}/${passed}`);
} catch (error) {
  console.error(error);
  for (const [i, page] of (context?.pages() || []).entries()) {
    await page.screenshot({ path: path.join(root, `tmp/browser-failure-${i}.png`) }).catch(() => {});
    console.error(page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 1800));
  }
  process.exitCode = 1;
} finally { await context?.close(); server?.kill(); }
