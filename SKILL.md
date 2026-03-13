---
name: wechat-publish
description: Convert Markdown articles to WeChat Official Account (微信公众号) formatted HTML and publish to draft box via API. Full pipeline from markdown to published draft with image support. Use when the user mentions "发公众号", "发布到微信", "微信公众号发布", "publish to wechat", "wechat publish", "公众号排版并发布", or wants to convert markdown to WeChat HTML and publish via API. Also handles format-only (no publish) when user just wants WeChat HTML preview with "公众号排版", "微信排版", "wechat format".
---

# WeChat Publish

End-to-end pipeline: Markdown -> WeChat-formatted HTML -> Publish to WeChat Official Account draft box via API.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/convert_md_to_wechat.js` | Convert Markdown to WeChat HTML with inline styles, image placeholders, and copy button |
| `scripts/prepare_api_html.js` | Extract article content from preview HTML, replace base64 images with local paths |
| `scripts/publish_to_wechat.js` | Upload images and publish HTML to WeChat draft box via API |
| `scripts/extract_style.js` | Extract style config from a WeChat article URL (browser-assisted) |

## Workflow

### Step 1: Analyze the Markdown

Read the user's Markdown file. Identify title (H1), sections (H2/H3), bold text, lists, blockquotes, and any image references.

### Step 2: Prepare Images (if needed)

If user provides images or a URL for screenshots:
1. Save images to `outputs/img/` as `01-desc.jpg`, `02-desc.jpg`, etc.
2. Determine anchor text (text after which each image should appear)
3. Write captions for each image

### Step 3: Convert Markdown to WeChat HTML

```bash
node ~/.claude/skills/wechat-publish/scripts/convert_md_to_wechat.js \
  input.md outputs/article.html \
  --title "Title" --author "Author" \
  --images "outputs/img/01.jpg,outputs/img/02.jpg" \
  --anchors "anchor text 1|||anchor text 2" \
  --captions "Caption 1|||Caption 2"
```

Produces `article.html` (placeholders) and `article_full.html` (base64 images).

### Step 4: Preview

Serve HTML and open browser to verify formatting before publishing.

```bash
npx -y http-server ./outputs -p 8080 --cors -s &
```

### Step 5: Prepare API Version

```bash
node ~/.claude/skills/wechat-publish/scripts/prepare_api_html.js \
  outputs/article_full.html outputs/article_api.html \
  --images "outputs/img/01.jpg,outputs/img/02.jpg"
```

### Step 6: Publish to WeChat Draft

```bash
node ~/.claude/skills/wechat-publish/scripts/publish_to_wechat.js \
  outputs/article_api.html \
  --title "Title" --author "Author" \
  --summary "Compelling 120-char summary" \
  --cover "outputs/img/01.jpg"
```

Credentials auto-loaded from `.baoyu-skills/.env` or `~/.baoyu-skills/.env`.

### Step 7: Post-Publish

Inform user: article is in draft box. **原创声明 must be enabled manually** in mp.weixin.qq.com editor -- API does not support this.

## Critical Rules

For detailed explanations see `references/wechat-api-pitfalls.md`.

- **Bold text**: Use sibling `<span>` with complete styles, never nested. WeChat API strips inner span styles.
- **API content**: Only send `js_content` div. Never include guide panel, copy bar, or footer.
- **Base64 images**: Replace with local file paths before API upload.
- **Image captions**: `margin: 0 8px` (no top margin) for tight coupling.
- **Summary**: Write compelling 120-char digest, not article opening text.
- **原创声明**: Cannot be set via API. Manual step after publishing to draft.

## Custom Style from Article URL

If user provides a WeChat article URL as style reference:

1. `browser navigate <article_url>`
2. Run extraction code from `scripts/extract_style.js` via `browser console exec`
3. Save returned JSON as `style.json`
4. Pass `--style style.json` to `convert_md_to_wechat.js`

The extraction script reads paragraph font-size/line-height/color, heading styles, blockquote borders, image caption styles, etc. Default style is in `assets/default-style.json`.

Config fields that can be customized: `paragraph`, `h2`, `h3`, `blockquote`, `list`, `hr`, `imageCaption`. Only override fields you want to change -- unspecified fields use defaults.

## Format-Only Mode

If user only wants formatting (no publish), skip Steps 5-7. Serve preview HTML and provide URL.
