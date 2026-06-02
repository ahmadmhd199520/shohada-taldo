(function() {
  'use strict';

  const PAGE_SIZE_FAMILY = 50;
  let currentFamilyNameFinal = '';
  let currentFamilyPageFinal = 1;
  let currentFamilyViewModeFinal = 'cards';

  function h(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function a(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);
    return h(value).replaceAll('`', '&#096;');
  }

  function n(value) {
    if (typeof normalizeText === 'function') return normalizeText(value);
    return String(value || '').trim().toLowerCase();
  }

  function sourceForAdminAware() {
    if (window.isAdminLoggedIn && Array.isArray(window.dashboardData) && window.dashboardData.length) return window.dashboardData;
    if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) return dashboardData;
    return Array.isArray(window.allMartyrs) ? window.allMartyrs : (Array.isArray(allMartyrs) ? allMartyrs : []);
  }

  function isAdminNow() {
    try { return !!isAdminLoggedIn; } catch (e) { return !!window.isAdminLoggedIn; }
  }

  function statusOf(item) {
    return String(item && item.verification_status || '').trim();
  }

  function itemNeedsCompletion(item) {
    if (typeof isNeedsCompletion === 'function') return isNeedsCompletion(item);
    const text = String(item && item.needs_completion || '').trim().toLowerCase();
    return ['نعم','yes','true','1','needs','يحتاج'].includes(text);
  }

  function countNeedsByFamilyFinal(source) {
    const map = {};
    (source || []).forEach(item => {
      if (!item) return;
      if (statusOf(item) === 'مرفوض') return;
      const family = item.family_name || 'غير محدد';
      if (!map[family]) map[family] = { family_name: family, needs: 0, total_visible: 0, verified: 0, pending: 0 };
      map[family].total_visible++;
      if (statusOf(item) === 'موثق') map[family].verified++;
      else map[family].pending++;
      if (itemNeedsCompletion(item)) map[family].needs++;
    });
    return map;
  }

  function buildFamilyRowsFinal() {
    const source = sourceForAdminAware();
    const needsMap = countNeedsByFamilyFinal(source);
    const rows = [];
    Object.keys(needsMap).forEach(family => rows.push(needsMap[family]));
    rows.sort((x, y) => {
      const totalY = Number(y.total_visible || 0);
      const totalX = Number(x.total_visible || 0);
      if (totalY !== totalX) return totalY - totalX;
      if (Number(y.needs || 0) !== Number(x.needs || 0)) return Number(y.needs || 0) - Number(x.needs || 0);
      return String(x.family_name || '').localeCompare(String(y.family_name || ''), 'ar');
    });
    return rows;
  }

  window.openFamiliesStatsPage = function() {
    const container = document.getElementById('familiesStatsContainer');
    if (!container) return;

    const rows = buildFamilyRowsFinal();
    container.innerHTML = '';

    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">لا توجد إحصائيات بعد.</div>`;
      if (typeof showPage === 'function') showPage('familiesPage');
      return;
    }

    const totalNeeds = rows.reduce((sum, item) => sum + Number(item.needs || 0), 0);
    const summary = document.createElement('div');
    summary.className = 'family-needs-summary';
    summary.innerHTML = `
      <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <div class="fw-bold">
          <i class="fa-solid fa-circle-exclamation text-warning ms-1"></i>
          إحصائية الأسماء التي تحتاج استكمالًا
        </div>
        <span class="family-needs-badge">
          <i class="fa-solid fa-list-check"></i>
          المجموع: ${totalNeeds}
        </span>
      </div>
    `;
    container.appendChild(summary);

    rows.forEach(item => {
      const row = document.createElement('div');
      row.className = 'family-row';
      row.onclick = function() { openFamilyMartyrs(item.family_name); };
      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <h5 class="fw-bold mb-1">عائلة ${h(item.family_name)}</h5>
            <div class="text-muted small">إجمالي الأسماء: ${Number(item.total_visible || 0)}</div>
          </div>
          <div class="text-end d-flex align-items-center justify-content-end gap-1 flex-wrap">
            <span class="badge badge-soft-blue me-1">موثق: ${Number(item.verified || 0)}</span>
            <span class="badge text-bg-warning me-1">بانتظار: ${Number(item.pending || 0)}</span>
            <span class="family-needs-badge me-1">
              <i class="fa-solid fa-circle-exclamation"></i>
              يحتاج استكمال: ${Number(item.needs || 0)}
            </span>
            <i class="fa-solid fa-chevron-left text-muted me-2"></i>
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    if (typeof showPage === 'function') showPage('familiesPage');
  };

  function ensureFamilyFilterModal() {
    if (document.getElementById('familyCompactFilterModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="familyCompactFilterModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header px-4 pt-4">
              <h5 class="modal-title fw-bold">
                <i class="fa-solid fa-filter text-primary ms-2"></i>
                خيارات عرض العائلة
              </h5>
              <button type="button" class="btn-close ms-0" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4">
              <div class="mb-3">
                <label class="form-label fw-bold">الحالة</label>
                <select id="familyCompactStatusFilter" class="form-select">
                  <option value="">الكل باستثناء المرفوض</option>
                  <option value="موثق">الأسماء الموثقة</option>
                  <option value="بانتظار التوثيق">أسماء بانتظار التوثق</option>
                  ${isAdminNow() ? '<option value="مرفوض">مرفوض</option>' : ''}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold">حالة الاستكمال</label>
                <select id="familyCompactCompletionFilter" class="form-select">
                  <option value="">الكل</option>
                  <option value="needs">يحتاج استكمال</option>
                  <option value="complete">لا يحتاج استكمال</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold">الفرز</label>
                <select id="familyCompactSortSelect" class="form-select">
                  <option value="name">أبجديًا حسب الاسم</option>
                  <option value="newest">الأحدث رفعًا</option>
                  <option value="oldest">الأقدم رفعًا</option>
                </select>
              </div>
              <div>
                <label class="form-label fw-bold">طريقة العرض</label>
                <div class="btn-group w-100">
                  <button type="button" class="btn btn-outline-primary" onclick="setFamilyViewModeFinal('cards')">
                    <i class="fa-solid fa-grip ms-1"></i> بطاقات
                  </button>
                  <button type="button" class="btn btn-outline-primary" onclick="setFamilyViewModeFinal('list')">
                    <i class="fa-solid fa-list ms-1"></i> قائمة
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer px-4 pb-4">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button>
              <button class="btn btn-primary" onclick="applyFamilyCompactFiltersFinal()">تطبيق</button>
            </div>
          </div>
        </div>
      </div>
    `);
    if (window.bootstrap && window.modals) {
      window.modals.familyCompactFilterModal = new bootstrap.Modal(document.getElementById('familyCompactFilterModal'));
    }
  }

  function ensureFamilySearchBar() {
    const page = document.getElementById('familyMartyrsPage');
    if (!page) return;
    if (!document.getElementById('familyCompactSearchBar')) {
      const anchor = document.getElementById('familyMartyrsContainer');
      const bar = document.createElement('div');
      bar.id = 'familyCompactSearchBar';
      bar.className = 'family-compact-search-filter';
      bar.innerHTML = `
        <input type="search" id="familyCompactSearchInput" class="form-control" placeholder="ابحث ضمن هذه العائلة...">
        <button class="btn btn-primary" type="button" onclick="openFamilyCompactFilterModalFinal()" aria-label="فلترة العائلة">
          <i class="fa-solid fa-filter"></i>
        </button>
      `;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
      else page.appendChild(bar);

      document.getElementById('familyCompactSearchInput').addEventListener('input', function() {
        currentFamilyPageFinal = 1;
        renderFamilyMartyrsPageFinal();
      });
    }
    ensureFamilyFilterModal();
  }

  window.openFamilyCompactFilterModalFinal = function() {
    ensureFamilySearchBar();
    const el = document.getElementById('familyCompactFilterModal');
    if (window.modals && window.modals.familyCompactFilterModal) return window.modals.familyCompactFilterModal.show();
    if (window.bootstrap && el) bootstrap.Modal.getOrCreateInstance(el).show();
  };

  window.applyFamilyCompactFiltersFinal = function() {
    const el = document.getElementById('familyCompactFilterModal');
    if (window.modals && window.modals.familyCompactFilterModal) window.modals.familyCompactFilterModal.hide();
    else if (window.bootstrap && el) bootstrap.Modal.getOrCreateInstance(el).hide();
    currentFamilyPageFinal = 1;
    renderFamilyMartyrsPageFinal();
  };

  window.setFamilyViewModeFinal = function(mode) {
    currentFamilyViewModeFinal = mode === 'list' ? 'list' : 'cards';
    renderFamilyMartyrsPageFinal();
  };

  function getFilteredFamilyListFinal() {
    const source = sourceForAdminAware();
    const search = n(document.getElementById('familyCompactSearchInput')?.value || '');
    const status = document.getElementById('familyCompactStatusFilter')?.value || '';
    const completion = document.getElementById('familyCompactCompletionFilter')?.value || '';
    const sortBy = document.getElementById('familyCompactSortSelect')?.value || 'name';

    let list = (source || []).filter(item => item && item.family_name === currentFamilyNameFinal);

    if (status) list = list.filter(item => statusOf(item) === status);
    else list = list.filter(item => statusOf(item) !== 'مرفوض');

    if (!isAdminNow()) list = list.filter(item => statusOf(item) !== 'مرفوض');

    if (completion === 'needs') list = list.filter(itemNeedsCompletion);
    if (completion === 'complete') list = list.filter(item => !itemNeedsCompletion(item));

    if (search) {
      list = list.filter(item => n([item.full_name, item.father_name, item.nickname, item.martyrdom_place, item.extra_info, item.martyrdom_type].join(' ')).includes(search));
    }

    if (sortBy === 'newest') list.sort((x,y) => String(y.created_at || y.updated_at || '').localeCompare(String(x.created_at || x.updated_at || '')));
    else if (sortBy === 'oldest') list.sort((x,y) => String(x.created_at || x.updated_at || '').localeCompare(String(y.created_at || y.updated_at || '')));
    else list.sort((x,y) => String(x.full_name || '').localeCompare(String(y.full_name || ''), 'ar'));

    return list;
  }

  window.renderFamilyMartyrsPageFinal = function() {
    ensureFamilySearchBar();
    const container = document.getElementById('familyMartyrsContainer');
    if (!container) return;
    const list = getFilteredFamilyListFinal();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE_FAMILY));
    if (currentFamilyPageFinal > totalPages) currentFamilyPageFinal = totalPages;
    if (currentFamilyPageFinal < 1) currentFamilyPageFinal = 1;
    const start = (currentFamilyPageFinal - 1) * PAGE_SIZE_FAMILY;
    const pageList = list.slice(start, start + PAGE_SIZE_FAMILY);

    if (!list.length) {
      container.innerHTML = `<div class="empty-state">لا توجد نتائج مطابقة ضمن هذه العائلة.</div>`;
      return;
    }

    const cards = currentFamilyViewModeFinal === 'cards'
      ? `<div class="martyrs-grid">${pageList.map(renderMartyrCardForFamily).join('')}</div>`
      : `<div>${pageList.map(renderMartyrListItem).join('')}</div>`;

    const pager = totalPages <= 1 ? '' : `
      <div class="martyrs-pagination">
        <button class="btn btn-outline-primary page-btn" onclick="goToFamilyPageFinal(${currentFamilyPageFinal - 1})" ${currentFamilyPageFinal === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <span class="px-2 text-muted">صفحة ${currentFamilyPageFinal} من ${totalPages}</span>
        <button class="btn btn-outline-primary page-btn" onclick="goToFamilyPageFinal(${currentFamilyPageFinal + 1})" ${currentFamilyPageFinal === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small mt-1">مجموع النتائج: ${list.length}</div>
      </div>`;

    container.innerHTML = cards + pager;
  };

  window.goToFamilyPageFinal = function(page) {
    currentFamilyPageFinal = Number(page) || 1;
    renderFamilyMartyrsPageFinal();
  };

  window.openFamilyMartyrs = function(familyName, noRoute) {
    currentFamilyNameFinal = familyName || '';
    currentFamilyPageFinal = 1;
    currentFamilyViewModeFinal = 'cards';
    ensureFamilySearchBar();
    const input = document.getElementById('familyCompactSearchInput');
    if (input) input.value = '';
    ['familyCompactStatusFilter','familyCompactCompletionFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sort = document.getElementById('familyCompactSortSelect');
    if (sort) sort.value = 'name';

    const listForTitle = sourceForAdminAware().filter(item => item && item.family_name === currentFamilyNameFinal && statusOf(item) !== 'مرفوض');
    const needsCount = listForTitle.filter(itemNeedsCompletion).length;
    const title = document.getElementById('familyPageTitle');
    if (title) {
      title.innerHTML = `
        شهداء عائلة ${h(currentFamilyNameFinal)}
        <span class="badge text-bg-warning me-2">يحتاج استكمال: ${needsCount}</span>
      `;
    }

    renderFamilyMartyrsPageFinal();
    if (!noRoute && typeof updateRoute === 'function') updateRoute(`?family=${encodeURIComponent(currentFamilyNameFinal)}`, { page: 'family', family: currentFamilyNameFinal });
    if (typeof showPage === 'function') showPage('familyMartyrsPage');
  };

  /* Dashboard rejected stat card */
  function ensureDashboardRejectedCard() {
    if (document.getElementById('dashRejectedCount')) return;
    const row = document.querySelector('#dashboardPage > .row.g-3.mb-4');
    if (!row) return;
    row.insertAdjacentHTML('beforeend', `
      <div class="col-md-4">
        <div class="dashboard-card d-flex align-items-center gap-3">
          <div class="stat-icon bg-danger-subtle text-danger">
            <i class="fa-solid fa-circle-xmark"></i>
          </div>
          <div>
            <div class="text-muted">المرفوض</div>
            <h3 id="dashRejectedCount" class="fw-bold mb-0">0</h3>
          </div>
        </div>
      </div>
    `);
  }

  const oldUpdateDashboardStatsFinal = window.updateDashboardStats || (typeof updateDashboardStats === 'function' ? updateDashboardStats : null);
  window.updateDashboardStats = function() {
    if (typeof oldUpdateDashboardStatsFinal === 'function') oldUpdateDashboardStatsFinal();
    ensureDashboardRejectedCard();
    const rejected = Number(statsData?.rejected || 0) || (Array.isArray(dashboardData) ? dashboardData.filter(item => statusOf(item) === 'مرفوض').length : 0);
    const el = document.getElementById('dashRejectedCount');
    if (el) el.textContent = rejected;
  };

  function dashboardStatusClass(status) {
    if (status === 'موثق') return 'verified';
    if (status === 'مرفوض') return 'rejected';
    return 'pending';
  }

  function ensureDashboardActionModal() {
    if (document.getElementById('dashboardActionModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="dashboardActionModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header px-4 pt-4">
              <h5 class="modal-title fw-bold"><i class="fa-solid fa-list-check text-primary ms-2"></i>إجراء على التوثيق</h5>
              <button type="button" class="btn-close ms-0" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4">
              <input type="hidden" id="dashboardActionMartyrId">
              <div class="fw-bold mb-3" id="dashboardActionMartyrName"></div>
              <div class="d-grid gap-2">
                <button class="btn btn-outline-primary" onclick="performDashboardActionFinal('view')"><i class="fa-solid fa-eye ms-1"></i>عرض البيانات</button>
                <button class="btn btn-success" onclick="performDashboardActionFinal('verify')"><i class="fa-solid fa-check ms-1"></i>توثيق</button>
                <button class="btn btn-warning" onclick="performDashboardActionFinal('verifyCompletion')"><i class="fa-solid fa-circle-exclamation ms-1"></i>توثيق مع الاستكمال</button>
                <button class="btn btn-outline-danger" onclick="performDashboardActionFinal('reject')"><i class="fa-solid fa-xmark ms-1"></i>رفض</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    if (window.bootstrap && window.modals) window.modals.dashboardActionModal = new bootstrap.Modal(document.getElementById('dashboardActionModal'));
  }

  window.openDashboardActionModalFinal = function(martyrId, event) {
    if (event) event.stopPropagation();
    ensureDashboardActionModal();
    const item = (Array.isArray(dashboardData) ? dashboardData : []).find(row => row.martyr_id === martyrId) || {};
    const idEl = document.getElementById('dashboardActionMartyrId');
    const nameEl = document.getElementById('dashboardActionMartyrName');
    if (idEl) idEl.value = martyrId || '';
    if (nameEl) nameEl.textContent = item.full_name || '';
    const el = document.getElementById('dashboardActionModal');
    if (window.modals && window.modals.dashboardActionModal) window.modals.dashboardActionModal.show();
    else if (window.bootstrap && el) bootstrap.Modal.getOrCreateInstance(el).show();
  };

  window.performDashboardActionFinal = function(action) {
    const martyrId = document.getElementById('dashboardActionMartyrId')?.value || '';
    const modalEl = document.getElementById('dashboardActionModal');
    if (window.modals && window.modals.dashboardActionModal) window.modals.dashboardActionModal.hide();
    else if (window.bootstrap && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();

    if (!martyrId) return showToast('معرّف الشهيد غير موجود.');

    if (action === 'view') return openMartyrDetails(martyrId, 'dashboardPage');
    if (action === 'verify') return quickUpdateStatus(martyrId, 'موثق');
    if (action === 'reject') return quickUpdateStatus(martyrId, 'مرفوض');

    if (action === 'verifyCompletion') {
      apiRequest('verifyMartyrWithCompletion', { martyrId })
        .then(res => {
          showToast(res?.message || 'تم التوثيق مع الاستكمال.');
          refreshDashboardData(false);
          loadInitialData();
        })
        .catch(err => showToast(err.message || 'تعذر تحديث الحالة.'));
    }
  };

  window.renderDashboardTable = function() {
    ensureDashboardActionModal();
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;

    const search = n(document.getElementById('dashboardSearchInput')?.value || '');
    const status = document.getElementById('dashboardStatusFilter')?.value || '';
    const sortBy = document.getElementById('dashboardSortSelect')?.value || 'pending-first';
    let list = Array.isArray(dashboardData) ? dashboardData.slice() : [];

    if (status) list = list.filter(item => statusOf(item) === status);
    if (search) list = list.filter(item => n([item.full_name, item.family_name, item.father_name, item.nickname, item.martyrdom_place, item.extra_info].join(' ')).includes(search));

    if (sortBy === 'name') list.sort((x,y) => String(x.full_name || '').localeCompare(String(y.full_name || ''), 'ar'));
    else if (sortBy === 'newest') list.sort((x,y) => String(y.created_at || '').localeCompare(String(x.created_at || '')));
    else if (sortBy === 'oldest') list.sort((x,y) => String(x.created_at || '').localeCompare(String(y.created_at || '')));
    else list.sort((x,y) => {
      if (statusOf(x) === 'بانتظار التوثيق' && statusOf(y) !== 'بانتظار التوثيق') return -1;
      if (statusOf(x) !== 'بانتظار التوثيق' && statusOf(y) === 'بانتظار التوثيق') return 1;
      return String(x.full_name || '').localeCompare(String(y.full_name || ''), 'ar');
    });

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد نتائج.</td></tr>`;
      return;
    }

    const headerAction = document.querySelector('#dashboardMartyrsTab table thead th:nth-child(6)');
    if (headerAction) headerAction.textContent = 'إجراء';

    tbody.innerHTML = list.map(item => {
      const img = typeof getImageSrc === 'function' ? getImageSrc(item) : '';
      const dotClass = dashboardStatusClass(statusOf(item));
      const needsTriangle = itemNeedsCompletion(item) ? '<span class="dashboard-needs-triangle" title="يحتاج استكمال"></span>' : '';
      return `
        <tr class="dashboard-mobile-row" onclick="openMartyrDetails('${a(item.martyr_id)}', 'dashboardPage')">
          <td style="width:70px;">
            <div class="dashboard-mobile-image-wrap">
              <span class="dashboard-status-dot ${dotClass}"></span>
              ${needsTriangle}
              ${img ? `<img src="${a(img)}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"><div class="dashboard-mobile-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>` : `<div class="dashboard-mobile-placeholder"><i class="fa-solid fa-user"></i></div>`}
            </div>
          </td>
          <td>
            <div class="fw-bold dashboard-mobile-name">${h(item.full_name || '')}</div>
            <div class="small text-muted dashboard-mobile-subtext">${h(item.martyrdom_place || '')}</div>
          </td>
          <td>${h(item.family_name || '')}</td>
          <td>${h(item.father_name || '')}</td>
          <td>${typeof statusBadge === 'function' ? statusBadge(item.verification_status) : h(item.verification_status || '')} ${itemNeedsCompletion(item) ? '<span class="badge text-bg-warning">يحتاج استكمال</span>' : ''}</td>
          <td onclick="event.stopPropagation();">
            <div class="dashboard-desktop-actions d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${a(item.martyr_id)}', 'dashboardPage')">عرض</button>
              <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${a(item.martyr_id)}', 'موثق')">توثيق</button>
              <button class="btn btn-sm btn-warning" onclick="apiRequest('verifyMartyrWithCompletion',{martyrId:'${a(item.martyr_id)}'}).then(()=>{showToast('تم التوثيق مع الاستكمال'); refreshDashboardData(false); loadInitialData();})">توثيق مع الاستكمال</button>
              <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${a(item.martyr_id)}', 'مرفوض')">رفض</button>
            </div>
            <button class="btn btn-sm btn-primary dashboard-mobile-action-btn" onclick="openDashboardActionModalFinal('${a(item.martyr_id)}', event)">إجراء</button>
          </td>
        </tr>`;
    }).join('');
  };

  /* Join requests compact mobile search/filter */
  function ensureJoinCompactModal() {
    if (document.getElementById('joinCompactFilterModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="joinCompactFilterModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header px-4 pt-4">
              <h5 class="modal-title fw-bold"><i class="fa-solid fa-filter text-success ms-2"></i>فلترة طلبات الانضمام</h5>
              <button type="button" class="btn-close ms-0" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body px-4">
              <div class="mb-3">
                <label class="form-label fw-bold">الحالة</label>
                <select class="form-select" id="joinCompactStatusFilter">
                  <option value="بانتظار التوثيق">بانتظار التوثيق</option>
                  <option value="موثق">مقبول / موثق</option>
                  <option value="مرفوض">مرفوض</option>
                  <option value="">الكل</option>
                </select>
              </div>
              <div>
                <label class="form-label fw-bold">فرز</label>
                <select class="form-select" id="joinCompactSortSelect">
                  <option value="newest">الأحدث أولًا</option>
                  <option value="oldest">الأقدم أولًا</option>
                  <option value="name">أبجديًا حسب الاسم</option>
                  <option value="family">أبجديًا حسب العائلة</option>
                </select>
              </div>
            </div>
            <div class="modal-footer px-4 pb-4">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button>
              <button class="btn btn-success" onclick="applyJoinCompactFiltersFinal()">تطبيق</button>
            </div>
          </div>
        </div>
      </div>`);
    if (window.bootstrap && window.modals) window.modals.joinCompactFilterModal = new bootstrap.Modal(document.getElementById('joinCompactFilterModal'));
  }

  function ensureJoinCompactSearch() {
    const tab = document.getElementById('dashboardJoinRequestsTab');
    if (!tab) return;
    if (typeof installJoinRequestControls === 'function') {
      try { installJoinRequestControls(); } catch (e) {}
    }
    if (!document.getElementById('joinCompactSearchBar')) {
      const anchor = document.getElementById('joinRequestsControls') || tab.querySelector('.table-responsive');
      const bar = document.createElement('div');
      bar.id = 'joinCompactSearchBar';
      bar.className = 'join-compact-search-filter';
      bar.innerHTML = `
        <input type="search" id="joinCompactSearchInput" class="form-control" placeholder="ابحث في طلبات الانضمام...">
        <button class="btn btn-success" type="button" onclick="openJoinCompactFilterModalFinal()" aria-label="فلترة طلبات الانضمام"><i class="fa-solid fa-filter"></i></button>`;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor);
      else tab.prepend(bar);
      document.getElementById('joinCompactSearchInput').addEventListener('input', function() {
        const hidden = document.getElementById('joinRequestsSearchInput');
        if (hidden) hidden.value = this.value || '';
        if (typeof resetJoinRequestsPageAndRender === 'function') resetJoinRequestsPageAndRender();
        else if (typeof renderJoinRequestsTable === 'function') renderJoinRequestsTable();
      });
    }
    ensureJoinCompactModal();
  }

  window.openJoinCompactFilterModalFinal = function() {
    ensureJoinCompactSearch();
    const pairs = [['joinRequestsStatusFilter','joinCompactStatusFilter'], ['joinRequestsSortSelect','joinCompactSortSelect']];
    pairs.forEach(([from, to]) => { const f = document.getElementById(from); const t = document.getElementById(to); if (f && t) t.value = f.value || ''; });
    const el = document.getElementById('joinCompactFilterModal');
    if (window.modals && window.modals.joinCompactFilterModal) window.modals.joinCompactFilterModal.show();
    else if (window.bootstrap && el) bootstrap.Modal.getOrCreateInstance(el).show();
  };

  window.applyJoinCompactFiltersFinal = function() {
    const pairs = [['joinCompactStatusFilter','joinRequestsStatusFilter'], ['joinCompactSortSelect','joinRequestsSortSelect']];
    pairs.forEach(([from, to]) => { const f = document.getElementById(from); const t = document.getElementById(to); if (f && t) t.value = f.value || ''; });
    const el = document.getElementById('joinCompactFilterModal');
    if (window.modals && window.modals.joinCompactFilterModal) window.modals.joinCompactFilterModal.hide();
    else if (window.bootstrap && el) bootstrap.Modal.getOrCreateInstance(el).hide();
    if (typeof resetJoinRequestsPageAndRender === 'function') resetJoinRequestsPageAndRender();
    else if (typeof renderJoinRequestsTable === 'function') renderJoinRequestsTable();
  };

  const oldRenderJoinFinal = window.renderJoinRequestsTable || (typeof renderJoinRequestsTable === 'function' ? renderJoinRequestsTable : null);
  if (typeof oldRenderJoinFinal === 'function' && !oldRenderJoinFinal.__joinCompactFinalWrapped) {
    window.renderJoinRequestsTable = function() {
      ensureJoinCompactSearch();
      const compact = document.getElementById('joinCompactSearchInput');
      const hidden = document.getElementById('joinRequestsSearchInput');
      if (compact && hidden && hidden.value !== compact.value) hidden.value = compact.value || '';
      oldRenderJoinFinal();
    };
    window.renderJoinRequestsTable.__joinCompactFinalWrapped = true;
  }

  const oldShowDashboardTabFinal = window.showDashboardTab || (typeof showDashboardTab === 'function' ? showDashboardTab : null);
  if (typeof oldShowDashboardTabFinal === 'function' && !oldShowDashboardTabFinal.__finalFixWrapped) {
    window.showDashboardTab = function(tabName) {
      oldShowDashboardTabFinal(tabName);
      if (tabName === 'joinRequests') {
        ensureJoinCompactSearch();
        if (typeof renderJoinRequestsTable === 'function') renderJoinRequestsTable();
      }
    };
    window.showDashboardTab.__finalFixWrapped = true;
  }

  function refreshStickySearchPositions() {
    document.querySelectorAll('.mobile-search-filter, .houla-compact-search-filter, .family-compact-search-filter, .join-compact-search-filter').forEach(el => {
      el.style.position = 'sticky';
      el.style.top = '0px';
      el.style.zIndex = '1050';
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    ensureDashboardRejectedCard();
    ensureJoinCompactSearch();
    refreshStickySearchPositions();
    if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(function() {
      ensureDashboardRejectedCard();
      ensureJoinCompactSearch();
      refreshStickySearchPositions();
      if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
    }, 100);
  }
})();
