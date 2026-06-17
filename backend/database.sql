-- =============================================
--  TechStore - Schéma de la base de données
--  (référence — l'init se fait automatiquement
--   avec : node scripts/init-db.js)
--  La base elle-même est créée par l'hébergeur,
--  son nom est dans backend/.env (DB_NAME).
-- =============================================

-- ─── Utilisateurs ────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,            -- hash bcrypt, jamais en clair
  role       ENUM('client', 'admin') NOT NULL DEFAULT 'client',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Produits ────────────────────────────────
CREATE TABLE IF NOT EXISTS produits (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  img             VARCHAR(500),
  category        VARCHAR(50),                  -- optionnel (ancien champ)
  platform        VARCHAR(50),                  -- Steam, Epic Games, Ubisoft Connect...
  activation_code VARCHAR(255),                 -- legacy : conservé pour la migration vers cles_jeu
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Panier ──────────────────────────────────
-- Une ligne = un produit dans le panier d'un utilisateur.
-- La clé UNIQUE permet le "ON DUPLICATE KEY UPDATE" :
-- ajouter 2x le même produit incrémente la quantité.
CREATE TABLE IF NOT EXISTS panier (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  produit_id     INT NOT NULL,
  quantity       INT NOT NULL DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id)     REFERENCES produits(id)     ON DELETE CASCADE,
  UNIQUE KEY uq_user_produit (utilisateur_id, produit_id)
);

-- ─── Clés de jeu (codes série) ───────────────
-- Le STOCK d'un produit. À l'achat, une clé "disponible" devient
-- "vendu" et est rattachée à la commande → jamais redistribuée.
CREATE TABLE IF NOT EXISTS cles_jeu (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  produit_id  INT NOT NULL,
  code        VARCHAR(255) NOT NULL,
  statut      ENUM('disponible', 'vendu') NOT NULL DEFAULT 'disponible',
  commande_id INT DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
);

-- ─── Codes promo ─────────────────────────────
CREATE TABLE IF NOT EXISTS codes_promo (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(50) NOT NULL UNIQUE,
  type       ENUM('pourcentage', 'montant') NOT NULL DEFAULT 'pourcentage',
  valeur     DECIMAL(10,2) NOT NULL,            -- % (pourcentage) ou € (montant)
  actif      TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Commandes ───────────────────────────────
CREATE TABLE IF NOT EXISTS commandes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  sous_total     DECIMAL(10,2) NOT NULL,
  remise         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL,
  code_promo        VARCHAR(50) DEFAULT NULL,
  statut            ENUM('Délivré', 'Annulé', 'Remboursé') NOT NULL DEFAULT 'Délivré',
  payment_intent_id VARCHAR(255) DEFAULT NULL,     -- réf. paiement Stripe
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- ─── Lignes de commande ──────────────────────
-- Une ligne = une clé délivrée (snapshot nom/prix/code à l'achat).
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
);

-- ─── Produits de départ ──────────────────────
INSERT INTO produits (name, price, img, category) VALUES
  ('Casque Gaming Pro',     49.99, 'https://picsum.photos/seed/casque1/400/300',  'casque'),
  ('Casque Studio HD',      89.99, 'https://picsum.photos/seed/casque2/400/300',  'casque'),
  ('Souris RGB Ultra',      29.99, 'https://picsum.photos/seed/souris1/400/300',  'souris'),
  ('Souris Sans Fil Pro',   59.99, 'https://picsum.photos/seed/souris2/400/300',  'souris'),
  ('Clavier Mécanique TKL', 79.99, 'https://picsum.photos/seed/clavier1/400/300', 'clavier'),
  ('Clavier RGB 60%',       99.99, 'https://picsum.photos/seed/clavier2/400/300', 'clavier');

-- ─── Pour devenir admin ──────────────────────
-- 1. Crée ton compte depuis la page connexion du site
-- 2. Puis exécute (en remplaçant le pseudo) :
-- UPDATE utilisateurs SET role = 'admin' WHERE username = 'ton_pseudo';
