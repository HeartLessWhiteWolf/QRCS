/** npm run vendor — copy pinned decoders and licenses, keeping brand assets intact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, 'extension/vendor'), { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/jsqr/dist/jsQR.js'), path.join(root, 'extension/vendor/jsQR.js'));
await fs.copyFile(path.join(root, 'node_modules/jsqr/LICENSE'), path.join(root, 'extension/vendor/jsQR-LICENSE.txt'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/dist/iife/reader/index.js'), path.join(root, 'extension/vendor/zxing-reader.js'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'), path.join(root, 'extension/vendor/zxing_reader.wasm'));
await fs.copyFile(path.join(root, 'node_modules/zxing-wasm/LICENSE'), path.join(root, 'extension/vendor/zxing-wasm-LICENSE.txt'));
// ZXing-C++ and jsQR distribute the same unmodified Apache-2.0 license text.
await fs.copyFile(path.join(root, 'node_modules/jsqr/LICENSE'), path.join(root, 'extension/vendor/zxing-cpp-LICENSE.txt'));
console.log('本地解码库与许可证已准备；徽标保持不变，可用 npm run brand:build 重新生成。');
