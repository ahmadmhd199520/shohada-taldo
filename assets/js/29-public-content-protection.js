(function() {
  'use strict';

const PROTECTION_CLASS = 'taldo-public-protection';
const ADMIN_CLASS = 'taldo-admin-mode';
const SCREEN_GUARD_CLASS = 'taldo-screen-guard-active';
const PROTECTION_MESSAGE = 'هذا الإجراء غير متاح';

let lastProtectionToastTime = 0;
let screenGuardTimer = null;
  
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

  return !!el.closest(`
    input,
    textarea,
    select,
    option,
    button,
    label,
    .form-control,
    .form-select,
    [contenteditable="true"],
    [contenteditable=""],
    [role="textbox"],
    [role="combobox"],
    [role="searchbox"]
  `);
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

function notifyProtection() {
  const now = Date.now();

  if (now - lastProtectionToastTime < 1800) return;

  lastProtectionToastTime = now;

  try {
    if (typeof showToast === 'function') {
      showToast(PROTECTION_MESSAGE);
    }
  } catch (e) {}
}

function blockEvent(event) {
  if (isProtectionAdmin()) return false;

  /*
    لا نمنع النسخ/اللصق/القص/التحديد/القائمة اليمنى
    داخل حقول الإدخال والبحث والنماذج.
  */
  if (isEditableTarget(event.target)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  notifyProtection();

  return true;
}
  
  function lockOneImage(img) {
    if (!img || img.dataset.taldoProtectedImage === '1') return;

    img.dataset.taldoProtectedImage = '1';
    img.setAttribute('draggable', 'false');
    img.setAttribute('ondragstart', 'return false');
    img.setAttribute('oncontextmenu', 'return false');
  }

  function ensureScreenGuardOverlay() {
  if (document.getElementById('taldoScreenGuardOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'taldoScreenGuardOverlay';
  overlay.className = 'taldo-screen-guard-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  overlay.innerHTML = `
    <div class="taldo-screen-guard-overlay-inner">
      <div class="taldo-screen-guard-overlay-icon">
        <i class="fa-solid fa-shield-halved"></i>
      </div>
      <div class="taldo-screen-guard-overlay-title">
        ${PROTECTION_MESSAGE}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

  function hasOpenBootstrapModal() {
  return !!document.querySelector('.modal.show, .modal.fade.show, .modal[style*="display: block"]');
}
  
function activateScreenGuard(duration = 1800) {
  if (isProtectionAdmin()) return;

  /*
    لا نشغّل طبقة حماية لقطة الشاشة أثناء فتح المودالات،
    لأن Bootstrap يغيّر التركيز وقد يسبب blur كاذب.
  */
  if (hasOpenBootstrapModal()) return;

  ensureScreenGuardOverlay();

  document.documentElement.classList.add(SCREEN_GUARD_CLASS);
  document.body?.classList.add(SCREEN_GUARD_CLASS);

  clearTimeout(screenGuardTimer);

  screenGuardTimer = setTimeout(function() {
    document.documentElement.classList.remove(SCREEN_GUARD_CLASS);
    document.body?.classList.remove(SCREEN_GUARD_CLASS);
  }, duration);
}
  
function clearClipboardIfPossible() {
  if (isProtectionAdmin()) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('');
    }
  } catch (e) {}
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
  if (isEditableTarget(event.target)) return;

  blockEvent(event);
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
  if (isEditableTarget(event.target)) return;

  blockEvent(event);
}, true);

  document.addEventListener('cut', function(event) {
  if (isProtectionAdmin()) return;
  if (isEditableTarget(event.target)) return;

  blockEvent(event);
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

  /*
    السماح الكامل داخل حقول الإدخال:
    نسخ، لصق، قص، تحديد، كتابة، إلخ.
  */
  if (isEditableTarget(event.target)) return;

  const keyRaw = String(event.key || '');
  const key = keyRaw.toLowerCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (keyRaw === 'PrintScreen' || key === 'printscreen') {
    activateScreenGuard(2600);
    clearClipboardIfPossible();
    blockEvent(event);
    return;
  }

  if (ctrlOrMeta) {
    if (key === 'c' || key === 'x') {
      blockEvent(event);
      return;
    }

    if (key === 'a') {
      blockEvent(event);
      return;
    }

    if (key === 's' || key === 'p' || key === 'u') {
      activateScreenGuard(2200);
      blockEvent(event);
      return;
    }

    if (event.shiftKey && key === 's') {
      activateScreenGuard(2200);
      blockEvent(event);
      return;
    }
  }
}, true);
    document.addEventListener('keyup', function(event) {
  if (isProtectionAdmin()) return;

  const keyRaw = String(event.key || '');
  const key = keyRaw.toLowerCase();

  if (keyRaw === 'PrintScreen' || key === 'printscreen') {
    activateScreenGuard(2600);
    clearClipboardIfPossible();
    notifyProtection();
  }
}, true);

/*
  عند فتح أداة قص من النظام غالبًا تفقد الصفحة التركيز.
  هذا ليس منعًا مضمونًا، لكنه طبقة ردع جيدة.
*/
// window.addEventListener('blur', function() {
//   if (isProtectionAdmin()) return;
//   activateScreenGuard(1800);
// }, true);

document.addEventListener('visibilitychange', function() {
  if (isProtectionAdmin()) return;

  /*
    نفعّل الحماية فقط عند انتقال الصفحة فعلًا للخلفية،
    وليس عند تغيّر التركيز داخل نفس الصفحة أو أدوات المطوّر.
  */
  if (document.visibilityState === 'hidden') {
    activateScreenGuard(2200);
  }
}, true);
    
/*
  منع/إخفاء المحتوى عند الطباعة.
*/
window.addEventListener('beforeprint', function(event) {
  if (isProtectionAdmin()) return;

  activateScreenGuard(8000);

  try {
    event.preventDefault();
  } catch (e) {}

  notifyProtection();
}, true);

window.addEventListener('afterprint', function() {
  if (isProtectionAdmin()) return;

  document.documentElement.classList.remove(SCREEN_GUARD_CLASS);
  document.body?.classList.remove(SCREEN_GUARD_CLASS);
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

document.addEventListener('hide.bs.modal', function(event) {
  try {
    const active = document.activeElement;

    if (active && event.target && event.target.contains(active)) {
      active.blur();
    }
  } catch (e) {}
}, true);
