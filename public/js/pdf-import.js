/*
 * Extracts dishes (name, price, description, category, photo) from a text-based PDF menu
 * using only layout heuristics — no AI service involved. Also samples the PDF's colours.
 */
import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';

const { OPS } = pdfjsLib;
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
const CUR = '(?:rs\\.?|lkr|inr|usd|aed|sgd|eur|gbp|aud|cad|thb|myr|rm|\\$|€|£|₹|¥|฿)';
const NUM = '\\d{1,3}(?:[,\\s]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
const PRICE_TOKEN = `(?:${CUR}\\s?)?(?:${NUM})(?:\\s?(?:${CUR}|\\/-|=?\\/=))?`;
// One or more prices at the end of a line, optionally preceded by dot leaders; e.g. "...... 1,450" or "450 / 800"
const TRAIL = new RegExp(`(?:^|[\\s.·…_\\-–—:|]+)(${PRICE_TOKEN}(?:\\s*[/|]\\s*${PRICE_TOKEN})*)\\s*$`, 'i');

function parsePrice(text) {
  const m = text.match(TRAIL);
  if (!m) return null;
  const raw = m[1].trim();
  const hasCur = new RegExp(CUR, 'i').test(raw);
  const digits = raw.replace(/[^\d]/g, '');
  // Reject things that are probably not prices: "Serves 2", years, phone numbers
  if (!hasCur && !/[.,]\d{1,2}$|\d{2,}/.test(raw)) return null;
  if (digits.length > 7 || /^(19|20)\d{2}$/.test(raw)) return null;
  const before = text.slice(0, m.index + m[0].indexOf(m[1]));
  if (/\d\s?[:.]\s?$/.test(before)) return null; // "11:00 – 22:30" is a time, not a price
  const name = text.slice(0, m.index).replace(/[\s.·…_\-–—:|]+$/, '').trim();
  return { price: raw.replace(/\s+/g, ' '), name };
}
// "S T A R T E R S" / "F R O M  T H E  G R I L L" -> "STARTERS" / "FROM THE GRILL"
function unspace(t) {
  const tokens = t.trim().split(/ /);
  if (tokens.length < 4 || tokens.filter(x => x.length <= 2).length / tokens.length < .7) return t;
  return t.trim().split(/\s{2,}/).map(w => w.replace(/\s/g, '')).join(' ');
}
// "LAGOON CRAB CURRY" -> "Lagoon Crab Curry"; mixed-case text is left alone
const SMALL = new Set(['and', 'or', 'of', 'the', 'with', 'in', 'on', 'a', 'de', 'la', 'al']);
function tidy(t) {
  t = t.replace(/\s+/g, ' ').trim();
  if (!isCaps(t)) return t;
  return t.toLowerCase().replace(/[a-zà-ÿ]+/g, (w, i) => i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1));
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const words = s => s.trim().split(/\s+/).length;
const isCaps = s => /[A-Z]/.test(s) && s === s.toUpperCase();

async function pageLines(page, vp) {
  await page.getOperatorList(); // makes font objects (bold/name) available
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const t = it.transform, size = Math.hypot(t[2], t[3]) || it.height;
    const [x, y] = vp.convertToViewportPoint(t[4], t[5]);
    let bold = false, family = null;
    try { const f = page.commonObjs.get(it.fontName); bold = !!(f.bold || f.black || /bold|black|heavy|semibold|demi/i.test(f.name || '')); family = fontFamily(f.name); } catch {}
    items.push({ str: it.str, x, y, w: it.width * vp.scale, size, font: it.fontName, bold, family });
  }
  return items;
}

// Split items into columns using empty vertical bands; columns that only hold prices are merged back
function columns(items, width) {
  if (!items.length) return [];
  // A gap may be crossed by a few items such as a centred title or footer
  const cover = new Uint16Array(Math.ceil(width) + 2);
  for (const it of items) for (let x = Math.max(0, Math.floor(it.x)); x < Math.min(cover.length, it.x + it.w); x++) cover[x]++;
  const allow = Math.max(1, Math.floor(items.length * .04));
  const cuts = [];
  let start = -1;
  for (let x = 0; x < cover.length; x++) {
    const open = cover[x] <= allow;
    if (open && start < 0) start = x;
    if ((!open || x === cover.length - 1) && start >= 0) {
      if (x - start > Math.max(18, width * .03) && start > width * .12 && x < width * .88) cuts.push((start + x) / 2);
      start = -1;
    }
  }
  const bounds = [0, ...cuts, width + 1];
  // Items that straddle a cut (titles) go with the column holding their start
  let cols = bounds.slice(1).map((b, i) => items.filter(it => it.x >= bounds[i] && it.x < b));
  cols = cols.filter(c => c.length);
  // Merge price-only columns into their left neighbour ("Dish name ........ 1,450" laid out in two bands)
  for (let i = cols.length - 1; i > 0; i--) {
    const lines = toLines(cols[i]);
    const priceOnly = lines.filter(l => { const p = parsePrice(l.text); return p && !p.name; }).length;
    if (priceOnly / lines.length > .6) { cols[i - 1] = cols[i - 1].concat(cols[i]); cols.splice(i, 1); }
  }
  return cols;
}

function toLines(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const l = lines.find(l => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.size, it.size) * .45));
    if (l) l.items.push(it); else lines.push({ y: it.y, size: it.size, items: [it] });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    // Letter-spaced headings ("S T A R T E R S") come as one item per letter: only big gaps are word breaks
    const gaps = l.items.slice(1).map((it, i) => it.x - (l.items[i].x + l.items[i].w));
    const spaced = l.items.length >= 4 && l.items.filter(i => i.str.trim().length <= 2).length / l.items.length > .6;
    const gapMin = spaced ? Math.max(median(gaps) * 1.8, l.size * .3) : null;
    let text = '', prevEnd = null;
    for (const it of l.items) {
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      if (prevEnd !== null && gap > (gapMin ?? it.size * .18) && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      // A single run like "S E A F O O D" is one letter-spaced word
      const str = /^(\S ){2,}\S$/.test(it.str.trim()) ? it.str.trim().replace(/ /g, '') : it.str;
      text += spaced ? str.trim() : str; prevEnd = it.x + it.w;
    }
    l.text = unspace(text).replace(/\s+/g, ' ').trim();
    // Style of the line = style of its longest run of text
    const main = l.items.reduce((a, b) => (b.str.length > a.str.length ? b : a));
    l.size = main.size; l.bold = main.bold; l.font = main.font; l.family = main.family;
    l.conf = Math.min(...l.items.map(i => i.conf ?? 100));
    l.x0 = Math.min(...l.items.map(i => i.x)); l.x1 = Math.max(...l.items.map(i => i.x + i.w));
    l.top = l.y - l.size; l.bottom = l.y + l.size * .25;
  }
  return lines.sort((a, b) => a.y - b.y);
}

// Visible bounding boxes of images drawn on the page (viewport coordinates).
// Images are often larger than what shows (cropped by a clipping path), so the clip region is tracked too.
async function pageImages(page, vp) {
  const ops = await page.getOperatorList();
  const out = [], stack = [];
  let m = [1, 0, 0, 1, 0, 0], clip = null, pathBox = null;
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const toBox = (pts) => {
    const v = pts.map(([u, w]) => vp.convertToViewportPoint(m[0] * u + m[2] * w + m[4], m[1] * u + m[3] * w + m[5]));
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  };
  const meet = (a, b) => !a ? b : !b ? a : { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push([m, clip]);
    else if (fn === OPS.restore) [m, clip] = stack.pop() || [m, clip];
    else if (fn === OPS.transform) m = mul(m, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push([m, clip]);
      if (args[0]) m = mul(m, args[0]);
      if (args[1]) { const [a, b, c, d] = args[1]; clip = meet(clip, toBox([[a, b], [c, b], [a, d], [c, d]])); }
    }
    else if (fn === OPS.paintFormXObjectEnd) [m, clip] = stack.pop() || [m, clip];
    else if (fn === OPS.constructPath) {
      // Bounds from the path's own points (curve control points included, which is a safe superset)
      const [pops, coords] = args, pts = [];
      for (let k = 0, j = 0; k < pops.length; k++) {
        const op = pops[k];
        if (op === OPS.rectangle) { const [x, y, w, h] = coords.slice(j, j + 4); pts.push([x, y], [x + w, y + h]); j += 4; }
        else { const n = op === OPS.curveTo ? 6 : op === OPS.curveTo2 || op === OPS.curveTo3 ? 4 : op === OPS.moveTo || op === OPS.lineTo ? 2 : 0; for (let q = 0; q < n; q += 2) pts.push([coords[j + q], coords[j + q + 1]]); j += n; }
      }
      pathBox = pts.length ? toBox(pts) : null;
    }
    else if ((fn === OPS.clip || fn === OPS.eoClip) && pathBox) clip = meet(clip, pathBox);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const box = meet(toBox([[0, 0], [1, 0], [0, 1], [1, 1]]), clip);
      const w = box.x1 - box.x0, h = box.y1 - box.y0;
      box.id = fn === OPS.paintInlineImageXObject ? null : args[0];
      box.area = w * h / (vp.width * vp.height);
      // Skip tiny icons; images covering much of the page are backgrounds
      if (w > 36 && h > 36) out.push(box);
    }
  }
  return out;
}

// Colours the PDF actually uses for text, weighted by number of characters
async function textColours(page) {
  const ops = await page.getOperatorList();
  const counts = new Map(), stack = [];
  let fill = '#000000';
  const TEXT = [OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i];
    if (fn === OPS.save) stack.push(fill);
    else if (fn === OPS.restore) fill = stack.pop() ?? fill;
    else if (fn === OPS.setFillRGBColor) fill = rgbToHex([a[0], a[1], a[2]]);
    else if (TEXT.includes(fn)) {
      const glyphs = (Array.isArray(a[0]) ? a[0] : a[a.length - 1] || []).filter(g => g && g.unicode && g.unicode.trim()).length;
      counts.set(fill, (counts.get(fill) || 0) + glyphs);
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]);
}
const hue = h => { const [r, g, b] = hexToRgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };
const saturation = h => { const [r, g, b] = hexToRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

// Decode an embedded image at its original resolution (no text drawn over it)
async function originalImage(page, id) {
  try {
    const obj = await new Promise((res, rej) => { page.objs.get(id, res); setTimeout(() => rej(new Error('timeout')), 5000); });
    const k = Math.min(1, 2000 / Math.max(obj.width, obj.height));
    const c = document.createElement('canvas'); c.width = Math.round(obj.width * k); c.height = Math.round(obj.height * k);
    const ctx = c.getContext('2d');
    if (obj.bitmap) ctx.drawImage(obj.bitmap, 0, 0, c.width, c.height);
    else if (obj.data && obj.data.length === obj.width * obj.height * 4) {
      const t = document.createElement('canvas'); t.width = obj.width; t.height = obj.height;
      t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(obj.data), obj.width, obj.height), 0, 0);
      ctx.drawImage(t, 0, 0, c.width, c.height);
    } else return null;
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  } catch { return null; }
}

function rectDist(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

function parseColumn(lines, ctx, col) {
  const dishes = [];
  let cur = null;
  for (const l of lines) {
    const p = parsePrice(l.text);
    const styleKey = l.font + '|' + Math.round(l.size);
    const heading = !p && l.text.length <= 40 && words(l.text) <= 6 && /[a-z]/i.test(l.text) &&
      styleKey !== ctx.nameStyle &&
      (l.size >= Math.max(ctx.body * 1.22, ctx.nameSize * 1.15) || (isCaps(l.text) && l.size >= ctx.body * .95 && styleKey !== ctx.nameStyle && (l.bold || ctx.nameIsCaps === false)));
    const nameLike = styleKey === ctx.nameStyle || (l.bold && l.size >= ctx.body * .95 && !ctx.descBold) ||
      (ctx.ocr && l.font === ctx.nameFont && Math.abs(l.size - ctx.nameSize) <= ctx.nameSize * .15 && !p && l.text.length <= 50);
    const box = { x0: l.x0, y0: l.top, x1: l.x1, y1: l.bottom };
    const grow = d => { d.conf = Math.min(d.conf ?? 100, l.conf ?? 100); d.box = d.box ? { x0: Math.min(d.box.x0, box.x0), y0: Math.min(d.box.y0, box.y0), x1: Math.max(d.box.x1, box.x1), y1: Math.max(d.box.y1, box.y1) } : { ...box }; };
    if (heading) { ctx.fam.head.push(l.family); } else if (!p && !nameLike && l.text.length > 25) ctx.fam.body.push(l.family); else if (nameLike || p) ctx.fam.name.push(l.family);
    if (heading) { ctx.headings.push({ text: l.text.replace(/[:\-–—]+$/, '').trim(), y: l.y, col, x0: l.x0, x1: l.x1 }); cur = null; continue; }
    if (p && p.name) {
      if (cur && !cur.price && !nameLike) { cur.price = p.price; cur.description = (cur.description + ' ' + p.name).trim(); grow(cur); continue; }
      cur = { name: p.name, price: p.price, description: '', col, nameBox: { ...box } }; grow(cur); dishes.push(cur); continue;
    }
    if (p && !p.name) {
      if (cur && !cur.price) cur.price = p.price;
      else if (cur) cur.price += ' / ' + p.price;
      if (cur) grow(cur);
      continue;
    }
    if (nameLike && l.text.length <= 60) {
      cur = { name: l.text, price: '', description: '', col, nameBox: { ...box } }; grow(cur); dishes.push(cur); continue;
    }
    if (cur) { cur.description = (cur.description + ' ' + l.text).trim(); grow(cur); }
  }
  return dishes;
}

// "AAAAAA+PlayfairDisplay-BoldItalic" -> "Playfair Display"
function fontFamily(raw) {
  if (!raw) return null;
  let n = raw.replace(/^[A-Z]{6}\+/, '').split(/[-,_]/)[0];
  n = n.replace(/(Regular|Italic|Oblique|Roman|Book|Thin|Hairline|ExtraLight|UltraLight|Light|Medium|SemiBold|DemiBold|ExtraBold|UltraBold|Bold|Black|Heavy|Condensed)+$/i, '').replace(/(MT|PS|Std|Pro|LT|OT)$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();
  if (!n || /^(Times|Helvetica|Arial|Courier|Symbol|Zapf|Calibri|Cambria|Segoe|Liberation|DejaVu|Nimbus|Bitstream|Free ?(Sans|Serif|Mono)|T\d+|F\d+|Font)/i.test(n)) return null;
  return n.slice(0, 40);
}
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const luminance = h => { const v = hexToRgb(h).map(x => x / 255).map(x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));

function sampleColours(canvas) {
  const ctx = canvas.getContext('2d'), { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const bins = new Map(), accent = new Map();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    bins.set(key, (bins.get(key) || 0) + 1);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), sat = max ? (max - min) / max : 0;
    if (sat > .45 && max > 70 && max < 245) accent.set(key, (accent.get(key) || 0) + 1);
  }
  const ranked = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const hex = k => '#' + [k >> 8, (k >> 4) & 15, k & 15].map(v => (v * 16 + 8).toString(16).padStart(2, '0')).join('');
  const all = ranked(bins).map(hex);
  const bg = all[0];
  const dark = luminance(bg) < .3;
  // Text colour: the most common colour that is clearly readable on the background
  let ink = all.find(c => contrast(c, bg) >= 4.5) || (dark ? '#f5f1ea' : '#1c1c1c');
  const acc = ranked(accent).map(hex).find(c => contrast(c, bg) >= 1.8) || null;
  const surface = dark ? mix(bg, '#ffffff', .06) : mix(bg, '#ffffff', .55);
  return { background: bg, ink, accent: acc, surface, muted: mix(ink, bg, .38), dark };
}

// ---------- OCR for scanned menus (tesseract.js, runs in the browser, no API key) ----------
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return tessLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = '/vendor/tesseract/tesseract.min.js';
    s.onload = () => res(window.Tesseract); s.onerror = () => rej(new Error('Could not load the OCR engine.'));
    document.head.appendChild(s);
  });
}
// OCR often confuses O/0 and l/1 inside numbers
const fixDigits = w => /\d/.test(w) && /^[\dOoIl|,.$€£₹]+$/.test(w) && w.replace(/[^\d]/g, '').length >= 1 ? w.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : w;

async function ocrPage(worker, page, onProgress) {
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(3, 1700 / vp.width);   // about 200 dpi: body text is crisp and large titles stay readable
  const pv = page.getViewport({ scale });
  const canvas = document.createElement('canvas'); canvas.width = pv.width; canvas.height = pv.height;
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: cx, viewport: pv }).promise;
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const px = cx.getImageData(0, 0, canvas.width, canvas.height).data;
  const lumAt = (x, y) => { const i = (y * canvas.width + x) * 4; return .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; };
  // Page background brightness, to tell ink from paper on light and dark menus
  const samples = []; for (let i = 0; i < 400; i++) samples.push(lumAt(Math.floor(Math.random() * canvas.width), Math.floor(Math.random() * canvas.height)));
  const bgLum = median(samples), darkPage = bgLum < 110;
  const inkDensity = b => {
    let ink = 0, n = 0;
    for (let y = b.y0; y < b.y1; y += 2) for (let x = b.x0; x < b.x1; x += 2) { const l = lumAt(x, y); n++; if (darkPage ? l > bgLum + 70 : l < bgLum - 70) ink++; }
    return n ? ink / n : 0;
  };
  const lines = [];
  for (const block of data.blocks || []) for (const para of block.paragraphs || []) for (const line of para.lines || []) {
    // Drop junk that dotted leaders and specks turn into: near-zero confidence, pure punctuation,
    // or "words" much shorter than the rest of the line (dots sit low and small)
    const raw = (line.words || []).filter(w => w.text && w.text.trim());
    const hMed = median(raw.map(w => w.bbox.y1 - w.bbox.y0));
    const words = raw.filter(w => w.confidence >= 20 && !/^[.\-_—–=·•:;,'"`~*]+$/.test(w.text) && (w.bbox.y1 - w.bbox.y0) >= hMed * .55);
    if (!words.length) continue;
    // Font size from letter heights: a word's box covers capitals/ascenders and/or descenders
    const h = median(words.map(w => {
      const t = w.text, asc = /[A-Z0-9bdfhklt$€£₹(){}\[\]|\/@]/.test(t), desc = /[gjpqy$(){}\[\]|@,;]/.test(t);
      return (w.bbox.y1 - w.bbox.y0) / (asc && desc ? .93 : asc || desc ? .72 : .5);
    })) / scale;
    const base = line.baseline && isFinite(line.baseline.y0) ? (line.baseline.y0 + line.baseline.y1) / 2 / scale : line.bbox.y1 / scale;
    // Ink density relative to height: thicker strokes = bold
    const dens = words.map(w => inkDensity(w.bbox)).reduce((a, b) => a + b, 0) / words.length;
    lines.push({ words, size: h, base, dens, conf: Math.min(...words.map(w => w.confidence)) });
  }
  onProgress?.();
  return { lines, canvas, scale, vp };
}

// Group similar sizes so small OCR jitter doesn't create fake "styles"
function snapSizes(values) {
  const sorted = [...values].sort((a, b) => a - b), groups = [];
  // Split only where neighbouring sizes jump by more than 9%, so jitter within one style stays together
  for (const v of sorted) { const g = groups.at(-1); if (g && v <= g.at(-1) * 1.09 && v <= g[0] * 1.3) g.push(v); else groups.push([v]); }
  return v => { const g = groups.find(g => v >= g[0] && v <= g.at(-1)); return g ? Math.round(median(g) * 2) / 2 : v; };
}

function ocrItems(pagesOcr) {
  const allLines = pagesOcr.flatMap(p => p.lines);
  const snap = snapSizes(allLines.map(l => l.size));
  const densities = allLines.map(l => l.dens).filter(d => d > 0);
  const boldCut = median(densities) * 1.28;
  // One item per run of words; a wide gap (with nothing but leaders in it) splits the run,
  // so the existing column and price logic sees the same shapes as in a text PDF
  return pagesOcr.map(p => p.lines.flatMap(l => {
    const size = snap(l.size), bold = l.dens > boldCut, runs = [];
    for (const w of l.words) {
      const prev = runs.at(-1), gap = prev ? w.bbox.x0 - prev.x1 : 0;
      if (prev && gap < (w.bbox.y1 - w.bbox.y0) * 1.6) { prev.words.push(w); prev.x1 = w.bbox.x1; }
      else runs.push({ words: [w], x0: w.bbox.x0, x1: w.bbox.x1 });
    }
    return runs.map(r => ({
      str: r.words.map(w => fixDigits(w.text)).join(' '), x: r.x0 / p.scale, y: l.base, w: (r.x1 - r.x0) / p.scale,
      size, font: 'ocr' + (bold ? 'B' : 'R'), bold, family: null, conf: Math.min(...r.words.map(w => w.confidence)),
    }));
  }));
}

// Photos printed inside a scan: colourful / textured areas that contain no text
let debugPhotos = null;
function scanPhotos(canvas, scale, vp, items) {
  const cell = 4, gw = Math.ceil(vp.width / cell), gh = Math.ceil(vp.height / cell);
  const small = document.createElement('canvas'); small.width = gw * 4; small.height = gh * 4;
  const sx = small.getContext('2d', { willReadFrequently: true }); sx.drawImage(canvas, 0, 0, small.width, small.height);
  const d = sx.getImageData(0, 0, small.width, small.height).data;
  const text = new Uint8Array(gw * gh);
  for (const it of items) {
    const x0 = Math.max(0, Math.floor(it.x / cell) - 1), x1 = Math.min(gw - 1, Math.ceil((it.x + it.w) / cell) + 1);
    const y0 = Math.max(0, Math.floor((it.y - it.size) / cell) - 1), y1 = Math.min(gh - 1, Math.ceil((it.y + it.size * .3) / cell) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) text[y * gw + x] = 1;
  }
  // Cell statistics, then compare each cell with the page's own background colour
  const stats = new Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let r0 = 0, g0 = 0, b0 = 0, sum = 0, sum2 = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const i = ((gy * 4 + y) * small.width + gx * 4 + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], l = .299 * r + .587 * g + .114 * b;
      r0 += r; g0 += g; b0 += b; sum += l; sum2 += l * l;
    }
    stats[gy * gw + gx] = { r: r0 / 16, g: g0 / 16, b: b0 / 16, std: Math.sqrt(Math.max(0, sum2 / 16 - (sum / 16) ** 2)) };
  }
  const free = stats.filter((_, i) => !text[i]);
  const bg = ['r', 'g', 'b'].map(k => median(free.map(c => c[k])));
  const bgStd = median(free.map(c => c.std));
  const photo = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) {
    if (text[i]) continue;
    const c = stats[i], dist = Math.hypot(c.r - bg[0], c.g - bg[1], c.b - bg[2]);
    if (dist > 45 || c.std > bgStd + 20) photo[i] = 1;
  }
  // Printed rules and borders are long and thin; photos never are. Remove them so they can't join photos
  const thick = (x, y, dx, dy) => { let n = 1; for (const sgn of [-1, 1]) for (let k = 1; k <= 3; k++) { const xx = x + dx * k * sgn, yy = y + dy * k * sgn; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh || !photo[yy * gw + xx]) break; n++; } return n; };
  const thin = new Uint8Array(gw * gh);
  for (const horiz of [true, false]) {
    const A = horiz ? gh : gw, B = horiz ? gw : gh;
    for (let a = 0; a < A; a++) {
      let start = -1;
      for (let b = 0; b <= B; b++) {
        const on = b < B && photo[horiz ? a * gw + b : b * gw + a];
        if (on && start < 0) start = b;
        if (!on && start >= 0) {
          if (b - start >= 20) for (let k = start; k < b; k++) {
            const x = horiz ? k : a, y = horiz ? a : k;
            if (thick(x, y, horiz ? 0 : 1, horiz ? 1 : 0) <= 2) thin[y * gw + x] = 1;
          }
          start = -1;
        }
      }
    }
  }
  for (let i = 0; i < gw * gh; i++) if (thin[i]) photo[i] = 0;
  // Close small gaps (flat areas inside a photo), then find connected regions
  const grown = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (photo[y * gw + x])
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < gh && xx >= 0 && xx < gw && !text[yy * gw + xx]) grown[yy * gw + xx] = 1; }
  const seen = new Uint8Array(gw * gh), boxes = [], comps = [];
  for (let i = 0; i < gw * gh; i++) {
    if (!grown[i] || seen[i]) continue;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, n = 0, hits = 0; const stack = [i]; seen[i] = 1;
    while (stack.length) {
      const k = stack.pop(), x = k % gw, y = (k - x) / gw; n++; if (photo[k]) hits++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const nk of [k - 1, k + 1, k - gw, k + gw]) if (nk >= 0 && nk < gw * gh && !seen[nk] && grown[nk] && Math.abs((nk % gw) - x) <= 1) { seen[nk] = 1; stack.push(nk); }
    }
    comps.push([x0, y0, x1, y1]);
  }
  // A white plate can break one photo into pieces: merge pieces that overlap or touch
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < comps.length && !changed; i++) for (let j = i + 1; j < comps.length && !changed; j++) {
      const a = comps[i], b = comps[j];
      if (a[0] <= b[2] + 1 && b[0] <= a[2] + 1 && a[1] <= b[3] + 1 && b[1] <= a[3] + 1) {
        comps[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; comps.splice(j, 1); changed = true;
      }
    }
  }
  for (const [x0, y0, x1, y1] of comps) {
    // Neighbouring photos joined by a printed rule or a narrow gap: cut at nearly empty bands
    const cut = (ax, ay, bx, by, depth) => {
      if (depth > 6) return [[ax, ay, bx, by]];
      for (const horiz of [false, true]) {
        const len = horiz ? bx - ax + 1 : by - ay + 1, n = horiz ? by - ay + 1 : bx - ax + 1;
        const cov = [];
        for (let a = 0; a < n; a++) { let c = 0; for (let b2 = 0; b2 < len; b2++) { const xx = horiz ? ax + b2 : ax + a, yy = horiz ? ay + a : ay + b2; if (photo[yy * gw + xx]) c++; } cov.push(c / len); }
        // A real gap between photos: straight photo edges on both sides, or an elongated region
        // that splits into two photo-shaped pieces (a white plate inside one photo is neither)
        const W = bx - ax + 1, H = by - ay + 1, along = horiz ? H : W, across = horiz ? W : H;
        for (let a = 2; a < n - 2; a++) {
          if (cov[a] >= .12) continue;
          let end = a; while (end + 1 < n && cov[end + 1] < .12) end++;
          const s0 = a; a = end;
          if (end - s0 + 1 < 2 || s0 < 9 || n - end - 1 < 9) continue;
          const straight = cov[s0 - 1] >= .5 && cov[end + 1] >= .5;
          const shape = l => Math.max(l, across) / Math.min(l, across) <= 1.8;
          const twoPhotos = along / across > 1.5 && shape(s0) && shape(n - end - 1);
          if (!straight && !twoPhotos) continue;
          return horiz ? [...cut(ax, ay, bx, ay + s0 - 1, depth + 1), ...cut(ax, ay + end + 1, bx, by, depth + 1)]
                       : [...cut(ax, ay, ax + s0 - 1, by, depth + 1), ...cut(ax + end + 1, ay, bx, by, depth + 1)];
        }
      }
      return [[ax, ay, bx, by]];
    };
    for (const [cx0, cy0, cx1, cy1] of cut(x0, y0, x1, y1, 0)) {
      let h2 = 0; for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) if (photo[y * gw + x]) h2++;
      const box = { x0: cx0 * cell, y0: cy0 * cell, x1: (cx1 + 1) * cell, y1: (cy1 + 1) * cell };
      const w = box.x1 - box.x0, h = box.y1 - box.y0, area = w * h / (vp.width * vp.height);
      if (w >= 36 && h >= 36 && area < .45 && h2 / ((cx1 - cx0 + 1) * (cy1 - cy0 + 1)) > .3 && Math.max(w / h, h / w) < 3.5) boxes.push({ ...box, area, id: null });
    }
  }
  if (debugPhotos) debugPhotos.push(boxes.map(b => [b.x0, b.y0, b.x1, b.y1].map(Math.round)));
  return boxes;
}

/** Returns { dishes: [{name, price, description, category, photo (Blob|null)}], colours, hasText, pages } */
export async function extractMenu(url, { onProgress, onStatus, debug } = {}) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const pagesData = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 });
    pagesData.push({ page, vp, items: await pageLines(page, vp) });
    onProgress?.(n / pdf.numPages * .4);
  }
  let all = pagesData.flatMap(p => p.items);
  // No selectable text: the PDF is a scan or a picture, so read it with OCR
  let ocr = false;
  if (all.length < 5) {
    ocr = true;
    onStatus?.('This PDF is a scanned image — reading the text with OCR. This can take a minute…');
    const T = await loadTesseract();
    let done = 0;
    const worker = await T.createWorker('eng', 1, {
      workerPath: '/vendor/tesseract/worker.min.js', corePath: '/vendor/tesseract-core', langPath: '/vendor/tessdata',
      logger: m => { if (m.status === 'recognizing text') onProgress?.(.4 + (done + m.progress) / pagesData.length * .45); },
    });
    try {
      const pagesOcr = [];
      for (const pd of pagesData) { pagesOcr.push(await ocrPage(worker, pd.page)); done++; }
      ocrItems(pagesOcr).forEach((items, i) => { pagesData[i].items = items; pagesData[i].ocr = pagesOcr[i]; });
    } finally { await worker.terminate(); }
    all = pagesData.flatMap(p => p.items);
    if (all.length < 5) return { dishes: [], colours: null, hasText: false, ocr, pages: pdf.numPages };
  }

  // Body text size = most common size by character count
  const bySize = new Map();
  for (const it of all) { const k = Math.round(it.size * 2) / 2; bySize.set(k, (bySize.get(k) || 0) + it.str.length); }
  const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // First pass: the style used by lines that carry both a name and a price is the "dish name" style
  const colLines = pagesData.map(p => columns(p.items, p.vp.width).map(toLines));
  const styleCount = new Map(), descBold = [];
  for (const cols of colLines) for (const lines of cols) for (const l of lines) {
    const p = parsePrice(l.text);
    if (p && p.name && p.name.length < 60) { const k = l.font + '|' + Math.round(l.size); styleCount.set(k, (styleCount.get(k) || 0) + 1); }
    else if (!p && l.text.length > 50) descBold.push(l.bold);
  }
  // If prices sit on their own lines, the name style is the style of the line just above most prices
  if (!styleCount.size) for (const cols of colLines) for (const lines of cols) lines.forEach((l, i) => {
    const p = parsePrice(l.text);
    if (p && !p.name) for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
      const prev = lines[j];
      if (prev.bold || prev.size > body * 1.02 || j === i - 1 && i < 2) { const k = prev.font + '|' + Math.round(prev.size); styleCount.set(k, (styleCount.get(k) || 0) + 1); break; }
    }
  });
  if (debug) debugPhotos = debug.photos = [];
  if (debug) debug.lines = colLines.map(cols => cols.map(lines => lines.map(l => `${l.font}|${Math.round(l.size)}${l.bold ? 'B' : ''} ${l.text}`)));
  const nameStyle = [...styleCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const nameLines = colLines.flat(2).filter(l => l.font + '|' + Math.round(l.size) === nameStyle);
  const ctx = { ocr, nameFont: nameStyle ? nameStyle.split('|')[0] : null, fam: { head: [], name: [], body: [] }, body, nameStyle, nameSize: nameStyle ? +nameStyle.split('|')[1] : body, lastCategory: '', descBold: descBold.filter(Boolean).length > descBold.length / 2, nameIsCaps: nameLines.length ? nameLines.filter(l => isCaps(l.text)).length > nameLines.length / 2 : null };

  const dishes = [];
  for (let pi = 0; pi < pagesData.length; pi++) {
    const { page, vp } = pagesData[pi];
    const pageDishes = [];
    ctx.headings = [];
    colLines[pi].forEach((lines, ci) => pageDishes.push(...parseColumn(lines, ctx, ci)));
    // A heading applies to dishes below it in its own column, or in other columns if nothing else is on its row
    const busy = (h, col) => colLines[pi][col].some(l => Math.abs(l.y - h.y) < l.size * 1.5);
    for (const d of pageDishes) {
      const above = ctx.headings.filter(h => h.y < d.nameBox.y1 && (h.col === d.col || !busy(h, d.col))).sort((a, b) => b.y - a.y)[0];
      d.category = above ? above.text : ctx.lastCategory || '';
      d.order = [above ? above.col : -1, above ? above.y : -1, d.col, d.nameBox.y0];
    }
    // Reading order: by heading, then column, then top-to-bottom
    pageDishes.sort((a, b) => { for (let i = 0; i < 4; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i]; return 0; });
    const lastH = ctx.headings.sort((a, b) => a.col - b.col || a.y - b.y).at(-1);
    if (lastH) ctx.lastCategory = lastH.text;
    // Photos: render the page once and crop each image's area, then give it to the nearest dish
    const allImgs = pagesData[pi].ocr ? [] : await pageImages(page, vp);
    const imgs = pagesData[pi].ocr ? scanPhotos(pagesData[pi].ocr.canvas, pagesData[pi].ocr.scale, vp, pagesData[pi].items) : allImgs.filter(b => b.area < .45);
    // Background artwork: the biggest image covering much of the first page, taken at original resolution
    if (pi === 0 && !ocr) {
      const bgImg = allImgs.filter(b => b.area >= .45 && b.id).sort((a, b) => b.area - a.area)[0];
      if (bgImg) ctx.background = await originalImage(page, bgImg.id);
    }
    if (imgs.length && pageDishes.length) {
      const scale = 2.5, canvas = document.createElement('canvas'), pv = page.getViewport({ scale });
      canvas.width = pv.width; canvas.height = pv.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: pv }).promise;
      // Scans: a photo can be detected as several pieces. Give each piece to its nearest dish and
      // join the pieces each dish received, so the crop is the whole photo
      if (pagesData[pi].ocr) {
        const byDish = new Map();
        imgs.forEach(im => {
          let best = null;
          // Prefer the dish whose text runs beside the photo (same rows) or under/over it (same columns)
          const cx = (im.x0 + im.x1) / 2, cy = (im.y0 + im.y1) / 2;
          pageDishes.forEach((d, di) => {
            const b = d.box || d.nameBox, aligned = (cy >= b.y0 - 4 && cy <= b.y1 + 4) || (cx >= b.x0 && cx <= b.x1);
            const sc = Math.min(rectDist(im, b), rectDist(im, d.nameBox)) + rectDist(im, d.nameBox) * .25 + (aligned ? 0 : 40);
            if (!best || sc < best.sc) best = { di, sc };
          });
          if (best && best.sc <= Math.max(90, vp.width * .18)) (byDish.get(best.di) || byDish.set(best.di, []).get(best.di)).push(im);
        });
        imgs.length = 0;
        for (const [di, pieces] of byDish) {
          pieces.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
          let u = { ...pieces[0] };
          for (const q of pieces.slice(1)) if (rectDist(u, q) <= 16) u = { x0: Math.min(u.x0, q.x0), y0: Math.min(u.y0, q.y0), x1: Math.max(u.x1, q.x1), y1: Math.max(u.y1, q.y1) };
          u.forDish = di; imgs.push(u);
        }
      }
      const pairs = [];
      imgs.forEach((im, ii) => pageDishes.forEach((d, di) => {
        const dist = rectDist(im, d.box || d.nameBox), nameDist = rectDist(im, d.nameBox);
        pairs.push({ ii, di, score: im.forDish === undefined ? Math.min(dist, nameDist) + nameDist * .25 : im.forDish === di ? 0 : Infinity });
      }));
      pairs.sort((a, b) => a.score - b.score);
      const usedI = new Set(), usedD = new Set();
      for (const pr of pairs) {
        if (usedI.has(pr.ii) || usedD.has(pr.di) || pr.score > Math.max(90, vp.width * .18)) continue;
        usedI.add(pr.ii); usedD.add(pr.di);
        const b = imgs[pr.ii], c = document.createElement('canvas');
        const w = (b.x1 - b.x0) * scale, h = (b.y1 - b.y0) * scale, k = Math.min(1, 1400 / Math.max(w, h));
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(canvas, b.x0 * scale, b.y0 * scale, w, h, 0, 0, c.width, c.height);
        pageDishes[pr.di].photo = await new Promise(r => c.toBlob(r, 'image/jpeg', .86));
      }
      if (pi === 0) ctx.colours = sampleColours(canvas);
    }
    if (pi === 0 && !ctx.colours) {
      const pv = page.getViewport({ scale: .6 }), c = document.createElement('canvas');
      c.width = pv.width; c.height = pv.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: pv }).promise;
      ctx.colours = sampleColours(c);
    }
    dishes.push(...pageDishes);
    onProgress?.(.4 + (pi + 1) / pagesData.length * .6);
  }
  // Prefer the exact text colours from the PDF over pixel sampling
  if (ctx.colours) {
    const tc = await textColours(pagesData[0].page), bg = ctx.colours.background;
    const total = tc.reduce((a, [, n]) => a + n, 0) || 1;
    // Main text: frequent and high-contrast (descriptions are frequent but usually softer)
    const ink = tc.filter(([c]) => contrast(c, bg) >= 3.5).sort((a, b) => b[1] * contrast(b[0], bg) ** 2 - a[1] * contrast(a[0], bg) ** 2)[0]?.[0];
    // Accent: the most-used clearly coloured text (headings, prices)
    const acc = tc.find(([c, n]) => c !== ink && saturation(c) > .3 && contrast(c, bg) >= 1.8 && n / total > .02 &&
      (!ink || saturation(ink) < .2 || hueGap(c, ink) > 30))?.[0];
    // Secondary text: the most-used remaining neutral colour
    const muted = tc.find(([c]) => c !== ink && c !== acc && saturation(c) <= .5 && contrast(c, bg) >= 2.5)?.[0];
    if (ink) ctx.colours.ink = ink;
    ctx.colours.muted = muted || mix(ctx.colours.ink, bg, .38);
    if (acc) ctx.colours.accent = acc;
  }
  // Title and subtitle: the largest line near the top of page 1, and the short line right under it
  let subtitle = '';
  const first = colLines[0].flat().filter(l => l.y < pagesData[0].vp.height * .3).sort((a, b) => a.y - b.y);
  const title = first.reduce((a, l) => (!a || l.size > a.size ? l : a), null);
  if (title) {
    const next = first.find(l => l.y > title.y && l.y - title.y < title.size * 2.5 && l.size < title.size * .7);
    if (next && !parsePrice(next.text) && next.text.length <= 60) subtitle = tidy(next.text);
  }
  const pick = arr => { const c = new Map(); arr.filter(Boolean).forEach(f => c.set(f, (c.get(f) || 0) + 1)); return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
  const fonts = { head: pick(ctx.fam.head) || pick(ctx.fam.name), name: pick(ctx.fam.name), body: pick(ctx.fam.body) || pick(ctx.fam.name), nameCaps: ctx.nameIsCaps === true };
  const clean = dishes
    .filter(d => d.name && d.name.length <= 80 && /[a-z]/i.test(d.name) && (d.price || d.description))
    .map(d => ({ check: ocr && (d.conf ?? 100) < 65, name: tidy(ocr ? d.name.replace(/^(?:\S{0,2}[^\w\s&]\S{0,1}\s+|[^A-Za-z\s]+\s+)+/, '') : d.name), price: d.price, description: d.description.slice(0, 400), category: tidy(d.category).slice(0, 40), photo: d.photo || null }));
  // A "subtitle" that is really the first category heading is not a tagline
  if (clean.some(d => d.category.toLowerCase() === subtitle.toLowerCase())) subtitle = '';
  return { ocr, dishes: clean, title: title ? tidy(title.text) : '', subtitle, colours: ctx.colours, fonts, background: ctx.background || null, hasText: true, pages: pdf.numPages };
}
