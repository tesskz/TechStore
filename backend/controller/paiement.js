// =============================================
//  Controller Paiement (Stripe)
//  - config : expose la clé publishable (publique)
//  - creerIntent : crée un PaymentIntent (montant calculé serveur)
// =============================================

const stripe   = require('../config/stripe');
const db       = require('../config/db');
const { resumePanier } = require('./commande');

const DEVISE = 'eur';

// ─── GET /api/config (public) ────────────────
// La clé publishable est faite pour le frontend → on peut l'exposer.
function config(req, res) {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeActive: !!stripe
  });
}

// ─── POST /api/payments/create-intent (connecté) ─
// Le montant vient TOUJOURS du serveur (panier + promo), jamais du client.
async function creerIntent(req, res) {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Paiement indisponible : STRIPE_SECRET_KEY manquante dans backend/.env' });
    }

    const resume = await resumePanier(db, req.user.id, req.body.code_promo);
    if (resume.error) return res.status(409).json({ message: resume.error });
    if (resume.total <= 0) {
      return res.status(400).json({ message: 'Le montant à payer doit être supérieur à 0 €' });
    }

    // Stripe travaille en centimes (le plus petit unité de la devise)
    const montantCents = Math.round(resume.total * 100);

    const pi = await stripe.paymentIntents.create({
      amount:   montantCents,
      currency: DEVISE,
      automatic_payment_methods: { enabled: true },
      // metadata = source de vérité au moment du checkout (cf. commande.passer)
      metadata: {
        utilisateur_id: String(req.user.id),
        code_promo:     resume.codeApplique || ''
      }
    });

    res.json({
      clientSecret:    pi.client_secret,
      paymentIntentId: pi.id,
      sous_total:      resume.sousTotal,
      remise:          resume.remise,
      total:           resume.total,
      code_promo:      resume.codeApplique
    });
  } catch (err) {
    console.error('Erreur create-intent :', err.message);
    res.status(500).json({ message: 'Erreur lors de la préparation du paiement' });
  }
}

module.exports = { config, creerIntent };
