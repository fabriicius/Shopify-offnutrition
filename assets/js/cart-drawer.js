/* =====================================================================
 * OFF NUTRITION LAB — Cart Drawer
 * ---------------------------------------------------------------------
 * Side drawer compartilhado entre index.html e produto.html.
 * - Painel branco fixo deslizando da direita (38vw desktop / 100vw mobile)
 * - Overlay escuro com backdrop-filter blur (bloqueia interação de fundo)
 * - Estado persistido em localStorage (chave `off_cart`)
 * - API global `window.OffCart`:
 *     OffCart.open()
 *     OffCart.close()
 *     OffCart.toggle()
 *     OffCart.add(item)         // {id, productId, variantId, name, subtitle, image, price, qty}
 *     OffCart.remove(id)
 *     OffCart.updateQty(id, delta)
 *     OffCart.clear()
 *     OffCart.getItems()
 *     OffCart.getCount()
 *     OffCart.getTotal()
 *
 * Auto-init: anexa listeners a qualquer elemento `[data-cart-open]`,
 * mantém o badge `.js-cart-count` sincronizado.
 *
 * Design system: tokens --acid, --bg-deep, --ease-out, fontes Inter/
 * Bricolage Grotesque/JetBrains Mono.
 * ===================================================================== */
(function () {
  'use strict';

  if (window.OffCart) return; // singleton

  // ---------- Constantes ----------
  const STORAGE_KEY = 'off_cart';
  const FALLBACK_IMG = './assets/raw_files/JOURNAL.png';

  // ---------- Estado ----------
  let state = {
    items: [], // { id, productId, variantId, name, subtitle, image, price, qty, slug }
    isOpen: false,
  };

  // ---------- Utils ----------
  function formatBRL(value) {
    if (typeof value !== 'number' || !isFinite(value)) value = 0;
    try {
      return value.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
      });
    } catch (e) {
      return 'R$ ' + value.toFixed(2).replace('.', ',');
    }
  }
  function safe(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function uid() {
    return 'ci_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Persistência ----------
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
    } catch (e) { /* storage cheio / privado */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        state.items = parsed.items.filter(it => it && it.id && typeof it.qty === 'number');
      }
    } catch (e) { /* json inválido */ }
  }

  // ---------- CSS ----------
  function injectStyles() {
    if (document.getElementById('off-cart-styles')) return;
    const css = `
/* =====================================================================
 * OFF Cart Drawer — estilos
 * ===================================================================== */
.off-cart-overlay,
.off-cart-panel {
  --acid: #ccff00;
  --acid-soft: rgba(204, 255, 0, 0.12);
  --ink-0: #050505;
  --ink-1: #0a0a0a;
  --ink-2: #1a1a1a;
  --line: rgba(0, 0, 0, 0.08);
  --line-strong: rgba(0, 0, 0, 0.14);
  --text-primary: #050505;
  --text-secondary: #525252;
  --text-tertiary: #737373;
  --r-pill: 999px;
  --r-card: 18px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-elastic: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-core: cubic-bezier(0.2, 0.8, 0.2, 1);
  --f-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --f-sans: 'Inter', system-ui, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
}

/* ── OVERLAY ─────────────────────────────────────────────── */
.off-cart-overlay {
  position: fixed; inset: 0;
  background: rgba(5, 5, 5, 0.55);
  backdrop-filter: blur(6px) saturate(1.1);
  -webkit-backdrop-filter: blur(6px) saturate(1.1);
  z-index: 9998;
  opacity: 0;
  visibility: hidden;
  transition: opacity .45s var(--ease-out), visibility 0s linear .45s;
  cursor: pointer;
}
.off-cart-overlay.is-open {
  opacity: 1;
  visibility: visible;
  transition: opacity .45s var(--ease-out), visibility 0s linear 0s;
}

/* ── PAINEL ──────────────────────────────────────────────── */
.off-cart-panel {
  position: fixed; top: 0; right: 0;
  width: 38vw;
  min-width: 380px;
  max-width: 520px;
  height: 100vh;
  background: #ffffff;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  box-shadow:
    -24px 0 60px rgba(5, 5, 5, 0.35),
    -2px 0 0 rgba(0, 0, 0, 0.04);
  transform: translateX(100%);
  transition: transform .55s var(--ease-out);
  font-family: var(--f-sans);
  color: var(--text-primary);
  will-change: transform;
}
.off-cart-panel.is-open { transform: translateX(0%); }

/* Acent line (acid) no topo do painel */
.off-cart-panel::before {
  content: "";
  position: absolute; left: 0; right: 0; top: 0; height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--acid) 35%, var(--acid) 65%, transparent 100%);
  opacity: 0;
  transform: scaleX(.4);
  transform-origin: 50% 50%;
  transition: opacity .8s var(--ease-out) .15s, transform 1s var(--ease-out) .15s;
}
.off-cart-panel.is-open::before { opacity: 1; transform: scaleX(1); }

/* ── HEADER ──────────────────────────────────────────────── */
.off-cart-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--line);
}
.off-cart-title {
  margin: 0;
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 20px;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}
.off-cart-title .dot {
  display: inline-block;
  width: 6px; height: 6px;
  margin: 0 8px 2px;
  border-radius: 50%;
  background: var(--acid);
  vertical-align: middle;
  box-shadow: 0 0 10px var(--acid);
}
.off-cart-close {
  position: absolute; top: 50%; right: 18px;
  transform: translateY(-50%);
  width: 36px; height: 36px;
  display: grid; place-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-primary);
  transition: background .25s ease, border-color .25s ease, transform .35s var(--ease-out);
}
.off-cart-close:hover {
  background: rgba(0, 0, 0, 0.05);
  border-color: var(--line-strong);
  transform: translateY(-50%) rotate(90deg);
}
.off-cart-close svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }

/* Eyebrow opcional sob o título */
.off-cart-eyebrow {
  position: absolute; left: 50%; bottom: -14px;
  transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  white-space: nowrap;
}
.off-cart-eyebrow b { color: var(--text-primary); font-weight: 600; }

/* ── BODY ────────────────────────────────────────────────── */
.off-cart-body {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 22px 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.18) transparent;
}
.off-cart-body::-webkit-scrollbar { width: 6px; }
.off-cart-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 9999px; }
.off-cart-body::-webkit-scrollbar-track { background: transparent; }

/* ── EMPTY STATE ─────────────────────────────────────────── */
.off-cart-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  text-align: center;
  padding: 40px 28px;
  animation: offCartFadeIn .6s var(--ease-out);
}
.off-cart-empty-icon {
  width: 56px; height: 56px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: #f6f6f6;
  border: 1px solid var(--line);
  position: relative;
  transition: transform .5s var(--ease-out);
}
.off-cart-empty-icon::before {
  content: "";
  position: absolute; inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--acid-soft), transparent 70%);
  opacity: 0;
  transition: opacity .6s ease;
}
.off-cart-empty:hover .off-cart-empty-icon::before { opacity: 1; }
.off-cart-empty-icon svg {
  width: 26px; height: 26px;
  stroke: var(--text-primary); fill: none; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round;
}
.off-cart-empty-text {
  font-family: var(--f-sans);
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  letter-spacing: -0.005em;
}
.off-cart-empty-cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 22px;
  background: var(--acid);
  color: var(--ink-0);
  border: none;
  border-radius: var(--r-pill);
  font-family: var(--f-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  transition: transform .35s var(--ease-out), box-shadow .35s ease;
  box-shadow: 0 0 0 0 rgba(204, 255, 0, 0);
}
.off-cart-empty-cta:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 30px -10px rgba(204, 255, 0, 0.55),
    0 0 0 1px rgba(0, 0, 0, 0.1) inset;
}
.off-cart-empty-cta::after {
  content: "";
  position: absolute;
  top: 0; left: -120%;
  width: 60%; height: 100%;
  background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
  transition: left .8s var(--ease-out);
}
.off-cart-empty-cta:hover::after { left: 140%; }
.off-cart-empty-cta svg {
  width: 12px; height: 12px;
  stroke: var(--ink-0); fill: none; stroke-width: 2.2;
  stroke-linecap: round; stroke-linejoin: round;
}

/* ── ITEM LIST ───────────────────────────────────────────── */
.off-cart-list {
  list-style: none;
  margin: 0; padding: 0;
  display: flex; flex-direction: column;
  gap: 14px;
}
.off-cart-item {
  display: grid;
  grid-template-columns: 78px 1fr auto;
  gap: 14px;
  padding: 14px;
  background: #fafafa;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  position: relative;
  transition: border-color .35s ease, transform .4s var(--ease-out), box-shadow .4s ease;
  animation: offCartItemIn .5s var(--ease-out) both;
}
.off-cart-item:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -14px rgba(5,5,5,0.18);
}
.off-cart-item-img {
  width: 78px; height: 78px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--line);
  overflow: hidden;
  display: grid; place-items: center;
  position: relative;
}
.off-cart-item-img::before {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 50% 0%, var(--acid-soft) 0%, transparent 60%);
  opacity: 0;
  transition: opacity .4s ease;
}
.off-cart-item:hover .off-cart-item-img::before { opacity: 0.8; }
.off-cart-item-img img {
  width: 86%; height: 86%;
  object-fit: contain;
  transition: transform .55s var(--ease-out);
}
.off-cart-item:hover .off-cart-item-img img { transform: scale(1.08); }

.off-cart-item-info {
  display: flex; flex-direction: column; justify-content: center;
  gap: 4px;
  min-width: 0;
}
.off-cart-item-name {
  margin: 0;
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 14.5px;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.off-cart-item-sub {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  margin: 0;
}
.off-cart-item-qty {
  margin-top: 4px;
  display: inline-flex; align-items: center;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--r-pill);
  padding: 2px;
  width: max-content;
}
.off-cart-item-qty button {
  width: 22px; height: 22px;
  display: grid; place-items: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-primary);
  transition: background .25s ease, color .25s ease;
}
.off-cart-item-qty button:hover { background: var(--ink-0); color: var(--acid); }
.off-cart-item-qty button:disabled { opacity: 0.35; cursor: not-allowed; }
.off-cart-item-qty button svg { width: 10px; height: 10px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; }
.off-cart-item-qty-val {
  min-width: 22px;
  text-align: center;
  font-family: var(--f-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.off-cart-item-side {
  display: flex; flex-direction: column;
  align-items: flex-end; justify-content: space-between;
  gap: 8px;
}
.off-cart-item-price {
  font-family: var(--f-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.005em;
  white-space: nowrap;
}
.off-cart-item-remove {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 26px; height: 26px;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  transition: color .25s ease, background .25s ease, transform .35s var(--ease-out);
}
.off-cart-item-remove:hover {
  color: #b00020;
  background: rgba(176, 0, 32, 0.08);
  transform: rotate(8deg) scale(1.05);
}
.off-cart-item-remove svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }

/* ── FOOTER ──────────────────────────────────────────────── */
.off-cart-footer {
  flex: 0 0 auto;
  padding: 16px 22px 22px;
  border-top: 1px solid var(--line);
  background: #fff;
  position: relative;
}
.off-cart-footer::before {
  content: ""; position: absolute; top: 0; left: 16px; right: 16px; height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--acid) 50%, transparent 100%);
  opacity: 0.55;
}
.off-cart-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}
.off-cart-summary-label {
  display: flex; flex-direction: column; gap: 2px;
}
.off-cart-summary-label span {
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.off-cart-summary-label small {
  font-family: var(--f-sans);
  font-size: 11px;
  color: var(--text-secondary);
}
.off-cart-total {
  font-family: var(--f-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
.off-cart-checkout {
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 14px 22px;
  background: var(--ink-0);
  color: var(--acid);
  border: 1px solid var(--ink-0);
  border-radius: var(--r-pill);
  font-family: var(--f-mono);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: background .3s ease, color .3s ease, transform .35s var(--ease-out), box-shadow .35s ease;
}
.off-cart-checkout:hover {
  background: var(--acid);
  color: var(--ink-0);
  transform: translateY(-1px);
  box-shadow: 0 18px 36px -14px rgba(204, 255, 0, 0.45);
}
.off-cart-checkout svg {
  width: 14px; height: 14px;
  stroke: currentColor; fill: none; stroke-width: 2.2;
  stroke-linecap: round; stroke-linejoin: round;
  transition: transform .4s var(--ease-out);
}
.off-cart-checkout:hover svg { transform: translateX(3px); }

.off-cart-clear {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-tertiary);
  font-family: var(--f-mono);
  font-size: 9.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 4px 0;
  transition: color .25s ease;
}
.off-cart-clear:hover { color: var(--text-primary); }
.off-cart-clear svg { width: 10px; height: 10px; stroke: currentColor; fill: none; stroke-width: 2; }

/* Container do total e itens */
.off-cart-meta-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--line);
}
.off-cart-meta-row span {
  font-family: var(--f-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}
.off-cart-meta-row b {
  font-family: var(--f-mono);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.005em;
}

/* ── Toast / feedback ao adicionar ──────────────────────── */
.off-cart-toast {
  position: fixed;
  right: 22px; bottom: 22px;
  background: rgba(5, 5, 5, 0.92);
  color: #fff;
  border: 1px solid rgba(204, 255, 0, 0.35);
  border-radius: 12px;
  padding: 10px 16px;
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  display: flex; align-items: center; gap: 8px;
  z-index: 10000;
  opacity: 0;
  transform: translateY(20px) scale(.95);
  transition: opacity .4s var(--ease-out), transform .5s var(--ease-elastic);
  pointer-events: none;
  backdrop-filter: blur(8px);
}
.off-cart-toast.is-show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.off-cart-toast .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--acid); box-shadow: 0 0 10px var(--acid); }

/* ── Mobile ──────────────────────────────────────────────── */
@media (max-width: 768px) {
  .off-cart-panel {
    width: 100vw;
    min-width: 0;
    max-width: none;
  }
  .off-cart-header { padding: 18px 18px 14px; }
  .off-cart-body { padding: 18px 16px 12px; }
  .off-cart-footer { padding: 14px 16px 18px; }
  .off-cart-item { grid-template-columns: 64px 1fr auto; padding: 12px; }
  .off-cart-item-img { width: 64px; height: 64px; }
}

/* ── Body lock quando aberto ─────────────────────────────── */
body.off-cart-locked {
  overflow: hidden;
  /* evita pulo da scrollbar */
  padding-right: var(--off-cart-sb, 0px);
}

/* ── Animações ───────────────────────────────────────────── */
@keyframes offCartFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes offCartItemIn {
  from { opacity: 0; transform: translateY(10px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}

/* ── Reduce motion ───────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .off-cart-overlay,
  .off-cart-panel,
  .off-cart-empty,
  .off-cart-item,
  .off-cart-toast {
    transition-duration: .15s !important;
    animation: none !important;
  }
  .off-cart-empty-cta::after { transition: none; }
}

/* ── Botão do header (badge contador) ────────────────────── */
.js-cart-count {
  font-family: inherit;
  display: inline-block;
  min-width: 0.7em;
  text-align: center;
}
`;
    const style = document.createElement('style');
    style.id = 'off-cart-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- DOM ----------
  let overlayEl = null;
  let panelEl = null;
  let bodyEl = null;
  let itemsCountEl = null;

  function buildDOM() {
    if (document.getElementById('offCartOverlay')) {
      overlayEl = document.getElementById('offCartOverlay');
      panelEl = document.getElementById('offCartPanel');
      bodyEl = panelEl.querySelector('.off-cart-body');
      return;
    }
    overlayEl = document.createElement('div');
    overlayEl.id = 'offCartOverlay';
    overlayEl.className = 'off-cart-overlay';
    overlayEl.setAttribute('aria-hidden', 'true');

    panelEl = document.createElement('aside');
    panelEl.id = 'offCartPanel';
    panelEl.className = 'off-cart-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-modal', 'true');
    panelEl.setAttribute('aria-labelledby', 'offCartTitle');
    panelEl.setAttribute('aria-hidden', 'true');
    panelEl.tabIndex = -1;

    panelEl.innerHTML = `
      <header class="off-cart-header">
        <h2 class="off-cart-title" id="offCartTitle">
          Meu<span class="dot" aria-hidden="true"></span>carrinho
        </h2>
        <span class="off-cart-eyebrow"><b id="offCartItemsCount">0</b>&nbsp;ITENS</span>
        <button type="button" class="off-cart-close" aria-label="Fechar carrinho">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="off-cart-body" role="region" aria-live="polite"></div>
    `;

    document.body.appendChild(overlayEl);
    document.body.appendChild(panelEl);
    bodyEl = panelEl.querySelector('.off-cart-body');
    itemsCountEl = panelEl.querySelector('#offCartItemsCount');

    overlayEl.addEventListener('click', close);
    panelEl.querySelector('.off-cart-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!state.isOpen) return;
    if (e.key === 'Escape') close();
  }

  // ---------- Render ----------
  function emptyHTML() {
    return `
      <div class="off-cart-empty">
        <div class="off-cart-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 7h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>
        </div>
        <p class="off-cart-empty-text">Seu carrinho está vazio.</p>
        <button type="button" class="off-cart-empty-cta js-cart-shop">
          Compre agora
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;
  }

  function itemHTML(it) {
    const img = it.image && String(it.image).trim() ? it.image : FALLBACK_IMG;
    const sub = it.subtitle ? `<p class="off-cart-item-sub">${safe(it.subtitle)}</p>` : '';
    const lineTotal = (it.price || 0) * (it.qty || 1);
    return `
      <li class="off-cart-item" data-id="${safe(it.id)}">
        <div class="off-cart-item-img">
          <img src="${safe(img)}" alt="${safe(it.name)}" loading="lazy"
               onerror="this.onerror=null;this.src='${FALLBACK_IMG}';" />
        </div>
        <div class="off-cart-item-info">
          <h3 class="off-cart-item-name">${safe(it.name || 'Produto')}</h3>
          ${sub}
          <div class="off-cart-item-qty" role="group" aria-label="Quantidade">
            <button type="button" data-qty="-1" aria-label="Diminuir" ${it.qty <= 1 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
            </button>
            <span class="off-cart-item-qty-val">${it.qty}</span>
            <button type="button" data-qty="+1" aria-label="Aumentar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
        <div class="off-cart-item-side">
          <button type="button" class="off-cart-item-remove" aria-label="Remover">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
          <span class="off-cart-item-price">${formatBRL(lineTotal)}</span>
        </div>
      </li>
    `;
  }

  function filledHTML() {
    const total = getTotal();
    const count = getCount();
    const itemsHTML = state.items.map(itemHTML).join('');
    return `
      <ul class="off-cart-list">${itemsHTML}</ul>
      <footer class="off-cart-footer">
        <div class="off-cart-meta-row">
          <span>Subtotal · ${count} ${count === 1 ? 'item' : 'itens'}</span>
          <b>${formatBRL(total)}</b>
        </div>
        <div class="off-cart-summary">
          <div class="off-cart-summary-label">
            <span>Total</span>
            <small>Frete e descontos no checkout</small>
          </div>
          <div class="off-cart-total">${formatBRL(total)}</div>
        </div>
        <button type="button" class="off-cart-checkout js-cart-checkout">
          Finalizar compra
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
        <button type="button" class="off-cart-clear js-cart-clear">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Esvaziar carrinho
        </button>
      </footer>
    `;
  }

  function render() {
    if (!bodyEl) return;
    if (state.items.length === 0) {
      bodyEl.innerHTML = emptyHTML();
    } else {
      bodyEl.innerHTML = filledHTML();
    }
    updateBadge();
    bindBodyEvents();
  }

  function updateBadge() {
    const count = getCount();
    if (itemsCountEl) itemsCountEl.textContent = String(count);
    document.querySelectorAll('.js-cart-count').forEach(el => {
      el.textContent = String(count);
    });
  }

  function bindBodyEvents() {
    if (!bodyEl) return;
    const shopBtn = bodyEl.querySelector('.js-cart-shop');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        close();
        setTimeout(() => {
          const target = document.querySelector('#products') || document.querySelector('#hero');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else window.location.href = './index.html#products';
        }, 200);
      });
    }
    bodyEl.querySelectorAll('.off-cart-item').forEach(li => {
      const id = li.getAttribute('data-id');
      li.querySelectorAll('[data-qty]').forEach(btn => {
        btn.addEventListener('click', () => {
          const delta = parseInt(btn.getAttribute('data-qty'), 10) || 0;
          updateQty(id, delta);
        });
      });
      const rm = li.querySelector('.off-cart-item-remove');
      if (rm) rm.addEventListener('click', () => remove(id));
    });
    const clearBtn = bodyEl.querySelector('.js-cart-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    const checkoutBtn = bodyEl.querySelector('.js-cart-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', onCheckout);
  }

  function onCheckout() {
    if (state.items.length === 0) return;
    showToast('Redirecionando para o checkout...');
    if (window.OffStore && typeof window.OffStore.buildShopifyCheckoutPayload === 'function') {
      try {
        const payload = state.items.map(it => ({
          merchandiseId: it.shopifyVariantGid || null,
          quantity: it.qty,
          attributes: [
            { key: 'productId', value: String(it.productId || '') },
            { key: 'variantId', value: String(it.variantId || '') },
          ],
        }));
        console.log('[OffCart] Checkout payload:', payload);
      } catch (e) { /* noop */ }
    } else {
      console.log('[OffCart] Checkout items:', state.items);
    }
  }

  // ---------- API ----------
  function getCount() {
    return state.items.reduce((acc, it) => acc + (it.qty || 0), 0);
  }
  function getTotal() {
    return state.items.reduce((acc, it) => acc + (it.price || 0) * (it.qty || 0), 0);
  }
  function getItems() { return state.items.slice(); }

  function add(item) {
    if (!item || !item.name) return;
    const qty = Math.max(1, parseInt(item.qty || 1, 10));
    const variantId = item.variantId || item.id || null;
    const productId = item.productId || null;
    const matchKey = variantId || `prod_${productId}_${item.name}`;
    const existing = state.items.find(it => (it.variantId || `prod_${it.productId}_${it.name}`) === matchKey);
    if (existing) {
      existing.qty += qty;
    } else {
      state.items.push({
        id: uid(),
        productId: productId,
        variantId: variantId,
        slug: item.slug || null,
        name: item.name,
        subtitle: item.subtitle || '',
        image: item.image || '',
        price: typeof item.price === 'number' ? item.price : 0,
        compareAtPrice: typeof item.compareAtPrice === 'number' ? item.compareAtPrice : null,
        shopifyVariantGid: item.shopifyVariantGid || null,
        qty: qty,
      });
    }
    saveState();
    render();
    showToast(`${item.name.length > 28 ? item.name.slice(0, 28) + '…' : item.name} adicionado`);
  }

  function remove(id) {
    state.items = state.items.filter(it => it.id !== id);
    saveState();
    render();
  }
  function updateQty(id, delta) {
    const it = state.items.find(x => x.id === id);
    if (!it) return;
    it.qty = Math.max(1, (it.qty || 1) + delta);
    saveState();
    render();
  }
  function clearAll() {
    state.items = [];
    saveState();
    render();
  }

  // ---------- Open / Close ----------
  function lockBody() {
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    if (sbWidth > 0) document.body.style.setProperty('--off-cart-sb', sbWidth + 'px');
    document.body.classList.add('off-cart-locked');
  }
  function unlockBody() {
    document.body.classList.remove('off-cart-locked');
    document.body.style.removeProperty('--off-cart-sb');
  }

  function open() {
    if (state.isOpen) return;
    state.isOpen = true;
    render();
    lockBody();
    requestAnimationFrame(() => {
      overlayEl.classList.add('is-open');
      panelEl.classList.add('is-open');
      panelEl.setAttribute('aria-hidden', 'false');
      overlayEl.setAttribute('aria-hidden', 'false');
      panelEl.focus({ preventScroll: true });
    });
  }
  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;
    overlayEl.classList.remove('is-open');
    panelEl.classList.remove('is-open');
    panelEl.setAttribute('aria-hidden', 'true');
    overlayEl.setAttribute('aria-hidden', 'true');
    setTimeout(unlockBody, 350);
  }
  function toggle() { state.isOpen ? close() : open(); }

  // ---------- Toast ----------
  let toastEl = null, toastTimer = null;
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'off-cart-toast';
      toastEl.innerHTML = `<span class="dot"></span><span class="msg"></span>`;
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector('.msg').textContent = text;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2200);
  }

  // ---------- Auto-bind ----------
  function bindOpeners() {
    document.querySelectorAll('[data-cart-open]').forEach(el => {
      if (el.__offCartBound) return;
      el.__offCartBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    });
  }

  // ---------- Init ----------
  function init() {
    injectStyles();
    buildDOM();
    loadState();
    render();
    bindOpeners();
    // observe DOM mutations p/ pegar [data-cart-open] adicionados depois
    if ('MutationObserver' in window) {
      const obs = new MutationObserver(() => bindOpeners());
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------- Export ----------
  window.OffCart = {
    open, close, toggle,
    add, remove, updateQty, clear: clearAll,
    getItems, getCount, getTotal,
    _state: state, // debug
  };
})();
