(function() {
  'use strict';

  const HOME_SCROLL_KEY = 'taldo_home_scroll_before_details_stable';

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScroll() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function saveHomeScroll() {
    if (activePageId() !== 'homePage') return;

    try {
      sessionStorage.setItem(HOME_SCROLL_KEY, JSON.stringify(getScroll()));
    } catch (e) {}
  }

  function getSavedHomeScroll() {
    try {
      const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }

  function setActivePageNoScroll(pageId) {
    document.querySelectorAll('.page-section').forEach(function(section) {
      section.classList.remove('active');
    });

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
  }

  function nativeScrollTo(x, y) {
    const fn = window.__taldoNativeScrollTo || window.scrollTo.bind(window);

    fn(Number(x || 0), Number(y || 0));
  }

  function suppressSmoothTopBriefly(ms) {
    const until = Date.now() + (ms || 900);

    window.__taldoSuppressSmoothTopUntil = until;

    if (window.__taldoStableBackScrollPatchInstalled) return;

    window.__taldoStableBackScrollPatchInstalled = true;

    const previousScrollTo = window.scrollTo.bind(window);

    window.scrollTo = function(arg1, arg2) {
      const active = Date.now() < (window.__taldoSuppressSmoothTopUntil || 0);

      let topValue = null;
      let behavior = '';

      if (arg1 && typeof arg1 === 'object') {
        topValue = Number(arg1.top || 0);
        behavior = String(arg1.behavior || '');
      } else {
        topValue = Number(arg2 || 0);
      }

      /*
        نمنع فقط أمر الصعود الناعم للأعلى أثناء الرجوع من صفحة الشهيد.
        لا نمنع أي سكرول آخر.
      */
      if (active && topValue === 0 && behavior === 'smooth') {
        return;
      }

      return previousScrollTo(arg1, arg2);
    };
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__stableBackScrollSaveWrapped) {
    window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
      if (fromPage === 'homePage' || activePageId() === 'homePage') {
        saveHomeScroll();
      }

      return oldOpenMartyrDetails.apply(this, arguments);
    };

    window.openMartyrDetails.__stableBackScrollSaveWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  function renderHomeOnce() {
    try {
      if (typeof updateStatsCards === 'function') updateStatsCards();
    } catch (e) {}

    try {
      if (typeof renderMartyrs === 'function') renderMartyrs();
    } catch (e) {}
  }

  function stableBackHome() {
    const pos = getSavedHomeScroll();

    suppressSmoothTopBriefly(900);

    setActivePageNoScroll('homePage');

    try {
      lastPageBeforeDetails = 'homePage';
    } catch (e) {}

    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({ page: 'home' }, '', cleanUrl);
    } catch (e) {}

    renderHomeOnce();

    /*
      إرجاع واحد فقط، بدون تكرارات كثيرة.
      هذا هو الفرق الأساسي لمنع الذبذبة.
    */
    requestAnimationFrame(function() {
      nativeScrollTo(pos.x, pos.y);
    });
  }

  const oldGoBackFromDetails =
    window.goBackFromDetails ||
    (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);

  window.goBackFromDetails = function() {
    let last = 'homePage';

    try {
      last = lastPageBeforeDetails || 'homePage';
    } catch (e) {}

    if (last === 'homePage') {
      stableBackHome();
      return;
    }

    if (typeof oldGoBackFromDetails === 'function') {
      return oldGoBackFromDetails.apply(this, arguments);
    }

    setActivePageNoScroll('homePage');
  };

  try {
    goBackFromDetails = window.goBackFromDetails;
  } catch (e) {}
})();
