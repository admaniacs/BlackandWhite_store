(() => {
  "use strict";

  /* ===== Mobile nav ===== */
  const navToggle = document.querySelector("[data-mobile-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = !mobileNav.hidden;
      mobileNav.hidden = isOpen;
      navToggle.setAttribute("aria-expanded", String(!isOpen));
    });
  }

  /* ===== Cart drawer ===== */
  const cartDrawer = () => document.querySelector("[data-cart-drawer]");
  const cartOverlay = () => document.querySelector("[data-cart-overlay]");

  function openCart() {
    cartDrawer()?.classList.add("is-open");
    cartOverlay()?.classList.add("is-open");
    cartDrawer()?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    cartDrawer()?.classList.remove("is-open");
    cartOverlay()?.classList.remove("is-open");
    cartDrawer()?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function updateCartCount(count) {
    document.querySelectorAll(".bw-cart-count").forEach((el) => {
      el.textContent = `Cart (${count})`;
    });
  }

  async function refreshCartDrawer(openAfter) {
    try {
      const res = await fetch(`${window.Shopify?.routes?.root || "/"}?section_id=cart-drawer`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newDrawer = doc.querySelector("[data-cart-drawer]");
      const newOverlay = doc.querySelector("[data-cart-overlay]");
      if (newDrawer && cartDrawer()) cartDrawer().outerHTML = newDrawer.outerHTML;
      if (newOverlay && cartOverlay()) cartOverlay().outerHTML = newOverlay.outerHTML;
      if (openAfter) openCart();
    } catch (e) {
      /* section refresh failed, cart mutation still succeeded server-side */
    }
    try {
      const cart = await fetch("/cart.js").then((r) => r.json());
      updateCartCount(cart.item_count);
    } catch (e) {}
  }

  async function addToCart(variantId, quantity = 1) {
    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: variantId, quantity }),
    });
    await refreshCartDrawer(true);
  }

  async function changeCartLine(key, quantity) {
    await fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id: key, quantity }),
    });
    await refreshCartDrawer(false);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cart-open]")) {
      e.preventDefault();
      refreshCartDrawer(true);
    }
    if (e.target.closest("[data-cart-close]") || e.target.closest("[data-cart-overlay]")) {
      closeCart();
    }
    const remove = e.target.closest("[data-cart-remove]");
    if (remove) {
      const line = remove.closest("[data-cart-line]");
      if (line) changeCartLine(line.dataset.lineKey, 0);
    }
    const decrease = e.target.closest("[data-qty-decrease]");
    if (decrease) {
      const line = decrease.closest("[data-cart-line]");
      const valueEl = line.querySelector("[data-qty-value]");
      const next = Math.max(0, parseInt(valueEl.textContent, 10) - 1);
      changeCartLine(line.dataset.lineKey, next);
    }
    const increase = e.target.closest("[data-qty-increase]");
    if (increase) {
      const line = increase.closest("[data-cart-line]");
      const valueEl = line.querySelector("[data-qty-value]");
      const next = parseInt(valueEl.textContent, 10) + 1;
      changeCartLine(line.dataset.lineKey, next);
    }
    const upsell = e.target.closest("[data-cart-add-variant]");
    if (upsell) {
      addToCart(upsell.dataset.cartAddVariant, 1);
    }
    const quickAdd = e.target.closest("[data-quick-add]");
    if (quickAdd && !quickAdd.disabled) {
      e.preventDefault();
      addToCart(quickAdd.dataset.variantId, 1);
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest('form[data-product-form="true"]');
    if (!form) return;
    e.preventDefault();
    const formData = new FormData(form);
    fetch("/cart/add.js", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    }).then(() => refreshCartDrawer(true));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCart();
      closeSearch();
    }
  });

  /* ===== Search overlay ===== */
  const searchOverlay = () => document.querySelector("[data-search-overlay]");

  function openSearch() {
    const overlay = searchOverlay();
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.querySelector("[data-search-input]")?.focus();
    document.body.style.overflow = "hidden";
    renderRecentSearches();
  }

  function closeSearch() {
    const overlay = searchOverlay();
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function getRecentSearches() {
    try {
      return JSON.parse(localStorage.getItem("bw_recent_searches") || "[]");
    } catch (e) {
      return [];
    }
  }

  function addRecentSearch(term) {
    if (!term) return;
    try {
      const list = getRecentSearches().filter((t) => t !== term);
      list.unshift(term);
      localStorage.setItem("bw_recent_searches", JSON.stringify(list.slice(0, 5)));
    } catch (e) {}
  }

  function renderRecentSearches() {
    const container = document.querySelector("[data-search-recent]");
    if (!container) return;
    const terms = getRecentSearches();
    container.innerHTML = terms
      .map(
        (t) =>
          `<a href="/search?q=${encodeURIComponent(t)}&type=product" style="border:1px solid #ddd;font:600 10px var(--font-ui);text-transform:uppercase;padding:5px 8px">${t}</a>`
      )
      .join("");
  }

  let searchDebounce;
  document.addEventListener("input", (e) => {
    const input = e.target.closest("[data-search-input]");
    if (!input) return;
    clearTimeout(searchDebounce);
    const term = input.value.trim();
    searchDebounce = setTimeout(() => runPredictiveSearch(term), 220);
  });

  async function runPredictiveSearch(term) {
    const resultsList = document.querySelector("[data-search-results-list]");
    const meta = document.querySelector("[data-search-meta]");
    const viewAll = document.querySelector("[data-search-view-all]");
    if (!resultsList) return;
    if (!term) {
      resultsList.innerHTML = "";
      if (meta) meta.textContent = "esc to close";
      return;
    }
    try {
      const res = await fetch(
        `/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product&resources[limit]=8&resources[options][unavailable_products]=last`
      );
      const data = await res.json();
      const products = data?.resources?.results?.products || [];
      if (meta) meta.textContent = `${products.length} results · esc to close`;
      if (viewAll) viewAll.href = `/search?q=${encodeURIComponent(term)}&type=product`;
      resultsList.innerHTML = products
        .map((p) => {
          const variant = (p.variants && p.variants[0]) || {};
          const img = p.featured_image?.url || p.image || "";
          return `
            <a href="${p.url}" class="bw-search-result-row">
              <div class="bw-search-result-row__media bw-media-placeholder">${img ? `<img src="${img}" alt="${p.title}" loading="lazy">` : ""}</div>
              <div style="flex:1">
                <div style="font:600 13px var(--font-ui);text-transform:uppercase">${p.title}</div>
                <div class="bw-label-mono" style="margin-top:3px">${p.price ? p.price : ""}</div>
              </div>
              ${variant.id ? `<button type="button" class="bw-btn bw-btn--sm" data-quick-add data-variant-id="${variant.id}">Add</button>` : ""}
            </a>`;
        })
        .join("");
    } catch (e) {
      resultsList.innerHTML = "";
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-search-open]")) {
      e.preventDefault();
      openSearch();
    }
    if (e.target.closest("[data-search-close]")) {
      closeSearch();
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-search-input]")?.closest("form");
    if (!form) return;
    const input = form.querySelector("[data-search-input]");
    if (input) addRecentSearch(input.value.trim());
  });

  /* ===== Mobile collection filter sheet ===== */
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-filter-sheet-open]")) {
      document.querySelector("[data-filter-sheet]")?.classList.add("is-open");
    }
    if (e.target.closest("[data-filter-sheet-close]")) {
      document.querySelector("[data-filter-sheet]")?.classList.remove("is-open");
    }
  });

  /* ===== Product variant picker ===== */
  document.querySelectorAll("[data-product-section]").forEach((section) => {
    const jsonEl = section.querySelector("[data-product-json]");
    if (!jsonEl) return;
    let variants = [];
    try {
      variants = JSON.parse(jsonEl.textContent);
    } catch (e) {
      return;
    }

    const optionEls = section.querySelectorAll("[data-option-index]");
    const selected = [];
    optionEls.forEach((el) => {
      const idx = Number(el.dataset.optionIndex);
      if (el.classList.contains("is-selected")) selected[idx] = el.dataset.optionValue;
    });

    function findVariant() {
      return variants.find((v) => {
        const opts = [v.option1, v.option2, v.option3];
        return selected.every((val, i) => val === undefined || opts[i] === val);
      });
    }

    function updateAvailability() {
      optionEls.forEach((el) => {
        const idx = Number(el.dataset.optionIndex);
        const testSelection = selected.slice();
        testSelection[idx] = el.dataset.optionValue;
        const matches = variants.some((v) => {
          const opts = [v.option1, v.option2, v.option3];
          return testSelection.every((val, i) => val === undefined || opts[i] === val);
        });
        const anyAvailable = variants.some((v) => {
          const opts = [v.option1, v.option2, v.option3];
          return testSelection.every((val, i) => val === undefined || opts[i] === val) && v.available;
        });
        el.classList.toggle("is-disabled", matches && !anyAvailable);
      });
    }

    function render() {
      const variant = findVariant();
      if (!variant) return;
      const variantIdInput = section.querySelector("[data-variant-id]");
      if (variantIdInput) variantIdInput.value = variant.id;

      const priceEl = section.querySelector("[data-product-price]");
      if (priceEl) priceEl.textContent = formatMoney(variant.price);

      const addBtn = section.querySelector("[data-add-to-cart]");
      const addText = section.querySelector("[data-add-to-cart-text]");
      if (addBtn) addBtn.disabled = !variant.available;
      if (addText) addText.textContent = variant.available ? `Add to cart — ${formatMoney(variant.price)}` : "Sold out";

      const stickyTitle = section.querySelector("[data-sticky-variant-title]");
      const stickyPrice = section.querySelector("[data-sticky-price]");
      if (stickyTitle) stickyTitle.textContent = variant.title.replace(/ \/ /g, " · ");
      if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price);

      section.querySelectorAll("[data-selected-option-value]").forEach((el, i) => {
        el.textContent = selected[i] || "";
      });

      if (variant.featured_image) {
        const main = section.querySelector("[data-gallery-image]");
        const img = main?.querySelector("img");
        if (img) {
          const src = variant.featured_image.src;
          img.src = src + (src.includes("?") ? "&" : "?") + "width=1200";
        }
      }

      updateAvailability();
    }

    function formatMoney(cents) {
      return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
    }

    section.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-option-index]");
      if (!opt || !optionEls.length || ![...optionEls].includes(opt)) return;
      const idx = Number(opt.dataset.optionIndex);
      section.querySelectorAll(`[data-option-index="${idx}"]`).forEach((el) => el.classList.remove("is-selected"));
      opt.classList.add("is-selected");
      selected[idx] = opt.dataset.optionValue;
      render();
    });

    render();
  });

  /* ===== Size guide toggle ===== */
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-size-guide-open]")) {
      document.querySelector("[data-size-guide]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
})();
