(function() {
  'use strict';

  const ADMIN_CACHE_KEY = 'taldo_admin_dashboard_cache_v2';
  const ADMIN_CACHE_TTL = 2 * 60 * 1000;
  const DASH_PAGE_SIZE_DESKTOP = 45;
  const DASH_PAGE_SIZE_MOBILE = 28;
  const REQUEST_PAGE_SIZE = 35;

  let currentDashboardPage = 1;
  let currentDataUpdatesPage = 1;
  let currentJoinRequestsPage = 1;
  let dashboardLoadPromise = null;
  let dashboardRenderTimer = 0;

  function normalizeFast(value) {
    if (typeof normalizeText === 'function') return normalizeText(value || '');
    return String(value || '').toLowerCase().trim();
  }

  function makeDriveThumb(fileId, size) {
    return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 120}` : '';
  }

  function adminThumbSrc(item) {
    if (!item) return '';
    const fileId = item.image_file_id || (typeof extractDriveFileId === 'function' ? extractDriveFileId(item.image_url || '') : '');
    return fileId ? makeDriveThumb(fileId, 120) : (item.image_url || '');
  }

  function prepareDashboardRecord(item) {
    if (!item || item.__dashboardPrepared) return item;
    item.__dashboardSearchText = normalizeFast([
      item.full_name,
      item.family_name,
      item.father_name,
      item.nickname,
      item.martyrdom_place,
      item.martyrdom_date,
      item.martyrdom_type,
      item.extra_info
    ].join(' '));
    item.__dashboardSortDate = String(item.created_at || item.updated_at || '');
    item.__dashboardPrepared = true;
    return item;
  }

  function prepareRequestRecord(item) {
    if (!item || item.__requestPrepared) return item;
    item.__requestSearchText = normalizeFast([
      item.martyr_name,
      item.full_name,
      item.family_name,
      item.submitted_text,
      item.request_text,
      item.notes,
      item.phone
    ].join(' '));
    item.__requestPrepared = true;
    return item;
  }

  function getVisibleDashboardPageSize() {
    return window.innerWidth <= 768 ? DASH_PAGE_SIZE_MOBILE : DASH_PAGE_SIZE_DESKTOP;
  }

  function getStoredDashboardCache() {
    try {
      const raw = sessionStorage.getItem(ADMIN_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.value) return null;
      if (Date.now() - parsed.savedAt > ADMIN_CACHE_TTL) return null;
      return parsed.value;
    } catch (error) {
      return null;
    }
  }

  function storeDashboardCache(value) {
    if (!value || value.success === false) return;
    try {
      sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        value
      }));
    } catch (error) {
      try {
        sessionStorage.removeItem(ADMIN_CACHE_KEY);
      } catch (ignored) {}
    }
  }

  function clearDashboardClientCache() {
    try {
      sessionStorage.removeItem(ADMIN_CACHE_KEY);
    } catch (error) {}

    if (window.TaldoPerformanceTools && typeof window.TaldoPerformanceTools.clearPublicClientCache === 'function') {
      window.TaldoPerformanceTools.clearPublicClientCache();
    }
  }

  function computeStatsFromDashboardList(list) {
    const stats = { verified: 0, pending: 0, rejected: 0, total: 0, byFamily: [] };
    const familyMap = {};

    (list || []).forEach(item => {
      if (!item) return;
      stats.total++;
      const family = item.family_name || 'غير محدد';
      const status = item.verification_status || 'بانتظار التوثيق';

      if (!familyMap[family]) {
        familyMap[family] = { family_name: family, verified: 0, pending: 0, rejected: 0, total: 0 };
      }

      if (status === 'موثق') {
        stats.verified++;
        familyMap[family].verified++;
      } else if (status === 'مرفوض') {
        stats.rejected++;
        familyMap[family].rejected++;
      } else {
        stats.pending++;
        familyMap[family].pending++;
      }

      familyMap[family].total++;
    });

    stats.byFamily = Object.values(familyMap).sort((a, b) => b.total - a.total);
    return stats;
  }

  function applyDashboardPayload(res, options) {
    if (!res || !res.success) return false;

    dashboardData = Array.isArray(res.all) ? res.all : [];
    dashboardData.forEach(prepareDashboardRecord);

    dataUpdateRequests = Array.isArray(res.dataUpdates) ? res.dataUpdates : [];
    dataUpdateRequests.forEach(prepareRequestRecord);

    joinRequests = Array.isArray(res.joinRequests) ? res.joinRequests : [];
    joinRequests.forEach(prepareRequestRecord);

    statsData = res.stats || computeStatsFromDashboardList(dashboardData);

    if (Array.isArray(res.messages)) window.__adminMessages = res.messages;
    if (res.settings) publicSettings = res.settings;

    if (!options || options.saveCache !== false) {
      storeDashboardCache(res);
    }

    if (typeof updateStatsCards === 'function') updateStatsCards();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    renderDashboardTable();
    renderDataUpdateRequestsTable();
    renderJoinRequestsTable();
    if (typeof renderSettingsTab === 'function') renderSettingsTab();

    return true;
  }

  function setDashboardLoadingState() {
    const tbody = document.getElementById('dashboardTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            <span class="spinner-border spinner-border-sm ms-1"></span>
            جاري تحميل بيانات لوحة التحكم...
          </td>
        </tr>`;
    }

    const updates = document.getElementById('dataUpdatesTableBody');
    if (updates) {
      updates.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">جاري تحميل طلبات الاستكمال...</td></tr>`;
    }

    const joins = document.getElementById('joinRequestsTableBody');
    if (joins) {
      joins.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">جاري تحميل طلبات الانضمام...</td></tr>`;
    }
  }

  function showDashboardCacheNote(text) {
    const holder = document.querySelector('#dashboardMartyrsTab .dashboard-table-card');
    if (!holder) return;

    let note = document.getElementById('dashboardFastCacheNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'dashboardFastCacheNote';
      note.className = 'dashboard-mini-note';
      holder.parentNode.insertBefore(note, holder);
    }

    note.textContent = text;
    clearTimeout(window.__dashboardCacheNoteTimer);
    window.__dashboardCacheNoteTimer = setTimeout(() => {
      if (note) note.remove();
    }, 2800);
  }

  window.refreshDashboardData = function(showMsg = true, options = {}) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return Promise.resolve(false);
    }

    const forceFresh = !!options.forceFresh;
    const useClientCache = options.useClientCache !== false;

    if (useClientCache && !forceFresh) {
      const cached = getStoredDashboardCache();
      if (cached && (!dashboardData || !dashboardData.length)) {
        applyDashboardPayload(cached, { saveCache: false });
        showDashboardCacheNote('تم عرض آخر نسخة محفوظة فورًا، ويجري التحقق من أي تحديثات.');
      }
    }

    if (!dashboardData || !dashboardData.length) {
      setDashboardLoadingState();
    }

    if (dashboardLoadPromise && !forceFresh) return dashboardLoadPromise;

    const payload = forceFresh
      ? { forceFresh: true, __cacheBust: String(Date.now()) }
      : {};

    dashboardLoadPromise = apiRequest('getAdminDashboardData', payload)
      .then(res => {
        dashboardLoadPromise = null;

        if (!res || !res.success) {
          showToast(res?.message || 'تعذر تحميل بيانات لوحة التحكم.');
          return false;
        }

        applyDashboardPayload(res);
        if (showMsg) showToast(res.fromCache ? 'تم عرض بيانات لوحة التحكم من الكاش.' : 'تم تحديث لوحة التحكم.');
        return true;
      })
      .catch(err => {
        dashboardLoadPromise = null;
        showToast(err.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
        return false;
      });

    return dashboardLoadPromise;
  };

  window.openDashboardPage = function(tabName) {
    if (!isAdminLoggedIn) {
      openLoginModal();
      return;
    }

    if (typeof updateAdminButtons === 'function') updateAdminButtons();

    showPage('dashboardPage');

    const params = new URLSearchParams(window.location.search);
    const selectedTab = tabName || params.get('tab') || window.__lastDashboardTab || 'martyrs';
    showDashboardTab(selectedTab);

    refreshDashboardData(false, {
      useClientCache: true,
      forceFresh: !dashboardData || !dashboardData.length
    });
  };

  function makePagination(current, totalPages, onClickName, totalItems, pageSize) {
    if (totalPages <= 1) {
      return `<div class="text-muted small text-center">عرض ${totalItems} عنصر</div>`;
    }

    const pages = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);

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
        <button class="btn btn-outline-primary btn-sm" onclick="${onClickName}(${current - 1})" ${current <= 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        ${pages.map(page => {
          if (page === '...') return `<span class="text-muted px-1">...</span>`;
          return `<button class="btn btn-sm ${page === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="${onClickName}(${page})">${page}</button>`;
        }).join('')}
        <button class="btn btn-outline-primary btn-sm" onclick="${onClickName}(${current + 1})" ${current >= totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small">عرض ${from} - ${to} من ${totalItems}</div>
      </div>`;
  }

  window.goToDashboardPage = function(page) {
    currentDashboardPage = Math.max(1, Number(page) || 1);
    renderDashboardTable();
  };

  window.goToDataUpdatesPage = function(page) {
    currentDataUpdatesPage = Math.max(1, Number(page) || 1);
    renderDataUpdateRequestsTable();
  };

  window.goToJoinRequestsPage = function(page) {
    currentJoinRequestsPage = Math.max(1, Number(page) || 1);
    renderJoinRequestsTable();
  };

  window.renderDashboardTable = function() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    const search = normalizeFast(document.getElementById('dashboardSearchInput')?.value || '');
    const status = document.getElementById('dashboardStatusFilter')?.value || '';
    const sortBy = document.getElementById('dashboardSortSelect')?.value || 'pending-first';

    let list = (dashboardData || []).slice();
    list.forEach(prepareDashboardRecord);

    if (status) list = list.filter(item => item.verification_status === status);
    if (search) list = list.filter(item => item.__dashboardSearchText && item.__dashboardSearchText.includes(search));

    if (sortBy === 'name') {
      list.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar'));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => String(b.__dashboardSortDate || '').localeCompare(String(a.__dashboardSortDate || '')));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.__dashboardSortDate || '').localeCompare(String(b.__dashboardSortDate || '')));
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

    const pageSize = getVisibleDashboardPageSize();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentDashboardPage > totalPages) currentDashboardPage = totalPages;
    if (currentDashboardPage < 1) currentDashboardPage = 1;

    const start = (currentDashboardPage - 1) * pageSize;
    const pageList = list.slice(start, start + pageSize);

    const rows = pageList.map(item => {
      const img = adminThumbSrc(item);
      return `
        <tr data-martyr-id="${escapeAttr(item.martyr_id || '')}">
          <td style="width:62px;">
            ${img ? `<img src="${escapeAttr(img)}" class="dashboard-thumb" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div style="display:none;width:46px;height:46px;border-radius:13px;background:#f1f3f5;place-items:center;color:#adb5bd;"><i class="fa-solid fa-user"></i></div>` :
              `<div style="width:46px;height:46px;border-radius:13px;background:#f1f3f5;display:grid;place-items:center;color:#adb5bd;"><i class="fa-solid fa-user"></i></div>`}
          </td>
          <td>
            <div class="fw-bold">${escapeHtml(item.full_name || '')}</div>
            <div class="small text-muted">${escapeHtml(item.martyrdom_place || '')}</div>
          </td>
          <td>${escapeHtml(item.family_name || '')}</td>
          <td>${escapeHtml(item.father_name || '')}</td>
          <td>${statusBadge(item.verification_status)} ${typeof isNeedsCompletion === 'function' && isNeedsCompletion(item) ? '<span class="badge text-bg-warning">يحتاج استكمال</span>' : ''}</td>
          <td class="dashboard-action-cell">
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardPage')">عرض</button>
              <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'موثق')">توثيق</button>
              <button class="btn btn-sm btn-warning" onclick="verifyWithCompletionQuick('${escapeAttr(item.martyr_id)}')">توثيق مع الاستكمال</button>
              <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'مرفوض')">رفض</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows + `
      <tr class="dash-pagination-row">
        <td colspan="6">${makePagination(currentDashboardPage, totalPages, 'goToDashboardPage', list.length, pageSize)}</td>
      </tr>`;
  };

  window.renderDataUpdateRequestsTable = function() {
    const tbody = document.getElementById('dataUpdatesTableBody');
    const countBadge = document.getElementById('dataUpdatesCount');
    if (!tbody) return;

    const search = normalizeFast(document.getElementById('dataUpdatesSearchInput')?.value || '');
    const filterEl = document.getElementById('dataUpdatesStatusFilter');
    const statusFilter = filterEl ? filterEl.value : 'بانتظار المراجعة';
    const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

    let list = (dataUpdateRequests || []).slice();
    list.forEach(prepareRequestRecord);

    if (statusFilter) list = list.filter(item => String(item.status || '').trim() === statusFilter);
    if (search) list = list.filter(item => item.__requestSearchText && item.__requestSearchText.includes(search));

    if (sortBy === 'oldest') list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    else if (sortBy === 'name') list.sort((a, b) => String(a.martyr_name || '').localeCompare(String(b.martyr_name || ''), 'ar'));
    else list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    if (countBadge) countBadge.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد طلبات مطابقة.</td></tr>`;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / REQUEST_PAGE_SIZE));
    if (currentDataUpdatesPage > totalPages) currentDataUpdatesPage = totalPages;
    if (currentDataUpdatesPage < 1) currentDataUpdatesPage = 1;

    const start = (currentDataUpdatesPage - 1) * REQUEST_PAGE_SIZE;
    const pageList = list.slice(start, start + REQUEST_PAGE_SIZE);

    tbody.innerHTML = pageList.map(item => {
      const requestId = item.update_id || item.request_id || '';
      const requestText = item.submitted_text || item.request_text || '';
      const img = item.image_file_id ? makeDriveThumb(item.image_file_id, 220) : '';
      return `
        <tr data-request-id="${escapeAttr(requestId)}">
          <td>${escapeHtml(item.created_at || '')}</td>
          <td class="fw-bold" style="cursor:pointer" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardDataUpdatesTab')">${escapeHtml(item.martyr_name || '')}</td>
          <td>${escapeHtml(item.family_name || '')}</td>
          <td class="request-text-cell">
            <div>${escapeHtml(requestText)}</div>
            ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
          </td>
          <td>${statusBadge(item.status)}</td>
          <td class="dashboard-action-cell">${isPendingRequest(item.status) ? `
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${escapeAttr(requestId)}')">قبول وإضافة</button>
              <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${escapeAttr(requestId)}')">رفض</button>
            </div>` : '-'}</td>
        </tr>`;
    }).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="6">${makePagination(currentDataUpdatesPage, totalPages, 'goToDataUpdatesPage', list.length, REQUEST_PAGE_SIZE)}</td>
      </tr>`;
  };

  window.renderJoinRequestsTable = function() {
    const tbody = document.getElementById('joinRequestsTableBody');
    const count = document.getElementById('joinRequestsCount');
    if (!tbody) return;

    let list = (joinRequests || []).slice();
    list.forEach(prepareRequestRecord);
    if (count) count.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات انضمام.</td></tr>`;
      return;
    }

    list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    const totalPages = Math.max(1, Math.ceil(list.length / REQUEST_PAGE_SIZE));
    if (currentJoinRequestsPage > totalPages) currentJoinRequestsPage = totalPages;
    if (currentJoinRequestsPage < 1) currentJoinRequestsPage = 1;

    const start = (currentJoinRequestsPage - 1) * REQUEST_PAGE_SIZE;
    const pageList = list.slice(start, start + REQUEST_PAGE_SIZE);

    tbody.innerHTML = pageList.map(item => `
      <tr data-join-id="${escapeAttr(item.request_id || '')}">
        <td>${escapeHtml(item.created_at || '')}</td>
        <td class="fw-bold">${escapeHtml(item.full_name || '')}</td>
        <td>${escapeHtml(item.family_name || '')}</td>
        <td>${escapeHtml(item.birth_year || '')}</td>
        <td>${escapeHtml(item.phone || '')}</td>
        <td class="request-text-cell">${escapeHtml(item.notes || '')}</td>
        <td>${statusBadge(item.status)}</td>
        <td class="dashboard-action-cell">
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-success" onclick="updateJoinRequestStatusFromDashboard('${escapeAttr(item.request_id)}', 'موثق')">قبول</button>
            <button class="btn btn-sm btn-outline-danger" onclick="updateJoinRequestStatusFromDashboard('${escapeAttr(item.request_id)}', 'مرفوض')">رفض</button>
          </div>
        </td>
      </tr>
    `).join('') + `
      <tr class="dash-pagination-row">
        <td colspan="8">${makePagination(currentJoinRequestsPage, totalPages, 'goToJoinRequestsPage', list.length, REQUEST_PAGE_SIZE)}</td>
      </tr>`;
  };

  function scheduleDashboardRender(target) {
    clearTimeout(dashboardRenderTimer);
    dashboardRenderTimer = setTimeout(() => {
      if (target === 'updates') currentDataUpdatesPage = 1;
      else currentDashboardPage = 1;

      if (target === 'updates') renderDataUpdateRequestsTable();
      else renderDashboardTable();
    }, 120);
  }

  function recomputeAndRenderAfterLocalMutation() {
    statsData = computeStatsFromDashboardList(dashboardData || []);
    if (typeof updateStatsCards === 'function') updateStatsCards();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    renderDashboardTable();
    renderDataUpdateRequestsTable();
    renderJoinRequestsTable();
    if (document.getElementById('homePage')?.classList.contains('active') && typeof renderMartyrs === 'function') {
      renderMartyrs();
    }
  }

  function updateLocalMartyr(martyrId, fields) {
    [dashboardData, allMartyrs].forEach(list => {
      if (!Array.isArray(list)) return;
      const item = list.find(x => x && x.martyr_id === martyrId);
      if (item) {
        Object.assign(item, fields || {});
        item.__dashboardPrepared = false;
        if (typeof window.prepareMartyrRecord === 'function') window.prepareMartyrRecord(item);
        prepareDashboardRecord(item);
      }
    });

    if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
      Object.assign(currentDetailsItem, fields || {});
      currentDetailsItem.__dashboardPrepared = false;
      prepareDashboardRecord(currentDetailsItem);
    }
  }

  function markRequestStatusLocally(requestId, status, notes) {
    (dataUpdateRequests || []).forEach(item => {
      const id = item.update_id || item.request_id || '';
      if (id === requestId) {
        item.status = status;
        item.reviewer_notes = notes || item.reviewer_notes || '';
        item.__requestPrepared = false;
        prepareRequestRecord(item);
      }
    });
    currentDataUpdatesPage = 1;
    renderDataUpdateRequestsTable();
  }

  function markJoinStatusLocally(requestId, status, notes) {
    (joinRequests || []).forEach(item => {
      if (item.request_id === requestId) {
        item.status = status;
        item.reviewer_notes = notes || item.reviewer_notes || '';
        item.__requestPrepared = false;
        prepareRequestRecord(item);
      }
    });
    currentJoinRequestsPage = 1;
    renderJoinRequestsTable();
  }

  function refreshAfterMutation() {
    clearDashboardClientCache();
    window.__taldoBypassPublicCacheUntil = Date.now() + 90 * 1000;

    refreshDashboardData(false, {
      forceFresh: true,
      useClientCache: false
    });

    if (typeof loadInitialData === 'function') {
      setTimeout(() => loadInitialData(), 150);
    }
  }

  window.quickUpdateStatus = function(martyrId, status) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    updateLocalMartyr(martyrId, { verification_status: status, updated_at: new Date().toISOString() });
    recomputeAndRenderAfterLocalMutation();
    clearDashboardClientCache();

    const runner = () => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: ''
    }).then(res => {
      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر تحديث الحالة.');
        refreshDashboardData(false, { forceFresh: true, useClientCache: false });
        return;
      }

      showToast(res.message || 'تم تحديث الحالة.');
      refreshAfterMutation();
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث الحالة.');
      refreshDashboardData(false, { forceFresh: true, useClientCache: false });
    });

    return typeof runWithoutScrollJump === 'function' ? runWithoutScrollJump(runner) : runner();
  };

  window.verifyWithCompletionQuick = function(martyrId) {
    updateLocalMartyr(martyrId, {
      verification_status: 'موثق',
      needs_completion: 'نعم',
      allow_updates: 'نعم',
      updated_at: new Date().toISOString()
    });
    recomputeAndRenderAfterLocalMutation();
    clearDashboardClientCache();

    const runner = () => apiRequest('verifyMartyrWithCompletion', { martyrId }).then(res => {
      if (!res || res.success === false) return showToast(res?.message || 'تعذر تحديث الحالة.');
      showToast(res.message || 'تم التوثيق مع الاستكمال.');
      refreshAfterMutation();
    }).catch(err => showToast(err.message || 'تعذر تحديث الحالة.'));

    return typeof runWithoutScrollJump === 'function' ? runWithoutScrollJump(runner) : runner();
  };

  window.updateStatusFromDetails = function(martyrId, status) {
    const notes = document.getElementById('reviewerNotes')?.value || '';

    updateLocalMartyr(martyrId, { verification_status: status, updated_at: new Date().toISOString() });
    recomputeAndRenderAfterLocalMutation();

    const runner = () => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: notes
    }).then(res => {
      if (!res || res.success === false) return showToast(res?.message || 'تعذر تحديث الحالة.');
      showToast(res.message || 'تم تحديث الحالة.');
      showPage('dashboardPage');
      refreshAfterMutation();
    }).catch(err => showToast(err.message || 'تعذر تحديث الحالة.'));

    return typeof runWithoutScrollJump === 'function' ? runWithoutScrollJump(runner) : runner();
  };

  window.verifyWithCompletionFromDetails = function(martyrId) {
    const notes = document.getElementById('reviewerNotes')?.value || '';

    updateLocalMartyr(martyrId, {
      verification_status: 'موثق',
      needs_completion: 'نعم',
      allow_updates: 'نعم',
      updated_at: new Date().toISOString()
    });
    recomputeAndRenderAfterLocalMutation();

    const runner = () => apiRequest('verifyMartyrWithCompletion', { martyrId, reviewerNotes: notes }).then(res => {
      if (!res || res.success === false) return showToast(res?.message || 'تعذر تحديث الحالة.');
      showToast(res.message || 'تم التوثيق مع طلب الاستكمال.');
      showPage('dashboardPage');
      refreshAfterMutation();
    }).catch(err => showToast(err.message || 'تعذر تحديث الحالة.'));

    return typeof runWithoutScrollJump === 'function' ? runWithoutScrollJump(runner) : runner();
  };

  window.saveCompletionSwitches = function(martyrId) {
    const allow = document.getElementById('allowUpdatesSwitch')?.checked ? 'نعم' : 'لا';
    const needs = document.getElementById('needsCompletionSwitch')?.checked ? 'نعم' : 'لا';

    updateLocalMartyr(martyrId, {
      allow_updates: allow,
      needs_completion: needs,
      updated_at: new Date().toISOString()
    });
    recomputeAndRenderAfterLocalMutation();

    const runner = () => apiRequest('setMartyrCompletionOptions', {
      martyrId,
      allowUpdates: allow,
      needsCompletion: needs
    }).then(res => {
      if (!res || res.success === false) return showToast(res?.message || 'تعذر حفظ الخيارات.');
      showToast(res.message || 'تم حفظ الخيارات.');
      refreshAfterMutation();
    }).catch(err => showToast(err.message || 'تعذر حفظ الخيارات.'));

    return typeof runWithoutScrollJump === 'function' ? runWithoutScrollJump(runner) : runner();
  };

  window.saveMartyrEdits = function() {
    const fields = ['full_name','family_name','father_name','birth_year','nickname','martyrdom_type','battle_name','other_cause','martyrdom_date','martyrdom_place','extra_info'];
    const martyrId = document.getElementById('editMartyrId')?.value || '';
    const payload = { martyr_id: martyrId };

    fields.forEach(field => {
      payload[field] = document.getElementById('edit_' + field)?.value || '';
    });

    const btn = document.getElementById('editMartyrSaveBtn');
    const normalHtml = 'حفظ التعديلات';
    if (typeof setButtonLoading === 'function') setButtonLoading(btn, true, 'جاري الحفظ...', normalHtml);
    else if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;
    }

    updateLocalMartyr(martyrId, Object.assign({}, payload, { updated_at: new Date().toISOString() }));
    recomputeAndRenderAfterLocalMutation();

    apiRequest('updateMartyrFields', payload).then(res => {
      if (typeof setButtonLoading === 'function') setButtonLoading(btn, false, '', normalHtml);
      else if (btn) {
        btn.disabled = false;
        btn.innerHTML = normalHtml;
      }

      if (!res || res.success === false) return showToast(res?.message || 'تعذر الحفظ.');

      modals.editMartyrModal?.hide();
      showToast(res.message || 'تم الحفظ.');

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'dashboardPage', true);
      }

      refreshAfterMutation();
    }).catch(err => {
      if (typeof setButtonLoading === 'function') setButtonLoading(btn, false, '', normalHtml);
      else if (btn) {
        btn.disabled = false;
        btn.innerHTML = normalHtml;
      }
      showToast(err.message || 'تعذر الحفظ.');
      refreshDashboardData(false, { forceFresh: true, useClientCache: false });
    });
  };

  const originalApproveDataUpdateFromDashboard = window.approveDataUpdateFromDashboard;
  window.approveDataUpdateFromDashboard = function(requestId) {
    const item = (dataUpdateRequests || []).find(req => (req.update_id || req.request_id || '') === requestId);
    const newImages = typeof getUpdateRequestImages === 'function' ? getUpdateRequestImages(item) : [];
    const martyr = item ? ((dashboardData || []).find(x => x.martyr_id === item.martyr_id) || (allMartyrs || []).find(x => x.martyr_id === item.martyr_id)) : null;

    if (item && newImages.length && typeof hasOldMartyrImages === 'function' && hasOldMartyrImages(martyr)) {
      const hidden = document.getElementById('approveImageModeRequestId');
      if (hidden) hidden.value = requestId;
      const appendRadio = document.getElementById('approveImageAppend');
      if (appendRadio) appendRadio.checked = true;
      modals.approveImageModeModal?.show();
      return;
    }

    if (typeof approveDataUpdateWithMode === 'function') {
      approveDataUpdateWithMode(requestId, 'append');
      return;
    }

    if (typeof originalApproveDataUpdateFromDashboard === 'function') originalApproveDataUpdateFromDashboard(requestId);
  };

  window.approveDataUpdateWithMode = function(requestId, imageMode) {
    markRequestStatusLocally(requestId, 'مقبول');
    showDashboardCacheNote('تم إخفاء الطلب من القائمة فورًا، ويجري الحفظ على الخادم.');

    if (typeof showGlobalSpinner === 'function') showGlobalSpinner(true);

    apiRequest('approveDataUpdate', { updateId: requestId, requestId, imageMode: imageMode || 'append' })
      .then(res => {
        if (!res || res.success === false) {
          showToast(res?.message || 'تعذر قبول الطلب.');
          refreshDashboardData(false, { forceFresh: true, useClientCache: false });
          return;
        }

        showToast(res.message || 'تم قبول البيانات المستكملة.');
        refreshAfterMutation();
      })
      .catch(err => {
        showToast(err.message || 'تعذر قبول الطلب. تأكد من تحديث Code.gs أيضًا.');
        refreshDashboardData(false, { forceFresh: true, useClientCache: false });
      })
      .finally(() => {
        if (typeof hideGlobalSpinner === 'function') hideGlobalSpinner();
      });
  };

  window.rejectDataUpdateFromDashboard = function(requestId) {
    const reviewerNotes = prompt('سبب الرفض أو ملاحظات المراجع:') || '';
    markRequestStatusLocally(requestId, 'مرفوض', reviewerNotes);
    clearDashboardClientCache();

    apiRequest('rejectDataUpdate', { updateId: requestId, requestId, reviewerNotes })
      .then(res => {
        if (!res || res.success === false) return showToast(res?.message || 'تعذر رفض الطلب.');
        showToast(res.message || 'تم رفض طلب الاستكمال.');
        refreshAfterMutation();
      })
      .catch(err => {
        showToast(err.message || 'تعذر رفض الطلب. تأكد من تحديث Code.gs أيضًا.');
        refreshDashboardData(false, { forceFresh: true, useClientCache: false });
      });
  };

  window.updateJoinRequestStatusFromDashboard = function(requestId, status) {
    const reviewerNotes = status === 'مرفوض' ? 'تم الرفض من لوحة التحكم' : 'تم القبول من لوحة التحكم';

    markJoinStatusLocally(requestId, status, reviewerNotes);
    clearDashboardClientCache();

    apiRequest('updateJoinRequestStatus', {
      requestId,
      newStatus: status,
      reviewerNotes
    }).then(res => {
      if (!res || res.success === false) return showToast(res?.message || 'تعذر تحديث حالة الطلب.');
      showToast(res.message || 'تم تحديث حالة الطلب.');
      refreshAfterMutation();
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث حالة الطلب.');
      refreshDashboardData(false, { forceFresh: true, useClientCache: false });
    });
  };

  const oldShowDashboardTabFast = window.showDashboardTab;
  window.showDashboardTab = function(tabName) {
    window.__lastDashboardTab = tabName || 'martyrs';
    if (typeof oldShowDashboardTabFast === 'function') oldShowDashboardTabFast(tabName);

    if (tabName === 'dataUpdates') {
      currentDataUpdatesPage = 1;
      renderDataUpdateRequestsTable();
    } else if (tabName === 'joinRequests') {
      currentJoinRequestsPage = 1;
      renderJoinRequestsTable();
    } else if (tabName === 'martyrs') {
      renderDashboardTable();
    }
  };

  const originalApplyRouteFromLocationFast = window.applyRouteFromLocation;
  window.applyRouteFromLocation = function() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const tab = params.get('tab');

    if (page === 'dashboard' && isAdminLoggedIn) {
      openDashboardPage(tab || 'martyrs');
      return;
    }

    if (typeof originalApplyRouteFromLocationFast === 'function') {
      originalApplyRouteFromLocationFast();
    }
  };

  window.refreshCurrentSection = function() {
    const active = document.querySelector('.page-section.active')?.id || 'homePage';

    if (active === 'dashboardPage') {
      refreshDashboardData(true, { forceFresh: true, useClientCache: false });
      return;
    }

    if (active === 'detailsPage' && currentDetailsItem) {
      const martyrId = currentDetailsItem.martyr_id;
      Promise.resolve(refreshDashboardData(false, { forceFresh: true, useClientCache: false })).then(() => {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'homePage', true);
      });
      return;
    }

    if (typeof loadInitialData === 'function') loadInitialData();
    showToast('تم تحديث البيانات.');
  };

  document.addEventListener('DOMContentLoaded', () => {
    const dashSearch = document.getElementById('dashboardSearchInput');
    const dashStatus = document.getElementById('dashboardStatusFilter');
    const dashSort = document.getElementById('dashboardSortSelect');
    const updatesSearch = document.getElementById('dataUpdatesSearchInput');
    const updatesStatus = document.getElementById('dataUpdatesStatusFilter');
    const updatesSort = document.getElementById('dataUpdatesSortSelect');

    if (dashSearch) dashSearch.oninput = () => scheduleDashboardRender('martyrs');
    if (dashStatus) dashStatus.onchange = () => { currentDashboardPage = 1; renderDashboardTable(); };
    if (dashSort) dashSort.onchange = () => { currentDashboardPage = 1; renderDashboardTable(); };

    if (updatesSearch) updatesSearch.oninput = () => scheduleDashboardRender('updates');
    if (updatesStatus) updatesStatus.onchange = () => { currentDataUpdatesPage = 1; renderDataUpdateRequestsTable(); };
    if (updatesSort) updatesSort.onchange = () => { currentDataUpdatesPage = 1; renderDataUpdateRequestsTable(); };

    const params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'dashboard' && isAdminLoggedIn) {
      setTimeout(() => openDashboardPage(params.get('tab') || 'martyrs'), 80);
    }
  });

  window.addEventListener('resize', () => {
    clearTimeout(window.__dashboardResizeTimer);
    window.__dashboardResizeTimer = setTimeout(() => {
      if (document.getElementById('dashboardPage')?.classList.contains('active')) {
        renderDashboardTable();
      }
    }, 180);
  }, { passive: true });

  window.TaldoDashboardTools = {
    refresh: () => refreshDashboardData(true, { forceFresh: true, useClientCache: false }),
    clearCache: clearDashboardClientCache
  };
})();
