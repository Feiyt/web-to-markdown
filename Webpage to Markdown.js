// ==UserScript==
// @name         Webpage to Markdown
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Convert webpage to Markdown via Tampermonkey menu. Significantly optimizes content selection logic, reducing content loss and useless elements.
// @author       Feiyt
// @homepageURL  https://github.com/Feiyt
// @license      MIT
// @match        *://*/*
// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://unpkg.com/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

// Copyright (c) 2025 Feiyt
// Released under the MIT license
// https://github.com/Feiyt (or specify the exact repo if available)

(function() {
    'use strict';
    console.log("Webpage to Markdown (v1.0) script starting..."); // Version updated here

    // --- Configuration ---
    const turndownOptions = { /* ... options from previous version ... */ }; // Reference to previous settings
    turndownOptions.headingStyle = 'atx';
    turndownOptions.hr = '---';
    turndownOptions.bulletListMarker = '*';
    turndownOptions.codeBlockStyle = 'fenced';
    turndownOptions.emDelimiter = '*';
    turndownOptions.strongDelimiter = '**';
    turndownOptions.linkStyle = 'inlined';


    // --- Helper Functions ---
    function sanitizeFilename(name) { /* ... function from previous version ... */ } // Placeholder comment
    // Sanitizes a string to be used as a filename.
    sanitizeFilename = function(name) {
        // Replace forbidden characters with underscore, collapse whitespace, trim, provide default.
        return name.replace(/[\/\\:*?"<>|#%\n\r]/g, '_').replace(/\s+/g, ' ').trim() || "markdown_export";
    };


    /**
     * Improved content selection and cleaning.
     * Prioritizes semantic tags and common content IDs/classes.
     * @returns {object|null} Object containing { title: string, contentNode: Node } or null on failure.
     */
    function getPageContentNode() {
        console.log("getPageContentNode (v1.0 logic): Starting content retrieval..."); // Adjusted log message slightly
        const pageTitle = document.title || window.location.hostname;
        let bestCandidate = null;
        let maxScore = -1; // Simple scoring mechanism

        // More robust selectors with priorities implied by order
        const selectors = [
            // Highest Priority: Semantic & Specific Roles/IDs/Classes
            'article', '[role="article"]', '.article-body', '.post-content', '.entry-content', '#article-content', '.post-body', '.markdown-body',
            // High Priority: Main content areas
            'main', '[role="main"]', '#main-content', '#main', '.main-content', '.main', '#primary',
            // Medium Priority: Common generic containers (often need cleaning)
            '#content', '.content',
            // Lower Priority: More specific layout patterns
            '#page .content', // Example of nested structure
            '.container .content',
             // Stack Overflow Example
             '#mainbar',
            // Lowest Priority (if nothing else works, but avoid body initially)
            // Maybe add specific blog platform IDs? '.hentry'?
        ];

        console.log("Searching for best content container...");
        selectors.forEach((selector, index) => {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    // Basic score: higher priority selectors get higher base score
                    const score = selectors.length - index; // Higher index = lower priority = lower score
                    console.log(`Found candidate [${selector}] with score ${score}`);

                    // --- Basic Heuristic Check ---
                    const textLength = element.textContent?.trim().length || 0;
                    const childCount = element.childElementCount || 0;
                    // Arbitrary thresholds - adjust as needed
                    if (textLength < 100 && childCount < 3) {
                        console.log(`... Candidate [${selector}] seems too small/empty (Text: ${textLength}, Children: ${childCount}). Lowering confidence.`);
                    }

                    if (score > maxScore) {
                        maxScore = score;
                        bestCandidate = element;
                        console.log(`>>> New best candidate: [${selector}]`);
                    }
                }
            } catch (e) { console.warn(`Error querying selector "${selector}": ${e.message}`); }
        });

        // If no good candidate found via specific selectors, use body as last resort
        if (!bestCandidate) {
            console.warn("No suitable specific container found after checking selectors. Falling back to document.body.");
            bestCandidate = document.body;
        } else {
            const likelySelectorIndex = selectors.length - 1 - Math.floor(maxScore);
            const likelySelector = selectors[likelySelectorIndex] || 'heuristic/fallback';
            console.log(`Selected final container: <${bestCandidate.tagName.toLowerCase()}> (Selector likely: ${likelySelector})`);
        }

        // --- Clone and Clean ---
        try {
            if (!bestCandidate || typeof bestCandidate.cloneNode !== 'function') {
                console.error("Cannot clone the selected content element."); return null;
            }
            console.log("Cloning selected container...");
            const clone = bestCandidate.cloneNode(true);

            // Define selectors for elements to exclude from the conversion.
            const excludeSelectors = [
                'header', 'footer', 'nav', '.header', '.footer', '.navbar', '.menu', '.toc', '#toc', '.breadcrumb', '#breadcrumb',
                '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
                'aside', '.sidebar', '#sidebar', '.widget-area', '#secondary', '.left-column', '.right-column',
                '[role="complementary"]',
                '.actions', '.share', '.social', '.buttons', '.post-meta', '.entry-meta', '.feedback', '.related-posts',
                '.like-button-container', '.feedback-container',
                '#comments', '.comments', '.comment-section', '#respond',
                '.ad', '.ads', '.advertisement', '.adsbygoogle', '[id*="ad-"]', '[class*="ad-"]', '[class*="advert"]',
                '.edit-link', '.print-link', '[role="search"]',
                'script', 'style', 'noscript', 'template', 'link[rel="stylesheet"]', 'meta', 'input[type="hidden"]',
                '.visually-hidden', '.sr-only', '[aria-hidden="true"]',
                '.cookie-banner', '#related-articles', '.related_posts',
            ];

            console.log("Removing excluded elements from clone...");
            let removedCount = 0;
             for (const selector of excludeSelectors) {
                 try {
                     const elementsToRemove = clone.querySelectorAll(selector);
                     elementsToRemove.forEach(el => {
                         if (el !== clone && typeof el.remove === 'function') {
                             el.remove();
                             removedCount++;
                         } else if (el === clone) {
                             console.warn(`Exclusion selector "${selector}" matched the container root itself! Skipping removal of root.`);
                         }
                     });
                 } catch (e) { console.warn(`Error removing elements for selector "${selector}": ${e.message}`); }
             }
            console.log(`Removed ${removedCount} elements/subtrees from clone.`);

            // --- Post-cleaning Check ---
            if (clone.childElementCount === 0 && clone.textContent.trim().length < 50) {
                 console.warn("Clone seems empty after cleaning! Original selection or exclusion might be wrong.");
            }

            return { title: pageTitle, contentNode: clone };

        } catch (error) {
            console.error("Critical error during cloning or cleaning:", error.message, error.stack);
            return null;
        }
    }

    // --- Main Conversion and Download Logic ---
    function convertAndDownload() {
        console.log("Convert to Markdown (v1.0): Button clicked..."); // Version updated here
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

            // --- Perform Conversion ---
            console.log("Getting page content node...");
            const pageData = getPageContentNode();

            if (!pageData || !pageData.contentNode) {
                 console.error("Failed to get valid page content node. Aborting.");
                 alert("Could not get a valid page content node for conversion.");
                 return;
            }
            console.log(`Content node retrieved. Title: ${pageData.title}. Starting conversion...`);

            let markdownContent = '';
            try {
                markdownContent = turndownService.turndown(pageData.contentNode);
                console.log("Markdown conversion complete.");
            } catch (convertError) {
                 console.error("Error during Turndown conversion:", convertError.message, convertError.stack);
                 alert(`Error during Markdown conversion: ${convertError.message}`);
                 return;
            }

            if (!markdownContent || markdownContent.trim() === '') {
                 console.warn("Conversion resulted in empty Markdown content.");
                 alert("Warning: The converted Markdown content is empty.");
            }

            // --- Prepare Filename & Download ---
            const filename = sanitizeFilename(pageData.title) + ".md";
            const dataUri = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownContent)}`;
            console.log(`Initiating download for ${filename}...`);
            GM_download({
                url: dataUri,
                name: filename,
                saveAs: true,
                onerror: (err) => {
                    console.error('GM_download error:', err);
                    alert(`Error downloading file: ${err.error || 'Unknown error'}. Check Tampermonkey settings (Advanced -> Downloads BETA -> Whitelist .md).`);
                 },
             });
            console.log("Download initiated.");

        } catch (error) {
             console.error("Critical error during convertAndDownload:", error.message, error.stack);
             alert(`A critical error occurred while running the script: ${error.message}`);
        }
    }

    // --- Register Menu Command ---
    if (typeof GM_registerMenuCommand === 'function') {
        try {
             // Updated menu command text to reflect v1.0
             GM_registerMenuCommand("Convert Page to Markdown (v1.0)", convertAndDownload, "m");
             console.log("Menu command registered.");
        } catch (registerError) { console.error("Failed to register menu command:", registerError); alert("Failed to register menu command!"); }
    } else { console.error("GM_registerMenuCommand is not available."); alert("GM_registerMenuCommand is not available!"); }

    console.log("Webpage to Markdown (v1.0) script finished loading."); // Version updated here
})();