/*
  Taldo Focus Privacy Guard - Admin Safe + Unified Overlay
  طبقة حماية إضافية مستقلة:
  - تعمل للزوار فقط.
  - لا تنشئ شاشة بتصميم مختلف، بل تستخدم نفس شاشة الحماية الموجودة في:
    29-public-content-protection.js + 21-public-content-protection.css
  - لتجنب التكرار: لا تتدخل في Ctrl+C / Ctrl+X / Ctrl+S / Ctrl+P / PrintScreen
    لأن ملف الحماية الأساسي يعالجها.
*/
(function () {
  'use strict';

  const PUBLIC_PROTECTION_CLASS = 'taldo-public-protection';
  const ADMIN_CLASS = 'taldo-admin-mode';
  const SCREEN_GUARD_CLASS = 'taldo-screen-guard-active';
  const OVERLAY_ID = 'taldoScreenGuardOverlay';
  const OVERLAY_TITLE = 'تنبيه حماية المحتوى';
  const OVERLAY_MESSAGE = 'هذا الإجراء غير متاح';

  const CONFIG = {
    focusedHideDelay: 2600,
    afterFocusHideDelay: 2600
  };

  let hideTimer = null;
  let isWindowFocused = document.hasFocus();

  function isTaldoAdminActive() {
    try {
      if (typeof isAdminLoggedIn !== 'undefined' && !!isAdminLoggedIn) return true;
    } catch (error) {}

    try {
      if (window.isAdminLoggedIn === true) return true;
    } catch (error) {}

    try {
      const savedAdmin = localStorage.getItem('taldo_martyrs_admin');
      if (savedAdmin && savedAdmin !== 'null' && savedAdmin !== 'undefined' && savedAdmin !== '{}') return true;
    } catch (error) {}

    try {
      if (document.documentElement && document.documentElement.classList.contains(ADMIN_CLASS)) return true;
      if (document.body && document.body.classList.contains(ADMIN_CLASS)) return true;
      if (document.documentElement && document.documentElement.classList.contains('taldo-admin-mode')) return true;
      if (document.body && document.body.classList.contains('taldo-admin-mode')) return true;
    } catch (error) {}

    return false;
  }

  function renderUnifiedOverlay(overlay) {
    if (!overlay) return;

    overlay.className = 'taldo-screen-guard-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dataset.taldoUnifiedProtection = '1';

    overlay.innerHTML = `
      <div class="taldo-screen-guard-overlay-inner">
        <div class="taldo-screen-guard-overlay-icon">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div class="taldo-screen-guard-overlay-title">
          ${OVERLAY_TITLE}
        </div>
        <div class="taldo-screen-guard-overlay-message" style="margin-top:8px;font-weight:700;font-size:1rem;line-height:1.8;">
          ${OVERLAY_MESSAGE}
        </div>
      </div>
    `;
  }

  function ensureOverlay() {
    if (isTaldoAdminActive()) return null;
    if (!document.body) return null;

    let overlay = document.getElementById(OVERLAY_ID);

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      document.body.appendChild(overlay);
    }

    if (overlay.dataset.taldoUnifiedProtection !== '1') {
      renderUnifiedOverlay(overlay);
    }

    return overlay;
  }

  function activateUnifiedGuard(options) {
    if (isTaldoAdminActive()) {
      hideOverlay();
      return;
    }

    const opts = options || {};
    const overlay = ensureOverlay();
    if (!overlay) return;

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    document.documentElement.classList.add(PUBLIC_PROTECTION_CLASS);
    document.documentElement.classList.add(SCREEN_GUARD_CLASS);

    if (document.body) {
      document.body.classList.add(PUBLIC_PROTECTION_CLASS);
      document.body.classList.add(SCREEN_GUARD_CLASS);
    }

    if (opts.keepUntilFocus) return;

    const delay = Number(opts.delay || CONFIG.focusedHideDelay);
    hideTimer = setTimeout(hideOverlay, delay);
  }

  function hideOverlay() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    document.documentElement.classList.remove(SCREEN_GUARD_CLASS);
    if (document.body) document.body.classList.remove(SCREEN_GUARD_CLASS);
  }

  function isPlainModifierKey(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();

    return (
      key === 'meta' ||
      key === 'os' ||
      code === 'metaleft' ||
      code === 'metaright' ||
      key === 'control' ||
      code === 'controlleft' ||
      code === 'controlright' ||
      key === 'shift' ||
      code === 'shiftleft' ||
      code === 'shiftright'
    );
  }

  document.addEventListener('keydown', function (event) {
    if (!isPlainModifierKey(event)) return;
    activateUnifiedGuard({ delay: CONFIG.focusedHideDelay });
  }, true);

  window.addEventListener('blur', function () {
    isWindowFocused = false;
    activateUnifiedGuard({ keepUntilFocus: true });
  });

  window.addEventListener('focus', function () {
    isWindowFocused = true;
    activateUnifiedGuard({ delay: CONFIG.afterFocusHideDelay });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      isWindowFocused = false;
      activateUnifiedGuard({ keepUntilFocus: true });
    } else if (!isWindowFocused || document.hasFocus()) {
      isWindowFocused = true;
      activateUnifiedGuard({ delay: CONFIG.afterFocusHideDelay });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
  } else {
    ensureOverlay();
  }
})();
