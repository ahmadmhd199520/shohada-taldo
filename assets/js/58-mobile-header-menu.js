(function() {
  const MENU_BTN_ID = 'taldoMobileHeaderMenuBtn';
  const MENU_PANEL_ID = 'taldoMobileHeaderMenuPanel';
  const THEME_KEY = 'taldo_theme';

  function isAdminActive() {
    try {
      return !!window.isAdminLoggedIn || !!localStorage.getItem('taldo_martyrs_admin');
    } catch (e) {
      return !!window.isAdminLoggedIn;
    }
  }

  function getThemeIsDark() {
    return document.body.classList.contains('dark-mode') || document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', !!isDark);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
    }
    updateMenuState();
  }

  function initSavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') applyTheme(true);
    if (saved === 'light') applyTheme(false);
  }

  function closeMenu() {
    const panel = document.getElementById(MENU_PANEL_ID);
    const btn = document.getElementById(MENU_BTN_ID);
    if (panel) panel.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function positionMenuPanel() {
    const panel = document.getElementById(MENU_PANEL_ID);
    const btn = document.getElementById(MENU_BTN_ID);
    if (!panel || !btn) return;

    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(Math.max(panel.offsetWidth || 205, 205), window.innerWidth - 20);
    const top = Math.min(window.innerHeight - 12, rect.bottom + 8);

    // نضع القائمة تحت زر الثلاث نقاط مباشرة، مع منع خروجها خارج الشاشة.
    let left = rect.left;
    left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));

    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.right = 'auto';
  }

  function toggleMenu() {
    const panel = document.getElementById(MENU_PANEL_ID);
    const btn = document.getElementById(MENU_BTN_ID);
    if (!panel || !btn) return;

    const show = !panel.classList.contains('show');
    panel.classList.toggle('show', show);
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');

    if (show) {
      updateMenuState();
      requestAnimationFrame(positionMenuPanel);
    }
  }

  function updateMenuState() {
    const authBtn = document.getElementById('taldoMobileMenuAuth');
    const themeBtn = document.getElementById('taldoMobileMenuTheme');
    const admin = isAdminActive();
    const dark = getThemeIsDark();

    if (authBtn) {
      authBtn.innerHTML = admin
        ? '<i class="fa-solid fa-right-from-bracket"></i><span>تسجيل الخروج</span>'
        : '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
    }

    if (themeBtn) {
      themeBtn.innerHTML = dark
        ? '<i class="fa-solid fa-sun"></i><span>الوضع النهاري</span>'
        : '<i class="fa-solid fa-moon"></i><span>الوضع الليلي</span>';
    }
  }

  function runAuthAction() {
    closeMenu();
    if (isAdminActive()) {
      if (typeof window.logoutAdmin === 'function') window.logoutAdmin();
      return;
    }
    if (typeof window.openLoginModal === 'function') window.openLoginModal();
  }

  function runAboutAction() {
    closeMenu();
    if (typeof window.openAboutProjectModal === 'function') {
      window.openAboutProjectModal();
      return;
    }
    if (typeof window.openAboutUsModal === 'function') {
      window.openAboutUsModal();
      return;
    }
    const aboutBtn = document.querySelector('[onclick*="openAbout"], [data-bs-target="#aboutUsModal"]');
    if (aboutBtn) aboutBtn.click();
  }

  function runThemeAction() {
    applyTheme(!getThemeIsDark());
    closeMenu();
  }

  function ensureMenu() {
    const actions = document.querySelector('.top-login-bar.header-inline-actions') || document.querySelector('.top-login-bar');
    if (!actions || document.getElementById(MENU_BTN_ID)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = MENU_BTN_ID;
    btn.className = 'btn btn-outline-light btn-sm taldo-mobile-header-menu-btn';
    btn.setAttribute('aria-label', 'القائمة');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';

    const panel = document.createElement('div');
    panel.id = MENU_PANEL_ID;
    panel.className = 'taldo-mobile-header-menu-panel';
    panel.innerHTML = `
      <button type="button" id="taldoMobileMenuAuth" class="taldo-mobile-menu-item"></button>
      <button type="button" id="taldoMobileMenuAbout" class="taldo-mobile-menu-item">
        <i class="fa-solid fa-triangle-exclamation"></i><span>عن المشروع</span>
      </button>
      <div class="taldo-mobile-menu-divider"></div>
      <button type="button" id="taldoMobileMenuTheme" class="taldo-mobile-menu-item"></button>
    `;

    // نضع الزر داخل الهيدر، لكن القائمة نفسها داخل body كي لا تُقصّ من حدود الهيدر.
    actions.insertBefore(btn, actions.firstChild);
    document.body.appendChild(panel);

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    document.getElementById('taldoMobileMenuAuth')?.addEventListener('click', runAuthAction);
    document.getElementById('taldoMobileMenuAbout')?.addEventListener('click', runAboutAction);
    document.getElementById('taldoMobileMenuTheme')?.addEventListener('click', runThemeAction);

    document.addEventListener('click', function(e) {
      const panelEl = document.getElementById(MENU_PANEL_ID);
      const btnEl = document.getElementById(MENU_BTN_ID);
      if (!panelEl || !btnEl) return;
      if (panelEl.contains(e.target) || btnEl.contains(e.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', function() {
      closeMenu();
    });

    window.addEventListener('scroll', function() {
      const panelEl = document.getElementById(MENU_PANEL_ID);
      if (panelEl && panelEl.classList.contains('show')) positionMenuPanel();
    }, true);

    updateMenuState();
  }

  function wrapAdminButtonsUpdater() {
    const original = window.updateAdminButtons;
    if (typeof original !== 'function' || original.__mobileMenuWrapped) return;

    const wrapped = function() {
      const result = original.apply(this, arguments);
      setTimeout(updateMenuState, 0);
      return result;
    };
    wrapped.__mobileMenuWrapped = true;
    window.updateAdminButtons = wrapped;
  }

  function boot() {
    initSavedTheme();
    ensureMenu();
    wrapAdminButtonsUpdater();
    updateMenuState();
    setTimeout(function() {
      ensureMenu();
      wrapAdminButtonsUpdater();
      updateMenuState();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.taldoSetDarkMode = applyTheme;
})();
