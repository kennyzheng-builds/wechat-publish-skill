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
| `scripts/publish_to_wechat.js` | Upload images and publish HTML to WeChat draft box via API (handles base64, local files, and URLs) |
| `scripts/prepare_api_html.js` | (Optional) Extract content from preview HTML, replace base64 with local paths |
| `scripts/extract_style.js` | Extract style config from a WeChat article URL (browser-assisted) |

## Workflow

### Step 1: Analyze the Markdown

Read the user's Markdown file. Identify title (H1), sections (H2/H3), bold text, lists, blockquotes, and any image references.

### Step 2: Prepare Images (if provided)

If user provides images:
1. Save/compress images to `outputs/img/` as `01-desc.jpg`, `02-desc.jpg`, etc. (max 1080px wide, quality 82)
2. Determine anchor text for each image -- the text in the article after which the image should appear
3. Write captions for each image
4. Choose one image as cover (user can specify which)

### Step 3: Convert Markdown to WeChat HTML

```bash
node ~/.claude/skills/wechat-publish/scripts/convert_md_to_wechat.js \
  input.md outputs/article.html \
  --title "Title" --author "Author" \
  --images "outputs/img/01.jpg,outputs/img/02.jpg" \
  --anchors "anchor text 1|||anchor text 2" \
  --captions "Caption 1|||Caption 2"
```

Produces:
- `article.html` -- text version with dashed placeholder boxes (for copy-paste workflow)
- `article_full.html` -- full preview with base64-embedded images (for API publishing and preview)

Features included automatically:
- Word count and estimated reading time at top (gray text, not italic)
- All vertical margins in inline styles (critical for WeChat rendering)
- Sibling `<span>` for bold text (WeChat API strips nested span styles)
- Underscore italic `_text_` stripped to plain text

### Step 4: Preview (optional)

Serve HTML to verify formatting before publishing.

```bash
npx -y http-server ./outputs -p 8080 --cors -s &
```

### Step 5: Publish to WeChat Draft

Publish the `_full.html` directly -- the publish script handles base64 image upload automatically.

```bash
node ~/.claude/skills/wechat-publish/scripts/publish_to_wechat.js \
  outputs/article_full.html \
  --title "Title" --author "Author" \
  --summary "Compelling 120-char summary" \
  --cover "outputs/img/cover.jpg"
```

The script will:
1. Extract `#js_content` from the HTML (strips guide panel, copy bar, footer)
2. Upload base64 inline images to WeChat CDN via `uploadimg` API
3. Replace base64 `src` with permanent WeChat CDN URLs
4. Upload cover image via `add_material` API
5. Create draft via `draft/add` API

Credentials auto-loaded from `.baoyu-skills/.env` or `~/.baoyu-skills/.env`, or set via `WECHAT_APP_ID` / `WECHAT_APP_SECRET` env vars.

### Step 6: Post-Publish

Inform user: article is in draft box at mp.weixin.qq.com > 内容管理 > 草稿箱. **原创声明 must be enabled manually** -- API does not support this.

## Critical Rules

For detailed explanations see `references/wechat-api-pitfalls.md`.

- **Inline vertical margins**: Every `<p>` must have vertical margin in its inline `style` attribute (e.g. `margin: 1em 8px`). WeChat strips `<style>` tags -- only inline styles survive. Without this, paragraphs collapse together in the editor.
- **Bold text**: Use sibling `<span>` with complete styles, never nested. WeChat API strips inner span styles.
- **API content**: Only send `js_content` div. Never include guide panel, copy bar, or footer.
- **Base64 images**: The publish script handles these directly -- no separate prepare step needed.
- **Image captions**: `margin: 0 8px` (no top margin) for tight coupling with the image above.
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

If user only wants formatting (no publish), skip Steps 5-6. Serve preview HTML and provide URL.
