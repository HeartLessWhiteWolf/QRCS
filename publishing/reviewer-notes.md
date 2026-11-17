# Notes for certification（可粘贴英文正文）

QRCS is a single-purpose QR Code reader for desktop Microsoft Edge with Chromium 127 or later. No account, subscription, payment, backend recognition service, camera, microphone, or test credentials are required. The UI is Simplified Chinese.

Test data: a public, self-contained page with generated sample QR images is available at https://heartlesswhitewolf.github.io/qrcs-info/demo.html — no login, no script, no external assets. Privacy policy: https://heartlesswhitewolf.github.io/qrcs-info/privacy.html. Support page: https://heartlesswhitewolf.github.io/qrcs-info/support.html.

Suggested test flow:
1. Open an ordinary HTTPS page containing a QR image. Right-click the image and choose “QR码识别”. A compact in-page result panel should appear.
2. A URL sample should display `https://example.com/`. “复制” copies the text; “跳转” opens it in a new tab only after the user clicks. “取消”, the close button, or Esc dismisses the result.
3. Click the QRCS toolbar icon, drag around a complete QR Code and its quiet zone, then release. A result is displayed in the same page. Esc or a right-click cancels selection, including during a drag.
4. A text QR should preserve the original Chinese text/newline and disable the web-navigation button.
5. If multiple distinct codes are found, use the result buttons to switch between them.
6. On pages where script injection is blocked (for example, a standalone data:image page), the extension uses a compact toolbar popup instead. If automatic popup opening is unavailable, click the QR badge on the extension icon. No standalone OS window is created for results.

Limitations disclosed to users: screenshots cover the visible web content of the active tab only. Browser internal pages, the extension store, PDF viewers and local files may have browser-imposed restrictions. Poor-quality or heavily stylized/damaged symbols are not guaranteed to decode. Only valid HTTP(S) URLs without embedded credentials can be opened; other contents can be displayed/copied. This product is intended for QR Codes, not general 1D barcodes.

Permissions:
- contextMenus: image-only “QR码识别” entry.
- activeTab: user-invoked visible-tab screenshot.
- scripting: on-demand selection and result UI injection.
- storage: storage.session task transfer only; no local/sync scan history.
- offscreen: local Canvas/image work and decoding workers without a visible window.
- http://*/* and https://*/*: read the user-selected image across arbitrary image/CDN origins and inject the on-demand page UI. No persistent content script or browsing-history collection.

Remote-code declaration: No remotely hosted code is executed. All JS and the ZXing WASM binary are included in the package. decode-worker.js supplies local WASM bytes before initialization. The unmodified third-party bundle contains an upstream default CDN URL string; that default is not used. The WASM path has been tested offline. The CSP wasm-unsafe-eval token permits local WebAssembly instantiation, not remote JavaScript or general eval.

Data practices: all decoding is on-device. Images/screenshots/results are not uploaded to the developer or an analytics/recognition service. Fetching an original image requests its origin and may carry browser-managed session credentials; only an explicit navigation click visits the decoded destination. Copy writes to the OS clipboard. Task data is temporary in storage.session and memory. Further details are in the public privacy-policy URL supplied in Partner Center.

Third-party source and licenses: jsQR 1.4.0 (Apache-2.0), zxing-wasm 3.1.6 JS wrapper (MIT), ZXing-C++ binary (Apache-2.0). Sources are https://github.com/cozmo/jsQR and https://github.com/Sec-ant/zxing-wasm; license and attribution files are in extension/vendor/. Our application modules are readable source. The upstream packaged decoder bundles are minified but not custom-obfuscated.

## 提交前给发布者的提醒（不粘贴此节）

- 示例页、隐私政策、帮助页已部署并验证可公开访问（GitHub Pages，见上方三个地址）。
- 当前已有 43 项单元与核心回归测试，简体中文与英文的独立 Chromium 集成测试各 25 项；这不等同于当前 Edge 原生菜单/工具栏外壳已经全部实测。
- 提交前请按以上步骤在正式 Microsoft Edge 中完成最后一次验收，确保运行版本是 1.0.5。
- 发布者邮箱、隐私政策 URL、商店说明和数据声明必须保持一致，不填虚构信息。
