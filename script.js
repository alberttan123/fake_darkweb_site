/* script.js
   Requirements implemented:
   - search filtering
   - type filtering
   - dropdown sorting handling
   - products population from json
   - pagination
*/

(() => {
  "use strict";

  // ========== Config ==========
  const JSON_PATH = "products.json";
  const ITEMS_PER_PAGE = 12;

  // ========== DOM ==========
  const searchBar = document.querySelector(".search-bar");
  const filterContainer = document.querySelector(".filter-container");
  const productsGrid = document.querySelector(".products-container-actual");
  const footer = document.querySelector(".footer");
  const sortSelect = document.querySelector(".top-bar select");

  if (!searchBar || !filterContainer || !productsGrid || !footer || !sortSelect) {
    console.error("Required DOM nodes missing. Check class names and structure.");
    return;
  }

  // ========== State ==========
  let allProducts = [];
  let viewProducts = [];
  let currentPage = 1;

  const filters = {
    search: "",
    types: new Set(),
    minPrice: null,
    maxPrice: null,
    sort: "Recommended"
  };

  // ========== Utilities ==========
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const debounce = (fn, delay = 180) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const toBtcNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const formatBtc = (n) => {
    // Keep it readable; adjust if you want fixed decimals everywhere.
    const num = Number(n);
    if (!Number.isFinite(num)) return "0 btc";
    return `${num} btc`;
  };

  const escapeHtml = (s) => {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  // ========== Fetch + Init ==========
  async function init() {
    try {
      const res = await fetch(JSON_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch JSON (${res.status})`);
      const data = await res.json();

      // Basic validation + normalization
      allProducts = Array.isArray(data) ? data.map(normalizeProduct) : [];
      if (!allProducts.length) {
        productsGrid.innerHTML = `<div style="opacity:.75;padding:12px;">No products found in JSON.</div>`;
      }

      buildFiltersUI(allProducts);
      bindTopBarEvents();
      applyAll();
    } catch (err) {
      console.error(err);
      productsGrid.innerHTML = `<div style="opacity:.75;padding:12px;">Error loading products.json</div>`;
    }
  }

  function normalizeProduct(p) {
    return {
      productTitle: String(p.productTitle ?? "Untitled"),
      productPrice: toBtcNumber(p.productPrice ?? 0),
      productType: String(p.productType ?? "Unknown"),
      productDescription: String(p.productDescription ?? "")
    };
  }

  // ========== Build Filters UI (inside .filter-container) ==========
  function buildFiltersUI(products) {
    const types = [...new Set(products.map(p => p.productType))].sort((a, b) => a.localeCompare(b));
    const prices = products.map(p => p.productPrice);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;

    // Defaults
    filters.minPrice = min;
    filters.maxPrice = max;

    filterContainer.innerHTML = `
        <h3 class="filter-title">Filters</h3>

        <div class="filter-section">
        <h4>Price (BTC)</h4>
        <div class="filter-row">
            <label>
            Min
            <input type="number" step="0.0001" class="price-min" value="${escapeHtml(min)}" />
            </label>
            <label>
            Max
            <input type="number" step="0.0001" class="price-max" value="${escapeHtml(max)}" />
            </label>
        </div>
        </div>

        <div class="filter-section">
        <h4>Type</h4>
        <div class="filter-row type-list">
            ${types.map(t => `
            <label>
                <input type="checkbox" value="${escapeHtml(t)}" />
                ${escapeHtml(t)}
            </label>
            `).join("")}
        </div>
        </div>

        <div class="filter-actions">
        <button class="btn btn-clear" type="button">Clear</button>
        <button class="btn btn-select-all" type="button">Select All Types</button>
        </div>
    `;

    // Bind filter events
    const minInput = filterContainer.querySelector(".price-min");
    const maxInput = filterContainer.querySelector(".price-max");
    const typeList = filterContainer.querySelector(".type-list");
    const btnClear = filterContainer.querySelector(".btn-clear");
    const btnSelectAll = filterContainer.querySelector(".btn-select-all");

    const onPriceChange = () => {
        const minV = Number(minInput.value);
        const maxV = Number(maxInput.value);

        const safeMin = Number.isFinite(minV) ? minV : min;
        const safeMax = Number.isFinite(maxV) ? maxV : max;

        filters.minPrice = Math.min(safeMin, safeMax);
        filters.maxPrice = Math.max(safeMin, safeMax);

        currentPage = 1;
        applyAll();
    };

    minInput.addEventListener("input", debounce(onPriceChange, 120));
    maxInput.addEventListener("input", debounce(onPriceChange, 120));

    typeList.addEventListener("change", (e) => {
        const cb = e.target;
        if (!(cb instanceof HTMLInputElement) || cb.type !== "checkbox") return;

        if (cb.checked) filters.types.add(cb.value);
        else filters.types.delete(cb.value);

        currentPage = 1;
        applyAll();
    });

    btnClear.addEventListener("click", () => {
        // Reset search
        searchBar.value = "";
        filters.search = "";

        // Reset types
        filters.types.clear();
        typeList.querySelectorAll("input[type='checkbox']").forEach(cb => (cb.checked = false));

        // Reset price
        minInput.value = String(min);
        maxInput.value = String(max);
        filters.minPrice = min;
        filters.maxPrice = max;

        // Reset sort
        sortSelect.value = "Recommended";
        filters.sort = "Recommended";

        currentPage = 1;
        applyAll();
    });

    btnSelectAll.addEventListener("click", () => {
        filters.types = new Set(types);
        typeList.querySelectorAll("input[type='checkbox']").forEach(cb => (cb.checked = true));
        currentPage = 1;
        applyAll();
    });
  }

  // ========== Top bar events ==========
  function bindTopBarEvents() {
    searchBar.addEventListener("input", debounce((e) => {
      filters.search = String(e.target.value || "").trim().toLowerCase();
      currentPage = 1;
      applyAll();
    }, 140));

    sortSelect.addEventListener("change", (e) => {
      filters.sort = String(e.target.value || "Recommended");
      currentPage = 1;
      applyAll();
    });
  }

  // ========== Apply: filter + sort + paginate + render ==========
  function applyAll() {
    viewProducts = applyFilters(allProducts);
    viewProducts = applySort(viewProducts, filters.sort);

    const totalPages = Math.max(1, Math.ceil(viewProducts.length / ITEMS_PER_PAGE));
    currentPage = clamp(currentPage, 1, totalPages);

    renderProductsPage(viewProducts, currentPage, totalPages);
    renderPagination(totalPages);
  }

  function applyFilters(products) {
    const q = filters.search;
    const useTypes = filters.types.size > 0;

    return products.filter(p => {
      // Search: title + type (and you can extend to description if you want)
      if (q) {
        const hay = `${p.productTitle} ${p.productType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Type filter
      if (useTypes && !filters.types.has(p.productType)) return false;

      // Price filter
      const price = p.productPrice;
      if (filters.minPrice != null && price < filters.minPrice) return false;
      if (filters.maxPrice != null && price > filters.maxPrice) return false;

      return true;
    });
  }

  function applySort(products, sortMode) {
    const arr = [...products];

    switch (sortMode) {
      case "Alphabethical: A->Z":
        arr.sort((a, b) => a.productTitle.localeCompare(b.productTitle));
        break;
      case "Alphabethical: Z->A":
        arr.sort((a, b) => b.productTitle.localeCompare(a.productTitle));
        break;
      case "Price: High->Low":
        arr.sort((a, b) => b.productPrice - a.productPrice);
        break;
      case "Price: Low->High":
        arr.sort((a, b) => a.productPrice - b.productPrice);
        break;
      case "Recommended":
      default:
        // keep original order from JSON (no-op)
        break;
    }

    return arr;
  }

  function renderProductsPage(products, page, totalPages) {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const slice = products.slice(start, end);

    if (!slice.length) {
      productsGrid.innerHTML = `<div style="opacity:.75;padding:12px;">No matching products.</div>`;
      return;
    }

    productsGrid.innerHTML = slice.map(p => {
      const snippet = p.productDescription.length > 110
        ? p.productDescription.slice(0, 110) + "…"
        : p.productDescription;

      return `
        <div class="product-tile"
             data-title="${escapeHtml(p.productTitle)}"
             data-type="${escapeHtml(p.productType)}"
             data-price="${escapeHtml(p.productPrice)}"
             data-description="${escapeHtml(p.productDescription)}">
          <div class="product-title">${escapeHtml(p.productTitle)}</div>
          <div class="product-meta">
            <span class="product-type">${escapeHtml(p.productType)}</span>
            <span class="product-price">${escapeHtml(formatBtc(p.productPrice))}</span>
          </div>
          <div class="product-snippet">${escapeHtml(snippet)}</div>
        </div>
      `;
    }).join("");

    // Tile click -> modal popup
    productsGrid.querySelectorAll(".product-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        openModal({
          title: tile.dataset.title || "",
          type: tile.dataset.type || "",
          price: tile.dataset.price || "0",
          description: tile.dataset.description || ""
        });
      });
    });
  }

  // ========== Pagination (render into footer) ==========
  function renderPagination(totalPages) {
    const makeBtn = (label, page, isActive = false, isDisabled = false) => {
      const btn = document.createElement("button");
      btn.className = `page-btn${isActive ? " active" : ""}`;
      btn.textContent = label;
      if (isDisabled) btn.disabled = true;

      btn.addEventListener("click", () => {
        currentPage = page;
        applyAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return btn;
    };

    footer.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "pagination";

    // Prev
    wrap.appendChild(makeBtn("‹", Math.max(1, currentPage - 1), false, currentPage === 1));

    // Page numbers (compact)
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    if (start > 1) {
      wrap.appendChild(makeBtn("1", 1, currentPage === 1));
      if (start > 2) {
        const dots = document.createElement("span");
        dots.style.opacity = "0.6";
        dots.textContent = "…";
        wrap.appendChild(dots);
      }
    }

    for (let p = start; p <= end; p++) {
      wrap.appendChild(makeBtn(String(p), p, p === currentPage));
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const dots = document.createElement("span");
        dots.style.opacity = "0.6";
        dots.textContent = "…";
        wrap.appendChild(dots);
      }
      wrap.appendChild(makeBtn(String(totalPages), totalPages, currentPage === totalPages));
    }

    // Next
    wrap.appendChild(makeBtn("›", Math.min(totalPages, currentPage + 1), false, currentPage === totalPages));

    footer.appendChild(wrap);
  }

  // ========== Modal ==========
  function openModal({ title, type, price, description }) {
    closeModal(); // ensure one modal

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${escapeHtml(title)}</h3>
          <div class="modal-submeta">
            <span>${escapeHtml(type)}</span> • <span>${escapeHtml(formatBtc(price))}</span>
          </div>
        </div>
        <button class="modal-close" type="button">Close</button>
      </div>
      <div class="modal-body">${escapeHtml(description)}</div>
    `;

    modal.querySelector(".modal-close").addEventListener("click", closeModal);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ESC to close
    document.addEventListener("keydown", escCloseOnce);
  }

  function escCloseOnce(e) {
    if (e.key === "Escape") closeModal();
  }

  function closeModal() {
    const existing = document.querySelector(".modal-overlay");
    if (existing) existing.remove();
    document.removeEventListener("keydown", escCloseOnce);
  }

  // ========== Start ==========
  init();
})();
