/*
  Taldo Focus Privacy Guard
  طبقة حماية إضافية مستقلة:
  - تُظهر لوحة حماية عند الضغط على PrintScreen / Ctrl / Shift / Windows/Meta عندما تكون الصفحة في الفوكس.
  - تُظهر اللوحة وتُبقيها ظاهرة عندما تفقد نافذة كروم الفوكس أو تصبح الصفحة مخفية.
  - عند عودة الفوكس إلى كروم تختفي اللوحة بعد مدة قصيرة.

  للتعطيل: علّق استدعاء هذا الملف فقط من index.html.
*/
(function () {
  'use strict';


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
      if (document.documentElement && document.documentElement.classList.contains('taldo-admin-mode')) return true;
      if (document.body && document.body.classList.contains('taldo-admin-mode')) return true;
    } catch (error) {}

    return false;
  }

  const CONFIG = {
    overlayId: 'taldoFocusPrivacyGuardOverlay',
    styleId: 'taldoFocusPrivacyGuardStyle',

    // مدة بقاء اللوحة بعد الضغط على زر حماية والصفحة ما زالت في الفوكس
    focusedHideDelay: 600,

    // مدة بقاء اللوحة بعد رجوع الفوكس إلى كروم
    afterFocusHideDelay: 600,

    title: 'تنبيه حماية المحتوى',
    message: 'هذا الأرشيف يحترم خصوصية الشهداء وذويهم. يُرجى عدم نسخ أو تصوير المحتوى أو استخدامه خارج سياقه التوثيقي.',
    smallText: 'تظهر هذه الرسالة كطبقة حماية إضافية عند محاولة النسخ أو التصوير أو مغادرة نافذة الموقع.'
  };

  let hideTimer = null;
  let isWindowFocused = document.hasFocus();

  function injectStyle() {
    if (document.getElementById(CONFIG.styleId)) return;

    const style = document.createElement('style');
    style.id = CONFIG.styleId;
    style.textContent = `
      #${CONFIG.overlayId} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        direction: rtl;
        text-align: center;
        pointer-events: auto;
      }

      #${CONFIG.overlayId}.is-visible {
        display: flex;
      }

      #${CONFIG.overlayId} .taldo-focus-privacy-card {
        width: min(92vw, 520px);
        border-radius: 26px;
        padding: 24px 20px;
        background: linear-gradient(135deg, #0d6efd, #084298);
        color: #fff;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
        border: 1px solid rgba(255, 255, 255, 0.32);
        font-family: Tajawal, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      #${CONFIG.overlayId} .taldo-focus-privacy-icon {
        width: 54px;
        height: 54px;
        border-radius: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.32);
        font-size: 27px;
        margin-bottom: 12px;
      }

      #${CONFIG.overlayId} .taldo-focus-privacy-title {
        margin: 0 0 10px;
        font-size: 1.18rem;
        font-weight: 900;
        line-height: 1.5;
      }

      #${CONFIG.overlayId} .taldo-focus-privacy-message {
        margin: 0;
        font-size: 0.98rem;
        font-weight: 700;
        line-height: 1.9;
      }

      #${CONFIG.overlayId} .taldo-focus-privacy-small {
        margin: 12px 0 0;
        font-size: 0.82rem;
        opacity: 0.88;
        line-height: 1.8;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (isTaldoAdminActive()) return null;
    injectStyle();

    let overlay = document.getElementById(CONFIG.overlayId);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = CONFIG.overlayId;
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('role', 'alert');
    overlay.innerHTML = `
      <div class="taldo-focus-privacy-card">
        <div class="taldo-focus-privacy-icon">🛡️</div>
        <h2 class="taldo-focus-privacy-title"></h2>
        <p class="taldo-focus-privacy-message"></p>
        <p class="taldo-focus-privacy-small"></p>
      </div>
    `;

    overlay.querySelector('.taldo-focus-privacy-title').textContent = CONFIG.title;
    overlay.querySelector('.taldo-focus-privacy-message').textContent = CONFIG.message;
    overlay.querySelector('.taldo-focus-privacy-small').textContent = CONFIG.smallText;

    document.body.appendChild(overlay);
    return overlay;
  }

  function showOverlay(options) {
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

    overlay.classList.add('is-visible');

    if (opts.keepUntilFocus) return;

    const delay = Number(opts.delay || CONFIG.focusedHideDelay);
    hideTimer = setTimeout(hideOverlay, delay);
  }

  function hideOverlay() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    const overlay = document.getElementById(CONFIG.overlayId);
    if (overlay) overlay.classList.remove('is-visible');
  }

  function shouldTriggerByKey(event) {
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();

    return (
      key === 'printscreen' ||
      code === 'printscreen' ||
      key === 'meta' ||
      key === 'os' ||
      code === 'metaleft' ||
      code === 'metaright' ||
      key === 'control' ||
      code === 'controlleft' ||
      code === 'controlright' ||
      key === 'shift' ||
      code === 'shiftleft' ||
      code === 'shiftright' ||
      event.ctrlKey === true ||
      event.metaKey === true
    );
  }

  document.addEventListener('keydown', function (event) {
    if (!shouldTriggerByKey(event)) return;
    showOverlay({ delay: CONFIG.focusedHideDelay });
  }, true);

  window.addEventListener('blur', function () {
    isWindowFocused = false;
    showOverlay({ keepUntilFocus: true });
  });

  window.addEventListener('focus', function () {
    isWindowFocused = true;
    showOverlay({ delay: CONFIG.afterFocusHideDelay });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      isWindowFocused = false;
      showOverlay({ keepUntilFocus: true });
    } else if (!isWindowFocused || document.hasFocus()) {
      isWindowFocused = true;
      showOverlay({ delay: CONFIG.afterFocusHideDelay });
    }
  });

  // تجهيز هادئ للطبقة بعد اكتمال DOM بدون إظهارها.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
  } else {
    ensureOverlay();
  }
})();
