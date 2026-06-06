(function() {
  'use strict';

  const SYNC_ACTION = 'getDashboardSyncState';
  const SYNC_INTERVAL_MS = 12000;
  const FIRST_CHECK_DELAY_MS = 900;
  const MIN_REFRESH_GAP_MS = 2500;
  const ADMIN_DASHBOARD_CACHE_KEY = 'taldo_admin_dashboard_cache_v2';

  const MUTATING_ACTIONS = new Set([
    'submitMartyr',
    'updateVerificationStatus',
    'submitDataUpdate',
    'submitDataUpdateApproved',
    'approveDataUpdate',
    'rejectDataUpdate',
    'updateDataRequestStatus',
    'submitJoinRequest',
    'updateJoinRequestStatus',
    'saveSiteMessage',
    'updateSiteMessageStatus',
    'updateSettingValue',
    'updateMartyrFields',
    'setMartyrCompletionOptions',
    'verifyMartyrWithCompletion',
    'submitMessageReply',
    'submitInboxMessage',
    'hideInboxMessage',
    'deleteMartyrImage',
    'setPrimaryMartyrImage',
    'updateMartyrImagePosition',
    'setHoulaMassacreStatus',
    'setMartyrImageUploadBlocked'
  ]);

  const state = {
    timer: null,
    checking: false,
    lastVersion: null,
    lastRefreshAt: 0,
    startedAt: Date.now()
  };

  function getApi() {
    return window.apiRequest || (typeof apiRequest === 'function' ? apiRequest : null);
  }

  function isAdminMode() {
    try {
      if (typeof isAdminLoggedIn !== 'undefined') return !!isAdminLoggedIn;
    } catch (e) {}
    return !!window.isAdminLoggedIn;
  }

  function activePageId() {
    const active = document.querySelector('.page-section.active');
    return active ? active.id : '';
  }

  function isDashboardOpen() {
    const page = document.getElementById('dashboardPage');
    return activePageId() === 'dashboardPage' || !!(page && page.classList.contains('active'));
  }

  function safeToast(message) {
    try {
      if (typeof showToast === 'function') showToast(message);
    } catch (e) {}
  }

  function clearDashboardClientCache() {
    try {
      sessionStorage.removeItem(ADMIN_DASHBOARD_CACHE_KEY);
    } catch (e) {}
  }

  function updateLocalVersionFromResult(res) {
    if (!res) return;

    const rawVersion =
      res.dashboard_sync_version ||
      res.syncVersion ||
      (res.dashboardSync && res.dashboardSync.version) ||
      '';

    const version = Number(rawVersion || 0);
    if (!version) return;

    if (state.lastVersion === null || version > state.lastVersion) {
      state.lastVersion = version;
    }
  }

  function dispatchSyncEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) {}
  }

  async function refreshDashboardBecauseOfSync(syncState) {
    const now = Date.now();
    if (now - state.lastRefreshAt < MIN_REFRESH_GAP_MS) return;
    state.lastRefreshAt = now;

    clearDashboardClientCache();

    try {
      if (window.TaldoDashboardStableTools && typeof window.TaldoDashboardStableTools.clearCache === 'function') {
        window.TaldoDashboardStableTools.clearCache();
      }
    } catch (e) {}

    if (typeof refreshDashboardData === 'function') {
      await Promise.resolve(refreshDashboardData(false, {
        forceFresh: true,
        useClientCache: false,
        source: 'cross-admin-sync'
      }));
    } else if (window.TaldoDashboardStableTools && typeof window.TaldoDashboardStableTools.refresh === 'function') {
      await Promise.resolve(window.TaldoDashboardStableTools.refresh());
    }

    dispatchSyncEvent('taldo:dashboard-synced', syncState || {});
    safeToast('تم تحديث لوحة التحكم لأن أدمنًا آخر أجرى تعديلًا.');
  }

  async function checkDashboardSync(reason) {
    const api = getApi();
    if (!api || state.checking) return;
    if (!isAdminMode()) return;
    if (!isDashboardOpen()) return;

    state.checking = true;

    try {
      const res = await api(SYNC_ACTION, {
        __cacheBust: String(Date.now()),
        reason: reason || 'interval'
      }, {
        forceFresh: true,
        forceNetwork: true,
        useClientCache: false
      });

      if (!res || res.success === false) return;

      const serverVersion = Number(res.version || 0);
      if (!serverVersion) return;

      if (state.lastVersion === null) {
        state.lastVersion = serverVersion;
        return;
      }

      if (serverVersion > state.lastVersion) {
        state.lastVersion = serverVersion;
        await refreshDashboardBecauseOfSync(res);
      }
    } catch (err) {
      // لا نزعج المستخدم بخطأ فحص التزامن؛ زر التحديث اليدوي يبقى متاحًا.
      try { console.warn('dashboard sync check failed:', err); } catch (e) {}
    } finally {
      state.checking = false;
    }
  }

  function startDashboardSyncWatcher() {
    if (state.timer) return;

    state.timer = setInterval(function() {
      checkDashboardSync('interval');
    }, SYNC_INTERVAL_MS);

    setTimeout(function() {
      checkDashboardSync('start');
    }, FIRST_CHECK_DELAY_MS);
  }

  function stopDashboardSyncWatcher() {
    if (!state.timer) return;
    clearInterval(state.timer);
    state.timer = null;
  }

  function bindVisibilityAndFocus() {
    if (window.__taldoCrossAdminSyncVisibilityBound) return;
    window.__taldoCrossAdminSyncVisibilityBound = true;

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        startDashboardSyncWatcher();
        checkDashboardSync('visibility');
      }
    });

    window.addEventListener('focus', function() {
      startDashboardSyncWatcher();
      checkDashboardSync('focus');
    });
  }

  function wrapApiRequestForSyncVersion() {
    const oldApi = getApi();
    if (typeof oldApi !== 'function') return;
    if (oldApi.__taldoCrossAdminSyncWrapped) return;

    window.apiRequest = function(action, data, options) {
      return oldApi.apply(this, arguments).then(function(res) {
        updateLocalVersionFromResult(res);

        if (MUTATING_ACTIONS.has(action) && res && res.success !== false) {
          clearDashboardClientCache();
          startDashboardSyncWatcher();
        }

        return res;
      });
    };

    window.apiRequest.__taldoCrossAdminSyncWrapped = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }

  function wrapDashboardOpen() {
    const oldOpenDashboardPage = window.openDashboardPage || (typeof openDashboardPage === 'function' ? openDashboardPage : null);
    if (typeof oldOpenDashboardPage === 'function' && !oldOpenDashboardPage.__taldoCrossAdminSyncWrapped) {
      window.openDashboardPage = function() {
        const result = oldOpenDashboardPage.apply(this, arguments);
        setTimeout(function() {
          startDashboardSyncWatcher();
          checkDashboardSync('open-dashboard');
        }, 700);
        return result;
      };
      window.openDashboardPage.__taldoCrossAdminSyncWrapped = true;
      try { openDashboardPage = window.openDashboardPage; } catch (e) {}
    }
  }

  function boot() {
    wrapApiRequestForSyncVersion();
    wrapDashboardOpen();
    bindVisibilityAndFocus();

    if (isAdminMode() && isDashboardOpen()) {
      startDashboardSyncWatcher();
    }

    setTimeout(function() {
      wrapApiRequestForSyncVersion();
      wrapDashboardOpen();
      if (isAdminMode() && isDashboardOpen()) startDashboardSyncWatcher();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.TaldoDashboardCrossAdminSync = {
    start: startDashboardSyncWatcher,
    stop: stopDashboardSyncWatcher,
    check: checkDashboardSync,
    state: state
  };
})();
