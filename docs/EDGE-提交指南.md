# Edge 上架操作指南（1.0.4）

按顺序做完这四步就能提交。前两步在本地，后两步在网页。

- 提交用的安装包：`dist/QRCS-1.0.4.zip`（521 KB）
- 隐私政策：https://heartlesswhitewolf.github.io/qrcs-info/privacy.html
- 示例页（给审核用）：https://heartlesswhitewolf.github.io/qrcs-info/demo.html
- 帮助页：https://heartlesswhitewolf.github.io/qrcs-info/support.html

---

## 第一步：注册开发者账号（一次性，约 10 分钟）

1. 打开 <https://partner.microsoft.com/dashboard/microsoftedge/overview>
2. 用你的 Microsoft 账号登录（跟付费的 Microsoft 365 无关，普通账号就行）
3. 按提示注册「Microsoft Edge 程序」开发者账号，**目前免费**
4. 填发布者显示名：`Xpovoc`（必须和 `publishing/publisher.json` 里的 `publisherName` 一致）
5. 验证邮箱（会发一封信到账号邮箱，点链接确认）

> 账号验证可能要等几分钟到几小时。这段时间可以先做第二步。

---

## 第二步：在正式 Edge 里人工验收（约 10 分钟）

**必须用打包好的那份 ZIP，不能用源码目录**，否则验的不是你要提交的东西。

### 2.1 解压到一个临时目录

```powershell
$dst = "$env:TEMP\qrcs-acceptance"
Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive 'D:\DSH_WorkFolder\QRCS\dist\QRCS-1.0.4.zip' -DestinationPath $dst
$dst
```

### 2.2 加载到 Edge

1. 地址栏输入 `edge://extensions/`
2. 打开左下角「开发人员模式」
3. 点「加载解压缩的扩展」，选上一步输出的目录
4. 确认卡片上显示的版本是 **1.0.4**，且没有报错提示

### 2.3 逐项走一遍（这是微软要求的那一步）

| # | 操作 | 期望结果 |
|---|---|---|
| 1 | 打开 https://heartlesswhitewolf.github.io/qrcs-info/demo.html | 页面显示若干示例二维码 |
| 2 | 在二维码图片上**右键** → 「QR码识别」 | 页内出现小浮层，显示识别内容 |
| 3 | 结果里点「复制」 | 提示已复制，去别处粘贴验证文本一致 |
| 4 | 结果里点「跳转」 | 在新标签页打开目标地址（不自动跳，必须点了才跳） |
| 5 | 关闭浮层 / 按 `Esc` | 浮层消失，页面恢复正常 |
| 6 | 点**工具栏 QRCS 图标** → 拖动框选二维码（四周留白） | 松手后在同一页出现结果 |
| 7 | 框选过程中按 `Esc` 或**右键** | 取消框选，不触发识别 |
| 8 | 找一个**非图片区域**的二维码（背景图或 Canvas） | 右键「QR码识别」会进入框选模式 |

> 第 8 项如果找不到现成页面，可以在 `demo.html` 上试：它的示例图本身就覆盖了多种码样式。

### 2.4 记录结果

哪一项不对，记下第几项 + 现象。**验收没过就先别提交**。

---

## 第三步：在 Partner Center 提交（约 20 分钟）

登录后点「新建扩展」，按下面顺序填。

### 3.1 包（Package）

- 上传 `dist/QRCS-1.0.4.zip`
- 上传后系统会解析 manifest，确认显示版本 **1.0.4**、名称 **QRCS 二维码识别**

### 3.2 商店一览（Store listing）

| 字段 | 填什么 | 来源 |
|---|---|---|
| 显示名称 | `QRCS 二维码识别` | `store-listing.json` 的 `name` |
| 简短描述 | 右键识别图片，或点击图标框选网页二维码。本地处理，先预览再跳转。 | `shortDescription` |
| 详细描述 | 见 `publishing/store-listing.json` 的 `description` 全文（约 900 字） | 直接复制 |
| 类别 | `Productivity`（效率） | `category` |
| 语言 | 中文（简体） | `language` |
| 搜索词 | 二维码 / QR Code / 二维码识别 / 截图扫码 / 图片扫码 / 本地识别（最多 7 个） | `searchTerms` |
| 隐私政策 URL | `https://heartlesswhitewolf.github.io/qrcs-info/privacy.html` | 必填 |
| 网站 | `https://heartlesswhitewolf.github.io/qrcs-info/` | 可选 |
| 支持邮箱 | `wighowolf@gmail.com` | 与隐私页一致 |

**视觉素材**（都在 `publishing/assets/`）：

- 扩展商店图标：`logo-300.png`（300×300）
- 小宣传图：`promo-small-440x280.png`
- 大宣传图：`promo-large-1400x560.png`
- 截图（最多 6 张，用 4 张）：
  - `screenshot-01-result-1280x800.png`
  - `screenshot-02-selection-1280x800.png`
  - `screenshot-03-text-1280x800.png`
  - `screenshot-04-wifi-1280x800.png`

### 3.3 隐私与权限（最容易被打回的一页）

**单一用途说明**（English，可直接粘）：

```
QRCS has a single purpose: read QR Codes and show the decoded content to the user.
```

**权限理由**，逐项填：

| 权限 | 填这段 |
|---|---|
| `contextMenus` | Adds one image-only context menu item ("QR码识别") so the user can decode a QR Code shown in an image. |
| `activeTab` | Grants temporary access to the current tab only after the user invokes the extension, to capture the visible area for decoding. |
| `scripting` | Injects the selection overlay and the in-page result panel on demand, after a user action. |
| `storage` | Uses `storage.session` only, to pass the current task between the service worker, the offscreen document and the page. No scan history, no sync storage. |
| `offscreen` | Creates an invisible offscreen document to run Canvas work and the decoding Web Worker without opening a window. |
| `http://*/*` `https://*/*` | Reads the original pixels of the image the user right-clicked. That image is frequently hosted on a different origin (CDN) than the page, so per-tab `activeTab` alone cannot fetch it. Also used to inject the on-demand selection overlay and result panel. No persistent content script, no browsing-history access. |

**远程代码**：选「**No, I am not using remote code**」

理由可填：

```
All JavaScript and the ZXing WebAssembly binary are bundled in the package. The WASM bytes
are read from the extension's own file and supplied explicitly before initialization.
No script is fetched from the network at runtime.
```

**数据使用声明**（Data usage）：

- 是否收集用户数据：**不收集**（图像与识别结果不上传）
- 但要在「数据处理」说明里写明：读取网络原图时会向图片所在源发起请求，可能携带浏览器管理的会话凭据；只有用户点「跳转」时才访问目标网站；点「复制」才写剪贴板
- 上述必须与隐私政策页的说法一致，别写「从不访问任何数据」

### 3.4 审核备注（Notes for certification）

把 `publishing/reviewer-notes.md` 里 **「Notes for certification」标题以下的英文正文整段**粘进去（不含最后那节中文提醒）。

里面已经写了推荐测试流程和示例页地址。

### 3.5 提交

- 可见性：**Public**
- 市场：按需要勾选（至少包含中国）
- 检查无误后点 **Publish / 提交认证**

审核通常 **1~7 个工作日**。

---

## 提交后如果想改

`store:verify` 可以随时再跑：

```powershell
cd D:\DSH_WorkFolder\QRCS
npm run store:verify
```

它会重新核对 14 项，包括线上隐私页能不能打开。改完代码记得先升版本号再打包：

```powershell
npm run pack          # 生成 dist/QRCS-<版本>.zip
npm test              # 23 项单元测试
npm run store:verify  # 14 项发布材料
```

---

## 常见被打回的原因（提前避开）

1. **隐私政策 URL 打不开** —— 现在是 GitHub Pages，公开可读，已验证；如果以后再改页面，跑一遍 `store:verify` 确认
2. **权限理由写得太笼统** —— 别写「为了正常运行」，要写「具体在什么用户操作下、用哪项权限、做什么」
3. **隐私页说「不收集任何数据」但代码里带了 cookie** —— 我们的隐私页已经写明这点，别把描述改得更绝对
4. **截图与实际界面不符** —— 截图有 SHA-256 记录，改界面后要重新生成
5. **单一用途描述含糊** —— 就一句话：读二维码、显示结果，不要提别的功能
