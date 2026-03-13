# WeChat API Publishing Pitfalls

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

## Base64 Images Not Supported

WeChat's image upload API only accepts local file paths or HTTP URLs. Base64 data URIs in `<img src="data:...">` cannot be uploaded.

Use `prepare_api_html.js --images` to replace base64 URIs with absolute local file paths before publishing.

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
