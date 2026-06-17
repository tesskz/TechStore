// =============================================
//  Client Stripe (clé secrète côté serveur)
//  → Remplis STRIPE_SECRET_KEY dans backend/.env
// =============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;

// Si la clé est absente (ou laissée sur le placeholder "sk_test_xxx"), on
// exporte null : les routes de paiement renverront alors une erreur claire
// au lieu de faire planter le serveur au démarrage.
const configuree = key && key.startsWith('sk_') && !key.endsWith('xxx');
const stripe = configuree ? new Stripe(key) : null;

if (stripe) {
  console.log(`✅ Stripe activé (${key.startsWith('sk_live') ? 'mode LIVE ⚠️' : 'mode test'})`);
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY absente/invalide dans backend/.env — paiements désactivés');
}

module.exports = stripe;
