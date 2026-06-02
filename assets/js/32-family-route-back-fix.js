(function() {
  'use strict';

  let lastOpenedFamilyName = '';

  function setActivePageNoScroll(pageId) {
    document.querySelectorAll('.page-section').forEach(function(section) {
      section.classList.remove('active');
    });

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
  }

  function safeUpdateRoute(url, state) {
    try {
      if (typeof updateRoute === 'function') {
        updateRoute(url, state || {});
      } else {
        window.history.pushState(state || {}, '', url);
      }
    } catch (e) {}
  }

  function getFamilyStatsList() {
    try {
      return statsData?.byFamily || [];
    } catch (e) {
      return [];
    }
  }

  function buildFamiliesStatsContent() {
    const container = document.getElementById('familiesStatsContainer');
    if (!container) return;

    const byFamily = getFamilyStatsList();

    if (!byFamily.length) {
      container.innerHTML = `
        <div class="empty-state">
          لا توجد إحصائيات بعد.
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    byFamily.forEach(function(item) {
      const familyName = item.family_name || '';
      const verifiedCount = Number(item.verified || 0);
      const pendingCount = Number(item.pending || 0);
      const visibleTotal = verifiedCount + pendingCount;

      const row = document.createElement('div');
      row.className = 'family-row';

      row.onclick = function() {
        openFamilyMartyrsStable(familyName);
      };

      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-3">
          <div>
            <h5 class="fw-bold mb-1">عائلة ${escapeHtml(familyName)}</h5>
            <div class="text-muted small">إجمالي الأسماء: ${visibleTotal}</div>
          </div>

          <div class="text-end">
            <span class="badge badge-soft-blue me-1">موثق: ${verifiedCount}</span>
            <span class="badge text-bg-warning me-1">بانتظار: ${pendingCount}</span>
            <i class="fa-solid fa-chevron-left text-muted me-2"></i>
          </div>
        </div>
      `;

      container.appendChild(row);
    });
  }

  function showFamiliesStatsStable(pushRoute) {
    buildFamiliesStatsContent();

    if (pushRoute) {
      safeUpdateRoute('?page=families', {
        page: 'families'
      });
    }

    if (typeof showPage === 'function') {
      showPage('familiesPage');
    } else {
      setActivePageNoScroll('familiesPage');
    }
  }

  function renderFamilyMartyrsContent(familyName) {
    const title = document.getElementById('familyPageTitle');
    const container = document.getElementById('familyMartyrsContainer');

    if (title) {
      title.textContent = `شهداء عائلة ${familyName}`;
    }

    if (!container) return;

    const source = isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length
      ? dashboardData
      : allMartyrs;

    const list = (source || []).filter(function(item) {
      return item.family_name === familyName && item.verification_status !== 'مرفوض';
    });

    container.innerHTML = list.length
      ? `<div class="martyrs-grid">${list.map(renderMartyrCardForFamily).join('')}</div>`
      : `<div class="empty-state">لا توجد أسماء لهذه العائلة.</div>`;
  }

  function openFamilyMartyrsStable(familyName, noRoute) {
    if (!familyName) {
      showFamiliesStatsStable(!noRoute);
      return;
    }

    lastOpenedFamilyName = familyName;

    renderFamilyMartyrsContent(familyName);

    if (!noRoute) {
      safeUpdateRoute(`?family=${encodeURIComponent(familyName)}`, {
        page: 'family',
        family: familyName
      });
    }

    if (typeof showPage === 'function') {
      showPage('familyMartyrsPage');
    } else {
      setActivePageNoScroll('familyMartyrsPage');
    }
  }

  /*
    نستبدل فتح صفحة العائلة بنسخة مستقرة تعيد بناء المحتوى دائمًا.
  */
  window.openFamilyMartyrs = function(familyName, noRoute) {
    openFamilyMartyrsStable(familyName, noRoute);
  };

  try {
    openFamilyMartyrs = window.openFamilyMartyrs;
  } catch (e) {}

  /*
    نستبدل زر صفحة "إحصائيات بحسب العائلة" بنسخة تعيد بناء المحتوى دائمًا.
  */
  window.openFamiliesStatsPage = function() {
    showFamiliesStatsStable(true);
  };

  try {
    openFamiliesStatsPage = window.openFamiliesStatsPage;
  } catch (e) {}

  /*
    إصلاح زر الرجوع الموجود داخل صفحة العائلة الداخلية.
    لأنه في HTML القديم يستدعي showPage('familiesPage') فقط،
    وهذا قد يفتح صفحة فارغة بعد التحديث.
  */
  function patchFamilyBackButton() {
    const btn = document.querySelector('#familyMartyrsPage button[onclick*="showPage"][onclick*="familiesPage"]');

    if (!btn || btn.dataset.familyBackFixed === '1') return;

    btn.dataset.familyBackFixed = '1';
    btn.setAttribute('onclick', 'openFamiliesStatsPage()');
  }

  /*
    نغلف applyRouteFromLocation حتى يعالج ?page=families و ?family=
    بإعادة بناء المحتوى لا بمجرد إظهار الصفحة.
  */
  const oldApplyRouteFromLocation =
    window.applyRouteFromLocation ||
    (typeof applyRouteFromLocation === 'function' ? applyRouteFromLocation : null);

  window.applyRouteFromLocation = function() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const family = params.get('family');

    if (page === 'families') {
      showFamiliesStatsStable(false);
      return;
    }

    if (family) {
      openFamilyMartyrsStable(family, true);
      return;
    }

    if (typeof oldApplyRouteFromLocation === 'function') {
      return oldApplyRouteFromLocation.apply(this, arguments);
    }
  };

  try {
    applyRouteFromLocation = window.applyRouteFromLocation;
  } catch (e) {}

  /*
    عند الرجوع بزر المتصفح بعد تحديث الصفحة، نعيد تطبيق route المستقر.
  */
  window.addEventListener('popstate', function() {
    setTimeout(function() {
      window.applyRouteFromLocation();
    }, 50);
  });

  /*
    بعد تحميل البيانات أو تحديث الكاش، لو كنا على صفحة عائلة أو صفحة العائلات
    نعيد بناء المحتوى.
  */
  function refreshFamilyPageIfVisible() {
    patchFamilyBackButton();

    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const family = params.get('family');

    if (page === 'families') {
      buildFamiliesStatsContent();
      return;
    }

    if (family) {
      renderFamilyMartyrsContent(family);
      return;
    }

    if (document.getElementById('familyMartyrsPage')?.classList.contains('active') && lastOpenedFamilyName) {
      renderFamilyMartyrsContent(lastOpenedFamilyName);
    }

    if (document.getElementById('familiesPage')?.classList.contains('active')) {
      buildFamiliesStatsContent();
    }
  }

  const oldLoadInitialData =
    window.loadInitialData ||
    (typeof loadInitialData === 'function' ? loadInitialData : null);

  if (typeof oldLoadInitialData === 'function' && !oldLoadInitialData.__familyRouteBackFix) {
    window.loadInitialData = function() {
      const result = oldLoadInitialData.apply(this, arguments);

      setTimeout(refreshFamilyPageIfVisible, 400);
      setTimeout(refreshFamilyPageIfVisible, 1200);

      return result;
    };

    window.loadInitialData.__familyRouteBackFix = true;

    try {
      loadInitialData = window.loadInitialData;
    } catch (e) {}
  }

  window.addEventListener('taldo:api-cache-updated', function() {
    setTimeout(refreshFamilyPageIfVisible, 150);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      patchFamilyBackButton();
      setTimeout(refreshFamilyPageIfVisible, 500);
    });
  } else {
    patchFamilyBackButton();
    setTimeout(refreshFamilyPageIfVisible, 500);
  }
})();
