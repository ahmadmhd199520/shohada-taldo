(function() {
  const STYLE_ID = 'taldoDetailFamilyLinkStyles';
  const RETURN_SESSION_KEY = 'taldo_return_from_family_to_detail';

  let openingFamilyFromDetailLink = false;
  let familyReturnToDetailState = null;

  function safeText(value) {
    return String(value || '').trim();
  }

  function injectFamilyLinkStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #detailsContainer .taldo-detail-family-link-wrap {
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }

      #detailsContainer .taldo-detail-family-link {
        appearance: none !important;
        border: 0 !important;
        background: transparent !important;
        color: var(--bs-primary, #0d6efd) !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        cursor: pointer !important;
        font: inherit !important;
        font-weight: 700 !important;
        text-decoration: none !important;
        line-height: 1.6 !important;
      }

      #detailsContainer .taldo-detail-family-link:hover,
      #detailsContainer .taldo-detail-family-link:focus {
        color: var(--bs-link-hover-color, #0a58ca) !important;
        text-decoration: underline !important;
      }

      #detailsContainer .taldo-detail-family-link i {
        font-size: 0.82em !important;
        opacity: 0.88 !important;
        transition: transform .18s ease !important;
      }

      #detailsContainer .taldo-detail-family-link:hover i,
      #detailsContainer .taldo-detail-family-link:focus i {
        transform: translateX(-2px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getLastPageBeforeDetailsSafe() {
    try {
      return safeText(lastPageBeforeDetails || 'homePage') || 'homePage';
    } catch (error) {
      return safeText(window.lastPageBeforeDetails || 'homePage') || 'homePage';
    }
  }

  function setLastPageBeforeDetailsSafe(value) {
    const finalValue = safeText(value) || 'homePage';
    try {
      lastPageBeforeDetails = finalValue;
    } catch (error) {
      window.lastPageBeforeDetails = finalValue;
    }
  }

  function getCurrentDetailItemSafe() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) return currentDetailsItem;
    } catch (error) {}

    if (window.currentDetailsItem) return window.currentDetailsItem;
    return null;
  }

  function getCurrentDetailFamilyName() {
    const item = getCurrentDetailItemSafe();
    if (item && item.family_name) return safeText(item.family_name);

    const familyNode = document.querySelector('#detailsContainer .detail-box .taldo-detail-family-link') ||
      Array.from(document.querySelectorAll('#detailsContainer .detail-box .text-muted'))
        .find(el => /^\s*عائلة\s+/.test(el.textContent || ''));

    if (!familyNode) return '';

    return safeText((familyNode.textContent || '').replace(/^\s*عائلة\s+/, '').replace(/\s*←\s*$/, ''));
  }

  function getCurrentDetailMartyrId() {
    const item = getCurrentDetailItemSafe();
    if (item && item.martyr_id) return safeText(item.martyr_id);

    const params = new URLSearchParams(window.location.search || '');
    return safeText(params.get('m') || '');
  }

  function saveReturnToDetailState(familyName) {
    const martyrId = getCurrentDetailMartyrId();
    if (!martyrId) return null;

    const state = {
      martyrId: martyrId,
      familyName: safeText(familyName),
      previousFromPage: getLastPageBeforeDetailsSafe(),
      savedAt: Date.now()
    };

    familyReturnToDetailState = state;

    try {
      sessionStorage.setItem(RETURN_SESSION_KEY, JSON.stringify(state));
    } catch (error) {}

    return state;
  }

  function readReturnToDetailState() {
    if (familyReturnToDetailState && familyReturnToDetailState.martyrId) return familyReturnToDetailState;

    try {
      const raw = sessionStorage.getItem(RETURN_SESSION_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state && state.martyrId) {
        familyReturnToDetailState = state;
        return state;
      }
    } catch (error) {}

    return null;
  }

  function clearReturnToDetailState() {
    familyReturnToDetailState = null;
    try {
      sessionStorage.removeItem(RETURN_SESSION_KEY);
    } catch (error) {}
  }

  function openMartyrDetailsById(martyrId, fromPage) {
    martyrId = safeText(martyrId);
    if (!martyrId) return false;

    const fn = window.openMartyrDetails || (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);
    if (typeof fn !== 'function') return false;

    fn(martyrId, fromPage || 'homePage');
    return true;
  }

  function returnFromFamilyToDetail(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const state = readReturnToDetailState();
    if (!state || !state.martyrId) {
      openFamiliesPageFallback();
      return;
    }

    const previousFromPage = safeText(state.previousFromPage) || 'homePage';
    const opened = openMartyrDetailsById(state.martyrId, previousFromPage);

    if (opened) {
      setLastPageBeforeDetailsSafe(previousFromPage);
      clearReturnToDetailState();
      setTimeout(patchDetailFamilyLink, 80);
      return;
    }

    openFamiliesPageFallback();
  }

  function openFamiliesPageFallback() {
    if (typeof window.openFamiliesStatsPage === 'function') {
      window.openFamiliesStatsPage();
      return;
    }

    try {
      if (typeof openFamiliesStatsPage === 'function') {
        openFamiliesStatsPage();
        return;
      }
    } catch (error) {}

    if (typeof showPage === 'function') {
      showPage('familiesPage');
    }
  }

  function getFamilyBackButton() {
    const direct = document.querySelector('#familyMartyrsPage button[onclick*="familiesPage"], #familyMartyrsPage button[onclick*="openFamiliesStatsPage"]');
    if (direct) return direct;

    return Array.from(document.querySelectorAll('#familyMartyrsPage button'))
      .find(btn => /رجوع/.test(btn.textContent || '')) || null;
  }

  function patchFamilyBackButtonToDetail() {
    const state = readReturnToDetailState();
    if (!state || !state.martyrId) return;

    const btn = getFamilyBackButton();
    if (!btn) return;

    if (btn.dataset.familyBackToDetailReady !== '1') {
      btn.dataset.familyBackToDetailReady = '1';
      btn.removeAttribute('onclick');
      btn.onclick = null;
      btn.addEventListener('click', returnFromFamilyToDetail, true);
    }

    btn.title = 'الرجوع إلى صفحة الشهيد';
    btn.setAttribute('aria-label', 'الرجوع إلى صفحة الشهيد');
  }

  function restoreNormalFamilyBackButtonIfNeeded() {
    const btn = getFamilyBackButton();
    if (!btn) return;

    if (btn.dataset.familyBackToDetailReady === '1') {
      const fresh = btn.cloneNode(true);
      fresh.dataset.familyBackFixed = '1';
      fresh.setAttribute('onclick', 'openFamiliesStatsPage()');
      fresh.title = 'الرجوع إلى صفحة العائلات';
      fresh.setAttribute('aria-label', 'الرجوع إلى صفحة العائلات');
      btn.parentNode.replaceChild(fresh, btn);
    }
  }

  function goToFamilyPage(familyName) {
    familyName = safeText(familyName);
    if (!familyName) return;

    saveReturnToDetailState(familyName);

    openingFamilyFromDetailLink = true;
    try {
      if (typeof window.openFamilyMartyrs === 'function') {
        window.openFamilyMartyrs(familyName);
      } else if (typeof openFamilyMartyrs === 'function') {
        openFamilyMartyrs(familyName);
      }
    } catch (error) {
    } finally {
      openingFamilyFromDetailLink = false;
    }

    setTimeout(patchFamilyBackButtonToDetail, 0);
    requestAnimationFrame(patchFamilyBackButtonToDetail);
    setTimeout(patchFamilyBackButtonToDetail, 180);
  }

  function wrapOpenFamilyMartyrs() {
    const oldOpenFamily = window.openFamilyMartyrs || (typeof openFamilyMartyrs === 'function' ? openFamilyMartyrs : null);
    if (typeof oldOpenFamily !== 'function') return;
    if (oldOpenFamily.__detailFamilyBackWrapped === true) return;

    const wrapped = function(familyName, noRoute) {
      const fromDetailLink = openingFamilyFromDetailLink === true;
      const result = oldOpenFamily.apply(this, arguments);

      setTimeout(function() {
        if (fromDetailLink) {
          patchFamilyBackButtonToDetail();
        } else {
          clearReturnToDetailState();
          restoreNormalFamilyBackButtonIfNeeded();
        }
      }, 0);

      return result;
    };

    wrapped.__detailFamilyBackWrapped = true;
    wrapped.__previousOpenFamilyMartyrs = oldOpenFamily;
    window.openFamilyMartyrs = wrapped;

    try {
      openFamilyMartyrs = window.openFamilyMartyrs;
    } catch (error) {}
  }

  function patchDetailFamilyLink() {
    injectFamilyLinkStyles();

    const detailsPage = document.getElementById('detailsPage');
    if (detailsPage && !detailsPage.classList.contains('active')) return;

    const familyName = getCurrentDetailFamilyName();
    if (!familyName) return;

    const familyWrap = Array.from(document.querySelectorAll('#detailsContainer .detail-box .text-muted'))
      .find(el => /^\s*عائلة\s+/.test(el.textContent || '') || el.textContent.includes(familyName));

    if (!familyWrap || familyWrap.dataset.familyLinkReady === '1') return;

    const preservedChildren = Array.from(familyWrap.children || []).map(child => child.cloneNode(true));

    familyWrap.dataset.familyLinkReady = '1';
    familyWrap.classList.add('taldo-detail-family-link-wrap');
    familyWrap.textContent = '';

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'taldo-detail-family-link';
    link.title = 'عرض شهداء عائلة ' + familyName;
    link.setAttribute('aria-label', 'عرض شهداء عائلة ' + familyName);

    const text = document.createElement('span');
    text.textContent = 'عائلة ' + familyName;

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-arrow-left-long';
    icon.setAttribute('aria-hidden', 'true');

    link.appendChild(text);
    link.appendChild(icon);
    link.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      goToFamilyPage(familyName);
    });

    familyWrap.appendChild(link);

    preservedChildren.forEach(child => {
      if (child && !child.classList?.contains('taldo-detail-family-link')) {
        familyWrap.appendChild(child);
      }
    });
  }

  function wrapOpenMartyrDetails() {
    const oldOpen = window.openMartyrDetails || (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);
    if (typeof oldOpen !== 'function') return;
    if (oldOpen.__detailFamilyLinkWrapped === true) return;

    window.openMartyrDetails = function() {
      const result = oldOpen.apply(this, arguments);
      setTimeout(patchDetailFamilyLink, 0);
      requestAnimationFrame(patchDetailFamilyLink);
      setTimeout(patchDetailFamilyLink, 160);
      return result;
    };

    window.openMartyrDetails.__detailFamilyLinkWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (error) {}
  }

  document.addEventListener('DOMContentLoaded', function() {
    injectFamilyLinkStyles();
    wrapOpenFamilyMartyrs();
    wrapOpenMartyrDetails();
    setTimeout(function() {
      wrapOpenFamilyMartyrs();
      wrapOpenMartyrDetails();
      patchDetailFamilyLink();
      patchFamilyBackButtonToDetail();
    }, 1200);
  });

  injectFamilyLinkStyles();
  wrapOpenFamilyMartyrs();
  wrapOpenMartyrDetails();
})();
