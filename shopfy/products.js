/* =====================================================================
 * OFF NUTRITION LAB — Products Loader & Binder
 * ---------------------------------------------------------------------
 * Carrega os produtos do JSON local via OffShopify.loadShopifyConfig()
 * e conecta os botões "Adicionar ao carrinho" do front-end com o
 * carrinho local (OffShopifyCart).
 *
 * Princípios:
 *   - Não redesenhar nada se o HTML já tiver cards fixos. A renderização
 *     dinâmica só ocorre quando existe um container `[data-products]`.
 *   - Reaproveitar os atributos pedidos pelo brief:
 *       [data-add-to-cart]
 *       [data-product-id]
 *       [data-variant-id]
 *       [data-quantity]     (opcional)
 *   - Não alterar layout, CSS, animações ou os carrosséis já existentes
 *     (renderEnergyDrinkCarousel / renderApparelCarousel de off-store.js).
 *
 * API pública (window.OffShopifyProducts):
 *   loadProducts()           → Promise<Array<product>>
 *   renderProducts(products) → boolean (true se renderizou; false se não havia container)
 *   setupAddToCartButtons()  → void
 *   getProductById(id)
 *   getProductBySlug(slug)
 *   getVariantById(productId, variantId)
 *   getFirstAvailableVariant(productId)
 *
 * Aliases globais: loadProducts, renderProducts, setupAddToCartButtons,
 * PRODUCTS (snapshot dos produtos ativos).
 * ===================================================================== */
(function (global) {
  'use strict';

  if (global.OffShopifyProducts && global.OffShopifyProducts.__initialized) return;

  // ---------------------------------------------------------------
  // Estado interno
  // ---------------------------------------------------------------
  let PRODUCTS = [];   // somente produtos ativos (active === true)
  let _config = null;

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function _escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function _toId(value) {
    if (value == null || value === '') return null;
    const n = parseInt(value, 10);
    return isNaN(n) ? value : n;
  }

  function _matchId(target, candidate) {
    if (target == null || candidate == null) return false;
    if (target === candidate) return true;
    return String(target) === String(candidate);
  }

  function _formatBRL(value) {
    if (typeof value !== 'number' || !isFinite(value)) return '';
    try {
      return value.toLocaleString('pt-BR', {
        style: 'currency', currency: (_config && _config.currency) || 'BRL', minimumFractionDigits: 2,
      });
    } catch (e) {
      return 'R$ ' + value.toFixed(2).replace('.', ',');
    }
  }

  // ---------------------------------------------------------------
  // loadProducts()
  // ---------------------------------------------------------------
  /**
   * Carrega os produtos a partir do JSON local usando OffShopify.
   * Filtra apenas produtos ativos. Atualiza `window.PRODUCTS`.
   */
  async function loadProducts() {
    if (!global.OffShopify || typeof global.OffShopify.loadShopifyConfig !== 'function') {
      console.warn('[OffShopifyProducts] OffShopify ausente. Verifique a ordem de inclusão dos scripts (shopify.js → cart.js → products.js).');
      PRODUCTS = [];
      global.PRODUCTS = PRODUCTS;
      return PRODUCTS;
    }
    try {
      _config = await global.OffShopify.loadShopifyConfig();
      const all = (_config && _config.products) || [];
      PRODUCTS = all.filter(function (p) { return p && p.active; });
      global.PRODUCTS = PRODUCTS;
      return PRODUCTS;
    } catch (err) {
      console.error('[OffShopifyProducts] Falha ao carregar produtos:', err);
      PRODUCTS = [];
      global.PRODUCTS = PRODUCTS;
      return PRODUCTS;
    }
  }

  // ---------------------------------------------------------------
  // Getters auxiliares
  // ---------------------------------------------------------------
  function getProductById(id) {
    const target = _toId(id);
    return PRODUCTS.find(function (p) { return _matchId(p.id, target); }) || null;
  }

  function getProductBySlug(slug) {
    if (!slug) return null;
    return PRODUCTS.find(function (p) { return p.slug === slug; }) || null;
  }

  function getVariantById(productId, variantId) {
    if (!_config) return null;
    const variants = _config.variants || [];
    const pId = _toId(productId);
    const vId = _toId(variantId);
    return variants.find(function (v) {
      return _matchId(v.productId, pId) && _matchId(v.id, vId);
    }) || null;
  }

  function getFirstAvailableVariant(productId) {
    if (!_config) return null;
    const pId = _toId(productId);
    return (_config.variants || []).find(function (v) {
      return _matchId(v.productId, pId) && v.availableForSale;
    }) || null;
  }

  function _resolveMainImage(product) {
    if (!_config || !product) return null;
    const imgs = (_config.productImages || [])
      .filter(function (i) { return i.productId === product.id; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    return imgs.find(function (i) { return i.type === 'main'; }) || imgs[0] || null;
  }

  function _resolveMinPriceVariant(product) {
    if (!_config || !product) return null;
    const variants = (_config.variants || []).filter(function (v) {
      return v.productId === product.id && v.availableForSale;
    });
    if (!variants.length) return null;
    return variants.reduce(function (min, v) {
      if (!min) return v;
      const mp = min.pricing && typeof min.pricing.price === 'number' ? min.pricing.price : Infinity;
      const vp = v.pricing && typeof v.pricing.price === 'number' ? v.pricing.price : Infinity;
      return vp < mp ? v : min;
    }, null);
  }

  function _getCheckoutText(productId) {
    if (!_config) return 'Adicionar ao carrinho';
    const c = (_config.productCheckout || []).find(function (x) { return x.productId === productId; });
    return (c && c.cartButtonText) || 'Adicionar ao carrinho';
  }

  // ---------------------------------------------------------------
  // renderProducts(products)
  // ---------------------------------------------------------------
  /**
   * Renderiza cards APENAS em containers `[data-products]`.
   * Se não houver nenhum container desse tipo no DOM, retorna false
   * e não toca em nada (preservando o HTML estático/legado dos
   * carrosséis e do design system atual).
   *
   * A marcação é minimalista e não compete com classes do projeto;
   * usa o prefixo `off-product-card__*` para evitar colisão.
   */
  function renderProducts(products) {
    const containers = document.querySelectorAll('[data-products]');
    if (!containers.length) return false;

    const list = Array.isArray(products) ? products : PRODUCTS;
    const active = list.filter(function (p) { return p && p.active; });

    const html = active.map(function (product) {
      const variant = _resolveMinPriceVariant(product);
      const image = _resolveMainImage(product);
      const price = variant && variant.pricing && typeof variant.pricing.price === 'number'
        ? _formatBRL(variant.pricing.price) : '';
      const compareAt = variant && variant.pricing && typeof variant.pricing.compareAtPrice === 'number'
        && variant.pricing.compareAtPrice > variant.pricing.price
        ? _formatBRL(variant.pricing.compareAtPrice) : '';
      const ctaText = _getCheckoutText(product.id);
      const variantId = variant ? variant.id : '';
      const sold = variant ? '' : 'disabled';

      return [
        '<article class="off-product-card" data-product-id="' + _escapeHTML(product.id) + '">',
        image ? '  <div class="off-product-card__media"><img src="' + _escapeHTML(image.src) +
          '" alt="' + _escapeHTML(image.alt || product.name) +
          '" loading="lazy" onerror="this.style.opacity=0;"></div>' : '',
        '  <div class="off-product-card__body">',
        product.subtitle ? '    <span class="off-product-card__tag">' + _escapeHTML(product.subtitle) + '</span>' : '',
        '    <h3 class="off-product-card__name">' + _escapeHTML(product.name) + '</h3>',
        product.shortDescription ? '    <p class="off-product-card__desc">' + _escapeHTML(product.shortDescription) + '</p>' : '',
        (price || compareAt) ? (
          '    <div class="off-product-card__price">' +
          (compareAt ? '<span class="off-product-card__price-old">' + _escapeHTML(compareAt) + '</span>' : '') +
          (price ? '<span class="off-product-card__price-now">' + _escapeHTML(price) + '</span>' : '') +
          '</div>'
        ) : '',
        '    <button type="button" class="off-product-card__cta"',
        '            data-add-to-cart',
        '            data-product-id="' + _escapeHTML(product.id) + '"',
        '            data-variant-id="' + _escapeHTML(variantId) + '"',
        '            ' + sold + '>',
        '      ' + _escapeHTML(ctaText),
        '    </button>',
        '  </div>',
        '</article>',
      ].filter(Boolean).join('\n');
    }).join('\n');

    containers.forEach(function (c) { c.innerHTML = html; });
    setupAddToCartButtons();
    return true;
  }

  // ---------------------------------------------------------------
  // setupAddToCartButtons()
  // ---------------------------------------------------------------
  /**
   * Bind global de qualquer botão `[data-add-to-cart]`. Cada botão deve
   * fornecer `[data-product-id]` e (idealmente) `[data-variant-id]`.
   *
   * Se `data-variant-id` estiver ausente, usa a primeira variação
   * disponível do produto (`availableForSale === true`).
   *
   * Suporta também `data-quantity` (default = 1).
   *
   * É idempotente: marca cada botão como bound e nunca rebina.
   * Também observa mutações do DOM para pegar botões adicionados
   * dinamicamente (compatibilidade com `OffStore.renderEnergyDrinkCarousel`,
   * `renderApparelCarousel` e qualquer renderização futura).
   */
  function setupAddToCartButtons() {
    document.querySelectorAll('[data-add-to-cart]').forEach(_bindOne);
  }

  function _bindOne(btn) {
    if (!btn || btn.__offShopifyBound) return;
    btn.__offShopifyBound = true;
    btn.addEventListener('click', _onAddClick);
  }

  async function _onAddClick(ev) {
    const btn = ev.currentTarget;
    if (!btn || btn.disabled) return;
    ev.preventDefault();

    // Garante que produtos estejam carregados.
    if (!PRODUCTS.length) {
      try { await loadProducts(); } catch (_) {}
    }

    const productId = btn.getAttribute('data-product-id');
    const variantIdAttr = btn.getAttribute('data-variant-id');
    const qtyAttr = btn.getAttribute('data-quantity');
    const qty = Math.max(1, parseInt(qtyAttr, 10) || 1);

    const product = getProductById(productId);
    if (!product) {
      console.warn('[OffShopifyProducts] Produto não encontrado para data-product-id="' + productId + '".');
      return;
    }

    const variant = variantIdAttr
      ? getVariantById(product.id, variantIdAttr)
      : getFirstAvailableVariant(product.id);

    if (!variant) {
      console.warn('[OffShopifyProducts] Variação não encontrada (product=' + product.id +
        ', variantId=' + variantIdAttr + '). Selecione uma variação válida.');
      return;
    }

    if (!global.OffShopifyCart || typeof global.OffShopifyCart.addToCart !== 'function') {
      console.warn('[OffShopifyProducts] OffShopifyCart ausente. Inclua cart.js antes de products.js.');
      return;
    }

    await global.OffShopifyCart.addToCart(product, variant, qty);

    // Abre o drawer lateral se existir (UX consistente com produto.html).
    if (global.OffCart && typeof global.OffCart.open === 'function') {
      global.OffCart.open();
    }

    // Feedback visual leve no botão (não altera layout/CSS).
    const original = btn.innerHTML;
    if (!btn.dataset.__busy) {
      btn.dataset.__busy = '1';
      const txt = btn.querySelector('span');
      if (txt) {
        const oldText = txt.textContent;
        txt.textContent = '✓ Adicionado';
        setTimeout(function () { txt.textContent = oldText; delete btn.dataset.__busy; }, 1400);
      } else {
        btn.innerHTML = '✓ Adicionado';
        setTimeout(function () { btn.innerHTML = original; delete btn.dataset.__busy; }, 1400);
      }
    }
  }

  // ---------------------------------------------------------------
  // Observa o DOM para pegar botões adicionados depois (carrosséis,
  // renderizações dinâmicas do OffStore, etc.)
  // ---------------------------------------------------------------
  function _watchDOM() {
    if (!('MutationObserver' in window)) return;
    const obs = new MutationObserver(function () { setupAddToCartButtons(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  async function _init() {
    await loadProducts();
    renderProducts(PRODUCTS); // no-op silencioso se não houver [data-products]
    setupAddToCartButtons();
    _watchDOM();
    if (global.OffShopifyCart && typeof global.OffShopifyCart.renderCartCount === 'function') {
      global.OffShopifyCart.renderCartCount();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ---------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------
  global.OffShopifyProducts = {
    __initialized: true,
    loadProducts: loadProducts,
    renderProducts: renderProducts,
    setupAddToCartButtons: setupAddToCartButtons,
    getProductById: getProductById,
    getProductBySlug: getProductBySlug,
    getVariantById: getVariantById,
    getFirstAvailableVariant: getFirstAvailableVariant,
    get PRODUCTS() { return PRODUCTS.slice(); },
  };

  // Aliases globais (conforme o brief)
  global.loadProducts = loadProducts;
  global.renderProducts = renderProducts;
  global.setupAddToCartButtons = setupAddToCartButtons;
})(typeof window !== 'undefined' ? window : globalThis);
