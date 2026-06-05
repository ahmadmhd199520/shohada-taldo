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

  function makeButton() {
    let btn = document.getElementById(MENU_BTN_ID);
    if (btn) return btn;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = MENU_BTN_ID;
    btn.className = 'btn btn-outline-light btn-sm taldo-mobile-header-menu-btn';
    btn.setAttribute('aria-label', 'القائمة');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    return btn;
  }

  function bindButton(btn) {
    if (!btn || btn.dataset.taldoMenuBound === '1') return;
    btn.dataset.taldoMenuBound = '1';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });
  }

  function ensurePanel() {
    let panel = document.getElementById(MENU_PANEL_ID);
    if (panel) return panel;

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
    return panel;
  }

  function rehomeHeaderButtons() {
    const menuBtn = makeButton();
    bindButton(menuBtn);

    const dashboardBtn = document.getElementById('dashboardBtn');
    const inlineActions = document.querySelector('.top-login-bar.header-inline-actions') || document.querySelector('.top-login-bar');
    const topActions = document.querySelector('.top-actions');

    if (isDesktopHeader() && topActions) {
      // في اللابتوب: نضع زر الثلاث نقاط أول عنصر داخل top-actions، فيكون أقصى اليسار مع direction:ltr.
      if (menuBtn.parentElement !== topActions || topActions.firstElementChild !== menuBtn) {
        topActions.insertBefore(menuBtn, topActions.firstChild);
      }
      if (dashboardBtn && dashboardBtn.parentElement !== topActions) {
        topActions.insertBefore(dashboardBtn, menuBtn.nextSibling);
      } else if (dashboardBtn && dashboardBtn.previousElementSibling !== menuBtn) {
        topActions.insertBefore(dashboardBtn, menuBtn.nextSibling);
      }
    } else if (inlineActions) {
      // في الجوال: زر الثلاث نقاط أقصى اليسار، وزر لوحة التحكم بعده مباشرة.
      if (menuBtn.parentElement !== inlineActions || inlineActions.firstElementChild !== menuBtn) {
        inlineActions.insertBefore(menuBtn, inlineActions.firstChild);
      }
      if (dashboardBtn && dashboardBtn.parentElement !== inlineActions) {
        inlineActions.insertBefore(dashboardBtn, menuBtn.nextSibling);
      } else if (dashboardBtn && dashboardBtn.previousElementSibling !== menuBtn) {
        inlineActions.insertBefore(dashboardBtn, menuBtn.nextSibling);
      }
    }

    menuBtn.style.display = 'inline-flex';
    menuBtn.classList.remove('d-none');
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
    const btn = makeButton();
    bindButton(btn);
    ensurePanel();
    rehomeHeaderButtons();
    updateMenuState();
  }

  function wrapAdminButtonsUpdater() {
    const original = window.updateAdminButtons;
    if (typeof original !== 'function' || original.__mobileMenuWrapped) return;

    const wrapped = function() {
      const result = original.apply(this, arguments);
      setTimeout(function() {
        ensureMenu();
      }, 0);
      return result;
    };
    wrapped.__mobileMenuWrapped = true;
    window.updateAdminButtons = wrapped;
  }

  function bindGlobalOnce() {
    if (window.__taldoMobileHeaderMenuGlobalBound) return;
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
      setTimeout(ensureMenu, 50);
    });

    window.addEventListener('scroll', function() {
      const panelEl = document.getElementById(MENU_PANEL_ID);
      if (panelEl && panelEl.classList.contains('show')) positionMenuPanel();
    }, true);
  }

  function boot() {
    initSavedTheme();
    bindGlobalOnce();
    ensureMenu();
    wrapAdminButtonsUpdater();
    setTimeout(ensureMenu, 300);
    setTimeout(ensureMenu, 1000);
    setTimeout(ensureMenu, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.taldoSetDarkMode = applyTheme;
})();
// تثبيت القائمة للثلاث نقاط


(function () {
  function getButton() {
    return document.getElementById('taldoMobileHeaderMenuBtn') ||
      document.querySelector('.taldo-mobile-header-menu-btn');
  }

  function getPanel() {
    return document.getElementById('taldoMobileHeaderMenuPanel') ||
      document.querySelector('.taldo-mobile-header-menu-panel');
  }

  function measurePanel(panel) {
    const computed = window.getComputedStyle(panel);
    const wasHidden = computed.display === 'none';

    if (wasHidden) {
      panel.style.setProperty('display', 'block', 'important');
      panel.style.setProperty('visibility', 'hidden', 'important');
    }

    const width = panel.getBoundingClientRect().width || 205;

    if (wasHidden) {
      panel.style.removeProperty('display');
      panel.style.removeProperty('visibility');
    }

    return Math.min(width, window.innerWidth - 16);
  }

  function positionTaldoMenu() {
    const btn = getButton();
    const panel = getPanel();
    if (!btn || !panel) return;

    const safe = 8;
    const gap = 8;
    const rect = btn.getBoundingClientRect();
    const panelWidth = measurePanel(panel);

    let left = rect.left < window.innerWidth / 2
      ? rect.left
      : rect.right - panelWidth;

    left = Math.max(safe, Math.min(left, window.innerWidth - panelWidth - safe));

    const top = Math.max(safe, rect.bottom + gap);

    panel.style.setProperty('--taldo-menu-left', left + 'px');
    panel.style.setProperty('--taldo-menu-top', top + 'px');

    panel.style.setProperty('left', left + 'px', 'important');
    panel.style.setProperty('top', top + 'px', 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('position', 'fixed', 'important');
    panel.style.setProperty('transform', 'none', 'important');
  }

  function hook() {
    const btn = getButton();
    const panel = getPanel();
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      requestAnimationFrame(positionTaldoMenu);
      setTimeout(positionTaldoMenu, 0);
      setTimeout(positionTaldoMenu, 80);
    });

    const observer = new MutationObserver(function () {
      if (panel.classList.contains('show')) positionTaldoMenu();
    });

    observer.observe(panel, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('#taldoMobileHeaderMenuBtn, .taldo-mobile-header-menu-btn')) {
      requestAnimationFrame(positionTaldoMenu);
      setTimeout(positionTaldoMenu, 0);
    }
  });

  window.addEventListener('resize', positionTaldoMenu);
  window.addEventListener('scroll', positionTaldoMenu, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hook);
  } else {
    hook();
  }
})();
