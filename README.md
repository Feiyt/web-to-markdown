# Webpage to Markdown v3.0

🚀 **一键将任意网页转换为干净、格式规范的 Markdown。**

这是一个浏览器用户脚本，能智能识别并提取网页正文，处理代码块与数学公式，生成可直接用于 Obsidian、Notion 或 Hugo 的 Markdown 文件。

## 📦 安装

1. 安装油猴管理器：**Tampermonkey** (推荐) 或 Violentmonkey。
2. 添加脚本：在管理器中新建脚本并粘贴 `Webpage to Markdown.js` 的内容。

## 🛠️ 使用方法

1. 打开任意文章或博客页面。
2. 点击浏览器扩展栏的脚本管理器图标。
3. 选择 **"🔄 Convert Page to Markdown"**。
4. 文件将自动以 `标题_日期.md` 格式下载。

## ⚙️ 配置 (Tampermonkey)

为避免浏览器每次询问下载权限：
1. 打开 Tampermonkey 管理面板 -> **设置**。
2. 将 "配置模式" 改为 **高级**。
3. 找到 **下载 BETA**，在 "白名单文件扩展名" 中添加 `.md` (或 `^.*\.md$`)。
4. 保存设置。

## 📄 License

MIT License © 2026 Feiyt
