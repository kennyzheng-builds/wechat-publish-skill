#!/usr/bin/env node
/**
 * Prepare preview HTML for API publishing by:
 * 1. Extracting only the js_content div (no guide panel, header, footer)
 * 2. Replacing base64 data URIs with absolute local file paths
 * 3. Wrapping in <div id="output"> for publish_to_wechat.js extraction
 *
 * Usage:
 *   node prepare_api_html.js <preview_full.html> <output_api.html> [--images img1.jpg,img2.jpg]
 *
 * If --images is provided, base64 data URIs are replaced with those paths in order.
 * Otherwise, base64 images are left as-is (publish script will warn).
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
function getFlag(flag) {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : null;
}

const positional = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
const inputFile = positional[0];
const outputFile = positional[1];
const imagesArg = getFlag('--images');

if (!inputFile || !outputFile) {
  console.error('Usage: node prepare_api_html.js <preview_full.html> <output_api.html> [--images img1.jpg,img2.jpg]');
  process.exit(1);
}

const html = fs.readFileSync(inputFile, 'utf8');

// Extract js_content div
const match = html.match(/<div class="rich_media_content" id="js_content">([\s\S]*?)<\/div>\s*<div class="article-footer">/);
if (!match) {
  console.error('Error: Could not find js_content div in HTML');
  process.exit(1);
}

let content = match[1].trim();

// Extract title
const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
const title = titleMatch ? titleMatch[1] : 'Untitled';

// Replace base64 data URIs with local file paths
if (imagesArg) {
  const images = imagesArg.split(',');
  let idx = 0;
  content = content.replace(/data:image\/[^;]+;base64,[^"]*/g, () => {
    if (idx < images.length) {
      return path.resolve(images[idx++]);
    }
    return '';
  });
  console.error(`[prepare] Replaced ${idx} base64 images with local paths`);
}

// Wrap in output div
const out = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title></head>
<body><div id="output">
${content}
</div></body></html>`;

fs.writeFileSync(outputFile, out);
console.log(`API version: ${outputFile} (${(fs.statSync(outputFile).size / 1024).toFixed(0)} KB)`);
