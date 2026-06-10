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
  activation_code VARCHAR(255),                 -- ⚠️ jamais exposé aux non-admins
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
