(function() {
  'use strict';

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function getCurrentDetailsMartyrId() {
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

  function getDetailsFromPage() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function clearTaldoCachesForDetailsRefresh() {
    try {
      if (typeof window.clearTaldoAllClientCaches === 'function') {
        window.clearTaldoAllClientCaches();
      }
    } catch (e) {}

    try {
      Object.keys(localStorage).forEach(function(key) {
        if (
          key.startsWith('taldo_api_cache') ||
          key.includes('taldo_api') ||
          key.includes('martyrs') ||
          key.includes('dashboard')
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }

  function invalidateRows(list) {
    if (!Array.isArray(list)) return;

    list.forEach(function(item) {
      if (!item) return;

      item.__perfPrepared = false;
      item.__dashboardPrepared = false;

      try {
        delete item.__searchText;
        delete item.__familyKey;
        delete item.__createdSort;
        delete item.__dashboardSearch;
      } catch (e) {}
    });
  }

  window.refreshCurrentDetailsPage = async function() {
    const martyrId = getCurrentDetailsMartyrId();

    if (!martyrId) {
      showToast('تعذر تحديد صفحة الشهيد الحالية.');
      return;
    }

    const btn = document.getElementById('detailsRefreshBtn');
    const oldHtml = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    }

    try {
      clearTaldoCachesForDetailsRefresh();

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

      if (!res || !res.success) {
        showToast('تعذر تحديث البيانات.');
        return;
      }

      try {
        allFamilies = res.families || allFamilies || [];
        statsData = res.stats || statsData || {};
        allMartyrs = res.martyrs || allMartyrs || [];
        invalidateRows(allMartyrs);
      } catch (e) {}

      const item = (allMartyrs || []).find(function(row) {
        return String(row.martyr_id || '') === String(martyrId);
      });

      if (!item) {
        showToast('لم يعد هذا الاسم موجودًا ضمن البيانات.');
        return;
      }

      try {
        currentDetailsItem = item;
      } catch (e) {}

      openMartyrDetails(martyrId, getDetailsFromPage(), true);
      showToast('تم تحديث صفحة الشهيد.');
    } catch (err) {
      showToast(err.message || 'تعذر تحديث صفحة الشهيد.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml || `<i class="fa-solid fa-rotate ms-1"></i> تحديث`;
      }
    }
  };

  function installDetailsRefreshButton() {
    const header = document.querySelector('#detailsPage > .d-flex.justify-content-between.align-items-center.mb-3');
    const backBtn = header?.querySelector('button[onclick*="goBackFromDetails"]');

    if (!header || !backBtn || document.getElementById('detailsRefreshBtn')) return;

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'details-header-actions d-flex gap-2 align-items-center flex-shrink-0';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.id = 'detailsRefreshBtn';
    refreshBtn.className = 'btn btn-outline-success';
    refreshBtn.onclick = window.refreshCurrentDetailsPage;
    refreshBtn.innerHTML = `<i class="fa-solid fa-rotate ms-1"></i> تحديث`;

    backBtn.parentNode.insertBefore(actionsWrap, backBtn);
    actionsWrap.appendChild(refreshBtn);
    actionsWrap.appendChild(backBtn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDetailsRefreshButton);
  } else {
    installDetailsRefreshButton();
  }

  setTimeout(installDetailsRefreshButton, 700);
})();
