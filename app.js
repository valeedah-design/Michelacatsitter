// The Express app itself — no app.listen() here. This same app is used by:
//   - server.js (local dev / Render / any traditional always-on host)
//   - api/index.js (Vercel, where it's wrapped as a serverless function)
//
// It doesn't need to know or care which host it's running on, or whether
// uploaded photos are going to local disk or Vercel Blob — that's all
// handled by lib/storage.js. Login sessions are a signed cookie (lib/auth.js)
// rather than server-side session state, so this works the same way whether
// the same process handles every request (Render) or a fresh one handles
// each request (Vercel).

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const storage = require('./lib/storage');
const auth = require('./lib/auth');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const GALLERY_SIZE = storage.GALLERY_SIZE;

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  if (auth.isValidSession(req.headers.cookie, SESSION_SECRET)) return next();
  if (req.path.startsWith('/admin/api/')) return res.status(401).json({ error: 'not authenticated' });
  return res.redirect('/admin/login');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- public content API (read-only, no auth — the site needs this to render images) ----------
app.get('/api/content', async (req, res) => {
  res.json(await storage.readContent());
});

// ---------- admin auth ----------
// NOTE: these admin routes are registered BEFORE the blanket express.static(public)
// middleware below (defense-in-depth). The HTML they serve also lives outside
// public/ entirely (in views/admin/), so it is never reachable as a static file
// even if route order ever changes.
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'dashboard.html'));
});
app.get('/admin/login', (req, res) => {
  if (auth.isValidSession(req.headers.cookie, SESSION_SECRET)) return res.redirect('/admin');
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
    res.setHeader('Set-Cookie', auth.createSessionCookie(SESSION_SECRET));
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid username or password' });
});
app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearSessionCookie());
  res.json({ ok: true });
});

// serve admin.css / admin.js without auth (no sensitive content in them)
app.use('/admin/assets', express.static(path.join(__dirname, 'public', 'admin', 'assets')));

// ---------- admin content API (protected) ----------
app.get('/admin/api/content', requireAuth, async (req, res) => {
  res.json(await storage.readContent());
});

// Static file serving is registered AFTER the /admin* routes above so it can
// never shadow them. public/ no longer contains any admin HTML (that lives in
// views/admin/, outside this tree), so this is safe either way — but keeping
// the order right is good practice.
// (This /uploads route only matters on a local-disk deployment — on Vercel,
// uploaded files get their own full Blob URL and this route is simply unused.)
app.use('/uploads', express.static(storage.UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

// slot: "logo" | "about" | "gallery-0".."gallery-3"
app.post('/admin/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  const slot = req.body.slot;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const isGallery = /^gallery-\d+$/.test(slot);
  if (slot !== 'logo' && slot !== 'about' && !isGallery) {
    return res.status(400).json({ error: 'Invalid slot' });
  }
  let galleryIdx = null;
  if (isGallery) {
    galleryIdx = parseInt(slot.split('-')[1], 10);
    if (galleryIdx < 0 || galleryIdx >= GALLERY_SIZE) return res.status(400).json({ error: 'Invalid gallery slot' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const safeSlot = slot.replace(/[^a-z0-9_-]/gi, '');
    const url = await storage.saveUpload(req.file.buffer, safeSlot, ext, req.file.mimetype);

    const content = await storage.readContent();
    if (slot === 'logo') content.logo = url;
    else if (slot === 'about') content.about = url;
    else content.gallery[galleryIdx] = url;

    await storage.writeContent(content);
    res.json({ ok: true, content });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

app.post('/admin/api/remove', requireAuth, async (req, res) => {
  const slot = req.body.slot;
  const content = await storage.readContent();
  if (slot === 'about') {
    content.about = null;
  } else if (/^gallery-\d+$/.test(slot)) {
    const idx = parseInt(slot.split('-')[1], 10);
    if (idx < 0 || idx >= GALLERY_SIZE) return res.status(400).json({ error: 'Invalid gallery slot' });
    content.gallery[idx] = null;
  } else {
    return res.status(400).json({ error: 'This section cannot be removed, only replaced' });
  }
  await storage.writeContent(content);
  res.json({ ok: true, content });
});

module.exports = app;
