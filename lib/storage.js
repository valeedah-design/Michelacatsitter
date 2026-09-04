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

const DEFAULT_SERVICES = [
  {
    icon: 'home',
    titleIt: 'Visita a domicilio', titleEn: 'Drop-in visit',
    descIt: "Vengo a casa tua per una visita breve, circa un'ora: cibo, acqua fresca, lettiera pulita e tante coccole secondo la sua routine.",
    descEn: "I come to your home for a short visit, about an hour: food, fresh water, a clean litter box and plenty of cuddles, on your cat's own routine.",
    priceIt: 'da 30€ / visita (1 ora)', priceEn: 'from €30 / visit (1 hour)',
  },
  {
    icon: 'clock',
    titleIt: 'Diurno a domicilio', titleEn: 'Full-day, at your home',
    descIt: "Resto a casa tua per l'intera giornata: il tuo gatto ha compagnia continua, dalla mattina alla sera, senza mai sentirsi solo.",
    descEn: 'I stay at your home for the whole day: your cat has company from morning to evening, and is never left alone.',
    priceIt: 'da [PREZZO]€ / giornata', priceEn: 'from [PRICE]€ / day',
  },
  {
    icon: 'moon',
    titleIt: 'Soggiorno a casa mia', titleEn: 'Boarding, at my home',
    descIt: 'Il tuo gatto viene a stare a casa mia: massima attenzione, compagnia e coccole giorno e notte per tutta la tua assenza.',
    descEn: "Your cat comes to stay at my home: full attention, company and cuddles day and night for the whole time you're away.",
    priceIt: 'da [PREZZO]€ / notte', priceEn: 'from [PRICE]€ / night',
  },
  {
    icon: 'paw',
    titleIt: 'Altri animali & extra', titleEn: 'Other pets & extras',
    descIt: 'Cani, conigli, tartarughe — e piccole commissioni come piante da annaffiare o posta da ritirare: chiedimi pure.',
    descEn: 'Dogs, rabbits, turtles — and small errands like watering plants or collecting mail: just ask.',
    priceIt: 'su richiesta', priceEn: 'on request',
  },
];

const DEFAULT_TESTIMONIALS = [
  { quoteIt: '[Inserisci qui la recensione di un cliente]', quoteEn: '[Insert a client review here]', name: '[Nome cliente]' },
  { quoteIt: '[Inserisci qui la recensione di un cliente]', quoteEn: '[Insert a client review here]', name: '[Nome cliente]' },
  { quoteIt: '[Inserisci qui la recensione di un cliente]', quoteEn: '[Insert a client review here]', name: '[Nome cliente]' },
];

function emptyContent() {
  return {
    logo: '/uploads/logo.png',
    about: null,
    hero: null,
    gallery: Array(GALLERY_SIZE).fill(null),
    // Client-editable contact links (admin > Impostazioni contatti).
    whatsappNumber: '39XXXXXXXXXX',
    whatsappMessage: 'Ciao Michela! Vorrei chiederti informazioni per il mio gatto.',
    roverUrl: 'https://www.rover.com/',
    // Client-editable services list (admin > Cosa faccio).
    services: DEFAULT_SERVICES.map((s) => Object.assign({}, s)),
    // Client-editable testimonials list (admin > Recensioni).
    testimonials: DEFAULT_TESTIMONIALS.map((t) => Object.assign({}, t)),
    // How an availability request is confirmed when a client clicks a free day.
    // 'message' shows the text below on the page; 'whatsapp' opens WhatsApp
    // with that text (day filled in) ready to send.
    availabilityMethod: 'message',
    availabilityMessage: {
      it: 'Richiesta inviata per il {giorno}! Ti rispondo a breve.',
      en: 'Request sent for the {giorno}! I will reply soon.',
    },
    // Dates the client has blocked off (vacation, already booked elsewhere,
    // etc.), as 'YYYY-MM-DD' strings — set from the admin calendar, shown as
    // unavailable on the public availability calendar.
    blockedDates: [],
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeContent(raw) {
  const content = Object.assign(emptyContent(), raw || {});
  if (!Array.isArray(content.gallery)) content.gallery = Array(GALLERY_SIZE).fill(null);
  while (content.gallery.length < GALLERY_SIZE) content.gallery.push(null);
  content.gallery = content.gallery.slice(0, GALLERY_SIZE);
  if (!Array.isArray(content.services) || !content.services.length) {
    content.services = DEFAULT_SERVICES.map((s) => Object.assign({}, s));
  }
  if (!Array.isArray(content.testimonials) || !content.testimonials.length) {
    content.testimonials = DEFAULT_TESTIMONIALS.map((t) => Object.assign({}, t));
  }
  if (content.availabilityMethod !== 'whatsapp') content.availabilityMethod = 'message';
  if (!content.availabilityMessage || typeof content.availabilityMessage !== 'object') {
    content.availabilityMessage = emptyContent().availabilityMessage;
  } else {
    content.availabilityMessage = Object.assign({ it: '', en: '' }, content.availabilityMessage);
  }
  if (!Array.isArray(content.blockedDates)) {
    content.blockedDates = [];
  } else {
    content.blockedDates = Array.from(new Set(content.blockedDates.filter((d) => ISO_DATE_RE.test(d)))).sort();
  }
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
