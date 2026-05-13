/* =====================================================================
 * OFF NUTRITION LAB — Cart Bridge (local ⇄ Shopify checkout)
 * ---------------------------------------------------------------------
 * Camada que:
 *   1) Lê e grava o carrinho no `localStorage` (chave vinda de
 *      settings.cartStorageKey — padrão "off_cart") sincronizando
 *      com o cart drawer existente (`window.OffCart` de cart-drawer.js).
 *   2) Cria um Cart REAL na Shopify via Storefront API (mutation
 *      `cartCreate`) e redireciona o usuário para o `checkoutUrl`.
 *
 * API pública (window.OffShopifyCart):
 *   getCart()                       → Array<item>
 *   saveCart(items)                 → void
 *   clearCart()                     → void
 *   addToCart(product, variant, q=1)→ Promise<item>
 *   removeFromCart(variantId)       → void
 *   updateCartQuantity(variantId,q) → void
 *   renderCartCount()               → void
 *   createShopifyCart(cartItems?)   → Promise<{id,checkoutUrl,totalQuantity,cost,...}>
 *   goToCheckout()                  → Promise<void>
 *
 * Aliases globais (conforme o brief): getCart, saveCart, clearCart,
 * addToCart, removeFromCart, updateCartQuantity, renderCartCount,
 * createShopifyCart, goToCheckout.
 *
 * Importante:
 *   - Não substitui o cart drawer (cart-drawer.js). Apenas faz a ponte.
 *   - Não altera CSS, layout, animações ou comportamento visual.
 *   - O botão "Finalizar compra" (.js-cart-checkout) é interceptado
 *     em capture-phase para disparar o fluxo real da Shopify.
 *   - Só envia `merchandiseId` e `quantity` para a Shopify.
 * ===================================================================== */
(function (global) {
  'use strict';

  if (global.OffShopifyCart && global.OffShopifyCart.__initialized) return;

  // ---------------------------------------------------------------
  // Constantes & helpers
  // ---------------------------------------------------------------
  const DEFAULT_STORAGE_KEY = 'off_cart';

  function _cfg() {
    return (global.OffShopify && global.OffShopify.config) || null;
  }

  function _storageKey() {
    const c = _cfg();
    return (c && c.cartStorageKey) || DEFAULT_STORAGE_KEY;
  }

  function _uid() {
    return 'ci_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function _toQty(v) {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }

  /**
   * Extrai o GID da variação Shopify a partir das diferentes chaves
   * usadas no projeto (shopifyVariantId, merchandiseId, shopifyVariantGid,
   * shopify.variantId, shopify.merchandiseId).
   */
  function _resolveMerchandiseId(item) {
    if (!item) return null;
    if (item.shopifyVariantId) return item.shopifyVariantId;
    if (item.merchandiseId)    return item.merchandiseId;
    if (item.shopifyVariantGid) return item.shopifyVariantGid;
    if (item.shopify) {
      if (item.shopify.merchandiseId) return item.shopify.merchandiseId;
      if (item.shopify.variantId)     return item.shopify.variantId;
    }
    return null;
  }

  function _isValidMerchandiseGid(id) {
    return typeof id === 'string'
      && id.indexOf('gid://shopify/ProductVariant/') === 0
      && !/COLOQUE_AQUI/i.test(id);
  }

  function _resolveImage(product, variant) {
    const c = _cfg();
    const imgs = (c && c.productImages) || [];
    if (variant && Array.isArray(variant.imageIds) && variant.imageIds.length) {
      const v = imgs.find(function (i) { return variant.imageIds.indexOf(i.id) !== -1; });
      if (v && v.src) return v.src;
    }
    if (product) {
      const pImgs = imgs
        .filter(function (i) { return i.productId === product.id; })
        .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
      const main = pImgs.find(function (i) { return i.type === 'main'; }) || pImgs[0];
      if (main && main.src) return main.src;
    }
    return '';
  }

  function _buildSubtitle(product, variant) {
    if (!variant) return '';
    const c = _cfg();
    const optionValues = (c && c.optionValues) || [];
    if (Array.isArray(variant.optionValueIds) && variant.optionValueIds.length) {
      const labels = variant.optionValueIds.map(function (id) {
        const ov = optionValues.find(function (o) { return o.id === id; });
        return ov ? ov.value : null;
      }).filter(Boolean);
      if (labels.length) return labels.join(' · ');
    }
    if (variant.title) {
      if (product && variant.title.indexOf(product.name) === 0) {
        return variant.title.slice(product.name.length).replace(/^[\s·\-]+/, '').trim();
      }
      return variant.title;
    }
    return '';
  }

  function _matchKey(item) {
    const gid = _resolveMerchandiseId(item);
    if (gid) return 'gid:' + gid;
    if (item && item.variantId != null) return 'v:' + item.variantId;
    if (item && item.productId != null) return 'p:' + item.productId + '|' + (item.name || '');
    return JSON.stringify(item);
  }

  // ---------------------------------------------------------------
  // getCart / saveCart / clearCart
  // ---------------------------------------------------------------
  function getCart() {
    if (global.OffCart && typeof global.OffCart.getItems === 'function') {
      return global.OffCart.getItems();
    }
    try {
      const raw = localStorage.getItem(_storageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed && parsed.items) ? parsed.items : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    if (!Array.isArray(items)) return;
    try {
      localStorage.setItem(_storageKey(), JSON.stringify({ items: items }));
    } catch (e) { /* localStorage pode estar cheio/privado */ }
  }

  function clearCart() {
    if (global.OffCart && typeof global.OffCart.clear === 'function') {
      global.OffCart.clear();
    } else {
      saveCart([]);
    }
    renderCartCount();
  }

  // ---------------------------------------------------------------
  // addToCart
  // ---------------------------------------------------------------
  /**
   * Adiciona uma variação ao carrinho local.
   * @param {Object} product  - objeto do JSON (deve ter id, name, slug…)
   * @param {Object} variant  - objeto do JSON (deve ter id, shopify.variantId/merchandiseId, pricing…)
   * @param {Number} quantity - quantidade (default 1)
   */
  async function addToCart(product, variant, quantity) {
    if (!product || !variant) {
      console.warn('[OffShopifyCart] addToCart: produto/variação ausentes.');
      return null;
    }

    // Garante que a config já tenha sido carregada (para acessar imagens
    // e opções a partir do JSON).
    if (global.OffShopify && typeof global.OffShopify.loadShopifyConfig === 'function' && !_cfg()) {
      try { await global.OffShopify.loadShopifyConfig(); } catch (_) { /* tolerante */ }
    }

    const qty = _toQty(quantity);
    const merchandiseId = _resolveMerchandiseId(variant) || _resolveMerchandiseId({ shopify: variant.shopify });
    const pricing = variant.pricing || {};

    const cartItem = {
      id: _uid(),
      productId: product.id,
      variantId: variant.id,
      slug: product.slug || null,
      name: product.name,
      subtitle: _buildSubtitle(product, variant),
      image: _resolveImage(product, variant),
      price: typeof pricing.price === 'number' ? pricing.price : 0,
      compareAtPrice: typeof pricing.compareAtPrice === 'number' ? pricing.compareAtPrice : null,
      // Triplo nome para máxima compatibilidade (cart-drawer + brief + Shopify):
      shopifyVariantId: merchandiseId,
      shopifyVariantGid: merchandiseId,
      merchandiseId: merchandiseId,
      qty: qty,
    };

    // Caminho preferencial: delega ao cart drawer (anima abertura, badge,
    // soma quantidade se já existir, etc).
    if (global.OffCart && typeof global.OffCart.add === 'function') {
      global.OffCart.add(cartItem);
    } else {
      // Fallback puro: grava direto no localStorage no mesmo formato
      // que o cart-drawer espera (items com id+qty).
      const items = getCart();
      const key = _matchKey(cartItem);
      const existing = items.find(function (it) { return _matchKey(it) === key; });
      if (existing) {
        existing.qty = (existing.qty || 0) + qty;
      } else {
        items.push(cartItem);
      }
      saveCart(items);
    }

    renderCartCount();
    return cartItem;
  }

  // ---------------------------------------------------------------
  // removeFromCart / updateCartQuantity
  // ---------------------------------------------------------------
  function _findItemByVariantId(items, variantId) {
    return items.find(function (it) {
      if (!it) return false;
      if (it.variantId === variantId) return true;
      if (it.shopifyVariantId === variantId) return true;
      if (it.shopifyVariantGid === variantId) return true;
      if (it.merchandiseId === variantId) return true;
      return false;
    }) || null;
  }

  function removeFromCart(variantId) {
    if (global.OffCart && typeof global.OffCart.remove === 'function') {
      const items = global.OffCart.getItems();
      const target = _findItemByVariantId(items, variantId);
      if (target && target.id) global.OffCart.remove(target.id);
    } else {
      const items = getCart().filter(function (it) {
        return !(it && (it.variantId === variantId
          || it.shopifyVariantId === variantId
          || it.shopifyVariantGid === variantId
          || it.merchandiseId === variantId));
      });
      saveCart(items);
    }
    renderCartCount();
  }

  function updateCartQuantity(variantId, quantity) {
    const q = _toQty(quantity);
    if (global.OffCart && typeof global.OffCart.updateQty === 'function') {
      const items = global.OffCart.getItems();
      const target = _findItemByVariantId(items, variantId);
      if (target && target.id) {
        const delta = q - (target.qty || 0);
        if (delta !== 0) global.OffCart.updateQty(target.id, delta);
      }
    } else {
      const items = getCart();
      const target = _findItemByVariantId(items, variantId);
      if (target) target.qty = q;
      saveCart(items);
    }
    renderCartCount();
  }

  // ---------------------------------------------------------------
  // renderCartCount
  // ---------------------------------------------------------------
  /**
   * Atualiza qualquer elemento que represente o badge do carrinho:
   *   - [data-cart-count]   (atributo preferencial do brief)
   *   - .js-cart-count      (legado do header/produto do projeto)
   */
  function renderCartCount() {
    const items = getCart();
    const total = items.reduce(function (acc, it) {
      return acc + (typeof it.qty === 'number' ? it.qty : (typeof it.quantity === 'number' ? it.quantity : 0));
    }, 0);
    const selectors = '[data-cart-count], .js-cart-count';
    document.querySelectorAll(selectors).forEach(function (el) {
      el.textContent = String(total);
    });
  }

  // ---------------------------------------------------------------
  // createShopifyCart — mutation cartCreate
  // ---------------------------------------------------------------
  const CART_CREATE_MUTATION = [
    'mutation CartCreate($input: CartInput!) {',
    '  cartCreate(input: $input) {',
    '    cart {',
    '      id',
    '      checkoutUrl',
    '      totalQuantity',
    '      cost {',
    '        subtotalAmount { amount currencyCode }',
    '        totalAmount    { amount currencyCode }',
    '        totalTaxAmount { amount currencyCode }',
    '      }',
    '      lines(first: 100) {',
    '        edges {',
    '          node {',
    '            id',
    '            quantity',
    '            merchandise {',
    '              ... on ProductVariant {',
    '                id',
    '                title',
    '                product { title }',
    '              }',
    '            }',
    '          }',
    '        }',
    '      }',
    '    }',
    '    userErrors { field message code }',
    '  }',
    '}',
  ].join('\n');

  /**
   * Converte os itens locais para o payload mínimo da Storefront API
   * e cria o carrinho. Retorna o objeto `cart` da Shopify.
   *
   * @param {Array}  cartItems - opcional; se omitido, usa getCart()
   * @returns {Promise<{id,checkoutUrl,totalQuantity,cost,lines}>}
   */
  async function createShopifyCart(cartItems) {
    if (!global.OffShopify || typeof global.OffShopify.shopifyFetch !== 'function') {
      throw new Error('[OffShopifyCart] OffShopify ausente. Inclua shopify.js antes de cart.js.');
    }

    const source = Array.isArray(cartItems) && cartItems.length ? cartItems : getCart();
    if (!source.length) throw new Error('Carrinho vazio.');

    const lines = source
      .map(function (it) {
        return {
          merchandiseId: _resolveMerchandiseId(it),
          quantity: _toQty(it.qty != null ? it.qty : it.quantity),
        };
      })
      .filter(function (l) { return _isValidMerchandiseGid(l.merchandiseId); });

    if (!lines.length) {
      throw new Error('Nenhum item do carrinho possui merchandiseId válido (gid://shopify/ProductVariant/...). Verifique o JSON da loja.');
    }
    if (lines.length !== source.length) {
      console.warn('[OffShopifyCart] ' + (source.length - lines.length) +
        ' item(ns) ignorado(s) por não ter merchandiseId válido.');
    }

    const data = await global.OffShopify.shopifyFetch(CART_CREATE_MUTATION, {
      input: { lines: lines },
    });

    const result = data && data.cartCreate;
    if (!result) throw new Error('Resposta vazia em cartCreate.');

    if (Array.isArray(result.userErrors) && result.userErrors.length) {
      const msg = result.userErrors.map(function (e) {
        return (e.field ? '[' + (Array.isArray(e.field) ? e.field.join('.') : e.field) + '] ' : '') + e.message;
      }).join(' | ');
      throw new Error('Erros ao criar carrinho na Shopify: ' + msg);
    }

    if (!result.cart || !result.cart.checkoutUrl) {
      throw new Error('Carrinho criado sem checkoutUrl válido.');
    }

    return result.cart;
  }

  // ---------------------------------------------------------------
  // goToCheckout — fluxo "Finalizar compra"
  // ---------------------------------------------------------------
  let _processing = false;

  function _findCheckoutButton() {
    return document.querySelector(
      '[data-cart-checkout], .js-cart-checkout, .off-cart-checkout'
    );
  }

  function _setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
      btn.setAttribute('disabled', 'true');
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-loading');
      btn.style.pointerEvents = 'none';
      btn.innerHTML = 'Redirecionando…';
    } else {
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-loading');
      btn.style.pointerEvents = '';
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /**
   * Lê o carrinho local, cria o carrinho real na Shopify e redireciona
   * para o `checkoutUrl`. Desabilita o botão durante a operação.
   */
  async function goToCheckout() {
    if (_processing) return;

    const items = getCart();
    if (!items.length) {
      try { alert('Seu carrinho está vazio.'); } catch (_) {}
      return;
    }

    _processing = true;
    const btn = _findCheckoutButton();
    _setBusy(btn, true);

    try {
      const cart = await createShopifyCart(items);
      // Não limpamos o carrinho local antes do redirect: caso o usuário
      // volte sem concluir, o estado do drawer permanece intacto.
      // A Shopify passa a ser a fonte da verdade a partir daqui.
      window.location.href = cart.checkoutUrl;
      return cart;
    } catch (err) {
      console.error('[OffShopifyCart] Falha em goToCheckout:', err);
      const msg = (err && err.message)
        ? err.message
        : 'Não foi possível iniciar o checkout.';
      try { alert(msg); } catch (_) {}
      _setBusy(btn, false);
      _processing = false;
      throw err;
    }
  }

  // ---------------------------------------------------------------
  // Wiring automático do botão "Finalizar compra"
  // ---------------------------------------------------------------
  // O cart-drawer.js renderiza dinamicamente um botão `.js-cart-checkout`
  // cada vez que o conteúdo do drawer muda, e anexa um listener interno
  // que apenas mostra um toast genérico "Redirecionando para o checkout..."
  // sem efetivamente redirecionar (era um placeholder até esta integração).
  //
  // Em vez de tentar substituir listeners (que seriam recriados a cada
  // re-render), usamos delegação em CAPTURE-PHASE no document e chamamos
  // stopPropagation/stopImmediatePropagation. Isso:
  //   - Garante que NOSSO handler rode primeiro;
  //   - Impede o listener-placeholder do drawer de disparar o toast
  //     enganoso quando, na verdade, há um erro (token vazio etc.);
  //   - Funciona mesmo após qualquer re-renderização do drawer;
  //   - Funciona também em botões custom do projeto via [data-cart-checkout].
  function _wireCheckoutDelegation() {
    if (document.__offShopifyCheckoutWired) return;
    document.__offShopifyCheckoutWired = true;
    document.addEventListener('click', function (ev) {
      const tgt = ev.target && ev.target.closest
        ? ev.target.closest('[data-cart-checkout], .js-cart-checkout, .off-cart-checkout')
        : null;
      if (!tgt) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      goToCheckout();
    }, true /* capture */);
  }

  function _init() {
    _wireCheckoutDelegation();
    renderCartCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ---------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------
  global.OffShopifyCart = {
    __initialized: true,
    getCart: getCart,
    saveCart: saveCart,
    clearCart: clearCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    updateCartQuantity: updateCartQuantity,
    renderCartCount: renderCartCount,
    createShopifyCart: createShopifyCart,
    goToCheckout: goToCheckout,
  };

  // Aliases globais (conforme o brief)
  global.getCart = getCart;
  global.saveCart = saveCart;
  global.clearCart = clearCart;
  global.addToCart = addToCart;
  global.removeFromCart = removeFromCart;
  global.updateCartQuantity = updateCartQuantity;
  global.renderCartCount = renderCartCount;
  global.createShopifyCart = createShopifyCart;
  global.goToCheckout = goToCheckout;
})(typeof window !== 'undefined' ? window : globalThis);
