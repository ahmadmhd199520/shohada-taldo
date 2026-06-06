(function () {
  'use strict';

  const RETURN_SCROLL_KEY = 'taldo_return_scroll_from_secondary_page';

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScrollPosition() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function nativeScrollTo(x, y) {
    const fn = window.__taldoNativeScrollTo || window.scrollTo.bind(window);
    fn(Number(x || 0), Number(y || 0));
  }

  function setActivePageNoScroll(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.remove('active');
    });

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
  }

  function getCurrentFamilyName() {
    const title = document.getElementById('familyPageTitle')?.textContent || '';
    return title
      .replace(/^شهداء\s+عائلة\s+/, '')
      .trim();
  }

  function saveSecondaryPageScroll(pageId) {
    if (!['familyMartyrsPage', 'houlaMassacrePage'].includes(pageId)) return;

    const state = {
      pageId,
      scroll: getScrollPosition(),
      familyName: pageId === 'familyMartyrsPage' ? getCurrentFamilyName() : '',
      savedAt: Date.now()
    };

    try {
      sessionStorage.setItem(RETURN_SCROLL_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function getSavedSecondaryPageScroll() {
    try {
      const raw = sessionStorage.getItem(RETURN_SCROLL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function restoreScrollPosition(scroll) {
    if (!scroll) return;

    const restore = function () {
      nativeScrollTo(Number(scroll.x || 0), Number(scroll.y || 0));
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 80);
    setTimeout(restore, 220);
    setTimeout(restore, 600);
  }

  function updateUrlForReturnPage(pageId, familyName) {
    try {
      if (pageId === 'houlaMassacrePage') {
        if (typeof updateRoute === 'function') {
          updateRoute('?page=massacre', { page: 'massacre' });
        } else {
          window.history.pushState({ page: 'massacre' }, '', '?page=massacre');
        }
      }

      if (pageId === 'familyMartyrsPage' && familyName) {
        const url = '?family=' + encodeURIComponent(familyName);
        if (typeof updateRoute === 'function') {
          updateRoute(url, { page: 'family', family: familyName });
        } else {
          window.history.pushState({ page: 'family', family: familyName }, '', url);
        }
      }
    } catch (error) {}
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__secondaryPageScrollWrapped) {
    window.openMartyrDetails = function (martyrId, fromPage, noRoute) {
      const sourcePage = fromPage || activePageId();

      if (sourcePage === 'familyMartyrsPage' || sourcePage === 'houlaMassacrePage') {
        saveSecondaryPageScroll(sourcePage);
      }

      return oldOpenMartyrDetails.apply(this, arguments);
    };

    window.openMartyrDetails.__secondaryPageScrollWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (error) {}
  }

  const oldGoBackFromDetails =
    window.goBackFromDetails ||
    (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);

  window.goBackFromDetails = function () {
    let lastPage = 'homePage';

    try {
      lastPage = lastPageBeforeDetails || 'homePage';
    } catch (error) {
      lastPage = window.lastPageBeforeDetails || 'homePage';
    }

    if (lastPage === 'familyMartyrsPage' || lastPage === 'houlaMassacrePage') {
      const saved = getSavedSecondaryPageScroll();
      const scroll = saved && saved.pageId === lastPage ? saved.scroll : null;
      const familyName = saved && saved.familyName ? saved.familyName : getCurrentFamilyName();

      if (lastPage === 'houlaMassacrePage') {
        /*
          لا نستخدم openHoulaMassacrePage هنا لأنه يعيد الصفحة للأولى
          ويستدعي showPage، وهذا هو سبب ضياع السكرول.
        */
        if (typeof renderHoulaMassacrePage === 'function') {
          renderHoulaMassacrePage();
        }

        setActivePageNoScroll('houlaMassacrePage');
        updateUrlForReturnPage('houlaMassacrePage', '');
        restoreScrollPosition(scroll);
        return;
      }

      if (lastPage === 'familyMartyrsPage') {
        /*
          لا نستدعي showPage مباشرة، لأن showPage يصعد للأعلى.
          وإن كان محتوى العائلة غير موجود لأي سبب، نعيد بناءه ثم نرجع للسكرول.
        */
        const container = document.getElementById('familyMartyrsContainer');

        if (familyName && container && !container.innerHTML.trim() && typeof openFamilyMartyrs === 'function') {
          openFamilyMartyrs(familyName, true);
        } else {
          setActivePageNoScroll('familyMartyrsPage');
        }

        updateUrlForReturnPage('familyMartyrsPage', familyName);
        restoreScrollPosition(scroll);
        return;
      }
    }

    if (typeof oldGoBackFromDetails === 'function') {
      return oldGoBackFromDetails.apply(this, arguments);
    }
  };

  try {
    goBackFromDetails = window.goBackFromDetails;
  } catch (error) {}
})();
