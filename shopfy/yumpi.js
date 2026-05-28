(function (global) {
  'use strict';

  if (global.OffYumpiCheckout && global.OffYumpiCheckout.__initialized) return;

  const DEFAULT_YUMPI_OPTIONS = {
    preserveUtm: true,
    promocodeParam: 'promocode',
    utmParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    checkoutBaseUrl: null,
  };

  function extractShopifyVariantId(value) {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const match = raw.match(/ProductVariant\/(\d+)/i);
    if (match && match[1]) return match[1];
    const digits = raw.match(/^\d+$/);
    if (digits) return digits[0];
    return null;
  }

  function extractYumpiCheckoutParts(yumpiCheckoutUrl) {
    if (typeof yumpiCheckoutUrl !== 'string' || !yumpiCheckoutUrl.trim()) {
      throw new Error('[YUMPI Checkout] yumpiCheckout ausente ou invalida.');
    }

    let parsed;
    try {
      parsed = new URL(yumpiCheckoutUrl);
    } catch (_) {
      throw new Error('[YUMPI Checkout] URL yumpiCheckout invalida: ' + yumpiCheckoutUrl);
    }

    const cleanPath = String(parsed.pathname || '').replace(/\/+$/, '');
    const pathParts = cleanPath.split('/').filter(Boolean);
    if (!pathParts.length) {
      throw new Error('[YUMPI Checkout] URL yumpiCheckout sem token: ' + yumpiCheckoutUrl);
    }

    const tokenWithMaybeQty = pathParts[pathParts.length - 1] || '';
    const token = tokenWithMaybeQty.split(':')[0].trim();
    if (!token) {
      throw new Error('[YUMPI Checkout] Token ausente na URL yumpiCheckout: ' + yumpiCheckoutUrl);
    }

    const purchasePathParts = pathParts.slice(0, -1);
    const purchasePath = '/' + purchasePathParts.join('/');
    if (!purchasePath || purchasePath === '/') {
      throw new Error('[YUMPI Checkout] Caminho de compra invalido na URL yumpiCheckout: ' + yumpiCheckoutUrl);
    }

    return {
      origin: parsed.origin,
      purchasePath: purchasePath,
      token: token,
    };
  }

  function sanitizeQuantity(quantity) {
    const n = parseInt(quantity, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }

  function _getVariants(database) {
    if (database && Array.isArray(database.variants)) return database.variants;
    return [];
  }

  function _collectVariantCandidates(item) {
    if (!item || typeof item !== 'object') return [];
    const list = [
      item.variantId,
      item.merchandiseId,
      item.shopifyVariantId,
      item.idVariant,
      item.variant && item.variant.id,
      item.variant && item.variant.shopify && item.variant.shopify.variantId,
      item.variant && item.variant.shopify && item.variant.shopify.merchandiseId,
      item.shopify && item.shopify.variantId,
      item.shopify && item.shopify.merchandiseId,
      item.id,
    ];
    return list.filter(function (v) { return v != null && String(v).trim() !== ''; });
  }

  function _compareByShopifyIds(candidate, variant) {
    const candidateShopifyId = extractShopifyVariantId(candidate);
    if (!candidateShopifyId) return false;
    const variantShopify = variant && variant.shopify ? variant.shopify : {};
    const variantIdA = extractShopifyVariantId(variantShopify.variantId);
    const variantIdB = extractShopifyVariantId(variantShopify.merchandiseId);
    return candidateShopifyId === variantIdA || candidateShopifyId === variantIdB;
  }

  function _compareByLocalVariantId(candidate, variant) {
    if (!variant || variant.id == null || candidate == null) return false;
    const c = String(candidate).trim();
    return c !== '' && c === String(variant.id);
  }

  function findVariantForCartItem(item, database) {
    const variants = _getVariants(database);
    if (!variants.length) return null;

    const candidates = _collectVariantCandidates(item);
    if (!candidates.length) return null;

    let found = null;
    candidates.some(function (candidate) {
      found = variants.find(function (variant) {
        return _compareByShopifyIds(candidate, variant);
      }) || null;
      return !!found;
    });
    if (found) return found;

    candidates.some(function (candidate) {
      found = variants.find(function (variant) {
        return _compareByLocalVariantId(candidate, variant);
      }) || null;
      return !!found;
    });
    return found;
  }

  function canUseYumpiCheckout(items, database) {
    if (!Array.isArray(items) || !items.length) {
      return {
        canUse: false,
        reason: 'Carrinho vazio.',
        missingItems: [],
      };
    }

    const missingItems = [];
    items.forEach(function (item, idx) {
      const variant = findVariantForCartItem(item, database);
      if (!variant) {
        missingItems.push({
          index: idx,
          reason: 'Variante nao localizada no JSON.',
          item: item,
        });
        return;
      }
      if (!variant.yumpiCheckout || !String(variant.yumpiCheckout).trim()) {
        missingItems.push({
          index: idx,
          reason: 'Variante sem yumpiCheckout configurado.',
          item: item,
          variantId: variant.id,
        });
      }
    });

    if (!missingItems.length) {
      return { canUse: true, reason: null, missingItems: [] };
    }
    return {
      canUse: false,
      reason: 'Algum item nao possui yumpiCheckout configurado.',
      missingItems: missingItems,
    };
  }

  function _normalizeOptions(options) {
    return Object.assign({}, DEFAULT_YUMPI_OPTIONS, options || {});
  }

  function _extractBaseFromCheckoutBaseUrl(checkoutBaseUrl, fallbackParts) {
    if (!checkoutBaseUrl) return fallbackParts;
    let parsed;
    try {
      parsed = new URL(String(checkoutBaseUrl));
    } catch (_) {
      throw new Error('[YUMPI Checkout] options.checkoutBaseUrl invalida: ' + checkoutBaseUrl);
    }
    const cleanPath = String(parsed.pathname || '').replace(/\/+$/, '');
    if (!cleanPath || cleanPath === '/') {
      if (!fallbackParts) {
        throw new Error('[YUMPI Checkout] options.checkoutBaseUrl sem purchasePath valido.');
      }
      return {
        origin: parsed.origin,
        purchasePath: fallbackParts.purchasePath,
      };
    }
    return {
      origin: parsed.origin,
      purchasePath: cleanPath,
    };
  }

  function _appendQueryParams(url, options) {
    const parsed = new URL(url);

    if (options.preserveUtm && typeof window !== 'undefined' && window.location) {
      const current = new URLSearchParams(window.location.search || '');
      const utmParams = Array.isArray(options.utmParams) ? options.utmParams : [];
      utmParams.forEach(function (key) {
        if (!key) return;
        const value = current.get(key);
        if (value != null && value !== '') parsed.searchParams.set(key, value);
      });
    }

    if (options.promocode != null && String(options.promocode).trim() !== '') {
      parsed.searchParams.set(options.promocodeParam || 'promocode', String(options.promocode).trim());
    }

    return parsed.toString();
  }

  function buildYumpiCheckoutUrl(items, database, options) {
    if (!Array.isArray(items) || !items.length) {
      throw new Error('[YUMPI Checkout] Carrinho vazio.');
    }
    const variants = _getVariants(database);
    if (!variants.length) {
      throw new Error('[YUMPI Checkout] Banco sem variants para montar checkout.');
    }

    const cfg = _normalizeOptions(options);
    let firstParts = null;
    const tokenQtyParts = [];

    items.forEach(function (item, idx) {
      const variant = findVariantForCartItem(item, database);
      if (!variant) {
        throw new Error('[YUMPI Checkout] Variante nao localizada para item #' + idx + '.');
      }
      if (!variant.yumpiCheckout) {
        throw new Error('[YUMPI Checkout] Variante sem yumpiCheckout para item #' + idx + '.');
      }

      const parts = extractYumpiCheckoutParts(variant.yumpiCheckout);
      if (!firstParts) {
        firstParts = parts;
      } else if (parts.origin !== firstParts.origin || parts.purchasePath !== firstParts.purchasePath) {
        console.warn(
          '[YUMPI Checkout] Divergencia de dominio/caminho entre variantes. ' +
          'Usando base do primeiro item.',
          { first: firstParts, current: parts, variantId: variant.id }
        );
      }

      const qty = sanitizeQuantity(item && (item.qty != null ? item.qty : item.quantity));
      tokenQtyParts.push(parts.token + ':' + qty);
    });

    if (!firstParts) {
      throw new Error('[YUMPI Checkout] Nao foi possivel determinar base de checkout.');
    }

    const base = _extractBaseFromCheckoutBaseUrl(cfg.checkoutBaseUrl, firstParts);
    const baseUrl = base.origin + base.purchasePath;
    const joinedTokens = tokenQtyParts.join(',');
    const finalBaseUrl = baseUrl.replace(/\/+$/, '') + '/' + joinedTokens;
    return _appendQueryParams(finalBaseUrl, cfg);
  }

  function redirectToYumpiCheckout(items, database, options) {
    const finalUrl = buildYumpiCheckoutUrl(items, database, options);
    console.log('[YUMPI Checkout] URL final gerada:', finalUrl);
    window.location.href = finalUrl;
    return finalUrl;
  }

  global.OffYumpiCheckout = {
    __initialized: true,
    extractShopifyVariantId: extractShopifyVariantId,
    extractYumpiCheckoutParts: extractYumpiCheckoutParts,
    sanitizeQuantity: sanitizeQuantity,
    findVariantForCartItem: findVariantForCartItem,
    buildYumpiCheckoutUrl: buildYumpiCheckoutUrl,
    canUseYumpiCheckout: canUseYumpiCheckout,
    redirectToYumpiCheckout: redirectToYumpiCheckout,
  };
})(typeof window !== 'undefined' ? window : globalThis);
