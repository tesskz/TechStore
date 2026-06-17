# 🛍️ TechStore

Boutique en ligne de **clés de jeux vidéo** : catalogue, panier, paiement par carte
(Stripe) et livraison d'un code d'activation unique après l'achat. Un tableau de bord
**admin** permet de gérer les produits, le stock de clés, les commandes et les codes promo.

Projet full-stack : **API REST Node.js / Express + MySQL**, frontend en **HTML / CSS /
JavaScript** (sans framework).

---

## 🧱 Architecture

Application **3 tiers** (présentation → logique → données). Une requête traverse les
couches du haut vers le bas :

```
┌──────────────────────────────────────────────────────────┐
│  NAVIGATEUR — Frontend (HTML / CSS / JS)                  │
│  index · panier · checkout · admin   +  api.js · script.js│
└──────────────────────────────────────────────────────────┘
                  │  fetch() vers /api  ·  token JWT
                  ▼
┌──────────────────────────────────────────────────────────┐
│  server.js — Express (port 3000)                          │
│  sert le frontend en statique + route /api (router.js)    │
└──────────────────────────────────────────────────────────┘
                  │  route → controller
                  ▼
┌──────────────────────────────────────────────────────────┐
│  middleware/auth.js — vérifie le token JWT / rôle admin   │
└──────────────────────────────────────────────────────────┘
                  │  accès autorisé
                  ▼
┌──────────────────────────────────────────────────────────┐
│  controller/ — logique métier                             │
│  utilisateur · produit · panier · commande · paiement     │
│  · promo                                                  │
└──────────────────────────────────────────────────────────┘
            │ SQL                          │ API paiement
            ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐
   │  MySQL (db.js)   │          │  Stripe          │
   │  7 tables        │          │  (stripe.js)     │
   └──────────────────┘          └──────────────────┘
```

**Principe clé** : chaque couche ne parle qu'à sa voisine. Le navigateur ne touche jamais
directement la base — tout passe par le serveur, qui contrôle et sécurise. Le **prix et le
stock sont toujours calculés côté serveur**, jamais envoyés par le client.

---

## 🛠️ Stack technique

| Domaine            | Technologie                                        |
| ------------------ | -------------------------------------------------- |
| Serveur            | Node.js + Express                                  |
| Base de données    | MySQL (`mysql2`)                                   |
| Authentification   | JSON Web Token (`jsonwebtoken`)                    |
| Mots de passe      | bcrypt (`bcryptjs`)                                |
| Paiement           | Stripe                                             |
| Frontend           | HTML / CSS / JavaScript (vanilla, sans framework)  |

---

## 📂 Structure du projet

```
TechStore/
├── backend/
│   ├── server.js              # Point d'entrée Express (port 3000)
│   ├── .env                   # Secrets : DB, JWT, Stripe (non versionné)
│   ├── .env.example           # Modèle du .env à recopier
│   ├── database.sql           # Schéma SQL des tables
│   ├── config/
│   │   ├── db.js              # Pool de connexions MySQL
│   │   └── stripe.js          # Client Stripe
│   ├── middleware/
│   │   └── auth.js            # Vérification JWT + rôle admin
│   ├── router/
│   │   └── router.js          # Table des routes de l'API (/api/...)
│   ├── controller/            # Logique métier (1 fichier par thème)
│   │   ├── utilisateur.js     # register / login
│   │   ├── produit.js         # catalogue + stock de clés
│   │   ├── panier.js          # panier client
│   │   ├── commande.js        # checkout + historique + admin
│   │   ├── paiement.js        # Stripe (config + PaymentIntent)
│   │   └── promo.js           # codes promo
│   └── scripts/
│       └── init-db.js         # Crée les tables + données de démo
└── frontend/
    ├── index.html             # Boutique (catalogue + recherche)
    ├── connexion.html         # Connexion / inscription
    ├── panier.html            # Panier
    ├── checkout.html          # Paiement (Stripe Elements)
    ├── commandes.html         # Mes commandes + clés livrées
    ├── admin.html             # Dashboard admin
    ├── css/style.css          # Styles
    └── js/
        ├── api.js             # Appels à l'API (fetch + token)
        └── script.js          # Logique d'affichage des pages
```

---

## 🚀 Installation & lancement

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- Une base **MySQL** accessible
- Un compte [Stripe](https://dashboard.stripe.com/) (clés de test)

### 1. Installer les dépendances
```bash
cd backend
npm install
```

### 2. Configurer l'environnement
Copier le modèle puis remplir ses propres valeurs :
```bash
cp .env.example .env
```
```ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=ton_mot_de_passe
DB_NAME=techstore
JWT_SECRET=une_chaine_secrete_longue
PORT=3000

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Initialiser la base de données
Crée les tables et insère les données de démo (6 jeux, 2 codes promo, 1 compte admin) :
```bash
node scripts/init-db.js
```

### 4. Lancer le serveur
```bash
npm start          # production
npm run dev        # développement (redémarrage auto à chaque modif)
```

Le site est disponible sur **http://localhost:3000**.

---

## 🔑 Comptes & données de démo

| Élément          | Valeur                                  |
| ---------------- | --------------------------------------- |
| Compte admin     | `malek` / `admin`                       |
| Code promo (%)   | `WELCOME10` → −10 %                      |
| Code promo (€)   | `TECH5` → −5 €                           |
| Carte de test    | `4242 4242 4242 4242`, date future, CVC libre |

> ⚠️ Pense à changer le mot de passe admin par défaut en production.

---

## 🔌 API — principales routes

Toutes les routes sont préfixées par `/api`. 🔒 = connexion requise · 👑 = admin.

| Méthode | Route                       | Rôle                              |
| ------- | --------------------------- | --------------------------------- |
| POST    | `/auth/register`            | Créer un compte                   |
| POST    | `/auth/login`               | Se connecter (renvoie un token)   |
| GET     | `/products`                 | Lister le catalogue               |
| POST    | `/products` 👑              | Ajouter un produit + ses clés     |
| GET     | `/cart` 🔒                  | Voir le panier                    |
| POST    | `/cart` 🔒                  | Ajouter au panier                 |
| POST    | `/payments/create-intent` 🔒| Préparer le paiement (montant serveur) |
| POST    | `/orders` 🔒                | Valider la commande après paiement |
| GET     | `/orders` 🔒                | Mon historique de commandes       |
| GET     | `/orders/all` 👑            | Toutes les commandes              |
| POST    | `/promos/check` 🔒          | Vérifier un code promo            |

---

## 🔒 Sécurité

- Mots de passe **hashés** avec bcrypt — jamais stockés en clair.
- Authentification par **token JWT** (valable 24 h) envoyé à chaque requête protégée.
- Middleware d'accès par rôle (public / connecté / admin).
- **Montant et stock recalculés côté serveur** au moment du paiement.
- Le checkout s'exécute dans une **transaction SQL** : en cas d'échec (stock épuisé,
  erreur), la commande est annulée et le paiement **remboursé automatiquement**.
- Secrets (DB, JWT, Stripe) isolés dans `.env`, exclu du dépôt Git.

---

## 📦 Modèle de données (7 tables)

`utilisateurs` · `produits` · `cles_jeu` (stock de codes) · `panier` ·
`codes_promo` · `commandes` · `commande_lignes` (une ligne = une clé livrée).

Une **clé de jeu** passe de `disponible` à `vendu` à l'achat et n'est **jamais
redistribuée** à un autre client.
