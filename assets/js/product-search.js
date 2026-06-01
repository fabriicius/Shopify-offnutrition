/**
 * OFF Nutrition Lab — Busca de produtos no header (search-as-you-type).
 * Depende de OffStore (jsondb/off-products-database.json).
 */
(function (global) {
  'use strict';

  const STYLE_ID = 'off-product-search-styles';
  const DEBOUNCE_MS = 300;
  const RESULT_LIMIT = 8;

  const SEARCH_MARKUP = `
    <div class="nav-search" data-product-search>
      <div class="nav-search-inner">
        <label class="nav-search-field">
          <span class="nav-search-sr">Buscar produtos</span>
          <svg class="nav-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="M16.5 16.5L21 21"></path>
          </svg>
          <input
            type="search"
            class="nav-search-input"
            placeholder="Buscar produtos..."
            autocomplete="off"
            spellcheck="false"
            enterkeyhint="search"
            role="combobox"
            aria-expanded="false"
            aria-autocomplete="list"
          />
          <button type="button" class="nav-search-clear" aria-label="Limpar busca" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </label>
        <div class="nav-search-dropdown" hidden>
          <p class="nav-search-status nav-search-loading" hidden>Buscando…</p>
          <ul class="nav-search-results" role="listbox"></ul>
          <p class="nav-search-status nav-search-empty" hidden>Nenhum produto encontrado</p>
        </div>
      </div>
    </div>
  `;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.nav-search {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  z-index: 2;
}
@media (min-width: 960px) {
  .nav-search {
    flex: 0 1 280px;
    max-width: 300px;
    margin-left: clamp(12px, 2vw, 24px);
    margin-right: clamp(12px, 2vw, 20px);
  }
}
@media (max-width: 959px) {
  .nav-search {
    margin-left: 8px;
    margin-right: 4px;
  }
}
.nav-search-inner { position: relative; width: 100%; }
.nav-search-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.nav-search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: var(--r-pill, 999px);
  background: var(--panel, #111111);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: border-color 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              background 0.25s ease;
  cursor: text;
}
.nav-search-field:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(17, 17, 17, 0.95);
}
.nav-search-field:focus-within {
  border-color: var(--acid, #ccff00);
  box-shadow: 0 0 0 1px rgba(204, 255, 0, 0.2), 0 0 24px -8px rgba(204, 255, 0, 0.35);
}
.nav-search-icon {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  stroke: rgba(255, 255, 255, 0.45);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke 0.25s ease;
}
.nav-search-field:focus-within .nav-search-icon {
  stroke: var(--acid, #ccff00);
}
.nav-search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #fff;
  font-family: var(--f-sans, 'Inter', sans-serif);
  font-size: 13px;
  line-height: 1.35;
}
.nav-search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
.nav-search-input::-webkit-search-cancel-button,
.nav-search-input::-webkit-search-decoration {
  -webkit-appearance: none;
  appearance: none;
}
.nav-search-clear {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.nav-search-clear svg {
  width: 12px;
  height: 12px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.nav-search-clear:hover,
.nav-search-clear:focus-visible {
  background: rgba(204, 255, 0, 0.12);
  color: var(--acid, #ccff00);
  outline: none;
}
.nav-search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 80;
  overflow: hidden;
  border-radius: var(--r-md, 14px);
  background: linear-gradient(180deg, rgba(14, 14, 14, 0.98), rgba(8, 8, 8, 0.99));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 18px 60px -28px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.nav-search-dropdown::before {
  content: "";
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(204, 255, 0, 0.55), transparent);
  pointer-events: none;
}
.nav-search-results {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: min(360px, 52vh);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.nav-search-results::-webkit-scrollbar { width: 5px; }
.nav-search-results::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: 99px;
}
.nav-search-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px;
  border-radius: var(--r-sm, 10px);
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease, border-color 0.2s ease;
  border: 1px solid transparent;
}
.nav-search-result:hover,
.nav-search-result.is-active {
  background: rgba(204, 255, 0, 0.08);
  border-color: rgba(204, 255, 0, 0.22);
}
.nav-search-result:focus-visible {
  outline: 2px solid var(--acid, #ccff00);
  outline-offset: 1px;
}
.nav-search-thumb {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: var(--r-xs, 6px);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.nav-search-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.nav-search-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.nav-search-name {
  font-family: var(--f-sans, 'Inter', sans-serif);
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-search-price {
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--acid, #ccff00);
  text-transform: uppercase;
}
.nav-search-status {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--f-mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}
.nav-search-loading { color: rgba(204, 255, 0, 0.75); }
@media (max-width: 959px) {
  .nav-search-field { padding: 8px 12px; gap: 8px; }
  .nav-search-input { font-size: 12px; }
  .nav-search-icon { width: 15px; height: 15px; }
}
@media (max-width: 420px) {
  .nav-search-input::placeholder { font-size: 11px; }
}
`;
    document.head.appendChild(style);
  }

  function mountSearchInNav(nav) {
    if (!nav || nav.querySelector('[data-product-search]')) return;
    const menu = nav.querySelector('.nav-menu');
    const cta = nav.querySelector('.nav-cta');
    const wrap = document.createElement('div');
    wrap.innerHTML = SEARCH_MARKUP.trim();
    const search = wrap.firstElementChild;
    if (cta) nav.insertBefore(search, cta);
    else if (menu) menu.after(search);
    else nav.appendChild(search);
    initSearchRoot(search);
  }

  function initSearchRoot(root) {
    if (!root || root.dataset.searchReady === 'true') return;
    root.dataset.searchReady = 'true';

    const store = global.OffStore;
    const input = root.querySelector('.nav-search-input');
    const clearBtn = root.querySelector('.nav-search-clear');
    const dropdown = root.querySelector('.nav-search-dropdown');
    const resultsEl = root.querySelector('.nav-search-results');
    const loadingEl = root.querySelector('.nav-search-loading');
    const emptyEl = root.querySelector('.nav-search-empty');

    if (!input || !dropdown || !resultsEl || !store) return;

    const listId = 'nav-search-list-' + Math.random().toString(36).slice(2, 9);
    resultsEl.id = listId;
    input.setAttribute('aria-controls', listId);

    let debounceTimer = null;
    let activeIndex = -1;
    let currentItems = [];
    let isOpen = false;

    function setOpen(open) {
      isOpen = open;
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) dropdown.removeAttribute('hidden');
      else dropdown.setAttribute('hidden', '');
    }

    function setLoading(show) {
      if (loadingEl) loadingEl.hidden = !show;
    }

    function closeDropdown() {
      setOpen(false);
      activeIndex = -1;
      currentItems = [];
      resultsEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = true;
      setLoading(false);
    }

    function updateClearButton() {
      if (!clearBtn) return;
      const hasValue = input.value.trim().length > 0;
      clearBtn.hidden = !hasValue;
    }

    function highlightActive() {
      const links = resultsEl.querySelectorAll('.nav-search-result');
      links.forEach(function (link, i) {
        link.classList.toggle('is-active', i === activeIndex);
        if (i === activeIndex) link.setAttribute('aria-selected', 'true');
        else link.removeAttribute('aria-selected');
      });
    }

    function buildResultItem(product) {
      const href = store.getProductPageUrl(product.slug);
      const mainImg = store.getMainImage(product.id);
      const variant = store.getMinPriceVariant(product.id);
      const price = variant && variant.pricing
        ? store.formatBRL(variant.pricing.price)
        : '';
      const imgSrc = (mainImg && mainImg.src) || store.CONSTANTS.FALLBACK_IMAGE;
      const fallback = store.CONSTANTS.FALLBACK_IMAGE;

      const link = document.createElement('a');
      link.className = 'nav-search-result';
      link.href = href;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-label', product.name);

      const thumb = document.createElement('div');
      thumb.className = 'nav-search-thumb';
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function () {
        img.onerror = null;
        img.src = fallback;
      };
      thumb.appendChild(img);

      const body = document.createElement('div');
      body.className = 'nav-search-body';
      const name = document.createElement('span');
      name.className = 'nav-search-name';
      name.textContent = product.name;
      body.appendChild(name);
      if (price) {
        const priceEl = document.createElement('span');
        priceEl.className = 'nav-search-price';
        priceEl.textContent = price;
        body.appendChild(priceEl);
      }

      link.appendChild(thumb);
      link.appendChild(body);
      link.addEventListener('click', closeDropdown);
      return link;
    }

    function renderResults(products) {
      resultsEl.innerHTML = '';
      currentItems = products;
      activeIndex = -1;

      if (!products.length) {
        if (emptyEl) emptyEl.hidden = false;
        setOpen(true);
        return;
      }

      if (emptyEl) emptyEl.hidden = true;
      products.forEach(function (product) {
        resultsEl.appendChild(buildResultItem(product));
      });
      setOpen(true);
    }

    function runSearch() {
      const query = input.value.trim();
      updateClearButton();
      setLoading(false);

      if (!query) {
        closeDropdown();
        return;
      }

      if (!store.isReady()) {
        setLoading(true);
        setOpen(true);
        if (emptyEl) emptyEl.hidden = true;
        resultsEl.innerHTML = '';
        return;
      }

      const products = store.searchProductsByName(query, RESULT_LIMIT);
      renderResults(products);
    }

    function scheduleSearch() {
      updateClearButton();
      const query = input.value.trim();
      if (!query) {
        if (debounceTimer) clearTimeout(debounceTimer);
        closeDropdown();
        return;
      }

      setLoading(true);
      if (emptyEl) emptyEl.hidden = true;
      setOpen(true);
      resultsEl.innerHTML = '';

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        if (!store.isReady()) {
          store.load().then(runSearch).catch(runSearch);
        } else {
          runSearch();
        }
      }, DEBOUNCE_MS);
    }

    function navigateActive(delta) {
      const links = resultsEl.querySelectorAll('.nav-search-result');
      if (!links.length) return;
      activeIndex = (activeIndex + delta + links.length) % links.length;
      highlightActive();
      links[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function goToActive() {
      const links = resultsEl.querySelectorAll('.nav-search-result');
      const target = activeIndex >= 0 ? links[activeIndex] : links[0];
      if (target) {
        global.location.href = target.href;
        closeDropdown();
      }
    }

    input.addEventListener('input', scheduleSearch);

    input.addEventListener('focus', function () {
      if (input.value.trim()) scheduleSearch();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        input.blur();
        return;
      }
      if (!isOpen || !currentItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateActive(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        goToActive();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        input.value = '';
        updateClearButton();
        closeDropdown();
        input.focus();
      });
    }

    document.addEventListener('pointerdown', function (e) {
      if (!root.contains(e.target)) closeDropdown();
    });
  }

  function init() {
    injectStyles();
    document.querySelectorAll('.nav').forEach(mountSearchInNav);

    if (global.OffStore && typeof global.OffStore.load === 'function') {
      global.OffStore.load().catch(function () { /* fallback silencioso */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
