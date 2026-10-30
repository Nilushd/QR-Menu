import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';
import { extractMenu } from '/js/pdf-import.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let me, R;

const TABS = ['dishes', 'menus', 'design', 'qr', 'insights'];
const THEME_META = {
  elegant: { label: 'Elegant', bg: '#faf6ef', fg: '#2b2620', font: 'Georgia, serif' },
  modern: { label: 'Modern', bg: '#ffffff', fg: '#111', font: 'Inter, sans-serif' },
  rustic: { label: 'Rustic', bg: '#efe3cc', fg: '#4a3423', font: 'Georgia, serif' },
  midnight: { label: 'Midnight', bg: '#111216', fg: '#f3efe8', font: 'Georgia, serif' },
  fresh: { label: 'Fresh', bg: '#eef8f3', fg: '#16352a', font: 'Inter, sans-serif' },
  custom: { label: 'Custom', font: 'Georgia, serif' },
};
const GOOGLE_FONTS = ['Playfair Display', 'Cormorant Garamond', 'Lora', 'Libre Baskerville', 'DM Serif Display', 'Fraunces', 'Cinzel', 'Great Vibes', 'Dancing Script', 'Pacifico', 'Oswald', 'Bebas Neue', 'Montserrat', 'Raleway', 'Lato', 'Poppins', 'Inter', 'Josefin Sans', 'Nunito', 'Work Sans', 'Karla', 'Source Serif 4', 'Abril Fatface', 'Amatic SC', 'Caveat'];
const BG_MODES = [['none', 'Plain colour'], ['paper', 'Paper texture'], ['photo', 'Background image']];
const ACCENTS = ['#1f6f5c', '#c8553d', '#d9480f', '#e8590c', '#c2255c', '#862e9c', '#3b5bdb', '#0b7285', '#2b8a3e', '#5c940d', '#b08900', '#1f1b16'];
const FONTS = {
  auto: ['Style default', 'Georgia, serif'], classic: ['Classic', '"Playfair Display", serif'], elegant: ['Elegant', '"Cormorant Garamond", serif'],
  modern: ['Modern', 'Inter, sans-serif'], friendly: ['Friendly', 'Poppins, sans-serif'], bold: ['Bold', 'Oswald, sans-serif'], script: ['Script', '"Dancing Script", cursive'],
};
const PAGE_TILES = {
  hero: [['full', 'Full photo', '<rect x="2" y="2" width="36" height="20" rx="2" fill="var(--a)"/><circle cx="20" cy="17" r="4" fill="#fff"/><rect x="6" y="26" width="28" height="3" rx="1.5" fill="#ccc"/><rect x="6" y="32" width="20" height="3" rx="1.5" fill="#ddd"/>'],
    ['compact', 'Compact', '<rect x="2" y="2" width="36" height="11" rx="2" fill="var(--a)"/><circle cx="9" cy="13" r="4" fill="#fff" stroke="#ddd"/><rect x="15" y="16" width="18" height="3" rx="1.5" fill="#999"/><rect x="6" y="24" width="28" height="3" rx="1.5" fill="#ccc"/><rect x="6" y="30" width="20" height="3" rx="1.5" fill="#ddd"/>'],
    ['minimal', 'Minimal', '<circle cx="20" cy="10" r="5" fill="var(--a)"/><rect x="10" y="18" width="20" height="3" rx="1.5" fill="#999"/><rect x="6" y="26" width="28" height="3" rx="1.5" fill="#ccc"/><rect x="6" y="32" width="20" height="3" rx="1.5" fill="#ddd"/>']],
  layout: [['classic', 'Classic menu', '<rect x="3" y="4" width="13" height="3" rx="1" fill="#777"/><path d="M17 6.5h12" stroke="#bbb" stroke-dasharray="1 2"/><rect x="30" y="4" width="7" height="3" rx="1" fill="var(--a)"/><rect x="3" y="9" width="20" height="2" rx="1" fill="#ccc"/><rect x="3" y="16" width="16" height="3" rx="1" fill="#777"/><path d="M20 18.5h9" stroke="#bbb" stroke-dasharray="1 2"/><rect x="30" y="16" width="7" height="3" rx="1" fill="var(--a)"/><rect x="3" y="21" width="22" height="2" rx="1" fill="#ccc"/><rect x="3" y="28" width="12" height="3" rx="1" fill="#777"/><path d="M16 30.5h13" stroke="#bbb" stroke-dasharray="1 2"/><rect x="30" y="28" width="7" height="3" rx="1" fill="var(--a)"/><rect x="3" y="33" width="18" height="2" rx="1" fill="#ccc"/>'],
    ['grid', 'Grid', '<rect x="3" y="3" width="16" height="14" rx="2" fill="var(--a)" opacity=".7"/><rect x="21" y="3" width="16" height="14" rx="2" fill="var(--a)" opacity=".7"/><rect x="3" y="20" width="12" height="2.5" rx="1" fill="#999"/><rect x="21" y="20" width="12" height="2.5" rx="1" fill="#999"/><rect x="3" y="26" width="16" height="10" rx="2" fill="var(--a)" opacity=".4"/><rect x="21" y="26" width="16" height="10" rx="2" fill="var(--a)" opacity=".4"/>'],
    ['list', 'List', '<rect x="3" y="4" width="20" height="3" rx="1.5" fill="#999"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#ccc"/><rect x="28" y="3" width="9" height="9" rx="2" fill="var(--a)" opacity=".7"/><rect x="3" y="17" width="20" height="3" rx="1.5" fill="#999"/><rect x="3" y="22" width="14" height="2" rx="1" fill="#ccc"/><rect x="28" y="16" width="9" height="9" rx="2" fill="var(--a)" opacity=".7"/><rect x="3" y="30" width="20" height="3" rx="1.5" fill="#999"/><rect x="28" y="29" width="9" height="9" rx="2" fill="var(--a)" opacity=".7"/>'],
    ['magazine', 'Magazine', '<rect x="3" y="3" width="34" height="18" rx="2" fill="var(--a)" opacity=".7"/><rect x="3" y="24" width="22" height="3" rx="1.5" fill="#999"/><rect x="3" y="30" width="30" height="2" rx="1" fill="#ccc"/><rect x="3" y="35" width="26" height="2" rx="1" fill="#ccc"/>']],
};
const ORDER = [['dishes', 'Dish photos'], ['pdf', 'PDF menus']];
const TAGS = { chef: '👨‍🍳 Chef\'s special', popular: '🔥 Popular', new: '✨ New', veg: '🌱 Vegetarian', vegan: '🥬 Vegan', spicy: '🌶️ Spicy', gf: '🌾 Gluten-free', seafood: '🦐 Seafood' };

function menuUrl() { return `${me.publicUrl || location.origin}/m/${R.slug}`; }

// ---------- Boot ----------
async function load() {
  try { me = await api('/api/me'); } catch (e) { if (e.status === 401 || e.status === 404) return location.replace('/login'); throw e; }
  R = me.restaurant;
  refreshLinks(); renderDishes(); renderMenus(); fillDesign(); initQr(); renderInsights();
  showTab();
}
function refreshLinks() {
  const url = menuUrl();
  $('#liveLink').textContent = url.replace(/^https?:\/\//, ''); $('#liveLink').href = url;
  $('#viewLive').href = url; $('#previewBtn').href = url;
  $('#slugBase').textContent = `${(me.publicUrl || location.origin).replace(/^https?:\/\//, '')}/m/`;
}
function showTab() {
  let t = (location.hash || '#dishes').slice(1);
  if (t === 'profile') t = 'design';
  const tab = TABS.includes(t) ? t : 'dishes';
  $$('.tab').forEach(el => el.classList.toggle('hidden', el.id !== 'tab-' + tab));
  $$('.side a[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  if (tab === 'qr') renderQr();
  if (tab === 'design') loadPreview();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', showTab);
$('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = '/'; };
function flash(sel) { const el = $(sel); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }

// Downscale images in the browser so guests get fast-loading photos
async function resizeImage(file, max, keepPng) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('This image format is not supported. Please use JPG or PNG.'); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d');
  const png = keepPng && file.type === 'image/png';
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', .86));
  return new File([blob], png ? 'image.png' : 'image.jpg', { type: blob.type });
}

// ---------- Dishes ----------
function priceText(p) { return p && /^[\d.,\s]+$/.test(p) && R.page.currency ? `${R.page.currency} ${p}` : p; }
function renderDishes() {
  const box = $('#dishList');
  if (!R.dishes.length) {
    box.innerHTML = `<div class="empty-state"><div class="big">🍽️</div><h3>Show off your food</h3><p>Dishes with photos get far more attention than text menus. Add your signature dishes to get started.</p><button class="btn btn-primary" onclick="document.getElementById('addDish').click()">＋ Add your first dish</button></div>`;
    return;
  }
  const groups = {};
  R.dishes.forEach((d, i) => (groups[d.category || 'Uncategorised'] ||= []).push({ ...d, i }));
  box.innerHTML = Object.entries(groups).map(([cat, list]) => `<h3 class="cat-head">${esc(cat)} <span>${list.length}</span></h3>
    <div class="dish-grid">${list.map(d => `
      <div class="dish-card${d.available ? '' : ' off'}" data-id="${d.id}">
        <div class="dish-img" ${d.photo ? `style="background-image:url('${d.photo}')"` : ''}>${d.photo ? '' : '<span>No photo</span>'}
          ${d.featured ? '<em class="feat">⭐ Featured</em>' : ''}${d.available ? '' : '<em class="sold">Unavailable</em>'}</div>
        <div class="dish-body"><div class="dish-top"><strong>${esc(d.name)}</strong><b>${esc(priceText(d.price))}</b></div>
          ${d.tags.length ? `<div class="mini-tags">${d.tags.map(t => `<span>${TAGS[t]}</span>`).join('')}</div>` : ''}
          <div class="dish-actions">
            <button class="btn btn-ghost btn-sm" data-edit>Edit</button>
            <button class="icon-btn" data-dmove="up" title="Move up" ${d.i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-dmove="down" title="Move down" ${d.i === R.dishes.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn danger" data-ddel title="Delete">✕</button>
          </div></div></div>`).join('')}</div>`).join('');
  $('#catList').innerHTML = [...new Set(R.dishes.map(d => d.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('');
}
$('#dishList').addEventListener('click', async e => {
  const card = e.target.closest('.dish-card'); if (!card) return;
  const id = +card.dataset.id;
  try {
    if (e.target.closest('[data-edit]') || e.target.closest('.dish-img')) openDish(R.dishes.find(d => d.id === id));
    else if (e.target.closest('[data-dmove]')) { R = (await api(`/api/dishes/${id}/move`, { method: 'POST', body: { dir: e.target.closest('[data-dmove]').dataset.dmove } })).restaurant; renderDishes(); }
    else if (e.target.closest('[data-ddel]')) {
      if (!confirm('Delete this dish?')) return;
      R = (await api(`/api/dishes/${id}`, { method: 'DELETE' })).restaurant; renderDishes(); toast('Dish deleted');
    }
  } catch (x) { toast(x.message); }
});

const dlg = $('#dishDlg');
let editing = null, photoFile = null, removePhoto = false, dishTags = [];
$('#tagChips').innerHTML = Object.entries(TAGS).map(([k, v]) => `<button type="button" class="chip" data-tag="${k}">${v}</button>`).join('');
$('#tagChips').onclick = e => {
  const c = e.target.closest('[data-tag]'); if (!c) return;
  const t = c.dataset.tag; dishTags = dishTags.includes(t) ? dishTags.filter(x => x !== t) : [...dishTags, t]; paintTags();
};
function paintTags() { $$('#tagChips .chip').forEach(c => c.classList.toggle('sel', dishTags.includes(c.dataset.tag))); }
function showPhoto(src) {
  const img = $('#photoPrev');
  img.hidden = !src; if (src) img.src = src;
  $('.photo-empty').hidden = !!src; $('#removePhoto').classList.toggle('hidden', !src);
}
function openDish(d) {
  editing = d || null; photoFile = null; removePhoto = false; dishTags = d ? [...d.tags] : [];
  $('#dishDlgTitle').textContent = d ? 'Edit dish' : 'Add dish';
  const f = $('#dishForm');
  f.name.value = d?.name || ''; f.price.value = d?.price || ''; f.category.value = d?.category || (R.dishes.at(-1)?.category || '');
  f.description.value = d?.description || ''; f.featured.checked = !!d?.featured; f.available.checked = d ? d.available : true;
  showPhoto(d?.photo); paintTags();
  dlg.showModal(); setTimeout(() => f.name.focus(), 50);
}
$('#addDish').onclick = () => openDish(null);
dlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
async function pickPhoto(file) {
  if (!file) return;
  try { photoFile = await resizeImage(file, 1400); removePhoto = false; showPhoto(URL.createObjectURL(photoFile)); }
  catch (x) { toast(x.message); }
}
$('#photoInput').onchange = e => { pickPhoto(e.target.files[0]); e.target.value = ''; };
const pd = $('#photoDrop');
['dragenter', 'dragover'].forEach(ev => pd.addEventListener(ev, e => { e.preventDefault(); pd.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => pd.addEventListener(ev, e => { e.preventDefault(); pd.classList.remove('over'); }));
pd.addEventListener('drop', e => pickPhoto(e.dataTransfer.files[0]));
$('#removePhoto').onclick = () => { photoFile = null; removePhoto = true; showPhoto(null); };
$('#dishForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = $('#dishSave');
  if (!f.name.value.trim()) return f.name.focus();
  const fd = new FormData();
  for (const k of ['name', 'price', 'category', 'description']) fd.append(k, f[k].value);
  fd.append('featured', f.featured.checked); fd.append('available', f.available.checked);
  fd.append('tags', JSON.stringify(dishTags));
  if (removePhoto) fd.append('removePhoto', 'true');
  if (photoFile) fd.append('file', photoFile);
  btn.disabled = true;
  try {
    R = (await api(editing ? `/api/dishes/${editing.id}` : '/api/dishes', { method: editing ? 'PUT' : 'POST', body: fd })).restaurant;
    dlg.close(); renderDishes(); toast(editing ? 'Dish updated' : 'Dish added 🎉');
  } catch (x) { toast(x.message); }
  btn.disabled = false;
});

// ---------- PDF Menus ----------
const thumbCache = new Map();
async function thumb(url, el) {
  try {
    if (!thumbCache.has(url)) {
      thumbCache.set(url, (async () => {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const v = page.getViewport({ scale: 140 / page.getViewport({ scale: 1 }).width });
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
  if (!R.menus.length) { ul.innerHTML = '<li class="empty">No PDF menus yet. PDFs are optional if you use dish photos.</li>'; return; }
  ul.innerHTML = R.menus.map((m, i) => `
    <li class="menu-item" data-id="${m.id}">
      <div class="menu-thumb">📄</div>
      <div class="meta"><input type="text" value="${esc(m.title)}" maxlength="60" aria-label="Menu name"><small><span class="pages"></span>${fmtSize(m.size)}</small></div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-import title="Read dishes, prices and photos from this PDF">✨ Create photo menu</button>
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
    if (e.target.closest('[data-import]')) return openImport(R.menus.find(m => m.id == id));
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
    openImport(R.menus.at(-1), true);
  };
  xhr.onerror = () => { prog.classList.add('hidden'); toast('Upload failed. Check your connection.'); };
  xhr.open('POST', '/api/menus'); xhr.send(fd);
}
const drop = $('#drop');
$('#pdfInput').onchange = e => uploadPdf(e.target.files[0]);
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => uploadPdf(e.dataTransfer.files[0]));

// ---------- Create a photo menu from a PDF (layout analysis in the browser, no AI service) ----------
const impDlg = $('#importDlg');
let found = [], impColours = null, impStyle = null;
impDlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === impDlg) impDlg.close(); });
async function openImport(menu, afterUpload) {
  if (!menu) return;
  found = []; impColours = null;
  $('#impTitle').textContent = `Create photo menu from “${menu.title}”`;
  $('#impSub').textContent = 'Reading dishes, prices and photos from your PDF…';
  $('#impBody').innerHTML = '<div class="imp-progress"><div class="spinner"></div><div class="progress"><div></div></div></div>';
  $('#impFoot').classList.add('hidden');
  impDlg.showModal();
  let res;
  try {
    res = await extractMenu(menu.url, { onProgress: f => { const b = $('#impBody .progress div'); if (b) b.style.width = Math.round(f * 100) + '%'; } });
  } catch (x) {
    $('#impSub').textContent = ''; $('#impBody').innerHTML = `<div class="imp-empty"><div class="big">⚠️</div><h3>We couldn't read this PDF</h3><p>${esc(x.message)}</p></div>`; return;
  }
  if (!res.hasText || !res.dishes.length) {
    if (afterUpload) { impDlg.close(); return; }
    $('#impSub').textContent = '';
    $('#impBody').innerHTML = `<div class="imp-empty"><div class="big">${res.hasText ? '🤔' : '🖼️'}</div>
      <h3>${res.hasText ? 'No dishes with prices found' : 'This PDF is a scanned image'}</h3>
      <p>${res.hasText ? 'We couldn\'t match dish names to prices in this layout.' : 'It has no selectable text (it was probably scanned or exported as a picture), so names and prices can\'t be read.'}
      Your PDF still works for guests — you can also add dishes by hand in <a href="#dishes" data-close>Dishes &amp; photos</a>.</p></div>`;
    return;
  }
  found = res.dishes.map(d => ({ ...d, use: !R.dishes.some(x => x.name.toLowerCase() === d.name.toLowerCase()), preview: d.photo ? URL.createObjectURL(d.photo) : null }));
  impColours = res.colours;
  impStyle = { subtitle: res.subtitle, colours: res.colours, fonts: res.fonts || {}, background: res.background, bgUrl: res.background ? URL.createObjectURL(res.background) : null };
  // Only keep font names Google Fonts actually serves, so the menu never falls back unexpectedly
  const names = [...new Set([impStyle.fonts.head, impStyle.fonts.name, impStyle.fonts.body].filter(Boolean))];
  const ok = await Promise.all(names.map(n => fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(n)}`).then(r => r.ok, () => false)));
  for (const k of ['head', 'name', 'body']) if (impStyle.fonts[k] && !ok[names.indexOf(impStyle.fonts[k])]) impStyle.fonts[k] = null;
  const okNames = names.filter((n, i) => ok[i]);
  if (okNames.length) {
    let l = $('#impFonts'); if (!l) { l = document.createElement('link'); l.id = 'impFonts'; l.rel = 'stylesheet'; document.head.appendChild(l); }
    l.href = `https://fonts.googleapis.com/css?family=${okNames.map(n => encodeURIComponent(n) + ':400,600,700').join('|')}&display=swap`;
  }
  const photos = found.filter(d => d.photo).length, dupes = found.filter(d => !d.use).length;
  $('#impSub').textContent = `Found ${found.length} dishes${photos ? ` and ${photos} photos` : ''} in ${new Set(found.map(d => d.category)).size || 1} categories. Check and edit before importing.` +
    (dupes ? ` ${dupes} already in your menu ${dupes > 1 ? 'are' : 'is'} unticked.` : '');
  $('#impColoursWrap').classList.add('hidden');
  renderFound();
  $('#impFoot').classList.remove('hidden');
}
function renderFound() {
  const keep = ['impUseStyle', 'impUseBg', 'impUseLayout'].map(id => [id, document.getElementById(id)?.checked]);
  setTimeout(() => keep.forEach(([id, v]) => { const el = document.getElementById(id); if (el && v !== undefined) el.checked = v; }));
  const groups = {};
  found.forEach((d, i) => (groups[d.category || 'Menu'] ||= []).push(i));
  $('#impBody').innerHTML = styleCard() + `<label class="toggle imp-all"><input type="checkbox" id="impAll" ${found.every(d => d.use) ? 'checked' : ''}> Select all</label>` +
    Object.entries(groups).map(([cat, idx]) => `<h3 class="cat-head">${esc(cat)} <span>${idx.length}</span></h3>` + idx.map(i => {
      const d = found[i];
      return `<div class="imp-row${d.use ? '' : ' off'}" data-i="${i}">
        <input type="checkbox" data-f="use" ${d.use ? 'checked' : ''} aria-label="Import this dish">
        <div class="imp-thumb" ${d.preview ? `style="background-image:url('${d.preview}')"` : ''}>${d.preview ? '<button type="button" class="imp-x" data-nophoto title="Don\'t use this photo">✕</button>' : '<span>No photo</span>'}</div>
        <div class="imp-fields">
          <div class="imp-line"><input type="text" data-f="name" value="${esc(d.name)}" maxlength="80" aria-label="Name"><input type="text" data-f="price" value="${esc(d.price)}" maxlength="24" class="imp-price" aria-label="Price"></div>
          <div class="imp-line"><input type="text" data-f="category" value="${esc(d.category)}" maxlength="40" class="imp-cat" aria-label="Category" placeholder="Category"><input type="text" data-f="description" value="${esc(d.description)}" maxlength="400" aria-label="Description" placeholder="Description"></div>
        </div></div>`;
    }).join('')).join('');
  updateImpCount();
}
function styleCard() {
  const st = impStyle; if (!st?.colours) return '';
  const c = st.colours, f = st.fonts;
  const sw = [['Background', c.background], ['Text', c.ink], ['Descriptions', c.muted], ['Accent', c.accent]].filter(([, v]) => v);
  const font = (n, label) => n ? `<div class="imp-font"><span style="font-family:'${n}',serif">${esc(n)}</span><small>${label}</small></div>` : '';
  return `<div class="imp-style">
    <div class="imp-style-preview" style="background:${c.background}${st.bgUrl ? ` url('${st.bgUrl}') center/cover` : ''};color:${c.ink}">
      <div style="background:linear-gradient(${c.background}55,${c.background}aa);padding:16px 18px;height:100%">
        <div style="font:600 24px '${f.head || 'Georgia'}',serif;color:${c.ink}">${esc(R.name)}</div>
        <div style="display:flex;gap:6px;align-items:baseline;margin-top:8px;font:600 14px '${f.name || f.body || 'Georgia'}',serif;${f.nameCaps ? 'text-transform:uppercase;' : ''}">${esc(found[0]?.name || 'Dish')}<span style="flex:1;border-bottom:2px dotted ${c.muted}"></span><span style="color:${c.accent || c.ink}">${esc(found[0]?.price || '')}</span></div>
        <div style="font:italic 12px '${f.body || 'Georgia'}',serif;color:${c.muted}">${esc((found[0]?.description || '').slice(0, 60))}</div>
      </div></div>
    <div class="imp-style-info"><h3>Style from your PDF</h3>
      <div class="imp-swatches">${sw.map(([l, v]) => `<span title="${l} ${v}"><i style="background:${v}"></i>${l}</span>`).join('')}</div>
      <div class="imp-fonts">${font(f.head, 'Headings')}${f.name !== f.head ? font(f.name, 'Dish names') : ''}${f.body !== f.name ? font(f.body, 'Text') : ''}</div>
      <label class="toggle"><input type="checkbox" id="impUseStyle" checked> Use these colours and fonts</label>
      ${st.background ? '<label class="toggle"><input type="checkbox" id="impUseBg" checked> Use the PDF\'s background image</label>' : ''}
      <label class="toggle"><input type="checkbox" id="impUseLayout" checked> Show dishes like the printed menu</label>
    </div></div>`;
}
function updateImpCount() { const n = found.filter(d => d.use).length; $('#impGo').textContent = `Import ${n} dish${n === 1 ? '' : 'es'}`; $('#impGo').disabled = !n; }
$('#impBody').addEventListener('input', e => {
  if (e.target.id === 'impAll') { found.forEach(d => d.use = e.target.checked); return renderFound(); }
  const row = e.target.closest('.imp-row'), f = e.target.dataset.f; if (!row || !f) return;
  const d = found[row.dataset.i];
  if (f === 'use') { d.use = e.target.checked; row.classList.toggle('off', !d.use); updateImpCount(); }
  else d[f] = e.target.value;
});
$('#impBody').addEventListener('change', e => { if (e.target.dataset.f === 'category') renderFound(); });
$('#impBody').addEventListener('click', e => {
  if (!e.target.closest('[data-nophoto]')) return;
  const d = found[e.target.closest('.imp-row').dataset.i]; d.photo = null; d.preview = null; renderFound();
});
$('#impGo').onclick = async () => {
  const list = found.filter(d => d.use && d.name.trim());
  const btn = $('#impGo'); btn.disabled = true;
  let done = 0, failed = 0;
  for (const d of list) {
    btn.textContent = `Importing ${done + 1} of ${list.length}…`;
    const fd = new FormData();
    for (const k of ['name', 'price', 'category', 'description']) fd.append(k, d[k] || '');
    if (d.photo) fd.append('file', new File([d.photo], 'photo.jpg', { type: 'image/jpeg' }));
    try { R = (await api('/api/dishes', { method: 'POST', body: fd })).restaurant; done++; } catch { failed++; }
  }
  // Apply the PDF's look to the menu page
  const useStyle = $('#impUseStyle')?.checked, useBg = $('#impUseBg')?.checked, useLayout = $('#impUseLayout')?.checked;
  if (impStyle?.colours && (useStyle || useBg || useLayout)) {
    try {
      btn.textContent = 'Applying your style…';
      const c = impStyle.colours, f = impStyle.fonts, page = {};
      const body = { page };
      if (useStyle) {
        body.theme = 'custom';
        if (c.accent) body.accent = c.accent;
        page.colors = { bg: c.background, surface: c.surface, ink: c.ink, muted: c.muted };
        page.headFont = f.head || ''; page.nameFont = f.name || ''; page.bodyFont = f.body || '';
        page.nameCase = f.nameCaps ? 'upper' : 'none';
        page.bgMode = c.dark ? 'none' : 'paper';
      }
      if (useBg && impStyle.background) {
        const fd = new FormData(); fd.append('file', new File([impStyle.background], 'background.jpg', { type: 'image/jpeg' }));
        R.bg_image = (await api('/api/restaurant/bg-image', { method: 'POST', body: fd })).url;
        page.bgMode = 'photo';
      }
      if (useLayout) page.layout = 'classic';
      if (useStyle && !R.tagline && impStyle.subtitle) body.tagline = impStyle.subtitle;
      R = (await api('/api/restaurant', { method: 'PUT', body })).restaurant; fillDesign(); previewLoaded = false;
    } catch (x) { toast(x.message); }
  }
  impDlg.close(); renderDishes();
  toast(failed ? `Imported ${done} dishes (${failed} failed)` : `Imported ${done} dishes 🎉`);
  location.hash = '#dishes';
};

// ---------- Menu page design ----------
let draft; // unsaved copy of the restaurant settings, drives the live preview
function fillDesign() {
  draft = { theme: R.theme, accent: R.accent, page: { ...R.page, colors: { ...R.page.colors } } };
  const f = $('#profileForm');
  ['name', 'tagline', 'address', 'phone', 'hours', 'wifi', 'slug'].forEach(k => f[k].value = R[k] || '');
  $$('[data-pg]').forEach(el => { const v = R.page[el.dataset.pg]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v || ''; });
  $('#themes').innerHTML = Object.entries(THEME_META).map(([k, t]) =>
    `<div class="theme-opt" data-theme="${k}"><div class="sw" style="background:${t.bg || 'var(--cbg)'};color:${t.fg || 'var(--cink)'};font-family:${t.font}">Aa<span style="width:24px;height:4px;border-radius:2px;margin-top:4px;background:var(--acc)"></span></div>${t.label}</div>`).join('');
  $('#accents').innerHTML = ACCENTS.map(c => `<span class="swatch" data-c="${c}" style="background:${c}"></span>`).join('') +
    `<input type="color" id="accentCustom" title="Custom colour">`;
  $('#fonts').innerHTML = Object.entries(FONTS).map(([k, [l, fam]]) => `<div class="tile" data-font="${k}"><b style="font-family:${fam}">Aa</b>${l}</div>`).join('');
  for (const [k, opts] of Object.entries(PAGE_TILES)) $(`[data-page="${k}"]`).innerHTML = opts.map(([v, l, svg]) => `<div class="tile" data-v="${v}"><svg viewBox="0 0 40 40" width="54" height="54">${svg}</svg>${l}</div>`).join('');
  $('[data-page="bgMode"]').innerHTML = BG_MODES.map(([v, l]) => `<button type="button" class="chip" data-v="${v}">${l}</button>`).join('');
  $('#gfonts').innerHTML = GOOGLE_FONTS.map(f => `<option value="${f}">`).join('');
  $('[data-page="order"]').innerHTML = ORDER.map(([v, l]) => `<button type="button" class="chip" data-v="${v}">${l}</button>`).join('');
  paintDesign(); paintImages();
}
function paintDesign() {
  $$('.theme-opt').forEach(el => { el.classList.toggle('sel', el.dataset.theme === draft.theme); el.style.setProperty('--acc', draft.accent); el.style.setProperty('--cbg', draft.page.colors.bg); el.style.setProperty('--cink', draft.page.colors.ink); });
  $('.custom-colours').classList.toggle('hidden', draft.theme !== 'custom');
  $$('[data-color]').forEach(el => el.value = draft.page.colors[el.dataset.color]);
  $('#nameCaps').checked = draft.page.nameCase === 'upper';
  $('.bg-up').classList.toggle('hidden', draft.page.bgMode !== 'photo');
  $$('.swatch').forEach(el => el.classList.toggle('sel', el.dataset.c === draft.accent));
  $('#accentCustom').value = draft.accent;
  $$('#fonts .tile').forEach(el => el.classList.toggle('sel', el.dataset.font === draft.page.font));
  $$('#tab-design [data-page]').forEach(g => { g.style.setProperty('--a', draft.accent); g.querySelectorAll('[data-v]').forEach(el => el.classList.toggle('sel', el.dataset.v === draft.page[g.dataset.page])); });
}
function paintImages() {
  for (const k of ['logo', 'cover', 'qr_logo', 'bg_image']) {
    const prev = $(`#${{ qr_logo: 'qrLogo', bg_image: 'bg' }[k] || k}Prev`);
    prev.style.backgroundImage = R[k] ? `url("${R[k]}")` : '';
    $(`[data-rm="${k}"]`).classList.toggle('hidden', !R[k]);
  }
}
function currentDraft() {
  const f = $('#profileForm'), out = { ...R, theme: draft.theme, accent: draft.accent, page: { ...draft.page } };
  ['name', 'tagline', 'address', 'phone', 'hours', 'wifi'].forEach(k => out[k] = f[k].value);
  $$('[data-pg]').forEach(el => out.page[el.dataset.pg] = el.type === 'checkbox' ? el.checked : el.value.trim());
  out.page.nameCase = $('#nameCaps').checked ? 'upper' : 'none';
  return out;
}
let previewLoaded = false, previewTimer;
function loadPreview() {
  const fr = $('#previewFrame');
  if (!previewLoaded) { fr.src = `/m/${R.slug}?preview=1`; previewLoaded = true; fr.onload = () => pushPreview(); }
  else pushPreview();
}
function pushPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => $('#previewFrame').contentWindow?.postMessage({ type: 'menuqr-preview', restaurant: currentDraft() }, location.origin), 80);
}
$('#tab-design').addEventListener('click', e => {
  const th = e.target.closest('[data-theme]'), sw = e.target.closest('.swatch'), fo = e.target.closest('[data-font]'), pg = e.target.closest('[data-page] [data-v]');
  if (th) draft.theme = th.dataset.theme;
  else if (sw) draft.accent = sw.dataset.c;
  else if (fo) draft.page.font = fo.dataset.font;
  else if (pg) draft.page[pg.closest('[data-page]').dataset.page] = pg.dataset.v;
  else return;
  paintDesign(); pushPreview();
});
$('#tab-design').addEventListener('input', e => {
  if (e.target.id === 'accentCustom') { draft.accent = e.target.value; paintDesign(); }
  if (e.target.id === 'nameCaps') draft.page.nameCase = e.target.checked ? 'upper' : 'none';
  if (e.target.dataset.color) { draft.page.colors[e.target.dataset.color] = e.target.value; $$('.theme-opt').forEach(el => { el.style.setProperty('--cbg', draft.page.colors.bg); el.style.setProperty('--cink', draft.page.colors.ink); }); }
  pushPreview();
});
async function saveDesign() {
  const d = currentDraft(), body = { ...d, slug: $('#profileForm').slug.value };
  const oldSlug = R.slug;
  if (body.slug && body.slug !== oldSlug && !confirm('Changing your menu link will break any QR codes you already printed. Continue?')) return;
  try {
    R = (await api('/api/restaurant', { method: 'PUT', body })).restaurant;
    fillDesign(); refreshLinks(); renderDishes(); flash('#savedMsg'); toast('Menu page saved');
    if (R.slug !== oldSlug) { previewLoaded = false; loadPreview(); }
  } catch (x) { toast(x.message); }
}
$('#saveDesign').onclick = saveDesign;
$('#profileForm').addEventListener('submit', e => { e.preventDefault(); saveDesign(); });

let upField;
document.addEventListener('click', async e => {
  const up = e.target.closest('[data-up]'), rm = e.target.closest('[data-rm]');
  if (up) { upField = up.dataset.up; $('#imgInput').click(); }
  if (rm) {
    try {
      await api('/api/restaurant/' + rm.dataset.rm.replace('_', '-'), { method: 'DELETE' });
      R[rm.dataset.rm] = null; paintImages(); updateLogoUi(); renderQr(); pushPreview();
    } catch (x) { toast(x.message); }
  }
});
$('#imgInput').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const big = upField === 'cover' || upField === 'bg_image';
    const small = await resizeImage(file, big ? 2000 : 700, !big);
    const fd = new FormData(); fd.append('file', small);
    const { url } = await api('/api/restaurant/' + upField.replace('_', '-'), { method: 'POST', body: fd });
    R[upField] = url; paintImages(); updateLogoUi(); renderQr();
    if (upField === 'bg_image') { draft.page.bgMode = 'photo'; paintDesign(); }
    pushPreview(); toast('Image uploaded');
  } catch (x) { toast(x.message); }
};

// ---------- QR designer ----------
const DEFAULT = {
  dotShape: 'rounded', dotScale: .9, dotColor: '#1f1b16', gradient: 'none', dotColor2: '#d9480f', gradAngle: 45,
  eyeFrame: 'rounded', eyeBall: 'rounded', eyeFrameColor: '#1f1b16', eyeBallColor: '#d9480f', bgColor: '#ffffff',
  logoSrc: 'restaurant', logoSize: .24, logoShape: 'original', logoPlate: true,
  frame: 'card', caption: 'SCAN FOR MENU', frameColor: '#1f1b16', frameTextColor: '#ffffff', showName: true, ecl: 'Q',
};
const PRESETS = [
  { name: 'Classic', d: { dotShape: 'square', dotScale: 1, dotColor: '#000000', gradient: 'none', eyeFrame: 'square', eyeBall: 'square', eyeFrameColor: '#000000', eyeBallColor: '#000000', bgColor: '#ffffff', frameColor: '#000000', frameTextColor: '#ffffff' } },
  { name: 'Brand', brand: true },
  { name: 'Ocean', d: { dotShape: 'smooth', dotScale: 1, dotColor: '#0b7285', gradient: 'linear', dotColor2: '#1864ab', gradAngle: 45, eyeFrame: 'drop', eyeBall: 'drop', eyeFrameColor: '#0b3d5c', eyeBallColor: '#1098ad', bgColor: '#ffffff', frameColor: '#0b3d5c', frameTextColor: '#ffffff' } },
  { name: 'Sunset', d: { dotShape: 'dots', dotScale: .9, dotColor: '#d9480f', gradient: 'linear', dotColor2: '#c2255c', gradAngle: 135, eyeFrame: 'circle', eyeBall: 'circle', eyeFrameColor: '#c2255c', eyeBallColor: '#d9480f', bgColor: '#fffaf5', frameColor: '#e8590c', frameTextColor: '#ffffff' } },
  { name: 'Forest', d: { dotShape: 'classy', dotScale: 1, dotColor: '#2b8a3e', gradient: 'radial', dotColor2: '#1b4332', eyeFrame: 'leaf', eyeBall: 'leaf', eyeFrameColor: '#1b4332', eyeBallColor: '#2f9e44', bgColor: '#f8fcf8', frameColor: '#1b4332', frameTextColor: '#f8fcf8' } },
  { name: 'Gold Luxe', d: { dotShape: 'diamond', dotScale: .95, dotColor: '#e9c46a', gradient: 'linear', dotColor2: '#b8860b', gradAngle: 90, eyeFrame: 'square', eyeBall: 'diamond', eyeFrameColor: '#e9c46a', eyeBallColor: '#f4d58d', bgColor: '#141414', frameColor: '#141414', frameTextColor: '#e9c46a' } },
  { name: 'Sweetheart', d: { dotShape: 'heart', dotScale: 1, dotColor: '#c2255c', gradient: 'linear', dotColor2: '#862e9c', gradAngle: 45, eyeFrame: 'rounded', eyeBall: 'heart', eyeFrameColor: '#862e9c', eyeBallColor: '#e64980', bgColor: '#fff5f8', frameColor: '#a61e4d', frameTextColor: '#ffffff' } },
  { name: 'Starry', d: { dotShape: 'star', dotScale: 1, dotColor: '#364fc7', gradient: 'radial', dotColor2: '#1c1f4a', eyeFrame: 'dotted', eyeBall: 'star', eyeFrameColor: '#1c1f4a', eyeBallColor: '#f59f00', bgColor: '#ffffff', frameColor: '#1c1f4a', frameTextColor: '#ffd43b' } },
  { name: 'Lines', d: { dotShape: 'vlines', dotScale: .95, dotColor: '#1f1b16', gradient: 'linear', dotColor2: '#495057', gradAngle: 90, eyeFrame: 'rounded', eyeBall: 'circle', eyeFrameColor: '#1f1b16', eyeBallColor: '#e8590c', bgColor: '#ffffff', frameColor: '#e8590c', frameTextColor: '#ffffff' } },
  { name: 'Midnight', d: { dotShape: 'random', dotScale: 1, dotColor: '#e9ecef', gradient: 'none', eyeFrame: 'rounded', eyeBall: 'circle', eyeFrameColor: '#ffd43b', eyeBallColor: '#ffd43b', bgColor: '#0b1021', frameColor: '#0b1021', frameTextColor: '#ffd43b' } },
];
const SHAPE_LABELS = { square: 'Square', rounded: 'Rounded', dots: 'Dots', smooth: 'Fluid', classy: 'Classy', diamond: 'Diamond', star: 'Stars', heart: 'Hearts', plus: 'Plus', vlines: 'Vertical', hlines: 'Horizontal', random: 'Bubbles', circle: 'Circle', leaf: 'Leaf', drop: 'Drop', dotted: 'Dotted' };
const CHIPS = {
  logoSrc: [['none', 'No logo'], ['restaurant', 'Restaurant logo'], ['custom', 'Upload custom']],
  logoShape: [['original', 'Original'], ['rounded', 'Rounded'], ['circle', 'Circle']],
  frame: [['none', 'None'], ['card', 'Card'], ['banner', 'Banner'], ['tent', 'Table tent']],
};
const SHAPES = { dotShape: QRRender.DOTS, eyeFrame: QRRender.EYE_FRAMES, eyeBall: QRRender.EYE_BALLS };
let D, renderSeq = 0;

function initQr() {
  D = { ...DEFAULT, ...(R.qr_design || {}) };
  if (!R.qr_design) Object.assign(D, brandDesign());
  for (const [k, opts] of Object.entries(CHIPS)) $(`[data-chips="${k}"]`).innerHTML = opts.map(([v, l]) => `<button type="button" class="chip" data-v="${v}">${l}</button>`).join('');
  paintPresets(); syncControls(); updateLogoUi();
}
function brandDesign() {
  return { dotShape: 'rounded', dotScale: .9, dotColor: '#1f1b16', gradient: 'none', eyeFrame: 'rounded', eyeBall: 'rounded', eyeFrameColor: R.accent, eyeBallColor: R.accent, bgColor: '#ffffff', frameColor: R.accent, frameTextColor: '#ffffff' };
}
function paintPresets() {
  $('#presets').innerHTML = PRESETS.map((p, i) => {
    const d = { ...DEFAULT, ...(p.brand ? brandDesign() : p.d) };
    return `<div class="preset" data-i="${i}"><div class="pv" style="background:${d.bgColor}">${QRRender.toSVG({ ...d, logo: null, data: 'menuqr', margin: 1, ecl: 'L' }, 56)}</div>${p.name}</div>`;
  }).join('');
}
function paintShapes() {
  for (const [k, list] of Object.entries(SHAPES)) {
    $(`[data-shapes="${k}"]`).innerHTML = list.map(v => {
      const svg = k === 'dotShape' ? QRRender.swatch({ ...D, dotShape: v, bgColor: 'transparent', gradient: 'none', dotColor: '#1f1b16' }, 'dots', 40)
        : QRRender.swatch({ [k]: v, color: '#1f1b16' }, k, 40);
      return `<button type="button" class="shape${D[k] === v ? ' sel' : ''}" data-v="${v}" title="${SHAPE_LABELS[v]}">${svg}<span>${SHAPE_LABELS[v]}</span></button>`;
    }).join('');
  }
}
function syncControls() {
  $$('#tab-qr [data-k]').forEach(el => { const v = D[el.dataset.k]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
  $$('[data-chips]').forEach(g => g.querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.v === D[g.dataset.chips])));
  $$('.grad-only').forEach(el => el.classList.toggle('hidden', D.gradient === 'none'));
  $$('.lin-only').forEach(el => el.classList.toggle('hidden', D.gradient !== 'linear'));
  $$('.frame-only').forEach(el => el.classList.toggle('hidden', D.frame === 'none'));
  $('#dotScaleField').classList.toggle('hidden', ['smooth', 'classy'].includes(D.dotShape));
  paintShapes(); updateLogoUi();
}
function logoUrl() { return D.logoSrc === 'restaurant' ? R.logo : D.logoSrc === 'custom' ? R.qr_logo : null; }
function updateLogoUi() {
  if (!D) return;
  $('.logo-custom').classList.toggle('hidden', D.logoSrc !== 'custom');
  $('#noLogoHint').classList.toggle('hidden', !(D.logoSrc === 'restaurant' && !R.logo));
  $('.logo-opts').classList.toggle('hidden', !logoUrl());
}
$('#tab-qr').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  D[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value;
  if (e.target.type === 'range' || e.target.type === 'color' || e.target.type === 'text') { $$('.grad-only').forEach(el => el.classList.toggle('hidden', D.gradient === 'none')); renderQrSoon(); }
  else { syncControls(); renderQr(); }
});
$('#tab-qr').addEventListener('change', e => { if (e.target.type === 'color') paintShapes(); });
$('#tab-qr').addEventListener('click', e => {
  const chip = e.target.closest('[data-chips] .chip'), shape = e.target.closest('[data-shapes] .shape'), pre = e.target.closest('.preset');
  if (chip) D[chip.closest('[data-chips]').dataset.chips] = chip.dataset.v;
  else if (shape) D[shape.closest('[data-shapes]').dataset.shapes] = shape.dataset.v;
  else if (pre) { const p = PRESETS[pre.dataset.i]; Object.assign(D, p.brand ? brandDesign() : p.d); }
  else return;
  syncControls(); renderQr();
});
$('#saveQr').onclick = async () => {
  try { await api('/api/qr-design', { method: 'PUT', body: D }); R.qr_design = { ...D }; flash('#qrSaved'); toast('QR design saved'); }
  catch (x) { toast(x.message); }
};

const dataUrlCache = new Map();
function toDataUrl(url) {
  if (!dataUrlCache.has(url)) dataUrlCache.set(url, fetch(url).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); })));
  return dataUrlCache.get(url);
}
async function qrOpts() {
  const url = logoUrl();
  return { ...D, data: menuUrl(), logo: url ? await toDataUrl(url) : null };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fitText(ctx, text, maxW, size, weight, family) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 8);
}

// Draws the full framed QR at the given QR pixel size; returns a canvas.
async function compose(q) {
  await document.fonts.ready;
  const opts = await qrOpts();
  const img = await QRRender.toImage(opts, q);
  // Scanners need a clear margin ("quiet zone") of a few modules around the code
  const u = q / 100, pad = 8 * u, quiet = Math.max(5 * u, 3 * q / QRRender.count(opts));
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
  return c;
}

let soon;
function renderQrSoon() { clearTimeout(soon); soon = setTimeout(renderQr, 60); }
async function renderQr() {
  if (!D || $('#tab-qr').classList.contains('hidden')) return;
  const seq = ++renderSeq;
  const c = await compose(560);
  if (seq !== renderSeq) return;
  const out = $('#qrCanvas'); out.width = c.width; out.height = c.height;
  out.getContext('2d').drawImage(c, 0, 0);
  out.style.width = (c.height > c.width ? 300 : 340) + 'px';
  out.dataset.rendered = seq;
  checkContrast();
}
function lum(hex) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); }
function checkContrast() {
  const cols = [D.dotColor, D.gradient !== 'none' ? D.dotColor2 : D.dotColor, D.eyeFrameColor, D.eyeBallColor];
  const worst = Math.min(...cols.map(c => contrast(c, D.bgColor)));
  const inverted = lum(D.dotColor) > lum(D.bgColor);
  const w = $('#contrastWarn');
  if (worst < 3) { w.textContent = '⚠️ Low contrast between the code and background — some phones may not scan it. Try darker dots or a lighter background.'; w.classList.remove('hidden'); }
  else if (inverted) { w.textContent = 'ℹ️ Light-on-dark codes look great but a few older scanner apps can struggle. Test with several phones.'; w.classList.remove('hidden'); }
  else w.classList.add('hidden');
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('#dlPng').onclick = async () => { const c = await compose(1600); c.toBlob(b => download(b, `${R.slug}-menu-qr.png`)); };
$('#dlSvg').onclick = async () => {
  download(new Blob([QRRender.toSVG({ ...(await qrOpts()), margin: 3 }, 1024)], { type: 'image/svg+xml' }), `${R.slug}-menu-qr.svg`);
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
    <p class="tip">Cut along the edges and place on tables. Print at 100% scale.</p>
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
