// =============================================
//  Controller Panier (toutes les routes exigent
//  un utilisateur connecté → req.user.id)
// =============================================

const db = require('../config/db');

// ─── GET /api/cart ───────────────────────────
async function liste(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT pa.id AS panier_id,
              pr.id, pr.name, pr.price, pr.img,
              pa.quantity
       FROM panier pa
       JOIN produits pr ON pr.id = pa.produit_id
       WHERE pa.utilisateur_id = ?
       ORDER BY pa.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste panier :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/cart  { produit_id, quantity } ─
async function ajouter(req, res) {
  try {
    const { produit_id, quantity = 1 } = req.body;

    if (!produit_id) {
      return res.status(400).json({ message: 'produit_id requis' });
    }

    // Le produit existe-t-il vraiment ?
    const [produits] = await db.query(
      'SELECT id, name FROM produits WHERE id = ?',
      [produit_id]
    );
    if (produits.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    // Déjà dans le panier → on incrémente la quantité
    // (grâce à la clé UNIQUE (utilisateur_id, produit_id))
    await db.query(
      `INSERT INTO panier (utilisateur_id, produit_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [req.user.id, produit_id, quantity]
    );

    res.status(201).json({ message: `${produits[0].name} ajouté au panier 🛒` });
  } catch (err) {
    console.error('Erreur ajout panier :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── DELETE /api/cart/:id ────────────────────
async function supprimer(req, res) {
  try {
    // Le "AND utilisateur_id = ?" empêche de supprimer
    // une ligne du panier de quelqu'un d'autre
    const [result] = await db.query(
      'DELETE FROM panier WHERE id = ? AND utilisateur_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Article introuvable dans ton panier' });
    }
    res.json({ message: 'Article retiré du panier' });
  } catch (err) {
    console.error('Erreur suppression panier :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── DELETE /api/cart/clear ──────────────────
async function vider(req, res) {
  try {
    await db.query(
      'DELETE FROM panier WHERE utilisateur_id = ?',
      [req.user.id]
    );
    res.json({ message: 'Panier vidé' });
  } catch (err) {
    console.error('Erreur vidage panier :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { liste, ajouter, supprimer, vider };
