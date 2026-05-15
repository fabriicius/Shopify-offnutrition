(function () {
  'use strict';

  const STYLE_ID = 'off-mobile-menu-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 959px) {
  .mobile-menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(5, 5, 5, 0.72);
    color: #fff;
    box-shadow: 0 0 0 1px rgba(204, 255, 0, 0.14) inset;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
    cursor: pointer;
    flex: 0 0 auto;
  }
  .mobile-menu-toggle:hover {
    transform: translateY(-1px);
    border-color: rgba(204, 255, 0, 0.38);
    box-shadow: 0 0 22px -10px rgba(204, 255, 0, 0.7), 0 0 0 1px rgba(204, 255, 0, 0.35) inset;
  }
  .mobile-menu-toggle .line {
    display: block;
    width: 16px;
    height: 1.8px;
    border-radius: 99px;
    background: currentColor;
    transform-origin: 50% 50%;
    transition: transform .25s ease, opacity .2s ease;
  }
  .mobile-menu-toggle .line + .line { margin-top: 4px; }
  .mobile-menu-toggle[aria-expanded="true"] .line:nth-child(1) { transform: translateY(5.8px) rotate(45deg); }
  .mobile-menu-toggle[aria-expanded="true"] .line:nth-child(2) { opacity: 0; }
  .mobile-menu-toggle[aria-expanded="true"] .line:nth-child(3) { transform: translateY(-5.8px) rotate(-45deg); }

  .nav > .nav-cta {
    display: none !important;
  }

  body.mobile-menu-open {
    overflow: hidden;
  }

  .mobile-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 110;
    background: rgba(0, 0, 0, 0.62);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity .3s ease, visibility 0s linear .3s;
  }
  .mobile-menu-overlay.is-open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity .3s ease, visibility 0s linear 0s;
  }

  .mobile-menu-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(84vw, 360px);
    height: 100vh;
    z-index: 111;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, rgba(10, 10, 10, 0.96), rgba(5, 5, 5, 0.98));
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: -30px 0 70px rgba(0, 0, 0, 0.55);
    transform: translateX(105%);
    transition: transform .34s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }
  .mobile-menu-drawer.is-open {
    transform: translateX(0);
    pointer-events: auto;
  }
  .mobile-menu-drawer::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(204, 255, 0, 0.7), transparent);
  }

  .mobile-menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .mobile-menu-title {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.62);
  }
  .mobile-menu-close {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.03);
    transition: border-color .25s ease, color .25s ease;
    cursor: pointer;
  }
  .mobile-menu-close:hover {
    border-color: rgba(204, 255, 0, 0.45);
    color: var(--acid, #ccff00);
  }
  .mobile-menu-close svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  .mobile-menu-links {
    display: flex;
    flex-direction: column;
    padding: 14px 16px 12px;
    gap: 8px;
  }
  .mobile-menu-links a {
    display: block;
    padding: 12px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.86);
    background: rgba(255, 255, 255, 0.02);
    transition: border-color .25s ease, background .25s ease, color .25s ease;
  }
  .mobile-menu-links a:hover,
  .mobile-menu-links a:focus-visible {
    border-color: rgba(204, 255, 0, 0.45);
    background: rgba(204, 255, 0, 0.08);
    color: #fff;
    outline: none;
  }
  .mobile-menu-links a.is-active {
    border-color: rgba(204, 255, 0, 0.48);
    color: var(--acid, #ccff00);
  }

  .mobile-menu-footer {
    margin-top: auto;
    padding: 14px 16px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .mobile-menu-cart {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 999px;
    border: none;
    background: #fff;
    color: #000;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.3) inset;
  }
  .mobile-menu-cart::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--acid, #ccff00);
    box-shadow: 0 0 10px rgba(204, 255, 0, 0.9);
  }
}

@media (min-width: 960px) {
  .mobile-menu-toggle,
  .mobile-menu-overlay,
  .mobile-menu-drawer {
    display: none !important;
  }
}`;
    document.head.appendChild(style);
  }

  function createMobileMenu(nav, idx) {
    if (!nav || nav.dataset.mobileMenuReady === 'true') return;
    const navMenu = nav.querySelector('.nav-menu');
    if (!navMenu) return;
    nav.dataset.mobileMenuReady = 'true';

    const menuId = 'mobile-menu-drawer-' + idx;
    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    overlay.setAttribute('hidden', '');

    const drawer = document.createElement('aside');
    drawer.className = 'mobile-menu-drawer';
    drawer.id = menuId;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-hidden', 'true');

    const links = navMenu.cloneNode(true);
    links.classList.remove('nav-menu');
    links.classList.add('mobile-menu-links');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menuId);
    toggle.innerHTML = '<span class="line"></span><span class="line"></span><span class="line"></span>';
    nav.appendChild(toggle);

    drawer.innerHTML = `
      <div class="mobile-menu-head">
        <span class="mobile-menu-title">Menu OFF</span>
        <button type="button" class="mobile-menu-close" aria-label="Fechar menu">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    `;
    drawer.appendChild(links);

    const footer = document.createElement('div');
    footer.className = 'mobile-menu-footer';
    footer.innerHTML = `
      <button type="button" class="mobile-menu-cart" aria-label="Abrir carrinho" data-cart-open>
        Carrinho <span style="color:#737373">·</span> <span class="js-cart-count">0</span>
      </button>
    `;
    drawer.appendChild(footer);

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    const closeBtn = drawer.querySelector('.mobile-menu-close');
    let isOpen = false;

    function lockBody() {
      document.body.classList.add('mobile-menu-open');
    }

    function unlockBody() {
      document.body.classList.remove('mobile-menu-open');
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      overlay.removeAttribute('hidden');
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      lockBody();
    }

    function closeMenu() {
      if (!isOpen) return;
      isOpen = false;
      overlay.classList.remove('is-open');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      unlockBody();
      window.setTimeout(function () {
        if (!isOpen) overlay.setAttribute('hidden', '');
      }, 320);
    }

    toggle.addEventListener('click', function () {
      if (isOpen) closeMenu();
      else openMenu();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    const cartBtn = drawer.querySelector('.mobile-menu-cart');
    if (cartBtn) {
      cartBtn.addEventListener('click', function () {
        closeMenu();
        if (window.OffCart && typeof window.OffCart.open === 'function') {
          window.OffCart.open();
        }
      });
    }
  }

  function init() {
    injectStyles();
    document.querySelectorAll('.nav').forEach(function (nav, idx) {
      createMobileMenu(nav, idx + 1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
