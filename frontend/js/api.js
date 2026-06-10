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

async function fetchProducts(category = '', search = '') {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (search)   params.append('search',   search);
  return apiRequest(`/products?${params}`);
}

async function addProduct(name, price, img, platform, activation_code) {
  return apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify({ name, price: parseFloat(price), img, platform, activation_code })
  });
}

async function deleteProduct(id) {
  return apiRequest(`/products/${id}`, { method: 'DELETE' });
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