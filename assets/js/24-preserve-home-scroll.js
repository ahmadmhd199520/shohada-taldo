(function() {
  'use strict';

  const HOME_SCROLL_KEY = 'taldo_home_scroll_before_details';

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getLastPageBeforeDetailsSafe() {
    try {
      return lastPageBeforeDetails || '';
    } catch (e) {
      return window.lastPageBeforeDetails || '';
    }
  }

  function saveHomeScrollPosition() {
    const pos = {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };

    sessionStorage.setItem(HOME_SCROLL_KEY, JSON.stringify(pos));
  }

  function getSavedHomeScrollPosition() {
    try {
      const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  function restoreHomeScrollPosition() {
    const pos = getSavedHomeScrollPosition();
    if (!pos) return;

    const restore = () => {
      window.scrollTo({
        left: Number(pos.x || 0),
        top: Number(pos.y || 0),
        behavior: 'auto'
      });
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 80);
    setTimeout(restore, 250);
    setTimeout(restore, 700);
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__preserveHomeScrollWrapped) {
    window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
      const isFromHome =
        fromPage === 'homePage' ||
        activePageId() === 'homePage';

      if (isFromHome && !noRoute) {
        saveHomeScrollPosition();
      }

      return oldOpenMartyrDetails.apply(this, arguments);
    };

    window.openMartyrDetails.__preserveHomeScrollWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  const oldGoBackFromDetails =
    window.goBackFromDetails ||
    (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);

  if (typeof oldGoBackFromDetails === 'function' && !oldGoBackFromDetails.__preserveHomeScrollWrapped) {
    window.goBackFromDetails = function() {
      const shouldRestoreHomeScroll = getLastPageBeforeDetailsSafe() === 'homePage';

      const result = oldGoBackFromDetails.apply(this, arguments);

      if (shouldRestoreHomeScroll) {
        restoreHomeScrollPosition();
      }

      return result;
    };

    window.goBackFromDetails.__preserveHomeScrollWrapped = true;

    try {
      goBackFromDetails = window.goBackFromDetails;
    } catch (e) {}
  }

  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__preserveHomeScrollWrapped) {
    window.showPage = function(pageId) {
      const comingBackFromDetailsToHome =
        activePageId() === 'detailsPage' &&
        pageId === 'homePage' &&
        getSavedHomeScrollPosition();

      const result = oldShowPage.apply(this, arguments);

      if (comingBackFromDetailsToHome) {
        restoreHomeScrollPosition();
      }

      return result;
    };

    window.showPage.__preserveHomeScrollWrapped = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }
})();
