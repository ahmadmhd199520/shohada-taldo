(function() {
  'use strict';

  const CACHE_KEY = 'taldo_admin_dashboard_cache_v2';
  const CACHE_TTL = 15 * 60 * 1000;
  const DASH_PAGE_SIZE_DESKTOP = 32;
  const DASH_PAGE_SIZE_MOBILE = 14;
  const REQUEST_PAGE_SIZE_DESKTOP = 28;
  const REQUEST_PAGE_SIZE_MOBILE = 12;

  const state = {
    loaded: false,
    loading: false,
    promise: null,
    dashboardPage: 1,
    updatesPage: 1,
    joinPage: 1,
    renderTimer: 0
  };

  function isAdminMode() {
    try { return !!isAdminLoggedIn; } catch (e) { return false; }
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function normalize(value) {
    if (typeof normalizeText === 'function') return normalizeText(value || '');
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function html(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value || '');
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attr(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value || '');
    return html(value || '');
  }

  function statusOf(item) {
    return String(item?.verification_status || '').trim() || 'بانتظار التوثيق';
  }

  function requestStatusOf(item) {
    return String(item?.status || '').trim() || 'بانتظار المراجعة';
  }

  function isPendingRequestSafe(status) {
    if (typeof isPendingRequest === 'function') return isPendingRequest(status);
    const text = String(status || '').trim();
    return !text || text.includes('انتظار') || text.includes('مراجعة');
  }

  function needsCompletion(item) {
    try {
      if (typeof isNeedsCompletion === 'function') return isNeedsCompletion(item);
    } catch (e) {}
    return String(item?.needs_completion || '').trim() === 'نعم';
  }

  function statusBadgeSafe(status) {
    if (typeof statusBadge === 'function') return statusBadge(status);
    return `<span class="badge text-bg-light">${html(status || 'بانتظار التوثيق')}</span>`;
  }

function dashboardStatusClass(status) {
  const text = String(status || '').trim();
  if (text === 'موثق') return 'verified';
  if (text === 'مرفوض') return 'rejected';
  return 'pending';
}
  function driveFileId(url) {
    if (typeof extractDriveFileId === 'function') return extractDriveFileId(url || '');
    const text = String(url || '');
    let match = text.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
    match = text.match(/\/d\/([^/]+)/);
    if (match && match[1]) return match[1];
    match = text.match(/file\/d\/([^/]+)/);
    return match && match[1] ? match[1] : '';
  }

  function thumbnail(item, size) {
    if (!item) return '';
    const fileId = item.image_file_id || driveFileId(item.image_url || '');
    if (fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 120}`;
    return item.image_url || '';
  }

  function prepareDashboardItem(item) {
    if (!item || item.__stableDashboardPrepared) return item;
    item.__stableSearchText = normalize([
      item.full_name,
      item.family_name,
      item.father_name,
      item.nickname,
      item.martyrdom_place,
      item.martyrdom_date,
      item.martyrdom_type,
      item.battle_name,
      item.extra_info
    ].join(' '));
    item.__stableSortDate = String(item.created_at || item.updated_at || '');
    item.__stableDashboardPrepared = true;
    return item;
  }

  function prepareRequestItem(item) {
    if (!item || item.__stableRequestPrepared) return item;
    item.__stableRequestSearchText = normalize([
      item.martyr_name,
      item.full_name,
      item.family_name,
      item.submitted_text,
      item.request_text,
      item.notes,
      item.phone
    ].join(' '));
    item.__stableRequestPrepared = true;
    return item;
  }

  function invalidatePrepared(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function(item) {
      if (!item) return;
      item.__stableDashboardPrepared = false;
      item.__stableRequestPrepared = false;
    });
  }

  function dashPageSize() {
    return window.innerWidth <= 1024 ? DASH_PAGE_SIZE_MOBILE : DASH_PAGE_SIZE_DESKTOP;
  }

  function requestPageSize() {
    return window.innerWidth <= 1024 ? REQUEST_PAGE_SIZE_MOBILE : REQUEST_PAGE_SIZE_DESKTOP;
  }

  function computeStats(list) {
    const stats = { verified: 0, pending: 0, rejected: 0, total: 0, byFamily: [] };
    const families = {};

    (list || []).forEach(function(item) {
      if (!item) return;
      const family = item.family_name || 'غير محدد';
      const status = statusOf(item);

      stats.total++;
      if (!families[family]) families[family] = { family_name: family, verified: 0, pending: 0, rejected: 0, total: 0 };
      families[family].total++;

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
    });

    stats.byFamily = Object.values(families).sort((a, b) => b.total - a.total);
    return stats;
  }

  function readDashboardCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.value) return null;
      if (Date.now() - Number(parsed.savedAt) > CACHE_TTL) return null;
      return parsed.value;
    } catch (e) {
      return null;
    }
  }

  function writeDashboardCache(res) {
    if (!res || res.success === false) return;
    const hasUsefulData =
      (Array.isArray(res.all) && res.all.length) ||
      (Array.isArray(res.dataUpdates) && res.dataUpdates.length) ||
      (Array.isArray(res.joinRequests) && res.joinRequests.length) ||
      !!res.stats;

    if (!hasUsefulData) return;

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        value: res
      }));
    } catch (e) {}
  }

  function applyDashboardPayload(res, options) {
    if (!res || res.success === false) return false;

    options = options || {};

    const incomingAll = Array.isArray(res.all) ? res.all : [];
    const incomingUpdates = Array.isArray(res.dataUpdates) ? res.dataUpdates : [];
    const incomingJoins = Array.isArray(res.joinRequests) ? res.joinRequests : [];

    const currentlyHasRows = Array.isArray(dashboardData) && dashboardData.length > 0;
    if (!incomingAll.length && currentlyHasRows && !options.allowEmptyPayload) {
      // لا نستبدل بيانات صالحة موجودة باستجابة فارغة عابرة.
    } else {
      dashboardData = incomingAll;
      invalidatePrepared(dashboardData);
      dashboardData.forEach(prepareDashboardItem);
    }

    dataUpdateRequests = incomingUpdates;
    joinRequests = incomingJoins;
    invalidatePrepared(dataUpdateRequests);
    invalidatePrepared(joinRequests);
    dataUpdateRequests.forEach(prepareRequestItem);
    joinRequests.forEach(prepareRequestItem);

    statsData = res.stats || computeStats(dashboardData || []);

    if (Array.isArray(res.messages)) window.__adminMessages = res.messages;
    if (Array.isArray(res.messageReplies)) window.__messageReplies = res.messageReplies;
    if (!Array.isArray(window.__messageReplies)) window.__messageReplies = [];
    if (res.settings) {
      try { publicSettings = res.settings; } catch (e) {}
    }

    if (options.saveCache !== false) writeDashboardCache(res);

    state.loaded = true;
    state.loading = false;

    try { if (typeof updateStatsCards === 'function') updateStatsCards(); } catch (e) {}
    try { if (typeof updateDashboardStats === 'function') updateDashboardStats(); } catch (e) {}
    try { if (typeof renderSettingsTab === 'function') renderSettingsTab(); } catch (e) {}
    renderAllDashboardTables();
    return true;
  }

  function loadingRow(colspan, text) {
    return `
      <tr>
        <td colspan="${colspan}" class="text-center text-muted py-4">
          <span class="spinner-border spinner-border-sm ms-1"></span>
          ${html(text || 'جاري تحميل البيانات...')}
        </td>
      </tr>`;
  }

  function errorRow(colspan, text) {
    return `
      <tr>
        <td colspan="${colspan}" class="text-center text-muted py-4">
          <div class="mb-2">${html(text || 'تعذر تحميل البيانات.')}</div>
          <button class="btn btn-sm btn-primary" onclick="refreshDashboardData(true, { forceFresh: true, useClientCache: false })">
            <i class="fa-solid fa-rotate ms-1"></i> إعادة المحاولة
          </button>
        </td>
      </tr>`;
  }

  function setDashboardLoadingState() {
    const dashBody = document.getElementById('dashboardTableBody');
    const updatesBody = document.getElementById('dataUpdatesTableBody');
    const joinsBody = document.getElementById('joinRequestsTableBody');

    if (dashBody && (!Array.isArray(dashboardData) || !dashboardData.length)) {
      dashBody.innerHTML = loadingRow(6, 'جاري تحميل بيانات لوحة التحكم...');
    }
    if (updatesBody && (!Array.isArray(dataUpdateRequests) || !dataUpdateRequests.length)) {
      updatesBody.innerHTML = loadingRow(6, 'جاري تحميل طلبات الاستكمال...');
    }
    if (joinsBody && (!Array.isArray(joinRequests) || !joinRequests.length)) {
      joinsBody.innerHTML = loadingRow(8, 'جاري تحميل طلبات الانضمام...');
    }
  }

  function showSmallNote(message) {
    const holder = document.querySelector('#dashboardMartyrsTab .dashboard-table-card') || document.getElementById('dashboardPage');
    if (!holder) return;

    let note = document.getElementById('dashboardStableLoaderNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'dashboardStableLoaderNote';
      note.className = 'dashboard-mini-note';
      holder.parentNode.insertBefore(note, holder);
    }

    note.textContent = message;
    clearTimeout(window.__dashboardStableLoaderNoteTimer);
    window.__dashboardStableLoaderNoteTimer = setTimeout(function() {
      if (note) note.remove();
    }, 3200);
  }

  function makePagination(current, totalPages, onClickName, totalItems, pageSize) {
    if (!totalItems) return '';
    if (totalPages <= 1) return `<div class="text-muted small text-center py-2">عرض ${totalItems} عنصر</div>`;

    const radius = window.innerWidth <= 768 ? 1 : 2;
    const pages = [];
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
        ${pages.map(function(page) {
          if (page === '...') return '<span class="text-muted px-1">...</span>';
          return `<button class="btn btn-sm ${page === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="${onClickName}(${page})">${page}</button>`;
        }).join('')}
        <button class="btn btn-outline-primary btn-sm" onclick="${onClickName}(${current + 1})" ${current >= totalPages ? 'disabled' : ''} aria-label="التالي">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small">عرض ${from} - ${to} من ${totalItems}</div>
      </div>`;
  }

  function ensureDashboardControls() {
    try { if (typeof addDashboardExtraControls === 'function') addDashboardExtraControls(); } catch (e) {}
    try { if (window.TaldoDashboardMobileTools && typeof window.TaldoDashboardMobileTools.ensureControls === 'function') window.TaldoDashboardMobileTools.ensureControls(); } catch (e) {}
  }

  window.refreshDashboardData = function(showMsg, options) {
    showMsg = showMsg !== false;
    options = options || {};

    if (!isAdminMode()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      else if (typeof showToast === 'function') showToast('يرجى تسجيل الدخول أولًا.');
      return Promise.resolve(false);
    }

    const forceFresh = !!options.forceFresh || options.useClientCache === false;
    const useClientCache = options.useClientCache !== false && !forceFresh;

    if (useClientCache && (!Array.isArray(dashboardData) || !dashboardData.length)) {
      const cached = readDashboardCache();
      if (cached && applyDashboardPayload(cached, { saveCache: false })) {
        showSmallNote('تم عرض آخر نسخة محفوظة فورًا، ويجري التحقق من التحديثات.');
      }
    }

    if (state.promise && state.loading && !forceFresh) return state.promise;

    state.loading = true;
    setDashboardLoadingState();

    const payload = forceFresh
      ? { forceFresh: true, _force_refresh: Date.now(), __cacheBust: String(Date.now()) }
      : {};

    state.promise = apiRequest('getAdminDashboardData', payload, {
      forceFresh,
      useClientCache: false,
      forceNetwork: forceFresh
    })
      .then(function(res) {
        state.promise = null;

        if (!res || res.success === false) {
          state.loading = false;
          if (!Array.isArray(dashboardData) || !dashboardData.length) {
            const body = document.getElementById('dashboardTableBody');
            if (body) body.innerHTML = errorRow(6, res?.message || 'تعذر تحميل بيانات لوحة التحكم.');
          }
          if (typeof showToast === 'function') showToast(res?.message || 'تعذر تحميل بيانات لوحة التحكم.');
          return false;
        }

        applyDashboardPayload(res, { allowEmptyPayload: forceFresh });
        if (showMsg && typeof showToast === 'function') showToast('تم تحديث لوحة التحكم.');
        return true;
      })
      .catch(function(err) {
        state.promise = null;
        state.loading = false;

        if (!Array.isArray(dashboardData) || !dashboardData.length) {
          const body = document.getElementById('dashboardTableBody');
          if (body) body.innerHTML = errorRow(6, err?.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
        }

        if (typeof showToast === 'function') showToast(err?.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
        return false;
      });

    return state.promise;
  };

  function buildDashboardList() {
    const search = normalize(document.getElementById('dashboardSearchInput')?.value || document.getElementById('dashboardMobileSearchInput')?.value || '');
    const status = document.getElementById('dashboardStatusFilter')?.value || '';
    const sortBy = document.getElementById('dashboardSortSelect')?.value || 'pending-first';

    let list = Array.isArray(dashboardData) ? dashboardData.slice() : [];
    list.forEach(prepareDashboardItem);

    if (status) list = list.filter(function(item) { return statusOf(item) === status; });
    if (search) list = list.filter(function(item) { return (item.__stableSearchText || '').includes(search); });

    if (sortBy === 'name') {
      list.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar'));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => String(b.__stableSortDate || '').localeCompare(String(a.__stableSortDate || '')));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.__stableSortDate || '').localeCompare(String(b.__stableSortDate || '')));
    } else {
      list.sort(function(a, b) {
        if (statusOf(a) === 'بانتظار التوثيق' && statusOf(b) !== 'بانتظار التوثيق') return -1;
        if (statusOf(a) !== 'بانتظار التوثيق' && statusOf(b) === 'بانتظار التوثيق') return 1;
        return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
      });
    }

    return list;
  }

  window.renderDashboardTable = function() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    ensureDashboardControls();

    const rawList = Array.isArray(dashboardData) ? dashboardData : [];
    if (!rawList.length && (state.loading || !state.loaded)) {
      tbody.innerHTML = loadingRow(6, 'جاري تحميل بيانات لوحة التحكم...');
      return;
    }

    const list = buildDashboardList();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد نتائج مطابقة للفلترة الحالية.</td></tr>`;
      return;
    }

    const headerAction = document.querySelector('#dashboardMartyrsTab table thead th:nth-child(6)');
    if (headerAction) headerAction.textContent = 'إجراء';

    const pageSize = dashPageSize();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (state.dashboardPage > totalPages) state.dashboardPage = totalPages;
    if (state.dashboardPage < 1) state.dashboardPage = 1;

    const start = (state.dashboardPage - 1) * pageSize;
    const pageList = list.slice(start, start + pageSize);

    tbody.innerHTML = pageList.map(function(item) {
      const martyrId = attr(item.martyr_id || '');
      const img = thumbnail(item, 120);
      const statusText = statusOf(item);
      const needs = needsCompletion(item) ? '<span class="badge text-bg-warning">يحتاج استكمال</span>' : '';
      const needsTriangle = needsCompletion(item) ? '<span class="dashboard-needs-triangle" title="يحتاج استكمال"></span>' : '';

      return `
        <tr class="dashboard-mobile-row" data-martyr-id="${martyrId}" onclick="openMartyrDetails('${martyrId}', 'dashboardPage')">
          <td style="width:70px;">
            <div class="dashboard-mobile-image-wrap">
              <span class="dashboard-status-dot ${dashboardStatusClass(statusText)}"></span>
              ${needsTriangle}
              ${img
                ? `<img src="${attr(img)}" class="dashboard-thumb" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"><div class="dashboard-mobile-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>`
                : `<div class="dashboard-mobile-placeholder"><i class="fa-solid fa-user"></i></div>`}
            </div>
          </td>
          <td>
            <div class="fw-bold dashboard-mobile-name">${html(item.full_name || '')}</div>
            <div class="small text-muted dashboard-mobile-subtext">${html(item.martyrdom_place || '')}</div>
          </td>
          <td>${html(item.family_name || '')}</td>
          <td>${html(item.father_name || '')}</td>
          <td>${statusBadgeSafe(statusText)} ${needs}</td>
          <td onclick="event.stopPropagation();">
            <div class="dashboard-desktop-actions d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${martyrId}', 'dashboardPage')">عرض</button>
              <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${martyrId}', 'موثق')">توثيق</button>
              <button class="btn btn-sm btn-warning" onclick="verifyWithCompletionQuick('${martyrId}')">توثيق مع الاستكمال</button>
              <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${martyrId}', 'مرفوض')">رفض</button>
            </div>
            ${typeof window.openDashboardActionModalFinal === 'function' ? `<button class="btn btn-sm btn-primary dashboard-mobile-action-btn" onclick="openDashboardActionModalFinal('${martyrId}', event)">إجراء</button>` : ''}
          </td>
        </tr>`;
    }).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="6">${makePagination(state.dashboardPage, totalPages, 'goToDashboardPage', list.length, pageSize)}</td>
      </tr>`;
  };

  function buildUpdateRequestsList() {
    const search = normalize(document.getElementById('dataUpdatesSearchInput')?.value || document.getElementById('dataUpdatesMobileSearchInput')?.value || '');
    const statusFilter = document.getElementById('dataUpdatesStatusFilter')?.value ?? 'بانتظار المراجعة';
    const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

    let list = Array.isArray(dataUpdateRequests) ? dataUpdateRequests.slice() : [];
    list.forEach(prepareRequestItem);

    if (statusFilter) list = list.filter(function(item) { return requestStatusOf(item) === statusFilter; });
    if (search) list = list.filter(function(item) { return (item.__stableRequestSearchText || '').includes(search); });

    if (sortBy === 'oldest') list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    else if (sortBy === 'name') list.sort((a, b) => String(a.martyr_name || '').localeCompare(String(b.martyr_name || ''), 'ar'));
    else list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return list;
  }

  window.renderDataUpdateRequestsTable = function() {
    const tbody = document.getElementById('dataUpdatesTableBody');
    const countBadge = document.getElementById('dataUpdatesCount');
    if (!tbody) return;

    ensureDashboardControls();

    const rawList = Array.isArray(dataUpdateRequests) ? dataUpdateRequests : [];
    if (!rawList.length && (state.loading || !state.loaded)) {
      tbody.innerHTML = loadingRow(6, 'جاري تحميل طلبات الاستكمال...');
      if (countBadge) countBadge.textContent = '...';
      return;
    }

    const list = buildUpdateRequestsList();
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

    tbody.innerHTML = pageList.map(function(item) {
      const requestId = item.update_id || item.request_id || '';
      const img = item.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w220` : '';
      const requestText = item.submitted_text || item.request_text || '';

      return `
        <tr data-request-id="${attr(requestId)}">
          <td>${html(item.created_at || '')}</td>
          <td class="fw-bold" style="cursor:pointer" onclick="openMartyrDetails('${attr(item.martyr_id)}', 'dashboardDataUpdatesTab')">${html(item.martyr_name || '')}</td>
          <td>${html(item.family_name || '')}</td>
          <td class="request-text-cell"><div>${html(requestText)}</div>${img ? `<a href="${attr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}</td>
          <td>${statusBadgeSafe(requestStatusOf(item))}</td>
          <td class="dashboard-action-cell">${isPendingRequestSafe(item.status) ? `
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${attr(requestId)}')">قبول وإضافة</button>
              <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${attr(requestId)}')">رفض</button>
            </div>` : '-'}</td>
        </tr>`;
    }).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="6">${makePagination(state.updatesPage, totalPages, 'goToDataUpdatesPage', list.length, pageSize)}</td>
      </tr>`;
  };

  function isJoinPendingStatus(status) {
  const text = String(status || '').trim();
  return !text ||
    text === 'بانتظار التوثيق' ||
    text === 'بانتظار المراجعة' ||
    text === 'قيد المراجعة' ||
    text.includes('انتظار') ||
    text.includes('مراجعة');
}

function buildJoinRequestsList() {
  const search = normalize(
    document.getElementById('joinRequestsSearchInput')?.value ||
    document.getElementById('joinCompactSearchInput')?.value ||
    ''
  );

  const statusFilter =
    document.getElementById('joinRequestsStatusFilter')?.value ??
    document.getElementById('joinCompactStatusFilter')?.value ??
    'بانتظار التوثيق';

  const sortBy =
    document.getElementById('joinRequestsSortSelect')?.value ||
    document.getElementById('joinCompactSortSelect')?.value ||
    'newest';

  let list = Array.isArray(joinRequests) ? joinRequests.slice() : [];
  list.forEach(prepareRequestItem);

  if (statusFilter) {
    if (statusFilter === 'بانتظار التوثيق' || statusFilter === 'بانتظار المراجعة') {
      list = list.filter(function(item) {
        return isJoinPendingStatus(item.status);
      });
    } else {
      list = list.filter(function(item) {
        return String(item.status || '').trim() === statusFilter;
      });
    }
  }

  if (search) {
    list = list.filter(function(item) {
      const content = normalize([
        item.__stableRequestSearchText,
        item.full_name,
        item.family_name,
        item.phone,
        item.notes,
        item.birth_year
      ].join(' '));

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

 window.renderJoinRequestsTable = function() {
  const tbody = document.getElementById('joinRequestsTableBody');
  const countBadge = document.getElementById('joinRequestsCount');
  if (!tbody) return;

  const rawList = Array.isArray(joinRequests) ? joinRequests : [];

  if (!rawList.length && (state.loading || !state.loaded)) {
    tbody.innerHTML = loadingRow(8, 'جاري تحميل طلبات الانضمام...');
    if (countBadge) countBadge.textContent = '...';
    return;
  }

  const list = buildJoinRequestsList();

  if (countBadge) countBadge.textContent = list.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات انضمام مطابقة.</td></tr>`;
    return;
  }

  const pageSize = requestPageSize();
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));

  if (state.joinPage > totalPages) state.joinPage = totalPages;
  if (state.joinPage < 1) state.joinPage = 1;

  const start = (state.joinPage - 1) * pageSize;
  const pageList = list.slice(start, start + pageSize);

  tbody.innerHTML = pageList.map(function(item) {
    const requestId = item.request_id || '';
    const pending = isJoinPendingStatus(item.status);

    return `
      <tr data-join-id="${attr(requestId)}">
        <td>${html(item.created_at || '')}</td>
        <td class="fw-bold">${html(item.full_name || '')}</td>
        <td>${html(item.family_name || '')}</td>
        <td>${html(item.birth_year || '')}</td>
        <td>${html(item.phone || '')}</td>
        <td class="request-text-cell">${html(item.notes || '')}</td>
        <td>${statusBadgeSafe(item.status)}</td>
        <td class="dashboard-action-cell">
          ${pending ? `
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="updateJoinRequestStatusFromDashboard('${attr(requestId)}', 'موثق')">قبول</button>
              <button class="btn btn-sm btn-outline-danger" onclick="updateJoinRequestStatusFromDashboard('${attr(requestId)}', 'مرفوض')">رفض</button>
            </div>
          ` : '-'}
        </td>
      </tr>`;
  }).join('') + `
    <tr class="dash-pagination-row">
      <td colspan="8">${makePagination(state.joinPage, totalPages, 'goToJoinRequestsPage', list.length, pageSize)}</td>
    </tr>`;
};

  function renderAllDashboardTables() {
    try { window.renderDashboardTable(); } catch (e) {}
    try { window.renderDataUpdateRequestsTable(); } catch (e) {}
    try { window.renderJoinRequestsTable(); } catch (e) {}
    try { if (typeof renderInboxTable === 'function') renderInboxTable(); } catch (e) {}
  }

  window.goToDashboardPage = function(page) {
    state.dashboardPage = Math.max(1, Number(page) || 1);
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

  window.resetJoinRequestsPageAndRender = function() {
  state.joinPage = 1;
  window.renderJoinRequestsTable();
};

window.goToJoinRequestsPageFixed = window.goToJoinRequestsPage;

try { resetJoinRequestsPageAndRender = window.resetJoinRequestsPageAndRender; } catch (e) {}
try { goToJoinRequestsPageFixed = window.goToJoinRequestsPageFixed; } catch (e) {}

  function bindFilterControls() {
    const dashSearch = document.getElementById('dashboardSearchInput');
    const dashMobileSearch = document.getElementById('dashboardMobileSearchInput');
    const dashStatus = document.getElementById('dashboardStatusFilter');
    const dashSort = document.getElementById('dashboardSortSelect');
    const updatesSearch = document.getElementById('dataUpdatesSearchInput');
    const updatesMobileSearch = document.getElementById('dataUpdatesMobileSearchInput');
    const updatesStatus = document.getElementById('dataUpdatesStatusFilter');
    const updatesSort = document.getElementById('dataUpdatesSortSelect');

    function delayed(kind) {
      clearTimeout(state.renderTimer);
      state.renderTimer = setTimeout(function() {
        if (kind === 'updates') {
          state.updatesPage = 1;
          window.renderDataUpdateRequestsTable();
        } else {
          state.dashboardPage = 1;
          window.renderDashboardTable();
        }
      }, 80);
    }

    if (dashSearch && !dashSearch.__stableDashBound) {
      dashSearch.__stableDashBound = true;
      dashSearch.addEventListener('input', function() { delayed('dash'); });
    }
    if (dashMobileSearch && !dashMobileSearch.__stableDashBound) {
      dashMobileSearch.__stableDashBound = true;
      dashMobileSearch.addEventListener('input', function() {
        if (dashSearch) dashSearch.value = dashMobileSearch.value || '';
        delayed('dash');
      });
    }
    if (dashStatus && !dashStatus.__stableDashBound) {
      dashStatus.__stableDashBound = true;
      dashStatus.addEventListener('change', function() { state.dashboardPage = 1; window.renderDashboardTable(); });
    }
    if (dashSort && !dashSort.__stableDashBound) {
      dashSort.__stableDashBound = true;
      dashSort.addEventListener('change', function() { state.dashboardPage = 1; window.renderDashboardTable(); });
    }
    if (updatesSearch && !updatesSearch.__stableDashBound) {
      updatesSearch.__stableDashBound = true;
      updatesSearch.addEventListener('input', function() { delayed('updates'); });
    }
    if (updatesMobileSearch && !updatesMobileSearch.__stableDashBound) {
      updatesMobileSearch.__stableDashBound = true;
      updatesMobileSearch.addEventListener('input', function() {
        if (updatesSearch) updatesSearch.value = updatesMobileSearch.value || '';
        delayed('updates');
      });
    }
    if (updatesStatus && !updatesStatus.__stableDashBound) {
      updatesStatus.__stableDashBound = true;
      updatesStatus.addEventListener('change', function() { state.updatesPage = 1; window.renderDataUpdateRequestsTable(); });
    }
    if (updatesSort && !updatesSort.__stableDashBound) {
      updatesSort.__stableDashBound = true;
      updatesSort.addEventListener('change', function() { state.updatesPage = 1; window.renderDataUpdateRequestsTable(); });
    }
  }

  function wantedTab(tabName) {
    if (tabName) return tabName;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || localStorage.getItem('taldo_last_dashboard_tab') || window.__lastDashboardTab || 'martyrs';
    } catch (e) {
      return window.__lastDashboardTab || 'martyrs';
    }
  }

  function rememberDashboard(tabName) {
    try {
      localStorage.setItem('taldo_last_active_page', 'dashboard');
      localStorage.setItem('taldo_last_dashboard_tab', tabName || 'martyrs');
    } catch (e) {}
  }

  function syncDashboardUrl(tabName) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'dashboard');
      url.searchParams.set('tab', tabName || 'martyrs');
      history.replaceState({ page: 'dashboard', tab: tabName || 'martyrs' }, '', url.toString());
    } catch (e) {}
  }

  window.openDashboardPage = function(tabName) {
    if (!isAdminMode()) {
      if (typeof openLoginModal === 'function') openLoginModal();
      return;
    }

    const tab = wantedTab(tabName);
    rememberDashboard(tab);

    try { if (typeof updateAdminButtons === 'function') updateAdminButtons(); } catch (e) {}
    try { if (typeof showPage === 'function') showPage('dashboardPage'); } catch (e) {
      document.querySelectorAll('.page-section').forEach(function(section) { section.classList.remove('active'); });
      document.getElementById('dashboardPage')?.classList.add('active');
    }

    ensureDashboardControls();
    bindFilterControls();

    try { if (typeof showDashboardTab === 'function') showDashboardTab(tab); } catch (e) {}
    syncDashboardUrl(tab);

    window.refreshDashboardData(false, { useClientCache: true, forceFresh: false });
  };

  const oldRefreshCurrentSection = window.refreshCurrentSection || (typeof refreshCurrentSection === 'function' ? refreshCurrentSection : null);
  window.refreshCurrentSection = function() {
    if (activePageId() === 'dashboardPage') {
      return window.refreshDashboardData(true, { forceFresh: true, useClientCache: false });
    }
    if (typeof oldRefreshCurrentSection === 'function') return oldRefreshCurrentSection.apply(this, arguments);
  };

  try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
  try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
  try { renderDataUpdateRequestsTable = window.renderDataUpdateRequestsTable; } catch (e) {}
  try { renderJoinRequestsTable = window.renderJoinRequestsTable; } catch (e) {}
  try { openDashboardPage = window.openDashboardPage; } catch (e) {}
  try { refreshCurrentSection = window.refreshCurrentSection; } catch (e) {}

  function boot() {
    ensureDashboardControls();
    bindFilterControls();

    try {
      const params = new URLSearchParams(window.location.search);
      const shouldOpen = params.get('page') === 'dashboard' || localStorage.getItem('taldo_last_active_page') === 'dashboard';
      if (shouldOpen && isAdminMode()) {
        setTimeout(function() { window.openDashboardPage(wantedTab()); }, 120);
        setTimeout(function() {
          if (activePageId() === 'dashboardPage' && (!Array.isArray(dashboardData) || !dashboardData.length)) {
            window.refreshDashboardData(false, { useClientCache: true, forceFresh: false });
          }
        }, 1200);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('resize', function() {
    clearTimeout(window.__dashboardStableResizeTimer);
    window.__dashboardStableResizeTimer = setTimeout(function() {
      if (activePageId() === 'dashboardPage') renderAllDashboardTables();
    }, 180);
  }, { passive: true });

  window.TaldoDashboardStableTools = {
    refresh: function() { return window.refreshDashboardData(true, { forceFresh: true, useClientCache: false }); },
    render: renderAllDashboardTables,
    clearCache: function() { try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} },
    state
  };
})();
