(function() {
  'use strict';

  const LAST_PAGE_KEY = 'taldo_last_active_page';
  const LAST_DASH_TAB_KEY = 'taldo_last_dashboard_tab';

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

  function hasDashboardData() {
    try {
      return Array.isArray(dashboardData) && dashboardData.length > 0;
    } catch (e) {
      return false;
    }
  }

  function getWantedDashboardTab() {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get('tab') ||
      localStorage.getItem(LAST_DASH_TAB_KEY) ||
      'martyrs'
    );
  }

  function rememberDashboardTab(tabName) {
    try {
      localStorage.setItem(LAST_PAGE_KEY, 'dashboard');
      localStorage.setItem(LAST_DASH_TAB_KEY, tabName || 'martyrs');
    } catch (e) {}
  }

  function syncDashboardUrl(tabName) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'dashboard');
      url.searchParams.set('tab', tabName || 'martyrs');
      window.history.replaceState({ page: 'dashboard', tab: tabName || 'martyrs' }, '', url.toString());
    } catch (e) {}
  }

  function renderDashboardIfPossible() {
    try {
      if (typeof updateDashboardStats === 'function') updateDashboardStats();
    } catch (e) {}

    try {
      if (typeof renderDashboardTable === 'function') renderDashboardTable();
    } catch (e) {}

    try {
      if (typeof renderDataUpdateRequestsTable === 'function') renderDataUpdateRequestsTable();
    } catch (e) {}

    try {
      if (typeof renderJoinRequestsTable === 'function') renderJoinRequestsTable();
    } catch (e) {}

    try {
      if (typeof renderInboxTable === 'function') renderInboxTable();
    } catch (e) {}
  }

  function dashboardBodyStillLoading() {
    const body = document.getElementById('dashboardTableBody');
    if (!body) return false;

    return String(body.textContent || '').includes('جاري تحميل بيانات لوحة التحكم');
  }

  function loadDashboardFast(tabName) {
    if (!isAdminMode()) return;

    tabName = tabName || getWantedDashboardTab();

    rememberDashboardTab(tabName);

    try {
      if (typeof showPage === 'function') {
        showPage('dashboardPage');
      } else {
        document.querySelectorAll('.page-section').forEach(function(section) {
          section.classList.remove('active');
        });
        document.getElementById('dashboardPage')?.classList.add('active');
      }
    } catch (e) {}

    try {
      if (typeof showDashboardTab === 'function') {
        showDashboardTab(tabName);
      }
    } catch (e) {}

    syncDashboardUrl(tabName);

    if (hasDashboardData()) {
      renderDashboardIfPossible();
      return;
    }

    if (typeof refreshDashboardData === 'function') {
      /*
        مهم:
        لا نستخدم forceFresh هنا، حتى لا يكون التحميل بطيئًا جدًا.
        الدالة ستعرض كاش لوحة التحكم أولًا إن وجد، ثم تجلب الجديد.
      */
      refreshDashboardData(false, {
        useClientCache: true,
        forceFresh: false
      });
    }
  }

  /*
    نحفظ أنك كنت في لوحة التحكم، ونحفظ آخر تبويب.
  */
  const oldShowDashboardTab =
    window.showDashboardTab ||
    (typeof showDashboardTab === 'function' ? showDashboardTab : null);

  if (typeof oldShowDashboardTab === 'function' && !oldShowDashboardTab.__dashboardReloadAutoFix) {
    window.showDashboardTab = function(tabName) {
      const result = oldShowDashboardTab.apply(this, arguments);

      if (activePageId() === 'dashboardPage') {
        rememberDashboardTab(tabName || 'martyrs');
        syncDashboardUrl(tabName || 'martyrs');
      }

      return result;
    };

    window.showDashboardTab.__dashboardReloadAutoFix = true;

    try {
      showDashboardTab = window.showDashboardTab;
    } catch (e) {}
  }

  const oldOpenDashboardPage =
    window.openDashboardPage ||
    (typeof openDashboardPage === 'function' ? openDashboardPage : null);

  if (typeof oldOpenDashboardPage === 'function' && !oldOpenDashboardPage.__dashboardReloadAutoFix) {
    window.openDashboardPage = function(tabName) {
      rememberDashboardTab(tabName || getWantedDashboardTab());

      const result = oldOpenDashboardPage.apply(this, arguments);

      setTimeout(function() {
        rememberDashboardTab(tabName || getWantedDashboardTab());
        syncDashboardUrl(tabName || getWantedDashboardTab());
      }, 150);

      return result;
    };

    window.openDashboardPage.__dashboardReloadAutoFix = true;

    try {
      openDashboardPage = window.openDashboardPage;
    } catch (e) {}
  }

  /*
    إذا خرجت للرئيسية، لا نعيد فتح لوحة التحكم بعد التحديث القادم.
  */
  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__dashboardReloadAutoFix) {
    window.showPage = function(pageId) {
      const result = oldShowPage.apply(this, arguments);

      try {
        if (pageId === 'dashboardPage') {
          localStorage.setItem(LAST_PAGE_KEY, 'dashboard');
        }

        if (pageId === 'homePage') {
          localStorage.setItem(LAST_PAGE_KEY, 'home');
        }
      } catch (e) {}

      return result;
    };

    window.showPage.__dashboardReloadAutoFix = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }

  function shouldRestoreDashboardAfterReload() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('page') === 'dashboard') return true;

    try {
      return localStorage.getItem(LAST_PAGE_KEY) === 'dashboard';
    } catch (e) {
      return false;
    }
  }

  function bootDashboardReloadFix() {
    if (!isAdminMode()) return;
    if (!shouldRestoreDashboardAfterReload()) return;

    const tab = getWantedDashboardTab();

    /*
      نكرر المحاولة لأن loadInitialData وبعض ملفات التوجيه تعمل بعد تحميل الصفحة.
    */
    setTimeout(function() {
      loadDashboardFast(tab);
    }, 500);

    setTimeout(function() {
      if (activePageId() !== 'dashboardPage' || dashboardBodyStillLoading()) {
        loadDashboardFast(tab);
      }
    }, 1400);

    setTimeout(function() {
      if (activePageId() === 'dashboardPage' && dashboardBodyStillLoading()) {
        loadDashboardFast(tab);
      }
    }, 2600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDashboardReloadFix);
  } else {
    bootDashboardReloadFix();
  }

  window.addEventListener('load', function() {
    setTimeout(bootDashboardReloadFix, 300);
  });
})();
