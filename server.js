const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const analysisRoutes = require('./routes/analysis');

const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for development/iframe compatibility
  crossOriginOpenerPolicy: false, // Prevents Firebase Auth popup from instantly failing
}));
app.use(express.json());

// Serve static files from root
app.use(express.static(path.join(__dirname, '.')));

// CORS — allow only your Vercel frontend (set FRONTEND_URL in .env)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — protects the ServiceNow PDI from overload
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/analysis', analysisRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA catch-all route (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (host 0.0.0.0)`);
});

module.exports = app;
