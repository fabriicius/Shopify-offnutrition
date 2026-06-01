/* =================================================================
   OFF Nutrition Lab — Store Adapter
   -----------------------------------------------------------------
   Camada utilitária que carrega o JSON local (jsondb/off-products-database.json)
   e expõe um conjunto de helpers para o front-end consumir os dados
   seguindo a documentação:
     - jsondb/documentacao_json_off_nutrition_front_end.md

   Uso esperado:
     await OffStore.load();
     const energyProducts = OffStore.getProductsByCategorySlug('suplementos');
     OffStore.renderEnergyDrinkCarousel({ trackEl, dotsEl });
     OffStore.renderApparelCarousel({ trackEl });

   Nada do que aparece na tela é hard-coded a partir do JSON: cores,
   tipografia, layout e animações continuam sendo controlados pelo CSS
   já existente. Apenas os textos, preços, links e imagens vêm do JSON.

   Princípios:
     - Falha silenciosa: se o fetch falhar (ex: file://) o conteúdo
       hard-coded original do HTML permanece como fallback visual.
     - Não exibir IDs técnicos (productId, variantId, optionValueIds…).
     - Preço sempre formatado em BRL no front-end.
     - Variação selecionada determina preço, estoque e merchandiseId.
   ================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------
     Constantes de configuração
     - Os slugs ficam em CONSTANTS para permitir trocar a categoria
       sem mexer em código de UI quando o JSON for atualizado.
     --------------------------------------------------------------- */
  const CONSTANTS = {
    JSON_URL: './jsondb/off-products-database.json',
    ACCOUNT_ORDERS_URL: 'https://conta.offnutrition.com.br/account/orders',
    // ID canônico das categorias usadas pelos renderers principais.
    // Conforme combinado: terceira dobra = categoria 1 (Energy Drink),
    // quinta dobra = categoria 2 (Vestuário). Fonte primária da verdade.
    ENERGY_DRINK_CATEGORY_ID: 1,
    APPAREL_CATEGORY_ID: 2,
    // Backups por nome/slug — usados apenas quando o JSON for refatorado
    // para outros IDs e mantemos compatibilidade graceful.
    ENERGY_DRINK_CATEGORY_NAMES: ['Energy Drink', 'Energy Dust'],
    ENERGY_DRINK_CATEGORY_SLUGS: ['energy-drink', 'energy-dust', 'suplementos'],
    APPAREL_CATEGORY_NAMES: ['Vestuário', 'Vestuario', 'Apparel'],
    APPAREL_CATEGORY_SLUGS: ['vestuario', 'vestuário', 'apparel', 'onlab'],
    FALLBACK_IMAGE: './assets/raw_files/JOURNAL.png',
    PRODUTO_PAGE: './produto.html',
    COLECAO_VESTUARIO_URL: './colecao.html?category=vestuario',
    ONLAB_MODEL_IMAGES: [
      { src: './assets/raw_files/modelos/1.png', alt: 'Modelo vestindo coleção ONLAB — look 1' },
      { src: './assets/raw_files/modelos/2.png', alt: 'Modelo vestindo coleção ONLAB — look 2' },
      { src: './assets/raw_files/modelos/3.png', alt: 'Modelo vestindo coleção ONLAB — look 3' },
      { src: './assets/raw_files/modelos/4.png', alt: 'Modelo vestindo coleção ONLAB — look 4' },
      { src: './assets/raw_files/modelos/5.png', alt: 'Modelo vestindo coleção ONLAB — look 5' },
      { src: './assets/raw_files/modelos/6.png', alt: 'Modelo vestindo coleção ONLAB — look 6' },
    ],
  };

  function hydrateAccountOrdersLinks() {
    const links = document.querySelectorAll('[data-account-orders-link]');
    links.forEach(function (link) {
      link.setAttribute('href', CONSTANTS.ACCOUNT_ORDERS_URL);
    });
  }

  /* ---------------------------------------------------------------
     Estado interno
     --------------------------------------------------------------- */
  let _db = null;
  let _loadPromise = null;

  /* ---------------------------------------------------------------
     Helpers privados
     --------------------------------------------------------------- */
  function _safeArr(arr) { return Array.isArray(arr) ? arr : []; }

  function _byId(list, id) {
    return _safeArr(list).find(item => item && item.id === id) || null;
  }

  function _normSlug(slug) {
    return String(slug || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _matchAnySlug(slug, candidates) {
    const target = _normSlug(slug);
    return _safeArr(candidates).some(c => _normSlug(c) === target);
  }

  /* ---------------------------------------------------------------
     Carregamento do JSON (com cache + fallback gracioso)
     --------------------------------------------------------------- */
  // Carregamento robusto: tenta `fetch` primeiro (servidor HTTP) e cai para
  // XMLHttpRequest se falhar — alguns navegadores ainda permitem XHR síncrono
  // de arquivos locais quando o site é aberto via file://.
  function _loadViaFetch() {
    return fetch(CONSTANTS.JSON_URL, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function _loadViaXHR() {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', CONSTANTS.JSON_URL, true);
        xhr.responseType = 'json';
        xhr.onload = () => {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            try {
              const data = xhr.response || JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) { reject(e); }
          } else {
            reject(new Error('XHR HTTP ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.send();
      } catch (e) { reject(e); }
    });
  }

  function load() {
    if (_db) return Promise.resolve(_db);
    if (_loadPromise) return _loadPromise;

    const isFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    if (isFile) {
      console.warn('[OffStore] Site aberto via file://. Browsers modernos bloqueiam fetch local; tente servir via HTTP (ex: npx http-server) para que o JSON carregue.');
    }

    _loadPromise = _loadViaFetch()
      .catch(err => {
        console.warn('[OffStore] fetch falhou (' + err.message + '). Tentando XHR como fallback…');
        return _loadViaXHR();
      })
      .then(json => {
        _db = json;
        const cats = _safeArr(_db.categories).length;
        const prods = _safeArr(_db.products).length;
        console.info('[OffStore] JSON carregado: ' + cats + ' categorias, ' + prods + ' produtos.');
        return _db;
      })
      .catch(err => {
        console.warn('[OffStore] Não foi possível carregar o JSON local. Mantendo conteúdo estático como fallback.', err);
        _db = null;
        return null;
      });

    return _loadPromise;
  }

  function getDB() { return _db; }
  function isReady() { return _db !== null; }

  /* ---------------------------------------------------------------
     Formatação de moeda (sempre no front, conforme doc §12)
     --------------------------------------------------------------- */
  function formatBRL(value) {
    if (typeof value !== 'number' || !isFinite(value)) return '';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  }

  /* ---------------------------------------------------------------
     Resolvers — categorias, marcas, produtos
     --------------------------------------------------------------- */
  function getCategoryBySlug(slug) {
    if (!_db) return null;
    return _safeArr(_db.categories).find(cat => _normSlug(cat.slug) === _normSlug(slug)) || null;
  }

  function getCategoryByName(name) {
    if (!_db) return null;
    return _safeArr(_db.categories).find(cat => _normSlug(cat.name) === _normSlug(name)) || null;
  }

  function getCategoryById(id) {
    if (!_db) return null;
    return _byId(_db.categories, id);
  }

  function getActiveProducts() {
    if (!_db) return [];
    return _safeArr(_db.products).filter(p => p && p.active);
  }

  function getProductsByCategoryId(id) {
    if (!_db) return [];
    return getActiveProducts().filter(p => p.categoryId === id);
  }

  function getProductsByCategorySlug(slug) {
    if (!_db) return [];
    const cat = getCategoryBySlug(slug);
    if (!cat) return [];
    return getActiveProducts().filter(p => p.categoryId === cat.id);
  }

  function getProductsByCategoryName(name) {
    if (!_db) return [];
    const cat = getCategoryByName(name);
    if (!cat) return [];
    return getActiveProducts().filter(p => p.categoryId === cat.id);
  }

  /**
   * Retorna produtos cuja categoria bater com qualquer slug informado.
   * Útil para rotular semanticamente "Energy Drink" mesmo quando o JSON
   * usa "suplementos" como categoria genérica.
   */
  function getProductsByAnyCategorySlug(slugCandidates) {
    if (!_db) return [];
    const cats = _safeArr(_db.categories).filter(c => _matchAnySlug(c.slug, slugCandidates));
    if (!cats.length) return [];
    const catIds = new Set(cats.map(c => c.id));
    return getActiveProducts().filter(p => catIds.has(p.categoryId));
  }

  /**
   * Resolve produtos preferindo NOME (ex: "Energy Drink") e caindo para
   * SLUGS quando o nome ainda não foi cadastrado. Esta é a função que
   * os renderers da home usam, garantindo que o site funcione com o JSON
   * atual (categoria "Suplementos") e continue funcionando após atualização
   * para "Energy Drink" sem precisar mexer no código.
   */
  function getProductsByCategoryNamesOrSlugs(nameCandidates, slugCandidates) {
    if (!_db) return [];
    // 1ª tentativa: nome canônico
    for (let i = 0; i < _safeArr(nameCandidates).length; i++) {
      const found = getProductsByCategoryName(nameCandidates[i]);
      if (found.length) return found;
    }
    // 2ª tentativa: slugs alternativos
    return getProductsByAnyCategorySlug(slugCandidates);
  }

  function getProductBySlug(slug) {
    if (!_db) return null;
    return _safeArr(_db.products).find(p => p && p.slug === slug) || null;
  }

  /**
   * Busca produtos ativos pelo nome (case- e accent-insensitive).
   * @param {string} query
   * @param {number} [limit=8]
   */
  function searchProductsByName(query, limit) {
    const q = _normSlug(query).trim();
    if (!q) return [];
    const cap = typeof limit === 'number' && limit > 0 ? limit : 8;
    return getActiveProducts().filter(p => _normSlug(p.name).includes(q)).slice(0, cap);
  }

  function getProductPageUrl(slug) {
    if (!slug) return CONSTANTS.PRODUTO_PAGE;
    return CONSTANTS.PRODUTO_PAGE + '?slug=' + encodeURIComponent(slug);
  }

  function getBrand(brandId) { return _byId(_db && _db.brands, brandId); }
  function getCategory(catId) { return _byId(_db && _db.categories, catId); }

  /* ---------------------------------------------------------------
     Imagens
     --------------------------------------------------------------- */
  function getImagesForProduct(productId) {
    if (!_db) return [];
    return _safeArr(_db.productImages)
      .filter(img => img.productId === productId)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  function getMainImage(productId) {
    const imgs = getImagesForProduct(productId);
    return imgs.find(img => img.type === 'main') || imgs[0] || null;
  }

  function getGalleryImages(productId) {
    const imgs = getImagesForProduct(productId);
    return imgs.filter(img => img.type === 'gallery');
  }

  function getImagesForVariant(variant) {
    if (!_db || !variant) return [];
    const ids = _safeArr(variant.imageIds);
    return _safeArr(_db.productImages)
      .filter(img => ids.includes(img.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  /* ---------------------------------------------------------------
     Variantes & opções
     --------------------------------------------------------------- */
  function getVariantsForProduct(productId) {
    if (!_db) return [];
    return _safeArr(_db.variants).filter(v => v.productId === productId);
  }

  function getAvailableVariants(productId) {
    return getVariantsForProduct(productId).filter(v => {
      if (!v.availableForSale) return false;
      const inv = v.inventory || {};
      const localStock = _db && _db.settings && _db.settings.useLocalStockControl;
      if (localStock && inv.manageStock && (inv.quantity || 0) <= 0) return false;
      return true;
    });
  }

  function getMinPriceVariant(productId) {
    const variants = getAvailableVariants(productId);
    if (!variants.length) return null;
    return variants.reduce((min, v) => (
      !min || (v.pricing && min.pricing && v.pricing.price < min.pricing.price) ? v : min
    ), null);
  }

  /**
   * Devolve os grupos de opção (Sabor, Tamanho…) com seus valores,
   * já ordenados por position e relacionados ao produto.
   */
  function getOptionGroups(productId) {
    if (!_db) return [];
    const productOpts = _safeArr(_db.productOptions)
      .filter(po => po.productId === productId)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    return productOpts.map(po => {
      const type = _byId(_db.optionTypes, po.optionTypeId);
      // Apenas valores realmente usados pelas variantes do produto evitam mostrar
      // sabores/tamanhos cadastrados mas inexistentes para esse produto.
      const usedValueIds = new Set();
      getVariantsForProduct(productId).forEach(v => {
        _safeArr(v.optionValueIds).forEach(id => usedValueIds.add(id));
      });
      const values = _safeArr(_db.optionValues).filter(ov =>
        ov.optionTypeId === po.optionTypeId && usedValueIds.has(ov.id)
      );
      return { type, values };
    }).filter(g => g.type && g.values.length);
  }

  /**
   * Encontra a variação selecionada conforme a doc §12 (combinação exata
   * de optionValueIds entre os escolhidos pelo usuário).
   */
  function findVariantByOptionValueIds(productId, selectedIds) {
    const ids = [...selectedIds].sort();
    return getVariantsForProduct(productId).find(v => {
      const vIds = [..._safeArr(v.optionValueIds)].sort();
      if (vIds.length !== ids.length) return false;
      return ids.every((id, i) => id === vIds[i]);
    }) || null;
  }

  /* ---------------------------------------------------------------
     Checkout & SEO
     --------------------------------------------------------------- */
  function getCheckout(productId) {
    if (!_db) return null;
    return _safeArr(_db.productCheckout).find(c => c.productId === productId) || null;
  }

  function getSeo(productId) {
    if (!_db) return null;
    return _safeArr(_db.productSeo).find(s => s.productId === productId) || null;
  }

  /**
   * Monta o payload para o checkout da Shopify (doc §16).
   * Retorna apenas campos técnicos esperados pela Storefront API.
   */
  function buildShopifyCheckoutPayload(productId, selectedVariant, quantity) {
    if (!selectedVariant || !selectedVariant.shopify) return null;
    const checkout = getCheckout(productId);
    return {
      lines: [{
        merchandiseId: selectedVariant.shopify.merchandiseId,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        attributes: (checkout && _safeArr(checkout.lineAttributes)) || [],
      }],
    };
  }

  /* ===============================================================
     RENDERERS — terceira dobra (Energy Drink)
     ===============================================================
     Substituem o HTML hard-coded pela renderização dinâmica
     mantendo intacto o design system (classes/CSS originais).
     Quando o JSON ainda não tem produtos suficientes, vira para
     "1 card por variante" para preservar a riqueza visual do carrossel.
     =============================================================== */

  // Biblioteca de SVGs decorativos (latas estilizadas) — preservados
  // exatamente como nos cards originais, ciclados conforme o índice.
  const CAN_SVG_VARIANTS = [
    /* 0 — Lata solo */
    `<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cv0body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
        </linearGradient>
        <linearGradient id="cv0label" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(204,255,0,0.22)"/>
          <stop offset="100%" stop-color="rgba(204,255,0,0.08)"/>
        </linearGradient>
      </defs>
      <rect x="22" y="18" width="56" height="88" rx="10" fill="url(#cv0body)" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"/>
      <ellipse cx="50" cy="18" rx="28" ry="7" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      <ellipse cx="50" cy="106" rx="28" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <rect x="22" y="44" width="56" height="34" fill="url(#cv0label)" stroke="rgba(204,255,0,0.28)" stroke-width="0.8"/>
      <text x="50" y="57" text-anchor="middle" font-size="9" font-family="monospace" fill="rgba(204,255,0,0.90)" letter-spacing="3" font-weight="800">OFF</text>
      <text x="50" y="70" text-anchor="middle" font-size="5.5" font-family="monospace" fill="rgba(255,255,255,0.35)" letter-spacing="2">NUTRITION</text>
      <rect x="62" y="22" width="4" height="80" rx="2" fill="rgba(255,255,255,0.06)"/>
      <ellipse cx="50" cy="18" rx="16" ry="4" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
    </svg>`,
    /* 1 — Duo (uma frente + uma fundo) */
    `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cv1a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.03)"/>
        </linearGradient>
        <linearGradient id="cv1b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
        </linearGradient>
      </defs>
      <rect x="62" y="26" width="46" height="76" rx="9" fill="url(#cv1a)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
      <ellipse cx="85" cy="26" rx="23" ry="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" stroke-width="0.8"/>
      <ellipse cx="85" cy="102" rx="23" ry="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>
      <rect x="62" y="50" width="46" height="26" fill="rgba(204,255,0,0.07)" stroke="rgba(204,255,0,0.16)" stroke-width="0.7"/>
      <rect x="12" y="18" width="56" height="88" rx="10" fill="url(#cv1b)" stroke="rgba(255,255,255,0.20)" stroke-width="1.3"/>
      <ellipse cx="40" cy="18" rx="28" ry="7" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      <ellipse cx="40" cy="106" rx="28" ry="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <rect x="12" y="42" width="56" height="34" fill="rgba(204,255,0,0.16)" stroke="rgba(204,255,0,0.32)" stroke-width="0.8"/>
      <text x="40" y="55" text-anchor="middle" font-size="9" font-family="monospace" fill="rgba(204,255,0,0.95)" letter-spacing="3" font-weight="800">OFF</text>
      <text x="40" y="68" text-anchor="middle" font-size="5.5" font-family="monospace" fill="rgba(255,255,255,0.40)" letter-spacing="2">NUTRITION</text>
      <rect x="52" y="22" width="4" height="80" rx="2" fill="rgba(255,255,255,0.06)"/>
    </svg>`,
    /* 2 — Trio (duas atrás + uma frente maior) */
    `<svg viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cv2back" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.06)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.02)"/>
        </linearGradient>
        <linearGradient id="cv2front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
        </linearGradient>
      </defs>
      <rect x="4" y="28" width="42" height="72" rx="8" fill="url(#cv2back)" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
      <ellipse cx="25" cy="28" rx="21" ry="5.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" stroke-width="0.8"/>
      <ellipse cx="25" cy="100" rx="21" ry="5.5" fill="rgba(255,255,255,0.03)"/>
      <rect x="4" y="50" width="42" height="22" fill="rgba(204,255,0,0.06)" stroke="rgba(204,255,0,0.14)" stroke-width="0.7"/>
      <rect x="94" y="28" width="42" height="72" rx="8" fill="url(#cv2back)" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
      <ellipse cx="115" cy="28" rx="21" ry="5.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" stroke-width="0.8"/>
      <ellipse cx="115" cy="100" rx="21" ry="5.5" fill="rgba(255,255,255,0.03)"/>
      <rect x="94" y="50" width="42" height="22" fill="rgba(204,255,0,0.06)" stroke="rgba(204,255,0,0.14)" stroke-width="0.7"/>
      <rect x="42" y="16" width="56" height="90" rx="10" fill="url(#cv2front)" stroke="rgba(255,255,255,0.22)" stroke-width="1.4"/>
      <ellipse cx="70" cy="16" rx="28" ry="7.5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>
      <ellipse cx="70" cy="106" rx="28" ry="7.5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <rect x="42" y="40" width="56" height="36" fill="rgba(204,255,0,0.18)" stroke="rgba(204,255,0,0.36)" stroke-width="0.9"/>
      <text x="70" y="54" text-anchor="middle" font-size="9" font-family="monospace" fill="rgba(204,255,0,1)" letter-spacing="3" font-weight="800">OFF</text>
      <text x="70" y="67" text-anchor="middle" font-size="5.5" font-family="monospace" fill="rgba(255,255,255,0.45)" letter-spacing="2">NUTRITION</text>
      <rect x="82" y="20" width="4" height="82" rx="2" fill="rgba(255,255,255,0.07)"/>
    </svg>`,
  ];

  function _escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  /**
   * Resolve a label do badge superior do card (ex: "ACID LEMON · 600G").
   * Para 1 produto + N variantes: usa as opções da variante.
   * Para N produtos: usa o subtitle do produto.
   */
  function _badgeForVariant(variant) {
    if (!_db || !variant) return '';
    const labels = _safeArr(variant.optionValueIds)
      .map(id => _byId(_db.optionValues, id))
      .filter(Boolean)
      .map(ov => ov.value);
    return labels.join(' · ').toUpperCase();
  }

  /**
   * Constrói um item de carrossel da terceira dobra a partir de:
   *  - variantMode: 1 produto, várias variantes (cada variante = 1 card)
   *  - productMode: vários produtos (cada produto = 1 card)
   * Mantém EXATAMENTE a estrutura de classes do hard-coded original
   * para o CSS (.prod-card, .prod-card-img, .prod-card-body…) atuar.
   *
   * imageSrc/imageAlt: imagem main do produto (ou da variante). Se a `src`
   * do JSON falhar ao carregar (asset ainda não publicado), o `onerror`
   * cai para o fallback global (JOURNAL.png) e o card permanece bonito.
   */
  function _buildEnergyCardHTML({ idx, badge, name, desc, priceNow, priceOld, href, ariaLabel, ctaText, imageSrc, imageAlt }) {
    const oldHTML = priceOld
      ? `<span class="prod-price-label">De</span><span class="prod-price-original">${_escapeHTML(priceOld)}</span>`
      : '';
    const safeName = _escapeHTML(name);
    const safeDesc = _escapeHTML(desc || '');
    const safeBadge = _escapeHTML(badge || '');
    const safeCta = _escapeHTML(ctaText || 'Visualizar');
    const safeAria = _escapeHTML(ariaLabel || name);
    const safeHref = _escapeHTML(href || CONSTANTS.PRODUTO_PAGE);
    const safeImg  = _escapeHTML(imageSrc || CONSTANTS.FALLBACK_IMAGE);
    const safeImgAlt = _escapeHTML(imageAlt || name || 'Produto OFF Nutrition Lab');
    const fallback = CONSTANTS.FALLBACK_IMAGE;

    // Imagem do produto: <img> real envolto em .prod-card-icon (compatibilidade
    // total com o CSS atual). Em caso de falha de rede, cai para JOURNAL.png.
    const photoHTML = `
      <div class="prod-card-icon">
        <img class="prod-card-photo" src="${safeImg}" alt="${safeImgAlt}" loading="lazy"
             onerror="this.onerror=null;this.src='${fallback}';">
      </div>
    `;

    return `
      <article class="prod-card" role="listitem" aria-label="${safeAria}">
        <div class="prod-card-img">
          <span class="prod-img-badge">${safeBadge}</span>
          <div class="img-shimmer"></div>
          <div class="img-scanline"></div>
          <div class="img-glow"></div>
          ${photoHTML}
        </div>
        <div class="prod-card-body">
          <div class="prod-card-tag-row">
            <span class="prod-card-tag">${_escapeHTML((badge.split('·')[0] || '').trim() || 'OFF NUTRITION')}</span>
          </div>
          <h3 class="prod-card-name">${safeName}</h3>
          <div class="prod-card-accent"></div>
          <p class="prod-card-desc">${safeDesc}</p>
          <div class="prod-card-rule"></div>
          <div class="prod-card-price">
            ${oldHTML}
            <span class="prod-price-discount">${_escapeHTML(priceNow)}</span>
          </div>
          <a class="prod-card-cta" href="${safeHref}" role="button">
            ${safeCta}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </div>
      </article>
    `;
  }

  /**
   * Resolve a melhor imagem main para um determinado produto/variante.
   * Preferência:
   *   1. Se a variante tiver imageIds com type "main" → usa essa
   *   2. Imagem main do produto
   *   3. Primeira imagem (qualquer tipo) do produto
   *   4. Fallback global (JOURNAL.png)
   */
  function _resolveCardImage(product, variant) {
    if (variant) {
      const variantImgs = getImagesForVariant(variant);
      const main = variantImgs.find(i => i.type === 'main') || variantImgs[0];
      if (main) return main;
    }
    const main = getMainImage(product.id);
    if (main) return main;
    return null;
  }

  /**
   * Atualiza o cabeçalho da terceira dobra com base na categoria resolvida:
   *   - Eyebrow: "OFF NUTRITION LAB · {CATEGORY_NAME}"
   *   - Título:  "Escolha seu {category.name}" (com a palavra em destaque)
   * Aceita IDs opcionais — se algum elemento não existir, é ignorado.
   */
  function renderEnergyDrinkHeader(category, { eyebrowEl, titleEl } = {}) {
    if (!category) return;
    const upper = (category.name || '').toUpperCase();

    if (eyebrowEl) {
      // Mantém o ponto decorativo se ele estiver dentro do eyebrow.
      const dot = eyebrowEl.querySelector('.prod-eyebrow-dot');
      const textHolder = eyebrowEl.querySelector('#prodEyebrowText') || (() => {
        eyebrowEl.innerHTML = '';
        if (dot) eyebrowEl.appendChild(dot);
        else eyebrowEl.insertAdjacentHTML('afterbegin', '<span class="prod-eyebrow-dot" aria-hidden="true"></span>');
        const span = document.createElement('span');
        span.id = 'prodEyebrowText';
        eyebrowEl.appendChild(span);
        return span;
      })();
      textHolder.textContent = `OFF NUTRITION LAB · ${upper}`;
    }

    if (titleEl) {
      // Padrão visual: "Escolha seu <span>{name}</span>" — span recebe o acid color.
      titleEl.innerHTML = `Escolha seu <span>${_escapeHTML(category.name || '')}</span>`;
    }
  }

  /**
   * Renderiza o carrossel da terceira dobra (Energy Drink).
   * Estratégia de busca, em ordem:
   *   1. categoryId fixo (CONSTANTS.ENERGY_DRINK_CATEGORY_ID) — fonte primária
   *   2. Nome canônico ("Energy Drink", "Energy Dust") — backup
   *   3. Slug alternativo ("energy-drink", "suplementos") — backup
   * Mantém o hard-coded como fallback se nada for encontrado.
   */
  function renderEnergyDrinkCarousel({ trackEl, dotsEl, eyebrowEl, titleEl } = {}) {
    if (!_db || !trackEl) return false;

    // 1) Tentativa primária: categoryId direto
    let category = getCategoryById(CONSTANTS.ENERGY_DRINK_CATEGORY_ID);
    let products = category ? getProductsByCategoryId(category.id) : [];

    // 2) Fallback: nome / slug
    if (!products.length) {
      products = getProductsByCategoryNamesOrSlugs(
        CONSTANTS.ENERGY_DRINK_CATEGORY_NAMES,
        CONSTANTS.ENERGY_DRINK_CATEGORY_SLUGS
      );
      if (products.length) category = getCategory(products[0].categoryId);
    }

    if (!products.length) {
      console.info('[OffStore] Nenhum produto encontrado na categoria Energy Drink (id ' +
        CONSTANTS.ENERGY_DRINK_CATEGORY_ID + '). Mantendo cards estáticos.');
      return false;
    }

    console.info('[OffStore] Renderizando ' + products.length + ' produto(s) na categoria "' + (category && category.name) + '".');

    // Atualiza o cabeçalho da seção com o nome real da categoria
    renderEnergyDrinkHeader(category, { eyebrowEl, titleEl });

    // Estratégia simples e determinística: 1 card por produto da categoria,
    // exatamente como pedido. Para cada produto:
    //   - busca a variante de menor preço disponível para extrair pricing
    //   - usa o nome, shortDescription e a imagem main do produto
    //   - faz fallback para preço "sob consulta" se não houver variante válida
    const cards = [];

    products.forEach((product, i) => {
      const minVariant = getMinPriceVariant(product.id);
      const pricing = (minVariant && minVariant.pricing) ? minVariant.pricing : null;

      // Preço novo / preço antigo formatados em BRL.
      let priceNow = '';
      let priceOld = null;
      if (pricing) {
        priceNow = pricing.displayPrice || formatBRL(pricing.price);
        if (pricing.compareAtPrice && pricing.compareAtPrice > pricing.price) {
          priceOld = pricing.displayCompareAtPrice || formatBRL(pricing.compareAtPrice);
        }
      } else {
        priceNow = 'Sob consulta';
      }

      const checkout = getCheckout(product.id);
      const ctaText = (checkout && checkout.cartButtonText) || 'Visualizar';

      // Badge visual: usa subtitle do produto ou nome da categoria.
      const badge = (product.subtitle || (category && category.name) || 'OFF NUTRITION').toUpperCase();

      // Imagem main do produto (com fallback para variante e depois JOURNAL.png)
      const cardImg = _resolveCardImage(product, null);

      cards.push(_buildEnergyCardHTML({
        idx: i,
        badge,
        name: product.name,
        desc: product.shortDescription || '',
        priceNow,
        priceOld,
        ariaLabel: product.name,
        ctaText,
        href: `${CONSTANTS.PRODUTO_PAGE}?slug=${encodeURIComponent(product.slug)}`,
        imageSrc: cardImg ? cardImg.src : '',
        imageAlt: cardImg ? cardImg.alt : product.name,
      }));
    });

    if (!cards.length) return false;

    trackEl.innerHTML = cards.join('');

    // Re-gerar dots de paginação coerentes com o novo número de cards
    if (dotsEl) {
      const totalCards = trackEl.querySelectorAll('.prod-card').length;
      dotsEl.innerHTML = '';
      for (let i = 0; i < totalCards; i++) {
        const dot = document.createElement('div');
        dot.className = 'prod-dot' + (i === 0 ? ' is-active' : '');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('data-idx', String(i));
        dot.setAttribute('aria-label', `Item ${i + 1}`);
        dotsEl.appendChild(dot);
      }
      // Esconde dots se houver apenas 1 card.
      dotsEl.style.display = totalCards <= 1 ? 'none' : '';
    }

    return true;
  }

  /* ===============================================================
     RENDERER — quinta dobra (Vestuário/ONLAB)
     =============================================================== */

  function _buildOnlabModelCardHTML({ image, alt, index }) {
    const safeImg = _escapeHTML(image || CONSTANTS.FALLBACK_IMAGE);
    const safeAlt = _escapeHTML(alt || 'Modelo vestindo coleção ONLAB');
    const safeHref = _escapeHTML(CONSTANTS.COLECAO_VESTUARIO_URL);
    const lookNum = String(index + 1).padStart(2, '0');
    const safeAria = _escapeHTML(`Ver coleção completa ONLAB — look ${lookNum}`);

    return `
      <a class="onlab-card onlab-card--model" role="listitem" aria-label="${safeAria}" href="${safeHref}">
        <div class="onlab-card-img">
          <img src="${safeImg}" alt="${safeAlt}" loading="lazy" onerror="this.src='${CONSTANTS.FALLBACK_IMAGE}'">
        </div>
        <div class="onlab-shimmer" aria-hidden="true"></div>
        <span class="onlab-card-badge">ONLAB · ${lookNum}</span>
        <div class="onlab-card-fade" aria-hidden="true"></div>
        <div class="onlab-card-content">
          <span class="onlab-card-tag">Performance Wear · OFF Nutrition</span>
          <h3 class="onlab-card-name">Coleção ONLAB</h3>
          <div class="onlab-card-accent"></div>
          <p class="onlab-card-tagline">Treine com identidade. Caimento premium e estilo que entrega presença.</p>
          <span class="onlab-card-arrow">
            Ver coleção completa
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </span>
        </div>
      </a>
    `;
  }

  /**
   * Renderiza o carrossel da quinta dobra (ONLAB) com fotos de modelos
   * (assets/raw_files/modelos). Não usa produtos do JSON — todos os cliques
   * levam à página da coleção completa de vestuário.
   */
  function renderApparelCarousel({ trackEl } = {}) {
    if (!trackEl) return false;

    const models = _safeArr(CONSTANTS.ONLAB_MODEL_IMAGES);
    if (!models.length) return false;

    const cards = models.map((model, index) =>
      _buildOnlabModelCardHTML({
        image: model.src,
        alt: model.alt,
        index,
      })
    );

    trackEl.innerHTML = cards.join('') + cards.join('');
    return true;
  }

  /* ---------------------------------------------------------------
     API pública
     --------------------------------------------------------------- */
  global.OffStore = {
    CONSTANTS,
    load,
    isReady,
    getDB,
    formatBRL,

    getCategoryBySlug,
    getCategoryByName,
    getCategoryById,
    getActiveProducts,
    getProductsByCategoryId,
    getProductsByCategorySlug,
    getProductsByCategoryName,
    getProductsByAnyCategorySlug,
    getProductsByCategoryNamesOrSlugs,
    getProductBySlug,
    searchProductsByName,
    getProductPageUrl,
    getBrand,
    getCategory,

    getImagesForProduct,
    getMainImage,
    getGalleryImages,
    getImagesForVariant,

    getVariantsForProduct,
    getAvailableVariants,
    getMinPriceVariant,
    getOptionGroups,
    findVariantByOptionValueIds,

    getCheckout,
    getSeo,
    buildShopifyCheckoutPayload,

    renderEnergyDrinkCarousel,
    renderEnergyDrinkHeader,
    renderApparelCarousel,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateAccountOrdersLinks);
  } else {
    hydrateAccountOrdersLinks();
  }
})(window);
