# WeChat API Publishing Pitfalls

## Inline Vertical Margins (Most Common Issue)

WeChat strips all `<style>` tags. Only inline `style` attributes on individual elements survive. If you rely on page CSS like `.rich_media_content p { margin: 1em 0 }` for paragraph spacing, paragraphs will collapse together in WeChat's editor and reader.

**Wrong** (margin comes from page CSS, gets stripped):
```html
<style>.rich_media_content p { margin: 1em 0 }</style>
<p style="margin-left: 8px; margin-right: 8px;">Paragraph text</p>
```

**Correct** (vertical margin in inline style):
```html
<p style="margin: 1em 8px;">Paragraph text</p>
```

Every `<p>`, `<section>`, blockquote, and list item must carry its own vertical margin inline. The converter uses `margin: 1em 8px` for paragraphs.

## Bold Text Rendering

WeChat API strips nested `<span>` styles. Never nest `<span style="font-weight:bold">` inside `<span style="font-size:15px">`.

**Wrong** (gets stripped):
```html
<p><span style="font-size: 15px;">Normal text <span style="font-weight: bold;">bold text</span> more text</span></p>
```

**Correct** (sibling spans with complete styles):
```html
<p><span style="font-size: 15px;">Normal text </span><span style="font-size: 15px; font-weight: bold;">bold text</span><span style="font-size: 15px;"> more text</span></p>
```

The converter script uses sentinel markers + `buildContent()` to produce sibling spans automatically.

## Content Extraction for API

The preview HTML contains a guide panel, copy bar, header, and footer that must NOT be sent to the API. Only the `<div class="rich_media_content" id="js_content">` content should be extracted.

Use `prepare_api_html.js` to extract cleanly, or `publish_to_wechat.js` which auto-extracts from either `<div id="output">` or `js_content`.

## Base64 Images

The `publish_to_wechat.js` script now handles base64 data URIs directly. It saves each base64 image to a temp file, uploads it to WeChat's `uploadimg` API endpoint (which doesn't count toward permanent material quota), and replaces the `src` with the returned CDN URL.

The separate `prepare_api_html.js` step is no longer required but is kept for backward compatibility.

## Image-Caption Spacing

Caption `<p>` after image `<section>` should use `margin: 0 8px` (no top margin) to keep caption tightly coupled with its image.

## Summary / Digest

WeChat `draft/add` API `digest` field max 120 chars. Write a compelling summary that highlights article value, not just the opening paragraph.

## Original Declaration (原创声明)

WeChat API does NOT support setting original declaration programmatically. After publishing to draft, manually enable in mp.weixin.qq.com editor.

## IP Whitelist

WeChat API requires server IP in whitelist. Configure at mp.weixin.qq.com > Settings > Basic Config > IP Whitelist.

## Credentials Priority

1. CLI flags `--app-id` / `--app-secret`
2. Environment variables `WECHAT_APP_ID` / `WECHAT_APP_SECRET`
3. `.baoyu-skills/.env` in current directory
4. `~/.baoyu-skills/.env`
