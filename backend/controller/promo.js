// =============================================
//  Controller Codes promo
//  - admin : liste / créer / activer / supprimer
//  - client connecté : vérifier un code (check)
// =============================================

const db = require('../config/db');

// Calcule la remise (€) d'un code promo pour un sous-total donné.
// Exporté pour être réutilisé par le controller commande (revérif serveur).
function calculerRemise(promo, sousTotal) {
  let remise = promo.type === 'pourcentage'
    ? sousTotal * (parseFloat(promo.valeur) / 100)
    : parseFloat(promo.valeur);
  remise = Math.min(remise, sousTotal);        // jamais plus que le sous-total
  return Math.round(remise * 100) / 100;
}

// ─── GET /api/promos (admin) ─────────────────
async function liste(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM codes_promo ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste promos :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/promos (admin) ────────────────
async function ajouter(req, res) {
  try {
    let { code, type, valeur } = req.body;

    if (!code || code.trim() === '') {
      return res.status(400).json({ message: 'Code requis' });
    }
    type   = (type === 'montant') ? 'montant' : 'pourcentage';
    valeur = parseFloat(valeur);
    if (isNaN(valeur) || valeur <= 0) {
      return res.status(400).json({ message: 'Valeur invalide' });
    }
    if (type === 'pourcentage' && valeur > 100) {
      return res.status(400).json({ message: 'Le pourcentage ne peut pas dépasser 100' });
    }

    code = code.trim().toUpperCase();

    const [result] = await db.query(
      'INSERT INTO codes_promo (code, type, valeur) VALUES (?, ?, ?)',
      [code, type, valeur]
    );

    res.status(201).json({
      message: 'Code promo créé 🎟️',
      promo: { id: result.insertId, code, type, valeur, actif: 1 }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ce code existe déjà' });
    }
    console.error('Erreur ajout promo :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── PATCH /api/promos/:id (admin) ───────────
// Active / désactive un code (body : { actif: true|false })
async function basculer(req, res) {
  try {
    const actif = req.body.actif ? 1 : 0;
    const [result] = await db.query(
      'UPDATE codes_promo SET actif = ? WHERE id = ?',
      [actif, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }
    res.json({ message: actif ? 'Code activé' : 'Code désactivé', actif });
  } catch (err) {
    console.error('Erreur bascule promo :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── DELETE /api/promos/:id (admin) ──────────
async function supprimer(req, res) {
  try {
    const [result] = await db.query(
      'DELETE FROM codes_promo WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }
    res.json({ message: 'Code promo supprimé ✅' });
  } catch (err) {
    console.error('Erreur suppression promo :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/promos/check (connecté) ───────
// Vérifie un code et renvoie la remise estimée pour un sous-total.
async function verifier(req, res) {
  try {
    const { code, sous_total } = req.body;
    if (!code || code.trim() === '') {
      return res.status(400).json({ valid: false, message: 'Code requis' });
    }

    const [rows] = await db.query(
      'SELECT * FROM codes_promo WHERE code = ? AND actif = 1',
      [code.trim().toUpperCase()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Code promo invalide ou expiré' });
    }

    const promo  = rows[0];
    const st     = parseFloat(sous_total) || 0;
    const remise = calculerRemise(promo, st);

    res.json({
      valid:  true,
      code:   promo.code,
      type:   promo.type,
      valeur: parseFloat(promo.valeur),
      remise,
      message: 'Code promo appliqué 🎟️'
    });
  } catch (err) {
    console.error('Erreur vérif promo :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { liste, ajouter, basculer, supprimer, verifier, calculerRemise };
