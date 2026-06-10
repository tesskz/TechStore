// =============================================
//  Middlewares d'authentification (JWT)
// =============================================

const jwt = require('jsonwebtoken');

// Vérifie que la requête contient un token valide
// → ajoute req.user = { id, username, role }
function verifierToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Connexion requise (token manquant)' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Session expirée, reconnecte-toi' });
  }
}

// À utiliser APRÈS verifierToken : bloque les non-admins
function verifierAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
}

module.exports = { verifierToken, verifierAdmin };
