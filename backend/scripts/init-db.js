// =============================================
//  Initialise la base : crée les tables si
//  besoin + insère les données de départ.
//  Usage : node scripts/init-db.js
// =============================================

const db     = require('../config/db');
const bcrypt = require('bcryptjs');

// Compte administrateur créé par défaut pour les tests et la démo.
const ADMIN_USERNAME = 'malek';
const ADMIN_PASSWORD = 'admin';

// Une colonne existe-t-elle déjà ? (pour les migrations idempotentes)
async function colonneExiste(table, colonne) {
  const [[{ n }]] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, colonne]
  );
  return n > 0;
}

async function init() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS utilisateurs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        username   VARCHAR(50)  NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        role       ENUM('client', 'admin') NOT NULL DEFAULT 'client',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table utilisateurs');

    await db.query(`
      CREATE TABLE IF NOT EXISTS produits (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(100)  NOT NULL,
        price           DECIMAL(10,2) NOT NULL,
        img             VARCHAR(500),
        category        VARCHAR(50),
        platform        VARCHAR(50),
        activation_code VARCHAR(255),
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table produits');

    await db.query(`
      CREATE TABLE IF NOT EXISTS panier (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        utilisateur_id INT NOT NULL,
        produit_id     INT NOT NULL,
        quantity       INT NOT NULL DEFAULT 1,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
        FOREIGN KEY (produit_id)     REFERENCES produits(id)     ON DELETE CASCADE,
        UNIQUE KEY uq_user_produit (utilisateur_id, produit_id)
      )
    `);
    console.log('✅ Table panier');

    // ─── Clés de jeu (codes série) ─────────────
    // Un produit possède un STOCK de clés. À l'achat, une clé
    // « disponible » passe à « vendu » et est rattachée à la commande.
    // Une clé vendue n'est jamais redistribuée à un autre client.
    await db.query(`
      CREATE TABLE IF NOT EXISTS cles_jeu (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        produit_id  INT NOT NULL,
        code        VARCHAR(255) NOT NULL,
        statut      ENUM('disponible', 'vendu') NOT NULL DEFAULT 'disponible',
        commande_id INT DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table cles_jeu');

    // ─── Codes promo ───────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS codes_promo (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        code       VARCHAR(50) NOT NULL UNIQUE,
        type       ENUM('pourcentage', 'montant') NOT NULL DEFAULT 'pourcentage',
        valeur     DECIMAL(10,2) NOT NULL,
        actif      TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table codes_promo');

    // ─── Commandes ─────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS commandes (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        utilisateur_id INT NOT NULL,
        sous_total     DECIMAL(10,2) NOT NULL,
        remise         DECIMAL(10,2) NOT NULL DEFAULT 0,
        total          DECIMAL(10,2) NOT NULL,
        code_promo     VARCHAR(50) DEFAULT NULL,
        statut         ENUM('Délivré', 'Annulé', 'Remboursé') NOT NULL DEFAULT 'Délivré',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table commandes');

    // ─── Lignes de commande ────────────────────
    // Une ligne = une clé délivrée (snapshot du nom/prix/code au moment de l'achat).
    await db.query(`
      CREATE TABLE IF NOT EXISTS commande_lignes (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        commande_id INT NOT NULL,
        produit_id  INT DEFAULT NULL,
        produit_nom VARCHAR(100) NOT NULL,
        prix        DECIMAL(10,2) NOT NULL,
        cle_id      INT DEFAULT NULL,
        cle_code    VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
        FOREIGN KEY (produit_id)  REFERENCES produits(id)  ON DELETE SET NULL
      )
    `);
    console.log('✅ Table commande_lignes');

    // ─── Migration colonnes ────────────────────
    // CREATE TABLE IF NOT EXISTS n'ajoute pas de colonne à une table déjà
    // existante : on ajoute payment_intent_id à la main si elle manque.
    if (!(await colonneExiste('commandes', 'payment_intent_id'))) {
      await db.query('ALTER TABLE commandes ADD COLUMN payment_intent_id VARCHAR(255) DEFAULT NULL');
      console.log('✅ Colonne commandes.payment_intent_id ajoutée');
    }

    // ─── Catalogue de départ (si vide) ─────────
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM produits');
    if (total === 0) {
      await db.query(`
        INSERT INTO produits (name, price, img, platform, activation_code) VALUES
          ('Cyberpunk 2077',      29.99, 'https://picsum.photos/seed/cyber/400/300',  'GOG',            'DEMO1-AAAAA-11111'),
          ('EA FC 26',            49.99, 'https://picsum.photos/seed/fc26/400/300',   'EA App',         'DEMO2-BBBBB-22222'),
          ('Assassin''s Creed',   39.99, 'https://picsum.photos/seed/ac/400/300',     'Ubisoft Connect','DEMO3-CCCCC-33333'),
          ('Counter-Strike 2',     9.99, 'https://picsum.photos/seed/cs2/400/300',    'Steam',          'DEMO4-DDDDD-44444'),
          ('Fortnite V-Bucks',    19.99, 'https://picsum.photos/seed/fort/400/300',   'Epic Games',     'DEMO5-EEEEE-55555'),
          ('Minecraft',           26.99, 'https://picsum.photos/seed/mine/400/300',   'Microsoft Store','DEMO6-FFFFF-66666')
      `);
      console.log('✅ 6 jeux de départ insérés');
    } else {
      console.log(`ℹ️  Catalogue déjà rempli (${total} produits), pas de seed`);
    }

    // ─── Migration des clés ────────────────────
    // Chaque produit qui a un activation_code mais aucune clé encore
    // enregistrée reçoit 3 clés de stock (le code d'origine + 2 démos).
    const [prods] = await db.query('SELECT id, activation_code FROM produits');
    let migres = 0;
    for (const p of prods) {
      const [[{ n }]] = await db.query(
        'SELECT COUNT(*) AS n FROM cles_jeu WHERE produit_id = ?',
        [p.id]
      );
      if (n === 0 && p.activation_code) {
        const codes = [p.activation_code, `${p.activation_code}-A`, `${p.activation_code}-B`];
        for (const code of codes) {
          await db.query('INSERT INTO cles_jeu (produit_id, code) VALUES (?, ?)', [p.id, code]);
        }
        migres++;
      }
    }
    if (migres) console.log(`✅ ${migres} produit(s) approvisionné(s) en clés (3 clés chacun)`);

    // ─── Codes promo de démo ───────────────────
    await db.query(`
      INSERT INTO codes_promo (code, type, valeur, actif) VALUES
        ('WELCOME10', 'pourcentage', 10, 1),
        ('TECH5',     'montant',      5, 1)
      ON DUPLICATE KEY UPDATE code = VALUES(code)
    `);
    console.log('✅ Codes promo de démo : WELCOME10 (-10%), TECH5 (-5€)');

    // ─── Compte admin par défaut ───────────────
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.query(
      `INSERT INTO utilisateurs (username, password, role)
       VALUES (?, ?, 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin', password = VALUES(password)`,
      [ADMIN_USERNAME, hash]
    );
    console.log(`✅ Compte admin par défaut : ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);

    console.log('🎉 Base prête !');
  } catch (e) {
    console.error('❌ Erreur init :', e.message);
  }
  process.exit(0);
}

init();
