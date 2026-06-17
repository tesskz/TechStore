// =============================================
//  Routes de l'API (montées sur /api)
// =============================================

const express = require('express');
const router  = express.Router();

const utilisateur = require('../controller/utilisateur');
const produit     = require('../controller/produit');
const panier      = require('../controller/panier');
const commande    = require('../controller/commande');
const promo       = require('../controller/promo');
const paiement    = require('../controller/paiement');
const { verifierToken, verifierAdmin } = require('../middleware/auth');

// ─── Config publique (clé Stripe publishable) ─
router.get('/config', paiement.config);

// ─── Auth (public) ───────────────────────────
router.post('/auth/register', utilisateur.register);
router.post('/auth/login',    utilisateur.login);

// ─── Produits ────────────────────────────────
router.get   ('/products',     produit.liste);                                       // public
router.post  ('/products',     verifierToken, verifierAdmin, produit.ajouter);       // admin
// ⚠️ /products/keys/:cleId AVANT /products/:id (sinon "keys" lu comme un id)
router.delete('/products/keys/:cleId', verifierToken, verifierAdmin, produit.supprimerCle); // admin
router.get   ('/products/:id/keys',    verifierToken, verifierAdmin, produit.listeCles);    // admin
router.post  ('/products/:id/keys',    verifierToken, verifierAdmin, produit.ajouterCles);  // admin
router.delete('/products/:id', verifierToken, verifierAdmin, produit.supprimer);     // admin

// ─── Panier (connecté uniquement) ────────────
// ⚠️ /cart/clear DOIT être déclaré AVANT /cart/:id,
// sinon Express croit que "clear" est un id
router.get   ('/cart',       verifierToken, panier.liste);
router.post  ('/cart',       verifierToken, panier.ajouter);
router.delete('/cart/clear', verifierToken, panier.vider);
router.delete('/cart/:id',   verifierToken, panier.supprimer);

// ─── Paiement (Stripe) ───────────────────────
router.post  ('/payments/create-intent', verifierToken, paiement.creerIntent);       // connecté

// ─── Commandes ───────────────────────────────
router.post  ('/orders',      verifierToken, commande.passer);                       // connecté (après paiement)
router.get   ('/orders',      verifierToken, commande.mesCommandes);                 // connecté
router.get   ('/orders/all',  verifierToken, verifierAdmin, commande.toutes);        // admin
router.patch ('/orders/:id',  verifierToken, verifierAdmin, commande.changerStatut); // admin

// ─── Codes promo ─────────────────────────────
router.post  ('/promos/check', verifierToken, promo.verifier);                       // connecté
router.get   ('/promos',       verifierToken, verifierAdmin, promo.liste);           // admin
router.post  ('/promos',       verifierToken, verifierAdmin, promo.ajouter);         // admin
router.patch ('/promos/:id',   verifierToken, verifierAdmin, promo.basculer);        // admin
router.delete('/promos/:id',   verifierToken, verifierAdmin, promo.supprimer);       // admin

module.exports = router;
