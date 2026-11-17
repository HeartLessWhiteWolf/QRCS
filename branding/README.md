# QRCS 徽标母版

`qrcs-logo.png` 是用户选定并裁剪的 1028×1028 雾蓝与薄荷绿徽标，作为项目唯一的徽标母版，保留原图的形状、配色和白底。文件已原样复制进仓库，不依赖桌面路径。

`npm run brand:build` 使用独立无头 Chromium 按尺寸渲染，生成 `extension/icons/` 的 16、32、48、128 像素图标，以及 `publishing/assets/` 的 128、300 像素图标和 `logo.svg`。SVG 是自包含 PNG 封装，不是矢量重绘稿。

首次使用构建工具需按开发指南安装独立 Chromium。`npm run store:build` 会先执行同一徽标生成流程，再重建含徽标的商店截图、宣传图和静态网页。`npm run vendor` 只更新解码库与许可证，不覆盖徽标。

美化二维码样本中的中心图标使用同一徽标；通过 `npm run fixture:public` 重建。文档截图通过 `npm run test:browser` 从实际扩展界面重新生成。
