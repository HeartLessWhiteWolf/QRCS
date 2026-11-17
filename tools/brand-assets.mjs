/** Render every brand asset from the user-selected PNG without redrawing it. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadBrand() {
  const bytes = await fs.readFile(path.join(root, 'publishing/assets/logo-300.png'));
  return 'data:image/png;base64,' + bytes.toString('base64');
}

export async function buildBrandAssets() {
  const sourceFile = 'branding/qrcs-logo.png';
  const source = await fs.readFile(path.join(root, sourceFile));
  const dataURL = 'data:image/png;base64,' + source.toString('base64');
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'tmp/browsers');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  await fs.mkdir(path.join(root, 'extension/icons'), { recursive: true });
  await fs.mkdir(path.join(root, 'publishing/assets'), { recursive: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const size of [16, 32, 48, 128, 300]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<!doctype html><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:contain}</style><img src="${dataURL}" alt="">`);
      await page.locator('img').evaluate(img => img.decode());
      const bytes = await page.screenshot({ omitBackground: true });
      if (size !== 300) await fs.writeFile(path.join(root, `extension/icons/${size}.png`), bytes);
      if (size === 128 || size === 300) await fs.writeFile(path.join(root, `publishing/assets/logo-${size}.png`), bytes);
    }
  } finally { await browser.close(); }
  const logoData = await loadBrand();
  // Keep the README's existing SVG entry point, embedding the selected artwork.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300"><title>QRCS</title><image width="300" height="300" href="${logoData}"/></svg>\n`;
  await fs.writeFile(path.join(root, 'publishing/assets/logo.svg'), svg);
  return { logoData, source: { file: sourceFile, sha256: crypto.createHash('sha256').update(source).digest('hex') } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const brand = await buildBrandAssets();
  console.log(`统一徽标已生成：4 个扩展图标、2 个商店图标和 SVG 封装。母版：${brand.source.file}`);
}
