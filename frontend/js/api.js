// =============================================
//  TechStore - Client API
//  Ce fichier doit être chargé AVANT script.js
// =============================================

const API_URL = '/api';

// ─── Helpers ─────────────────────────────────

function getToken()       { return localStorage.getItem('token'); }
function getCurrentUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}
function authHeader() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

// Requête générique avec gestion d'erreur
async function apiRequest(endpoint, options = {}) {
  const res = await fetch(API_URL + endpoint, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    ...options
  });
  return res.json();
}

// ─── AUTH ─────────────────────────────────────

async function loginUser(username, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

async function registerUser(username, password) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ─── PRODUITS ────────────────────────────────

async function fetchProducts(category = '', search = '', platform = '') {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (search)   params.append('search',   search);
  if (platform) params.append('platform', platform);
  return apiRequest(`/products?${params}`);
}

async function addProduct(name, price, img, platform, codes) {
  return apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify({ name, price: parseFloat(price), img, platform, codes })
  });
}

async function deleteProduct(id) {
  return apiRequest(`/products/${id}`, { method: 'DELETE' });
}

// ─── CLÉS DE JEU (admin) ─────────────────────

async function fetchProductKeys(produit_id) {
  return apiRequest(`/products/${produit_id}/keys`);
}

async function addProductKeys(produit_id, codes) {
  return apiRequest(`/products/${produit_id}/keys`, {
    method: 'POST',
    body: JSON.stringify({ codes })
  });
}

async function deleteProductKey(cle_id) {
  return apiRequest(`/products/keys/${cle_id}`, { method: 'DELETE' });
}

// ─── PANIER ──────────────────────────────────

async function fetchCart() {
  return apiRequest('/cart');
}

async function addToCartAPI(produit_id, quantity = 1) {
  return apiRequest('/cart', {
    method: 'POST',
    body: JSON.stringify({ produit_id, quantity })
  });
}

async function removeFromCartAPI(panier_id) {
  return apiRequest(`/cart/${panier_id}`, { method: 'DELETE' });
}

async function clearCartAPI() {
  return apiRequest('/cart/clear', { method: 'DELETE' });
}

// ─── PAIEMENT (Stripe) ───────────────────────

// Config publique : clé publishable + Stripe actif ou non
async function fetchConfig() {
  return apiRequest('/config');
}

// Prépare le paiement : le serveur calcule le montant et crée le PaymentIntent
async function createPaymentIntent(code_promo = '') {
  return apiRequest('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ code_promo })
  });
}

// ─── COMMANDES ───────────────────────────────

// Validée seulement après un paiement Stripe réussi (payment_intent_id)
async function placeOrder(payment_intent_id, code_promo = '') {
  return apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ payment_intent_id, code_promo })
  });
}

async function fetchMyOrders() {
  return apiRequest('/orders');
}

async function fetchAllOrders() {
  return apiRequest('/orders/all');
}

async function updateOrderStatus(id, statut) {
  return apiRequest(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ statut })
  });
}

// ─── CODES PROMO ─────────────────────────────

async function checkPromo(code, sous_total) {
  return apiRequest('/promos/check', {
    method: 'POST',
    body: JSON.stringify({ code, sous_total })
  });
}

async function fetchPromos() {
  return apiRequest('/promos');
}

async function addPromo(code, type, valeur) {
  return apiRequest('/promos', {
    method: 'POST',
    body: JSON.stringify({ code, type, valeur: parseFloat(valeur) })
  });
}

async function togglePromo(id, actif) {
  return apiRequest(`/promos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ actif })
  });
}

async function deletePromo(id) {
  return apiRequest(`/promos/${id}`, { method: 'DELETE' });
}