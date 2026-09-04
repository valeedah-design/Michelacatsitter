require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

// PERSIST_DIR is where uploaded photos and content.json live. Defaults to this
// project folder (fine for local dev). On a host with a persistent disk (e.g.
// Render), set PERSIST_DIR to that disk's mount path so both "data/" and
// "uploads/" survive redeploys — a single disk covers both since they're just
// subfolders of PERSIST_DIR.
const PERSIST_DIR = process.env.PERSIST_DIR || __dirname;
const DATA_DIR = path.join(PERSIST_DIR, 'data');
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(PERSIST_DIR, 'uploads');

const GALLERY_SIZE = 4; // number of gallery photo slots managed by the admin panel

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_PATH)) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify({ logo: '/uploads/logo.png', about: null, gallery: Array(GALLERY_SIZE).fill(null) }, null, 2));
}
// Seed a default logo onto a fresh persistent disk (PERSIST_DIR may point at an
// empty volume on first boot — the repo's own copy under assets/ is the fallback).
const DEFAULT_LOGO_PATH = path.join(__dirname, 'assets', 'default-logo.png');
const LOGO_PATH = path.join(UPLOADS_DIR, 'logo.png');
if (!fs.existsSync(LOGO_PATH) && fs.existsSync(DEFAULT_LOGO_PATH)) {
  fs.copyFileSync(DEFAULT_LOGO_PATH, LOGO_PATH);
}

function readContent() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8'));
    if (!Array.isArray(raw.gallery)) raw.gallery = Array(GALLERY_SIZE).fill(null);
    while (raw.gallery.length < GALLERY_SIZE) raw.gallery.push(null);
    return raw;
  } catch (e) {
    return { logo: '/uploads/logo.png', about: null, gallery: Array(GALLERY_SIZE).fill(null) };
  }
}
function writeContent(content) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 } // 12h
}));

// ---------- public content API (read-only, no auth — the site needs this to render images) ----------
app.get('/api/content', (req, res) => {
  res.json(readContent());
});

// ---------- admin auth ----------
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/admin/api/')) return res.status(401).json({ error: 'not authenticated' });
  return res.redirect('/admin/login');
}

// NOTE: these admin routes are registered BEFORE the blanket express.static(public)
// middleware below (defense-in-depth). The HTML they serve also lives outside
// public/ entirely (in views/admin/), so it is never reachable as a static file
// even if route order ever changes.
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'dashboard.html'));
});
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'views', 'admin', 'login.html'));
});
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not set on the server — see .env.example' });
  }
  const okUser = username && safeEqual(username, ADMIN_USERNAME);
  const okPass = password && safeEqual(password, ADMIN_PASSWORD);
  if (okUser && okPass) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});
app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// serve admin.css / admin.js without auth (no sensitive content in them)
app.use('/admin/assets', express.static(path.join(__dirname, 'public', 'admin', 'assets')));

// ---------- admin content API (protected) ----------
app.get('/admin/api/content', requireAuth, (req, res) => {
  res.json(readContent());
});

// Static file serving is registered AFTER the /admin* routes above so it can
// never shadow them. public/ no longer contains any admin HTML (that lives in
// views/admin/, outside this tree), so this is safe either way — but keeping
// the order right is good practice.
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const slot = (req.body.slot || 'image').replace(/[^a-z0-9_-]/gi, '');
    cb(null, `${slot}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

// slot: "logo" | "about" | "gallery-0".."gallery-3"
app.post('/admin/api/upload', requireAuth, upload.single('file'), (req, res) => {
  const slot = req.body.slot;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicPath = '/uploads/' + req.file.filename;
  const content = readContent();

  if (slot === 'logo') {
    content.logo = publicPath;
  } else if (slot === 'about') {
    content.about = publicPath;
  } else if (/^gallery-\d+$/.test(slot)) {
    const idx = parseInt(slot.split('-')[1], 10);
    if (idx < 0 || idx >= GALLERY_SIZE) return res.status(400).json({ error: 'Invalid gallery slot' });
    content.gallery[idx] = publicPath;
  } else {
    return res.status(400).json({ error: 'Invalid slot' });
  }

  writeContent(content);
  res.json({ ok: true, content });
});

app.post('/admin/api/remove', requireAuth, (req, res) => {
  const slot = req.body.slot;
  const content = readContent();
  if (slot === 'about') {
    content.about = null;
  } else if (/^gallery-\d+$/.test(slot)) {
    const idx = parseInt(slot.split('-')[1], 10);
    if (idx < 0 || idx >= GALLERY_SIZE) return res.status(400).json({ error: 'Invalid gallery slot' });
    content.gallery[idx] = null;
  } else {
    return res.status(400).json({ error: 'This section cannot be removed, only replaced' });
  }
  writeContent(content);
  res.json({ ok: true, content });
});

app.listen(PORT, () => {
  console.log(`Michela Cat Sitter site running at http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD is not set — /admin login will not work until you set it in .env');
  }
});
