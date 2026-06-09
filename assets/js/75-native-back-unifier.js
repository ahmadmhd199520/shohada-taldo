/*
  75-native-back-unifier.js
  توحيد زر الرجوع الأصلي في المتصفح/الجوال مع أزرار الرجوع الموجودة داخل الموقع.
  يُحمّل بعد ملفات الرجوع الحالية، خصوصًا:
  31-stable-back-from-details-scroll.js
  64-preserve-secondary-pages-scroll.js
*/
(function () {
  'use strict';

  if (window.__taldoNativeBackUnifierInstalled) return;
  window.__taldoNativeBackUnifierInstalled = true;

  const HANDLED_PAGES = [
    'detailsPage',
    'familyMartyrsPage',
    'familiesPage',
    'houlaMassacrePage'
  ];

  let handlingNativeBack = false;

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getGlobalFunction(name) {
    const fn = window[name];
    return typeof fn === 'function' ? fn : null;
  }

  function runWithoutAddingHistory(callback) {
    const originalPushState = window.history && window.history.pushState;
    const originalReplaceState = window.history && window.history.replaceState;

    if (!originalPushState || !originalReplaceState) {
      return callback();
    }

    try {
      // عند الضغط على زر الرجوع الأصلي يكون المتصفح قد رجع خطوة فعلًا.
      // لذلك نحول أي pushState داخلي إلى replaceState حتى لا نضيف خطوة زائدة في سجل الرجوع.
      window.history.pushState = function (state, title, url) {
        return originalReplaceState.call(window.history, state, title, url);
      };

      return callback();
    } finally {
      window.history.pushState = originalPushState;
    }
  }

  function runSameSiteBackForPage(pageId) {
    if (pageId === 'detailsPage') {
      const fn = getGlobalFunction('goBackFromDetails');
      if (fn) {
        fn();
        return true;
      }
    }

    if (pageId === 'familyMartyrsPage') {
      const fn = getGlobalFunction('openFamiliesStatsPage');
      if (fn) {
        fn();
        return true;
      }

      const show = getGlobalFunction('showPage');
      if (show) {
        show('familiesPage');
        return true;
      }
    }

    if (pageId === 'familiesPage' || pageId === 'houlaMassacrePage') {
      const fn = getGlobalFunction('goHome');
      if (fn) {
        fn();
        return true;
      }

      const show = getGlobalFunction('showPage');
      if (show) {
        show('homePage');
        return true;
      }
    }

    return false;
  }

  function applyRouteFallback() {
    const fn = getGlobalFunction('applyRouteFromLocation');
    if (fn) {
      try { fn(); } catch (error) {}
    }
  }

  window.addEventListener('popstate', function (event) {
    if (handlingNativeBack) return;

    const pageId = activePageId();
    if (!HANDLED_PAGES.includes(pageId)) return;

    handlingNativeBack = true;

    // نمنع مستمعات popstate القديمة من تطبيق route قبل أن ننفذ نفس زر الرجوع الداخلي.
    try {
      event.stopImmediatePropagation();
    } catch (error) {}

    setTimeout(function () {
      let handled = false;

      try {
        handled = runWithoutAddingHistory(function () {
          return runSameSiteBackForPage(pageId);
        });
      } catch (error) {
        handled = false;
      }

      if (!handled) {
        applyRouteFallback();
      }

      setTimeout(function () {
        handlingNativeBack = false;
      }, 250);
    }, 0);
  }, true);

  window.TaldoNativeBackUnifier = {
    activePageId: activePageId,
    runSameSiteBackForPage: function () {
      return runSameSiteBackForPage(activePageId());
    }
  };
})();
