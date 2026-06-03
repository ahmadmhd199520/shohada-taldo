(function() {
  'use strict';

  let safeRefreshRunning = false;

  function isAdminModeSafe() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function activePageIdSafe() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScrollSafe() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScrollSafe(pos) {
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

  function safeClearPublicDataCacheOnly() {
    /*
      مهم جدًا:
      لا نمسح sessionStorage ولا مفاتيح تسجيل الدخول.
      نمسح فقط كاش API الخاص بالبيانات العامة.
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

  /*
    نعيد تعريف دالة تنظيف الكاش القديمة بطريقة آمنة
    حتى لو استدعاها أي ملف قديم لا تؤدي لتسجيل الخروج.
  */
  window.clearTaldoAllClientCaches = safeClearPublicDataCacheOnly;
  window.forceTaldoPublicFreshData = function() {
    safeClearPublicDataCacheOnly();
    window.__taldoBypassPublicCacheUntil = Date.now() + 120 * 1000;
  };

  function invalidateRowsSafe(list) {
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

  function applyInitialDataSafe(res) {
    if (!res || !res.success) return false;

    try {
      allFamilies = res.families || [];
    } catch (e) {}

    try {
      statsData = res.stats || {};
    } catch (e) {}

    try {
      allMartyrs = res.martyrs || [];
      invalidateRowsSafe(allMartyrs);
    } catch (e) {}

    try {
      siteMessages = res.messages || [];
    } catch (e) {}

    try {
      publicSettings = res.settings || {};
    } catch (e) {}

    return true;
  }

  function findInListSafe(list, martyrId) {
    if (!Array.isArray(list)) return null;

    return list.find(function(item) {
      return String(item?.martyr_id || '') === String(martyrId || '');
    }) || null;
  }

  function syncCurrentItemIntoDashboardSafe(martyrId) {
    if (!isAdminModeSafe() || !martyrId) return;

    let item = null;

    try {
      item = findInListSafe(allMartyrs, martyrId);
    } catch (e) {}

    if (!item) return;

    try {
      if (!Array.isArray(dashboardData)) {
        dashboardData = [];
      }

      const index = dashboardData.findIndex(function(row) {
        return String(row?.martyr_id || '') === String(martyrId || '');
      });

      const cloned = Object.assign({}, item);

      if (index >= 0) {
        dashboardData[index] = Object.assign({}, dashboardData[index], cloned);
      } else {
        dashboardData.unshift(cloned);
      }

      invalidateRowsSafe(dashboardData);
    } catch (e) {}
  }

  function syncAllPublicIntoDashboardSafe() {
    if (!isAdminModeSafe()) return;

    try {
      if (!Array.isArray(allMartyrs)) return;

      if (!Array.isArray(dashboardData)) {
        dashboardData = [];
      }

      allMartyrs.forEach(function(item) {
        if (!item || !item.martyr_id) return;

        const exists = findInListSafe(dashboardData, item.martyr_id);

        if (!exists) {
          dashboardData.unshift(Object.assign({}, item));
        }
      });

      invalidateRowsSafe(dashboardData);
    } catch (e) {}
  }

  function getCurrentDetailsIdSafe() {
    try {
      if (currentDetailsItem && currentDetailsItem.martyr_id) {
        return currentDetailsItem.martyr_id;
      }
    } catch (e) {}

    try {
      return new URLSearchParams(window.location.search).get('m') || '';
    } catch (e) {
      return '';
    }
  }

  function getLastPageBeforeDetailsSafe() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function rerenderAfterSafeRefresh(activeBefore, scrollBefore) {
    try {
      if (typeof fillFamiliesSelects === 'function') fillFamiliesSelects();
    } catch (e) {}

    try {
      if (typeof updateStatsCards === 'function') updateStatsCards();
    } catch (e) {}

    if (activeBefore === 'detailsPage') {
      const martyrId = getCurrentDetailsIdSafe();

      if (martyrId) {
        syncCurrentItemIntoDashboardSafe(martyrId);

        try {
          if (typeof openMartyrDetails === 'function') {
            openMartyrDetails(martyrId, getLastPageBeforeDetailsSafe(), true);
          }
        } catch (e) {}
      }

      restoreScrollSafe(scrollBefore);
      return;
    }

    if (activeBefore === 'homePage') {
      syncAllPublicIntoDashboardSafe();

      try {
        if (typeof renderMartyrs === 'function') renderMartyrs();
      } catch (e) {}

      restoreScrollSafe(scrollBefore);
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

      restoreScrollSafe(scrollBefore);
      return;
    }

    if (activeBefore === 'familiesPage') {
      try {
        if (typeof openFamiliesStatsPage === 'function') {
          openFamiliesStatsPage();
        }
      } catch (e) {}

      restoreScrollSafe(scrollBefore);
      return;
    }

    if (activeBefore === 'dashboardPage') {
      try {
        if (typeof renderDashboardTable === 'function') renderDashboardTable();
      } catch (e) {}

      try {
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
      } catch (e) {}

      restoreScrollSafe(scrollBefore);
      return;
    }

    restoreScrollSafe(scrollBefore);
  }

  function setRefreshButtonsLoadingSafe(loading) {
    document.querySelectorAll('.taldo-force-refresh-btn, #detailsRefreshBtn').forEach(function(btn) {
      btn.disabled = !!loading;

      if (btn.id === 'detailsRefreshBtn') {
        btn.innerHTML = loading
          ? `<span class="spinner-border spinner-border-sm"></span>`
          : `<i class="fa-solid fa-rotate ms-1"></i> تحديث`;
        return;
      }

      btn.innerHTML = loading
        ? `<span class="spinner-border spinner-border-sm"></span>`
        : `<i class="fa-solid fa-rotate"></i>`;
    });
  }

  async function fetchFreshInitialDataSafe() {
    safeClearPublicDataCacheOnly();

    /*
      نضع قيمة متغيرة داخل data أيضًا.
      حتى لو لم يفهم apiRequest options، سيختلف مفتاح الكاش.
    */
    return apiRequest(
      'getInitialData',
      {
        _force_refresh: Date.now(),
        _bypass_cache: true
      },
      {
        forceNetwork: true,
        forceFresh: true,
        useClientCache: false
      }
    );
  }

  window.forceRefreshTaldoData = async function(options) {
    if (safeRefreshRunning) return;

    options = options || {};

    safeRefreshRunning = true;

    const activeBefore = activePageIdSafe();
    const scrollBefore = getScrollSafe();

    if (!options.silent) {
      setRefreshButtonsLoadingSafe(true);
    }

    try {
      const res = await fetchFreshInitialDataSafe();

      if (!applyInitialDataSafe(res)) {
        if (!options.silent) showToast('تعذر تحديث البيانات.');
        return;
      }

      syncAllPublicIntoDashboardSafe();
      rerenderAfterSafeRefresh(activeBefore, scrollBefore);

      if (!options.silent) {
        showToast('تم تحديث البيانات.');
      }
    } catch (err) {
      if (!options.silent) {
        showToast(err.message || 'تعذر تحديث البيانات.');
      }
    } finally {
      safeRefreshRunning = false;

      if (!options.silent) {
        setRefreshButtonsLoadingSafe(false);
      }
    }
  };

  window.refreshCurrentDetailsPage = async function() {
    if (safeRefreshRunning) return;

    safeRefreshRunning = true;

    const activeBefore = activePageIdSafe();
    const scrollBefore = getScrollSafe();
    const martyrId = getCurrentDetailsIdSafe();

    if (!martyrId) {
      showToast('تعذر تحديد صفحة الشهيد الحالية.');
      safeRefreshRunning = false;
      return;
    }

    setRefreshButtonsLoadingSafe(true);

    try {
      const res = await fetchFreshInitialDataSafe();

      if (!applyInitialDataSafe(res)) {
        showToast('تعذر تحديث البيانات.');
        return;
      }

      const item = findInListSafe(allMartyrs, martyrId);

      if (!item) {
        showToast('لم يعد هذا الاسم موجودًا ضمن البيانات.');
        return;
      }

      try {
        currentDetailsItem = item;
      } catch (e) {}

      syncCurrentItemIntoDashboardSafe(martyrId);
      rerenderAfterSafeRefresh(activeBefore || 'detailsPage', scrollBefore);

      showToast('تم تحديث صفحة الشهيد.');
    } catch (err) {
      showToast(err.message || 'تعذر تحديث صفحة الشهيد.');
    } finally {
      safeRefreshRunning = false;
      setRefreshButtonsLoadingSafe(false);
    }
  };

  /*
    بعد نشر اسم جديد، خصوصًا "نشر كموثق"، نعمل تحديثًا صامتًا
    بدون تسجيل خروج وبدون مسح جلسة الأدمن.
  */
  const oldApiRequest =
    window.apiRequest ||
    (typeof apiRequest === 'function' ? apiRequest : null);

  if (typeof oldApiRequest === 'function' && !oldApiRequest.__safeAdminRefreshFix) {
    window.apiRequest = function(action, data, options) {
      return oldApiRequest.apply(this, arguments).then(function(res) {
        if (
          action === 'submitMartyr' &&
          res &&
          res.success !== false
        ) {
          setTimeout(function() {
            try {
              window.forceRefreshTaldoData({ silent: true });
            } catch (e) {}
          }, 700);

          setTimeout(function() {
            try {
              window.forceRefreshTaldoData({ silent: true });
            } catch (e) {}
          }, 1800);
        }

        return res;
      });
    };

    window.apiRequest.__safeAdminRefreshFix = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }
})();
