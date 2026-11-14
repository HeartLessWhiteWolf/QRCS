# QRCS 二维码识别

适用于 Chromium 127 及更新内核、支持 Manifest V3 的桌面浏览器，优先适配 Microsoft Edge。

右键网页图片选择 **QR码识别**，或点击扩展图标拖动框选二维码。识别后显示完整内容；HTTP / HTTPS 链接可点击 **跳转** 在新标签页打开，其他内容可以复制。始终先展示结果，不自动跳转。

## 当前进度

- 当前版本 **1.0.2**，17 项核心测试、16 项独立 Chromium 集成测试通过。
- 识别结果改为网页内约 420px 宽的小浮层，可跳转、复制、取消或按 Esc 关闭；不新建系统窗口或任务栏图标。无法注入的页面使用工具栏紧凑弹层。
- 已修复用户提供的渐变圆点、圆角定位框、中央头像二维码识别失败问题。新增 ZXing-C++ WASM 解码，并与 jsQR 结果合并去重；两套解码器都随扩展本地分发。
- 用户已自行加载扩展并提供实际失败截图；该样本现已通过原图、框选、整页截图及离线回归。两个现有 Edge 标签页的完整原生交互验收仍待完成。详见 [阶段进度](docs/PROGRESS.md) 和 [验收记录](docs/TESTING.md)。

## 安装

1. 在 Edge 地址栏打开 `edge://extensions/`。
2. 打开「开发人员模式」，点击「加载解压缩的扩展」。
3. 选择本项目的 `extension` 文件夹（内含 `manifest.json`），即 `D:\DSH_WorkFolder\QRCS\extension`。
4. 在扩展菜单中找到 **QRCS 二维码识别**，可将图标固定到工具栏。

离线分发包位于 `dist/QRCS-1.0.2.zip`。解压到固定位置后，选择解压所得、直接包含 `manifest.json` 的目录加载。ZIP 无需运行安装程序，也无需安装 Node.js。

完整说明：[安装与使用](docs/INSTALL.zh-CN.md)。

## 商店上架材料

已为发布者 Xpovoc（公开支持邮箱 wighowolf@gmail.com）整理商店文案、权限理由、隐私政策、审核说明、图标、4 张真实界面截图与可选宣传图。入口：[发布材料说明](publishing/README.md)。

- `dist/QRCS-1.0.2-store-materials.zip`：完整发布材料，内含单独的扩展上传 ZIP。
- `dist/QRCS-1.0.2-privacy-site.zip`：仅 4 个静态网页，可部署到 GitHub Pages 等服务。
- 隐私政策的公开 HTTPS 网址仍需上线后填写，正式 Edge 最终人工验收也应在提交前完成。不要将整个材料 ZIP 上传为扩展包。

## 使用

- **右键图片**：图片上右键 →「QR码识别」→ 核对内容 → 跳转、复制或取消。
- **截图框选**：点击图标 → 拖动框住二维码及四周留白 → 松开识别。`Esc` 取消。
- **独立图片或受限页面**：无法注入页面框选界面时，使用工具栏紧凑弹层框选及显示结果；如果浏览器未自动展开，点击带 `QR` 标记的扩展图标即可。
- **多个二维码**：同一图像内可返回最多 8 个不同内容，使用结果按钮切换；复杂布局仍建议分别框选。
- **没有识别到**：点击「重新框选」，或回原网页放大后重新点击扩展图标。

## 数据与权限

二维码在本机处理，解码库随扩展一起打包，不调用识别服务器、分析服务或远程脚本。

| 权限 | 用途 |
| --- | --- |
| `contextMenus` | 添加图片右键菜单 |
| `activeTab` | 用户点击图标或菜单后，临时取得当前标签页截屏能力 |
| `scripting` | 按需注入框选界面 |
| `storage` | 在扩展组件间暂存本次任务，使用 `storage.session` |
| `offscreen` | 在不可见扩展页面中本地运行解码，不创建可见窗口 |
| HTTP / HTTPS 主机权限 | 读取用户右键选择的跨域图片；允许按需注入普通网页 |

截图和结果不写入浏览历史数据库，也不存储在 `storage.local` / `storage.sync`。浮层关闭或取消时清除临时任务；异常遗留任务在 30 分钟后下一次使用时清理，关闭浏览器后会话存储也会清空。读取原图可能向图片原服务器发起请求；点击「跳转」后才访问识别所得地址。

## 识别范围与限制

- 针对常见 **QR Code**；支持中文、文本、网址、Wi-Fi 配置、名片等载荷。不是通用一维条码或 Data Matrix 扫描器。
- 反色、彩色、旋转等已用样本验证。严重模糊、遮挡、损坏、特殊艺术二维码无法保证识别。
- 跳转仅接受明确、有效且不含账户密码的 HTTP / HTTPS 网址。应用专用链接、Wi-Fi 信息等保留原文，可复制处理。
- 截图只包含当前网页的可见区域，不包含浏览器工具栏或桌面其他应用。
- 浏览器内部页、扩展商店、PDF 阅读器、本地文件等受浏览器策略限制，截图或注入可能不可用；会显示失败原因。
- Edge / Chrome / Brave 等的具体版本需各自验证。本机自动测试使用 Chromium 145.0.7632.6，不能替代其他浏览器的兼容验收。

## 开发与验证

使用 Node.js 22 或更新版本：

```powershell
npm ci --ignore-scripts
npm run vendor
npm test
```

首次运行浏览器集成测试时下载独立 Chromium（只放在本项目 `tmp` 内）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'tmp\browsers'
npx playwright install chromium --no-shell
npm run test:browser
```

`npm run fixtures` 可单独启动本机测试页，地址为 `http://127.0.0.1:8765`。仅监听回环地址，按 Ctrl+C 停止。

```powershell
npm run pack
```

生成 ZIP 和 SHA-256 文件。安装用户不需要运行任何开发命令。

## 代码布局

- `extension/background.js`：右键和图标入口、截图、临时任务、显示调度与安全跳转。
- `extension/selection.js`：按需注入的 Shadow DOM 框选界面。
- `extension/result-panel.js`：网页内紧凑结果浮层。
- `extension/scanner.*`：受限页面使用的工具栏紧凑框选与结果界面。
- `extension/offscreen.*` / `image-pipeline.js`：不可见页面与共用图像读取、裁剪、解码流程。
- `extension/decode-worker.js` / `decode-engine.js` / `decode-enhanced.js`：本地双解码器、多二维码分区搜索与结果合并。
- `extension/core.js`：URL、结果类型与坐标换算规则。
- `extension/vendor/`：锁定版本的 jsQR、ZXing-WASM 本地资源、许可证和第三方声明。
- `tests/` / `tools/`：核心测试、独立浏览器验证、图标与打包工具。
- `docs/`：说明、验收记录和验证截图。`tmp/` 仅存放可再生测试产物。

公开仓库的美化码回归样本为项目自建数据，可用 `npm run fixture:public` 重建。原始用户反馈图片仅在本机 `local-only/` 留存，和 `node_modules/`、临时浏览器配置、凭据文件一起排除在 Git 外。

官方依据：[Edge 本地加载扩展](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)、[Chromium 截图 API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)、[jsQR](https://github.com/cozmo/jsQR)。
