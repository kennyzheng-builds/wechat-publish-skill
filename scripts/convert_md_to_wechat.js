#!/usr/bin/env node
/**
 * Convert Markdown to WeChat-style HTML with all inline styles.
 *
 * Usage:
 *   node convert_md_to_wechat.js <input.md> <output.html> [options]
 *
 * Options:
 *   --title    "Article Title"   Override H1-detected title
 *   --author   "Author Name"     Author shown in meta info
 *   --images   img1.jpg,img2.jpg Comma-separated image paths
 *   --anchors  "text1|||text2"   |||-delimited anchor strings for image placement
 *   --captions "cap1|||cap2"     |||-delimited image captions
 *   --style    style.json        Custom style config (overrides default-style.json)
 *
 * Output:
 *   output.html      - Text version with dashed placeholder boxes
 *   output_full.html - Full preview with base64-embedded images (only if images provided)
 */

const fs = require('fs');
const path = require('path');

// ---------- Parse CLI args ----------
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const positional = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
const inputFile = positional[0];
const outputFile = positional[1];
const imagesArg = getArg('--images');
const anchorsArg = getArg('--anchors');
const captionsArg = getArg('--captions');
const titleOverride = getArg('--title');
const authorOverride = getArg('--author');
const styleArg = getArg('--style');

if (!inputFile) {
  console.error('Usage: node convert_md_to_wechat.js <input.md> [output.html] [--images ...] [--anchors ...] [--captions ...] [--title ...] [--author ...]');
  process.exit(1);
}

const md = fs.readFileSync(inputFile, 'utf8');

// ---------- Load style config ----------
const defaultStylePath = path.join(__dirname, '..', 'assets', 'default-style.json');
let styleConfig = {};
if (fs.existsSync(defaultStylePath)) {
  styleConfig = JSON.parse(fs.readFileSync(defaultStylePath, 'utf8'));
}
if (styleArg && fs.existsSync(styleArg)) {
  const custom = JSON.parse(fs.readFileSync(styleArg, 'utf8'));
  // Merge custom into defaults (shallow per-section merge)
  for (const key of Object.keys(custom)) {
    if (key.startsWith('_')) continue;
    styleConfig[key] = { ...(styleConfig[key] || {}), ...custom[key] };
  }
}

// ---------- WeChat inline style constants ----------
const pc = styleConfig.paragraph || {};
const hc2 = styleConfig.h2 || {};
const hc3 = styleConfig.h3 || {};
const bq = styleConfig.blockquote || {};
const li = styleConfig.list || {};
const hrc = styleConfig.hr || {};

const S = {
  p:         `margin: ${pc.margin || '1em 8px'};`,
  pFirst:    `margin: ${pc.firstMargin || '0 8px 1em'};`,
  pCenter:   `text-align: center; margin: ${pc.margin || '1em 8px'};`,
  body:      `font-size: ${pc.fontSize || '15px'};${pc.color ? ` color: ${pc.color};` : ''}`,
  h2:        `font-size: ${hc2.fontSize || '16px'}; font-weight: ${hc2.fontWeight || 'bold'};${hc2.color ? ` color: ${hc2.color};` : ''}`,
  h3:        `font-size: ${hc3.fontSize || '15px'}; font-weight: ${hc3.fontWeight || 'bold'};${hc3.color ? ` color: ${hc3.color};` : ''}`,
  h2Wrap:    `text-align: ${hc2.textAlign || 'center'}; margin: ${hc2.margin || '2em 8px 0.8em'};`,
  h3Wrap:    `margin: ${hc3.margin || '1.6em 8px 0.5em'};`,
  quote:     `margin: ${bq.margin || '1em 8px'}; padding-left: ${bq.paddingLeft || '12px'}; border-left: ${bq.borderLeft || '3px solid rgba(0,0,0,0.12)'}; color: ${bq.textColor || 'rgba(0,0,0,0.5)'};`,
  quoteText: `font-size: ${bq.fontSize || '15px'}; color: ${bq.textColor || 'rgba(0,0,0,0.5)'};`,
  hr:        `text-align: center; margin: ${hrc.margin || '1.6em 8px'}; visibility: visible;`,
  hrInner:   `display: inline-block; width: ${hrc.lineWidth || '30%'}; height: 1px; background: ${hrc.lineColor || 'rgba(0,0,0,0.12)'}; vertical-align: middle;`,
  list:      `margin: ${li.margin || '1em 8px'};`,
};
const listBullet = li.bullet || '\u2022';

const BOLD_OPEN = '\u0001';
const BOLD_CLOSE = '\u0002';
const CODE_OPEN = '\u0003';
const CODE_CLOSE = '\u0004';

function span(text, style) {
  return `<span style="${style}">${text}</span>`;
}

// Build sibling spans with proper bold/code styling at the same level (not nested)
function buildContent(text, baseStyle) {
  // text already has HTML entities escaped and bold/code marked with sentinels
  const result = [];
  let remaining = text;
  while (remaining.length > 0) {
    // Find next marker
    const bIdx = remaining.indexOf(BOLD_OPEN);
    const cIdx = remaining.indexOf(CODE_OPEN);
    let nextIdx = -1;
    let nextType = '';
    if (bIdx >= 0 && (cIdx < 0 || bIdx < cIdx)) { nextIdx = bIdx; nextType = 'bold'; }
    else if (cIdx >= 0) { nextIdx = cIdx; nextType = 'code'; }

    if (nextIdx === -1) {
      if (remaining) result.push(`<span style="${baseStyle}">${remaining}</span>`);
      break;
    }
    // Text before marker
    if (nextIdx > 0) {
      result.push(`<span style="${baseStyle}">${remaining.substring(0, nextIdx)}</span>`);
    }
    if (nextType === 'bold') {
      const end = remaining.indexOf(BOLD_CLOSE, nextIdx);
      if (end === -1) { result.push(`<span style="${baseStyle}">${remaining.substring(nextIdx + 1)}</span>`); break; }
      const boldText = remaining.substring(nextIdx + 1, end);
      result.push(`<span style="${baseStyle} font-weight: bold;">${boldText}</span>`);
      remaining = remaining.substring(end + 1);
    } else {
      const end = remaining.indexOf(CODE_CLOSE, nextIdx);
      if (end === -1) { result.push(`<span style="${baseStyle}">${remaining.substring(nextIdx + 1)}</span>`); break; }
      const codeText = remaining.substring(nextIdx + 1, end);
      result.push(`<code style="font-size: 14px; background: rgba(0,0,0,0.04); padding: 2px 4px; border-radius: 3px; font-family: Menlo, Monaco, Consolas, monospace;">${codeText}</code>`);
      remaining = remaining.substring(end + 1);
    }
  }
  return result.join('');
}

function blankLine() {
  return `<p style="margin: 0 8px;"><span><br></span></p>`;
}
function processInline(text) {
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  text = text.replace(/\*\*(.+?)\*\*/g, BOLD_OPEN + '$1' + BOLD_CLOSE);
  text = text.replace(/`([^`]+)`/g, CODE_OPEN + '$1' + CODE_CLOSE);
  // Underscore italic: _text_ → plain text (strip markers)
  text = text.replace(/(?:^|(?<=\s))_([^_]+?)_(?:$|(?=[\s，。、；：！？]))/g, '$1');
  return text;
}

// ---------- Word count & reading time ----------
function countWords(text) {
  // Strip markdown syntax
  const plain = text.replace(/^#+\s/gm, '').replace(/\*\*/g, '').replace(/`[^`]+`/g, '').replace(/^[->\s]*/gm, '').replace(/^---$/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Count Chinese characters
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  // Count non-CJK words (English etc.)
  const nonCjk = plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
  return cjk + nonCjk;
}
const wordCount = countWords(md);
const readingMinutes = Math.max(1, Math.ceil(wordCount / 400));

// ---------- Convert Markdown to HTML lines ----------
const lines = md.split('\n');
const html = [];
let title = '';
let isFirstElement = true;

let i = 0;
while (i < lines.length) {
  const line = lines[i].trim();
  if (line === '') { i++; continue; }

  // H1 title - extract, skip from body
  if (line.startsWith('# ') && !line.startsWith('## ')) {
    title = line.replace(/^# /, '');
    i++; continue;
  }
  // HR
  if (line === '---') {
    html.push(`<section style="${S.hr}"><span style="${S.hrInner}"></span><span style="display: inline-block; margin: 0 10px; vertical-align: middle; color: ${hrc.symbolColor || 'rgba(0,0,0,0.15)'};">${hrc.symbol || '\u2726'}</span><span style="${S.hrInner}"></span></section>`);
    isFirstElement = false;
    i++; continue;
  }
  // H2
  if (line.startsWith('## ')) {
    const text = line.replace(/^## /, '').replace(/\*\*/g, '');
    html.push(`<p style="${isFirstElement ? S.pCenter.replace(/margin: [^;]+;/, 'margin: 0 8px 0.6em;') : S.h2Wrap}">${span(text, S.h2)}</p>`);
    isFirstElement = false;
    i++; continue;
  }
  // H3
  if (line.startsWith('### ')) {
    const text = line.replace(/^### /, '').replace(/\*\*/g, '');
    html.push(`<p style="${isFirstElement ? S.p.replace(/margin: [^;]+;/, 'margin: 0 8px;') : S.h3Wrap}">${span(text, S.h3)}</p>`);
    isFirstElement = false;
    i++; continue;
  }
  // Blockquote
  if (line.startsWith('> ')) {
    let qt = line.replace(/^> /, '');
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith('> ')) {
      i++;
      qt += lines[i].trim().replace(/^> /, '');
    }
    qt = processInline(qt);
    html.push(`<p style="${S.quote}">${buildContent(qt, S.quoteText)}</p>`);
    isFirstElement = false;
    i++; continue;
  }
  // List item
  if (line.startsWith('- ')) {
    let lt = line.replace(/^- /, '');
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !lines[i + 1].trim().startsWith('- ') && !lines[i + 1].trim().startsWith('#') && !lines[i + 1].trim().startsWith('>') && lines[i + 1].trim() !== '---') {
      i++;
      lt += lines[i].trim();
    }
    lt = processInline(lt);
    html.push(`<p style="${S.list}">${buildContent(listBullet + ' ' + lt, S.body)}</p>`);
    isFirstElement = false;
    i++; continue;
  }
  // Paragraph
  {
    let pt = line;
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !lines[i + 1].trim().startsWith('#') && !lines[i + 1].trim().startsWith('>') && !lines[i + 1].trim().startsWith('- ') && lines[i + 1].trim() !== '---') {
      i++;
      pt += lines[i].trim();
    }
    pt = processInline(pt);
    const pStyle = isFirstElement ? S.pFirst : S.p;
    html.push(`<p style="${pStyle}">${buildContent(pt, S.body)}</p>`);
    isFirstElement = false;
    i++;
  }
}

// ---------- Insert reading time at the top ----------
const readingMeta = `<p style="margin: 0 8px 1em;"><span leaf=""><span textstyle="" style="font-size: 14px; color: rgba(0,0,0,0.4);">全文约 ${wordCount} 字，阅读需 ${readingMinutes} 分钟。</span></span></p>`;
html.unshift(readingMeta);

// ---------- Image insertion ----------
const imageFiles = imagesArg ? imagesArg.split(',') : [];
const anchors = anchorsArg ? anchorsArg.split('|||') : [];
const captions = captionsArg ? captionsArg.split('|||') : [];

function imgTag(src, caption) {
  let h = `<section style="text-align: center; margin: 0.8em 8px 0;"><img src="${src}" style="width: 100%; height: auto !important; border-radius: 4px;" alt="Image"></section>`;
  if (caption) {
    h += `\n<p style="text-align: center; line-height: 1.4em; margin: 0 8px;"><span leaf=""><span textstyle="" style="font-size: ${(styleConfig.imageCaption || {}).fontSize || '12px'}; color: ${(styleConfig.imageCaption || {}).color || 'rgb(136, 136, 136)'}; font-style: ${(styleConfig.imageCaption || {}).fontStyle || 'italic'};">${caption}</span></span></p>`;
  }
  return h;
}

function imgPlaceholder(num, filename, caption) {
  let h = `<section style="text-align: center; margin: 0.8em 8px 0; padding: 20px; background: #f5f5f5; border: 1px dashed #ccc; border-radius: 6px;"><p style="text-align: center; margin: 0; font-size: 13px; color: #999; line-height: 1.6;">\u2191 \u63d2\u5165\u56fe\u7247 ${num}\uff1a${filename} \u2191</p></section>`;
  if (caption) {
    h += `\n<p style="text-align: center; line-height: 1.4em; margin: 0 8px;"><span leaf=""><span textstyle="" style="font-size: ${(styleConfig.imageCaption || {}).fontSize || '12px'}; color: ${(styleConfig.imageCaption || {}).color || 'rgb(136, 136, 136)'}; font-style: ${(styleConfig.imageCaption || {}).fontStyle || 'italic'};">${caption}</span></span></p>`;
  }
  return h;
}

function insertImages(htmlLines, useBase64) {
  if (anchors.length === 0) return htmlLines.join('\n');
  const result = [];
  const inserted = {};
  for (const line of htmlLines) {
    result.push(line);
    for (let j = 0; j < anchors.length; j++) {
      const anchor = anchors[j];
      if (anchor && !inserted[j] && line.includes(anchor)) {
        if (useBase64 && imageFiles[j] && fs.existsSync(imageFiles[j])) {
          const b64 = fs.readFileSync(imageFiles[j]).toString('base64');
          const ext = path.extname(imageFiles[j]).slice(1) || 'jpeg';
          result.push(imgTag(`data:image/${ext};base64,${b64}`, captions[j] || ''));
        } else {
          const fname = imageFiles[j] ? path.basename(imageFiles[j]) : `image-${j + 1}`;
          result.push(imgPlaceholder(String(j + 1).padStart(2, '0'), fname, captions[j] || ''));
        }
        inserted[j] = true;
        break;
      }
    }
  }
  return result.join('\n');
}

const bodyFull = insertImages(html, true);
const bodyText = insertImages(html, false);

title = titleOverride || title || 'Untitled';
const author = authorOverride || '';

// ---------- HTML page template ----------
function buildPage(body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#ededed;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei UI","Microsoft YaHei",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.page-wrapper{max-width:780px;margin:0 auto;padding:20px 0}
.copy-bar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0}
.copy-bar .info{display:flex;flex-direction:column;gap:2px}
.copy-bar .label{font-size:13px;color:rgba(0,0,0,.4)}
.copy-bar .hint{font-size:11px;color:rgba(0,0,0,.25)}
.copy-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:#07c160;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit}
.copy-btn:hover{background:#06ad56}
.copy-btn:active{transform:scale(.97)}
.copy-btn.copied{background:#333}
.copy-btn svg{width:16px;height:16px;fill:currentColor}
.article-card{background:#fff;border-radius:0 0 8px 8px;overflow:hidden}
.article-header{padding:24px 24px 0 24px}
.article-title{font-size:22px;font-weight:500;line-height:1.4;color:rgba(0,0,0,.9);margin-bottom:14px;word-break:break-word}
.meta-info{display:flex;align-items:center;gap:8px;font-size:14px;color:rgba(0,0,0,.3);padding-bottom:22px;flex-wrap:wrap}
.meta-info .original-tag{display:inline-block;font-size:12px;color:rgba(0,0,0,.3);border:1px solid rgba(0,0,0,.12);border-radius:2px;padding:1px 4px;line-height:1.4}
.meta-info .author-link{color:#576b95;text-decoration:none}
.rich_media_content{padding:0 24px 40px 24px;color:rgba(0,0,0,.9);font-size:17px;line-height:27.2px;word-wrap:break-word;overflow:hidden}
.rich_media_content p{margin:1em 0;padding:0}
.rich_media_content section{margin:0;padding:0}
.rich_media_content strong{font-weight:bold}
.rich_media_content code{font-family:Menlo,Monaco,Consolas,monospace}
.rich_media_content img{max-width:100%}
.article-footer{padding:20px 24px 30px;text-align:center;border-top:1px solid rgba(0,0,0,.04)}
.article-footer p{font-size:12px;color:rgba(0,0,0,.3);line-height:2}
.toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.8);background:rgba(0,0,0,.7);color:#fff;padding:14px 24px;border-radius:8px;font-size:14px;opacity:0;transition:all .3s;pointer-events:none;z-index:999}
.toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.guide-panel{background:#fff;border-radius:8px;margin-bottom:12px;padding:20px 24px;border:1px solid rgba(0,0,0,.06)}
.guide-panel h3{font-size:15px;font-weight:600;color:rgba(0,0,0,.85);margin-bottom:12px}
.guide-panel ol{padding-left:20px;font-size:13px;color:rgba(0,0,0,.6);line-height:2}
.guide-panel ol li strong{color:rgba(0,0,0,.85)}
.guide-panel .note{margin-top:10px;padding:10px 14px;background:#fffbe6;border:1px solid #ffe58f;border-radius:4px;font-size:12px;color:#8c6e00;line-height:1.6}
</style>
</head>
<body>
<div class="page-wrapper">
  <div class="guide-panel">
    <h3>\u53d1\u5e03\u6b65\u9aa4</h3>
    <ol>
      <li>\u70b9\u51fb\u4e0b\u65b9 <strong>\u300c\u4e00\u952e\u590d\u5236\u300d</strong> \u6309\u94ae\uff0c\u590d\u5236\u5e26\u683c\u5f0f\u7684\u6587\u7ae0\u5185\u5bb9</li>
      <li>\u6253\u5f00 <strong>mp.weixin.qq.com</strong> \u2192 \u65b0\u5efa\u56fe\u6587\u6d88\u606f</li>
      <li>\u5728\u7f16\u8f91\u5668\u6b63\u6587\u533a\u57df <strong>Ctrl+V / Cmd+V \u7c98\u8d34</strong></li>
      <li>\u6587\u5b57\u683c\u5f0f\u4f1a\u81ea\u52a8\u4fdd\u7559\uff0c\u7136\u540e\u5728\u6807\u8bb0\u4f4d\u7f6e <strong>\u624b\u52a8\u63d2\u5165\u56fe\u7247</strong>\uff08\u6309\u7f16\u53f7\u987a\u5e8f\uff09</li>
      <li>\u586b\u5199\u6807\u9898\u3001\u4f5c\u8005\u3001\u5c01\u9762\u56fe\u7b49\u4fe1\u606f\uff0c\u9884\u89c8\u786e\u8ba4\u540e\u53d1\u5e03</li>
    </ol>
    <div class="note">\u63d0\u793a\uff1a\u56fe\u7247\u5df2\u5bfc\u51fa\u4e3a\u7f16\u53f7\u6587\u4ef6\uff0c\u5bf9\u5e94\u6587\u7ae0\u4e2d\u7684\u63d2\u5165\u4f4d\u7f6e\u3002\u7c98\u8d34\u540e\u5728\u5404\u6807\u8bb0\u4f4d\u7f6e\u70b9\u51fb\u5fae\u4fe1\u7f16\u8f91\u5668\u5de5\u5177\u680f\u7684\u300c\u63d2\u5165\u56fe\u7247\u300d\u6309\u94ae\u4e0a\u4f20\u5373\u53ef\u3002</div>
  </div>
  <div class="copy-bar">
    <div class="info">
      <span class="label">\u5fae\u4fe1\u516c\u4f17\u53f7\u6392\u7248\u9884\u89c8</span>
      <span class="hint">\u590d\u5236\u540e\u7c98\u8d34\u5230\u5fae\u4fe1\u7f16\u8f91\u5668\uff0c\u518d\u624b\u52a8\u63d2\u5165\u56fe\u7247</span>
    </div>
    <button class="copy-btn" onclick="copyArticle()">
      <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
      <span id="btnText">\u4e00\u952e\u590d\u5236</span>
    </button>
  </div>
  <div class="article-card">
    <div class="article-header">
      <h1 class="article-title">${title}</h1>
      <div class="meta-info">
        <span class="original-tag">Original</span>
        ${author ? `<span>${author}</span><a class="author-link" href="javascript:void(0);">${author}</a>` : ''}
      </div>
    </div>
    <div class="rich_media_content" id="js_content">
${body}
    </div>
    <div class="article-footer">
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
async function copyArticle(){var c=document.getElementById("js_content"),b=document.querySelector(".copy-btn"),t=document.getElementById("btnText"),cl=c.cloneNode(!0);cl.querySelectorAll('section[style*="dashed"]').forEach(function(e){e.remove()});try{var h=cl.innerHTML,bl=new Blob([h],{type:"text/html"}),ci=new ClipboardItem({"text/html":bl,"text/plain":new Blob([cl.innerText],{type:"text/plain"})});await navigator.clipboard.write([ci]);b.classList.add("copied");t.textContent="\\u2713 \\u5df2\\u590d\\u5236";showToast("\\u5df2\\u590d\\u5236\\uff01\\u8bf7\\u6253\\u5f00\\u5fae\\u4fe1\\u7f16\\u8f91\\u5668\\u7c98\\u8d34");setTimeout(function(){b.classList.remove("copied");t.textContent="\\u4e00\\u952e\\u590d\\u5236"},3e3)}catch(e){try{var r=document.createRange(),d=document.createElement("div");d.style.cssText="position:fixed;left:-9999px";d.appendChild(cl);document.body.appendChild(d);r.selectNodeContents(d);var s=window.getSelection();s.removeAllRanges();s.addRange(r);document.execCommand("copy");s.removeAllRanges();document.body.removeChild(d);b.classList.add("copied");t.textContent="\\u2713 \\u5df2\\u590d\\u5236";showToast("\\u5df2\\u590d\\u5236");setTimeout(function(){b.classList.remove("copied");t.textContent="\\u4e00\\u952e\\u590d\\u5236"},3e3)}catch(e2){showToast("\\u590d\\u5236\\u5931\\u8d25")}}}
function showToast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2800)}
</script>
</body>
</html>`;
}

// ---------- Write output ----------
const out = outputFile || inputFile.replace(/\.md$/, '_wechat.html');
const outFull = out.replace(/\.html$/, '_full.html');

fs.writeFileSync(out, buildPage(bodyText));
console.log(`Text version: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

if (imageFiles.length > 0 && imageFiles.some(f => fs.existsSync(f))) {
  fs.writeFileSync(outFull, buildPage(bodyFull));
  console.log(`Full preview: ${outFull} (${(fs.statSync(outFull).size / 1024).toFixed(0)} KB)`);
}

console.log(`Title: ${title}`);
console.log(`Images: ${imageFiles.length}`);
