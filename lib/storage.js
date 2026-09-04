// Storage abstraction: where uploaded photos and content.json actually live.
//
// - If BLOB_READ_WRITE_TOKEN is set (Vercel, with a Blob store connected),
//   everything is stored in Vercel Blob — this is what makes the app work on
//   Vercel's serverless functions, which have no writable/persistent local disk.
// - Otherwise, everything is stored on local disk under PERSIST_DIR (defaults
//   to the project folder). This is what local dev and a traditional host
//   like Render use.
//
// Same app code, same API routes, either way — server.js/app.js never has to
// know which backend is in use.

const fs = require('fs');
const path = require('path');

const GALLERY_SIZE = 4;
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

function emptyContent() {
  return { logo: '/uploads/logo.png', about: null, hero: null, gallery: Array(GALLERY_SIZE).fill(null) };
}

function normalizeContent(raw) {
  const content = Object.assign(emptyContent(), raw || {});
  if (!Array.isArray(content.gallery)) content.gallery = Array(GALLERY_SIZE).fill(null);
  while (content.gallery.length < GALLERY_SIZE) content.gallery.push(null);
  content.gallery = content.gallery.slice(0, GALLERY_SIZE);
  return content;
}

// ---------------------------------------------------------------------------
// Local disk backend
// ---------------------------------------------------------------------------
const PERSIST_DIR = process.env.PERSIST_DIR || path.join(__dirname, '..');
const DATA_DIR = path.join(PERSIST_DIR, 'data');
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(PERSIST_DIR, 'uploads');
const DEFAULT_LOGO_PATH = path.join(__dirname, '..', 'assets', 'default-logo.png');

function ensureLocalDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const logoPath = path.join(UPLOADS_DIR, 'logo.png');
  if (!fs.existsSync(logoPath) && fs.existsSync(DEFAULT_LOGO_PATH)) {
    fs.copyFileSync(DEFAULT_LOGO_PATH, logoPath);
  }
  if (!fs.existsSync(CONTENT_PATH)) {
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(emptyContent(), null, 2));
  }
}

// ---------------------------------------------------------------------------
// Vercel Blob backend
// ---------------------------------------------------------------------------
const CONTENT_BLOB_PATH = 'data/content.json';
const LOGO_BLOB_PATH = 'uploads/logo.png';

let blobModule = null;
function blob() {
  // required lazily so local/Render deploys never need this package installed
  if (!blobModule) blobModule = require('@vercel/blob');
  return blobModule;
}

async function ensureDefaultLogoOnBlob() {
  const { head, put } = blob();
  try {
    const meta = await head(LOGO_BLOB_PATH);
    return meta.url;
  } catch (e) {
    const buf = fs.readFileSync(DEFAULT_LOGO_PATH);
    const result = await put(LOGO_BLOB_PATH, buf, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
    });
    return result.url;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function readContent() {
  if (USE_BLOB) {
    const { head } = blob();
    try {
      const meta = await head(CONTENT_BLOB_PATH);
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (!res.ok) throw new Error('blob fetch failed: ' + res.status);
      const raw = await res.json();
      return normalizeContent(raw);
    } catch (e) {
      // First boot on a fresh Blob store: seed the logo and an empty content.json.
      const logoUrl = await ensureDefaultLogoOnBlob();
      const content = normalizeContent({ logo: logoUrl });
      await writeContent(content);
      return content;
    }
  }
  ensureLocalDirs();
  try {
    const raw = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8'));
    return normalizeContent(raw);
  } catch (e) {
    return normalizeContent(null);
  }
}

async function writeContent(content) {
  if (USE_BLOB) {
    const { put } = blob();
    await put(CONTENT_BLOB_PATH, JSON.stringify(content, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  ensureLocalDirs();
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2));
}

// Saves an uploaded file's buffer and returns the public URL/path to store
// against that slot in content.json.
async function saveUpload(buffer, slot, ext, mimetype) {
  const filename = `${slot}-${Date.now()}${ext}`;
  if (USE_BLOB) {
    const { put } = blob();
    const result = await put(`uploads/${filename}`, buffer, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: false,
    });
    return result.url;
  }
  ensureLocalDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return '/uploads/' + filename;
}

module.exports = { readContent, writeContent, saveUpload, UPLOADS_DIR, USE_BLOB, GALLERY_SIZE };
