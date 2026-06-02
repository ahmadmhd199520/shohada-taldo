(function() {
  'use strict';

  const TABLET_MAX_WIDTH = 1024;
  const DETAIL_BACK_GUARD_MS = 9000;

  function isCompactViewport() {
    return window.innerWidth <= TABLET_MAX_WIDTH;
  }

  function currentUrlMartyrId() {
    try {
      return new URLSearchParams(window.location.search).get('m') || '';
    } catch (error) {
      return '';
    }
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function setDetailBackGuard(martyrId) {
    const id = String(martyrId || '').trim();
    if (!id) return;

    window.__taldoDetailBackGuard = {
      martyrId: id,
      until: Date.now() + DETAIL_BACK_GUARD_MS
    };
  }

  function shouldBlockStaleDetailsOpen(martyrId, noRoute) {
    const guard = window.__taldoDetailBackGuard;
    if (!guard || !noRoute) return false;
    if (Date.now() > Number(guard.until || 0)) return false;

    const id = String(martyrId || '').trim();
    if (!id || id !== String(guard.martyrId || '').trim()) return false;

    // إذا كان الرابط الحالي يطلب صفحة الشهيد صراحة، فهذا رجوع/تقدم مقصود من المتصفح ولا نمنعه.
    if (currentUrlMartyrId() === id) return false;

    // إذا بقي المستخدم داخل صفحة التفاصيل، لا نمنع إعادة الرسم الداخلي.
    if (activePageId() === 'detailsPage') return false;

    return true;
  }

  function installBackGuardForDetails() {
    const originalOpenMartyrDetails = window.openMartyrDetails;
    if (typeof originalOpenMartyrDetails === 'function' && !originalOpenMartyrDetails.__taldoDetailBackGuardWrapped) {
      const wrappedOpenMartyrDetails = function(martyrId, fromPage, noRoute) {
        if (shouldBlockStaleDetailsOpen(martyrId, noRoute)) {
          return;
        }

        return originalOpenMartyrDetails.apply(this, arguments);
      };

      wrappedOpenMartyrDetails.__taldoDetailBackGuardWrapped = true;
      wrappedOpenMartyrDetails.__taldoOriginal = originalOpenMartyrDetails;
      window.openMartyrDetails = wrappedOpenMartyrDetails;
      try { openMartyrDetails = window.openMartyrDetails; } catch (error) {}
    }

    const originalGoBackFromDetails = window.goBackFromDetails;
    if (typeof originalGoBackFromDetails === 'function' && !originalGoBackFromDetails.__taldoDetailBackGuardWrapped) {
      const wrappedGoBackFromDetails = function() {
        const martyrId = (window.currentDetailsItem || currentDetailsItem || {}).martyr_id || '';
        setDetailBackGuard(martyrId);
        return originalGoBackFromDetails.apply(this, arguments);
      };

      wrappedGoBackFromDetails.__taldoDetailBackGuardWrapped = true;
      wrappedGoBackFromDetails.__taldoOriginal = originalGoBackFromDetails;
      window.goBackFromDetails = wrappedGoBackFromDetails;
      try { goBackFromDetails = window.goBackFromDetails; } catch (error) {}
    }

    const originalShowPage = window.showPage;
    if (typeof originalShowPage === 'function' && !originalShowPage.__taldoDetailBackGuardWrapped) {
      const wrappedShowPage = function(pageId) {
        if (activePageId() === 'detailsPage' && pageId !== 'detailsPage') {
          const martyrId = (window.currentDetailsItem || currentDetailsItem || {}).martyr_id || '';
          setDetailBackGuard(martyrId);
        }

        return originalShowPage.apply(this, arguments);
      };

      wrappedShowPage.__taldoDetailBackGuardWrapped = true;
      wrappedShowPage.__taldoOriginal = originalShowPage;
      window.showPage = wrappedShowPage;
      try { showPage = window.showPage; } catch (error) {}
    }
  }

  function syncTabletFilterControls() {
    if (!isCompactViewport()) return;

    try {
      if (typeof syncMobileFiltersFromDesktop === 'function') {
        syncMobileFiltersFromDesktop();
      }
    } catch (error) {}

    try {
      if (window.TaldoDashboardMobileTools && typeof window.TaldoDashboardMobileTools.ensureControls === 'function') {
        window.TaldoDashboardMobileTools.ensureControls();
      }
    } catch (error) {}
  }

  function rerenderCompactDashboardIfActive() {
    if (!isCompactViewport()) return;
    if (!document.getElementById('dashboardPage')?.classList.contains('active')) return;

    try { if (typeof renderDashboardTable === 'function') renderDashboardTable(); } catch (error) {}
    try { if (typeof renderDataUpdateRequestsTable === 'function') renderDataUpdateRequestsTable(); } catch (error) {}
    try { if (typeof renderJoinRequestsTable === 'function') renderJoinRequestsTable(); } catch (error) {}
  }

  installBackGuardForDetails();

  document.addEventListener('DOMContentLoaded', () => {
    installBackGuardForDetails();
    syncTabletFilterControls();

    setTimeout(() => {
      installBackGuardForDetails();
      syncTabletFilterControls();
      rerenderCompactDashboardIfActive();
    }, 250);
  });

  window.addEventListener('popstate', () => {
    const id = (window.currentDetailsItem || currentDetailsItem || {}).martyr_id || '';
    if (!currentUrlMartyrId()) setDetailBackGuard(id);
  });

  window.addEventListener('resize', () => {
    clearTimeout(window.__taldoTabletFilterResizeTimer);
    window.__taldoTabletFilterResizeTimer = setTimeout(() => {
      syncTabletFilterControls();
      rerenderCompactDashboardIfActive();
    }, 180);
  }, { passive: true });

  window.TaldoTabletBackAndFilterFix = {
    reinstall: installBackGuardForDetails,
    syncControls: syncTabletFilterControls
  };
})();
