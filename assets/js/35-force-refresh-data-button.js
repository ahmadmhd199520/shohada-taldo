(function() {
  'use strict';

  let isForceRefreshing = false;

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getCurrentScroll() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScroll(pos) {
    if (!pos) return;

    const restore = function() {
      window.scrollTo({
        left: Number(pos.x || 0),
        top: Number(pos.y || 0),
        behavior: 'auto'
      });
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 150);
  }

function clearAllTaldoCaches() {
  /*
    مهم جدًا:
    لا نمسح sessionStorage هنا إطلاقًا
    ولا نمسح كل مفاتيح taldo_
    لأن جلسة الأدمن قد تكون محفوظة هناك.
    نمسح فقط كاش بيانات API.
  */

  try {
    Object.keys(localStorage).forEach(function(key) {
      if (
        key.startsWith('taldo_api_cache') ||
        key.startsWith('taldo_api_cache_v5:')
      ) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {}

  try {
    window.__taldoBypassPublicCacheUntil = Date.now() + 120 * 1000;
  } catch (e) {}
}
  
  function invalidatePreparedRows(list) {
    if (!Array.isArray(list)) return;

    list.forEach(function(item) {
      if (!item) return;

      item.__perfPrepared = false;
      item.__dashboardPrepared = false;
      item.__requestPrepared = false;

      try {
        delete item.__searchText;
        delete item.__familyKey;
        delete item.__createdSort;
        delete item.__dashboardSearch;
        delete item.__statusKey;
        delete item.__familyLower;
      } catch (e) {}
    });
  }

  function applyFreshInitialData(res) {
    if (!res || !res.success) return false;

    try {
      allFamilies = res.families || [];
    } catch (e) {}

    try {
      statsData = res.stats || {};
    } catch (e) {}

    try {
      allMartyrs = res.martyrs || [];
      invalidatePreparedRows(allMartyrs);
    } catch (e) {}

    try {
      siteMessages = res.messages || [];
    } catch (e) {}

    try {
      publicSettings = res.settings || {};
    } catch (e) {}

    return true;
  }

  function rerenderCurrentVisiblePage(activeBefore, scrollBefore) {
    try {
      if (typeof fillFamiliesSelects === 'function') {
        fillFamiliesSelects();
      }
    } catch (e) {}

    try {
      if (typeof updateStatsCards === 'function') {
        updateStatsCards();
      }
    } catch (e) {}

    if (activeBefore === 'homePage') {
      try {
        if (typeof resetMartyrsPageAndRender === 'function') {
          resetMartyrsPageAndRender();
        } else if (typeof renderMartyrs === 'function') {
          renderMartyrs();
        }
      } catch (e) {}

      restoreScroll(scrollBefore);
      return;
    }

    if (activeBefore === 'familiesPage') {
      try {
        if (typeof openFamiliesStatsPage === 'function') {
          openFamiliesStatsPage();
        }
      } catch (e) {}

      restoreScroll(scrollBefore);
      return;
    }

    if (activeBefore === 'familyMartyrsPage') {
      try {
        const params = new URLSearchParams(window.location.search);
        const family = params.get('family');

        if (family && typeof openFamilyMartyrs === 'function') {
          openFamilyMartyrs(family, true);
        }
      } catch (e) {}

      restoreScroll(scrollBefore);
      return;
    }

    if (activeBefore === 'detailsPage') {
      try {
        const id =
          currentDetailsItem?.martyr_id ||
          new URLSearchParams(window.location.search).get('m');

        let fromPage = 'homePage';

        try {
          fromPage = lastPageBeforeDetails || 'homePage';
        } catch (e) {}

        if (id && typeof openMartyrDetails === 'function') {
          openMartyrDetails(id, fromPage, true);
        }
      } catch (e) {}

      restoreScroll(scrollBefore);
      return;
    }

    if (activeBefore === 'dashboardPage') {
      try {
        if (typeof refreshDashboardData === 'function' && isAdminMode()) {
          refreshDashboardData(false);
        }
      } catch (e) {}

      restoreScroll(scrollBefore);
      return;
    }

    restoreScroll(scrollBefore);
  }

  function setButtonsLoading(loading) {
    document.querySelectorAll('.taldo-force-refresh-btn').forEach(function(btn) {
      btn.disabled = !!loading;

      btn.innerHTML = loading
        ? `<span class="spinner-border spinner-border-sm"></span>`
        : `<i class="fa-solid fa-rotate"></i>`;
    });
  }

  async function forceRefreshData() {
    if (isForceRefreshing) return;

    isForceRefreshing = true;

    const activeBefore = activePageId();
    const scrollBefore = getCurrentScroll();

    setButtonsLoading(true);

    try {
      clearAllTaldoCaches();

      const res = await apiRequest(
        'getInitialData',
        {
          forceRefresh: Date.now(),
          bypassCache: true
        },
        {
          forceNetwork: true,
          forceFresh: true,
          useClientCache: false
        }
      );

      const applied = applyFreshInitialData(res);

      if (!applied) {
        showToast('تعذر تحديث البيانات.');
        return;
      }

      rerenderCurrentVisiblePage(activeBefore, scrollBefore);

      showToast('تم تحديث البيانات.');
    } catch (err) {
      showToast(err.message || 'تعذر تحديث البيانات.');
    } finally {
      isForceRefreshing = false;
      setButtonsLoading(false);
    }
  }

  window.forceRefreshTaldoData = forceRefreshData;

  function makeRefreshButton(extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-success taldo-force-refresh-btn ${extraClass || ''}`;
    btn.title = 'تحديث قسري للبيانات';
    btn.setAttribute('aria-label', 'تحديث قسري للبيانات');
    btn.onclick = function() {
  if (typeof window.forceRefreshTaldoData === 'function') {
    return window.forceRefreshTaldoData();
  }

  return forceRefreshData();
};
    btn.innerHTML = `<i class="fa-solid fa-rotate"></i>`;
    return btn;
  }

  function installMobileButton() {
    const bar = document.querySelector('.mobile-search-filter');
    if (!bar || document.getElementById('mobileForceRefreshBtn')) return;

    const filterBtn = bar.querySelector('button');

    const btn = makeRefreshButton('');
    btn.id = 'mobileForceRefreshBtn';

    if (filterBtn && filterBtn.parentElement === bar) {
      filterBtn.insertAdjacentElement('afterend', btn);
    } else {
      bar.appendChild(btn);
    }
  }

  function installDesktopButton() {
    const row = document.querySelector('.desktop-filter-card .row');
    if (!row || document.getElementById('desktopForceRefreshBox')) return;

    const box = document.createElement('div');
    box.id = 'desktopForceRefreshBox';
    box.className = 'col-lg-2 col-md-6 taldo-force-refresh-desktop-box';

    box.innerHTML = `
      <label class="form-label fw-bold">تحديث</label>
      <button type="button" class="btn btn-success w-100 taldo-force-refresh-btn" onclick="forceRefreshTaldoData()" title="تحديث قسري للبيانات">
        <i class="fa-solid fa-rotate ms-1"></i>
        تحديث قسري
      </button>
    `;

    row.appendChild(box);
  }

  function updateVisibility() {
    const show = isAdminMode();

    document.querySelectorAll('.taldo-force-refresh-btn, #desktopForceRefreshBox').forEach(function(el) {
      el.classList.toggle('d-none', !show);
    });
  }

  function installForceRefreshButtons() {
    installMobileButton();
    installDesktopButton();
    updateVisibility();
  }

  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__forceRefreshButtonWrapped) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);

      installForceRefreshButtons();
      updateVisibility();

      return result;
    };

    window.updateAdminButtons.__forceRefreshButtonWrapped = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installForceRefreshButtons);
  } else {
    installForceRefreshButtons();
  }

  setTimeout(installForceRefreshButtons, 600);
})();
