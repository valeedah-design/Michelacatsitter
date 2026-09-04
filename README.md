# Michela Cat Sitter — website + admin panel

A real, launchable website for Michela's cat-sitting business, with a small
built-in admin panel so Michela (or you) can upload and swap out the site's
photos without touching any code.

- **Frontend**: one responsive page (`public/index.html` + `public/styles.css` +
  `public/script.js`) — works on desktop and mobile, in Italian and English.
- **Backend**: a small Node.js/Express server (`server.js`) that serves the
  site, stores content in a JSON file, and powers a password-protected admin
  panel at `/admin` for managing images.
- **Admin panel** (`/admin`): three sections — **Logo**, **"Chi sono" photo**
  (Michela's photo), and **Gallery** (4 photos) — matching the three places
  the design actually uses photos. Upload a file in any slot and it updates
  live on the public site immediately.

## 1. Run it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
cp .env.example .env
```

Open `.env` and set:

- `ADMIN_USERNAME` — the username Michela will log in with (e.g. `michela`)
- `ADMIN_PASSWORD` — a real password (not the placeholder!)
- `SESSION_SECRET` — a long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Then start the server:

```bash
npm start
```

- Public site: http://localhost:3000
- Admin panel: http://localhost:3000/admin (log in with the username/password
  you set in `.env`)

Uploaded images are saved to the `uploads/` folder and tracked in
`data/content.json`. Both are created automatically on first run.

## 2. Deploying it for real

This is a normal Node.js app, so it runs on any Node host. The one thing to
check for on any host: **persistent disk**. Uploaded photos live in the
`uploads/` folder and `data/content.json` on the server's filesystem — if the
host wipes the filesystem on every deploy (some "serverless" platforms do),
uploaded photos will disappear. A host with a persistent disk avoids this.
The app already supports this cleanly via one environment variable,
`PERSIST_DIR` (see step 4 below).

**Recommended: [Render](https://render.com)** (simple, has a free tier, supports
a persistent disk):

### Step 1 — put the code on GitHub

Render deploys from a Git repo.

- Easiest, no command line needed: create a new repository at
  [github.com/new](https://github.com/new) (call it `michela-cat-sitter`,
  keep it private if you like), then on the repo page use **"uploading an
  existing file"** and drag in everything from the unzipped project folder
  (skip `node_modules` — it isn't in the zip anyway, and isn't needed in the
  repo; Render installs it during build).
- Or with git installed locally:
  ```bash
  cd michela-cat-sitter
  git init
  git add .
  git commit -m "Initial site"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/michela-cat-sitter.git
  git push -u origin main
  ```

### Step 2 — create the Render web service

1. Sign up / log in at [render.com](https://render.com) (you can sign in
   with your GitHub account, which makes the next step one click).
2. **New +** → **Web Service** → connect the `michela-cat-sitter` repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Instance type: the free tier works for getting started (it sleeps after
   inactivity and wakes on the next visit, which is fine for a small
   business site; upgrade later if that delay bothers you).

### Step 3 — add the persistent disk

Still on the same service's setup (or under its **Disks** tab after
creating it):

1. Add a disk — mount path `/var/data`, 1 GB is plenty for photos.
2. Add an environment variable `PERSIST_DIR` = `/var/data`. That's it — the
   app stores both uploaded photos and `content.json` under whatever
   `PERSIST_DIR` points to, so this one disk covers everything that needs
   to survive a redeploy.

### Step 4 — add the rest of the environment variables

In the same **Environment** tab, add:

- `ADMIN_USERNAME` — e.g. `michela`
- `ADMIN_PASSWORD` — a real password
- `SESSION_SECRET` — a long random string (generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Do not commit your real `.env` file to GitHub — these go directly into
Render's dashboard instead.

### Step 5 — deploy, then check it

Click **Create Web Service**. Render builds and deploys, and gives you a URL
like `michela-cat-sitter.onrender.com`. Open it, click through the site, log
into `/admin`, and try uploading a photo to confirm everything works before
moving on to the domain.

### Step 6 — point your IONOS domain at it

1. In the Render dashboard, open the service → **Settings** → **Custom
   Domains** → **Add Custom Domain**, and enter your domain (e.g.
   `michelacatsitter.it`, and optionally `www.michelacatsitter.it` too).
   Render shows you the DNS record(s) it needs — usually a **CNAME** (for
   `www`) and/or an **A record** (for the bare/apex domain).
2. Log into [IONOS](https://www.ionos.com) → **Domains & SSL** → select your
   domain → **DNS**.
3. Add the record(s) Render showed you:
   - For `www.michelacatsitter.it`: a **CNAME** record, host `www`, pointing
     to the target Render gave you (something like
     `michela-cat-sitter.onrender.com`).
   - For the bare domain `michelacatsitter.it`: Render will give you an
     **A record** IP to add (host `@`), since CNAMEs aren't allowed on a bare
     domain. If IONOS offers "ALIAS" or "dynamic forwarding" for the apex
     domain to a CNAME target instead, that works too — either is fine, just
     follow whichever Render's instructions show for your case.
   - Remove/replace any existing IONOS "parked domain" A or CNAME records
     for the same host names so they don't conflict.
4. Back in Render, wait for the domain to show **Verified** (DNS changes can
   take anywhere from a few minutes to a few hours to propagate) — Render
   also issues a free SSL certificate automatically once verified, so the
   site will be reachable at `https://michelacatsitter.it`.

Other hosts that work the same way if you'd rather not use Render: Railway,
Fly.io, or a small VPS (e.g. DigitalOcean) running the app behind `pm2` or
as a `systemd` service — the same `PERSIST_DIR` env var trick applies
anywhere you can mount a persistent volume.

Other good options that work the same way: Railway, Fly.io, or a small VPS
(e.g. DigitalOcean) running the app behind `pm2` or as a `systemd` service.

**Do not deploy this as-is to a purely static host** (Netlify/Vercel/GitHub
Pages static hosting, etc.) — the admin panel and image uploads need a
running Node server, which those don't provide by default.

## 3. Before you tell people the site is live — placeholders to fill in

The site is fully built and working, but a handful of details in it are
still placeholders because we don't have the real values yet. Search the
project for these and replace them:

**In `public/index.html`:**
- `[CITTÀ]` / `[CITY]` — the city/area Michela covers (appears in the hero
  badge, the "coverage area" line, and the footer).
- `[X]+ anni` and `[N]+` — years of experience and number of cats — the stats
  shown under the hero buttons.
- `da [PREZZO]€ / giornata` and `da [PREZZO]€ / notte` — pricing for
  "Diurno a domicilio" and "Soggiorno a casa mia". The per-visit price
  (`da 30€ / visita`) is already filled in from what Michela sent.
- The 3 testimonial cards (`#recensioni`) — currently placeholder text and
  names; swap in real client reviews when you have them.
- Several FAQ answers still say `[Rispondi qui: ...]` — these are questions
  Michela hasn't given answers for yet (key handover, emergency policy,
  multi-cat pricing, booking lead time, cancellation policy). Fill these in
  before launch — an FAQ with visible placeholder brackets looks unfinished.
- Contact section: phone number and email are placeholders
  (`[NUMERO DI TELEFONO]` / `[EMAIL]`).

**In `public/script.js`** (top of the file, a few constants):
```js
var WHATSAPP_NUMBER = '39XXXXXXXXXX';       // Michela's real WhatsApp number, with country code, no + or spaces
var WHATSAPP_MESSAGE = '...';               // pre-filled message people send her — already written, tweak if you like
var ROVER_URL = 'https://www.rover.com/';   // Michela's actual Rover.com profile link
var CONTACT_FORM_ENDPOINT = '';             // see below — empty means the contact form shows a friendly "not connected yet" message
```

**Contact form**: the "Scrivimi" form on the site doesn't send anywhere yet.
The easiest fix is a free [Formspree](https://formspree.io) form — sign up,
create a form, and paste the endpoint URL into `CONTACT_FORM_ENDPOINT` above.
Until that's set, the form shows a polite message instead of silently
failing.

**Availability calendar**: the calendar on the site (`#disponibilita`) is a
**visual demo only** — clicking days doesn't book anything or check real
availability, and the site says so in a small disclaimer under it. To make
it real, the simplest route is a
[Google Calendar Appointment Schedule](https://support.google.com/calendar/answer/10729749)
embedded there instead, or a booking tool like Calendly. Ask if you'd like
help wiring that up.

**Photos**: the About and Gallery photo slots are currently empty (they show
a `[FOTO]` placeholder) so Michela can add her own via the admin panel — see
below. The logo is already in place.

## 4. Using the admin panel (for Michela)

1. Go to `yoursite.com/admin` and log in.
2. Each section (Logo, Chi sono, Galleria) shows its current image or a
   placeholder if empty.
3. Choose a file (JPG, PNG, WEBP or GIF, up to 8MB), click **Carica**
   (Upload) — the site updates immediately, no need to touch any code.
4. **Rimuovi** (Remove) clears a photo back to the placeholder (available for
   the About photo and gallery slots; the logo can only be replaced, not
   removed, since the site needs one).
5. **Logout** when done.

If Michela forgets her password, whoever has server access can set a new one
by changing `ADMIN_PASSWORD` in the environment and restarting the server.

## Project structure

```
michela-site/
  server.js              — the backend (routes, auth, uploads, content API)
  package.json
  .env.example            — copy to .env and fill in
  data/content.json        — tracks which image is in which slot
  uploads/                 — uploaded image files live here
  public/
    index.html              — the public site
    styles.css
    script.js
    admin/
      assets/               — admin panel CSS/JS (not sensitive, served openly)
  views/
    admin/
      login.html            — admin login page (protected, not statically servable)
      dashboard.html         — admin dashboard (protected, not statically servable)
```
