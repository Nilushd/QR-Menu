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
    const nameLike = styleKey === ctx.nameStyle || (l.bold && l.size >= ctx.body * .95 && !ctx.descBold);
    const box = { x0: l.x0, y0: l.top, x1: l.x1, y1: l.bottom };
    const grow = d => { d.box = d.box ? { x0: Math.min(d.box.x0, box.x0), y0: Math.min(d.box.y0, box.y0), x1: Math.max(d.box.x1, box.x1), y1: Math.max(d.box.y1, box.y1) } : { ...box }; };
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

/** Returns { dishes: [{name, price, description, category, photo (Blob|null)}], colours, hasText, pages } */
export async function extractMenu(url, { onProgress } = {}) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const pagesData = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 });
    pagesData.push({ page, vp, items: await pageLines(page, vp) });
    onProgress?.(n / pdf.numPages * .4);
  }
  const all = pagesData.flatMap(p => p.items);
  if (all.length < 5) return { dishes: [], colours: null, hasText: false, pages: pdf.numPages };

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
  const nameStyle = [...styleCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const nameLines = colLines.flat(2).filter(l => l.font + '|' + Math.round(l.size) === nameStyle);
  const ctx = { fam: { head: [], name: [], body: [] }, body, nameStyle, nameSize: nameStyle ? +nameStyle.split('|')[1] : body, lastCategory: '', descBold: descBold.filter(Boolean).length > descBold.length / 2, nameIsCaps: nameLines.length ? nameLines.filter(l => isCaps(l.text)).length > nameLines.length / 2 : null };

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
    const allImgs = await pageImages(page, vp);
    const imgs = allImgs.filter(b => b.area < .45);
    // Background artwork: the biggest image covering much of the first page, taken at original resolution
    if (pi === 0) {
      const bgImg = allImgs.filter(b => b.area >= .45 && b.id).sort((a, b) => b.area - a.area)[0];
      if (bgImg) ctx.background = await originalImage(page, bgImg.id);
    }
    if (imgs.length && pageDishes.length) {
      const scale = 2.5, canvas = document.createElement('canvas'), pv = page.getViewport({ scale });
      canvas.width = pv.width; canvas.height = pv.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: pv }).promise;
      const pairs = [];
      imgs.forEach((im, ii) => pageDishes.forEach((d, di) => {
        const dist = rectDist(im, d.box || d.nameBox), nameDist = rectDist(im, d.nameBox);
        pairs.push({ ii, di, score: Math.min(dist, nameDist) + nameDist * .25 });
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
    .filter(d => d.name && d.name.length <= 80 && /[a-z]/i.test(d.name) && (d.price || d.description || d.photo))
    .map(d => ({ name: tidy(d.name), price: d.price, description: d.description.slice(0, 400), category: tidy(d.category).slice(0, 40), photo: d.photo || null }));
  // A "subtitle" that is really the first category heading is not a tagline
  if (clean.some(d => d.category.toLowerCase() === subtitle.toLowerCase())) subtitle = '';
  return { dishes: clean, title: title ? tidy(title.text) : '', subtitle, colours: ctx.colours, fonts, background: ctx.background || null, hasText: true, pages: pdf.numPages };
}
