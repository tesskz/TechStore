// =============================================
//  Controller Produit : liste + ajout + suppression
//  + gestion du stock de clés (codes série)
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

// Normalise une liste de codes : accepte un tableau, une chaîne
// (une clé par ligne) ou l'ancien champ activation_code unique.
function normaliserCodes(body) {
  let codes = body.codes;
  if (typeof codes === 'string') codes = codes.split('\n');
  if (!codes && body.activation_code) codes = [body.activation_code];
  return (codes || []).map(c => String(c).trim()).filter(Boolean);
}

// ─── GET /api/products?category=&search= ─────
async function liste(req, res) {
  try {
    const { category, search, platform } = req.query;
    const admin = estAdmin(req);

    // Stock = nombre de clés "disponible". L'admin voit aussi le total.
    let colonnes = `pr.id, pr.name, pr.price, pr.img, pr.category, pr.platform, pr.created_at,
      (SELECT COUNT(*) FROM cles_jeu c WHERE c.produit_id = pr.id AND c.statut = 'disponible') AS stock`;
    if (admin) {
      colonnes += `, (SELECT COUNT(*) FROM cles_jeu c WHERE c.produit_id = pr.id) AS stock_total`;
    }

    let sql = `SELECT ${colonnes} FROM produits pr WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ' AND pr.category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND pr.name LIKE ?';
      params.push(`%${search}%`);
    }
    if (platform) {
      sql += ' AND pr.platform = ?';
      params.push(platform);
    }
    sql += ' ORDER BY pr.id DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows); // le frontend attend un tableau directement
  } catch (err) {
    console.error('Erreur liste produits :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/products (admin) ──────────────
// Crée le produit + son stock initial de clés (une par ligne).
async function ajouter(req, res) {
  try {
    const { name, price, img, category, platform } = req.body;
    const codes = normaliserCodes(req.body);

    if (!name || price == null) {
      return res.status(400).json({ message: 'Nom et prix requis' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Prix invalide' });
    }
    if (codes.length === 0) {
      return res.status(400).json({ message: 'Au moins une clé d\'activation est requise' });
    }

    // Image par défaut si le champ est laissé vide
    const image = img && img.trim() !== ''
      ? img.trim()
      : `https://picsum.photos/seed/${encodeURIComponent(name)}/400/300`;

    const [result] = await db.query(
      'INSERT INTO produits (name, price, img, category, platform) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), price, image, category || null, platform || null]
    );
    const produitId = result.insertId;

    // Stock initial de clés
    for (const code of codes) {
      await db.query(
        'INSERT INTO cles_jeu (produit_id, code) VALUES (?, ?)',
        [produitId, code]
      );
    }

    res.status(201).json({
      message: `Produit ajouté (${codes.length} clé${codes.length > 1 ? 's' : ''})`,
      product: {
        id: produitId, name, price, img: image,
        category: category || null, platform: platform || null,
        stock: codes.length
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

// ─── GET /api/products/:id/keys (admin) ──────
// Liste les clés d'un produit avec leur statut.
async function listeCles(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, code, statut, commande_id
       FROM cles_jeu WHERE produit_id = ?
       ORDER BY (statut = 'disponible') DESC, id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste clés :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/products/:id/keys (admin) ─────
// Ajoute des clés au stock d'un produit existant.
async function ajouterCles(req, res) {
  try {
    const codes = normaliserCodes(req.body);
    if (codes.length === 0) {
      return res.status(400).json({ message: 'Aucune clé fournie' });
    }

    const [prod] = await db.query('SELECT id FROM produits WHERE id = ?', [req.params.id]);
    if (prod.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    for (const code of codes) {
      await db.query(
        'INSERT INTO cles_jeu (produit_id, code) VALUES (?, ?)',
        [req.params.id, code]
      );
    }
    res.status(201).json({ message: `${codes.length} clé${codes.length > 1 ? 's' : ''} ajoutée${codes.length > 1 ? 's' : ''} au stock` });
  } catch (err) {
    console.error('Erreur ajout clés :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── DELETE /api/products/keys/:cleId (admin) ─
// Supprime une clé encore disponible (jamais une clé vendue).
async function supprimerCle(req, res) {
  try {
    const [result] = await db.query(
      "DELETE FROM cles_jeu WHERE id = ? AND statut = 'disponible'",
      [req.params.cleId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Clé introuvable ou déjà vendue' });
    }
    res.json({ message: 'Clé supprimée' });
  } catch (err) {
    console.error('Erreur suppression clé :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { liste, ajouter, supprimer, listeCles, ajouterCles, supprimerCle };
