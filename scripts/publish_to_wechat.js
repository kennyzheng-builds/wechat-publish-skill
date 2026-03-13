#!/usr/bin/env node
/**
 * Publish WeChat-formatted HTML to WeChat Official Account draft box via API.
 *
 * Usage:
 *   node publish_to_wechat.js <input.html> [options]
 *
 * Options:
 *   --title    "Article Title"    Override title (auto-detected from <title> tag)
 *   --author   "Author Name"     Author name (max 16 chars)
 *   --summary  "Summary text"    Article digest (max 120 chars, should be compelling)
 *   --cover    path/to/cover.jpg Cover image (local path or URL; falls back to first article image)
 *   --app-id   "wxXXXXXX"        WeChat App ID (or env WECHAT_APP_ID)
 *   --app-secret "XXXXXX"        WeChat App Secret (or env WECHAT_APP_SECRET)
 *   --env-file  path/to/.env     Load credentials from .env file
 *   --dry-run                    Parse only, don't publish
 *
 * The HTML file should contain article content inside a <div id="output"> wrapper.
 * Images can be local file paths or URLs; they will be uploaded to WeChat's CDN.
 *
 * Environment variables (in priority order):
 *   1. CLI --app-id / --app-secret flags
 *   2. WECHAT_APP_ID / WECHAT_APP_SECRET env vars
 *   3. .baoyu-skills/.env in current directory
 *   4. ~/.baoyu-skills/.env
 */

const fs = require('fs');
const path = require('path');

// ---------- CLI args ----------
const argv = process.argv.slice(2);
function getFlag(flag) {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : null;
}
const hasFlag = (flag) => argv.includes(flag);

const inputFile = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
if (!inputFile || hasFlag('--help')) {
  console.error('Usage: node publish_to_wechat.js <input.html> [--title ...] [--author ...] [--summary ...] [--cover ...] [--app-id ...] [--app-secret ...] [--env-file ...] [--dry-run]');
  process.exit(inputFile ? 0 : 1);
}

const titleOverride = getFlag('--title');
const authorOverride = getFlag('--author');
const summaryOverride = getFlag('--summary');
const coverPath = getFlag('--cover');
const cliAppId = getFlag('--app-id');
const cliAppSecret = getFlag('--app-secret');
const envFile = getFlag('--env-file');
const dryRun = hasFlag('--dry-run');

// ---------- Load credentials ----------
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const vars = {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

function getCredentials() {
  if (cliAppId && cliAppSecret) return { appId: cliAppId, appSecret: cliAppSecret };

  if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
    return { appId: process.env.WECHAT_APP_ID, appSecret: process.env.WECHAT_APP_SECRET };
  }

  const envPaths = [
    envFile,
    path.join(process.cwd(), '.baoyu-skills', '.env'),
    path.join(require('os').homedir(), '.baoyu-skills', '.env'),
  ].filter(Boolean);

  for (const p of envPaths) {
    const vars = loadEnvFile(p);
    if (vars.WECHAT_APP_ID && vars.WECHAT_APP_SECRET) {
      console.error(`[publish] Loaded credentials from ${p}`);
      return { appId: vars.WECHAT_APP_ID, appSecret: vars.WECHAT_APP_SECRET };
    }
  }

  return null;
}

// ---------- WeChat API functions ----------
async function fetchAccessToken(appId, appSecret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) throw new Error(`Access token error ${data.errcode}: ${data.errmsg}`);
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token;
}

async function uploadImage(imagePath, accessToken, baseDir) {
  let fileBuffer, filename, contentType;

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const response = await fetch(imagePath);
    if (!response.ok) throw new Error(`Failed to download image: ${imagePath}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error(`Remote image is empty: ${imagePath}`);
    fileBuffer = Buffer.from(buffer);
    filename = path.basename(imagePath.split('?')[0]) || 'image.jpg';
    contentType = response.headers.get('content-type') || 'image/jpeg';
  } else {
    const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(baseDir || process.cwd(), imagePath);
    if (!fs.existsSync(resolvedPath)) throw new Error(`Image not found: ${resolvedPath}`);
    if (fs.statSync(resolvedPath).size === 0) throw new Error(`Image is empty: ${resolvedPath}`);
    fileBuffer = fs.readFileSync(resolvedPath);
    filename = path.basename(resolvedPath);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    contentType = mimeTypes[ext] || 'image/jpeg';
  }

  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const header = [`--${boundary}`, `Content-Disposition: form-data; name="media"; filename="${filename}"`, `Content-Type: ${contentType}`, '', ''].join('\r\n');
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(header, 'utf-8'), fileBuffer, Buffer.from(footer, 'utf-8')]);

  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) throw new Error(`Upload failed ${data.errcode}: ${data.errmsg}`);
  if (data.url && data.url.startsWith('http://')) data.url = data.url.replace(/^http:\/\//i, 'https://');
  return data;
}

async function uploadImagesInHtml(html, accessToken, baseDir) {
  const imgRegex = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];
  if (matches.length === 0) return { html, firstMediaId: '', allMediaIds: [] };

  let firstMediaId = '';
  let updatedHtml = html;
  const allMediaIds = [];

  for (const match of matches) {
    const [fullTag, src] = match;
    if (!src) continue;
    // Skip already-uploaded WeChat CDN images
    if (src.startsWith('https://mmbiz.qpic.cn')) {
      if (!firstMediaId) firstMediaId = src;
      continue;
    }
    // Skip base64 data URIs (should not be present in API version)
    if (src.startsWith('data:')) {
      console.error(`[publish] WARNING: Skipping base64 image (not supported by API). Use local file paths.`);
      continue;
    }

    console.error(`[publish] Uploading image: ${src}`);
    try {
      const resp = await uploadImage(src, accessToken, baseDir);
      const newTag = fullTag.replace(/\ssrc=["'][^"']+["']/, ` src="${resp.url}"`);
      updatedHtml = updatedHtml.replace(fullTag, newTag);
      allMediaIds.push(resp.media_id);
      if (!firstMediaId) firstMediaId = resp.media_id;
    } catch (err) {
      console.error(`[publish] Failed to upload ${src}:`, err.message);
    }
  }
  return { html: updatedHtml, firstMediaId, allMediaIds };
}

async function publishToDraft(options, accessToken) {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
  const article = {
    article_type: 'news',
    title: options.title,
    content: options.content,
    thumb_media_id: options.thumbMediaId,
    need_open_comment: 1,
    only_fans_can_comment: 0,
  };
  if (options.author) article.author = options.author;
  if (options.digest) article.digest = options.digest;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articles: [article] }),
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) throw new Error(`Publish failed ${data.errcode}: ${data.errmsg}`);
  return data;
}

// ---------- HTML content extraction ----------
function extractContent(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Prefer <div id="output"> wrapper (API-ready format)
  const outputMatch = html.match(/<div id="output">([\s\S]*?)<\/div>\s*<\/body>/);
  if (outputMatch) return outputMatch[1].trim();
  // Fallback: extract js_content div (from preview HTML)
  const jsMatch = html.match(/<div class="rich_media_content" id="js_content">([\s\S]*?)<\/div>\s*<div class="article-footer">/);
  if (jsMatch) return jsMatch[1].trim();
  // Last resort: body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractTitle(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1];
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
}

// ---------- Main ----------
async function main() {
  const filePath = path.resolve(inputFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const baseDir = path.dirname(filePath);
  const title = titleOverride || extractTitle(filePath) || 'Untitled';
  const author = authorOverride || '';
  let summary = summaryOverride || '';

  if (summary && summary.length > 120) {
    const truncated = summary.slice(0, 117);
    const lastPunct = Math.max(truncated.lastIndexOf('\u3002'), truncated.lastIndexOf('\uff0c'), truncated.lastIndexOf('\uff1b'));
    summary = lastPunct > 80 ? truncated.slice(0, lastPunct + 1) : truncated + '...';
  }

  let htmlContent = extractContent(filePath);

  console.error(`[publish] Title: ${title}`);
  if (author) console.error(`[publish] Author: ${author}`);
  if (summary) console.error(`[publish] Summary: ${summary.slice(0, 50)}...`);
  console.error(`[publish] Content length: ${htmlContent.length} chars`);

  if (dryRun) {
    console.log(JSON.stringify({ title, author: author || undefined, summary: summary || undefined, contentLength: htmlContent.length }, null, 2));
    return;
  }

  const creds = getCredentials();
  if (!creds) {
    console.error('Error: No WeChat API credentials found.');
    console.error('Provide via --app-id/--app-secret flags, WECHAT_APP_ID/WECHAT_APP_SECRET env vars, or .baoyu-skills/.env file.');
    process.exit(1);
  }

  console.error('[publish] Fetching access token...');
  const accessToken = await fetchAccessToken(creds.appId, creds.appSecret);

  console.error('[publish] Uploading images...');
  const { html: processedHtml, firstMediaId, allMediaIds } = await uploadImagesInHtml(htmlContent, accessToken, baseDir);
  htmlContent = processedHtml;
  console.error(`[publish] Uploaded ${allMediaIds.length} images`);

  let thumbMediaId = '';
  if (coverPath) {
    console.error(`[publish] Uploading cover: ${coverPath}`);
    const coverResp = await uploadImage(coverPath, accessToken, baseDir);
    thumbMediaId = coverResp.media_id;
  } else if (firstMediaId) {
    if (firstMediaId.startsWith('https://')) {
      console.error(`[publish] Uploading first image as cover...`);
      const coverResp = await uploadImage(firstMediaId, accessToken, baseDir);
      thumbMediaId = coverResp.media_id;
    } else {
      thumbMediaId = firstMediaId;
    }
  }

  if (!thumbMediaId) {
    console.error('Error: No cover image. Provide via --cover or include images in content.');
    process.exit(1);
  }

  console.error('[publish] Publishing to draft...');
  const result = await publishToDraft({ title, author, digest: summary, content: htmlContent, thumbMediaId }, accessToken);

  console.log(JSON.stringify({ success: true, media_id: result.media_id, title }, null, 2));
  console.error(`[publish] Published successfully! media_id: ${result.media_id}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
