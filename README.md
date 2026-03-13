# WeChat Publish Skill

Markdown 一键转为微信公众号排版 HTML，并通过 API 发布到草稿箱。

A Claude Code skill that converts Markdown articles to WeChat Official Account (微信公众号) formatted HTML and publishes to draft box via API.

## Features

- Markdown to WeChat-compatible HTML with inline styles
- Bold text rendered as sibling `<span>` (survives WeChat API sanitization)
- Image insertion with captions at specified anchor points
- One-click copy button for manual paste workflow
- API publishing: upload images + create draft in one step
- Custom style: use any WeChat article URL as formatting reference
- Format-only mode: preview without publishing

## Quick Start

### Install

Copy the `wechat-publish` folder to `~/.claude/skills/`:

```bash
cp -r wechat-publish ~/.claude/skills/
```

Or install from `.skill` file:

```bash
# Unzip the .skill file (it's a zip archive)
unzip wechat-publish.skill -d ~/.claude/skills/wechat-publish
```

### Usage with Claude Code

Tell Claude:

```
帮我把这篇文章发布到微信公众号
```

or in English:

```
Publish this markdown article to my WeChat Official Account
```

Claude will:
1. Read your Markdown file
2. Convert to WeChat-formatted HTML
3. Show you a preview
4. Publish to your WeChat draft box via API

### Format Only (No Publish)

```
帮我把这篇文章做公众号排版
```

Claude will convert and preview without publishing.

## Custom Style

By default, articles use a clean style (15px justified text, centered H2 headings, subtle blockquote borders).

To use your own style from an existing WeChat article:

```
用这篇文章的排版风格：https://mp.weixin.qq.com/s/xxxxx
```

Claude will:
1. Open the article in a browser
2. Extract paragraph, heading, blockquote, caption styles
3. Save as `style.json`
4. Apply to your article via `--style style.json`

### Style Config Format

You can also create a `style.json` manually. Only include fields you want to override — unspecified fields use defaults.

```json
{
  "paragraph": {
    "fontSize": "15px",
    "lineHeight": "1.75em",
    "textAlign": "justify",
    "margin": "0.6em 8px 0",
    "color": ""
  },
  "h2": {
    "fontSize": "16px",
    "fontWeight": "bold",
    "textAlign": "center",
    "lineHeight": "1.75em",
    "margin": "1.6em 8px 0.6em",
    "color": ""
  },
  "h3": {
    "fontSize": "15px",
    "fontWeight": "bold",
    "textAlign": "justify",
    "lineHeight": "1.75em",
    "margin": "1.2em 8px 0.4em",
    "color": ""
  },
  "blockquote": {
    "fontSize": "15px",
    "lineHeight": "1.75em",
    "textAlign": "justify",
    "margin": "0.6em 8px 0",
    "paddingLeft": "12px",
    "borderLeft": "3px solid rgba(0,0,0,0.12)",
    "textColor": "rgba(0,0,0,0.5)"
  },
  "list": {
    "fontSize": "15px",
    "lineHeight": "1.75em",
    "textAlign": "justify",
    "margin": "0.3em 8px 0",
    "bullet": "\u2022"
  },
  "hr": {
    "margin": "1.2em 8px",
    "lineColor": "rgba(0,0,0,0.12)",
    "lineWidth": "30%",
    "symbol": "\u2726",
    "symbolColor": "rgba(0,0,0,0.15)"
  },
  "imageCaption": {
    "fontSize": "12px",
    "color": "rgb(136, 136, 136)",
    "fontStyle": "italic",
    "textAlign": "center",
    "margin": "0 8px"
  }
}
```

See `assets/default-style.json` for the full default config.

## Prerequisites

### WeChat API Credentials

Create `~/.baoyu-skills/.env`:

```
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

Get these from [mp.weixin.qq.com](https://mp.weixin.qq.com) > Settings > Basic Config.

### IP Whitelist

Add your server's IP to the whitelist at mp.weixin.qq.com > Settings > Basic Config > IP Whitelist.

### Node.js

Requires Node.js (v14+). No npm dependencies needed — all scripts use built-in modules only.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/convert_md_to_wechat.js` | Markdown to WeChat HTML with inline styles |
| `scripts/prepare_api_html.js` | Extract article content, replace base64 images |
| `scripts/publish_to_wechat.js` | Upload images and publish to WeChat draft |
| `scripts/extract_style.js` | Extract style config from a WeChat article URL |

### Manual Usage

```bash
# Step 1: Convert Markdown to HTML
node scripts/convert_md_to_wechat.js input.md output.html \
  --title "Article Title" --author "Author Name" \
  --images "img/01.jpg,img/02.jpg" \
  --anchors "text after which image 1 appears|||text for image 2" \
  --captions "Caption 1|||Caption 2" \
  --style style.json

# Step 2: Prepare for API (extract content, fix images)
node scripts/prepare_api_html.js output_full.html output_api.html \
  --images "img/01.jpg,img/02.jpg"

# Step 3: Publish to WeChat draft
node scripts/publish_to_wechat.js output_api.html \
  --title "Article Title" --author "Author Name" \
  --summary "Compelling 120-char summary" \
  --cover "img/01.jpg"
```

## Known Limitations

- **Original declaration (原创声明)** cannot be set via API. Enable manually in mp.weixin.qq.com editor after publishing to draft.
- **Bold text** must use sibling `<span>` elements with complete inline styles. The converter handles this automatically, but manual HTML edits should follow this pattern (see `references/wechat-api-pitfalls.md`).
- **Base64 images** are not supported by WeChat upload API. The pipeline converts them to local file paths automatically.

## License

MIT
