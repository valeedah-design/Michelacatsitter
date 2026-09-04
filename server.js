// Local dev / Render (or any traditional always-on host) entry point.
// Vercel doesn't use this file at all — see api/index.js instead.

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Michela Cat Sitter site running at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD is not set — /admin login will not work until you set it in .env');
  }
});
