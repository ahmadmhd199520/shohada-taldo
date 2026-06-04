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


      .taldo-simple-search-box {
        position: sticky !important;
        top: 10px !important;
        z-index: 1050 !important;
        background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(255,255,255,.93)) !important;
        border: 1px solid rgba(13, 110, 253, .12) !important;
        border-radius: 18px !important;
        padding: 10px 12px !important;
        margin: 0 0 16px 0 !important;
        box-shadow: 0 10px 24px rgba(15, 35, 65, .08) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }

      .taldo-simple-search-inner {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .taldo-simple-search-inner i {
        color: var(--bs-primary, #0d6efd) !important;
        opacity: .82 !important;
        font-size: 15px !important;
        flex: 0 0 auto !important;
      }

      .taldo-simple-search-input {
        width: 100% !important;
        border: 0 !important;
        outline: 0 !important;
        background: transparent !important;
        color: var(--bs-body-color, #172033) !important;
        font: inherit !important;
        font-size: 15px !important;
        padding: 6px 4px !important;
        box-shadow: none !important;
      }

      .taldo-simple-search-input::placeholder {
        color: rgba(33, 37, 41, .56) !important;
      }

      .taldo-simple-search-empty {
        display: none;
        margin-top: 10px !important;
      }

      .taldo-simple-search-empty.is-visible {
        display: block !important;
      }

      [data-bs-theme="dark"] .taldo-simple-search-box,
      body.dark-mode .taldo-simple-search-box,
      body.dark .taldo-simple-search-box {
        background: linear-gradient(180deg, rgba(10, 28, 27, .98), rgba(10, 28, 27, .92)) !important;
        border-color: rgba(185, 167, 121, .22) !important;
        box-shadow: 0 12px 28px rgba(0, 0, 0, .28) !important;
      }

      [data-bs-theme="dark"] .taldo-simple-search-input,
      body.dark-mode .taldo-simple-search-input,
      body.dark .taldo-simple-search-input {
        color: #fff !important;
      }

      [data-bs-theme="dark"] .taldo-simple-search-input::placeholder,
      body.dark-mode .taldo-simple-search-input::placeholder,
      body.dark .taldo-simple-search-input::placeholder {
        color: rgba(255,255,255,.62) !important;
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


  function normalizeSearchText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function ensureFamiliesSearchBar() {
    const container = document.getElementById('familiesStatsContainer');
    if (!container) return null;

    let box = document.getElementById('taldoFamiliesSearchBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'taldoFamiliesSearchBox';
      box.className = 'taldo-simple-search-box';
      box.innerHTML = `
        <div class="taldo-simple-search-inner">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input id="taldoFamiliesSearchInput" class="taldo-simple-search-input" type="search" autocomplete="off" placeholder="ابحث عن اسم عائلة..." aria-label="البحث عن اسم عائلة">
        </div>
        <div id="taldoFamiliesSearchEmpty" class="empty-state taldo-simple-search-empty">لا توجد عائلة مطابقة للبحث.</div>
      `;
      container.parentNode.insertBefore(box, container);
    }

    const input = document.getElementById('taldoFamiliesSearchInput');
    if (input && input.dataset.bound !== '1') {
      input.dataset.bound = '1';
      input.addEventListener('input', filterFamiliesRows);
      input.addEventListener('search', filterFamiliesRows);
    }

    return box;
  }

  function filterFamiliesRows() {
    const input = document.getElementById('taldoFamiliesSearchInput');
    const container = document.getElementById('familiesStatsContainer');
    const empty = document.getElementById('taldoFamiliesSearchEmpty');
    if (!input || !container) return;

    const q = normalizeSearchText(input.value);
    const rows = Array.from(container.querySelectorAll('.family-row'));
    let visible = 0;

    rows.forEach(row => {
      const title = row.querySelector('h5')?.textContent || row.textContent || '';
      const match = !q || normalizeSearchText(title).includes(q);
      row.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (empty) empty.classList.toggle('is-visible', !!q && rows.length > 0 && visible === 0);
  }

  function ensureFamilyMartyrsSearchBar(familyName) {
    const container = document.getElementById('familyMartyrsContainer');
    if (!container) return null;

    let box = document.getElementById('taldoFamilyMartyrsSearchBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'taldoFamilyMartyrsSearchBox';
      box.className = 'taldo-simple-search-box';
      box.innerHTML = `
        <div class="taldo-simple-search-inner">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input id="taldoFamilyMartyrsSearchInput" class="taldo-simple-search-input" type="search" autocomplete="off" placeholder="ابحث عن اسم شهيد ضمن هذه العائلة..." aria-label="البحث عن شهيد ضمن العائلة">
        </div>
        <div id="taldoFamilyMartyrsSearchEmpty" class="empty-state taldo-simple-search-empty">لا يوجد شهيد مطابق للبحث ضمن هذه العائلة.</div>
      `;
      container.parentNode.insertBefore(box, container);
    }

    const input = document.getElementById('taldoFamilyMartyrsSearchInput');
    const currentFamily = safeText(familyName || getCurrentFamilyNameFromTitle());

    if (input && currentFamily && input.dataset.familyName !== currentFamily) {
      input.value = '';
      input.dataset.familyName = currentFamily;
    }

    if (input && input.dataset.bound !== '1') {
      input.dataset.bound = '1';
      input.addEventListener('input', filterFamilyMartyrCards);
      input.addEventListener('search', filterFamilyMartyrCards);
    }

    return box;
  }

  function getCurrentFamilyNameFromTitle() {
    const title = document.getElementById('familyPageTitle')?.textContent || '';
    return safeText(title.replace(/شهداء\s+عائلة/g, '').replace(/يحتاج\s+استكمال:\s*\d+/g, ''));
  }

  function filterFamilyMartyrCards() {
    const input = document.getElementById('taldoFamilyMartyrsSearchInput');
    const container = document.getElementById('familyMartyrsContainer');
    const empty = document.getElementById('taldoFamilyMartyrsSearchEmpty');
    if (!input || !container) return;

    const q = normalizeSearchText(input.value);
    const cards = Array.from(container.querySelectorAll('.martyr-card'));
    let visible = 0;

    cards.forEach(card => {
      const name = card.querySelector('.martyr-name')?.textContent || '';
      const father = card.querySelector('.martyr-family')?.textContent || '';
      const text = name + ' ' + father;
      const match = !q || normalizeSearchText(text).includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (empty) empty.classList.toggle('is-visible', !!q && cards.length > 0 && visible === 0);
  }

  function enhanceFamilySearchBars(familyName) {
    ensureFamiliesSearchBar();
    ensureFamilyMartyrsSearchBar(familyName);
    filterFamiliesRows();
    filterFamilyMartyrCards();
  }

  function wrapOpenFamiliesStatsPage() {
    const oldOpenFamilies = window.openFamiliesStatsPage || (typeof openFamiliesStatsPage === 'function' ? openFamiliesStatsPage : null);
    if (typeof oldOpenFamilies !== 'function') return;
    if (oldOpenFamilies.__simpleFamilySearchWrapped === true) return;

    const wrapped = function() {
      const result = oldOpenFamilies.apply(this, arguments);
      setTimeout(function() {
        ensureFamiliesSearchBar();
        filterFamiliesRows();
      }, 0);
      requestAnimationFrame(function() {
        ensureFamiliesSearchBar();
        filterFamiliesRows();
      });
      return result;
    };

    wrapped.__simpleFamilySearchWrapped = true;
    wrapped.__previousOpenFamiliesStatsPage = oldOpenFamilies;
    window.openFamiliesStatsPage = wrapped;

    try {
      openFamiliesStatsPage = window.openFamiliesStatsPage;
    } catch (error) {}
  }

  function wrapOpenFamilyMartyrs() {
    const oldOpenFamily = window.openFamilyMartyrs || (typeof openFamilyMartyrs === 'function' ? openFamilyMartyrs : null);
    if (typeof oldOpenFamily !== 'function') return;
    if (oldOpenFamily.__detailFamilyBackWrapped === true) return;

    const wrapped = function(familyName, noRoute) {
      const fromDetailLink = openingFamilyFromDetailLink === true;
      const result = oldOpenFamily.apply(this, arguments);

      setTimeout(function() {
        ensureFamilyMartyrsSearchBar(familyName);
        filterFamilyMartyrCards();

        if (fromDetailLink) {
          patchFamilyBackButtonToDetail();
        } else {
          clearReturnToDetailState();
          restoreNormalFamilyBackButtonIfNeeded();
        }
      }, 0);

      requestAnimationFrame(function() {
        ensureFamilyMartyrsSearchBar(familyName);
        filterFamilyMartyrCards();
      });

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
    wrapOpenFamiliesStatsPage();
    wrapOpenFamilyMartyrs();
    wrapOpenMartyrDetails();
    setTimeout(function() {
      wrapOpenFamiliesStatsPage();
      wrapOpenFamilyMartyrs();
      wrapOpenMartyrDetails();
      patchDetailFamilyLink();
      patchFamilyBackButtonToDetail();
      enhanceFamilySearchBars();
    }, 1200);
  });

  injectFamilyLinkStyles();
  wrapOpenFamiliesStatsPage();
  wrapOpenFamilyMartyrs();
  wrapOpenMartyrDetails();
})();
