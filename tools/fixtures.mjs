/** Generate disposable fixture pages, then serve only this project's tmp/fixtures. */
import fs from 'node:fs/promises';
import QRCode from 'qrcode';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'fixtures');
await fs.mkdir(root, { recursive: true });
for (const [name, text, options] of [
  ['url', 'http://127.0.0.1:8765/destination.html?from=qrcs', {}],
  ['text', 'QRCS 中文测试\n第二行：你好，世界！', {}],
  ['inverted', 'https://example.com/inverted', { color: { dark: '#fff', light: '#111' } }],
  ['html', '<img src=x onerror=alert(1)>', {}]
]) await QRCode.toFile(path.join(root, name + '.png'), text, { width: 400, margin: 4, ...options });
await fs.writeFile(path.join(root, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>QRCS 测试页</title><style>body{font:18px 'Microsoft YaHei';background:#eef4f5;padding:24px}img{width:320px;height:320px;margin:20px}h1{font-size:24px}</style><h1>QRCS 浏览器验收样本</h1><img src="url.png" alt="网址二维码"><img src="text.png" alt="中文二维码"><img src="inverted.png" alt="反色二维码"><img src="html.png" alt="HTML 文本二维码"><p>框选或右键图片识别。</p></html>`);
await fs.writeFile(path.join(root, 'destination.html'), '<!doctype html><meta charset="utf-8"><title>QRCS 跳转成功</title><h1>QRCS 跳转验证成功</h1>');
await fs.copyFile(new URL('../tests/fixtures/styled-gradient-logo.png', import.meta.url), path.join(root, 'styled.png'));
const server = http.createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(8765, '127.0.0.1', () => console.log('QRCS 测试页：http://127.0.0.1:8765（仅本机）'));
