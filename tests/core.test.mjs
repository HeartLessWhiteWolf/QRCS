import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import { safeWebURL, resultKind, selectionRect, pixelRect } from '../extension/core.js';
import { createI18n } from './helpers/i18n.mjs';

globalThis.chrome = { i18n: createI18n('zh_CN') };

test('只允许明确的 HTTP(S) 网址，并拒绝脚本、凭据和控制字符', () => {
  assert.equal(safeWebURL('https://example.com/a?q=中文'), 'https://example.com/a?q=%E4%B8%AD%E6%96%87');
  assert.equal(safeWebURL(' HTTPS://example.com '), 'https://example.com/');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/x', 'edge://settings', '//example.com', 'example.com', 'https://u:p@example.com', 'https://example.com/\nabc', 'https://', null]) assert.equal(safeWebURL(value), null, String(value));
  assert.equal(resultKind('WIFI:T:WPA;S:测试;P:123;;'), 'Wi-Fi 信息');
  assert.equal(resultKind('BEGIN:VCARD\nEND:VCARD'), '电子名片');
  assert.equal(resultKind('<script>alert(1)</script>'), '文本内容');
});
test('反向拖拽、边界裁剪、页面与设备缩放使用归一化坐标', () => {
  assert.deepEqual(selectionRect({ x: 80, y: 80 }, { x: 20, y: 20 }, 100, 100), { x: .2, y: .2, width: .6, height: .6 });
  assert.deepEqual(selectionRect({ x: -10, y: -10 }, { x: 150, y: 150 }, 100, 100), { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(selectionRect({ x: 5, y: 5 }, { x: 6, y: 7 }, 100, 100), null);
  assert.deepEqual(pixelRect({ x: .25, y: .25, width: .5, height: .5 }, 2560, 1440), { x: 640, y: 360, width: 1280, height: 720 });
  for (const rect of [{ x: NaN, y: 0, width: .2, height: .2 }, { x: .9, y: .9, width: .2, height: .2 }, { x: 0, y: 0, width: -1, height: 1 }]) assert.throws(() => pixelRect(rect, 100, 100));
});

const sandbox = vm.createContext({ Uint8ClampedArray, Uint8Array, Array, console });
vm.runInContext(await fs.readFile(new URL('../extension/vendor/jsQR.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(await fs.readFile(new URL('../extension/decode-engine.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(await fs.readFile(new URL('../extension/decode-enhanced.js', import.meta.url), 'utf8'), sandbox);
prepareZXingModule({ overrides: { wasmBinary: await fs.readFile(new URL('../extension/vendor/zxing_reader.wasm', import.meta.url)) } });
const enhanced = png => sandbox.QRCSDecodeEnhanced(png.data, png.width, png.height, async () => ({ readBarcodes }));
const decode = png => sandbox.QRCSDecode(png.data, png.width, png.height);
async function make(text, extra = {}) {
  return PNG.sync.read(await QRCode.toBuffer(text, { width: 360, margin: 4, errorCorrectionLevel: 'M', ...extra }));
}
for (const [label, text, extra] of [
  ['网址', 'https://example.com/qr?test=1', {}],
  ['中文与换行', '二维码内容测试\n你好，世界！\n123 ABC', {}],
  ['Wi-Fi', 'WIFI:T:WPA;S:测试网络;P:password123;;', {}],
  ['反色', 'https://example.com/inverted', { color: { dark: '#ffffff', light: '#101010' } }],
  ['彩色', '彩色二维码 QRCS', { color: { dark: '#084b6c', light: '#fff7df' } }],
  ['小图', 'QRCS small', { width: 110 }],
  ['高密度', 'https://example.com/?data=' + '中文测试'.repeat(30), { width: 700 }],
  ['HTML 原文', '<img src=x onerror=alert(1)>', {}]
]) test('解码：' + label, async () => { assert.equal(decode(await make(text, extra))[0]?.text, text); });
test('解码：旋转 90 度与 180 度', async () => {
  const png = await make('rotation');
  for (const turns of [1, 2]) {
    const rotated = new PNG({ width: png.width, height: png.height });
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const dx = turns === 1 ? png.height - 1 - y : png.width - 1 - x;
      const dy = turns === 1 ? x : png.height - 1 - y;
      png.data.copy(rotated.data, (dy * png.width + dx) * 4, (y * png.width + x) * 4, (y * png.width + x) * 4 + 4);
    }
    assert.equal(decode(rotated)[0]?.text, 'rotation');
  }
});
test('解码：一张图中的两个不同二维码', async () => {
  const a = await make('https://example.com/first'), b = await make('第二个二维码');
  const combined = new PNG({ width: 760, height: 380 }); combined.data.fill(255);
  PNG.bitblt(a, combined, 0, 0, 360, 360, 10, 10); PNG.bitblt(b, combined, 0, 0, 360, 360, 390, 10);
  assert.deepEqual(Array.from(decode(combined), r => r.text).sort(), ['https://example.com/first', '第二个二维码'].sort());
});
test('无二维码时没有伪结果', () => {
  const blank = new PNG({ width: 200, height: 200 }); blank.data.fill(255);
  assert.equal(decode(blank).length, 0);
});
test('美化码回归：渐变背景、圆点、圆角定位框和中央图标二维码', async () => {
  const png = PNG.sync.read(await fs.readFile(new URL('fixtures/styled-gradient-logo.png', import.meta.url)));
  const original = Buffer.from(png.data);
  const results = await enhanced(png);
  assert.equal(results.length, 1);
  assert.equal(results[0].text, 'https://example.com/?qrcs=styled-gradient-logo');
  assert.deepEqual(Buffer.from(results[0].binary), Buffer.from(results[0].text));
  assert.deepEqual(png.data, original, '解码不能破坏源像素');
});
test('双解码器在空白图上均不产生伪结果', async () => {
  const blank = new PNG({ width: 240, height: 240 }); blank.data.fill(255);
  assert.equal((await enhanced(blank)).length, 0);
});
test('同图混合普通码与美化码时合并结果并去重', async () => {
  const styled = PNG.sync.read(await fs.readFile(new URL('fixtures/styled-gradient-logo.png', import.meta.url)));
  const plain = await make('混合二维码测试', { width: 500 });
  const combined = new PNG({ width: 1060, height: 520 }); combined.data.fill(255);
  PNG.bitblt(plain, combined, 0, 0, 500, 500, 10, 10);
  PNG.bitblt(styled, combined, 0, 0, 500, 500, 550, 10);
  const results = await enhanced(combined);
  assert.deepEqual(Array.from(results, result => result.text).sort(), ['混合二维码测试', 'https://example.com/?qrcs=styled-gradient-logo'].sort());
});
test('扩展资源完整且不依赖远程脚本', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'contextMenus', 'scripting', 'storage', 'offscreen'].sort());
  for (const file of [manifest.background.service_worker, ...Object.values(manifest.icons), 'scanner.html', 'scanner.js', 'scanner.css', 'selection.js', 'result-panel.js', 'offscreen.html', 'offscreen.js', 'image-pipeline.js', 'decode-worker.js', 'decode-engine.js', 'decode-enhanced.js', 'vendor/jsQR.js', 'vendor/jsQR-LICENSE.txt', 'vendor/zxing-reader.js', 'vendor/zxing_reader.wasm', 'vendor/zxing-wasm-LICENSE.txt']) await fs.access(new URL('../extension/' + file, import.meta.url));
  const html = await fs.readFile(new URL('../extension/scanner.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/);
  assert.doesNotMatch(await fs.readFile(new URL('../extension/scanner.js', import.meta.url), 'utf8'), /\.innerHTML\s*=/);
});
