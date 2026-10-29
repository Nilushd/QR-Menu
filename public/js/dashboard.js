import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let me, R;

const THEME_META = {
  elegant: { label: 'Elegant', bg: '#faf6ef', fg: '#2b2620', font: 'Georgia, serif' },
  modern: { label: 'Modern', bg: '#ffffff', fg: '#111', font: 'Inter, sans-serif' },
  rustic: { label: 'Rustic', bg: '#efe3cc', fg: '#4a3423', font: 'Georgia, serif' },
  midnight: { label: 'Midnight', bg: '#111216', fg: '#f3efe8', font: 'Georgia, serif' },
  fresh: { label: 'Fresh', bg: '#eef8f3', fg: '#16352a', font: 'Inter, sans-serif' },
};
const ACCENTS = ['#c8553d', '#d9480f', '#e8590c', '#c2255c', '#862e9c', '#3b5bdb', '#0b7285', '#2b8a3e', '#5c940d', '#b08900', '#1f1b16'];

function menuUrl() { return `${me.publicUrl || location.origin}/m/${R.slug}`; }

// ---------- Boot ----------
async function load() {
  try { me = await api('/api/me'); } catch (e) { if (e.status === 401 || e.status === 404) return location.replace('/login'); throw e; }
  R = me.restaurant;
  refreshLinks(); renderMenus(); fillProfile(); initQr(); renderInsights();
  showTab();
}
function refreshLinks() {
  const url = menuUrl();
  $('#liveLink').textContent = url.replace(/^https?:\/\//, ''); $('#liveLink').href = url;
  $('#viewLive').href = url; $('#previewBtn').href = url;
  $('#slugBase').textContent = `${(me.publicUrl || location.origin).replace(/^https?:\/\//, '')}/m/`;
}
function showTab() {
  const t = (location.hash || '#menus').slice(1);
  const tab = ['menus', 'profile', 'qr', 'insights'].includes(t) ? t : 'menus';
  $$('.tab').forEach(el => el.classList.toggle('hidden', el.id !== 'tab-' + tab));
  $$('.side a[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  if (tab === 'qr') renderQr();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', showTab);
$('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = '/'; };

// ---------- Menus ----------
const thumbCache = new Map();
async function thumb(url, el) {
  try {
    if (!thumbCache.has(url)) {
      thumbCache.set(url, (async () => {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const scale = 140 / vp.width;
        const v = page.getViewport({ scale });
        const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
        return { url: c.toDataURL('image/jpeg', .8), pages: pdf.numPages };
      })());
    }
    const t = await thumbCache.get(url);
    el.querySelector('.menu-thumb').innerHTML = `<img src="${t.url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    el.querySelector('.pages').textContent = `${t.pages} page${t.pages > 1 ? 's' : ''} · `;
  } catch { /* thumbnail is optional */ }
}
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function renderMenus() {
  const ul = $('#menuList');
  if (!R.menus.length) { ul.innerHTML = '<li class="empty">No menus yet — upload your first PDF above.</li>'; return; }
  ul.innerHTML = R.menus.map((m, i) => `
    <li class="menu-item" data-id="${m.id}">
      <div class="menu-thumb">📄</div>
      <div class="meta"><input type="text" value="${esc(m.title)}" maxlength="60" aria-label="Menu name"><small><span class="pages"></span>${fmtSize(m.size)}</small></div>
      <div class="actions">
        <a class="icon-btn" href="${m.url}" target="_blank" rel="noopener" title="Open PDF">↗</a>
        <button class="icon-btn" data-move="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-move="down" title="Move down" ${i === R.menus.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn danger" data-del title="Delete">✕</button>
      </div></li>`).join('');
  ul.querySelectorAll('.menu-item').forEach(li => thumb(R.menus.find(m => m.id == li.dataset.id).url, li));
}
$('#menuList').addEventListener('click', async e => {
  const li = e.target.closest('.menu-item'); if (!li) return;
  const id = li.dataset.id;
  try {
    if (e.target.closest('[data-move]')) {
      R = (await api(`/api/menus/${id}/move`, { method: 'POST', body: { dir: e.target.closest('[data-move]').dataset.move } })).restaurant; renderMenus();
    } else if (e.target.closest('[data-del]')) {
      if (!confirm('Delete this menu? Guests will no longer see it.')) return;
      R = (await api(`/api/menus/${id}`, { method: 'DELETE' })).restaurant; renderMenus(); toast('Menu deleted');
    }
  } catch (x) { toast(x.message); }
});
$('#menuList').addEventListener('change', async e => {
  const li = e.target.closest('.menu-item'); if (!li || e.target.tagName !== 'INPUT') return;
  try { R = (await api(`/api/menus/${li.dataset.id}`, { method: 'PUT', body: { title: e.target.value } })).restaurant; toast('Menu renamed'); }
  catch (x) { toast(x.message); renderMenus(); }
});

function uploadPdf(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') return toast('Please choose a PDF file.');
  const fd = new FormData(); fd.append('title', $('#menuTitle').value); fd.append('file', file);
  const xhr = new XMLHttpRequest(), prog = $('#prog');
  prog.classList.remove('hidden'); prog.firstElementChild.style.width = '0';
  xhr.upload.onprogress = e => { if (e.lengthComputable) prog.firstElementChild.style.width = (e.loaded / e.total * 100) + '%'; };
  xhr.onload = () => {
    prog.classList.add('hidden'); $('#pdfInput').value = '';
    let d = {}; try { d = JSON.parse(xhr.responseText); } catch {}
    if (xhr.status >= 400) return toast(d.error || 'Upload failed.');
    R = d.restaurant; $('#menuTitle').value = ''; renderMenus(); toast('Menu uploaded 🎉');
  };
  xhr.onerror = () => { prog.classList.add('hidden'); toast('Upload failed. Check your connection.'); };
  xhr.open('POST', '/api/menus'); xhr.send(fd);
}
const drop = $('#drop');
$('#pdfInput').onchange = e => uploadPdf(e.target.files[0]);
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => uploadPdf(e.dataTransfer.files[0]));

// ---------- Profile ----------
let selTheme, selAccent;
function fillProfile() {
  const f = $('#profileForm');
  ['name', 'tagline', 'address', 'phone', 'hours', 'wifi', 'slug'].forEach(k => f[k].value = R[k] || '');
  selTheme = R.theme; selAccent = R.accent;
  $('#themes').innerHTML = Object.entries(THEME_META).map(([k, t]) =>
    `<div class="theme-opt" data-theme="${k}"><div class="sw" style="background:${t.bg};color:${t.fg};font-family:${t.font}">Aa<span style="width:24px;height:4px;border-radius:2px;margin-top:4px;background:var(--acc)"></span></div>${t.label}</div>`).join('');
  $('#accents').innerHTML = ACCENTS.map(c => `<span class="swatch" data-c="${c}" style="background:${c}"></span>`).join('') +
    `<input type="color" id="accentCustom" title="Custom colour">`;
  paintProfileSel(); paintImages();
}
function paintProfileSel() {
  $$('.theme-opt').forEach(el => { el.classList.toggle('sel', el.dataset.theme === selTheme); el.style.setProperty('--acc', selAccent); });
  $$('.swatch').forEach(el => el.classList.toggle('sel', el.dataset.c === selAccent));
  $('#accentCustom').value = selAccent;
}
function paintImages() {
  for (const k of ['logo', 'cover']) {
    $(`#${k}Prev`).style.backgroundImage = R[k] ? `url("${R[k]}")` : '';
    $(`[data-rm="${k}"]`).classList.toggle('hidden', !R[k]);
  }
}
$('#themes').onclick = e => { const t = e.target.closest('[data-theme]'); if (t) { selTheme = t.dataset.theme; paintProfileSel(); } };
$('#accents').addEventListener('click', e => { const s = e.target.closest('.swatch'); if (s) { selAccent = s.dataset.c; paintProfileSel(); } });
$('#accents').addEventListener('input', e => { if (e.target.id === 'accentCustom') { selAccent = e.target.value; paintProfileSel(); } });
$('#profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target)); body.theme = selTheme; body.accent = selAccent;
  const oldSlug = R.slug;
  if (body.slug && body.slug !== oldSlug && !confirm('Changing your menu link will break any QR codes you already printed. Continue?')) return;
  try {
    R = (await api('/api/restaurant', { method: 'PUT', body })).restaurant;
    fillProfile(); refreshLinks(); flash('#savedMsg');
    if (R.slug !== oldSlug) renderQr();
  } catch (x) { toast(x.message); }
});
let upField;
document.addEventListener('click', async e => {
  const up = e.target.closest('[data-up]'), rm = e.target.closest('[data-rm]');
  if (up) { upField = up.dataset.up; $('#imgInput').click(); }
  if (rm) {
    try { await api('/api/restaurant/' + rm.dataset.rm, { method: 'DELETE' }); R[rm.dataset.rm] = null; paintImages(); updateLogoHint(); renderQr(); }
    catch (x) { toast(x.message); }
  }
});
$('#imgInput').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const fd = new FormData(); fd.append('file', file);
  try { const { url } = await api('/api/restaurant/' + upField, { method: 'POST', body: fd }); R[upField] = url; paintImages(); updateLogoHint(); renderQr(); toast('Image uploaded'); }
  catch (x) { toast(x.message); }
};
function flash(sel) { const el = $(sel); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }

// ---------- QR designer ----------
const DEFAULT = {
  dotsType: 'rounded', dotsColor: '#1f1b16', gradient: false, dotsColor2: '#d9480f', gradientType: 'linear',
  cornerSquareType: 'extra-rounded', cornerSquareColor: '#1f1b16', cornerDotType: 'dot', cornerDotColor: '#d9480f',
  bgColor: '#ffffff', logo: true, logoSize: 0.3, frame: 'card', caption: 'SCAN FOR MENU',
  frameColor: '#1f1b16', frameTextColor: '#ffffff', showName: true, ecl: 'Q',
};
const PRESETS = [
  { name: 'Classic', d: { dotsType: 'square', dotsColor: '#000000', gradient: false, cornerSquareType: 'square', cornerSquareColor: '#000000', cornerDotType: 'square', cornerDotColor: '#000000', bgColor: '#ffffff', frameColor: '#000000', frameTextColor: '#ffffff' } },
  { name: 'Brand', brand: true },
  { name: 'Ocean', d: { dotsType: 'classy-rounded', dotsColor: '#0b7285', gradient: true, dotsColor2: '#1864ab', gradientType: 'linear', cornerSquareType: 'extra-rounded', cornerSquareColor: '#0b3d5c', cornerDotType: 'dot', cornerDotColor: '#1098ad', bgColor: '#ffffff', frameColor: '#0b3d5c', frameTextColor: '#ffffff' } },
  { name: 'Sunset', d: { dotsType: 'dots', dotsColor: '#d9480f', gradient: true, dotsColor2: '#c2255c', gradientType: 'linear', cornerSquareType: 'extra-rounded', cornerSquareColor: '#c2255c', cornerDotType: 'dot', cornerDotColor: '#f76707', bgColor: '#fffaf5', frameColor: '#e8590c', frameTextColor: '#ffffff' } },
  { name: 'Forest', d: { dotsType: 'rounded', dotsColor: '#2b8a3e', gradient: true, dotsColor2: '#1b4332', gradientType: 'radial', cornerSquareType: 'extra-rounded', cornerSquareColor: '#1b4332', cornerDotType: 'dot', cornerDotColor: '#2f9e44', bgColor: '#f8fcf8', frameColor: '#1b4332', frameTextColor: '#f8fcf8' } },
  { name: 'Gold Luxe', d: { dotsType: 'classy', dotsColor: '#e9c46a', gradient: true, dotsColor2: '#b8860b', gradientType: 'linear', cornerSquareType: 'square', cornerSquareColor: '#e9c46a', cornerDotType: 'square', cornerDotColor: '#f4d58d', bgColor: '#141414', frameColor: '#141414', frameTextColor: '#e9c46a' } },
  { name: 'Berry', d: { dotsType: 'extra-rounded', dotsColor: '#862e9c', gradient: true, dotsColor2: '#e64980', gradientType: 'linear', cornerSquareType: 'extra-rounded', cornerSquareColor: '#5f3dc4', cornerDotType: 'dot', cornerDotColor: '#e64980', bgColor: '#ffffff', frameColor: '#5f3dc4', frameTextColor: '#ffffff' } },
  { name: 'Midnight', d: { dotsType: 'rounded', dotsColor: '#e9ecef', gradient: false, cornerSquareType: 'extra-rounded', cornerSquareColor: '#ffd43b', cornerDotType: 'dot', cornerDotColor: '#ffd43b', bgColor: '#0b1021', frameColor: '#0b1021', frameTextColor: '#ffd43b' } },
];
const CHIPS = {
  dotsType: [['square', 'Square'], ['rounded', 'Rounded'], ['dots', 'Dots'], ['classy', 'Classy'], ['classy-rounded', 'Classy round'], ['extra-rounded', 'Smooth']],
  cornerSquareType: [['square', 'Square'], ['extra-rounded', 'Rounded'], ['dot', 'Circle']],
  cornerDotType: [['square', 'Square'], ['dot', 'Circle']],
  frame: [['none', 'None'], ['card', 'Card'], ['banner', 'Banner'], ['tent', 'Table tent']],
};
let D, qr, renderSeq = 0;

function initQr() {
  D = { ...DEFAULT, ...(R.qr_design || {}) };
  if (!R.qr_design) applyBrand();
  $('#presets').innerHTML = PRESETS.map((p, i) => {
    const d = p.brand ? brandDesign() : p.d;
    const fill = d.gradient ? `linear-gradient(135deg,${d.dotsColor},${d.dotsColor2})` : d.dotsColor;
    return `<div class="preset" data-i="${i}"><div class="pv" style="background:${d.bgColor};display:grid;place-items:center;border:1px solid #eee"><span style="width:26px;height:26px;border-radius:${d.dotsType.includes('round') || d.dotsType === 'dots' ? '8px' : '2px'};background:${fill};outline:3px solid ${d.cornerSquareColor};outline-offset:3px"></span></div>${p.name}</div>`;
  }).join('');
  for (const [k, opts] of Object.entries(CHIPS)) {
    $(`[data-chips="${k}"]`).innerHTML = opts.map(([v, l]) => `<button type="button" class="chip" data-v="${v}">${l}</button>`).join('');
  }
  qr = new QRCodeStyling({ type: 'canvas' });
  syncControls(); updateLogoHint();
}
function brandDesign() {
  return { dotsType: 'rounded', dotsColor: '#1f1b16', gradient: false, cornerSquareType: 'extra-rounded', cornerSquareColor: R.accent, cornerDotType: 'dot', cornerDotColor: R.accent, bgColor: '#ffffff', frameColor: R.accent, frameTextColor: '#ffffff' };
}
function applyBrand() { Object.assign(D, brandDesign()); }
function updateLogoHint() { $('#noLogoHint').classList.toggle('hidden', !!R.logo); }

function syncControls() {
  $$('[data-k]').forEach(el => { const v = D[el.dataset.k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
  $$('[data-chips]').forEach(g => g.querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.v === D[g.dataset.chips])));
  $$('.grad-only').forEach(el => el.classList.toggle('hidden', !D.gradient));
  $$('.frame-only').forEach(el => el.classList.toggle('hidden', D.frame === 'none'));
}
$('#tab-qr').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  D[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value;
  syncControls(); renderQrSoon();
});
$('#tab-qr').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) { D[chip.closest('[data-chips]').dataset.chips] = chip.dataset.v; syncControls(); renderQr(); }
  const pre = e.target.closest('.preset');
  if (pre) { const p = PRESETS[pre.dataset.i]; Object.assign(D, p.brand ? brandDesign() : p.d); syncControls(); renderQr(); }
});
$('#saveQr').onclick = async () => {
  try { await api('/api/qr-design', { method: 'PUT', body: D }); R.qr_design = { ...D }; flash('#qrSaved'); toast('QR design saved'); }
  catch (x) { toast(x.message); }
};

function qrOptions(size) {
  const useLogo = D.logo && R.logo;
  return {
    width: size, height: size, type: 'canvas', data: menuUrl(), margin: 0,
    qrOptions: { errorCorrectionLevel: useLogo && D.ecl === 'M' ? 'Q' : D.ecl },
    image: useLogo ? R.logo : undefined,
    imageOptions: { crossOrigin: 'anonymous', margin: Math.round(size * 0.012), imageSize: D.logoSize, hideBackgroundDots: true },
    dotsOptions: D.gradient
      ? { type: D.dotsType, color: D.dotsColor, gradient: { type: D.gradientType, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: D.dotsColor }, { offset: 1, color: D.dotsColor2 }] } }
      : { type: D.dotsType, color: D.dotsColor, gradient: undefined },
    cornersSquareOptions: { type: D.cornerSquareType, color: D.cornerSquareColor },
    cornersDotOptions: { type: D.cornerDotType, color: D.cornerDotColor },
    backgroundOptions: { color: D.bgColor },
  };
}
async function qrImage(size) {
  qr.update(qrOptions(size));
  const blob = await qr.getRawData('png');
  const img = new Image(); img.src = URL.createObjectURL(blob);
  await img.decode(); return img;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fitText(ctx, text, maxW, size, weight, family) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 8);
}

// Draws the full framed QR at the given QR pixel size; returns a canvas.
async function compose(q) {
  await document.fonts.ready;
  const img = await qrImage(q);
  const u = q / 100, pad = 8 * u, quiet = 5 * u;
  const name = D.showName ? R.name : '';
  const cap = D.caption || '';
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const serif = '"Fraunces", Georgia, serif', sans = '"Inter", system-ui, sans-serif';
  const qrBox = (x, y) => { ctx.fillStyle = D.bgColor; rr(ctx, x, y, q + quiet * 2, q + quiet * 2, 4 * u); ctx.fill(); ctx.drawImage(img, x + quiet, y + quiet, q, q); };

  if (D.frame === 'none') {
    c.width = c.height = q + quiet * 2; qrBox(0, 0);
  } else if (D.frame === 'card') {
    const top = name ? 18 * u : pad, bottom = cap ? 22 * u : pad;
    c.width = q + quiet * 2 + pad * 2; c.height = top + q + quiet * 2 + bottom;
    ctx.fillStyle = D.frameColor; rr(ctx, 0, 0, c.width, c.height, 9 * u); ctx.fill();
    ctx.fillStyle = D.frameTextColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (name) { fitText(ctx, name, c.width - pad * 2, 9 * u, 600, serif); ctx.fillText(name, c.width / 2, top / 2 + 1 * u); }
    qrBox(pad, top);
    if (cap) { fitText(ctx, cap, c.width - pad * 2, 9 * u, 800, sans); ctx.fillText(cap, c.width / 2, c.height - bottom / 2 - 1 * u); }
  } else if (D.frame === 'banner') {
    const top = name ? 16 * u : pad, bottom = cap ? 24 * u : pad, bw = 2.2 * u;
    c.width = q + quiet * 2 + pad * 2; c.height = top + q + quiet * 2 + bottom;
    ctx.fillStyle = D.bgColor; rr(ctx, bw / 2, bw / 2, c.width - bw, c.height - bw, 9 * u); ctx.fill();
    ctx.lineWidth = bw; ctx.strokeStyle = D.frameColor; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (name) { ctx.fillStyle = D.frameColor; fitText(ctx, name, c.width - pad * 2, 8 * u, 600, serif); ctx.fillText(name, c.width / 2, top / 2 + 2 * u); }
    qrBox(pad, top);
    if (cap) {
      fitText(ctx, cap, c.width - pad * 4, 7.5 * u, 800, sans);
      const tw = ctx.measureText(cap).width + 14 * u, th = 13 * u, ty = c.height - bottom / 2 - th / 2 - 1 * u;
      ctx.fillStyle = D.frameColor; rr(ctx, (c.width - tw) / 2, ty, tw, th, th / 2); ctx.fill();
      ctx.fillStyle = D.frameTextColor; ctx.fillText(cap, c.width / 2, ty + th / 2 + .3 * u);
    }
  } else { // tent: tall printable card
    const box = q + quiet * 2, headH = name && cap ? 40 * u : 28 * u;
    c.width = box + pad * 4; const qx = (c.width - box) / 2, qy = headH + 8 * u;
    c.height = qy + box + 26 * u;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = D.frameColor; ctx.fillRect(0, 0, c.width, headH);
    ctx.beginPath(); ctx.ellipse(c.width / 2, headH, c.width * .62, 7 * u, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = D.frameTextColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (name) { fitText(ctx, name, c.width - pad * 2, 11 * u, 600, serif); ctx.fillText(name, c.width / 2, 13 * u); }
    if (cap) { fitText(ctx, cap, c.width - pad * 2, 9 * u, 800, sans); ctx.fillText(cap, c.width / 2, name ? 28 * u : 15 * u); }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 6 * u; ctx.shadowOffsetY = 2 * u; qrBox(qx, qy); ctx.restore(); qrBox(qx, qy);
    ctx.fillStyle = '#6b645a'; fitText(ctx, 'Point your camera at the code', c.width - pad * 2, 4.6 * u, 500, sans);
    ctx.fillText('Point your camera at the code', c.width / 2, c.height - 15 * u);
    ctx.fillStyle = '#1f1b16'; const link = menuUrl().replace(/^https?:\/\//, '');
    fitText(ctx, link, c.width - pad * 2, 4.4 * u, 600, sans); ctx.fillText(link, c.width / 2, c.height - 8 * u);
  }
  URL.revokeObjectURL(img.src);
  return c;
}

let soon;
function renderQrSoon() { clearTimeout(soon); soon = setTimeout(renderQr, 120); }
async function renderQr() {
  if (!qr || $('#tab-qr').classList.contains('hidden')) return;
  const seq = ++renderSeq;
  const c = await compose(560);
  if (seq !== renderSeq) return;
  const out = $('#qrCanvas'); out.width = c.width; out.height = c.height;
  out.getContext('2d').drawImage(c, 0, 0);
  out.style.width = (c.height > c.width ? 300 : 340) + 'px';
  checkContrast();
}
function lum(hex) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); }
function checkContrast() {
  const cols = [D.dotsColor, D.gradient ? D.dotsColor2 : D.dotsColor, D.cornerSquareColor];
  const worst = Math.min(...cols.map(c => contrast(c, D.bgColor)));
  const inverted = lum(D.dotsColor) > lum(D.bgColor);
  const w = $('#contrastWarn');
  if (worst < 3) { w.textContent = '⚠️ Low contrast between the code and background — some phones may not scan it. Try darker dots or a lighter background.'; w.classList.remove('hidden'); }
  else if (inverted) { w.textContent = 'ℹ️ Light-on-dark codes look great but a few older scanner apps can struggle. Test with several phones.'; w.classList.remove('hidden'); }
  else w.classList.add('hidden');
}
function fileName(ext) { return `${R.slug}-menu-qr.${ext}`; }
$('#dlPng').onclick = async () => {
  const c = await compose(1600);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName('png'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); });
};
$('#dlSvg').onclick = async () => {
  const svgQr = new QRCodeStyling({ ...qrOptions(1000), type: 'svg' });
  if (svgQr.download) await svgQr.download({ name: fileName('svg').replace(/\.svg$/, ''), extension: 'svg' });
  toast('SVG contains the QR code only (no frame).');
};
$('#printQr').onclick = async () => {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print.');
  const url = (await compose(1000)).toDataURL('image/png');
  w.document.write(`<!doctype html><title>${esc(R.name)} – QR cards</title><style>
    @page{size:A4;margin:10mm}body{margin:0;font-family:sans-serif}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:8mm;justify-items:center;align-items:center;height:277mm}
    img{max-width:90mm;max-height:130mm;width:auto;height:auto}
    .tip{text-align:center;color:#888;font-size:11px}@media print{.tip{display:none}}</style>
    <p class="tip">Cut along the edges and place on tables. Use “Fit to page” off / 100% scale.</p>
    <div class="g">${`<img src="${url}">`.repeat(4)}</div>
    <script>window.onload=()=>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
};

// ---------- Insights ----------
function renderInsights() {
  const map = Object.fromEntries(me.stats.map(s => [s.day, s.count]));
  const days = [...Array(14)].map((_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const vals = days.map(d => map[d] || 0), max = Math.max(1, ...vals);
  $('#stTotal').textContent = R.views.toLocaleString();
  $('#stWeek').textContent = vals.slice(-7).reduce((a, b) => a + b, 0).toLocaleString();
  $('#stToday').textContent = vals[13].toLocaleString();
  $('#bars').innerHTML = vals.map((v, i) => `<div style="height:${v / max * 100}%" title="${days[i]}: ${v}">${v ? `<span>${v}</span>` : ''}</div>`).join('');
  $('#barLabels').innerHTML = days.map(d => `<span>${new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(' ', ' ')}</span>`).join('');
}

load();
