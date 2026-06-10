// =============================================
//  TechStore - script.js (connecté à l'API)
//  Chargé sur toutes les pages
// =============================================

// ─── Init ─────────────────────────────────────
updateCartCount();
updateUserNav();

// ─── Nav dynamique ────────────────────────────

function updateUserNav() {
  const user      = getCurrentUser();
  const loginLink = document.querySelector('a[href="connexion.html"]');
  const adminLink = document.querySelector('a[href="admin.html"]');

  if (user && loginLink) {
    loginLink.textContent = `👤 ${user.username}`;
    loginLink.href = '#';
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
  // Masquer le lien Admin si pas admin
  if (adminLink && (!user || user.role !== 'admin')) {
    adminLink.style.display = 'none';
  }
}

// ─── Compteur panier ──────────────────────────

async function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (!el) return;

  if (getToken()) {
    try {
      const items = await fetchCart();
      const total = Array.isArray(items)
        ? items.reduce((sum, i) => sum + (i.quantity || 1), 0)
        : 0;
      el.textContent = total;
    } catch { el.textContent = 0; }
  } else {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    el.textContent = cart.length;
  }
}

// ─── Toast notification ───────────────────────

function showToast(message, success = true) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast' + (success ? '' : ' toast--error');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ═══════════════════════════════════════════
//  PAGE : index.html — Affichage produits
// ═══════════════════════════════════════════

async function displayProducts(category = '', search = '') {
  const container = document.getElementById('products-container');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;padding:40px">Chargement...</p>';

  try {
    const products = await fetchProducts(category, search);
    container.innerHTML = '';

    if (!Array.isArray(products) || products.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:40px">Aucun produit trouvé.</p>';
      return;
    }

    products.forEach(prod => {
      const div = document.createElement('div');
      div.className    = 'product';
      div.dataset.id   = prod.id;
      div.dataset.category = prod.category;

      div.innerHTML = `
        ${prod.platform ? `<span class="platform-badge platform-badge--card">${prod.platform}</span>` : ''}
        <img src="${prod.img}" alt="${prod.name}" loading="lazy">
        <h2>${prod.name}</h2>
        <p>${parseFloat(prod.price).toFixed(2)} €</p>
        <button onclick="handleAddToCart(${prod.id}, '${prod.name}', ${prod.price})">
          Ajouter au panier
        </button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:red;padding:40px">Impossible de charger les produits.</p>';
    console.error(err);
  }
}

// Ajouter au panier (API si connecté, localStorage sinon)
async function handleAddToCart(id, name, price) {
  if (getToken()) {
    try {
      const result = await addToCartAPI(id);
      showToast(result.message || '✅ Ajouté au panier !');
      updateCartCount();
    } catch {
      showToast('Erreur lors de l\'ajout.', false);
    }
  } else {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push({ id, name, price });
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast('✅ Ajouté ! Connectez-vous pour sauvegarder votre panier.');
    updateCartCount();
  }
}

// Recherche & filtre (debounce 300ms)
let searchTimeout;
const searchInput    = document.getElementById('search');
const categorySelect = document.getElementById('category');

if (searchInput) {
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const cat = categorySelect ? categorySelect.value : '';
    searchTimeout = setTimeout(() => displayProducts(cat, this.value), 300);
  });
}
if (categorySelect) {
  categorySelect.addEventListener('change', function () {
    const q = searchInput ? searchInput.value : '';
    displayProducts(this.value, q);
  });
}

// ═══════════════════════════════════════════
//  PAGE : panier.html — Affichage panier
// ═══════════════════════════════════════════

async function displayCart() {
  const container = document.getElementById('cart-items');
  const totalEl   = document.getElementById('total');
  if (!container) return;

  container.innerHTML = '<p>Chargement...</p>';
  let items = [];

  if (getToken()) {
    try {
      items = await fetchCart();
    } catch { items = []; }
  } else {
    // Fallback localStorage (utilisateur non connecté)
    const local = JSON.parse(localStorage.getItem('cart')) || [];
    items = local.map((item, i) => ({
      panier_id: i, id: item.id, name: item.name,
      price: item.price, quantity: 1
    }));
  }

  container.innerHTML = '';

  if (!items || items.length === 0) {
    container.innerHTML = '<p>Ton panier est vide.</p>';
    if (totalEl) totalEl.textContent = '0 €';
    return;
  }

  let total = 0;

  items.forEach(item => {
    const lineTotal = parseFloat(item.price) * (item.quantity || 1);
    total += lineTotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <span>${item.name}${item.quantity > 1 ? ` <small>(×${item.quantity})</small>` : ''}</span>
      <span>
        ${lineTotal.toFixed(2)} €
        <span class="remove" data-id="${item.panier_id}">❌</span>
      </span>
    `;
    container.appendChild(div);
  });

  if (totalEl) totalEl.textContent = total.toFixed(2) + ' €';

  // Boutons supprimer
  document.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.getAttribute('data-id');
      if (getToken()) {
        await removeFromCartAPI(pid);
      } else {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart.splice(parseInt(pid), 1);
        localStorage.setItem('cart', JSON.stringify(cart));
      }
      displayCart();
      updateCartCount();
    });
  });

  // Bouton vider le panier
  const clearBtn = document.getElementById('clear-cart');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Vider tout le panier ?')) return;
      if (getToken()) {
        await clearCartAPI();
      } else {
        localStorage.removeItem('cart');
      }
      displayCart();
      updateCartCount();
    });
  }
}

// ─── Lancement au chargement ──────────────────
displayProducts();
displayCart();