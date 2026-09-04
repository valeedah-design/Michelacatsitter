// Stateless, signed-cookie admin session — replaces express-session.
//
// Why: express-session (with the default in-memory store) needs the same
// server process to still be alive to remember who's logged in. That's fine
// on a traditional always-on host (Render, a VPS), but breaks on serverless
// platforms like Vercel, where each request can be handled by a completely
// separate, short-lived instance with no shared memory.
//
// A signed cookie carries its own proof: it's just "admin, expires at X",
// HMAC-signed with SESSION_SECRET so it can't be forged or tampered with,
// and verified fresh on every request — no server-side session state needed
// at all. Works identically whether the app is running on Vercel, Render, or
// your laptop.

const crypto = require('crypto');

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSessionCookie(secret) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `admin.${expires}`;
  const token = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

function isValidSession(cookieHeader, secret) {
  const token = parseCookies(cookieHeader)[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tag, expiresStr, sig] = parts;
  if (tag !== 'admin') return false;

  const expectedSig = sign(`${tag}.${expiresStr}`, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  const expires = parseInt(expiresStr, 10);
  if (!expires || Date.now() > expires) return false;
  return true;
}

module.exports = { createSessionCookie, clearSessionCookie, isValidSession };
