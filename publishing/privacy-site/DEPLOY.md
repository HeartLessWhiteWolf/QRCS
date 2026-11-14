# 将隐私政策发布为公开网页

GitHub Pages 会把仓库里的 HTML 静态文件变成公开网页。这里不需要上传 QRCS 的完整源码，也不需要购买域名或搭建识别服务器。

以下只是可执行步骤，**本项目尚未替你创建仓库或上线网页**。示例中的 `你的用户名` 是占位说明，不是已存在地址。

## GitHub Pages 路径

1. 登录你自己的 GitHub 账号，新建一个专门放公开说明网页的仓库，例如 `qrcs-info`。使用免费 GitHub Pages 时，可选择公开仓库；不要放账号凭据、私密文件或 QRCS 工作目录的全部内容。
2. 将本目录的 `index.html`、`privacy.html`、`support.html`、`demo.html` 上传到仓库根目录并提交。只上传这 4 个页面即可；HTML 已内嵌所需图标和示例二维码，无需安装依赖或构建。
3. 打开仓库 **Settings → Pages**，Source 选择 **Deploy from a branch**，Branch 选择 `main`，目录选 `/ (root)`，保存。
4. 等 GitHub Pages 显示部署成功，以它显示的实际站点地址为准。若用户名为 `你的用户名`、仓库为 `qrcs-info`，通常形如 `https://你的用户名.github.io/qrcs-info/`。
5. 用退出登录或无痕窗口确认以下页面均能公开访问、无需登录：
   - 首页：站点根地址。
   - 隐私政策：根地址加 `privacy.html`。
   - 支持页：根地址加 `support.html`。
   - 示例页：根地址加 `demo.html`。
6. Partner Center 的 **Privacy Policy URL** 填实际隐私页地址；Website 可填首页；审核备注可填示例页地址。公开支持邮箱使用 `wighowolf@gmail.com`。

上述网页署名为 Xpovoc，邮箱会对公众可见，这是商店公开支持用途。网页本身无统计脚本；GitHub 作为托管服务仍可能记录正常访问日志。

## 也可使用其他静态托管

已有网站、对象存储静态站点或其他静态网页托管均可。将这 4 个文件放在同一目录，保留文件名，并保证浏览器能通过 HTTPS 直接打开政策正文，无需登录、下载或运行脚本。

## 上线后的核对

- 页面显示“QRCS 二维码识别隐私政策”、Xpovoc 和正确支持邮箱。
- 页面没有“待填写”或未替换占位符。
- 内容与 1.0.2 的实际数据行为一致。
- 手机和桌面都能正常阅读。
- 商店字段填真实公开 URL，不填 `D:\...`、`file://...`、`localhost` 或示例用户名。

官方 Pages 设置说明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
