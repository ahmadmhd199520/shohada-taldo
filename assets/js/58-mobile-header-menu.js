(function() {
  const MENU_BTN_ID = 'taldoMobileHeaderMenuBtn';
  const MENU_PANEL_ID = 'taldoMobileHeaderMenuPanel';
  const THEME_KEY = 'taldo_theme';
  const DESKTOP_BP = 769;

  function isDesktopHeader() {
    return window.matchMedia && window.matchMedia('(min-width: ' + DESKTOP_BP + 'px)').matches;
  }

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
    panel.style.display = 'block';
    const panelWidth = Math.min(Math.max(panel.offsetWidth || 205, 205), window.innerWidth - 20);
    if (!panel.classList.contains('show')) panel.style.display = '';

    const top = Math.max(8, Math.min(window.innerHeight - 12, rect.bottom + 8));
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

    rehomeHeaderButtons();
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
    if (!actions) return;

    let btn = document.getElementById(MENU_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = MENU_BTN_ID;
      btn.className = 'btn btn-outline-light btn-sm taldo-mobile-header-menu-btn';
      btn.setAttribute('aria-label', 'القائمة');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
      });
    }

    let panel = document.getElementById(MENU_PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
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
      document.body.appendChild(panel);
      document.getElementById('taldoMobileMenuAuth')?.addEventListener('click', runAuthAction);
      document.getElementById('taldoMobileMenuAbout')?.addEventListener('click', runAboutAction);
      document.getElementById('taldoMobileMenuTheme')?.addEventListener('click', runThemeAction);
    }

    if (!window.__taldoMobileHeaderMenuGlobalBound) {
      window.__taldoMobileHeaderMenuGlobalBound = true;
      document.addEventListener('click', function(e) {
        const panelEl = document.getElementById(MENU_PANEL_ID);
        const btnEl = document.getElementById(MENU_BTN_ID);
        if (!panelEl || !btnEl) return;
        if (panelEl.contains(e.target) || btnEl.contains(e.target)) return;
        closeMenu();
      });

      window.addEventListener('resize', function() {
        closeMenu();
        setTimeout(rehomeHeaderButtons, 50);
      });

      window.addEventListener('scroll', function() {
        const panelEl = document.getElementById(MENU_PANEL_ID);
        if (panelEl && panelEl.classList.contains('show')) positionMenuPanel();
      }, true);
    }

    rehomeHeaderButtons();
    updateMenuState();
  }

  function rehomeHeaderButtons() {
    const menuBtn = document.getElementById(MENU_BTN_ID);
    const dashboardBtn = document.getElementById('dashboardBtn');
    const inlineActions = document.querySelector('.top-login-bar.header-inline-actions') || document.querySelector('.top-login-bar');
    const topActions = document.querySelector('.top-actions');
    if (!menuBtn || !inlineActions) return;

    if (isDesktopHeader() && topActions) {
      // في اللابتوب: DOM order يجعل آخر عنصر يظهر أقصى اليسار بسبب RTL.
      if (dashboardBtn && dashboardBtn.parentElement !== topActions) topActions.appendChild(dashboardBtn);
      if (menuBtn.parentElement !== topActions) topActions.appendChild(menuBtn);
    } else {
      // في الجوال: يبقى الزران في سطر العنوان.
      if (menuBtn.parentElement !== inlineActions) inlineActions.insertBefore(menuBtn, inlineActions.firstChild);
      if (dashboardBtn && dashboardBtn.parentElement !== inlineActions) {
        if (menuBtn.nextSibling) inlineActions.insertBefore(dashboardBtn, menuBtn.nextSibling);
        else inlineActions.appendChild(dashboardBtn);
      }
    }
  }

  function wrapAdminButtonsUpdater() {
    const original = window.updateAdminButtons;
    if (typeof original !== 'function' || original.__mobileMenuWrapped) return;

    const wrapped = function() {
      const result = original.apply(this, arguments);
      setTimeout(function() {
        rehomeHeaderButtons();
        updateMenuState();
      }, 0);
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
      rehomeHeaderButtons();
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
