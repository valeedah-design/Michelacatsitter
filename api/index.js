// Vercel serverless function entry point.
//
// vercel.json rewrites every request to this one function, which just hands
// off to the same Express app used locally and on Render (app.js) — no
// app.listen() here, Vercel manages the actual request/response cycle itself.

require('dotenv').config();
module.exports = require('../app');
