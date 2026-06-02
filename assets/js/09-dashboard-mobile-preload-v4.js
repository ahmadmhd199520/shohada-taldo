(function() {
  'use strict';

  const ADMIN_CACHE_KEY_V4 = 'taldo_admin_dashboard_cache_v2';
  const DASH_PAGE_SIZE_DESKTOP_V4 = 32;
  const DASH_PAGE_SIZE_MOBILE_V4 = 14;
  const REQUEST_PAGE_SIZE_DESKTOP_V4 = 28;
  const REQUEST_PAGE_SIZE_MOBILE_V4 = 12;

  const state = {
    dashPage: 1,
    updatesPage: 1,
    joinPage: 1,
    renderTimer: 0,
    preloadScheduled: false,
    preloadDone: false,
    preloadRunning: false
  };

  function isMobileDashboard() {
    return window.innerWidth <= 1024;
  }

  function dashPageSize() {
    return isMobileDashboard() ? DASH_PAGE_SIZE_MOBILE_V4 : DASH_PAGE_SIZE_DESKTOP_V4;
  }

  function requestPageSize() {
    return isMobileDashboard() ? REQUEST_PAGE_SIZE_MOBILE_V4 : REQUEST_PAGE_SIZE_DESKTOP_V4;
  }

  function htmlEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value || '');
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attrEscape(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value || '');
    return htmlEscape(value);
  }

  function norm(value) {
    if (typeof normalizeText === 'function') return normalizeText(value || '');
    return String(value || '').toLowerCase().trim();
  }

  function driveFileId(url) {
    if (typeof extractDriveFileId === 'function') return extractDriveFileId(url || '');
    const text = String(url || '');
    const m1 = text.match(/\/d\/([^/]+)/);
    if (m1) return m1[1];
    const m2 = text.match(/[?&]id=([^&]+)/);
    return m2 ? decodeURIComponent(m2[1]) : '';
  }

  function thumbSrc(item, size) {
    if (!item) return '';
    const fileId = item.image_file_id || driveFileId(item.image_url || '');
    return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 120}` : (item.image_url || '');
  }

  function statusHtml(status) {
    if (typeof statusBadge === 'function') return statusBadge(status);
    const text = status || 'بانتظار التوثيق';
    return `<span class="badge text-bg-light">${htmlEscape(text)}</span>`;
  }

  function pendingRequest(status) {
    if (typeof isPendingRequest === 'function') return isPendingRequest(status);
    return !status || String(status).includes('انتظار') || String(status).includes('مراجعة');
  }

  function needsCompletionHtml(item) {
    try {
      if (typeof isNeedsCompletion === 'function' && isNeedsCompletion(item)) {
        return '<span class="badge text-bg-warning">يحتاج استكمال</span>';
      }
    } catch (error) {}
    const needs = String(item?.needs_completion || '').trim() === 'نعم';
    return needs ? '<span class="badge text-bg-warning">يحتاج استكمال</span>' : '';
  }

  function dashboardSearchText(item) {
    if (!item) return '';
    if (!item.__dashSearchV4) {
      item.__dashSearchV4 = norm([
        item.full_name,
        item.family_name,
        item.father_name,
        item.nickname,
        item.martyrdom_place,
        item.martyrdom_date,
        item.martyrdom_type,
        item.extra_info
      ].join(' '));
    }
    return item.__dashSearchV4;
  }

  function requestSearchText(item) {
    if (!item) return '';
    if (!item.__reqSearchV4) {
      item.__reqSearchV4 = norm([
        item.martyr_name,
        item.full_name,
        item.family_name,
        item.submitted_text,
        item.request_text,
        item.notes,
        item.phone
      ].join(' '));
    }
    return item.__reqSearchV4;
  }

  function pagination(current, totalPages, onClickName, totalItems, pageSize) {
    if (!totalItems) return '';
    if (totalPages <= 1) {
      return `<div class="text-muted small text-center py-2">عرض ${totalItems} عنصر</div>`;
    }

    const pages = [];
    const radius = isMobileDashboard() ? 1 : 2;
    const start = Math.max(1, current - radius);
    const end = Math.min(totalPages, current + radius);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    const from = Math.min(totalItems, (current - 1) * pageSize + 1);
    const to = Math.min(totalItems, current * pageSize);

    return `
      <div class="dashboard-pagination">
        <button class="btn btn-outline-primary btn-sm" onclick="${onClickName}(${current - 1})" ${current <= 1 ? 'disabled' : ''} aria-label="السابق">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        ${pages.map(page => {
          if (page === '...') return `<span class="text-muted px-1">...</span>`;
          return `<button class="btn btn-sm ${page === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="${onClickName}(${page})">${page}</button>`;
        }).join('')}
        <button class="btn btn-outline-primary btn-sm" onclick="${onClickName}(${current + 1})" ${current >= totalPages ? 'disabled' : ''} aria-label="التالي">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small">عرض ${from} - ${to} من ${totalItems}</div>
      </div>`;
  }

  function resetAndRender(kind) {
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => {
      if (kind === 'updates') {
        state.updatesPage = 1;
        window.renderDataUpdateRequestsTable();
      } else {
        state.dashPage = 1;
        window.renderDashboardTable();
      }
    }, 120);
  }

  function syncValue(sourceId, targetId) {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);
    if (source && target && target.value !== source.value) target.value = source.value || '';
  }

  function ensureDashboardMobileControls() {
    try {
      if (typeof addDashboardExtraControls === 'function') addDashboardExtraControls();
    } catch (error) {}

    const martyrsTab = document.getElementById('dashboardMartyrsTab');
    const martyrsFilter = martyrsTab?.querySelector('.filter-card');
    if (martyrsTab && martyrsFilter && !document.getElementById('dashboardMobileMartyrsControls')) {
      martyrsFilter.insertAdjacentHTML('beforebegin', `
        <div id="dashboardMobileMartyrsControls" class="dashboard-mobile-controls">
          <input type="search" id="dashboardMobileSearchInput" class="form-control" placeholder="ابحث في التوثيقات...">
          <button class="btn btn-primary" type="button" onclick="openDashboardMobileFilterModal('martyrs')" aria-label="فلترة وفرز التوثيقات">
            <i class="fa-solid fa-filter"></i>
          </button>
          <button class="btn btn-outline-primary" type="button" onclick="refreshDashboardData(true, { forceFresh: true, useClientCache: false })" aria-label="تحديث">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>`);
    }

    const updatesTab = document.getElementById('dashboardDataUpdatesTab');
    const updatesHeader = updatesTab?.querySelector('.dashboard-section-header');
    if (updatesTab && updatesHeader && !document.getElementById('dataUpdatesMobileControls')) {
      updatesHeader.insertAdjacentHTML('afterend', `
        <div id="dataUpdatesMobileControls" class="dashboard-mobile-controls">
          <input type="search" id="dataUpdatesMobileSearchInput" class="form-control" placeholder="ابحث في طلبات الاستكمال...">
          <button class="btn btn-primary" type="button" onclick="openDashboardMobileFilterModal('updates')" aria-label="فلترة وفرز طلبات الاستكمال">
            <i class="fa-solid fa-filter"></i>
          </button>
          <button class="btn btn-outline-primary" type="button" onclick="refreshDashboardData(true, { forceFresh: true, useClientCache: false })" aria-label="تحديث">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>`);
    }

    if (!document.getElementById('dashboardMobileFilterModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="dashboardMobileFilterModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header px-4 pt-4">
                <h5 class="modal-title fw-bold" id="dashboardMobileFilterTitle">
                  <i class="fa-solid fa-filter text-primary ms-2"></i>
                  خيارات الفلترة
                </h5>
                <button type="button" class="btn-close ms-0" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body px-4">
                <div id="dashboardMobileMartyrsFields">
                  <div class="mb-3">
                    <label class="form-label fw-bold">حالة التوثيق</label>
                    <select class="form-select" id="dashboardMobileStatusFilter">
                      <option value="بانتظار التوثيق">بانتظار التوثيق</option>
                      <option value="موثق">موثق</option>
                      <option value="مرفوض">مرفوض</option>
                      <option value="">الكل</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-bold">الفرز</label>
                    <select class="form-select" id="dashboardMobileSortSelect">
                      <option value="pending-first">بانتظار التوثيق أولًا</option>
                      <option value="name">أبجديًا</option>
                      <option value="newest">الأحدث رفعًا</option>
                      <option value="oldest">الأقدم رفعًا</option>
                    </select>
                  </div>
                </div>

                <div id="dashboardMobileUpdatesFields" class="d-none">
                  <div class="mb-3">
                    <label class="form-label fw-bold">حالة الطلب</label>
                    <select class="form-select" id="dataUpdatesMobileStatusFilter">
                      <option value="بانتظار المراجعة">بانتظار المراجعة</option>
                      <option value="مقبول">مقبول</option>
                      <option value="مرفوض">مرفوض</option>
                      <option value="">الكل</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-bold">الفرز</label>
                    <select class="form-select" id="dataUpdatesMobileSortSelect">
                      <option value="newest">الأحدث أولًا</option>
                      <option value="oldest">الأقدم أولًا</option>
                      <option value="name">أبجديًا حسب اسم الشهيد</option>
                    </select>
                  </div>
                </div>

                <button class="btn btn-primary w-100" id="dashboardMobileFilterApplyBtn" type="button">
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>`);
    }

    bindDashboardMobileControls();
  }

  function bindDashboardMobileControls() {
    const dashSearch = document.getElementById('dashboardSearchInput');
    const dashMobileSearch = document.getElementById('dashboardMobileSearchInput');
    const dashStatus = document.getElementById('dashboardStatusFilter');
    const dashSort = document.getElementById('dashboardSortSelect');

    if (dashSearch && !dashSearch.__v4Bound) {
      dashSearch.__v4Bound = true;
      dashSearch.addEventListener('input', () => {
        syncValue('dashboardSearchInput', 'dashboardMobileSearchInput');
        resetAndRender('martyrs');
      });
    }

    if (dashMobileSearch && !dashMobileSearch.__v4Bound) {
      dashMobileSearch.__v4Bound = true;
      dashMobileSearch.addEventListener('input', () => {
        syncValue('dashboardMobileSearchInput', 'dashboardSearchInput');
        resetAndRender('martyrs');
      });
    }

    if (dashStatus && !dashStatus.__v4Bound) {
      dashStatus.__v4Bound = true;
      dashStatus.addEventListener('change', () => {
        syncValue('dashboardStatusFilter', 'dashboardMobileStatusFilter');
        state.dashPage = 1;
        window.renderDashboardTable();
      });
    }

    if (dashSort && !dashSort.__v4Bound) {
      dashSort.__v4Bound = true;
      dashSort.addEventListener('change', () => {
        syncValue('dashboardSortSelect', 'dashboardMobileSortSelect');
        state.dashPage = 1;
        window.renderDashboardTable();
      });
    }

    const updatesSearch = document.getElementById('dataUpdatesSearchInput');
    const updatesMobileSearch = document.getElementById('dataUpdatesMobileSearchInput');
    const updatesStatus = document.getElementById('dataUpdatesStatusFilter');
    const updatesSort = document.getElementById('dataUpdatesSortSelect');

    if (updatesSearch && !updatesSearch.__v4Bound) {
      updatesSearch.__v4Bound = true;
      updatesSearch.addEventListener('input', () => {
        syncValue('dataUpdatesSearchInput', 'dataUpdatesMobileSearchInput');
        resetAndRender('updates');
      });
    }

    if (updatesMobileSearch && !updatesMobileSearch.__v4Bound) {
      updatesMobileSearch.__v4Bound = true;
      updatesMobileSearch.addEventListener('input', () => {
        syncValue('dataUpdatesMobileSearchInput', 'dataUpdatesSearchInput');
        resetAndRender('updates');
      });
    }

    if (updatesStatus && !updatesStatus.__v4Bound) {
      updatesStatus.__v4Bound = true;
      updatesStatus.addEventListener('change', () => {
        syncValue('dataUpdatesStatusFilter', 'dataUpdatesMobileStatusFilter');
        state.updatesPage = 1;
        window.renderDataUpdateRequestsTable();
      });
    }

    if (updatesSort && !updatesSort.__v4Bound) {
      updatesSort.__v4Bound = true;
      updatesSort.addEventListener('change', () => {
        syncValue('dataUpdatesSortSelect', 'dataUpdatesMobileSortSelect');
        state.updatesPage = 1;
        window.renderDataUpdateRequestsTable();
      });
    }

    const applyBtn = document.getElementById('dashboardMobileFilterApplyBtn');
    if (applyBtn && !applyBtn.__v4Bound) {
      applyBtn.__v4Bound = true;
      applyBtn.addEventListener('click', () => {
        const kind = applyBtn.dataset.kind || 'martyrs';
        window.applyDashboardMobileFilters(kind);
      });
    }
  }

  window.openDashboardMobileFilterModal = function(kind) {
    ensureDashboardMobileControls();

    const isUpdates = kind === 'updates';
    const modalEl = document.getElementById('dashboardMobileFilterModal');
    const title = document.getElementById('dashboardMobileFilterTitle');
    const martyrFields = document.getElementById('dashboardMobileMartyrsFields');
    const updatesFields = document.getElementById('dashboardMobileUpdatesFields');
    const applyBtn = document.getElementById('dashboardMobileFilterApplyBtn');

    if (title) title.innerHTML = `<i class="fa-solid fa-filter text-primary ms-2"></i>${isUpdates ? 'فلترة طلبات الاستكمال' : 'فلترة التوثيقات'}`;
    if (martyrFields) martyrFields.classList.toggle('d-none', isUpdates);
    if (updatesFields) updatesFields.classList.toggle('d-none', !isUpdates);
    if (applyBtn) applyBtn.dataset.kind = isUpdates ? 'updates' : 'martyrs';

    if (isUpdates) {
      syncValue('dataUpdatesStatusFilter', 'dataUpdatesMobileStatusFilter');
      syncValue('dataUpdatesSortSelect', 'dataUpdatesMobileSortSelect');
    } else {
      syncValue('dashboardStatusFilter', 'dashboardMobileStatusFilter');
      syncValue('dashboardSortSelect', 'dashboardMobileSortSelect');
    }

    if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  };

  window.applyDashboardMobileFilters = function(kind) {
    if (kind === 'updates') {
      syncValue('dataUpdatesMobileStatusFilter', 'dataUpdatesStatusFilter');
      syncValue('dataUpdatesMobileSortSelect', 'dataUpdatesSortSelect');
      state.updatesPage = 1;
      window.renderDataUpdateRequestsTable();
    } else {
      syncValue('dashboardMobileStatusFilter', 'dashboardStatusFilter');
      syncValue('dashboardMobileSortSelect', 'dashboardSortSelect');
      state.dashPage = 1;
      window.renderDashboardTable();
    }

    const modalEl = document.getElementById('dashboardMobileFilterModal');
    if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  };

  window.goToDashboardPage = function(page) {
    state.dashPage = Math.max(1, Number(page) || 1);
    window.renderDashboardTable();
  };

  window.goToDataUpdatesPage = function(page) {
    state.updatesPage = Math.max(1, Number(page) || 1);
    window.renderDataUpdateRequestsTable();
  };

  window.goToJoinRequestsPage = function(page) {
    state.joinPage = Math.max(1, Number(page) || 1);
    window.renderJoinRequestsTable();
  };

  window.renderDashboardTable = function() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    ensureDashboardMobileControls();

    const search = norm(document.getElementById('dashboardSearchInput')?.value || document.getElementById('dashboardMobileSearchInput')?.value || '');
    const status = document.getElementById('dashboardStatusFilter')?.value || '';
    const sortBy = document.getElementById('dashboardSortSelect')?.value || 'pending-first';

    let list = Array.isArray(dashboardData) ? dashboardData.slice() : [];

    if (status) list = list.filter(item => item.verification_status === status);
    if (search) list = list.filter(item => dashboardSearchText(item).includes(search));

    if (sortBy === 'name') {
      list.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar'));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || '')));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.created_at || a.updated_at || '').localeCompare(String(b.created_at || b.updated_at || '')));
    } else {
      list.sort((a, b) => {
        if (a.verification_status === 'بانتظار التوثيق' && b.verification_status !== 'بانتظار التوثيق') return -1;
        if (a.verification_status !== 'بانتظار التوثيق' && b.verification_status === 'بانتظار التوثيق') return 1;
        return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
      });
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد نتائج.</td></tr>`;
      return;
    }

    const pageSize = dashPageSize();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (state.dashPage > totalPages) state.dashPage = totalPages;
    if (state.dashPage < 1) state.dashPage = 1;

    const start = (state.dashPage - 1) * pageSize;
    const pageList = list.slice(start, start + pageSize);

    const rows = pageList.map(item => {
      const img = thumbSrc(item, 120);
      const martyrId = attrEscape(item.martyr_id || '');
      return `
        <tr data-martyr-id="${martyrId}">
          <td style="width:62px;">
            ${img ? `<img src="${attrEscape(img)}" class="dashboard-thumb" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div style="display:none;width:46px;height:46px;border-radius:13px;background:#f1f3f5;place-items:center;color:#adb5bd;"><i class="fa-solid fa-user"></i></div>` :
              `<div style="width:46px;height:46px;border-radius:13px;background:#f1f3f5;display:grid;place-items:center;color:#adb5bd;"><i class="fa-solid fa-user"></i></div>`}
          </td>
          <td>
            <div class="fw-bold">${htmlEscape(item.full_name || '')}</div>
            <div class="small text-muted">${htmlEscape(item.martyrdom_place || '')}</div>
          </td>
          <td>${htmlEscape(item.family_name || '')}</td>
          <td>${htmlEscape(item.father_name || '')}</td>
          <td>${statusHtml(item.verification_status)} ${needsCompletionHtml(item)}</td>
          <td class="dashboard-action-cell">
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${martyrId}', 'dashboardPage')">عرض</button>
              <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${martyrId}', 'موثق')">توثيق</button>
              <button class="btn btn-sm btn-warning" onclick="verifyWithCompletionQuick('${martyrId}')">توثيق مع الاستكمال</button>
              <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${martyrId}', 'مرفوض')">رفض</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows + `
      <tr class="dash-pagination-row">
        <td colspan="6">${pagination(state.dashPage, totalPages, 'goToDashboardPage', list.length, pageSize)}</td>
      </tr>`;
  };

  window.renderDataUpdateRequestsTable = function() {
    const tbody = document.getElementById('dataUpdatesTableBody');
    const countBadge = document.getElementById('dataUpdatesCount');
    if (!tbody) return;

    ensureDashboardMobileControls();

    const search = norm(document.getElementById('dataUpdatesSearchInput')?.value || document.getElementById('dataUpdatesMobileSearchInput')?.value || '');
    const statusFilter = document.getElementById('dataUpdatesStatusFilter')?.value ?? 'بانتظار المراجعة';
    const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

    let list = Array.isArray(dataUpdateRequests) ? dataUpdateRequests.slice() : [];

    if (statusFilter) list = list.filter(item => String(item.status || '').trim() === statusFilter);
    if (search) list = list.filter(item => requestSearchText(item).includes(search));

    if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    } else if (sortBy === 'name') {
      list.sort((a, b) => String(a.martyr_name || '').localeCompare(String(b.martyr_name || ''), 'ar'));
    } else {
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    if (countBadge) countBadge.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد طلبات مطابقة.</td></tr>`;
      return;
    }

    const pageSize = requestPageSize();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (state.updatesPage > totalPages) state.updatesPage = totalPages;
    if (state.updatesPage < 1) state.updatesPage = 1;

    const start = (state.updatesPage - 1) * pageSize;
    const pageList = list.slice(start, start + pageSize);

    tbody.innerHTML = pageList.map(item => {
      const requestId = item.update_id || item.request_id || '';
      const img = item.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w220` : '';
      const requestText = item.submitted_text || item.request_text || '';
      return `
        <tr data-request-id="${attrEscape(requestId)}">
          <td>${htmlEscape(item.created_at || '')}</td>
          <td class="fw-bold" style="cursor:pointer" onclick="openMartyrDetails('${attrEscape(item.martyr_id)}', 'dashboardDataUpdatesTab')">${htmlEscape(item.martyr_name || '')}</td>
          <td>${htmlEscape(item.family_name || '')}</td>
          <td class="request-text-cell">
            <div>${htmlEscape(requestText)}</div>
            ${img ? `<a href="${attrEscape(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
          </td>
          <td>${statusHtml(item.status)}</td>
          <td class="dashboard-action-cell">${pendingRequest(item.status) ? `
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${attrEscape(requestId)}')">قبول وإضافة</button>
              <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${attrEscape(requestId)}')">رفض</button>
            </div>` : '-'}</td>
        </tr>`;
    }).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="6">${pagination(state.updatesPage, totalPages, 'goToDataUpdatesPage', list.length, pageSize)}</td>
      </tr>`;
  };

  window.renderJoinRequestsTable = function() {
    const tbody = document.getElementById('joinRequestsTableBody');
    const count = document.getElementById('joinRequestsCount');
    if (!tbody) return;

    let list = Array.isArray(joinRequests) ? joinRequests.slice() : [];
    list.forEach(requestSearchText);
    if (count) count.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات انضمام.</td></tr>`;
      return;
    }

    list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    const pageSize = requestPageSize();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (state.joinPage > totalPages) state.joinPage = totalPages;
    if (state.joinPage < 1) state.joinPage = 1;

    const start = (state.joinPage - 1) * pageSize;
    const pageList = list.slice(start, start + pageSize);

    tbody.innerHTML = pageList.map(item => `
      <tr data-join-id="${attrEscape(item.request_id || '')}">
        <td>${htmlEscape(item.created_at || '')}</td>
        <td class="fw-bold">${htmlEscape(item.full_name || '')}</td>
        <td>${htmlEscape(item.family_name || '')}</td>
        <td>${htmlEscape(item.birth_year || '')}</td>
        <td>${htmlEscape(item.phone || '')}</td>
        <td class="request-text-cell">${htmlEscape(item.notes || '')}</td>
        <td>${statusHtml(item.status)}</td>
        <td class="dashboard-action-cell">
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-success" onclick="updateJoinRequestStatusFromDashboard('${attrEscape(item.request_id)}', 'موثق')">قبول</button>
            <button class="btn btn-sm btn-outline-danger" onclick="updateJoinRequestStatusFromDashboard('${attrEscape(item.request_id)}', 'مرفوض')">رفض</button>
          </div>
        </td>
      </tr>
    `).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="8">${pagination(state.joinPage, totalPages, 'goToJoinRequestsPage', list.length, pageSize)}</td>
      </tr>`;
  };

  function computePreloadStats(list) {
    const stats = { verified: 0, pending: 0, rejected: 0, total: 0, byFamily: [] };
    const families = {};
    (list || []).forEach(item => {
      const family = item.family_name || 'غير محدد';
      const status = item.verification_status || 'بانتظار التوثيق';
      stats.total++;
      if (!families[family]) families[family] = { family_name: family, verified: 0, pending: 0, rejected: 0, total: 0 };

      if (status === 'موثق') {
        stats.verified++;
        families[family].verified++;
      } else if (status === 'مرفوض') {
        stats.rejected++;
        families[family].rejected++;
      } else {
        stats.pending++;
        families[family].pending++;
      }

      families[family].total++;
    });
    stats.byFamily = Object.values(families).sort((a, b) => b.total - a.total);
    return stats;
  }

  function storeAdminPayload(res) {
    try {
      sessionStorage.setItem(ADMIN_CACHE_KEY_V4, JSON.stringify({
        savedAt: Date.now(),
        value: res
      }));
    } catch (error) {}
  }

  function applyPreloadedPayload(res) {
    if (!res || !res.success) return false;

    dashboardData = Array.isArray(res.all) ? res.all : [];
    dataUpdateRequests = Array.isArray(res.dataUpdates) ? res.dataUpdates : [];
    joinRequests = Array.isArray(res.joinRequests) ? res.joinRequests : [];
    statsData = res.stats || computePreloadStats(dashboardData);

    dashboardData.forEach(item => {
      if (item) {
        item.__dashSearchV4 = '';
        dashboardSearchText(item);
      }
    });
    dataUpdateRequests.forEach(requestSearchText);
    joinRequests.forEach(requestSearchText);

    storeAdminPayload(res);

    if (document.getElementById('dashboardPage')?.classList.contains('active')) {
      if (typeof updateDashboardStats === 'function') updateDashboardStats();
      window.renderDashboardTable();
      window.renderDataUpdateRequestsTable();
      window.renderJoinRequestsTable();
    }

    return true;
  }

  function connectionAllowsPreload() {
    const connection = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return !/(^|-)2g$/i.test(connection.effectiveType || '');
  }

  function shouldPreloadDashboard() {
    try {
      if (!isAdminLoggedIn || !currentAdmin) return false;
      if (state.preloadDone || state.preloadRunning) return false;
      if (Array.isArray(dashboardData) && dashboardData.length) return false;
      if (document.getElementById('dashboardPage')?.classList.contains('active')) return false;
      if (new URLSearchParams(window.location.search).get('page') === 'dashboard') return false;
      return connectionAllowsPreload();
    } catch (error) {
      return false;
    }
  }

  function runDashboardPreload() {
    if (!shouldPreloadDashboard()) return;
    state.preloadRunning = true;

    apiRequest('getAdminDashboardData')
      .then(res => {
        state.preloadRunning = false;
        if (res && res.success) {
          state.preloadDone = true;
          applyPreloadedPayload(res);
        }
      })
      .catch(() => {
        state.preloadRunning = false;
      });
  }

  function scheduleDashboardPreload() {
    if (state.preloadScheduled) return;
    state.preloadScheduled = true;

    const waitForHomeData = (tries) => {
      if (!shouldPreloadDashboard()) return;
      const loadingBox = document.getElementById('loadingBox');
      const stillLoading = loadingBox && loadingBox.style.display !== 'none';
      if (stillLoading && tries < 40) {
        setTimeout(() => waitForHomeData(tries + 1), 250);
        return;
      }

      const start = () => setTimeout(runDashboardPreload, 1200);
      if ('requestIdleCallback' in window) {
        requestIdleCallback(start, { timeout: 3500 });
      } else {
        start();
      }
    };

    setTimeout(() => waitForHomeData(0), 900);
  }

  const originalOpenDashboardV4 = window.openDashboardPage;
  window.openDashboardPage = function(tabName) {
    ensureDashboardMobileControls();
    if (typeof originalOpenDashboardV4 === 'function') {
      return originalOpenDashboardV4.call(this, tabName);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureDashboardMobileControls();
    bindDashboardMobileControls();

    const originalLoadInitial = window.loadInitialData;
    if (typeof originalLoadInitial === 'function' && !originalLoadInitial.__preloadWrappedV4) {
      const wrapped = function() {
        const result = originalLoadInitial.apply(this, arguments);
        scheduleDashboardPreload();
        return result;
      };
      wrapped.__preloadWrappedV4 = true;
      window.loadInitialData = wrapped;
    }

    scheduleDashboardPreload();
  });

  window.addEventListener('resize', () => {
    clearTimeout(window.__dashboardMobileV4ResizeTimer);
    window.__dashboardMobileV4ResizeTimer = setTimeout(() => {
      if (document.getElementById('dashboardPage')?.classList.contains('active')) {
        window.renderDashboardTable();
        window.renderDataUpdateRequestsTable();
        window.renderJoinRequestsTable();
      }
    }, 180);
  }, { passive: true });

  window.TaldoDashboardMobileTools = {
    schedulePreload: scheduleDashboardPreload,
    runPreload: runDashboardPreload,
    ensureControls: ensureDashboardMobileControls
  };
})();
