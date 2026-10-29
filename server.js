'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const SESSION_DAYS = 30;
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'menuqr.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    hours TEXT DEFAULT '',
    wifi TEXT DEFAULT '',
    theme TEXT DEFAULT 'elegant',
    accent TEXT DEFAULT '#c8553d',
    logo TEXT,
    cover TEXT,
    qr_design TEXT,
    views INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    sort INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scans (
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (restaurant_id, day)
  );
`);

const THEMES = ['elegant', 'modern', 'rustic', 'midnight', 'fresh'];
const PROFILE_FIELDS = ['name', 'tagline', 'address', 'phone', 'hours', 'wifi', 'theme', 'accent'];

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'restaurant';
}
function uniqueSlug(base, exceptId = 0) {
  let slug = slugify(base), n = 1;
  const q = db.prepare('SELECT id FROM restaurants WHERE slug = ? AND id != ?');
  while (q.get(slug, exceptId)) slug = `${slugify(base)}-${++n}`;
  return slug;
}
function removeUpload(rel) {
  if (!rel) return;
  const p = path.join(UPLOAD_DIR, path.basename(rel));
  fs.promises.unlink(p).catch(() => {});
}
function restaurantJson(r) {
  const menus = db.prepare('SELECT id, title, file, size, sort FROM menus WHERE restaurant_id = ? ORDER BY sort, id').all(r.id);
  return {
    ...r,
    qr_design: r.qr_design ? JSON.parse(r.qr_design) : null,
    menus: menus.map(m => ({ ...m, url: `/uploads/${m.file}` })),
    logo: r.logo ? `/uploads/${r.logo}` : null,
    cover: r.cover ? `/uploads/${r.cover}` : null,
  };
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` +
    (process.env.NODE_ENV === 'production' ? '; Secure' : ''));
}
app.use((req, res, next) => {
  const sid = parseCookies(req).sid;
  if (sid) {
    const s = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(sid);
    if (s && s.expires_at > Date.now()) { req.userId = s.user_id; req.sid = sid; }
  }
  next();
});
function auth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Please log in.' });
  req.restaurant = db.prepare('SELECT * FROM restaurants WHERE user_id = ?').get(req.userId);
  if (!req.restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
  next();
}

// Simple in-memory rate limit for auth endpoints
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip, now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < 15 * 60e3);
  arr.push(now); hits.set(key, arr);
  if (arr.length > 30) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  next();
}

// ---------- Uploads ----------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[file.mimetype] || '';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const pdfUpload = multer({
  storage, limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
}).single('file');
const imageUpload = multer({
  storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
}).single('file');

function checkMagic(file, kind) {
  const fd = fs.openSync(file.path, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  if (kind === 'pdf') return buf.slice(0, 5).toString() === '%PDF-';
  return (buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG') ||
    (buf[0] === 0xff && buf[1] === 0xd8) ||
    (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
}
function handleUpload(mw, kind) {
  return (req, res, next) => mw(req, res, err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message });
    if (!req.file) return res.status(400).json({ error: kind === 'pdf' ? 'Please choose a PDF file.' : 'Please choose a PNG, JPG or WebP image.' });
    if (!checkMagic(req.file, kind)) { removeUpload(req.file.filename); return res.status(400).json({ error: 'That file appears to be corrupted or the wrong type.' }); }
    next();
  });
}

// ---------- Auth API ----------
app.post('/api/register', rateLimit, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.restaurantName || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!name) return res.status(400).json({ error: 'Enter your restaurant name.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid: uid } = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(email, hash, Date.now());
  db.prepare('INSERT INTO restaurants (user_id, slug, name) VALUES (?, ?, ?)').run(uid, uniqueSlug(name), name.slice(0, 80));
  startSession(res, uid);
  res.json({ ok: true });
});

app.post('/api/login', rateLimit, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  startSession(res, u.id);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  if (req.sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
  const stats = db.prepare(`SELECT day, count FROM scans WHERE restaurant_id = ? AND day >= ? ORDER BY day`)
    .all(req.restaurant.id, new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10));
  res.json({ email: u.email, publicUrl: PUBLIC_URL, restaurant: restaurantJson(req.restaurant), stats, themes: THEMES });
});

// ---------- Restaurant API ----------
app.put('/api/restaurant', auth, (req, res) => {
  const r = req.restaurant, b = req.body || {};
  const v = {};
  for (const f of PROFILE_FIELDS) v[f] = b[f] !== undefined ? String(b[f]).trim().slice(0, f === 'hours' || f === 'address' ? 300 : 120) : r[f];
  if (!v.name) return res.status(400).json({ error: 'Restaurant name is required.' });
  if (!THEMES.includes(v.theme)) v.theme = 'elegant';
  if (!/^#[0-9a-fA-F]{6}$/.test(v.accent)) v.accent = '#c8553d';
  let slug = r.slug;
  if (b.slug !== undefined && slugify(b.slug) !== r.slug) {
    slug = slugify(b.slug);
    if (db.prepare('SELECT id FROM restaurants WHERE slug = ? AND id != ?').get(slug, r.id)) {
      return res.status(409).json({ error: 'That menu link is already taken.' });
    }
  }
  db.prepare(`UPDATE restaurants SET name=?, tagline=?, address=?, phone=?, hours=?, wifi=?, theme=?, accent=?, slug=? WHERE id=?`)
    .run(v.name, v.tagline, v.address, v.phone, v.hours, v.wifi, v.theme, v.accent, slug, r.id);
  res.json({ restaurant: restaurantJson(db.prepare('SELECT * FROM restaurants WHERE id = ?').get(r.id)) });
});

for (const field of ['logo', 'cover']) {
  app.post(`/api/restaurant/${field}`, auth, handleUpload(imageUpload, 'image'), (req, res) => {
    removeUpload(req.restaurant[field]);
    db.prepare(`UPDATE restaurants SET ${field} = ? WHERE id = ?`).run(req.file.filename, req.restaurant.id);
    res.json({ url: `/uploads/${req.file.filename}` });
  });
  app.delete(`/api/restaurant/${field}`, auth, (req, res) => {
    removeUpload(req.restaurant[field]);
    db.prepare(`UPDATE restaurants SET ${field} = NULL WHERE id = ?`).run(req.restaurant.id);
    res.json({ ok: true });
  });
}

app.put('/api/qr-design', auth, (req, res) => {
  const json = JSON.stringify(req.body || {});
  if (json.length > 20000) return res.status(400).json({ error: 'Design is too large.' });
  db.prepare('UPDATE restaurants SET qr_design = ? WHERE id = ?').run(json, req.restaurant.id);
  res.json({ ok: true });
});

// ---------- Menus API ----------
app.post('/api/menus', auth, handleUpload(pdfUpload, 'pdf'), (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 60) ||
    path.parse(req.file.originalname).name.replace(/[_-]+/g, ' ').slice(0, 60) || 'Menu';
  const count = db.prepare('SELECT COUNT(*) AS c FROM menus WHERE restaurant_id = ?').get(req.restaurant.id).c;
  if (count >= 10) { removeUpload(req.file.filename); return res.status(400).json({ error: 'You can upload up to 10 menus.' }); }
  db.prepare('INSERT INTO menus (restaurant_id, title, file, size, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.restaurant.id, title, req.file.filename, req.file.size, count, Date.now());
  res.json({ restaurant: restaurantJson(req.restaurant) });
});

function ownMenu(req, res) {
  const m = db.prepare('SELECT * FROM menus WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), req.restaurant.id);
  if (!m) res.status(404).json({ error: 'Menu not found.' });
  return m;
}
app.put('/api/menus/:id', auth, (req, res) => {
  const m = ownMenu(req, res); if (!m) return;
  const title = String(req.body.title || '').trim().slice(0, 60);
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  db.prepare('UPDATE menus SET title = ? WHERE id = ?').run(title, m.id);
  res.json({ restaurant: restaurantJson(req.restaurant) });
});
app.post('/api/menus/:id/move', auth, (req, res) => {
  const m = ownMenu(req, res); if (!m) return;
  const list = db.prepare('SELECT id FROM menus WHERE restaurant_id = ? ORDER BY sort, id').all(req.restaurant.id).map(x => x.id);
  const i = list.indexOf(m.id), j = i + (req.body.dir === 'up' ? -1 : 1);
  if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  const upd = db.prepare('UPDATE menus SET sort = ? WHERE id = ?');
  list.forEach((id, idx) => upd.run(idx, id));
  res.json({ restaurant: restaurantJson(req.restaurant) });
});
app.delete('/api/menus/:id', auth, (req, res) => {
  const m = ownMenu(req, res); if (!m) return;
  db.prepare('DELETE FROM menus WHERE id = ?').run(m.id);
  removeUpload(m.file);
  res.json({ restaurant: restaurantJson(req.restaurant) });
});

// ---------- Public ----------
app.get('/api/public/:slug', (req, res) => {
  const r = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!r) return res.status(404).json({ error: 'Menu not found.' });
  const out = restaurantJson(r);
  delete out.user_id; delete out.qr_design; delete out.views;
  res.json(out);
});
app.post('/api/public/:slug/view', (req, res) => {
  const r = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (r) {
    db.prepare('UPDATE restaurants SET views = views + 1 WHERE id = ?').run(r.id);
    db.prepare(`INSERT INTO scans (restaurant_id, day, count) VALUES (?, ?, 1)
      ON CONFLICT(restaurant_id, day) DO UPDATE SET count = count + 1`).run(r.id, new Date().toISOString().slice(0, 10));
  }
  res.status(204).end();
});

const pub = path.join(__dirname, 'public');
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
app.use('/vendor/qr-code-styling.js', express.static(require.resolve('qr-code-styling/lib/qr-code-styling.js')));
app.use('/vendor/pdfjs', express.static(path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build'), { maxAge: '7d' }));
app.use(express.static(pub, { extensions: ['html'] }));
app.get('/m/:slug', (req, res) => res.sendFile(path.join(pub, 'menu.html')));
app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));

setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();

app.listen(PORT, () => console.log(`MenuQR running on http://localhost:${PORT}`));
