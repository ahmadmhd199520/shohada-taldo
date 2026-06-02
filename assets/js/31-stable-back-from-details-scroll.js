(function() {
  'use strict';

  const HOME_SCROLL_KEY = 'taldo_home_scroll_before_details';

  function getSavedHomeScrollStable() {
    try {
      const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  function getLastPageBeforeDetailsStable() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function setLastPageBeforeDetailsStable(value) {
    try {
      lastPageBeforeDetails = value || 'homePage';
    } catch (e) {}
  }

  function setActivePageWithoutScrollStable(pageId) {
    document.querySelectorAll('.page-section').forEach(function(section) {
      section.classList.remove('active');
    });

    const page = document.getElementById(pageId);
    if (page) {
      page.classList.add('active');
    }
  }

  function restoreHomeScrollStable(pos) {
    if (!pos) return;

    const x = Number(pos.x || 0);
    const y = Number(pos.y || 0);

    const restore = function() {
      window.__taldoAllowStableScrollRestore = true;

      window.scrollTo({
        left: x,
        top: y,
        behavior: 'auto'
      });

      window.__taldoAllowStableScrollRestore = false;
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 80);
    setTimeout(restore, 180);
  }

  function renderHomeWithoutJumpStable(pos) {
    try {
      if (typeof updateStatsCards === 'function') {
        updateStatsCards();
      }
    } catch (e) {}

    try {
      if (typeof renderMartyrs === 'function') {
        renderMartyrs();
      }
    } catch (e) {}

    restoreHomeScrollStable(pos);
  }

  /*
    نمنع أي كود قديم من إرسال الصفحة للأعلى أثناء لحظة الرجوع فقط.
    المنع مؤقت، ولا يؤثر على باقي استخدام الموقع.
  */
  function suppressTopScrollTemporarilyStable(duration) {
    if (window.__taldoScrollToAlreadyPatched) {
      window.__taldoSuppressTopScrollUntil = Date.now() + duration;
      return;
    }

    const originalScrollTo = window.scrollTo.bind(window);

    window.__taldoOriginalScrollTo = originalScrollTo;
    window.__taldoSuppressTopScrollUntil = Date.now() + duration;
    window.__taldoScrollToAlreadyPatched = true;
    window.__taldoAllowStableScrollRestore = false;

    window.scrollTo = function(arg1, arg2) {
      const suppressActive = Date.now() < (window.__taldoSuppressTopScrollUntil || 0);

      let topValue = null;
      let behaviorValue = '';

      if (typeof arg1 === 'object' && arg1 !== null) {
        topValue = Number(arg1.top || 0);
        behaviorValue = String(arg1.behavior || '');
      } else {
        topValue = Number(arg2 || 0);
      }

      /*
        نمنع فقط أوامر الصعود للأعلى أثناء الرجوع من صفحة الشهيد.
        أما إرجاع السكرول للمكان المحفوظ فنسمح به.
      */
      if (
        suppressActive &&
        !window.__taldoAllowStableScrollRestore &&
        topValue === 0 &&
        behaviorValue === 'smooth'
      ) {
        return;
      }

      return originalScrollTo(arg1, arg2);
    };
  }

  function stableBackFromDetailsToHome() {
    const savedHomeScroll = getSavedHomeScrollStable() || { x: 0, y: 0 };

    suppressTopScrollTemporarilyStable(1800);

    /*
      لا نستدعي showPage('homePage') هنا إطلاقًا،
      لأنه هو سبب الصعود للأعلى.
    */
    setActivePageWithoutScrollStable('homePage');

    setLastPageBeforeDetailsStable('homePage');

    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({ page: 'home' }, '', cleanUrl);
    } catch (e) {}

    /*
      نرسم الرئيسية بعد الرجوع، وملف 30 سيحقن التعديلات قبل renderMartyrs.
    */
    renderHomeWithoutJumpStable(savedHomeScroll);

    /*
      إعادة واحدة بعد استقرار DOM فقط.
      لا نكثر المحاولات حتى لا يحدث صعود وهبوط.
    */
    setTimeout(function() {
      renderHomeWithoutJumpStable(savedHomeScroll);
    }, 220);
  }

  const oldGoBackFromDetails =
    window.goBackFromDetails ||
    (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);

  window.goBackFromDetails = function() {
    const lastPage = getLastPageBeforeDetailsStable();

    if (lastPage === 'homePage') {
      stableBackFromDetailsToHome();
      return;
    }

    if (typeof oldGoBackFromDetails === 'function') {
      return oldGoBackFromDetails.apply(this, arguments);
    }

    setActivePageWithoutScrollStable('homePage');
  };

  try {
    goBackFromDetails = window.goBackFromDetails;
  } catch (e) {}
})();
