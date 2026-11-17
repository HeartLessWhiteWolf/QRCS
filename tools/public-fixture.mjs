/** Generate a redistributable styled QR fixture with no user data or third-party avatar.
 * npm run fixture:public — regenerate the gradient/dots/rounded-finder/QRCS-logo PNG.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { loadBrand } from './brand-assets.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, 'tmp/browsers');
const { chromium } = await import('@playwright/test');
const logoData = await loadBrand();
export const payload = 'https://example.com/?qrcs=styled-gradient-logo';
const qr = QRCode.create(payload, { errorCorrectionLevel: 'H', version: 6 });
const n = qr.modules.size, margin = 2, m = 500 / (n + 2 * margin);
const position = v => (v + margin) * m;
const finderAt = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
let dots = '';
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
  if (qr.modules.get(y, x) && !finderAt(x, y)) dots += `<circle cx="${position(x + .5)}" cy="${position(y + .5)}" r="${m * .34}"/>`;
}
let finders = '';
for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
  finders += `<rect x="${position(x)}" y="${position(y)}" width="${7 * m}" height="${7 * m}" rx="${1.2 * m}" fill="url(#ink)"/><rect x="${position(x + 1)}" y="${position(y + 1)}" width="${5 * m}" height="${5 * m}" rx="${.7 * m}" fill="url(#paper)"/><circle cx="${position(x + 3.5)}" cy="${position(y + 3.5)}" r="${1.5 * m}" fill="url(#ink)"/>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><defs><linearGradient id="paper" x1="0" x2="1"><stop stop-color="#fff1b9"/><stop offset="1" stop-color="#ffb9f2"/></linearGradient><linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d29b00"/><stop offset="1" stop-color="#c80921"/></linearGradient></defs><rect width="500" height="500" fill="url(#paper)"/><g fill="url(#ink)">${dots}</g>${finders}<rect x="202" y="202" width="96" height="96" rx="18" fill="white"/><image x="210" y="210" width="80" height="80" href="${logoData}"/></svg>`;
await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 500, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;overflow:hidden}svg{display:block;width:500px;height:500px}</style>${svg}`);
  await page.locator('svg image').evaluate(async element => { const image = new Image(); image.src = element.getAttribute('href'); await image.decode(); });
  await page.screenshot({ path: path.join(root, 'tests/fixtures/styled-gradient-logo.png') });
} finally { await browser.close(); }
console.log('自建美化二维码样本已生成：' + payload);
