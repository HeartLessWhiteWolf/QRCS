# 可公开分发的回归样本

`styled-gradient-logo.png` 是由本项目自行生成的 500×500 美化二维码，用于覆盖用户真实反馈所涉及的样式。它不包含用户原始二维码载荷、私人链接或第三方头像。

特征：黄色至粉色渐变背景、彩色圆点码元、圆角定位框、中央使用 `branding/qrcs-logo.png` 对应的新 QRCS 徽标。载荷为 `https://example.com/?qrcs=styled-gradient-logo`，只用于解码比对，不会由测试自动访问。

重新生成：`npm run fixture:public`。生成器见 `tools/public-fixture.mjs`，使用 QRCode 数据和项目自建图形，无需下载外部图片。

最初用于修复问题的真实图片已在本机 `local-only/fixtures/` 留存，不进入 Git；仓库测试和公开验证截图使用上述自建样本。
