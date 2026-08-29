/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


/**
 * Extracts a complete HTML document from a string that might contain
 * conversational text, markdown code blocks, etc.
 */
export const extractHtmlFromText = (text: string): string => {
  if (!text) return "";

  // 1. Try to find a complete HTML document structure (most reliable)
  // Matches <!DOCTYPE html>...</html> or <html>...</html>, case insensitive, spanning multiple lines
  const htmlMatch = text.match(/(<!DOCTYPE html>|<html)[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[0];
  }

  // 2. Fallback: Try to extract content from markdown code blocks if specific HTML tags weren't found
  const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 3. Return raw text if no structure is found (trim whitespace)
  return text.trim();
};

/**
 * Injects CSS to hide text overlays (like loading screens, titles, info overlays, instructions)
 * while preserving the canvas and Three.js rendering completely intact.
 */
export const hideBodyText = (html: string): string => {
  if (!html) return "";

  const cssToInject = `
    <style>
      /* Hide text overlays, loading screens, HUD and info boxes */
      #info, #loading, #ui, #instructions, #description, #title, #header,
      .info, .loading, .ui, .instructions, .description, .overlay, .label,
      .card, .badge, .tag, .controls-hint, .hint {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Ensure clean canvas presentation */
      html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        width: 100%;
        height: 100%;
        user-select: none;
      }
      canvas {
        display: block;
      }
    </style>
  `;

  // Inject before closing head if possible, otherwise before closing body, or append
  if (html.toLowerCase().includes('</head>')) {
    return html.replace(/<\/head>/i, `${cssToInject}</head>`);
  }
  if (html.toLowerCase().includes('</body>')) {
    return html.replace(/<\/body>/i, `${cssToInject}</body>`);
  }
  return html + cssToInject;
};

/**
 * Three.js scenes are often too zoomed out
 * Zooms the camera in by modifying the camera.position.set() call in the Three.js code.
 * This brings the camera closer to the center (0,0,0) by the specified factor.
 */
export const zoomCamera = (html: string, zoomFactor: number = 0.8): string => {
  // Regex to find camera.position.set(x, y, z)
  // It handles integer, float, and whitespace
  const regex = /camera\.position\.set\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)/g;

  return html.replace(regex, (match, x, y, z) => {
    const newX = parseFloat(x) * zoomFactor;
    const newY = parseFloat(y) * zoomFactor;
    const newZ = parseFloat(z) * zoomFactor;
    return `camera.position.set(${newX}, ${newY}, ${newZ})`;
  });
};
