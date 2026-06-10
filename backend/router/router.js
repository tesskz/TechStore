// =============================================
//  Routes de l'API (montées sur /api)
// =============================================

const express = require('express');
const router  = express.Router();

const utilisateur = require('../controller/utilisateur');
const produit     = require('../controller/produit');
const panier      = require('../controller/panier');
const { verifierToken, verifierAdmin } = require('../middleware/auth');

// ─── Auth (public) ───────────────────────────
router.post('/auth/register', utilisateur.register);
router.post('/auth/login',    utilisateur.login);

// ─── Produits ────────────────────────────────
router.get   ('/products',     produit.liste);                            // public
router.post  ('/products',     verifierToken, verifierAdmin, produit.ajouter);   // admin
router.delete('/products/:id', verifierToken, verifierAdmin, produit.supprimer); // admin

// ─── Panier (connecté uniquement) ────────────
// ⚠️ /cart/clear DOIT être déclaré AVANT /cart/:id,
// sinon Express croit que "clear" est un id
router.get   ('/cart',       verifierToken, panier.liste);
router.post  ('/cart',       verifierToken, panier.ajouter);
router.delete('/cart/clear', verifierToken, panier.vider);
router.delete('/cart/:id',   verifierToken, panier.supprimer);

module.exports = router;
