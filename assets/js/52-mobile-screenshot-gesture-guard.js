(function () {
  'use strict';

  /**
   * Mobile screenshot gesture guard for public visitors.
   *
   * Important:
   * - This file DOES NOT repeat copy/right-click/print protection.
   * - It reuses the existing protection system from:
   *   assets/js/29-public-content-protection.js
   *   assets/css/21-public-content-protection.css
   * - It only detects 3-finger touch/swipe on mobile and activates
   *   the existing .taldo-screen-guard-active overlay/class.
   */

  const PUBLIC_PROTECTION_CLASS = 'taldo-public-protection';
  const ADMIN_CLASS = 'taldo-admin-mode';
  const SCREEN_GUARD_CLASS = 'taldo-screen-guard-active';
  const OVERLAY_ID = 'taldoScreenGuardOverlay';

  const MIN_TOUCHES = 3;
  const MOVE_THRESHOLD = 22;
  const GUARD_DURATION = 700;
  const TRIGGER_COOLDOWN = 700;

  let startTouches = null;
  let guardTimer = null;
  let lastTriggerAt = 0;

  function isAdminMode() {
    try {
      if (document.documentElement.classList.contains(ADMIN_CLASS)) return true;
      if (document.body && document.body.classList.contains(ADMIN_CLASS)) return true;
      if (typeof window.isAdminLoggedIn !== 'undefined' && !!window.isAdminLoggedIn) return true;
    } catch (e) {}

    return false;
  }

  function isPublicProtectionEnabled() {
    return document.documentElement.classList.contains(PUBLIC_PROTECTION_CLASS) ||
      (document.body && document.body.classList.contains(PUBLIC_PROTECTION_CLASS));
  }

  function ensureScreenGuardOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    if (!document.body) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'taldo-screen-guard-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="taldo-screen-guard-overlay-inner">
        <div class="taldo-screen-guard-overlay-icon">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div class="taldo-screen-guard-overlay-title">
          هذا الإجراء غير متاح
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function activateExistingScreenGuard(duration) {
    if (isAdminMode()) return;

    const now = Date.now();
    if (now - lastTriggerAt < TRIGGER_COOLDOWN) return;
    lastTriggerAt = now;

    ensureScreenGuardOverlay();

    // نستخدم نفس الكلاسات الموجودة في ملف الحماية الحالي حتى لا نكرر CSS.
    document.documentElement.classList.add(PUBLIC_PROTECTION_CLASS);
    document.documentElement.classList.add(SCREEN_GUARD_CLASS);

    if (document.body) {
      document.body.classList.add(PUBLIC_PROTECTION_CLASS);
      document.body.classList.add(SCREEN_GUARD_CLASS);
    }

    clearTimeout(guardTimer);
    guardTimer = setTimeout(function () {
      document.documentElement.classList.remove(SCREEN_GUARD_CLASS);
      if (document.body) document.body.classList.remove(SCREEN_GUARD_CLASS);
    }, duration || GUARD_DURATION);
  }

  function getTouchPoints(event) {
    if (!event || !event.touches) return [];

    return Array.prototype.slice.call(event.touches).map(function (touch) {
      return {
        x: touch.clientX,
        y: touch.clientY
      };
    });
  }

  function averagePoint(points) {
    if (!points || !points.length) return { x: 0, y: 0 };

    const total = points.reduce(function (acc, point) {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    }, { x: 0, y: 0 });

    return {
      x: total.x / points.length,
      y: total.y / points.length
    };
  }

  function getDistanceBetweenAverages(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function shouldListen() {
    // هذا الملف للزوار فقط. لا يعمل للأدمن حتى لا يزعج لوحة التحكم.
    if (isAdminMode()) return false;

    // إذا لم يكن ملف الحماية الأساسي قد فعّل الكلاس بعد، لا مشكلة؛ سنفعّله عند التشغيل.
    return true;
  }

  function onTouchStart(event) {
    if (!shouldListen()) return;
    if (!event.touches || event.touches.length < MIN_TOUCHES) return;

    startTouches = getTouchPoints(event);

    // مجرد وضع ثلاث أصابع على الشاشة يعتبر محاولة مشبوهة.
    activateExistingScreenGuard(GUARD_DURATION);
  }

  function onTouchMove(event) {
    if (!shouldListen()) return;
    if (!event.touches || event.touches.length < MIN_TOUCHES) return;

    const currentTouches = getTouchPoints(event);

    if (!startTouches || startTouches.length < MIN_TOUCHES) {
      startTouches = currentTouches;
      activateExistingScreenGuard(GUARD_DURATION);
      return;
    }

    const startAverage = averagePoint(startTouches);
    const currentAverage = averagePoint(currentTouches);
    const distance = getDistanceBetweenAverages(startAverage, currentAverage);

    if (distance >= MOVE_THRESHOLD) {
      activateExistingScreenGuard(GUARD_DURATION + 1200);
    }
  }

  function onTouchEnd(event) {
    if (!event.touches || event.touches.length < MIN_TOUCHES) {
      startTouches = null;
    }
  }

  function bootMobileScreenshotGestureGuard() {
    if (!isPublicProtectionEnabled()) {
      document.documentElement.classList.add(PUBLIC_PROTECTION_CLASS);
      if (document.body) document.body.classList.add(PUBLIC_PROTECTION_CLASS);
    }

    ensureScreenGuardOverlay();

    // passive:true مهم حتى لا نكسر السكرول أو اللمس في الجوال.
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });

    window.taldoMobileScreenshotGestureGuard = {
      activate: activateExistingScreenGuard
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMobileScreenshotGestureGuard);
  } else {
    bootMobileScreenshotGestureGuard();
  }
})();
