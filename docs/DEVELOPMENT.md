# 开发指南

QRCS 使用原生 JavaScript、HTML、CSS 和 Manifest V3，解码器随扩展打包。安装用户无需运行构建工具，`extension/` 可直接作为解压缩扩展加载。

## 环境准备

使用 Node.js 22 或更新版本，在仓库根目录运行：

```bash
npm ci --ignore-scripts
npm run vendor
npm test
```

在 Edge 中打开 `edge://extensions/`，开启开发人员模式，加载仓库的 `extension/` 目录。修改代码后重新加载扩展，并刷新目标网页。

## 浏览器集成验证

首次运行时下载独立 Chromium。浏览器与临时配置只放在本项目的 `tmp/` 中，不连接用户已有 Edge。

Windows PowerShell：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tmp\browsers'
npx playwright install chromium --no-shell
npm run test:browser
```

macOS / Linux shell：

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/browsers" npx playwright install chromium --no-shell
npm run test:browser
```

独立 Chromium 集成测试不等同于所有浏览器的原生交互验收。测试范围及限制见 [验收记录](TESTING.md)。

集成测试默认使用简体中文。PowerShell 中可设置 `$env:QRCS_TEST_LANGUAGE = 'en-US'` 后重跑 `npm run test:browser` 验证英文，设置为 `zh-CN` 可切回中文。扩展文案维护在 `extension/_locales/zh_CN/messages.json` 与 `extension/_locales/en/messages.json`，两套消息键和占位符须保持一致；未支持的语言回退到英文。

## 本机示例页

```bash
npm run fixtures
```

打开终端输出的 `http://127.0.0.1:8765`。服务只监听回环地址，按 Ctrl+C 停止。

公开仓库的美化码样本是自建数据，可用 `npm run fixture:public` 重建。原用户反馈图片仅在本机忽略目录 `local-only/` 留存，不进入仓库。依赖、临时浏览器配置和凭据文件同样排除在 Git 外。

## 打包

```bash
npm run pack
npm run verify:package
```

生成 `dist/QRCS-<版本>.zip` 和 SHA-256 文件。ZIP 内直接包含 `manifest.json`；发布或手动安装时使用这份扩展包。

商店文案与素材生成见 [发布材料说明](../publishing/README.md)：

```bash
npm run store:build
npm run store:verify
npm run store:pack
```

这些命令要求扩展 ZIP 已生成。商店材料 ZIP、隐私网站 ZIP 与扩展安装 ZIP 用途不同，不应混淆。

## 代码结构

| 路径 | 用途 |
| --- | --- |
| `extension/background.js` | 图片菜单、截图入口、任务调度、界面选择与跳转 |
| `extension/selection.js` | 按需注入的截图框选界面 |
| `extension/result-panel.js` | 网页内紧凑结果浮层 |
| `extension/scanner.*` | 受限页面的工具栏弹层 |
| `extension/offscreen.*` | 不可见扩展页面中的解码调度 |
| `extension/image-pipeline.js` | 图像读取、裁剪、缩放与 Worker 调用 |
| `extension/decode-*.js` | jsQR、ZXing 本地解码与多结果合并 |
| `extension/core.js` | URL、内容类型与坐标规则 |
| `extension/vendor/` | 随包分发的解码器及许可证 |
| `tests/` | 核心和图像回归测试 |
| `tools/` | 示例、浏览器验证、图标、素材及打包工具 |
| `publishing/` | 商店文案、隐私网页与可公开使用的素材 |

历史实现过程记录保留在 [项目进度](PROGRESS.md)，面向使用者的说明见仓库首页。
