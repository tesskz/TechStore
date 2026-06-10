// =============================================
//  Controller Produit : liste + ajout + suppression
// =============================================

const db  = require('../config/db');
const jwt = require('jsonwebtoken');

// La requête vient-elle d'un admin connecté ?
// (route publique → le token est optionnel ici)
function estAdmin(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  try {
    const user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return user.role === 'admin';
  } catch {
    return false;
  }
}

// ─── GET /api/products?category=&search= ─────
async function liste(req, res) {
  try {
    const { category, search } = req.query;

    // ⚠️ Le code d'activation = le produit vendu.
    // On ne l'expose JAMAIS aux visiteurs, seulement aux admins.
    const colonnes = estAdmin(req)
      ? '*'
      : 'id, name, price, img, category, platform, created_at';

    let sql = `SELECT ${colonnes} FROM produits WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY id DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows); // le frontend attend un tableau directement
  } catch (err) {
    console.error('Erreur liste produits :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/products (admin) ──────────────
async function ajouter(req, res) {
  try {
    const { name, price, img, category, platform, activation_code } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: 'Nom et prix requis' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Prix invalide' });
    }
    if (!activation_code || activation_code.trim() === '') {
      return res.status(400).json({ message: 'Code d\'activation du jeu requis' });
    }

    // Image par défaut si le champ est laissé vide
    const image = img && img.trim() !== ''
      ? img.trim()
      : `https://picsum.photos/seed/${encodeURIComponent(name)}/400/300`;

    const [result] = await db.query(
      'INSERT INTO produits (name, price, img, category, platform, activation_code) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), price, image, category || null, platform || null, activation_code.trim()]
    );

    res.status(201).json({
      message: 'Produit ajouté au catalogue',
      product: {
        id: result.insertId, name, price, img: image,
        category: category || null, platform: platform || null,
        activation_code: activation_code.trim()
      }
    });
  } catch (err) {
    console.error('Erreur ajout produit :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── DELETE /api/products/:id (admin) ────────
async function supprimer(req, res) {
  try {
    const [result] = await db.query(
      'DELETE FROM produits WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json({ message: 'Produit supprimé ✅' });
  } catch (err) {
    console.error('Erreur suppression produit :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { liste, ajouter, supprimer };
