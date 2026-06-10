// =============================================
//  Initialise la base : crée les tables si
//  besoin + insère les produits de départ.
//  Usage : node scripts/init-db.js
// =============================================

const db     = require('../config/db');
const bcrypt = require('bcryptjs');

// Compte administrateur créé par défaut
const ADMIN_USERNAME = 'malek';
const ADMIN_PASSWORD = 'admin';

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

    // Seed uniquement si le catalogue est vide (relançable sans doublons)
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
      console.log('✅ 6 jeux de départ insérés (codes de démo)');
    } else {
      console.log(`ℹ️  Catalogue déjà rempli (${total} produits), pas de seed`);
    }

    // Compte admin par défaut : créé s'il n'existe pas,
    // sinon remis en mode admin avec le mot de passe par défaut
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
