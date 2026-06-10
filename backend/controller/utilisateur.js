// =============================================
//  Controller Utilisateur : register + login
// =============================================

const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ─── POST /api/auth/register ─────────────────
async function register(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe requis' });
    }
    if (password.length < 4) {
      return res.status(400).json({ message: 'Mot de passe trop court (4 caractères minimum)' });
    }

    // Le pseudo est-il déjà pris ?
    const [existing] = await db.query(
      'SELECT id FROM utilisateurs WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà pris' });
    }

    // On ne stocke JAMAIS le mot de passe en clair → hash bcrypt
    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO utilisateurs (username, password, role) VALUES (?, ?, "client")',
      [username, hash]
    );

    res.status(201).json({
      message: 'Compte créé avec succès 🎉',
      user: { id: result.insertId, username, role: 'client' }
    });
  } catch (err) {
    console.error('Erreur register :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── POST /api/auth/login ────────────────────
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe requis' });
    }

    const [rows] = await db.query(
      'SELECT * FROM utilisateurs WHERE username = ?',
      [username]
    );

    // Message volontairement vague : on ne dit pas si c'est le pseudo
    // ou le mot de passe qui est faux (sécurité)
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    // Token signé valable 24h — contient id + username + role
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: `Bienvenue ${user.username} !`,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Erreur login :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { register, login };
