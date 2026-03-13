#!/usr/bin/env node
/**
 * Extract style config from a WeChat Official Account article URL.
 *
 * Usage:
 *   node extract_style.js <wechat_article_url> [output.json]
 *
 * This script is designed to be run by Claude with browser access.
 * It outputs JavaScript code that Claude should execute via `browser console exec`
 * to extract styles from the article page, then saves the result as a style config JSON.
 *
 * Manual workflow (for Claude):
 *   1. browser navigate <url>
 *   2. browser console exec "<extraction_code>"
 *   3. Save the returned JSON as style config
 *
 * Or run this script which prints the extraction code to stdout.
 */

const fs = require('fs');

const url = process.argv[2];
const outputFile = process.argv[3] || 'style.json';

if (!url) {
  console.error('Usage: node extract_style.js <url> [output.json]');
  console.error('');
  console.error('This script prints JavaScript extraction code for use with browser console exec.');
  console.error('Run the output code in the browser after navigating to a WeChat article.');
  process.exit(1);
}

// If a JSON file is passed as first arg (already extracted), just validate it
if (url.endsWith('.json') && fs.existsSync(url)) {
  try {
    const data = JSON.parse(fs.readFileSync(url, 'utf8'));
    console.log('Valid style config:', JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }
}

// Print the extraction code for browser console exec
const extractionCode = `
(function() {
  var content = document.getElementById('js_content') || document.querySelector('.rich_media_content');
  if (!content) return JSON.stringify({error: 'No article content found'});

  function getStyle(el) {
    if (!el) return {};
    var cs = window.getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      color: cs.color,
      fontWeight: cs.fontWeight,
      margin: el.style.margin || '',
      paddingLeft: cs.paddingLeft,
      borderLeft: cs.borderLeft || cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor
    };
  }

  // Find first regular paragraph (not heading, not blockquote)
  var paragraphs = content.querySelectorAll('p, section > p');
  var pStyle = null;
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];
    var text = p.textContent.trim();
    if (text.length > 20 && !p.closest('blockquote') && !p.querySelector('strong:only-child')) {
      var span = p.querySelector('span[style]') || p;
      var s = getStyle(span);
      var ps = getStyle(p);
      pStyle = {
        fontSize: s.fontSize || '15px',
        lineHeight: ps.lineHeight || '1.75em',
        textAlign: ps.textAlign || 'justify',
        margin: ps.margin || p.style.margin || '0.6em 8px 0',
        color: s.color && s.color !== 'rgb(0, 0, 0)' ? s.color : ''
      };
      break;
    }
  }
  if (!pStyle) pStyle = { fontSize: '15px', lineHeight: '1.75em', textAlign: 'justify', margin: '0.6em 8px 0', color: '' };

  // Find H2
  var h2s = content.querySelectorAll('h2, [style*="font-size"][style*="bold"]');
  var h2Style = { fontSize: '16px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.75em', margin: '1.6em 8px 0.6em', color: '' };
  // Try section headings with larger font
  var allSpans = content.querySelectorAll('span[style]');
  for (var i = 0; i < allSpans.length; i++) {
    var sp = allSpans[i];
    var ss = sp.style;
    var fs = parseInt(ss.fontSize);
    if (fs >= 16 && (ss.fontWeight === 'bold' || parseInt(ss.fontWeight) >= 700)) {
      var parent = sp.closest('p, section');
      var ps2 = parent ? getStyle(parent) : {};
      h2Style = {
        fontSize: ss.fontSize || '16px',
        fontWeight: 'bold',
        textAlign: ps2.textAlign || 'center',
        lineHeight: ps2.lineHeight || '1.75em',
        margin: parent ? (parent.style.margin || '1.6em 8px 0.6em') : '1.6em 8px 0.6em',
        color: ss.color || ''
      };
      break;
    }
  }

  // Find H3 (slightly smaller than H2 bold)
  var h3Style = { fontSize: '15px', fontWeight: 'bold', textAlign: 'justify', lineHeight: '1.75em', margin: '1.2em 8px 0.4em', color: '' };

  // Find blockquote
  var bqs = content.querySelectorAll('[style*="border-left"], blockquote');
  var bqStyle = { fontSize: '15px', lineHeight: '1.75em', textAlign: 'justify', margin: '0.6em 8px 0', paddingLeft: '12px', borderLeft: '3px solid rgba(0,0,0,0.12)', textColor: 'rgba(0,0,0,0.5)' };
  if (bqs.length > 0) {
    var bq = bqs[0];
    var bs = getStyle(bq);
    var bqSpan = bq.querySelector('span[style]');
    var bss = bqSpan ? getStyle(bqSpan) : {};
    bqStyle = {
      fontSize: bss.fontSize || pStyle.fontSize,
      lineHeight: bs.lineHeight || pStyle.lineHeight,
      textAlign: bs.textAlign || 'justify',
      margin: bq.style.margin || '0.6em 8px 0',
      paddingLeft: bs.paddingLeft || '12px',
      borderLeft: bq.style.borderLeft || bs.borderLeft || '3px solid rgba(0,0,0,0.12)',
      textColor: bss.color || bs.color || 'rgba(0,0,0,0.5)'
    };
  }

  // Find image caption
  var capStyle = { fontSize: '12px', color: 'rgb(136, 136, 136)', fontStyle: 'italic', textAlign: 'center', margin: '0 8px' };
  var imgs = content.querySelectorAll('img');
  if (imgs.length > 0) {
    var imgParent = imgs[0].closest('section, p');
    if (imgParent && imgParent.nextElementSibling) {
      var capEl = imgParent.nextElementSibling;
      var capSpan = capEl.querySelector('span[style]') || capEl;
      var cs3 = getStyle(capSpan);
      if (parseInt(cs3.fontSize) <= 14) {
        capStyle = {
          fontSize: cs3.fontSize || '12px',
          color: cs3.color || 'rgb(136,136,136)',
          fontStyle: capSpan.style.fontStyle || 'italic',
          textAlign: getStyle(capEl).textAlign || 'center',
          margin: capEl.style.margin || '0 8px'
        };
      }
    }
  }

  var result = {
    _name: 'extracted',
    _description: 'Style extracted from: ' + window.location.href,
    _source: window.location.href,
    paragraph: pStyle,
    h2: h2Style,
    h3: h3Style,
    blockquote: bqStyle,
    list: { fontSize: pStyle.fontSize, lineHeight: pStyle.lineHeight, textAlign: pStyle.textAlign, margin: '0.3em 8px 0', bullet: '\\u2022' },
    hr: { margin: '1.2em 8px', lineColor: 'rgba(0,0,0,0.12)', lineWidth: '30%', symbol: '\\u2726', symbolColor: 'rgba(0,0,0,0.15)' },
    imageCaption: capStyle
  };

  return JSON.stringify(result, null, 2);
})()
`.trim();

console.log('// Navigate to the WeChat article first, then run this in browser console:');
console.log('// browser navigate ' + url);
console.log('// browser console exec "...(code below)..."');
console.log('');
console.log(extractionCode);
console.log('');
console.log('// Save the output JSON to: ' + outputFile);
