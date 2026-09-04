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

This app supports two different ways of running in production, and it's the
same codebase either way — nothing to rewrite, just a different host and a
couple of environment variables:

- **Option A — Render** (or any traditional always-on host: Railway, Fly.io,
  a VPS): a real, persistent server process with a real disk. Uploaded
  photos are written straight to that disk (via the `PERSIST_DIR` env var).
- **Option B — Vercel**: serverless — there's no traditional server or local
  disk at all. Uploaded photos and `content.json` are stored in **Vercel
  Blob** instead (Vercel's own file storage), and admin logins use a signed
  cookie rather than server memory, so it all works the same way across
  Vercel's short-lived function instances. Set the `BLOB_READ_WRITE_TOKEN`
  environment variable (Vercel adds this automatically once you connect a
  Blob store — see below) and the app switches to this mode automatically;
  leave it unset and it uses local disk instead, so the exact same code runs
  unmodified on both platforms.

Pick whichever host you'd rather use — pricing and control are the real
difference, not functionality. Instructions for both follow.

### Option A: Render

**Recommended if you'd rather not think about it** (simple, has a free tier,
supports a persistent disk):

#### Step 1 — put the code on GitHub

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

#### Step 2 — create the Render web service

1. Sign up / log in at [render.com](https://render.com) (you can sign in
   with your GitHub account, which makes the next step one click).
2. **New +** → **Web Service** → connect the `michela-cat-sitter` repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Instance type: the free tier works for getting started (it sleeps after
   inactivity and wakes on the next visit, which is fine for a small
   business site; upgrade later if that delay bothers you).

#### Step 3 — add the persistent disk

Still on the same service's setup (or under its **Disks** tab after
creating it):

1. Add a disk — mount path `/var/data`, 1 GB is plenty for photos.
2. Add an environment variable `PERSIST_DIR` = `/var/data`. That's it — the
   app stores both uploaded photos and `content.json` under whatever
   `PERSIST_DIR` points to, so this one disk covers everything that needs
   to survive a redeploy.

#### Step 4 — add the rest of the environment variables

In the same **Environment** tab, add:

- `ADMIN_USERNAME` — e.g. `michela`
- `ADMIN_PASSWORD` — a real password
- `SESSION_SECRET` — a long random string (generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Do not commit your real `.env` file to GitHub — these go directly into
Render's dashboard instead.

#### Step 5 — deploy, then check it

Click **Create Web Service**. Render builds and deploys, and gives you a URL
like `michela-cat-sitter.onrender.com`. Open it, click through the site, log
into `/admin`, and try uploading a photo to confirm everything works before
moving on to the domain.

#### Step 6 — point your IONOS domain at it

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

Other hosts that work the same way as Render if you'd rather not use it:
Railway, Fly.io, or a small VPS (e.g. DigitalOcean) running the app behind
`pm2` or as a `systemd` service — the same `PERSIST_DIR` env var trick
applies anywhere you can mount a persistent volume.

### Option B: Vercel

Vercel doesn't run a traditional always-on server — it runs your code as
short-lived serverless functions instead, so there's no local disk to save
uploaded photos to. This app handles that by storing uploads and
`content.json` in **Vercel Blob** (Vercel's built-in file storage) instead
of on disk, and using a signed cookie for admin logins instead of
server-side session memory. That switch happens automatically based on one
environment variable — nothing to configure beyond what's below.

#### Step 1 — put the code on GitHub

Same as Option A's Step 1 above — Vercel deploys from a Git repo too. If
you've already pushed to GitHub, skip ahead to Step 2.

#### Step 2 — create the Vercel project

1. Sign up / log in at [vercel.com](https://vercel.com) — signing in with
   GitHub makes the next step one click.
2. **Add New...** → **Project** → **Import** your `michela-cat-sitter` repo.
3. Vercel auto-detects it as a Node project. Leave the build settings as
   Vercel suggests (no changes needed — `vercel.json` in the repo already
   tells Vercel how to route requests). Don't click Deploy yet.

#### Step 3 — create and connect a Blob store

Still in the project setup (or afterward, under the project's **Storage**
tab):

1. Go to the **Storage** tab → **Create Database** → **Blob**.
2. Give it a name (anything, e.g. `michela-photos`) and create it.
3. Connect it to this project if it doesn't do so automatically. This step
   is what makes Vercel add the `BLOB_READ_WRITE_TOKEN` environment variable
   to your project automatically — you don't type this one in yourself.

#### Step 4 — add the rest of the environment variables

Under the project's **Settings → Environment Variables**, add:

- `ADMIN_USERNAME` — e.g. `michela`
- `ADMIN_PASSWORD` — a real password
- `SESSION_SECRET` — a long random string (generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

(`BLOB_READ_WRITE_TOKEN` should already be there from Step 3 — double check
it's listed.)

#### Step 5 — deploy, then check it

Deploy (or redeploy, if it already deployed automatically after import).
Vercel gives you a URL like `michela-cat-sitter.vercel.app`. Open it, click
through the site, log into `/admin`, and upload a test photo — check it
actually appears (this exercises the Blob storage path, so it's worth
confirming here rather than assuming).

#### Step 6 — point your IONOS domain at it

1. In the Vercel dashboard, open the project → **Settings** → **Domains** →
   add your domain (e.g. `michelacatsitter.it`).
2. Vercel shows you the DNS record(s) it needs — typically an **A record**
   for the bare domain and a **CNAME** for `www`.
3. Log into [IONOS](https://www.ionos.com) → **Domains & SSL** → select your
   domain → **DNS**, and add exactly the records Vercel showed you (remove
   any existing IONOS "parked domain" records for the same host names first
   so they don't conflict).
4. Back in Vercel, wait for the domain to show as verified — Vercel issues a
   free SSL certificate automatically, so the site will be reachable at
   `https://michelacatsitter.it` once DNS propagates (a few minutes to a few
   hours).

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
