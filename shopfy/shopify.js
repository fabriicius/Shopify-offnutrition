/* =====================================================================
 * OFF NUTRITION LAB — Shopify Storefront API Adapter
 * ---------------------------------------------------------------------
 * Camada genérica e reutilizável que centraliza TODA a comunicação
 * com a Shopify Storefront API.
 *
 * Responsabilidades:
 *   - Carregar a configuração da loja a partir do JSON local
 *     (jsondb/off-products-database.json):
 *       store.shopifyDomain, store.storefrontAccessToken,
 *       store.apiVersion (opcional — defaulta para API estável atual)
 *   - Executar queries / mutations GraphQL contra:
 *       https://{shopifyDomain}/api/{apiVersion}/graphql.json
 *     usando o header `X-Shopify-Storefront-Access-Token`.
 *   - Tratar erros de rede, GraphQL e userErrors da Shopify.
 *   - Retornar apenas `json.data` para os demais arquivos.
 *
 * API pública:
 *   window.OffShopify.loadShopifyConfig()      → Promise<config>
 *   window.OffShopify.shopifyFetch(query, vars) → Promise<data>
 *
 * Também expõe aliases globais sem namespace, conforme o brief:
 *   window.loadShopifyConfig()
 *   window.shopifyFetch(query, vars)
 *
 * Pré-condição: incluir este arquivo ANTES de `cart.js` e `products.js`.
 *
 * Importante:
 *   - Não altera layout, CSS, animações ou design system existente.
 *   - Não substitui `OffStore` (off-store.js) nem `OffCart` (cart-drawer.js).
 *   - Atua apenas como camada de integração com a Shopify.
 * ===================================================================== */
(function (global) {
  'use strict';

  if (global.OffShopify && global.OffShopify.__initialized) return;

  // ---------------------------------------------------------------
  // Constantes
  // ---------------------------------------------------------------
  const CONFIG_URL = './jsondb/off-products-database.json';
  // Versão usada quando o JSON não trouxer `store.apiVersion`.
  // Pode ser sobrescrita via JSON sem mexer em código.
  const DEFAULT_API_VERSION = '2024-10';

  // ---------------------------------------------------------------
  // Estado interno
  // ---------------------------------------------------------------
  let _config = null;
  let _configPromise = null;

  // ---------------------------------------------------------------
  // Helpers de leitura do JSON local
  // (mesma estratégia robusta usada em off-store.js: fetch → XHR fallback)
  // ---------------------------------------------------------------
  function _isFileProtocol() {
    return typeof window !== 'undefined'
      && window.location
      && window.location.protocol === 'file:';
  }

  function _readJSONViaFetch(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ao carregar ' + url);
      return res.json();
    });
  }

  function _readJSONViaXHR(url) {
    return new Promise(function (resolve, reject) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'json';
        xhr.onload = function () {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            try {
              const data = xhr.response || JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) { reject(e); }
          } else {
            reject(new Error('XHR HTTP ' + xhr.status));
          }
        };
        xhr.onerror = function () { reject(new Error('Falha de rede ao ler JSON local.')); };
        xhr.send();
      } catch (e) { reject(e); }
    });
  }

  function _readJSON(url) {
    if (_isFileProtocol()) {
      console.warn('[Shopify] Site aberto via file://. Browsers modernos bloqueiam fetch local; sirva via HTTP para garantir a leitura do JSON.');
    }
    return _readJSONViaFetch(url).catch(function (err) {
      console.warn('[Shopify] fetch falhou (' + err.message + '). Tentando XHR como fallback…');
      return _readJSONViaXHR(url);
    });
  }

  // ---------------------------------------------------------------
  // loadShopifyConfig()
  // ---------------------------------------------------------------
  /**
   * Carrega o JSON da loja e devolve as configurações + listas usadas
   * pela camada de integração. O resultado fica cacheado.
   *
   * Estrutura de retorno:
   *   {
   *     shopifyDomain, storefrontAccessToken, apiVersion,
   *     currency, locale, cartStorageKey, useShopifyCheckout,
   *     products, variants, productImages, productCheckout,
   *     productOptions, optionTypes, optionValues,
   *     categories, brands,
   *     raw   // JSON original completo
   *   }
   */
  function loadShopifyConfig() {
    if (_config) return Promise.resolve(_config);
    if (_configPromise) return _configPromise;

    _configPromise = _readJSON(CONFIG_URL).then(function (json) {
      if (!json || typeof json !== 'object') {
        throw new Error('JSON de configuração inválido.');
      }

      const store = json.store || {};
      const settings = json.settings || {};

      _config = {
        shopifyDomain: _normalizeDomain(store.shopifyDomain),
        storefrontAccessToken: String(store.storefrontAccessToken || '').trim(),
        apiVersion: String(store.apiVersion || settings.apiVersion || DEFAULT_API_VERSION).trim(),
        currency: store.currency || 'BRL',
        locale: store.locale || 'pt-BR',
        cartStorageKey: settings.cartStorageKey || 'off_cart',
        useShopifyCheckout: settings.useShopifyCheckout !== false,

        products: Array.isArray(json.products) ? json.products : [],
        variants: Array.isArray(json.variants) ? json.variants : [],
        productImages: Array.isArray(json.productImages) ? json.productImages : [],
        productCheckout: Array.isArray(json.productCheckout) ? json.productCheckout : [],
        productOptions: Array.isArray(json.productOptions) ? json.productOptions : [],
        optionTypes: Array.isArray(json.optionTypes) ? json.optionTypes : [],
        optionValues: Array.isArray(json.optionValues) ? json.optionValues : [],
        categories: Array.isArray(json.categories) ? json.categories : [],
        brands: Array.isArray(json.brands) ? json.brands : [],

        raw: json,
      };

      console.info(
        '[Shopify] Config carregada: ' + (_config.shopifyDomain || '(domínio ausente)') +
        ' · API ' + _config.apiVersion +
        ' · ' + _config.products.length + ' produto(s).'
      );
      return _config;
    }).catch(function (err) {
      _configPromise = null;
      console.error('[Shopify] Falha ao carregar a configuração local:', err);
      throw err;
    });

    return _configPromise;
  }

  // ---------------------------------------------------------------
  // Normalização do domínio (remove protocolo e barras finais apenas)
  // ---------------------------------------------------------------
  /**
   * Extrai somente o host a partir do valor em store.shopifyDomain.
   * Aceita:
   *   "https://offnutrition.com.br/"   → "offnutrition.com.br"
   *   "offnutrition.com.br"            → "offnutrition.com.br"
   *   " offnutrition.com.br "          → "offnutrition.com.br"
   * Não acrescenta nem substitui nada — o domínio vem intacto do JSON.
   */
  function _normalizeDomain(raw) {
    let d = String(raw || '').trim();
    if (!d) return '';
    d = d.replace(/^https?:\/\//i, '').replace(/\/+$/, '').split('/')[0];
    return d;
  }

  function _validateConfig(cfg) {
    if (!cfg) throw new Error('[Shopify] Configuração ausente.');
    if (!cfg.shopifyDomain) {
      throw new Error('[Shopify] store.shopifyDomain ausente no JSON.');
    }
    if (!cfg.storefrontAccessToken || /COLOQUE_AQUI/i.test(cfg.storefrontAccessToken)) {
      throw new Error('[Shopify] store.storefrontAccessToken não configurado no JSON.');
    }
    if (!cfg.apiVersion) {
      throw new Error('[Shopify] store.apiVersion ausente no JSON.');
    }
  }

  /**
   * Monta a URL do endpoint a partir dos três campos do JSON:
   *   store.shopifyDomain        → host
   *   store.apiVersion           → versão da API
   * Resultado: https://{shopifyDomain}/api/{apiVersion}/graphql.json
   */
  function _endpoint(cfg) {
    return 'https://' + cfg.shopifyDomain + '/api/' + cfg.apiVersion + '/graphql.json';
  }

  /**
   * Diagnóstico legível quando o fetch falha sem resposta HTTP
   * (CORS, DNS, bloqueador de rede, file://, etc.).
   */
  function _buildNetworkErrorHints(cfg, url) {
    const origin = (window.location && window.location.origin) || '(origem desconhecida)';
    const lines = [
      '• URL chamada: ' + url,
      '• Origem do site: ' + origin,
    ];
    if (_isFileProtocol()) {
      lines.push('• Site aberto via file://. Navegadores bloqueiam CORS nesse modo.');
      lines.push('  → Sirva o projeto via HTTP: npx http-server . -p 5500');
    } else {
      lines.push('• Verifique se a origem "' + origin + '" tem CORS liberado no Shopify Admin');
      lines.push('  (Apps → Headless / Hydrogen → Storefront API → allowed origins).');
      lines.push('• Verifique se o domínio "' + cfg.shopifyDomain + '" está correto e acessível.');
      lines.push('• Verifique se há extensão/firewall bloqueando a requisição.');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------
  // shopifyFetch(query, variables)
  // ---------------------------------------------------------------
  /**
   * Executa uma query/mutation GraphQL contra a Storefront API e
   * devolve apenas `json.data`. Lança erro descritivo em:
   *   - falha de rede
   *   - HTTP != 2xx
   *   - JSON inválido
   *   - presença de `errors` (GraphQL)
   *
   * Os `userErrors` específicos de mutations (ex: cartCreate) ficam
   * a cargo do consumidor (cart.js), pois fazem parte de `data`.
   */
  async function shopifyFetch(query, variables) {
    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('[Shopify] shopifyFetch: query GraphQL ausente.');
    }
    const cfg = await loadShopifyConfig();
    _validateConfig(cfg);

    const url = _endpoint(cfg);
    const body = JSON.stringify({
      query: query,
      variables: variables && typeof variables === 'object' ? variables : {},
    });

    // Log dos três valores lidos do JSON antes do fetch.
    console.info(
      '[Shopify] shopifyFetch' +
      '\n  → shopifyDomain: '         + cfg.shopifyDomain +
      '\n  → apiVersion: '            + cfg.apiVersion +
      '\n  → storefrontAccessToken: ' + cfg.storefrontAccessToken.slice(0, 6) + '••••' +
      '\n  → endpoint: '              + url
    );

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Shopify-Storefront-Access-Token': cfg.storefrontAccessToken,
        },
        body: body,
      });
    } catch (err) {
      // "Failed to fetch" / TypeError do fetch é genérico: pode ser
      // CORS, DNS, domínio errado, file:// como origem etc. Damos um
      // diagnóstico explícito conforme o cenário mais provável.
      const baseMsg = (err && err.message) ? err.message : String(err);
      const hints = _buildNetworkErrorHints(cfg, url);
      console.error('[Shopify] Falha de rede ao chamar ' + url + '\n→ ' + baseMsg + '\n' + hints);
      throw new Error('[Shopify] Erro de rede ao chamar a Storefront API: ' + baseMsg +
        '\n\nProváveis causas:\n' + hints);
    }

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) { /* noop */ }
      throw new Error('[Shopify] HTTP ' + res.status + ' na Storefront API. ' +
        (detail ? 'Detalhe: ' + detail.slice(0, 240) : ''));
    }

    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('[Shopify] Resposta inválida (JSON malformado).');
    }

    if (json && Array.isArray(json.errors) && json.errors.length) {
      const msg = json.errors.map(function (e) { return e.message; }).join(' | ');
      throw new Error('[Shopify] Erro(s) GraphQL: ' + msg);
    }

    if (!json || !json.data) {
      throw new Error('[Shopify] Resposta sem campo "data".');
    }

    return json.data;
  }

  // ---------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------
  global.OffShopify = {
    __initialized: true,
    loadShopifyConfig: loadShopifyConfig,
    shopifyFetch: shopifyFetch,
    get config() { return _config; },
  };

  // Aliases globais (conforme o brief)
  global.loadShopifyConfig = loadShopifyConfig;
  global.shopifyFetch = shopifyFetch;
})(typeof window !== 'undefined' ? window : globalThis);
