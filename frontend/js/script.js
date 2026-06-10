// Récupérer le panier depuis le stockage local
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Mettre à jour le compteur au chargement
updateCartCount();

// Fonction pour ajouter un produit
function addToCart(name, price) {
    cart.push({ name: name, price: price });

    // Sauvegarder dans le navigateur
    localStorage.setItem("cart", JSON.stringify(cart));

    // Mettre à jour le compteur
    updateCartCount();
}

// Mettre à jour le nombre d’articles affiché
function updateCartCount() {
    const countElement = document.getElementById("cart-count");
    if (countElement) {
        countElement.textContent = cart.length;
    }
}

// ==============================
// AFFICHAGE DANS panier.html
// ==============================

function displayCart() {
    const container = document.getElementById("cart-items");
    const totalElement = document.getElementById("total");

    if (!container) return;

    container.innerHTML = "";

    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = "<p>Ton panier est vide.</p>";
        totalElement.textContent = "0 €";
        return;
    }

    cart.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "cart-item";

        // Chaque ligne avec nom à gauche, prix à droite et bouton supprimer
        div.innerHTML = `
            <span>${item.name}</span>
            <span>${item.price} € <span class="remove" data-index="${index}">❌</span></span>
        `;

        container.appendChild(div);

        total += item.price;
    });

    totalElement.textContent = total + " €";

    // Ajouter les événements pour chaque croix
    const removeButtons = document.querySelectorAll(".remove");
    removeButtons.forEach(button => {
        button.addEventListener("click", () => {
            const index = button.getAttribute("data-index");
            cart.splice(index, 1);
            localStorage.setItem("cart", JSON.stringify(cart));
            displayCart();
            updateCartCount();
        });
    });
}

// Filtrer les produits par nom ou catégorie
document.getElementById("search").addEventListener("input", function() {
    const query = this.value.toLowerCase();
    const products = document.querySelectorAll(".product");
    products.forEach(p => {
        const name = p.querySelector("h2").textContent.toLowerCase();
        if(name.includes(query)) p.style.display = "block";
        else p.style.display = "none";
    });
});
                       
document.getElementById("category").addEventListener("change", function() {
    const value = this.value;
    const products = document.querySelectorAll(".product");
    products.forEach(p => {
        const name = p.querySelector("h2").textContent.toLowerCase();
        if(value === "" || name.includes(value)) p.style.display = "block";
        else p.style.display = "none";
    });
});


// ==== Affichage des produits dynamiques
function displayProducts() {
    const container = document.getElementById("products-container");
    if(!container) return;

    // Récupérer les produits stockés ou utiliser des produits par défaut
    let products = JSON.parse(localStorage.getItem("products")) || [
        {name:"Casque gaming", price:49, img:"https://picsum.photos/200", category:"casque"},
        {name:"Souris RGB", price:29, img:"https://picsum.photos/201", category:"souris"},
        {name:"Clavier mécanique", price:79, img:"https://picsum.photos/202", category:"clavier"},
    ];

    container.innerHTML = "";

    products.forEach(prod => {
        const div = document.createElement("div");
        div.className = "product";

        div.innerHTML = `
            <img src="${prod.img}" alt="${prod.name}">
            <h2>${prod.name}</h2>
            <p>${prod.price} €</p>
            <button onclick="addToCart('${prod.name}', ${prod.price})">Ajouter au panier</button>
        `;

        container.appendChild(div);
    });
}

// Lancer l'affichage
displayProducts();
