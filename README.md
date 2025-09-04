# Web-to-Markdown v2.0 🚀

[简体中文](https://github.com/Feiyt/web-to-markdown/blob/main/readme-zh.md)

**Summary:**
This enhanced Tampermonkey userscript (v2.0) intelligently converts webpage content into Markdown format with advanced page type detection and layout preservation. It features smart content selection, platform-specific optimization, and maintains the original webpage's formatting consistency.

## ✨ Key Features

### 🧠 Intelligent Page Type Detection
- **Auto-detection**: Automatically identifies page types (GitHub, Zhihu, Juejin, CSDN, WeChat articles, technical docs, news, etc.)
- **Dynamic Menu**: Menu options adapt based on detected page type (e.g., "Convert GitHub Repository to Markdown")
- **Type-specific Processing**: Uses optimized selectors and cleaning rules for each platform

### 🎯 Enhanced Content Selection
- **Priority-based Selectors**: Uses page-type-specific selectors for precise content extraction
- **Smart Scoring System**: Evaluates content quality to select the best container
- **Multi-level Fallback**: Automatically tries alternative selectors when primary ones fail

### 📋 Rich Metadata Integration
- **Auto-generated Headers**: Includes page title, URL, conversion date, author info
- **Platform-specific Info**: Adds repository stars for GitHub, publish time for WeChat, etc.
- **Structured Metadata**: Beautiful Markdown formatting for page information

### 🎨 Layout Preservation
- **Enhanced Turndown Rules**: Improved paragraph handling, line breaks, formatting elements
- **Typography Support**: Strikethrough, underline, superscript, subscript, highlights
- **HTML Element Preservation**: Maintains specific HTML tags when needed (kbd, small, etc.)

### 🛠 Platform-specific Optimization
- **GitHub**: Repository info, star counts, issue numbers, code file handling
- **Zhihu**: Question titles, answer structure optimization
- **Juejin/CSDN**: Article categories, technical tags
- **WeChat**: Publisher info, article metadata
- **Technical Docs**: Documentation structure, table of contents

### 📁 Smart File Naming
- **Type Prefixes**: Adds platform-specific prefixes (e.g., "GitHub_", "知乎_")
- **Special Handling**: 
  - GitHub code files: `GitHub_Code_filename.md`
  - GitHub Issues: `GitHub_Issue_123_title.md`
  - Repository READMEs: `GitHub_owner_repo_README.md`

### 💫 Enhanced User Experience
- **Beautiful Notifications**: Animated download success messages with page type info
- **Better Error Handling**: Friendly error messages and solution suggestions
- **Content Quality Checks**: Warns about short content or potential conversion issues

## 🔧 Technical Implementation

**Core Architecture:**

*   **Metadata Block (`// ==UserScript==`):** Defines script name, version (2.0), description, dependencies (`turndown`, `turndown-plugin-gfm`), and necessary `GM_*` functions.
*   **Page Type Detection (`detectPageType()`):** Analyzes URL, title, and meta description to identify platform and content type.
*   **Smart Content Selection (`getContentSelectors()`):** Returns priority-ordered selectors based on detected page type.
*   **Enhanced Content Node (`getPageContentNode()`):** 
    *   Uses type-specific selectors for precise content extraction
    *   Implements intelligent scoring system for content quality assessment
    *   Applies multi-stage cleaning with platform-specific rules
*   **Metadata Generation (`getPageMetadata()`):** Creates structured page information including platform-specific details.
*   **Layout Preservation (`enhanceTurndownService()`):** Configures advanced Turndown rules for better formatting retention.
*   **Post-processing (`postProcessMarkdown()`):** Optimizes final Markdown with format cleanup and consistency improvements.
*   **Smart Download (`convertAndDownload()`):**
    *   Generates type-appropriate filenames
    *   Handles download failures gracefully with multiple fallback methods
    *   Provides rich user feedback with notifications

## 🌐 Supported Platforms

| Platform | Icon | Special Features |
|----------|------|------------------|
| GitHub Repository | 📦 | Repository info, star counts, contributor details |
| GitHub Code Files | 💻 | File path recognition, language detection |
| GitHub Issues | 🐛 | Issue numbers, status tracking |
| WeChat Articles | 💬 | Publish time, author information |
| Zhihu Content | 🤔 | Question titles, answer structure |
| Juejin Articles | 💎 | Article categories, technical tags |
| CSDN Blogs | 🔧 | Blog categories, technical classifications |
| Technical Docs | 📚 | Documentation structure, navigation |
| News Articles | 📰 | Publication time, source information |
| Blog Posts | 📝 | Author details, category information |
| General Webpages | 🌐 | Basic information extraction |

**Download:**  https://greasyfork.org/zh-CN/scripts/532670-webpage-to-markdown<br>  

![image](https://github.com/user-attachments/assets/50300a48-a91d-4d24-a3f8-7f66ef076bf9)  

## 📖 How to Use

1.  Ensure you have the Tampermonkey (or compatible) browser extension installed.
2.  Install this userscript (v2.0) from the download link above.
3.  Navigate to any webpage you want to convert.
4.  Click the Tampermonkey icon in your browser toolbar.
5.  Select the dynamically generated option (e.g., "🔧 Convert CSDN Article to Markdown (v2.0 Enhanced)").
6.  The script will automatically detect the page type and convert accordingly.
7.  Your browser will download the Markdown file with an appropriate filename.

## 🔧 Advanced Settings

### Tampermonkey Download Configuration

**If the `.md` file download fails:**
1. Go to Tampermonkey Dashboard → Settings tab
2. Change "Config mode" from "Beginner" to "Advanced"
3. Scroll down to "Downloads BETA" section
4. In "Whitelisted File Extensions" box, add `*.md` on a new line
5. Click "Save" and refresh the page

**Alternative: Use Built-in Fallback**
- The script automatically falls back to browser download if Tampermonkey download fails
- No configuration required - just click "OK" when prompted

## 🆕 What's New in v2.0

### Major Improvements
- ✅ **Smart Page Detection**: Automatically identifies 11+ platform types
- ✅ **Enhanced Content Extraction**: 80+ specialized selectors for different platforms
- ✅ **Rich Metadata**: Auto-generated page information with platform-specific details
- ✅ **Better Typography**: Support for advanced formatting (strikethrough, superscript, etc.)
- ✅ **Intelligent File Naming**: Platform-aware filename generation
- ✅ **Improved Error Handling**: Graceful fallbacks and user-friendly messages
- ✅ **Quality Assurance**: Content validation and conversion quality metrics

### Platform Support Expansion
- 🔥 **GitHub**: Full support for repositories, code files, issues, and documentation
- 🔥 **Chinese Platforms**: Optimized for Zhihu, Juejin, CSDN, WeChat articles
- 🔥 **Technical Sites**: Enhanced support for documentation and tutorial sites
- 🔥 **News & Blogs**: Better extraction for news articles and blog posts

## ⚠️ Important Notes

1.  **Content Accuracy**: This script provides intelligent content conversion but cannot guarantee 100% accuracy. Please review the converted content yourself.

2.  **Copyright Compliance**: Do not use this script to download copyrighted or paid content without permission. The author assumes no responsibility for copyright violations. Please respect intellectual property rights.

3.  **Platform Limitations**: While the script supports many platforms, some websites may have unique structures that require manual adjustment.

4.  **Browser Compatibility**: Tested with Chrome, Firefox, and Edge. Requires Tampermonkey or compatible userscript manager.

## 🔄 Version History

- **v2.0** (Current): Intelligent page detection, enhanced platform support, rich metadata
- **v2.0**: Improved content selection, better error handling, enhanced notifications  
- **v1.0**: Basic webpage to Markdown conversion

---

**Made with ❤️ for the developer community**
