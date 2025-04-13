## 网页转Markdown 用户脚本 (v1.0)

**简介:**
这是一个 Tampermonkey 用户脚本 (v1.0)，用于将网页的主要内容转换为 Markdown 格式。它包含用于选择相关内容区域的逻辑，旨在减少导航、页脚、广告等无关元素，以获得更整洁的输出。

**代码概览:**

*   **元数据块 (`// ==UserScript==`):** 定义脚本名称 ("Webpage to Markdown")、版本 (1.0)、描述、依赖库 (`turndown`, `turndown-plugin-gfm`) 以及所需的 `GM_*` 函数 (`GM_registerMenuCommand`, `GM_download`)。
*   **配置 (`turndownOptions`):** 设置 Turndown 库的选项，用于控制 Markdown 输出样式。
*   **`sanitizeFilename()`:** 辅助函数，根据页面标题生成合法的文件名。
*   **`getPageContentNode()`:** 尝试使用常见的选择器（例如 `article`, `main`, `.post-content`）查找主要内容容器。它会克隆找到的最佳候选项，并在转换前移除常见的无关元素。如果找不到特定容器，则回退到使用 `document.body`。
*   **`convertAndDownload()`:**
    *   初始化 `TurndownService`，应用 GFM 插件和自定义数学公式规则。
    *   调用 `getPageContentNode()` 获取清理后的内容节点。
    *   将节点的 HTML 转换为 Markdown。
    *   调用 `GM_download` 提示用户保存生成的 `.md` 文件。
*   **菜单命令注册:** 使用 `GM_registerMenuCommand` 在 Tampermonkey 菜单中添加一个执行脚本的选项（“Convert Page to Markdown (v1.0)”）。

**下载:**
 https://greasyfork.org/zh-CN/scripts/532670-webpage-to-markdown<br>  

![image](https://github.com/user-attachments/assets/50300a48-a91d-4d24-a3f8-7f66ef076bf9)

**使用方法:**

1.  确保已安装 Tampermonkey (或兼容的) 浏览器扩展。
2.  安装此用户脚本 (v1.0)。
3.  访问您想要转换的网页。
4.  点击浏览器工具栏中的 Tampermonkey 图标。
5.  从菜单中选择 “**Convert Page to Markdown (v1.0)**”。
6.  浏览器应弹出对话框，提示您保存 Markdown (`.md`) 文件。

**问题排查提示:**

*   **如果无法下载 `.md` 文件：** 进入 Tampermonkey (油猴) 的“管理面板” -> “设置”选项卡。将“配置模式”从“新手”改为“高级”。向下滚动到“下载 BETA”部分。在“文件扩展名白名单”输入框中，单独添加一行 `.md`。点击“保存”。

**注意事项 (P.S.):**

1.  本脚本仅为简单的网页转 Markdown 文本工具，无法完全保证转换后的文件内容无信息缺漏。请自行核对。
2.  不建议使用本脚本转换或下载受版权保护的付费内容。若您使用本脚本获取付费内容而产生任何版权纠纷或法律问题，脚本作者概不负责。请尊重版权。
