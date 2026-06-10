// =============================================
//  TechStore - Serveur Express
//  Point d'entrée : node server.js
// =============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const router  = require('./router/router');

const app = express();

// ─── Middlewares globaux ─────────────────────
app.use(cors());                 // autorise les requêtes cross-origin
app.use(express.json());         // parse le JSON des requêtes (req.body)

// ─── Frontend servi en statique ──────────────
// http://localhost:3000/ → frontend/index.html
// "no-store" : le navigateur recharge toujours les fichiers à jour
// (évite les bugs de cache pendant le développement)
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.set('Cache-Control', 'no-store')
}));

// ─── API ─────────────────────────────────────
app.use('/api', router);

// Route API inconnue → 404 JSON (et pas du HTML)
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// ─── Lancement ───────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TechStore en ligne → http://localhost:${PORT}`);
});
