# web-to-markdown
  
**Summary:**
This Tampermonkey userscript (v1.0) converts the main content of a webpage into Markdown format. It features logic for selecting the relevant content area, aiming to reduce unwanted elements like navigation, footers, and ads for a cleaner output.

**Code Overview:**

*   **Metadata Block (`// ==UserScript==`):** Defines script name ("Webpage to Markdown"), version (1.0), description, dependencies (`turndown`, `turndown-plugin-gfm`), and necessary `GM_*` functions (`GM_registerMenuCommand`, `GM_download`).
*   **Configuration (`turndownOptions`):** Sets options for the Turndown library to control Markdown output style.
*   **`sanitizeFilename()`:** Helper function to create a valid filename from the page title.
*   **`getPageContentNode()`:** Attempts to find the main content container using common selectors (e.g., `article`, `main`, `.post-content`). It clones the best candidate and removes common irrelevant elements before conversion. Falls back to `document.body` if necessary.  
*   **`convertAndDownload()`:**
    *   Initializes the `TurndownService` with GFM plugin and a custom math rule.  
    *   Calls `getPageContentNode()` to get the cleaned content node.
    *   Converts the node's HTML to Markdown.
    *   Uses `GM_download` to prompt the user to save the resulting `.md` file.
*   **Menu Command Registration:** Uses `GM_registerMenuCommand` to add an option ("Convert Page to Markdown (v1.0)") to the Tampermonkey menu.

**How to Use:**

1.  Ensure you have the Tampermonkey (or a compatible) browser extension installed.
2.  Install this userscript (v1.0).
3.  Navigate to the webpage you want to convert.
4.  Click the Tampermonkey icon in your browser toolbar.
5.  Select "**Convert Page to Markdown (v1.0)**" from the menu.
6.  A dialog box should appear, prompting you to save the Markdown (`.md`) file.

**Troubleshooting Tip:**

*   **If the `.md` file download fails:** Go to the Tampermonkey Dashboard -> Settings tab. Change "Config mode" from "Beginner" to "Advanced". Scroll down to the "Downloads BETA" section. In the "Whitelisted File Extensions" box, add `.md` on a new line. Click "Save".

**P.S. Warnings:**

1.  This script is a simple tool for converting webpages to Markdown text. It cannot fully guarantee that the converted file will be free of missing information. Please verify the content yourself.
2.  It is not recommended to use this script to download paid or copyrighted content. If you use this script to obtain paid content and related copyright issues arise, the author assumes no responsibility. Please respect copyright.
