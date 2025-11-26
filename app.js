const express = require('express');
const webhookRouter = require('./routes/webhookRoutes');

const app = express();

// Minimal middleware: accept JSON bodies
app.use(express.json());

// Mount webhook route under /webhook
app.use('/webhook', webhookRouter);
// Also accept legacy/api path used by some providers: /api/webhook
app.use('/api/webhook', webhookRouter);

// Basic error handler (returns JSON)
app.use((err, req, res, next) => {
  console.error('App error:', err && err.stack ? err.stack : err);
  res.status(err.status || 500).json({ success: false, error: err.message || String(err) });
});

module.exports = app;

//done