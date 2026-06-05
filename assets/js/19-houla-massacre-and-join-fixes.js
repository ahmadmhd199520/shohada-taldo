(function() {
  'use strict';

  let currentHoulaPage = 1;
  let houlaViewMode = 'cards';
  const HOULA_PAGE_SIZE = 50;

  const safeHtml = value => (typeof escapeHtml === 'function' ? escapeHtml(value || '') : String(value || ''));
  const safeAttr = value => (typeof escapeAttr === 'function' ? escapeAttr(value || '') : safeHtml(value));

  function normalizeFlag(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function isHoulaMassacreMartyr(item) {
    if (!item) return false;

    const value =
      item.is_houla_massacre ??
      item.houla_massacre ??
      item.massacre_houla ??
      item.houlaMassacre ??
      '';

    return [
      'نعم',
      'yes',
      'true',
      '1',
      'مجزره',
      'مجزرة',
      'شهداء المجزره',
      'شهداء المجزرة',
      'houla',
      'hula'
    ].includes(normalizeFlag(value));
  }

  function setHoulaFlagLocally(martyrId, value) {
    const normalizedValue = value ? 'نعم' : 'لا';
    [allMartyrs, dashboardData].forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (item && item.martyr_id === martyrId) {
          item.is_houla_massacre = normalizedValue;
          item.houla_massacre = normalizedValue;
          item.massacre_houla = normalizedValue;
        }
      });
    });

    if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
      currentDetailsItem.is_houla_massacre = normalizedValue;
      currentDetailsItem.houla_massacre = normalizedValue;
      currentDetailsItem.massacre_houla = normalizedValue;
    }
  }

  function getHoulaStatsCount() {
    const fromStats = Number(
      statsData?.houlaMassacre ??
      statsData?.massacre ??
      statsData?.houla_massacre ??
      0
    );

    if (fromStats > 0) return fromStats;

    const source = (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length)
      ? dashboardData
      : allMartyrs;

    return (source || []).filter(item => {
      return isHoulaMassacreMartyr(item) && item.verification_status !== 'مرفوض';
    }).length;
  }

  function createStatsCardHtml() {
    const massacreCount = getHoulaStatsCount();
    const verified = statsData?.verified || 0;
    const pending = statsData?.pending || 0;

    return `
      <div class="col">
        <button class="card stat-card w-100 text-start h-100" onclick="openHoulaMassacrePage()">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon bg-danger-subtle text-danger">
              <i class="fa-solid fa-ribbon"></i>
            </div>
            <div class="flex-grow-1">
              <div class="stat-card-label">شهداء المجزرة</div>
              <h3 class="fw-bold mb-0" id="massacreCount">${massacreCount}</h3>
            </div>
            <i class="fa-solid fa-chevron-left text-muted stat-action-arrow"></i>
          </div>
        </button>
      </div>

      <div class="col">
        <button class="card stat-card w-100 text-start h-100" onclick="openFamiliesStatsPage()">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon bg-success-subtle text-success">
              <i class="fa-solid fa-chart-simple"></i>
            </div>
            <div class="flex-grow-1">
              <div class="stat-card-label">تفاصيل كل عائلة</div>
              <h5 class="fw-bold mb-0"><span class="family-details-text">تفاصيل</span></h5>
            </div>
            <i class="fa-solid fa-chevron-left text-muted stat-action-arrow"></i>
          </div>
        </button>
      </div>

      <div class="col">
        <div class="card stat-card h-100">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon bg-primary-subtle text-primary">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div class="flex-grow-1">
              <div class="stat-card-label">إحصائية الموثقين</div>
              <h3 class="fw-bold mb-0" id="verifiedCount">${verified}</h3>
            </div>
            <i class="fa-solid fa-chevron-left text-muted stat-action-arrow" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="card stat-card h-100">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon bg-warning-subtle text-warning">
              <i class="fa-solid fa-clock"></i>
            </div>
            <div class="flex-grow-1">
              <div class="stat-card-label">إحصائية بانتظار التوثق</div>
              <h3 class="fw-bold mb-0" id="pendingCount">${pending}</h3>
            </div>
            <i class="fa-solid fa-chevron-left text-muted stat-action-arrow" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    `;
  }

  function rebuildStatsCards() {
    const row = document.querySelector('.home-stats-row');
    if (!row) return;

    if (row.dataset.houlaCardsReady !== '1') {
      row.dataset.houlaCardsReady = '1';
    }

    row.innerHTML = createStatsCardHtml();
  }

  const oldUpdateStatsCards = window.updateStatsCards || (typeof updateStatsCards === 'function' ? updateStatsCards : null);
  window.updateStatsCards = function() {
    rebuildStatsCards();

    const verifiedEl = document.getElementById('verifiedCount');
    const pendingEl = document.getElementById('pendingCount');
    const massacreEl = document.getElementById('massacreCount');

    if (verifiedEl) verifiedEl.textContent = statsData?.verified || 0;
    if (pendingEl) pendingEl.textContent = statsData?.pending || 0;
    if (massacreEl) massacreEl.textContent = getHoulaStatsCount();

    if (!document.querySelector('.home-stats-row') && typeof oldUpdateStatsCards === 'function') {
      oldUpdateStatsCards();
    }
  };

  try { updateStatsCards = window.updateStatsCards; } catch (e) {}

  function installHoulaPage() {
    if (document.getElementById('houlaMassacrePage')) return;

    const page = document.createElement('section');
    page.id = 'houlaMassacrePage';
    page.className = 'page-section';
    page.innerHTML = `
      <div class="houla-page-header mb-3">
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div>
            <h3 class="fw-bold mb-1">
              <i class="fa-solid fa-ribbon text-danger ms-2"></i>
              شهداء المجزرة
            </h3>
            <div class="text-muted" style="display:none;">
            أسماء الشهداء المصنفين ضمن شهداء مجزرة الحولة.
            </div>
          </div>
          <button class="btn btn-outline-primary" onclick="goHome()">
            <i class="fa-solid fa-arrow-right ms-1"></i>
            رجوع
          </button>
        </div>
      </div>

      <div class="filter-card mb-4">
        <div class="row g-3 align-items-end">
          <div class="col-lg-3 col-md-6">
            <label class="form-label fw-bold">البحث</label>
            <input type="search" id="houlaSearchInput" class="form-control" placeholder="ابحث بالاسم، الأب، العائلة..." oninput="resetHoulaPageAndRender()">
          </div>

          <div class="col-lg-3 col-md-6">
            <label class="form-label fw-bold">فلترة حسب العائلة</label>
            <select id="houlaFamilyFilter" class="form-select" onchange="resetHoulaPageAndRender()">
              <option value="">كل العوائل</option>
            </select>
          </div>

          <div class="col-lg-2 col-md-6">
            <label class="form-label fw-bold">الحالة</label>
            <select id="houlaStatusFilter" class="form-select" onchange="resetHoulaPageAndRender()">
              <option value="موثق" selected>الأسماء الموثقة</option>
              <option value="بانتظار التوثيق">أسماء بانتظار التوثق</option>
              <option value="">الكل</option>
            </select>
          </div>

          <div class="col-lg-2 col-md-6">
            <label class="form-label fw-bold">الاستكمال</label>
            <select id="houlaCompletionFilter" class="form-select" onchange="resetHoulaPageAndRender()">
              <option value="">الكل</option>
              <option value="needs">يحتاج استكمال</option>
              <option value="complete">لا يحتاج استكمال</option>
            </select>
          </div>

          <div class="col-lg-2 col-md-6">
            <label class="form-label fw-bold">الفرز</label>
            <select id="houlaSortSelect" class="form-select" onchange="resetHoulaPageAndRender()">
              <option value="name">أبجديًا حسب الاسم</option>
              <option value="family">أبجديًا حسب العائلة</option>
              <option value="newest">الأحدث رفعًا</option>
              <option value="oldest">الأقدم رفعًا</option>
            </select>
          </div>

          <div class="col-lg-2">
            <label class="form-label fw-bold">طريقة العرض</label>
            <div class="btn-group w-100 view-toggle">
              <button class="btn btn-primary" id="houlaCardsViewBtn" onclick="setHoulaViewMode('cards')">
                <i class="fa-solid fa-grip"></i>
              </button>
              <button class="btn btn-outline-primary" id="houlaListViewBtn" onclick="setHoulaViewMode('list')">
                <i class="fa-solid fa-list"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="houlaMassacreContainer"></div>
    `;

    const familiesPage = document.getElementById('familiesPage');
    if (familiesPage && familiesPage.parentNode) {
      familiesPage.parentNode.insertBefore(page, familiesPage);
    } else {
      document.querySelector('.app-shell')?.appendChild(page);
    }

    fillHoulaFamilySelect();
  }

  function fillHoulaFamilySelect() {
    const select = document.getElementById('houlaFamilyFilter');
    if (!select) return;

    const oldValue = select.value || '';
    select.innerHTML = ['<option value="">كل العوائل</option>']
      .concat((allFamilies || []).map(family => `<option value="${safeAttr(family)}">${safeHtml(family)}</option>`))
      .join('');

    if (oldValue) select.value = oldValue;
  }

  const oldFillFamiliesSelects = window.fillFamiliesSelects || (typeof fillFamiliesSelects === 'function' ? fillFamiliesSelects : null);
  window.fillFamiliesSelects = function() {
    if (typeof oldFillFamiliesSelects === 'function') oldFillFamiliesSelects();
    fillHoulaFamilySelect();
  };

  try { fillFamiliesSelects = window.fillFamiliesSelects; } catch (e) {}

  function getHoulaSourceList() {
    return (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length)
      ? dashboardData
      : (allMartyrs || []);
  }

  function getFilteredHoulaList() {
    const search = typeof normalizeText === 'function'
      ? normalizeText(document.getElementById('houlaSearchInput')?.value || '')
      : String(document.getElementById('houlaSearchInput')?.value || '').trim().toLowerCase();

    const family = document.getElementById('houlaFamilyFilter')?.value || '';
    const status = document.getElementById('houlaStatusFilter')?.value || 'موثق';
    const completion = document.getElementById('houlaCompletionFilter')?.value || '';
    const sortBy = document.getElementById('houlaSortSelect')?.value || 'name';

    let list = getHoulaSourceList()
      .filter(item => isHoulaMassacreMartyr(item))
      .filter(item => item.verification_status !== 'مرفوض');

    if (status) list = list.filter(item => item.verification_status === status);
    if (family) list = list.filter(item => item.family_name === family);
    if (completion === 'needs') list = list.filter(item => typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : false);
    if (completion === 'complete') list = list.filter(item => typeof isNeedsCompletion === 'function' ? !isNeedsCompletion(item) : true);

    if (search) {
      list = list.filter(item => {
        const content = typeof normalizeText === 'function'
          ? normalizeText([
              item.full_name,
              item.family_name,
              item.father_name,
              item.nickname,
              item.martyrdom_place,
              item.extra_info
            ].join(' '))
          : [
              item.full_name,
              item.family_name,
              item.father_name,
              item.nickname,
              item.martyrdom_place,
              item.extra_info
            ].join(' ').toLowerCase();

        return content.includes(search);
      });
    }

    if (typeof sortMartyrList === 'function') {
      sortMartyrList(list, sortBy);
    } else {
      list.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar'));
    }

    return list;
  }

  function renderHoulaMartyrCard(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : false;
    const img = typeof getImageSrc === 'function' ? getImageSrc(item) : '';
    const clickAction = pending && !isAdminLoggedIn
      ? "showPendingInfo()"
      : `openMartyrDetails('${safeAttr(item.martyr_id)}', 'houlaMassacrePage')`;

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `
          <div class="verified-corner"><i class="fa-solid fa-check"></i></div>
        ` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${safeAttr(img)}" class="martyr-image" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${safeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${safeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderHoulaMartyrListItem(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const clickAction = pending && !isAdminLoggedIn
      ? "showPendingInfo()"
      : `openMartyrDetails('${safeAttr(item.martyr_id)}', 'houlaMassacrePage')`;

    return `
      <div class="list-item" onclick="${clickAction}">
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div>
            <h6 class="fw-bold mb-1">${safeHtml(item.full_name || '')}</h6>
            <div class="text-muted small">
              عائلة ${safeHtml(item.family_name || '')}
              ${item.father_name ? ` - ابن ${safeHtml(item.father_name)}` : ''}
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            ${verified ? `<span class="badge badge-soft-blue">موثق</span>` : pending ? `<span class="badge text-bg-secondary">قيد التدقيق</span>` : ''}
            <i class="fa-solid fa-chevron-left text-muted"></i>
          </div>
        </div>
      </div>
    `;
  }

  function houlaPagination(totalPages, totalItems) {
    if (totalPages <= 1) return '';

    const pages = [];
    const start = Math.max(1, currentHoulaPage - 2);
    const end = Math.min(totalPages, currentHoulaPage + 2);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    const buttons = pages.map(page => {
      if (page === '...') return `<span class="px-2 text-muted">...</span>`;
      const active = page === currentHoulaPage ? 'btn-primary' : 'btn-outline-primary';
      return `<button class="btn ${active} page-btn" onclick="goToHoulaPage(${page})">${page}</button>`;
    }).join('');

    return `
      <div class="martyrs-pagination">
        <button class="btn btn-outline-primary page-btn" onclick="goToHoulaPage(${currentHoulaPage - 1})" ${currentHoulaPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        ${buttons}
        <button class="btn btn-outline-primary page-btn" onclick="goToHoulaPage(${currentHoulaPage + 1})" ${currentHoulaPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small mt-1">
          عرض ${Math.min(totalItems, (currentHoulaPage - 1) * HOULA_PAGE_SIZE + 1)} - ${Math.min(totalItems, currentHoulaPage * HOULA_PAGE_SIZE)} من ${totalItems}
        </div>
      </div>
    `;
  }

  window.renderHoulaMassacrePage = function() {
    installHoulaPage();

    const container = document.getElementById('houlaMassacreContainer');
    if (!container) return;

    const list = getFilteredHoulaList();

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-folder-open fa-2x mb-3 text-danger"></i>
          <h5 class="fw-bold">لا توجد أسماء في هذا القسم</h5>
          <p class="mb-0">يمكن للمدير تصنيف الأسماء من صفحة الشهيد ضمن شهداء المجزرة.</p>
        </div>
      `;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / HOULA_PAGE_SIZE));
    if (currentHoulaPage > totalPages) currentHoulaPage = totalPages;
    if (currentHoulaPage < 1) currentHoulaPage = 1;

    const start = (currentHoulaPage - 1) * HOULA_PAGE_SIZE;
    const pageList = list.slice(start, start + HOULA_PAGE_SIZE);

    const content = houlaViewMode === 'cards'
      ? `<div class="martyrs-grid">${pageList.map(renderHoulaMartyrCard).join('')}</div>`
      : `<div>${pageList.map(renderHoulaMartyrListItem).join('')}</div>`;

    container.innerHTML = content + houlaPagination(totalPages, list.length);
  };

  window.resetHoulaPageAndRender = function() {
    currentHoulaPage = 1;
    renderHoulaMassacrePage();
  };

  window.goToHoulaPage = function(page) {
    currentHoulaPage = Number(page) || 1;
    renderHoulaMassacrePage();
    document.getElementById('houlaMassacreContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.setHoulaViewMode = function(mode) {
    houlaViewMode = mode === 'list' ? 'list' : 'cards';

    const cardsBtn = document.getElementById('houlaCardsViewBtn');
    const listBtn = document.getElementById('houlaListViewBtn');

    if (cardsBtn) cardsBtn.className = houlaViewMode === 'cards' ? 'btn btn-primary' : 'btn btn-outline-primary';
    if (listBtn) listBtn.className = houlaViewMode === 'list' ? 'btn btn-primary' : 'btn btn-outline-primary';

    renderHoulaMassacrePage();
  };

  window.openHoulaMassacrePage = function(noRoute) {
    installHoulaPage();
    fillHoulaFamilySelect();
    currentHoulaPage = 1;
    renderHoulaMassacrePage();

    if (!noRoute && typeof updateRoute === 'function') {
      updateRoute('?page=massacre', { page: 'massacre' });
    }

    if (typeof showPage === 'function') {
      showPage('houlaMassacrePage');
    }
  };

  const oldApplyRoute = window.applyRouteFromLocation || (typeof applyRouteFromLocation === 'function' ? applyRouteFromLocation : null);
  window.applyRouteFromLocation = function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'massacre') {
      openHoulaMassacrePage(true);
      return;
    }

    if (typeof oldApplyRoute === 'function') oldApplyRoute();
  };

  try { applyRouteFromLocation = window.applyRouteFromLocation; } catch (e) {}

  const oldGoBackFromDetails = window.goBackFromDetails || (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);
  window.goBackFromDetails = function() {
    if (lastPageBeforeDetails === 'houlaMassacrePage') {
      openHoulaMassacrePage(true);
      if (typeof updateRoute === 'function') updateRoute('?page=massacre', { page: 'massacre' });
      return;
    }

    if (typeof oldGoBackFromDetails === 'function') {
      oldGoBackFromDetails();
    } else if (typeof goHome === 'function') {
      goHome();
    }
  };

  try { goBackFromDetails = window.goBackFromDetails; } catch (e) {}

  window.setHoulaMassacreForMartyr = async function(martyrId, checked) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    const normalizedValue = checked ? 'نعم' : 'لا';

    try {
      if (typeof showGlobalSpinner === 'function') showGlobalSpinner(true);

      const res = await apiRequest('setHoulaMassacreStatus', {
        martyrId,
        martyr_id: martyrId,
        isHoulaMassacre: normalizedValue,
        is_houla_massacre: normalizedValue
      });

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر حفظ تصنيف شهداء المجزرة.');
        return;
      }

      setHoulaFlagLocally(martyrId, checked);
      showToast(res.message || 'تم حفظ تصنيف شهداء المجزرة.');

      if (typeof updateStatsCards === 'function') updateStatsCards();
      if (document.getElementById('houlaMassacrePage')?.classList.contains('active')) {
        renderHoulaMassacrePage();
      }

      if (typeof refreshAfterMutation === 'function') {
        refreshAfterMutation();
      } else {
        try { refreshDashboardData(false); } catch (e) {}
        try { loadInitialData(); } catch (e) {}
      }
    } catch (err) {
      showToast(err.message || 'تعذر حفظ تصنيف شهداء المجزرة. تأكد من تحديث Code.gs.');
    } finally {
      if (typeof hideGlobalSpinner === 'function') hideGlobalSpinner();
    }
  };

  const oldRenderAdminActions = window.renderAdminActions || (typeof renderAdminActions === 'function' ? renderAdminActions : null);
  window.renderAdminActions = function(item) {
    const base = typeof oldRenderAdminActions === 'function' ? oldRenderAdminActions(item) : '';
    const checked = isHoulaMassacreMartyr(item) ? 'checked' : '';

    return base + `
      <div class="houla-admin-box mt-3">
        <h6 class="fw-bold mb-2">
          <i class="fa-solid fa-ribbon text-danger ms-1"></i>
          تصنيف شهداء المجزرة
        </h6>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="houlaMassacreSwitch" ${checked}
            onchange="setHoulaMassacreForMartyr('${safeAttr(item.martyr_id)}', this.checked)">
          <label class="form-check-label fw-bold" for="houlaMassacreSwitch">
            عرض هذا الاسم ضمن صفحة شهداء المجزرة
          </label>
        </div>
      </div>
    `;
  };

  try { renderAdminActions = window.renderAdminActions; } catch (e) {}

  function installJoinRequestControls() {
    const tab = document.getElementById('dashboardJoinRequestsTab');
    if (!tab || document.getElementById('joinRequestsControls')) return;

    const header = tab.querySelector('.dashboard-section-header');
    if (!header) return;

    header.insertAdjacentHTML('afterend', `
      <div class="join-request-controls mb-2" id="joinRequestsControls">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label fw-bold">بحث</label>
            <input class="form-control" id="joinRequestsSearchInput" placeholder="بحث بالاسم، العائلة، الهاتف..." oninput="resetJoinRequestsPageAndRender()">
          </div>

          <div class="col-md-4">
            <label class="form-label fw-bold">الحالة</label>
            <select class="form-select" id="joinRequestsStatusFilter" onchange="resetJoinRequestsPageAndRender()">
              <option value="بانتظار التوثيق" selected>بانتظار التوثيق</option>
              <option value="موثق">مقبول / موثق</option>
              <option value="مرفوض">مرفوض</option>
              <option value="">الكل</option>
            </select>
          </div>

          <div class="col-md-4">
            <label class="form-label fw-bold">فرز</label>
            <select class="form-select" id="joinRequestsSortSelect" onchange="resetJoinRequestsPageAndRender()">
              <option value="newest">الأحدث أولًا</option>
              <option value="oldest">الأقدم أولًا</option>
              <option value="name">أبجديًا حسب الاسم</option>
              <option value="family">أبجديًا حسب العائلة</option>
            </select>
          </div>
        </div>
      </div>
    `);
  }

  let joinRequestsPage = 1;
  const JOIN_PAGE_SIZE = 20;

  function isJoinPending(status) {
    const value = String(status || '').trim();
    return !value || value === 'بانتظار التوثيق' || value === 'بانتظار المراجعة' || value === 'قيد المراجعة';
  }

  function getFilteredJoinRequests() {
    const search = typeof normalizeText === 'function'
      ? normalizeText(document.getElementById('joinRequestsSearchInput')?.value || '')
      : String(document.getElementById('joinRequestsSearchInput')?.value || '').trim().toLowerCase();

    const status = document.getElementById('joinRequestsStatusFilter')?.value ?? 'بانتظار التوثيق';
    const sortBy = document.getElementById('joinRequestsSortSelect')?.value || 'newest';

    let list = Array.isArray(joinRequests) ? joinRequests.slice() : [];

    if (status) {
      if (status === 'بانتظار التوثيق') {
        list = list.filter(item => isJoinPending(item.status));
      } else {
        list = list.filter(item => String(item.status || '').trim() === status);
      }
    }

    if (search) {
      list = list.filter(item => {
        const content = typeof normalizeText === 'function'
          ? normalizeText([item.full_name, item.family_name, item.phone, item.notes, item.birth_year].join(' '))
          : [item.full_name, item.family_name, item.phone, item.notes, item.birth_year].join(' ').toLowerCase();

        return content.includes(search);
      });
    }

    if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    } else if (sortBy === 'name') {
      list.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar'));
    } else if (sortBy === 'family') {
      list.sort((a, b) => String(a.family_name || '').localeCompare(String(b.family_name || ''), 'ar'));
    } else {
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    return list;
  }

  function joinPagination(totalPages, totalItems) {
    if (totalPages <= 1) return '';

    return `
      <div class="martyrs-pagination mt-0">
        <button class="btn btn-outline-primary page-btn" onclick="goToJoinRequestsPageFixed(${joinRequestsPage - 1})" ${joinRequestsPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <span class="px-2 text-muted">صفحة ${joinRequestsPage} من ${totalPages}</span>
        <button class="btn btn-outline-primary page-btn" onclick="goToJoinRequestsPageFixed(${joinRequestsPage + 1})" ${joinRequestsPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small mt-1">
          مجموع النتائج: ${totalItems}
        </div>
      </div>
    `;
  }

  window.renderJoinRequestsTable = function() {
    installJoinRequestControls();

    const tbody = document.getElementById('joinRequestsTableBody');
    const count = document.getElementById('joinRequestsCount');

    if (!tbody) return;

    const list = getFilteredJoinRequests();

    if (count) count.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            لا توجد طلبات انضمام مطابقة.
          </td>
        </tr>
      `;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / JOIN_PAGE_SIZE));
    if (joinRequestsPage > totalPages) joinRequestsPage = totalPages;
    if (joinRequestsPage < 1) joinRequestsPage = 1;

    const start = (joinRequestsPage - 1) * JOIN_PAGE_SIZE;
    const pageList = list.slice(start, start + JOIN_PAGE_SIZE);

    tbody.innerHTML = pageList.map(item => {
      const requestId = item.request_id || '';
      const pending = isJoinPending(item.status);

      return `
        <tr data-join-id="${safeAttr(requestId)}">
          <td>${safeHtml(item.created_at || '')}</td>
          <td class="fw-bold">${safeHtml(item.full_name || '')}</td>
          <td>${safeHtml(item.family_name || '')}</td>
          <td>${safeHtml(item.birth_year || '')}</td>
          <td>${safeHtml(item.phone || '')}</td>
          <td class="request-text-cell">${safeHtml(item.notes || '')}</td>
          <td>${typeof statusBadge === 'function' ? statusBadge(item.status) : safeHtml(item.status || '')}</td>
          <td>
            ${pending ? `
              <div class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-success" onclick="updateJoinRequestStatusFromDashboard('${safeAttr(requestId)}', 'موثق')">قبول</button>
                <button class="btn btn-sm btn-outline-danger" onclick="updateJoinRequestStatusFromDashboard('${safeAttr(requestId)}', 'مرفوض')">رفض</button>
              </div>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('') + `
      <tr>
        <td colspan="8">${joinPagination(totalPages, list.length)}</td>
      </tr>
    `;
  };

  try { renderJoinRequestsTable = window.renderJoinRequestsTable; } catch (e) {}

  window.resetJoinRequestsPageAndRender = function() {
    joinRequestsPage = 1;
    renderJoinRequestsTable();
  };

  window.goToJoinRequestsPageFixed = function(page) {
    joinRequestsPage = Number(page) || 1;
    renderJoinRequestsTable();
  };

  window.updateJoinRequestStatusFromDashboard = function(requestId, status) {
    const reviewerNotes = status === 'مرفوض' ? 'تم الرفض من لوحة التحكم' : 'تم القبول من لوحة التحكم';

    if (!requestId) {
      showToast('معرّف الطلب غير موجود.');
      return;
    }

    apiRequest('updateJoinRequestStatus', {
      requestId,
      newStatus: status,
      reviewerNotes
    })
      .then(res => {
        if (!res || res.success === false) {
          showToast(res?.message || 'تعذر تحديث حالة الطلب.');
          return;
        }

        joinRequests = (joinRequests || []).map(item => {
          if (item.request_id === requestId) {
            return Object.assign({}, item, {
              status,
              reviewed_by: 'admin',
              reviewed_at: new Date().toISOString(),
              reviewer_notes: reviewerNotes
            });
          }

          return item;
        });

        showToast(res.message || 'تم تحديث حالة الطلب.');
        renderJoinRequestsTable();

        try {
          apiRequest('getAdminDashboardData', {
            forceFresh: true,
            __cacheBust: Date.now()
          }).then(fresh => {
            if (fresh && fresh.success) {
              statsData = fresh.stats || statsData;
              dashboardData = fresh.all || dashboardData;
              dataUpdateRequests = fresh.dataUpdates || dataUpdateRequests;
              joinRequests = fresh.joinRequests || joinRequests;
              if (typeof updateStatsCards === 'function') updateStatsCards();
              if (typeof updateDashboardStats === 'function') updateDashboardStats();
              if (typeof renderDashboardTable === 'function') renderDashboardTable();
              if (typeof renderDataUpdateRequestsTable === 'function') renderDataUpdateRequestsTable();
              renderJoinRequestsTable();
            }
          });
        } catch (e) {}
      })
      .catch(err => {
        showToast(err.message || 'تعذر تحديث حالة الطلب.');
      });
  };

  try { updateJoinRequestStatusFromDashboard = window.updateJoinRequestStatusFromDashboard; } catch (e) {}

  const oldShowDashboardTab = window.showDashboardTab || (typeof showDashboardTab === 'function' ? showDashboardTab : null);
  window.showDashboardTab = function(tabName) {
    if (typeof oldShowDashboardTab === 'function') oldShowDashboardTab(tabName);
    if (tabName === 'joinRequests') {
      installJoinRequestControls();
      renderJoinRequestsTable();
    }
  };

  try { showDashboardTab = window.showDashboardTab; } catch (e) {}

  document.addEventListener('DOMContentLoaded', () => {
    installHoulaPage();
    rebuildStatsCards();
    fillHoulaFamilySelect();
    installJoinRequestControls();

    if (typeof updateStatsCards === 'function') updateStatsCards();

    const params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'massacre') {
      setTimeout(() => openHoulaMassacrePage(true), 350);
    }
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    installHoulaPage();
    rebuildStatsCards();
    fillHoulaFamilySelect();
    installJoinRequestControls();
    if (typeof updateStatsCards === 'function') updateStatsCards();
  }
})();
