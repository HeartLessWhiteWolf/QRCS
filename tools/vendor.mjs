/** npm run vendor — copy pinned decoder + license; generate deterministic icons. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, 'extension/vendor'), { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/jsqr/dist/jsQR.js'), path.join(root, 'extension/vendor/jsQR.js'));
await fs.copyFile(path.join(root, 'node_modules/jsqr/LICENSE'), path.join(root, 'extension/vendor/jsQR-LICENSE.txt'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/dist/iife/reader/index.js'), path.join(root, 'extension/vendor/zxing-reader.js'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'), path.join(root, 'extension/vendor/zxing_reader.wasm'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/LICENSE'), path.join(root, 'extension/vendor/zxing-wasm-LICENSE.txt'));
// ZXing-C++ and jsQR distribute the same unmodified Apache-2.0 license text.
await fs.copyFile(path.join(root, 'node_modules/jsqr/LICENSE'), path.join(root, 'extension/vendor/zxing-cpp-LICENSE.txt'));
await fs.mkdir(path.join(root, 'extension/icons'), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = Math.floor(x * 32 / size), v = Math.floor(y * 32 / size);
    const finder = (a, b) => {
      const dx = u - a, dy = v - b;
      return dx >= 0 && dy >= 0 && dx < 9 && dy < 9 && (dx < 2 || dx > 6 || dy < 2 || dy > 6 || (dx >= 3 && dx <= 5 && dy >= 3 && dy <= 5));
    };
    const white = finder(5, 5) || finder(18, 5) || finder(5, 18) || (u >= 19 && u < 23 && v >= 19 && v < 23) || (u >= 25 && u < 28 && v >= 22 && v < 28) || (u >= 18 && u < 22 && v >= 26 && v < 28);
    const i = (y * size + x) * 4;
    png.data.set(white ? [245, 255, 253, 255] : [10, 113, 119, 255], i);
  }
  await fs.writeFile(path.join(root, `extension/icons/${size}.png`), PNG.sync.write(png));
}
console.log('本地解码库、许可证与 4 个图标已准备。');
