// =============================================
//  Controller Commande
//  - resumePanier : calcule sous-total/remise/total (sans réserver)
//  - passer : checkout après paiement Stripe vérifié (transaction)
//  - mesCommandes : historique du client connecté
//  - toutes : toutes les commandes (admin)
//  - changerStatut : Délivré / Annulé / Remboursé (admin)
// =============================================

const db = require('../config/db');
const stripe = require('../config/stripe');
const { calculerRemise } = require('./promo');

const STATUTS = ['Délivré', 'Annulé', 'Remboursé'];

// Regroupe les lignes par commande_id → { [id]: [lignes...] }
function grouperLignes(lignes) {
  const parCommande = {};
  for (const l of lignes) {
    (parCommande[l.commande_id] ||= []).push(l);
  }
  return parCommande;
}

// Rembourse un paiement Stripe en silence (best-effort, ne jette jamais).
async function rembourser(paymentIntentId) {
  if (!stripe || !paymentIntentId) return;
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    console.log(`↩️  Remboursement émis pour ${paymentIntentId}`);
  } catch (e) {
    console.error('Échec remboursement :', e.message);
  }
}

// ─── Récap du panier (sans rien réserver) ────
// Utilisé pour préparer le paiement (montant) ET revérifié au checkout.
// Renvoie { items, sousTotal, remise, total, codeApplique } ou { error }.
async function resumePanier(executor, userId, codePromoBrut) {
  const [items] = await executor.query(
    `SELECT pa.produit_id, pa.quantity, pr.name, pr.price,
            (SELECT COUNT(*) FROM cles_jeu c
             WHERE c.produit_id = pr.id AND c.statut = 'disponible') AS stock
     FROM panier pa
     JOIN produits pr ON pr.id = pa.produit_id
     WHERE pa.utilisateur_id = ?`,
    [userId]
  );
  if (items.length === 0) return { error: 'Ton panier est vide' };

  let sousTotal = 0;
  for (const it of items) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    if (it.stock < qty) {
      return { error: `Stock insuffisant pour « ${it.name} » : ${it.stock} dispo pour ${qty} demandée(s)` };
    }
    sousTotal += parseFloat(it.price) * qty;
  }
  sousTotal = Math.round(sousTotal * 100) / 100;

  let remise = 0;
  let codeApplique = null;
  const code = (codePromoBrut || '').trim();
  if (code) {
    const [promos] = await executor.query(
      'SELECT * FROM codes_promo WHERE code = ? AND actif = 1',
      [code.toUpperCase()]
    );
    if (promos.length === 0) return { error: 'Code promo invalide ou expiré' };
    remise = calculerRemise(promos[0], sousTotal);
    codeApplique = promos[0].code;
  }
  const total = Math.max(0, Math.round((sousTotal - remise) * 100) / 100);
  return { items, sousTotal, remise, total, codeApplique };
}

// ─── POST /api/orders (connecté) ─────────────
// Le paiement Stripe doit déjà avoir réussi (payment_intent_id fourni).
// On vérifie le paiement, PUIS on réserve une clé par unité dans une
// transaction. Si la livraison échoue après paiement → remboursement.
async function passer(req, res) {
  const userId = req.user.id;
  const paymentIntentId = req.body.payment_intent_id;

  if (!stripe) {
    return res.status(503).json({ message: 'Paiement indisponible : Stripe non configuré' });
  }
  if (!paymentIntentId) {
    return res.status(400).json({ message: 'Paiement requis avant de commander' });
  }

  // 1. Vérifier le paiement AVANT de réserver quoi que ce soit
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return res.status(400).json({ message: 'Paiement introuvable' });
  }
  if (pi.status !== 'succeeded') {
    return res.status(402).json({ message: 'Le paiement n\'a pas abouti' });
  }
  // Le PaymentIntent doit appartenir à l'utilisateur connecté
  if (pi.metadata?.utilisateur_id && pi.metadata.utilisateur_id !== String(userId)) {
    return res.status(403).json({ message: 'Ce paiement ne correspond pas à ton compte' });
  }
  // Le code promo "source de vérité" est celui enregistré au paiement
  const codePromo = pi.metadata?.code_promo || '';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Le panier de l'utilisateur
    const [items] = await conn.query(
      `SELECT pa.produit_id, pa.quantity, pr.name, pr.price
       FROM panier pa
       JOIN produits pr ON pr.id = pa.produit_id
       WHERE pa.utilisateur_id = ?`,
      [userId]
    );
    if (items.length === 0) {
      await conn.rollback();
      await rembourser(paymentIntentId);   // payé mais panier vide → on rembourse
      return res.status(400).json({ message: 'Panier vide. Paiement remboursé.' });
    }

    // 3. Réserver les clés (verrou pessimiste FOR UPDATE)
    const lignes = [];           // une entrée = une clé délivrée
    let sousTotal = 0;
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      // qty est un entier validé → interpolation sûre dans LIMIT
      const [cles] = await conn.query(
        `SELECT id, code FROM cles_jeu
         WHERE produit_id = ? AND statut = 'disponible'
         ORDER BY id ASC
         LIMIT ${qty}
         FOR UPDATE`,
        [it.produit_id]
      );
      if (cles.length < qty) {
        await conn.rollback();
        await rembourser(paymentIntentId);   // plus de stock → on rembourse
        return res.status(409).json({
          message: `Stock insuffisant pour « ${it.name} ». Tu as été remboursé.`
        });
      }
      for (const c of cles) {
        sousTotal += parseFloat(it.price);
        lignes.push({
          produit_id:  it.produit_id,
          produit_nom: it.name,
          prix:        parseFloat(it.price),
          cle_id:      c.id,
          cle_code:    c.code
        });
      }
    }
    sousTotal = Math.round(sousTotal * 100) / 100;

    // 4. Remise (revérifiée d'après le code enregistré au paiement)
    let remise = 0;
    let codeApplique = null;
    if (codePromo !== '') {
      const [promos] = await conn.query(
        'SELECT * FROM codes_promo WHERE code = ? AND actif = 1',
        [codePromo.toUpperCase()]
      );
      if (promos.length > 0) {
        remise = calculerRemise(promos[0], sousTotal);
        codeApplique = promos[0].code;
      }
    }
    const total = Math.max(0, Math.round((sousTotal - remise) * 100) / 100);

    // 5. Le montant payé doit correspondre au total recalculé
    //    (sinon le panier a changé entre le paiement et la validation)
    if (Math.round(total * 100) !== pi.amount) {
      await conn.rollback();
      await rembourser(paymentIntentId);
      return res.status(409).json({
        message: 'Le panier a changé depuis le paiement. Tu as été remboursé, réessaie.'
      });
    }

    // 6. Créer la commande
    const [cmd] = await conn.query(
      `INSERT INTO commandes (utilisateur_id, sous_total, remise, total, code_promo, statut, payment_intent_id)
       VALUES (?, ?, ?, ?, ?, 'Délivré', ?)`,
      [userId, sousTotal, remise, total, codeApplique, paymentIntentId]
    );
    const commandeId = cmd.insertId;

    // 7. Lignes + marquer chaque clé comme vendue (jamais redistribuée)
    for (const l of lignes) {
      await conn.query(
        `INSERT INTO commande_lignes (commande_id, produit_id, produit_nom, prix, cle_id, cle_code)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [commandeId, l.produit_id, l.produit_nom, l.prix, l.cle_id, l.cle_code]
      );
      await conn.query(
        `UPDATE cles_jeu SET statut = 'vendu', commande_id = ? WHERE id = ?`,
        [commandeId, l.cle_id]
      );
    }

    // 8. Vider le panier
    await conn.query('DELETE FROM panier WHERE utilisateur_id = ?', [userId]);

    await conn.commit();

    res.status(201).json({
      message: 'Commande validée 🎉',
      commande: {
        id: commandeId,
        sous_total: sousTotal,
        remise,
        total,
        code_promo: codeApplique,
        statut: 'Délivré',
        lignes: lignes.map(l => ({
          produit_nom: l.produit_nom,
          prix: l.prix,
          cle_code: l.cle_code
        }))
      }
    });
  } catch (err) {
    await conn.rollback();
    await rembourser(paymentIntentId);   // échec après paiement → on rembourse
    console.error('Erreur commande :', err.message);
    res.status(500).json({ message: 'Erreur lors de la commande (paiement remboursé)' });
  } finally {
    conn.release();
  }
}

// ─── GET /api/orders (connecté) ──────────────
// Historique du client : ses commandes + clés délivrées.
async function mesCommandes(req, res) {
  try {
    const [cmds] = await db.query(
      'SELECT * FROM commandes WHERE utilisateur_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    if (cmds.length === 0) return res.json([]);

    const ids = cmds.map(c => c.id);
    const [lignes] = await db.query(
      `SELECT commande_id, produit_nom, prix, cle_code
       FROM commande_lignes WHERE commande_id IN (?)`,
      [ids]
    );
    const parCommande = grouperLignes(lignes);

    res.json(cmds.map(c => ({ ...c, lignes: parCommande[c.id] || [] })));
  } catch (err) {
    console.error('Erreur mes commandes :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── GET /api/orders/all (admin) ─────────────
async function toutes(req, res) {
  try {
    const [cmds] = await db.query(
      `SELECT c.*, u.username
       FROM commandes c
       JOIN utilisateurs u ON u.id = c.utilisateur_id
       ORDER BY c.id DESC`
    );
    if (cmds.length === 0) return res.json([]);

    const ids = cmds.map(c => c.id);
    const [lignes] = await db.query(
      `SELECT commande_id, produit_nom, prix, cle_code
       FROM commande_lignes WHERE commande_id IN (?)`,
      [ids]
    );
    const parCommande = grouperLignes(lignes);

    res.json(cmds.map(c => ({ ...c, lignes: parCommande[c.id] || [] })));
  } catch (err) {
    console.error('Erreur toutes commandes :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// ─── PATCH /api/orders/:id (admin) ───────────
// Change le statut. Les clés déjà délivrées restent "vendu" :
// un code distribué ne peut pas être repris à un autre client.
async function changerStatut(req, res) {
  try {
    const { statut } = req.body;
    if (!STATUTS.includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide (Délivré / Annulé / Remboursé)' });
    }
    const [result] = await db.query(
      'UPDATE commandes SET statut = ? WHERE id = ?',
      [statut, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    res.json({ message: `Statut mis à jour : ${statut}`, statut });
  } catch (err) {
    console.error('Erreur changement statut :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { resumePanier, passer, mesCommandes, toutes, changerStatut };
