// ==UserScript==
// @name         Webpage to Markdown
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Advanced webpage to Markdown converter with intelligent content extraction, image handling, and code block formatting.
// @author       Feiyt
// @homepageURL  https://github.com/Feiyt
// @license      MIT
// @match        *://*/*
// @require      https://unpkg.com/turndown@7.2.0/dist/turndown.js
// @require      https://unpkg.com/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

// Copyright (c) 2025 Feiyt
// Released under the MIT license
// https://github.com/Feiyt (or specify the exact repo if available)

(function() {
    'use strict';
    console.log("Enhanced Webpage to Markdown script starting..."); // Version updated

    // --- Configuration ---
    const turndownOptions = {
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '*',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
        preformattedCode: false,
        blankReplacement: function(content, node) {
            return node.isBlock ? '\n\n' : '';
        },
        keepReplacement: function(content, node) {
            return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML;
        },
        defaultReplacement: function(content, node) {
            return node.isBlock ? '\n\n' + content + '\n\n' : content;
        }
    };


    // --- Helper Functions ---
    const DEBUG_MODE = false;

    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }

    function sanitizeFilename(name) {
        return String(name ?? '').replace(/[\\/:*?"<>|#%\n\r]/g, '_').replace(/\s+/g, ' ').trim() || 'markdown_export';
    }

    function escapeMarkdownText(value) {
        return String(value ?? '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
    }

    function escapeMarkdownUrl(value) {
        return String(value ?? '').replace(/[\\\s"'<>()[\]]/g, character => `\\${character}`);
    }

    function escapeYamlString(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, '\\n');
    }

    function toAbsoluteUrl(url, baseUrl = window.location.href) {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (url.startsWith('data:')) return url;

        try {
            return new URL(url, baseUrl).href;
        } catch (error) {
            debugLog('Unable to resolve URL:', url, error);
            return '';
        }
    }

    function selectSrcsetCandidate(srcset) {
        if (!srcset || typeof srcset !== 'string') return '';

        const candidates = srcset.split(',').map(part => {
            const pieces = part.trim().split(/\s+/);
            const descriptor = pieces[1] || '';
            const value = descriptor.endsWith('w')
                ? Number.parseInt(descriptor, 10)
                : descriptor.endsWith('x')
                    ? Number.parseFloat(descriptor) * 1000
                    : 0;
            return { url: pieces[0], value: Number.isFinite(value) ? value : 0 };
        }).filter(candidate => candidate.url && !candidate.url.startsWith('data:'));

        return candidates.sort((left, right) => right.value - left.value)[0]?.url || '';
    }

    function resolveImageSource(img) {
        if (!img || !img.getAttribute) return '';

        const candidateSources = [
            img.getAttribute('data-src'),
            img.getAttribute('data-original'),
            img.getAttribute('data-origin'),
            img.getAttribute('data-actualsrc'),
            img.getAttribute('data-lazy-src'),
            img.getAttribute('data-url'),
            img.getAttribute('data-image'),
            img.getAttribute('src'),
            img.getAttribute('srcset')
        ];

        const firstValid = candidateSources.find(source => {
            if (!source) return false;
            const value = source.trim();
            return value.length > 0 && !value.startsWith('data:');
        });

        if (!firstValid) {
            return '';
        }

        const source = firstValid.includes(',')
            ? selectSrcsetCandidate(firstValid)
            : firstValid;
        return toAbsoluteUrl(source);
    }

    /**
     * Improved content selection and cleaning.
     * Prioritizes semantic tags and common content IDs/classes.
     * @returns {object|null} Object containing { title: string, contentNode: Node } or null on failure.
     */
    function getPageContentNode() {
        debugLog("getPageContentNode: Starting content retrieval...");
        
        // 1. 获取页面标题
        let pageTitle = document.title;
        // 尝试从常见标题元素获取更准确的标题
        const potentialTitles = [
            document.querySelector('h1.entry-title'),
            document.querySelector('h1.post-title'),
            document.querySelector('h1.article-title'),
            document.querySelector('.article-title'),
            document.querySelector('h1')
        ];
        
        for (const t of potentialTitles) {
            if (t && t.textContent && t.textContent.trim().length > 5) {
                pageTitle = t.textContent.trim();
                break;
            }
        }
        pageTitle = pageTitle || window.location.hostname;

        let bestCandidate = null;
        let maxScore = -1;

        // 辅助函数：计算元素分数
        function calculateScore(element) {
            let score = 0;
            
            // 基础标签分
            const tagName = element.tagName.toLowerCase();
            if (['article', 'main'].includes(tagName)) score += 20;
            if (['div', 'section'].includes(tagName)) score += 5;
            
            // 类名和ID加减分
            const classAndId = (element.className + " " + element.id).toLowerCase();
            
            // 加分关键词
            if (/(article|body|content|entry|hentry|main|page|pagination|post|text|blog|story)/.test(classAndId)) score += 25;
            if (/(markdown|wiki|documentation|readme)/.test(classAndId)) score += 30;
            
            // 减分关键词
            if (/(copyright|combx|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-|agegate|pagination|pager|popup|tweet|twitter)/.test(classAndId)) score -= 50;
            
            // 内容质量评估
            const textContent = element.textContent.trim();
            const textLength = textContent.length;
            
            if (textLength < 20) return -9999; // 忽略太短的内容
            
            // 文本密度算分 (对数增长)
            score += Math.min(Math.log(textLength) * 10, 100);
            
            // 子元素统计
            const paragraphs = element.querySelectorAll('p');
            const links = element.querySelectorAll('a');
            const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const paragraphCount = paragraphs.length;
            const headingsCount = headings.length;
            
            score += paragraphCount * 3; // 段落多通常是正文
            score += headingsCount * 5; // 有标题结构加分
            
            // 链接密度惩罚
            const linkTextLength = Array.from(links).reduce((acc, a) => acc + a.textContent.length, 0);
            const linkDensity = linkTextLength / Math.max(textLength, 1);
            
            if (linkDensity > 0.5) score -= 50; // 链接内容占比过高可能是导航
            if (linkDensity > 0.8) score -= 100;
            
            return score;
        }

        // More robust selectors with priorities implied by order
        const selectors = [
             // Highest Priority: Semantic & Specific Roles/IDs/Classes
            'article', '[role="article"]', '.article-body', '.post-content', '.entry-content', '#article-content', '.post-body', '.markdown-body',
            // High Priority: Main content areas
            'main', '[role="main"]', '#main-content', '#main', '.main-content', '.main', '#primary',
            // Specific Platforms
            '.notion-page-content', '.zhihu-content', '.daily-content.body', '#js_content',
            // Medium Priority: Common generic containers
            '#content', '.content',
            // News & Blogs
            '.news-article', '.story-body', '.blog-post',
            // Fallbacks
            'body'
        ];
        
        // 尝试查找最佳候选
        // 首先尝试常用的高优先级选择器
        let candidates = document.querySelectorAll(selectors.join(','));
        // 如果候选太少，尝试宽泛搜索
        if (candidates.length < 1) {
            candidates = document.querySelectorAll('div, section, article, main');
        }

        candidates.forEach(element => {
            // 排除明显的非内容元素
            if (['header', 'footer', 'nav', 'aside'].includes(element.tagName.toLowerCase())) return;
            // 排除隐藏元素
            if (element.offsetParent === null) return;

            const score = calculateScore(element);
            // console.log(`Candidate: <${element.tagName} class="${element.className}" id="${element.id}"> score: ${score}`);
            
            if (score > maxScore) {
                maxScore = score;
                bestCandidate = element;
            }
        });

        if (!bestCandidate) {
             console.warn("No suitable candidate found. Fallback to body.");
             bestCandidate = document.body;
        }
        
        debugLog(`Selected final container: <${bestCandidate.tagName.toLowerCase()} class="${bestCandidate.className}" id="${bestCandidate.id}"> with score ${maxScore}`);

        // --- Clone and Clean ---
        try {
            debugLog("Cloning selected container...");
            const clone = bestCandidate.cloneNode(true);

            // Define selectors for elements to exclude from the conversion.
            const excludeSelectors = [
                // 页面结构元素
                'header', 'footer', 'nav', '.header', '.footer', '.navbar', '.menu', '.toc', '#toc', 
                '.breadcrumb', '#breadcrumb', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
                'aside', '.sidebar', '#sidebar', '.widget-area', '#secondary', '.left-column', '.right-column',
                '[role="complementary"]',
                
                // 交互和操作元素
                '.actions', '.share', '.social', '.buttons', '.post-meta', '.entry-meta', 
                '.feedback', '.related-posts', '.like-button-container', '.feedback-container',
                '.edit-link', '.print-link', '[role="search"]', '.search', '.search-form',
                '.login', '.register', '.signup', '.signin', '.auth-form',
                
                // 评论系统
                '#comments', '.comments', '.comment-section', '#respond', '.disqus',
                '.livefyre', '.facebook-comments', '.giscus', '.utterances',
                
                // 广告和推广
                '.ad', '.ads', '.advertisement', '.adsbygoogle', '[id*="ad-"]', '[class*="ad-"]', 
                '[class*="advert"]', '.sponsored', '.promoted', '.promo', '.banner-ad',
                '.google-ad', '.adsense', '.doubleclick', '.outbrain', '.taboola',
                
                // 弹窗和模态框
                '.popup', '.modal', '.overlay', '.lightbox', '.dialog', '.tooltip',
                '.cookie-banner', '.cookie-consent', '.tracking-consent', '.gdpr-notice',
                '.newsletter-popup', '.subscription-modal', '.survey', '.feedback-form',
                
                // 技术元素
                'script:not([type^="math/tex"])', 'style', 'noscript', 'template', 'link[rel="stylesheet"]', 'meta', 
                'input[type="hidden"]', '.visually-hidden', '.sr-only', '[aria-hidden="true"]',
                '.hidden', '.invisible', '.offscreen', 'iframe[src*="ads"]', 'iframe[src*="tracking"]',
                
                // 相关和推荐内容
                '.related-articles', '#related-articles', '.related_posts', '.related-content',
                '.recommended', '.suggestions', '.more-stories', '.you-might-like',
                '.trending', '.popular', '.most-read', '.external-links',
                
                // 导航和分页
                '.pagination', '.pager', '.page-nav', '.next-prev', '.post-navigation',
                '.tag-list', '.category-list', '.archive-list', '.recent-posts',
                
                // 表单元素
                'form:not(.content form)', '.form', '.newsletter', '.subscription',
                '.contact-form', '.feedback-form', 'input', 'textarea', 'select', 'button:not(.content button)',
                
                // 特定平台噪音
                '.csdn-side-toolbar', '.tool-box', '.reward-user', '.p-ext'
            ];

            // 一次查询移除干扰元素，避免对每个选择器重复遍历 DOM。
            clone.querySelectorAll(excludeSelectors.join(',')).forEach(el => el.remove());

            // 移除空元素。先标记媒体祖先，避免每个节点重复查询后代媒体。
            const allElements = clone.querySelectorAll('*');
            const mediaAncestors = new Set();
            clone.querySelectorAll('img, video, iframe, svg, canvas, picture, figure').forEach(media => {
                let ancestor = media.parentElement;
                while (ancestor && ancestor !== clone) {
                    mediaAncestors.add(ancestor);
                    ancestor = ancestor.parentElement;
                }
            });
            allElements.forEach(el => {
                if (el.matches('img, video, iframe, svg, canvas, picture, figure')) {
                    return;
                }

                if (!mediaAncestors.has(el) && el.textContent.trim() === '') {
                    el.remove();
                }
            });

            // 规范化链接并移除 javascript 链接。
            const links = clone.querySelectorAll('a');
            links.forEach(a => {
                const href = a.getAttribute('href') || '';
                if (href.trim().toLowerCase().startsWith('javascript:')) {
                    a.replaceWith(...Array.from(a.childNodes));
                    return;
                }
                if (href && !href.startsWith('#')) {
                    const absoluteHref = toAbsoluteUrl(href);
                    if (absoluteHref) a.setAttribute('href', absoluteHref);
                }
            });
            // 处理图片的 src（统一封装为 helper，减少重复逻辑）
            const images = clone.querySelectorAll('img');
            images.forEach(img => {
                const realSrc = resolveImageSource(img);
                if (!realSrc) return;

                img.src = realSrc;
                img.setAttribute('src', realSrc);
            });

            // 额外处理：Picture 标签
            // 如果 img 被包裹在 picture 中，Turndown 可能处理不好 source，我们需要把 source 的 srcset 赋给 img
            const pictures = clone.querySelectorAll('picture');
            pictures.forEach(pic => {
                const img = pic.querySelector('img');
                const source = pic.querySelector('source');
                if (img && source && source.srcset) {
                     const selectedSource = toAbsoluteUrl(selectSrcsetCandidate(source.srcset));
                     if (selectedSource) {
                         img.src = selectedSource;
                         img.setAttribute('src', selectedSource);
                     }
                }
            });

            // --- 智能尾部截断 (Smart Truncation) ---
            // 很多页面在正文结束后会有"推荐阅读"、"相关文章"等区域，这些往往在容器内部但不是正文
            // 我们尝试识别这些分割点，并移除其后的所有内容
            const endMarkers = [
                '推荐阅读', '相关推荐', '相关文章', '猜你喜欢', '原文链接', 
                '更多精彩', '文章目录', 'Next Article', 'Previous Article'
            ];
            
            // 遍历一级子元素寻找截断点
            let cutoffFound = false;
            const children = Array.from(clone.children);
            
            for (const child of children) {
                if (cutoffFound) {
                    child.remove();
                    continue;
                }
                
                // 检查是否是分割线或特定标题
                const text = child.textContent.trim();
                const isHeading = /^h[1-6]$/i.test(child.tagName) || child.classList.contains('title') || child.classList.contains('header');
                
                // 1. 明确的分割线后跟"推荐"字样
                if (child.tagName === 'HR') {
                    const next = child.nextElementSibling;
                    const nextIsHeading = next && (/^h[1-6]$/i.test(next.tagName) ||
                        next.classList.contains('title') || next.classList.contains('header'));
                    if (nextIsHeading && next.textContent.trim().length < 40 &&
                        endMarkers.some(m => next.textContent.includes(m))) {
                        child.remove(); // 移除HR
                        cutoffFound = true; // 标记后续全部移除
                        continue;
                    }
                }
                
                // 2. 包含特定关键词的标题
                if (isHeading && endMarkers.some(m => text === m || (text.length < 10 && text.includes(m)))) {
                    console.log(`Smart truncation triggered by marker: "${text}"`);
                    child.remove();
                    cutoffFound = true;
                }
                
                // 3. 特定的结束类名结构
                if (child.matches('.related, .recommend, .comments, .share-block, .article-footer')) {
                     console.log(`Smart truncation triggered by class: "${child.className}"`);
                     child.remove();
                     cutoffFound = true;
                }
            }

            return { title: pageTitle, contentNode: clone };


        } catch (error) {
            console.error("Critical error during cloning or cleaning:", error.message, error.stack);
            return null;
        }
    }

    /**
     * 后处理Markdown内容，清理和优化格式
     * @param {string} markdown - 原始markdown内容
     * @returns {string} 优化后的markdown内容
     */
    function postProcessMarkdown(markdown) {
        debugLog("Post-processing Markdown content...");
        
        if (!markdown || typeof markdown !== 'string') {
            console.warn("Invalid markdown content for post-processing");
            return markdown || '';
        }
        
        const processText = text => {
            let processedText = text;
        
            // 1. 清理多余的空行（超过2个连续空行压缩为2个）
            processedText = processedText.replace(/\n\s*\n\s*\n/g, '\n\n');
        
            // 2. 修复列表格式
            processedText = processedText.replace(/\n(\s*[\*\-\+])/g, '\n\n$1');
            processedText = processedText.replace(/(\n\s*[\*\-\+].*)\n([^\n\s\*\-\+])/g, '$1\n\n$2');
        
            // 3. 修复标题前后的空行
            processedText = processedText.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
            processedText = processedText.replace(/(#{1,6}.*)\n([^\n#\s])/g, '$1\n\n$2');
        
            // 4. 清理链接中的多余空格
            processedText = processedText.replace(/\[\s+([^\]]*?)\s+\]/g, '[$1]');
            processedText = processedText.replace(/\(\s+([^\)]*?)\s+\)/g, '($1)');
        
            // 5. 修复代码块格式
            processedText = processedText.replace(/([^\n])\n```/g, '$1\n\n```');
            processedText = processedText.replace(/```\n([^\n])/g, '```\n\n$1');
        
            // 6. 清理引用块格式
            processedText = processedText.replace(/([^\n])\n>/g, '$1\n\n>');
            processedText = processedText.replace(/>\s*\n\n>/g, '>\n>');
            return processedText;
        };

        // 只处理普通文本，保护 fenced code block 内的源码。
        let processed = markdown.split(/(```[\s\S]*?```)/g)
            .map((part, index) => index % 2 === 1 ? part : processText(part))
            .join('');
        
        // 7. (已移除) 移除孤立的HTML标签残留 
        // 这一步过于激进，会破坏 <details> 折叠块和未被 Turndown 转换的合法 HTML 元素
        // processed = processed.replace(/<\/?[^>]+(>|$)/g, '');
        
        // 8. 清理开头和结尾的多余空行
        processed = processed.trim();
        
        // 9. 确保文档以单个换行符结尾
        if (processed && !processed.endsWith('\n')) {
            processed += '\n';
        }
        
        debugLog("Markdown post-processing completed");
        return processed;
    }

    // --- Main Conversion and Download Logic ---
    function convertAndDownload() {
        console.log("Convert to Markdown: Button clicked..."); // Version updated
        try {
            // --- Initialize Turndown, Apply GFM, Add Math Rule ---
             console.log("Initializing TurndownService...");
             if (typeof TurndownService === 'undefined') { throw new Error('TurndownService is not defined.'); }
             const turndownService = new TurndownService(turndownOptions);

             console.log("Applying GFM plugin...");
             if (typeof turndownPluginGfm !== 'undefined' && typeof turndownPluginGfm.gfm === 'function') {
                  try {
                      turndownService.use(turndownPluginGfm.gfm);
                      console.log("GFM applied.");
                    }
                  catch (gfmError) { console.error("Error applying GFM plugin:", gfmError); }
             } else { console.warn("GFM plugin not loaded."); }

            // Define and Add Math Rule (for KaTeX/MathJax)
            const mathRule = {}; // Simplified for brevity, keep full logic from previous step
             mathRule.filter = function (node, options) {
                 try {
                     return (
                         (node.nodeName === 'SPAN' && (node.classList.contains('katex') || node.classList.contains('MathJax_Preview'))) ||
                         (node.nodeName === 'DIV' && node.classList.contains('katex-display')) ||
                         (node.nodeName === 'MATH' && node.hasAttribute('alttext')) ||
                         (node.nodeName === 'SCRIPT' && node.getAttribute('type')?.startsWith('math/tex')) ||
                         (node.getAttribute('role') === 'math')
                     );
                 } catch (filterError) { console.error("Error inside MathJax filter function:", filterError, "Node:", node); return false; }
             };
             mathRule.replacement = function (content, node, options) {
                 let latex = '', delimiter = '$';
                 try {
                     if (node.nodeName === 'SCRIPT') {
                         latex = node.textContent || '';
                         if (node.getAttribute('type')?.includes('mode=display') || latex.trim().startsWith('\\display')) { delimiter = '$$'; }
                     } else if (node.dataset && node.dataset.originalLatex) {
                         latex = node.dataset.originalLatex;
                         if (node.classList.contains('katex-display') || node.closest('.MathJax_Display')) { delimiter = '$$'; }
                     } else if (node.getAttribute('aria-label')) {
                         latex = node.getAttribute('aria-label');
                          if (node.nodeName === 'DIV' || node.classList.contains('katex-display') || node.closest('.MathJax_Display')) { delimiter = '$$'; }
                     } else if (node.classList.contains('katex')) {
                         const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
                         if (annotation) {
                             latex = annotation.textContent || '';
                             if (node.classList.contains('katex-display')) { delimiter = '$$'; }
                         }
                     } else if (node.nodeName === 'MATH' && node.getAttribute('alttext')) {
                         latex = node.getAttribute('alttext');
                         if (node.getAttribute('display') === 'block') { delimiter = '$$'; }
                     }
                     if (latex) {
                         latex = latex.trim();
                         if ((latex.startsWith('$$') && latex.endsWith('$$')) || (latex.startsWith('$') && latex.endsWith('$') && !latex.startsWith('$$'))) { return latex; }
                         return `${delimiter}${latex}${delimiter}`;
                     }
                     return '';
                 } catch (ruleError) { console.error("Error processing math rule replacement for node:", node, ruleError); return ''; }
             };

            try {
                console.log("Adding Math rule...");
                if (typeof mathRule.filter !== 'function') { throw new Error("Math rule filter is not a function!"); }
                turndownService.addRule('mathjaxKatex', mathRule);
                console.log("Math rule added.");
            } catch (addRuleError) { console.error("Failed to add Math rule:", addRuleError); }

            // 添加图片处理规则
            turndownService.addRule('images', {
                filter: 'img',
                replacement: function(content, node) {
                    const alt = node.getAttribute('alt') || '';
                    const candidateSources = [
                        node.getAttribute('data-src'),
                        node.getAttribute('data-original'),
                        node.getAttribute('data-origin'),
                        node.getAttribute('data-actualsrc'),
                        node.getAttribute('data-lazy-src'),
                        node.getAttribute('data-url'),
                        node.getAttribute('data-image'),
                        node.getAttribute('src'),
                        node.getAttribute('srcset')
                    ].filter(Boolean);

                    let rawSrc = '';
                    for (const source of candidateSources) {
                        if (!source || source.trim().length === 0 || source.startsWith('data:')) continue;
                        rawSrc = source.trim();
                        if (source.includes(',')) rawSrc = selectSrcsetCandidate(source);
                        break;
                    }

                    const title = node.getAttribute('title')
                        ? ` "${node.getAttribute('title').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
                        : '';
                    if (!rawSrc)                     return alt ? `[${escapeMarkdownText(alt)}]` : '';

                    const fullSrc = toAbsoluteUrl(rawSrc);
                    if (!fullSrc) return alt ? `[${escapeMarkdownText(alt)}]` : '';

                    return `![${escapeMarkdownText(alt)}](${escapeMarkdownUrl(fullSrc)}${title})`;
                }
            });

            // 添加代码块处理规则
            turndownService.addRule('codeBlocks', {
                filter: ['pre'],
                replacement: function(content, node) {
                    // 获取语言标识
                    let language = '';
                    const codeLabel = node.querySelector('code');
                    if (codeLabel) {
                        language = (codeLabel.className.match(/language-([^\s]+)/) || 
                                  codeLabel.className.match(/lang-([^\s]+)/) ||
                                  [])[1] || '';
                    }
                    if (!language) {
                         language = (node.className.match(/language-([^\s]+)/) || 
                                   node.className.match(/lang-([^\s]+)/) ||
                                   [])[1] || '';
                    }

                    // 克隆节点以进行清理，避免影响页面
                    const clone = node.cloneNode(true);
                    
                    // 清理常见干扰元素 (行号、按钮、折叠遮罩等)
                    const trashSelectors = [
                        '.pre-numbering', '.hljs-button', '.signin', 
                        '.hide-preCode-box', '.code-hide-box', '.copy-btn', 
                        'div[onclick]', 'ul.pre-numbering', '.code-lines'
                    ];
                    
                    trashSelectors.forEach(sel => {
                        const trash = clone.querySelectorAll(sel);
                        trash.forEach(el => el.remove());
                    });

                    // 提取代码文本 - 优先取 code 标签，否则取 pre
                    const codeEl = clone.querySelector('code') || clone;
                    
                    // 处理换行：将 <br> 替换为换行符
                    codeEl.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                    
                    // 尝试获取文本
                    // innerText 在某些并未渲染的 clone 节点上可能失效，稳妥起见结合使用
                    // 对于 <pre><code>...</code></pre> 结构，textContent 通常包含源码换行
                    let codeText = codeEl.textContent || '';
                    
                    return '\n\n```' + language + '\n' + codeText.replace(/^\n|\n$/g, '') + '\n```\n\n';
                }
            });

            // 添加Details/Summary折叠块处理
            turndownService.addRule('details', {
                filter: 'details',
                replacement: function(content, node) {
                    const summary = node.querySelector('summary');
                    const summaryText = summary ? summary.textContent.trim() : 'Details';
                    // 尝试提取 summary 之后的内容
                    // 简单清洗：移除 content 中可能包含的 summary 文本重复（TURNDOWN 可能会把 summary 转成 markdown 放在 content 开头）
                    // 更好的方式是保留 HTML 结构，兼容性好
                    const summaryMarkdown = summary ? turndownService.turndown(summary).trim() : '';
                    const body = summaryMarkdown && content.trim().startsWith(summaryMarkdown)
                        ? content.trim().slice(summaryMarkdown.length).trim()
                        : content.trim();
                    return '\n\n<details>\n<summary>' + escapeMarkdownText(summaryText) + '</summary>\n\n' + body + '\n\n</details>\n\n';
                }
            });

            // 添加表格处理规则（增强）
            turndownService.addRule('tables', {
                filter: 'table',
                replacement: function(content, node) {
                    const rows = Array.from(node.querySelectorAll('tr'));
                    if (rows.length === 0) return content;
                    
                    let markdown = '\n\n';
                    const headerIndex = rows.findIndex(row => row.querySelector('th')) >= 0
                        ? rows.findIndex(row => row.querySelector('th'))
                        : 0;
                    
                    rows.forEach((row, index) => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        if (cells.length === 0) return;
                        
                        const isHeader = index === headerIndex;
                        
                        const cellContents = cells.map(cell => {
                            return cell.textContent.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');
                        });
                        
                        markdown += '| ' + cellContents.join(' | ') + ' |\n';
                        
                        // 添加表头分隔行
                        if (isHeader && index === 0) {
                            markdown += '|' + ' --- |'.repeat(cells.length) + '\n';
                        }
                    });
                    
                    return markdown + '\n';
                }
            });

            // 添加引用块处理
            turndownService.addRule('blockquotes', {
                filter: 'blockquote',
                replacement: function(content, node) {
                    const cite = node.querySelector('cite');
                    const attribution = cite ? `\n\n— ${cite.textContent.trim()}` : '';
                    const citeText = cite ? cite.textContent.trim() : '';
                    const body = citeText ? content.replace(citeText, '').trim() : content.trim();
                    
                    return '\n\n> ' + body.replace(/\n/g, '\n> ') + attribution + '\n\n';
                }
            });

            // 添加视频处理规则
            turndownService.addRule('videos', {
                filter: ['video', 'iframe'],
                replacement: function(content, node) {
                    if (node.tagName === 'VIDEO') {
                        const src = toAbsoluteUrl(node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '');
                        const poster = toAbsoluteUrl(node.getAttribute('poster') || '');
                        const alt = node.getAttribute('alt') || 'Video';
                        
                        if (poster) {
                            return `[![${escapeMarkdownText(alt)}](${escapeMarkdownUrl(poster)})](${escapeMarkdownUrl(src)})`;
                        }
                        return `[${escapeMarkdownText(alt)}](${escapeMarkdownUrl(src)})`;
                    }
                    
                    if (node.tagName === 'IFRAME') {
                        const src = toAbsoluteUrl(node.getAttribute('src') || '');
                        const title = node.getAttribute('title') || 'Embedded content';
                        
                        // 检测YouTube等视频平台
                        if (src.includes('youtube.com') || src.includes('youtu.be')) {
                            const videoId = src.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/)?.[1];
                            if (videoId) {
                                return `\n\n[![YouTube Video](https://img.youtube.com/vi/${videoId}/0.jpg)](${escapeMarkdownUrl(src)})\n\n`;
                            }
                        }
                        
                        return `\n\n[${escapeMarkdownText(title)}](${escapeMarkdownUrl(src)})\n\n`;
                    }
                    
                    return content;
                }
            });

            // --- Perform Conversion ---
            debugLog("Getting page content node...");
            const pageData = getPageContentNode();

            if (!pageData || !pageData.contentNode) {
                 console.error("Failed to get valid page content node. Aborting.");
                 alert("Could not get a valid page content node for conversion.");
                 return;
            }
            debugLog(`Content node retrieved. Title: ${pageData.title}. Starting conversion...`);

            let markdownContent = '';
            try {
                markdownContent = turndownService.turndown(pageData.contentNode);
                debugLog("Markdown conversion complete. Applying post-processing...");
                
                // 应用后处理优化
                markdownContent = postProcessMarkdown(markdownContent);

                // --- Add Front Matter ---
                const now = new Date();
                const frontMatter = [
                    '---',
                    `title: "${escapeYamlString(pageData.title)}"`,
                    `url: "${escapeYamlString(window.location.href)}"`,
                    `date: "${now.toISOString()}"`,
                    `author: "${escapeYamlString(window.location.hostname)}"`,
                    '---',
                    '',
                    `# ${escapeMarkdownText(pageData.title.replace(/\r?\n/g, ' ').trim())}`,
                    '',
                    ''
                ].join('\n');
                
                markdownContent = frontMatter + markdownContent;
                
                debugLog("Final markdown processing completed.");
            } catch (convertError) {
                 console.error("Error during Turndown conversion:", convertError.message, convertError.stack);
                 alert(`Error during Markdown conversion: ${convertError.message}`);
                 return;
            }

            // 内容质量检查
            const finalLength = markdownContent.trim().length;
            const lineCount = markdownContent.split('\n').length;
            const wordCount = markdownContent.split(/\s+/).length;
            
            debugLog(`Conversion quality metrics: ${finalLength} chars, ${lineCount} lines, ~${wordCount} words`);

            if (!markdownContent || markdownContent.trim() === '') {
                 console.warn("Conversion resulted in empty Markdown content.");
                 alert("Warning: The converted Markdown content is empty. This might indicate that the page structure is not supported or contains mostly non-text content.");
                 return;
            }
            
            if (finalLength < 100) {
                const proceed = confirm(`Warning: The converted content is very short (${finalLength} characters). This might indicate incomplete conversion. Do you want to proceed with the download?`);
                if (!proceed) {
                    console.log("User chose to cancel due to short content length.");
                    return;
                }
            }

            // --- Prepare Filename & Download ---
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `${sanitizeFilename(pageData.title)}_${dateStr}.md`;
            
            /**
             * 尝试使用GM_download下载，失败时回退到浏览器下载
             */
            function downloadMarkdown(content, fileName) {
                debugLog(`Attempting to download ${fileName}...`);
                
                // 方法1: 尝试使用GM_download (Tampermonkey原生方法)
                if (typeof GM_download === 'function') {
                    const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
                    let released = false;
                    const releaseBlobUrl = () => {
                        if (!released) {
                            released = true;
                            URL.revokeObjectURL(blobUrl);
                        }
                    };
                    
                    try {
                        GM_download({
                            url: blobUrl,
                            name: fileName,
                            saveAs: true,
                            onload: () => {
                                releaseBlobUrl();
                                debugLog("Download completed successfully via GM_download");
                            },
                            onerror: (err) => {
                                releaseBlobUrl();
                                console.warn('GM_download failed:', err);
                                const errorCode = err?.error || 'unknown';
                            
                                if (errorCode === 'not_whitelisted') {
                                console.log("File extension not whitelisted. Attempting fallback download method...");
                                // 显示友好的提示信息
                                const userChoice = confirm(
                                    "🚫 Tampermonkey下载被阻止\n\n" +
                                    "原因：.md文件扩展名未在Tampermonkey白名单中\n\n" +
                                    "解决方案：\n" +
                                    "✅ 点击'确定' - 使用浏览器下载（推荐，无需设置）\n" +
                                    "⚙️ 点击'取消' - 查看详细设置指南\n\n" +
                                    "注意：浏览器下载功能完全正常，您可以放心使用！"
                                );
                                
                                if (userChoice) {
                                    console.log("User chose browser download method");
                                    fallbackDownload(content, fileName);
                                } else {
                                    console.log("User wants to see setup guide");
                                    // 提示用户查看主菜单中的设置指南
                                    setTimeout(() => {
                                        alert("请在Tampermonkey菜单中点击 '📥 Download Settings Guide' 查看详细设置说明");
                                    }, 100);
                                }
                                } else {
                                    console.error("GM_download error:", errorCode);
                                    // 其他错误也使用备用下载
                                    debugLog("Using fallback download due to GM_download error");
                                    fallbackDownload(content, fileName);
                                }
                            }
                        });
                    } catch (downloadError) {
                        releaseBlobUrl();
                        console.error("GM_download could not be started:", downloadError);
                        fallbackDownload(content, fileName);
                    }
                } else {
                    console.warn("GM_download not available, using fallback method");
                    fallbackDownload(content, fileName);
                }
            }
            
            /**
             * 备用下载方法：使用浏览器的下载API
             */
            function fallbackDownload(content, fileName) {
                console.log("Using fallback download method...");

                try {
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = fileName;
                    downloadLink.style.display = 'none';

                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);

                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    console.log("Fallback download initiated successfully");

                    const notification = document.createElement('div');
                    notification.style.position = 'fixed';
                    notification.style.top = '20px';
                    notification.style.right = '20px';
                    notification.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                    notification.style.color = 'white';
                    notification.style.padding = '16px 24px';
                    notification.style.borderRadius = '8px';
                    notification.style.zIndex = '10000';
                    notification.style.fontFamily = 'Segoe UI, Arial, sans-serif';
                    notification.style.fontSize = '14px';
                    notification.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                    notification.style.borderLeft = '4px solid #2e7d32';
                    notification.style.minWidth = '300px';
                    notification.style.animation = 'slideIn 0.3s ease-out';

                    const icon = document.createElement('div');
                    icon.textContent = '✅';
                    icon.style.fontSize = '20px';
                    icon.style.marginRight = '10px';
                    icon.style.display = 'inline-block';

                    const textWrap = document.createElement('div');
                    textWrap.style.display = 'flex';
                    textWrap.style.alignItems = 'center';

                    const msgWrap = document.createElement('div');
                    const title = document.createElement('div');
                    title.textContent = '下载成功！';
                    title.style.fontWeight = 'bold';
                    title.style.marginBottom = '4px';

                    const subtitle = document.createElement('div');
                    subtitle.textContent = `文件名: ${fileName}`;
                    subtitle.style.fontSize = '12px';
                    subtitle.style.opacity = '0.9';

                    msgWrap.appendChild(title);
                    msgWrap.appendChild(subtitle);
                    textWrap.appendChild(icon);
                    textWrap.appendChild(msgWrap);
                    notification.appendChild(textWrap);

                    if (!document.getElementById('download-notification-style')) {
                        const style = document.createElement('style');
                        style.id = 'download-notification-style';
                        style.textContent = `
                            @keyframes slideIn {
                                from { transform: translateX(100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                            @keyframes slideOut {
                                from { transform: translateX(0); opacity: 1; }
                                to { transform: translateX(100%); opacity: 0; }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    document.body.appendChild(notification);
                    setTimeout(() => {
                        notification.style.animation = 'slideOut 0.3s ease-in';
                        setTimeout(() => notification.remove(), 300);
                    }, 3000);
                } catch (fallbackError) {
                    console.error("Fallback download also failed:", fallbackError);

                    const overlay = document.createElement('div');
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.background = 'rgba(0,0,0,0.85)';
                    overlay.style.zIndex = '10000';
                    overlay.style.display = 'flex';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    overlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';

                    const panel = document.createElement('div');
                    panel.style.background = 'white';
                    panel.style.padding = '30px';
                    panel.style.borderRadius = '12px';
                    panel.style.maxWidth = '85%';
                    panel.style.maxHeight = '85%';
                    panel.style.overflow = 'hidden';
                    panel.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                    panel.style.display = 'flex';
                    panel.style.flexDirection = 'column';

                    const header = document.createElement('div');
                    header.style.marginBottom = '20px';

                    const heading = document.createElement('h2');
                    heading.textContent = '手动保存 Markdown 文件';
                    heading.style.color = '#333';
                    heading.style.margin = '0 0 10px 0';
                    heading.style.display = 'flex';
                    heading.style.alignItems = 'center';

                    const headingIcon = document.createElement('span');
                    headingIcon.textContent = '📋';
                    headingIcon.style.fontSize = '24px';
                    headingIcon.style.marginRight = '10px';
                    heading.appendChild(headingIcon);
                    heading.appendChild(document.createTextNode('手动保存 Markdown 文件'));
                    header.appendChild(heading);

                    const hint = document.createElement('p');
                    hint.textContent = '自动下载失败，请复制以下内容并手动保存为 ' + fileName;
                    hint.style.color = '#666';
                    hint.style.margin = '0';
                    hint.style.lineHeight = '1.5';
                    header.appendChild(hint);
                    panel.appendChild(header);

                    const textareaWrap = document.createElement('div');
                    textareaWrap.style.flex = '1';
                    textareaWrap.style.display = 'flex';
                    textareaWrap.style.flexDirection = 'column';
                    textareaWrap.style.minHeight = '0';

                    const textarea = document.createElement('textarea');
                    textarea.readOnly = true;
                    textarea.value = content;
                    textarea.style.width = '100%';
                    textarea.style.height = '400px';
                    textarea.style.fontFamily = 'Consolas, Monaco, monospace';
                    textarea.style.fontSize = '13px';
                    textarea.style.border = '2px solid #e0e0e0';
                    textarea.style.borderRadius = '6px';
                    textarea.style.padding = '15px';
                    textarea.style.resize = 'none';
                    textarea.style.outline = 'none';
                    textarea.style.background = '#fafafa';
                    textarea.style.lineHeight = '1.4';
                    textarea.style.flex = '1';
                    textareaWrap.appendChild(textarea);
                    panel.appendChild(textareaWrap);

                    const actionWrap = document.createElement('div');
                    actionWrap.style.marginTop = '20px';
                    actionWrap.style.textAlign = 'center';

                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.textContent = '📋 复制内容';
                    copyBtn.style.padding = '12px 24px';
                    copyBtn.style.background = 'linear-gradient(135deg, #2196f3, #1976d2)';
                    copyBtn.style.color = 'white';
                    copyBtn.style.border = 'none';
                    copyBtn.style.borderRadius = '6px';
                    copyBtn.style.cursor = 'pointer';
                    copyBtn.style.fontSize = '14px';
                    copyBtn.style.fontWeight = '500';
                    copyBtn.style.marginRight = '10px';
                    copyBtn.style.transition = 'all 0.3s ease';
                    copyBtn.addEventListener('mouseenter', () => {
                        copyBtn.style.transform = 'translateY(-1px)';
                    });
                    copyBtn.addEventListener('mouseleave', () => {
                        copyBtn.style.transform = 'translateY(0)';
                    });
                    copyBtn.addEventListener('click', async () => {
                        textarea.select();
                        textarea.setSelectionRange(0, textarea.value.length);
                        try {
                            const successful = document.execCommand('copy');
                            if (successful) {
                                copyBtn.textContent = '✅ 已复制到剪贴板！';
                                copyBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                                setTimeout(() => {
                                    copyBtn.textContent = '📋 复制内容';
                                    copyBtn.style.background = 'linear-gradient(135deg, #2196f3, #1976d2)';
                                }, 2000);
                                return;
                            }
                            throw new Error('Copy command failed');
                        } catch (err) {
                            try {
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(textarea.value);
                                    copyBtn.textContent = '✅ 已复制到剪贴板！';
                                    copyBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                                    setTimeout(() => {
                                        copyBtn.textContent = '📋 复制内容';
                                        copyBtn.style.background = 'linear-gradient(135deg, #2196f3, #1976d2)';
                                    }, 2000);
                                    return;
                                }
                            } catch (copyErr) {
                                console.error('Clipboard copy failed:', copyErr);
                            }
                            alert('复制失败，请手动选择文本内容进行复制');
                        }
                    });

                    const closeBtn = document.createElement('button');
                    closeBtn.type = 'button';
                    closeBtn.textContent = '❌ 关闭';
                    closeBtn.style.padding = '12px 24px';
                    closeBtn.style.background = 'linear-gradient(135deg, #757575, #616161)';
                    closeBtn.style.color = 'white';
                    closeBtn.style.border = 'none';
                    closeBtn.style.borderRadius = '6px';
                    closeBtn.style.cursor = 'pointer';
                    closeBtn.style.fontSize = '14px';
                    closeBtn.style.fontWeight = '500';
                    closeBtn.style.transition = 'all 0.3s ease';
                    closeBtn.addEventListener('mouseenter', () => {
                        closeBtn.style.transform = 'translateY(-1px)';
                    });
                    closeBtn.addEventListener('mouseleave', () => {
                        closeBtn.style.transform = 'translateY(0)';
                    });
                    closeBtn.addEventListener('click', () => overlay.remove());

                    actionWrap.appendChild(copyBtn);
                    actionWrap.appendChild(closeBtn);
                    panel.appendChild(actionWrap);

                    const tip = document.createElement('div');
                    tip.textContent = '💡 提示：复制后可以粘贴到任何文本编辑器中，然后保存为 .md 文件';
                    tip.style.marginTop = '15px';
                    tip.style.padding = '10px';
                    tip.style.background = '#f5f5f5';
                    tip.style.borderRadius = '6px';
                    tip.style.fontSize = '12px';
                    tip.style.color = '#666';
                    tip.style.textAlign = 'center';
                    panel.appendChild(tip);

                    overlay.appendChild(panel);
                    document.body.appendChild(overlay);
                }
            }
            
            // 执行下载
            downloadMarkdown(markdownContent, filename);

        } catch (error) {
             console.error("Critical error during convertAndDownload:", error.message, error.stack);
             alert(`A critical error occurred while running the script: ${error.message}`);
        }
    }

    // --- Register Menu Command ---
    if (typeof GM_registerMenuCommand === 'function') {
        try {
             // 主要转换功能
             GM_registerMenuCommand("🔄 Convert Page to Markdown", convertAndDownload, "m");
             
             // 合并的下载设置指南 - 移至主菜单级别
             GM_registerMenuCommand("📥 Download Settings Guide", function() {
             const existingOverlay = document.getElementById('web-to-markdown-settings-overlay');
             if (existingOverlay) {
                 existingOverlay.remove();
                 return;
             }
             const overlay = document.createElement('div');
             overlay.id = 'web-to-markdown-settings-overlay';
                 overlay.style.position = 'fixed';
                 overlay.style.top = '0';
                 overlay.style.left = '0';
                 overlay.style.width = '100%';
                 overlay.style.height = '100%';
                 overlay.style.background = 'rgba(0,0,0,0.9)';
                 overlay.style.zIndex = '10000';
                 overlay.style.display = 'flex';
                 overlay.style.alignItems = 'center';
                 overlay.style.justifyContent = 'center';
                 overlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';

                 const panel = document.createElement('div');
                 panel.style.background = 'white';
                 panel.style.padding = '30px';
                 panel.style.borderRadius = '12px';
                 panel.style.maxWidth = '720px';
                 panel.style.maxHeight = '90%';
                 panel.style.overflow = 'auto';
                 panel.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';

                 const title = document.createElement('h2');
                 title.textContent = '下载设置完整指南';
                 title.style.color = '#333';
                 title.style.marginTop = '0';
                 title.style.textAlign = 'center';
                 title.style.display = 'flex';
                 title.style.alignItems = 'center';
                 title.style.justifyContent = 'center';

                 const titleIcon = document.createElement('span');
                 titleIcon.textContent = '📥';
                 titleIcon.style.fontSize = '28px';
                 titleIcon.style.marginRight = '10px';
                 title.insertBefore(titleIcon, title.firstChild);
                 panel.appendChild(title);

                 const banner = document.createElement('div');
                 banner.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                 banner.style.color = 'white';
                 banner.style.padding = '18px';
                 banner.style.borderRadius = '10px';
                 banner.style.margin = '20px 0';
                 banner.style.textAlign = 'center';
                 banner.innerHTML = '<strong style="font-size: 16px;">🎯 目标：允许Tampermonkey下载.md文件</strong><br><div style="margin-top: 8px; font-size: 14px; opacity: 0.9;">如果设置失败，脚本会自动使用浏览器下载，无需担心！</div>';
                 panel.appendChild(banner);

                 const steps = document.createElement('div');
                 steps.style.background = '#f8f9fa';
                 steps.style.padding = '25px';
                 steps.style.borderRadius = '10px';
                 steps.style.lineHeight = '1.7';
                 steps.style.margin = '15px 0';

                 const addStep = (titleText, items) => {
                     const wrap = document.createElement('div');
                     wrap.style.marginBottom = '20px';

                     const heading = document.createElement('strong');
                     heading.textContent = titleText;
                     heading.style.color = '#2e7d32';
                     heading.style.fontSize = '15px';
                     wrap.appendChild(heading);

                     const list = document.createElement('ul');
                     list.style.margin = '8px 0';
                     list.style.paddingLeft = '25px';
                     list.style.color = '#555';
                     items.forEach(item => {
                         const li = document.createElement('li');
                         li.textContent = item;
                         list.appendChild(li);
                     });
                     wrap.appendChild(list);
                     steps.appendChild(wrap);
                 };

                 addStep('1️⃣ 打开Tampermonkey管理界面', ['点击浏览器工具栏的Tampermonkey图标 🐒', '选择 "管理面板" 或 "Dashboard"']);
                 addStep('2️⃣ 进入设置页面', ['点击页面顶部的 "设置" 或 "Settings" 标签', '向下滚动找到 "Advanced" 部分']);
                 addStep('3️⃣ 配置下载白名单', ['找到 "Downloads BETA" 选项', '在 "Whitelist" 输入框中添加：']);

                 const codeBlock = document.createElement('div');
                 codeBlock.style.textAlign = 'center';
                 codeBlock.style.margin = '10px 0';
                 const code = document.createElement('code');
                 code.textContent = '*.md';
                 code.style.background = 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)';
                 code.style.color = '#333';
                 code.style.padding = '10px 20px';
                 code.style.borderRadius = '6px';
                 code.style.fontSize = '16px';
                 code.style.fontWeight = 'bold';
                 code.style.display = 'inline-block';
                 codeBlock.appendChild(code);
                 steps.appendChild(codeBlock);

                 const saveStep = document.createElement('div');
                 const saveHeading = document.createElement('strong');
                 saveHeading.textContent = '4️⃣ 保存设置';
                 saveHeading.style.color = '#2e7d32';
                 saveHeading.style.fontSize = '15px';
                 saveStep.appendChild(saveHeading);
                 const saveList = document.createElement('ul');
                 saveList.style.margin = '8px 0';
                 saveList.style.paddingLeft = '25px';
                 saveList.style.color = '#555';
                 saveList.innerHTML = '<li>滚动到页面底部点击 "Save" 按钮</li><li>刷新当前页面以使设置生效</li>';
                 saveStep.appendChild(saveList);
                 steps.appendChild(saveStep);
                 panel.appendChild(steps);

                 const browserNote = document.createElement('div');
                 browserNote.style.background = '#fff3cd';
                 browserNote.style.borderLeft = '4px solid #ffc107';
                 browserNote.style.padding = '15px';
                 browserNote.style.borderRadius = '8px';
                 browserNote.style.margin = '20px 0';
                 browserNote.innerHTML = '<strong style="color: #8a6d00;">💡 浏览器特殊说明</strong><br><div style="margin-top: 8px; color: #6c5500; line-height: 1.5;"><strong>Edge浏览器用户：</strong> 如果无法直接访问设置，可以：<br>• 右键点击Tampermonkey图标 → 选择 "扩展选项"<br>• 或在地址栏输入：<code style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 3px;">edge://extensions/</code></div>';
                 panel.appendChild(browserNote);

                 const backupNote = document.createElement('div');
                 backupNote.style.background = '#e8f5e8';
                 backupNote.style.borderLeft = '4px solid #4caf50';
                 backupNote.style.padding = '15px';
                 backupNote.style.borderRadius = '8px';
                 backupNote.style.margin = '20px 0';
                 backupNote.innerHTML = '<strong style="color: #2e7d32;">✅ 备用下载方案</strong><br><div style="margin-top: 8px; color: #2e7d32; line-height: 1.5;">即使无法设置Tampermonkey权限，脚本也会自动使用浏览器原生下载功能，<br>保证您能够成功获取转换后的Markdown文件！</div>';
                 panel.appendChild(backupNote);

                 const faq = document.createElement('div');
                 faq.style.background = '#f3e5f5';
                 faq.style.borderLeft = '4px solid #9c27b0';
                 faq.style.padding = '15px';
                 faq.style.borderRadius = '8px';
                 faq.style.margin = '20px 0';
                 faq.innerHTML = '<strong style="color: #6a1b9a;">🔧 常见问题解答</strong><br><div style="margin-top: 8px; color: #6a1b9a; line-height: 1.5;"><strong>Q:</strong> 下载被浏览器阻止？<br><strong>A:</strong> 检查浏览器弹窗拦截设置，允许当前网站的下载<br><br><strong>Q:</strong> 文件名显示乱码？<br><strong>A:</strong> 使用支持UTF-8编码的文本编辑器打开文件<br><br><strong>Q:</strong> 转换内容不完整？<br><strong>A:</strong> 刷新页面后重新尝试转换</div>';
                 panel.appendChild(faq);

                 const footer = document.createElement('div');
                 footer.style.textAlign = 'center';
                 footer.style.marginTop = '30px';

                 const closeGuideBtn = document.createElement('button');
                 closeGuideBtn.type = 'button';
                 closeGuideBtn.textContent = '✓ 我已了解，关闭指南';
                 closeGuideBtn.style.padding = '15px 35px';
                 closeGuideBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
                 closeGuideBtn.style.color = 'white';
                 closeGuideBtn.style.border = 'none';
                 closeGuideBtn.style.borderRadius = '8px';
                 closeGuideBtn.style.cursor = 'pointer';
                 closeGuideBtn.style.fontSize = '16px';
                 closeGuideBtn.style.fontWeight = 'bold';
                 closeGuideBtn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
                 closeGuideBtn.style.transition = 'all 0.3s ease';
                 closeGuideBtn.addEventListener('mouseenter', () => {
                     closeGuideBtn.style.transform = 'translateY(-2px)';
                     closeGuideBtn.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
                 });
                 closeGuideBtn.addEventListener('mouseleave', () => {
                     closeGuideBtn.style.transform = 'translateY(0)';
                     closeGuideBtn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
                 });
                 closeGuideBtn.addEventListener('click', () => {
                     overlay.remove();
                     document.removeEventListener('keydown', closeOnEscape);
                 });
                 footer.appendChild(closeGuideBtn);
                 panel.appendChild(footer);
                 overlay.appendChild(panel);
                 document.body.appendChild(overlay);
              const closeOnEscape = event => {
                  if (event.key === 'Escape') {
                      overlay.remove();
                      document.removeEventListener('keydown', closeOnEscape);
                  }
              };
              document.addEventListener('keydown', closeOnEscape);
             }, "h");
             
             console.log("Menu commands registered.");
        } catch (registerError) { console.error("Failed to register menu command:", registerError); alert("Failed to register menu command!"); }
    } else { console.error("GM_registerMenuCommand is not available."); alert("GM_registerMenuCommand is not available!"); }

    console.log("Webpage to Markdown script finished loading."); // Version updated
})();