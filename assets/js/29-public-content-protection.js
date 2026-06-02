(function() {
  'use strict';

  const PROTECTION_CLASS = 'taldo-public-protection';
  const ADMIN_CLASS = 'taldo-admin-mode';

  let lastProtectionToastTime = 0;

  function isProtectionAdmin() {
    try {
      return typeof isAdminLoggedIn !== 'undefined' && !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function isEditableTarget(target) {
    if (!target) return false;

    const el = target.nodeType === 3 ? target.parentElement : target;

    if (!el || !el.closest) return false;

    return !!el.closest(
      'input, textarea, select, option, [contenteditable="true"], [contenteditable=""]'
    );
  }

  function setProtectionMode() {
    const isAdmin = isProtectionAdmin();

    document.documentElement.classList.add(PROTECTION_CLASS);
    document.documentElement.classList.toggle(ADMIN_CLASS, isAdmin);

    if (document.body) {
      document.body.classList.add(PROTECTION_CLASS);
      document.body.classList.toggle(ADMIN_CLASS, isAdmin);
    }

    lockImagesForPublic();
  }

  function notifyProtection(message) {
    const now = Date.now();

    if (now - lastProtectionToastTime < 1800) return;

    lastProtectionToastTime = now;

    try {
      if (typeof showToast === 'function') {
        showToast(message || 'هذا الإجراء غير متاح للزوار.');
      }
    } catch (e) {}
  }

  function blockEvent(event, message) {
    if (isProtectionAdmin()) return false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    notifyProtection(message);

    return true;
  }

  function lockOneImage(img) {
    if (!img || img.dataset.taldoProtectedImage === '1') return;

    img.dataset.taldoProtectedImage = '1';
    img.setAttribute('draggable', 'false');
    img.setAttribute('ondragstart', 'return false');
    img.setAttribute('oncontextmenu', 'return false');
  }

  function lockImagesForPublic() {
    if (isProtectionAdmin()) return;

    document.querySelectorAll('img').forEach(lockOneImage);
  }

  function installImageObserver() {
    const observer = new MutationObserver(function(mutations) {
      if (isProtectionAdmin()) return;

      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (!node) return;

          if (node.tagName && node.tagName.toLowerCase() === 'img') {
            lockOneImage(node);
          }

          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(lockOneImage);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function installProtectionEvents() {
    /*
      منع الزر اليميني على الصفحة كلها للزوار،
      بما في ذلك الصور في الرئيسية وصفحة الشهيد.
    */
    document.addEventListener('contextmenu', function(event) {
      if (isProtectionAdmin()) return;

      blockEvent(event, 'هذا الإجراء غير متاح للزوار.');
    }, true);

    /*
      منع تحديد النصوص المعروضة.
      نسمح فقط داخل الحقول حتى لا تتعطل النماذج.
    */
    document.addEventListener('selectstart', function(event) {
      if (isProtectionAdmin()) return;
      if (isEditableTarget(event.target)) return;

      blockEvent(event, 'تحديد النصوص غير متاح للزوار.');
    }, true);

    /*
      منع سحب الصور أو عناصر الصفحة.
    */
    document.addEventListener('dragstart', function(event) {
      if (isProtectionAdmin()) return;

      const target = event.target;

      if (
        target &&
        (
          target.tagName?.toLowerCase() === 'img' ||
          target.closest?.('img, .martyr-card, .image-gallery, .detail-image, .gallery-main-image')
        )
      ) {
        blockEvent(event, 'هذا الإجراء غير متاح للزوار.');
      }
    }, true);

    /*
      منع نسخ النصوص أو الصور.
    */
    document.addEventListener('copy', function(event) {
      if (isProtectionAdmin()) return;

      blockEvent(event, 'نسخ المحتوى غير متاح للزوار.');
    }, true);

    document.addEventListener('cut', function(event) {
      if (isProtectionAdmin()) return;

      blockEvent(event, 'قص المحتوى غير متاح للزوار.');
    }, true);

    /*
      منع الاختصارات الشائعة:
      Ctrl/Cmd + C نسخ
      Ctrl/Cmd + X قص
      Ctrl/Cmd + A تحديد الكل خارج الحقول
      Ctrl/Cmd + S حفظ الصفحة
      Ctrl/Cmd + P طباعة
      Ctrl/Cmd + U عرض المصدر
    */
    document.addEventListener('keydown', function(event) {
      if (isProtectionAdmin()) return;

      const key = String(event.key || '').toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (!ctrlOrMeta) return;

      if (key === 'c' || key === 'x') {
        blockEvent(event, 'نسخ المحتوى غير متاح للزوار.');
        return;
      }

      if (key === 'a' && !isEditableTarget(event.target)) {
        blockEvent(event, 'تحديد النصوص غير متاح للزوار.');
        return;
      }

      if (key === 's' || key === 'p' || key === 'u') {
        blockEvent(event, 'هذا الإجراء غير متاح للزوار.');
      }
    }, true);

    /*
      منع الحفظ السريع للصور من بعض المتصفحات عند اللمس المطوّل.
    */
    document.addEventListener('touchstart', function() {
      if (isProtectionAdmin()) return;

      lockImagesForPublic();
    }, {
      capture: true,
      passive: true
    });
  }

  function patchAdminButtonsUpdater() {
    const oldUpdateAdminButtons =
      window.updateAdminButtons ||
      (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

    if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__contentProtectionPatched) {
      window.updateAdminButtons = function() {
        const result = oldUpdateAdminButtons.apply(this, arguments);
        setProtectionMode();
        return result;
      };

      window.updateAdminButtons.__contentProtectionPatched = true;

      try {
        updateAdminButtons = window.updateAdminButtons;
      } catch (e) {}
    }

    const oldLogoutAdmin =
      window.logoutAdmin ||
      (typeof logoutAdmin === 'function' ? logoutAdmin : null);

    if (typeof oldLogoutAdmin === 'function' && !oldLogoutAdmin.__contentProtectionPatched) {
      window.logoutAdmin = function() {
        const result = oldLogoutAdmin.apply(this, arguments);
        setTimeout(setProtectionMode, 50);
        return result;
      };

      window.logoutAdmin.__contentProtectionPatched = true;

      try {
        logoutAdmin = window.logoutAdmin;
      } catch (e) {}
    }
  }

  function bootProtection() {
    setProtectionMode();
    lockImagesForPublic();
    installProtectionEvents();
    installImageObserver();
    patchAdminButtonsUpdater();

    /*
      احتياط لأن حالة الأدمن تتغير بعد تسجيل الدخول أو استعادة الجلسة.
    */
    setInterval(setProtectionMode, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootProtection);
  } else {
    bootProtection();
  }
})();
