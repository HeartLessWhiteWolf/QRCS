# QRCS 1.0.2 商店发布材料

发布者：**Xpovoc**  
公开支持邮箱：**wighowolf@gmail.com**

本目录是填写 Microsoft Partner Center 时使用的文案、图片和网页材料。**上传扩展包时，只选择 `upload/QRCS-1.0.2.zip`（材料 ZIP 解压后），或项目 `dist/QRCS-1.0.2.zip`。不要把整个发布材料 ZIP 当成扩展运行包上传。**

## 当前状态

- 商店名称、短描述、长描述、搜索词已准备。
- 单一用途、5 项 API 权限及 HTTP/HTTPS 主机权限理由、远程代码说明已准备。
- 隐私政策 Markdown 和可直接托管的静态网页已准备，署名和支持邮箱已填写。
- 300×300 商店图标、128×128 备用图标、4 张 1280×800 真实界面截图已准备。
- 可选 440×280 小宣传图、1400×560 大宣传图已准备。
- 中英文审核测试说明已准备。
- **隐私政策的公开 HTTPS 地址尚未部署**。只有本地网页文件，不可把本机路径填到商店 URL 字段。
- 正式 Edge 原生菜单/工具栏的最终人工复核仍需完成，见 `submission-checklist.md`。

## Partner Center 页面与材料对应

| 页面 | 使用材料 |
| --- | --- |
| Packages | `upload/QRCS-1.0.2.zip` 或项目 `dist/QRCS-1.0.2.zip` |
| Availability | Public；如只希望分享链接可改 Hidden；选择计划发布的市场 |
| Properties | 类别建议 Productivity；公开邮箱 `wighowolf@gmail.com` |
| Privacy / Single Purpose | `permissions-and-data.md` 的单一用途 |
| Privacy / Permission justification | 同文件中每个权限的小节 |
| Privacy / Remote code | 选择不使用远程代码；使用同文件说明 |
| Privacy / Data usage | 同文件的数据使用说明，按当前表单字段如实披露本地处理 |
| Privacy / Privacy Policy URL | 部署 `privacy-site/privacy.html` 后的真实 HTTPS URL |
| Store listings / zh-CN | `store-listing.zh-CN.md`；也可从 `store-listing.json` 逐字段复制 |
| Store logo | `assets/logo-300.png` |
| Screenshots | `assets/screenshot-01…04-1280x800.png`，按文件编号排序 |
| Small promotional tile | `assets/promo-small-440x280.png`（可选） |
| Large promotional tile | `assets/promo-large-1400x560.png`（可选） |
| Notes for certification | `reviewer-notes.md` 的英文正文；先确认其中的演示页地址 |

商店 logo、截图、宣传图均在商店表单中单独上传；它们不是扩展 ZIP 的一部分。

## 图片说明

4 张截图分别展示链接结果、真实框选过程、中文文本结果与 Wi-Fi 配置文本。它们由生产扩展的真实浮层和框选组件生成，示例码均为自建数据，无用户网盘链接或私人头像。截图没有捏造原生右键菜单；测试调用生产处理函数，展示其实际结果。

宣传图为介绍性排版，大宣传图中的结果卡片取自真实扩展界面。`assets/logo.svg` 是同品牌图形的矢量原稿，商店上传使用 PNG。

## 隐私网页怎么上线

见 `privacy-site/DEPLOY.md`。可用 GitHub Pages，也可用已有静态托管服务；只需发布 `privacy-site` 中的 HTML 文件，**不需要公开插件源码、测试代码或整个发布材料包**。

建议同一站点包含：`index.html`（介绍）、`privacy.html`（政策）、`support.html`（帮助）、`demo.html`（自包含示例二维码）。这些页面不含统计脚本、外链字体或 Cookie 操作。

这 4 个页面也单独打包在项目 `dist/QRCS-1.0.2-privacy-site.zip`，方便解压后上传。

上线后请在项目 `publishing/publisher.json` 中填写真实 `websiteURL`、`privacyPolicyURL`、`demoURL`，再执行下方验证。若从材料包直接发布，也可以手动将真实地址填入商店，不必为此修改扩展 manifest。

## 在项目内重新生成与验证

```powershell
npm run store:build
npm run store:verify
npm run store:pack
```

`store:build` 仅使用独立临时 Chromium 配置，不连接用户现有 Edge。`store:verify` 会检查图像尺寸、字数、资源一致性和未部署事项；预检通过不代表已经通过微软审核或完成账号验证。`store:pack` 生成单独的材料 ZIP，并保持扩展运行包独立。

## 官方依据

- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
- https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies

要求核对日期：2026-11-15。微软表单若发生变化，以提交时实际字段为准。
