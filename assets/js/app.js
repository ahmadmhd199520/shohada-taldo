
/* Taldo modular runtime helper */
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    setTimeout(fn, 0);
  }
}


  const IS_ADMIN_FROM_URL = false;

  const API_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';
  const SHARE_PREVIEW_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';

  async function apiRequest(action, data = {}) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        data
      })
    });

    const result = await response.json();

    if (!result) {
      throw new Error('لم يرجع الخادم استجابة واضحة.');
    }

    return result;
  }



    let allMartyrs = [];
    let allFamilies = [];
    let statsData = null;
    let dashboardData = [];
    let dataUpdateRequests = [];
    let joinRequests = [];
    let viewMode = 'cards';
    let currentStatusFilter = 'موثق';
    let lastPageBeforeDetails = 'homePage';
    let isAdminLoggedIn = false;
    let currentAdmin = null;
    let currentMartyrsPage = 1;
    const MARTYRS_PAGE_SIZE = 50;

    const modals = {};

    onReady( () => {
      hideGlobalSpinner();
      initModals();
      restoreAdminSession();
      loadInitialData();
    });

    function initModals() {
      [
        'introModal',
        'aboutProjectModal',
        'introSuccessModal',
        'duplicateWarningModal',
        'submitModal',
        'submitSuccessModal',
        'mobileFilterModal',
        'dataUpdateModal',
        'joinTeamModal',
        'approveImageModeModal',
        'loginModal'
      ].forEach(id => {
        const el = document.getElementById(id);
        if (el) modals[id] = new bootstrap.Modal(el);
      });
    }

    function openAboutProjectModal() {
      modals.aboutProjectModal.show();
    }

    function restoreAdminSession() {
      const saved = localStorage.getItem('taldo_martyrs_admin');

      if (saved) {
        try {
          currentAdmin = JSON.parse(saved);
          isAdminLoggedIn = true;
          updateAdminButtons();
        } catch (e) {
          localStorage.removeItem('taldo_martyrs_admin');
        }
      }

      if (IS_ADMIN_FROM_URL && !isAdminLoggedIn) {
        currentAdmin = {
          full_name: 'مدير النظام',
          username: 'admin',
          role: 'owner'
        };
        isAdminLoggedIn = true;
        localStorage.setItem('taldo_martyrs_admin', JSON.stringify(currentAdmin));
        updateAdminButtons();
      }
    }

    function updateAdminButtons() {
      document.getElementById('loginBtn').classList.toggle('d-none', isAdminLoggedIn);
      document.getElementById('dashboardBtn').classList.toggle('d-none', !isAdminLoggedIn);
      document.getElementById('logoutBtn').classList.toggle('d-none', !isAdminLoggedIn);

      if (currentAdmin) {
        document.getElementById('adminWelcomeText').textContent =
          `مرحبًا ${currentAdmin.full_name || currentAdmin.username || ''}`;
      }
    }

    function openLoginModal() {
      document.getElementById('adminUsername').value = '';
      document.getElementById('adminPassword').value = '';
      modals.loginModal.show();

      setTimeout(() => {
        document.getElementById('adminUsername').focus();
      }, 300);
    }

    function submitAdminLogin() {
      const username = document.getElementById('adminUsername').value.trim();
      const password = document.getElementById('adminPassword').value.trim();

      if (!username || !password) {
        showToast('يرجى إدخال اسم المستخدم وكلمة المرور.');
        return;
      }

      const btn = document.getElementById('adminLoginSubmitBtn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري التحقق...`;

      apiRequest('adminLogin', { username, password })
        .then(res => {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-right-to-bracket ms-1"></i> دخول`;

          if (!res || !res.success) {
            showToast(res?.message || 'تعذر تسجيل الدخول.');
            return;
          }

          currentAdmin = res.admin;
          isAdminLoggedIn = true;
          localStorage.setItem('taldo_martyrs_admin', JSON.stringify(currentAdmin));

          updateAdminButtons();
          modals.loginModal.hide();
          showToast('تم تسجيل الدخول بنجاح.');
          openDashboardPage();
        })
        .catch(err => {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-right-to-bracket ms-1"></i> دخول`;
          showToast(err.message || 'حدث خطأ أثناء تسجيل الدخول.');
        });
    }

    function logoutAdmin() {
      localStorage.removeItem('taldo_martyrs_admin');
      isAdminLoggedIn = false;
      currentAdmin = null;
      dashboardData = [];
      updateAdminButtons();
      showPage('homePage');
      showToast('تم تسجيل الخروج.');
    }

    function maybeShowIntroModal() {
      const hidden = localStorage.getItem('taldo_martyrs_intro_hidden') === '1';

      if (!hidden) {
        setTimeout(() => {
          modals.introModal.show();
        }, 500);
      }
    }

    function acceptIntroModal() {
      const dontShow = document.getElementById('dontShowIntroAgain').checked;

      if (dontShow) {
        localStorage.setItem('taldo_martyrs_intro_hidden', '1');
      }

      modals.introModal.hide();
      modals.introSuccessModal.show();

      setTimeout(() => {
        modals.introSuccessModal.hide();
      }, 1200);
    }

    function loadInitialData() {
      document.getElementById('loadingBox').style.display = 'block';

      apiRequest('getInitialData')
        .then(res => {
          if (!res || !res.success) {
            showToast('تعذر تحميل البيانات.');
            return;
          }

          allFamilies = res.families || [];
          statsData = res.stats || {};
          allMartyrs = res.martyrs || [];

          fillFamiliesSelects();
          updateStatsCards();
          renderMartyrs();

          const martyrFromUrl = getMartyrIdFromUrl();
          if (martyrFromUrl) {
            setTimeout(() => openMartyrDetails(martyrFromUrl, 'homePage'), 250);
          }

          // لا نحمل لوحة التحكم تلقائيًا عند فتح الصفحة العامة.

          document.getElementById('loadingBox').style.display = 'none';
        })
        .catch(err => {
          document.getElementById('loadingBox').style.display = 'none';
          showToast(err.message || 'حدث خطأ أثناء تحميل البيانات.');
        });
    }

    function refreshDashboardData(showMsg = true) {
      if (!isAdminLoggedIn) {
        showToast('يرجى تسجيل الدخول أولًا.');
        return;
      }

      const body = document.getElementById('dashboardTableBody');
      if (body) {
        body.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted py-4">
              <span class="spinner-border spinner-border-sm ms-1"></span>
              جاري تحميل بيانات لوحة التحكم...
            </td>
          </tr>
        `;
      }

      apiRequest('getAdminDashboardData')
        .then(res => {
          if (!res || !res.success) {
            showToast('تعذر تحميل بيانات لوحة التحكم.');
            return;
          }

          statsData = res.stats || statsData;
          dashboardData = res.all || [];
          dataUpdateRequests = res.dataUpdates || [];
          joinRequests = res.joinRequests || [];
          // لا نعيد كتابة بيانات الصفحة الرئيسية عند تحميل لوحة التحكم.
          // allMartyrs = dashboardData.filter(x => x.verification_status === 'موثق');

          updateStatsCards();
          updateDashboardStats();
          renderDashboardTable();
          renderDataUpdateRequestsTable();
          renderJoinRequestsTable();

          if (showMsg) showToast('تم تحديث لوحة التحكم.');
        })
        .catch(err => {
          showToast(err.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
        });
    }

    function openDashboardPage() {
      if (!isAdminLoggedIn) {
        openLoginModal();
        return;
      }

      updateAdminButtons();
      showPage('dashboardPage');
      showDashboardTab('martyrs');
      refreshDashboardData(false);
    }

    function updateDashboardStats() {
      document.getElementById('dashVerifiedCount').textContent = statsData?.verified || 0;
      document.getElementById('dashPendingCount').textContent = statsData?.pending || 0;
      document.getElementById('dashTotalCount').textContent = statsData?.total || 0;
    }


    function showDashboardTab(tabName) {
      const tabs = {
        martyrs: ['dashboardMartyrsTab', 'dashMartyrsTabBtn'],
        dataUpdates: ['dashboardDataUpdatesTab', 'dashDataUpdatesTabBtn'],
        joinRequests: ['dashboardJoinRequestsTab', 'dashJoinTabBtn']
      };

      Object.values(tabs).forEach(([paneId, btnId]) => {
        document.getElementById(paneId)?.classList.add('d-none');
        document.getElementById(btnId)?.classList.remove('active');
      });

      const selected = tabs[tabName] || tabs.martyrs;
      document.getElementById(selected[0])?.classList.remove('d-none');
      document.getElementById(selected[1])?.classList.add('active');
    }

    function renderDashboardTable() {
      const tbody = document.getElementById('dashboardTableBody');
      if (!tbody) return;

      const search = normalizeText(document.getElementById('dashboardSearchInput').value || '');
      const status = document.getElementById('dashboardStatusFilter').value || '';

      let list = dashboardData.slice();

      if (status) {
        list = list.filter(item => item.verification_status === status);
      }

      if (search) {
        list = list.filter(item => {
          const content = normalizeText([
            item.full_name,
            item.family_name,
            item.father_name,
            item.nickname,
            item.martyrdom_place,
            item.extra_info
          ].join(' '));

          return content.includes(search);
        });
      }

      list.sort((a, b) => {
        if (a.verification_status === 'بانتظار التوثيق' && b.verification_status !== 'بانتظار التوثيق') return -1;
        if (a.verification_status !== 'بانتظار التوثيق' && b.verification_status === 'بانتظار التوثيق') return 1;
        return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
      });

      if (!list.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted py-4">
              لا توجد نتائج.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(item => {
        const img = getImageSrc(item);

        return `
          <tr>
            <td style="width:70px;">
              ${img ? `
                <img src="${escapeAttr(img)}" style="width:52px;height:52px;border-radius:14px;object-fit:cover;background:#f1f3f5;" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
                <div style="display:none;width:52px;height:52px;border-radius:14px;background:#f1f3f5;place-items:center;color:#adb5bd;">
                  <i class="fa-solid fa-user"></i>
                </div>
              ` : `
                <div style="width:52px;height:52px;border-radius:14px;background:#f1f3f5;display:grid;place-items:center;color:#adb5bd;">
                  <i class="fa-solid fa-user"></i>
                </div>
              `}
            </td>
            <td>
              <div class="fw-bold">${escapeHtml(item.full_name || '')}</div>
              <div class="small text-muted">${escapeHtml(item.martyrdom_place || '')}</div>
            </td>
            <td>${escapeHtml(item.family_name || '')}</td>
            <td>${escapeHtml(item.father_name || '')}</td>
            <td>${statusBadge(item.verification_status)}</td>
            <td>
              <div class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardPage')">
                  عرض
                </button>
                <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'موثق')">
                  توثيق
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'مرفوض')">
                  رفض
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function quickUpdateStatus(martyrId, status) {
      if (!isAdminLoggedIn) {
        showToast('يرجى تسجيل الدخول أولًا.');
        return;
      }

      apiRequest('updateVerificationStatus', {
        martyrId,
        newStatus: status,
        reviewerNotes: ''
      })
        .then(res => {
          showToast(res.message || 'تم تحديث الحالة.');
          refreshDashboardData(false);
          loadInitialData();
        })
        .catch(err => {
          showToast(err.message || 'تعذر تحديث الحالة.');
        });
    }

    function statusBadge(status) {
      if (status === 'موثق') {
        return `<span class="badge badge-soft-blue">موثق</span>`;
      }

      if (status === 'مرفوض') {
        return `<span class="badge text-bg-danger">مرفوض</span>`;
      }

      return `<span class="badge text-bg-warning">بانتظار التوثق</span>`;
    }

    function fillFamiliesSelects() {
      const familyFilter = document.getElementById('familyFilter');
      const mobileFamilyFilter = document.getElementById('mobileFamilyFilter');

      const optionsHtml = ['<option value="">كل العوائل</option>']
        .concat(allFamilies.map(family => `<option value="${escapeAttr(family)}">${escapeHtml(family)}</option>`))
        .join('');

      if (familyFilter) familyFilter.innerHTML = optionsHtml;
      if (mobileFamilyFilter) mobileFamilyFilter.innerHTML = optionsHtml;
    }


    function getCurrentSearchValue() {
      const desktop = document.getElementById('searchInput')?.value || '';
      const mobile = document.getElementById('mobileSearchInput')?.value || '';
      return mobile || desktop;
    }

    function resetMartyrsPageAndRender() {
      currentMartyrsPage = 1;
      renderMartyrs();
    }

    function syncMobileSearch() {
      const mobileValue = document.getElementById('mobileSearchInput')?.value || '';
      const desktopInput = document.getElementById('searchInput');
      if (desktopInput) desktopInput.value = mobileValue;
      resetMartyrsPageAndRender();
    }

    function openMobileFilterModal() {
      const family = document.getElementById('familyFilter')?.value || '';
      const status = document.getElementById('statusFilter')?.value || '';
      const sort = document.getElementById('sortSelect')?.value || 'name';

      const mobileFamily = document.getElementById('mobileFamilyFilter');
      const mobileStatus = document.getElementById('mobileStatusFilter');
      const mobileSort = document.getElementById('mobileSortSelect');

      if (mobileFamily) mobileFamily.value = family;
      if (mobileStatus) mobileStatus.value = status;
      if (mobileSort) mobileSort.value = sort;

      modals.mobileFilterModal.show();
    }

    function applyMobileFilters() {
      const family = document.getElementById('mobileFamilyFilter')?.value || '';
      const status = document.getElementById('mobileStatusFilter')?.value || '';
      const sort = document.getElementById('mobileSortSelect')?.value || 'name';

      const familyFilter = document.getElementById('familyFilter');
      const statusFilter = document.getElementById('statusFilter');
      const sortSelect = document.getElementById('sortSelect');

      if (familyFilter) familyFilter.value = family;
      if (statusFilter) statusFilter.value = status;
      if (sortSelect) sortSelect.value = sort;

      modals.mobileFilterModal.hide();
      changeStatusFilter();
    }

    function updateStatsCards() {
      document.getElementById('verifiedCount').textContent = statsData?.verified || 0;
      document.getElementById('pendingCount').textContent = statsData?.pending || 0;
    }

    function changeStatusFilter() {
      currentStatusFilter = document.getElementById('statusFilter').value;
      currentMartyrsPage = 1;

      if (currentStatusFilter === 'بانتظار التوثيق' && !isAdminLoggedIn) {
        apiRequest('getMartyrsPublicData', { statusFilter: 'بانتظار التوثيق' })
          .then(rows => {
            const pending = Array.isArray(rows) ? rows : [];
            const verified = allMartyrs.filter(x => x.verification_status === 'موثق');
            allMartyrs = [...verified, ...pending];
            renderMartyrs();
          })
          .catch(err => {
            showToast(err.message || 'تعذر تحميل الأسماء المنتظرة.');
          });
      } else if (!currentStatusFilter && isAdminLoggedIn && dashboardData.length) {
        allMartyrs = dashboardData.slice();
        renderMartyrs();
      } else {
        renderMartyrs();
      }
    }

    function renderMartyrs(customList) {
      const container = document.getElementById('martyrsContainer');
      const search = normalizeText(document.getElementById('searchInput')?.value || '');
      const family = document.getElementById('familyFilter')?.value || '';
      const sortBy = document.getElementById('sortSelect')?.value || 'name';

      let list = customList || allMartyrs.slice();

      if (currentStatusFilter) {
        list = list.filter(item => item.verification_status === currentStatusFilter);
      }

      if (family) {
        list = list.filter(item => item.family_name === family);
      }

      if (search) {
        list = list.filter(item => {
          const content = normalizeText([
            item.full_name,
            item.family_name,
            item.father_name,
            item.nickname,
            item.martyrdom_place,
            item.extra_info
          ].join(' '));

          return content.includes(search);
        });
      }

      list.sort((a, b) => {
        if (sortBy === 'family') {
          return String(a.family_name || '').localeCompare(String(b.family_name || ''), 'ar');
        }

        return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
      });

      if (!list.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fa-regular fa-folder-open fa-2x mb-3 text-primary"></i>
            <h5 class="fw-bold">لا توجد نتائج</h5>
            <p class="mb-0">جرّب تغيير البحث أو الفلاتر.</p>
          </div>
        `;
        return;
      }

      const totalPages = Math.max(1, Math.ceil(list.length / MARTYRS_PAGE_SIZE));
      if (currentMartyrsPage > totalPages) currentMartyrsPage = totalPages;
      if (currentMartyrsPage < 1) currentMartyrsPage = 1;

      const start = (currentMartyrsPage - 1) * MARTYRS_PAGE_SIZE;
      const pageList = list.slice(start, start + MARTYRS_PAGE_SIZE);

      const contentHtml = viewMode === 'cards'
        ? `<div class="martyrs-grid">${pageList.map(renderMartyrCard).join('')}</div>`
        : `<div>${pageList.map(renderMartyrListItem).join('')}</div>`;

      container.innerHTML = contentHtml + renderMartyrsPaginationPerf(totalPages, list.length, pageSize);
    }

    function renderMartyrsPagination(totalPages, totalItems) {
      if (totalPages <= 1) return '';

      const pages = [];
      const start = Math.max(1, currentMartyrsPage - 2);
      const end = Math.min(totalPages, currentMartyrsPage + 2);

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
        if (page === '...') {
          return `<span class="px-2 text-muted">...</span>`;
        }

        const active = page === currentMartyrsPage ? 'btn-primary' : 'btn-outline-primary';
        return `<button class="btn ${active} page-btn" onclick="goToMartyrsPage(${page})">${page}</button>`;
      }).join('');

      return `
        <div class="martyrs-pagination">
          <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage - 1})" ${currentMartyrsPage === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i>
          </button>
          ${buttons}
          <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage + 1})" ${currentMartyrsPage === totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <div class="w-100 text-center text-muted small mt-1">
            عرض ${Math.min(totalItems, (currentMartyrsPage - 1) * MARTYRS_PAGE_SIZE + 1)} - ${Math.min(totalItems, currentMartyrsPage * MARTYRS_PAGE_SIZE)} من ${totalItems}
          </div>
        </div>
      `;
    }

    function goToMartyrsPage(page) {
      currentMartyrsPage = page;
      renderMartyrs();
      document.getElementById('martyrsContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderMartyrCard(item) {
      const verified = item.verification_status === 'موثق';
      const needsCompletion = isNeedsCompletion(item);
      const img = getImageSrc(item);

      return `
        <div class="martyr-card" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')">
          ${needsCompletion ? `
            <div class="needs-completion-corner">يحتاج استكمال</div>
          ` : verified ? `
            <div class="verified-corner">
              <i class="fa-solid fa-check"></i>
            </div>
          ` : ''}

          <div class="martyr-image-wrap">
            ${img ? `
              <img src="${escapeAttr(img)}" class="martyr-image" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div class="martyr-placeholder" style="display:none;">
                <i class="fa-solid fa-user"></i>
              </div>
            ` : `
              <div class="martyr-placeholder">
                <i class="fa-solid fa-user"></i>
              </div>
            `}
          </div>

          <div class="martyr-body">
            <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
            <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>

            ${needsCompletion ? `
              <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
            ` : !verified ? `
              <span class="badge text-bg-warning mt-2">بانتظار التوثق</span>
            ` : `
              <span class="badge badge-soft-blue mt-2">موثق</span>
            `}
          </div>
        </div>
      `;
    }

    function renderMartyrListItem(item) {
      const verified = item.verification_status === 'موثق';

      return `
        <div class="list-item" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')">
          <div class="d-flex justify-content-between align-items-center gap-2">
            <div>
              <h6 class="fw-bold mb-1">${escapeHtml(item.full_name || '')}</h6>
              <div class="text-muted small">
                عائلة ${escapeHtml(item.family_name || '')}
                ${item.father_name ? ` - ابن ${escapeHtml(item.father_name)}` : ''}
              </div>
            </div>

            <div class="d-flex align-items-center gap-2">
              ${verified ? `
                <span class="badge badge-soft-blue">موثق</span>
              ` : `
                <span class="badge text-bg-warning">بانتظار</span>
              `}
              <i class="fa-solid fa-chevron-left text-muted"></i>
            </div>
          </div>
        </div>
      `;
    }

    function setViewMode(mode) {
      viewMode = mode;

      document.getElementById('cardsViewBtn').className =
        mode === 'cards' ? 'btn btn-primary' : 'btn btn-outline-primary';

      document.getElementById('listViewBtn').className =
        mode === 'list' ? 'btn btn-primary' : 'btn btn-outline-primary';

      renderMartyrs();
    }

function openFamiliesStatsPage() {
  const container = document.getElementById('familiesStatsContainer');
  const byFamily = statsData?.byFamily || [];

  container.innerHTML = '';

  if (!byFamily.length) {
    container.innerHTML = `<div class="empty-state">لا توجد إحصائيات بعد.</div>`;
    showPage('familiesPage');
    return;
  }

  byFamily.forEach(item => {
    const verifiedCount = Number(item.verified || 0);
    const pendingCount = Number(item.pending || 0);

    // الإجمالي الظاهر للعامة يجب أن يستبعد المرفوضين
    const visibleTotal = verifiedCount + pendingCount;

    const row = document.createElement('div');
    row.className = 'family-row';

    row.onclick = function() {
      openFamilyMartyrs(item.family_name);
    };

    row.innerHTML = `
      <div class="d-flex justify-content-between align-items-center gap-3">
        <div>
          <h5 class="fw-bold mb-1">عائلة ${escapeHtml(item.family_name)}</h5>
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

  showPage('familiesPage');
}
    function openFamilyMartyrs(familyName) {
      const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
      const list = source.filter(item => item.family_name === familyName);

      document.getElementById('familyPageTitle').textContent = `شهداء عائلة ${familyName}`;

      const container = document.getElementById('familyMartyrsContainer');

      if (!list.length) {
        container.innerHTML = `<div class="empty-state">لا توجد أسماء لهذه العائلة.</div>`;
      } else {
        container.innerHTML = `
          <div class="martyrs-grid">
            ${list.map(renderMartyrCardForFamily).join('')}
          </div>
        `;
      }

      showPage('familyMartyrsPage');
    }

    function renderMartyrCardForFamily(item) {
      const verified = item.verification_status === 'موثق';
      const needsCompletion = isNeedsCompletion(item);
      const img = getImageSrc(item);

      return `
        <div class="martyr-card" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')">
          ${needsCompletion ? `
            <div class="needs-completion-corner">يحتاج استكمال</div>
          ` : verified ? `
            <div class="verified-corner">
              <i class="fa-solid fa-check"></i>
            </div>
          ` : ''}

          <div class="martyr-image-wrap">
            ${img ? `
              <img src="${escapeAttr(img)}" class="martyr-image" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div class="martyr-placeholder" style="display:none;">
                <i class="fa-solid fa-user"></i>
              </div>
            ` : `
              <div class="martyr-placeholder">
                <i class="fa-solid fa-user"></i>
              </div>
            `}
          </div>

          <div class="martyr-body">
            <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
            <div class="martyr-family">${escapeHtml(item.father_name || '')}</div>
          </div>
        </div>
      `;
    }

    function isAllowUpdatesEnabled(value) {
      const text = String(value || '').trim().toLowerCase();
      if (!text) return true;
      const normalized = text
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/\s+/g, ' ');
      return !['لا', 'كلا', 'no', 'false', '0', 'غير مفعل', 'مغلق', 'لا يسمح', 'لايسمح'].includes(normalized);
    }


    function isNeedsCompletion(item) {
      const value = String(item?.needs_completion || '').trim().toLowerCase();
      const normalized = value
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/\s+/g, ' ');
      return ['نعم', 'yes', 'true', '1', 'يحتاج', 'needs', 'بحاجة لاستكمال'].includes(normalized);
    }

    function openMartyrDetails(martyrId, fromPage) {
      const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
      const item = source.find(x => x.martyr_id === martyrId);

      if (!item) return;

      lastPageBeforeDetails = fromPage || 'homePage';

      if (fromPage !== 'dashboardPage' && window.history && window.location) {
        const newUrl = `${window.location.origin}${window.location.pathname}?m=${encodeURIComponent(martyrId)}`;
        window.history.replaceState({}, '', newUrl);
      }

      const img = getImageSrc(item);
      const canUpdate = isAllowUpdatesEnabled(item.allow_updates);

      document.getElementById('detailsContainer').innerHTML = `
        <div class="row g-4">
          <div class="col-lg-5">
            ${img ? `
              <img src="${escapeAttr(img)}" class="detail-image" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div class="detail-image-placeholder" style="display:none;">
                <div>
                  <i class="fa-solid fa-user fa-4x text-secondary mb-3"></i>
                  <div>تعذر عرض الصورة</div>
                </div>
              </div>
            ` : `
              <div class="detail-image-placeholder">
                <div>
                  <i class="fa-solid fa-user fa-4x text-secondary mb-3"></i>
                  <div>لا توجد صورة مرفقة</div>
                </div>
              </div>
            `}
          </div>

          <div class="col-lg-7">
            <div class="detail-box">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 class="fw-bold mb-1">${escapeHtml(item.full_name || '')}</h2>
                  <div class="text-muted">عائلة ${escapeHtml(item.family_name || '')}</div>
                </div>

                ${statusBadge(item.verification_status)}
              </div>

              <div class="row g-3">
                ${detailItem('اسم الأب', item.father_name)}
                ${detailItem('المواليد', item.birth_year)}
                ${detailItem('اللقب', item.nickname)}
                ${detailItem('استشهد بـ', item.martyrdom_type)}
                ${item.martyrdom_type === 'المعارك' ? detailItem('اسم المعركة', item.battle_name) : ''}
                ${item.martyrdom_type === 'آخر' ? detailItem('السبب', item.other_cause) : ''}
                ${detailItem('تاريخ الاستشهاد', item.martyrdom_date)}
                ${detailItem('مكان الاستشهاد', item.martyrdom_place)}
              </div>

              ${item.extra_info ? `
                <hr>
                <h6 class="fw-bold">معلومات إضافية</h6>
                <p class="lh-lg mb-0">${escapeHtml(item.extra_info)}</p>
              ` : ''}

              ${item.completed_info ? `
                <div class="completed-info-box">
                  <h6 class="fw-bold text-warning-emphasis mb-2">
                    <i class="fa-solid fa-circle-info ms-1"></i>
                    بيانات مستكملة
                  </h6>
                  <p class="lh-lg mb-0">${escapeHtml(item.completed_info)}</p>
                </div>
              ` : ''}

              <div class="details-action-bar">
                <button class="btn btn-primary" onclick="shareMartyr('${escapeAttr(item.martyr_id)}')">
                  <i class="fa-solid fa-share-nodes ms-1"></i>
                  مشاركة
                </button>

                ${canUpdate ? `
                  <button class="btn btn-outline-primary" onclick="openDataUpdateModal('${escapeAttr(item.martyr_id)}')">
                    <i class="fa-solid fa-pen-to-square ms-1"></i>
                    استكمال بيانات
                  </button>
                ` : ''}
              </div>

              ${isAdminLoggedIn && item.verification_status !== 'موثق' ? renderAdminActions(item) : ''}
            </div>
          </div>
        </div>
      `;

      showPage('detailsPage');
    }

    function goBackFromDetails() {
  if (lastPageBeforeDetails === 'dashboardDataUpdatesTab') {
    showPage('dashboardPage');
    showDashboardTab('dataUpdates');
    renderDataUpdateRequestsTable();

    if (window.history && window.location) {
      updateRoute('?page=dashboard&tab=dataUpdates', {
        page: 'dashboard',
        tab: 'dataUpdates'
      });
    }

    return;
  }

  if (lastPageBeforeDetails === 'dashboardJoinRequestsTab') {
    showPage('dashboardPage');
    showDashboardTab('joinRequests');
    renderJoinRequestsTable();

    if (window.history && window.location) {
      updateRoute('?page=dashboard&tab=joinRequests', {
        page: 'dashboard',
        tab: 'joinRequests'
      });
    }

    return;
  }

  if (lastPageBeforeDetails === 'dashboardPage') {
    showPage('dashboardPage');
    showDashboardTab('martyrs');

    if (window.history && window.location) {
      updateRoute('?page=dashboard&tab=martyrs', {
        page: 'dashboard',
        tab: 'martyrs'
      });
    }

    return;
  }

  if (lastPageBeforeDetails === 'familyMartyrsPage') {
    showPage('familyMartyrsPage');
    return;
  }

  showPage('homePage');
}

    function detailItem(label, value) {
      if (!value) return '';

      return `
        <div class="col-md-6">
          <div class="p-3 rounded-4 bg-light h-100">
            <div class="text-muted small mb-1">${escapeHtml(label)}</div>
            <div class="fw-bold">${escapeHtml(value)}</div>
          </div>
        </div>
      `;
    }

    function renderAdminActions(item) {
      return `
        <div class="admin-box mt-4">
          <h6 class="fw-bold mb-3">
            <i class="fa-solid fa-user-shield ms-1"></i>
            أدوات المراجعة
          </h6>

          <div class="row g-2">
            <div class="col-md-8">
              <textarea id="reviewerNotes" class="form-control" rows="2" placeholder="ملاحظات المراجع"></textarea>
            </div>

            <div class="col-md-4 d-grid gap-2">
              <button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')">
                <i class="fa-solid fa-check ms-1"></i>
                توثيق
              </button>

              <button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')">
                <i class="fa-solid fa-xmark ms-1"></i>
                رفض
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function updateStatusFromDetails(martyrId, status) {
      const notes = document.getElementById('reviewerNotes')?.value || '';

      apiRequest('updateVerificationStatus', {
        martyrId,
        newStatus: status,
        reviewerNotes: notes
      })
        .then(res => {
          showToast(res.message || 'تم تحديث الحالة.');
          refreshDashboardData(false);
          loadInitialData();
          showPage('dashboardPage');
        })
        .catch(err => {
          showToast(err.message || 'تعذر تحديث الحالة.');
        });
    }


    function getMartyrIdFromUrl() {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('m') || '';
      } catch (e) {
        return '';
      }
    }

    function buildMartyrShareUrl(martyrId) {
      const targetUrl = `${window.location.origin}${window.location.pathname}?m=${encodeURIComponent(martyrId)}`;
      return `${SHARE_PREVIEW_URL}?share=${encodeURIComponent(martyrId)}&target=${encodeURIComponent(targetUrl)}`;
    }

    async function shareMartyr(martyrId) {
      const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
      const item = source.find(x => x.martyr_id === martyrId);
      const url = buildMartyrShareUrl(martyrId);
      const title = item ? `صفحة الشهيد ${item.full_name}` : 'صفحة شهيد';

      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text: title,
            url
          });
          return;
        } catch (e) {
          // إذا ألغى المستخدم المشاركة لا نعرض خطأ
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        showToast('تم نسخ رابط صفحة الشهيد.');
      } catch (e) {
        window.prompt('انسخ الرابط التالي:', url);
      }
    }

    function openDataUpdateModal(martyrId) {
      const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
      const item = source.find(x => x.martyr_id === martyrId);

      document.getElementById('dataUpdateMartyrId').value = martyrId;
      document.getElementById('dataUpdateMartyrName').value = item ? item.full_name || '' : '';
      document.getElementById('dataUpdateText').value = '';

      const imageInput = document.getElementById('dataUpdateImageInput');
      if (imageInput) imageInput.value = '';

      modals.dataUpdateModal.show();
    }

    async function submitDataUpdateForm() {
      const martyrId = document.getElementById('dataUpdateMartyrId').value;
      const martyrName = document.getElementById('dataUpdateMartyrName').value;
      const requestText = document.getElementById('dataUpdateText').value.trim();
      const imageInput = document.getElementById('dataUpdateImageInput');
      const file = imageInput && imageInput.files ? imageInput.files[0] : null;

      if (!requestText && !file) {
        showToast('يرجى كتابة البيانات أو رفع صورة.');
        return;
      }

      const btn = document.getElementById('dataUpdateSubmitBtn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;

      const payload = {
        martyr_id: martyrId,
        martyr_name: martyrName,
        request_text: requestText,
        submitted_text: requestText
      };

      try {
        if (file) {
          payload.imageBase64 = await fileToBase64(file);
          payload.imageName = file.name;
        }

        apiRequest('submitDataUpdate', payload)
          .then(res => {
            btn.disabled = false;
            btn.innerHTML = 'إرسال للمراجعة';

            if (!res || !res.success) {
              showToast(res?.message || 'تعذر إرسال الطلب.');
              return;
            }

            modals.dataUpdateModal.hide();
            showToast(res.message || 'تم إرسال الطلب.');
          })
          .catch(err => {
            btn.disabled = false;
            btn.innerHTML = 'إرسال للمراجعة';
            showToast(err.message || 'تعذر إرسال الطلب.');
          });
      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = 'إرسال للمراجعة';
        showToast(error.message || 'تعذر قراءة الصورة.');
      }
    }

    function openJoinTeamModal() {
      const form = document.getElementById('joinTeamForm');
      if (form) form.reset();
      modals.joinTeamModal.show();
    }

    function submitJoinTeamForm() {
      const form = document.getElementById('joinTeamForm');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const btn = document.getElementById('joinTeamSubmitBtn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;

      const data = Object.fromEntries(new FormData(form).entries());

      apiRequest('submitJoinRequest', data)
        .then(res => {
          btn.disabled = false;
          btn.innerHTML = 'إرسال الطلب';

          if (!res || !res.success) {
            showToast(res?.message || 'تعذر إرسال الطلب.');
            return;
          }

          modals.joinTeamModal.hide();
          showToast(res.message || 'تم إرسال الطلب.');
          loadInitialData();
        })
        .catch(err => {
          btn.disabled = false;
          btn.innerHTML = 'إرسال الطلب';
          showToast(err.message || 'تعذر إرسال الطلب.');
        });
    }

    function showDuplicateWarning() {
      modals.duplicateWarningModal.show();
    }

    function continueToSubmitModal() {
      modals.duplicateWarningModal.hide();

      setTimeout(() => {
        document.getElementById('martyrForm').reset();

        const familyInput = document.getElementById('familySearchInput');
        const familyDropdown = document.getElementById('familyDropdown');

        if (familyInput) familyInput.value = '';
        if (familyDropdown) familyDropdown.classList.add('d-none');

        toggleCauseFields();
        modals.submitModal.show();
      }, 300);
    }

    function toggleCauseFields() {
      const type = document.querySelector('input[name="martyrdom_type"]:checked')?.value || '';

      const battleBox = document.getElementById('battleNameBox');
      const otherBox = document.getElementById('otherCauseBox');

      const battleInput = document.querySelector('[name="battle_name"]');
      const otherInput = document.querySelector('[name="other_cause"]');

      battleBox.classList.toggle('d-none', type !== 'المعارك');
      otherBox.classList.toggle('d-none', type !== 'آخر');

      battleInput.required = type === 'المعارك';
      otherInput.required = type === 'آخر';

      if (type !== 'المعارك') battleInput.value = '';
      if (type !== 'آخر') otherInput.value = '';
    }

    async function submitMartyrForm() {
      const form = document.getElementById('martyrForm');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;

      try {
        const formData = Object.fromEntries(new FormData(form).entries());

        const imageInput = document.getElementById('imageInput');
        const file = imageInput.files && imageInput.files[0];

        if (file) {
          const imageBase64 = await fileToBase64(file);
          formData.imageBase64 = imageBase64;
          formData.imageName = file.name;
        }

        apiRequest('submitMartyr', formData)
          .then(res => {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;

            if (!res || !res.success) {
              showToast(res?.message || 'حدث خطأ أثناء إرسال البيانات.');
              return;
            }

            modals.submitModal.hide();
            modals.submitSuccessModal.show();

            setTimeout(() => {
              modals.submitSuccessModal.hide();
            }, 1800);

            loadInitialData();
          })
          .catch(err => {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;
            showToast(err.message || 'حدث خطأ أثناء إرسال البيانات.');
          });

      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;
        showToast(error.message || 'تعذر قراءة الصورة.');
      }
    }

    function normalizeFamilyForSearch(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/^ال/, '')
        .replace(/\s+/g, ' ');
    }

    function getFamilyMatches(query) {
      const normalizedQuery = normalizeFamilyForSearch(query);

      if (!normalizedQuery) {
        return allFamilies.slice().sort((a, b) => a.localeCompare(b, 'ar'));
      }

      return allFamilies
        .filter(family => {
          const normalizedFamily = normalizeFamilyForSearch(family);

          return (
            normalizedFamily.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedFamily)
          );
        })
        .sort((a, b) => {
          const aNorm = normalizeFamilyForSearch(a);
          const bNorm = normalizeFamilyForSearch(b);

          if (aNorm === normalizedQuery) return -1;
          if (bNorm === normalizedQuery) return 1;

          if (aNorm.startsWith(normalizedQuery) && !bNorm.startsWith(normalizedQuery)) return -1;
          if (!aNorm.startsWith(normalizedQuery) && bNorm.startsWith(normalizedQuery)) return 1;

          return a.localeCompare(b, 'ar');
        });
    }

    function handleFamilySearchInput() {
      const input = document.getElementById('familySearchInput');
      renderFamilyDropdown(input.value);
    }

    function showFamilyDropdown() {
      const input = document.getElementById('familySearchInput');
      renderFamilyDropdown(input.value);
    }

function renderFamilyDropdown(query) {
  const dropdown = document.getElementById('familyDropdown');
  const typedValue = String(query || '').trim();
  const matches = getFamilyMatches(typedValue);

  dropdown.classList.remove('d-none');

  if (!typedValue && !matches.length) {
    dropdown.classList.add('d-none');
    return;
  }

  dropdown.innerHTML = '';

  if (matches.length) {
    const title = document.createElement('div');
    title.className = 'family-suggestion-title';
    title.textContent = 'عوائل مشابهة أو مسجلة سابقًا';
    dropdown.appendChild(title);

    matches.forEach(family => {
      const option = document.createElement('div');
      option.className = 'family-option';
      option.textContent = family;
      option.onclick = function() {
        selectFamily(family);
      };
      dropdown.appendChild(option);
    });
  }

  if (typedValue) {
    const exactExists = allFamilies.some(family => {
      return normalizeFamilyForSearch(family) === normalizeFamilyForSearch(typedValue);
    });

    if (!exactExists) {
      const hint = document.createElement('div');
      hint.className = 'family-new-hint';
      hint.innerHTML = `
        إن لم تكن العائلة موجودة أعلاه، سيتم حفظها كعائلة جديدة باسم:
        <strong>${escapeHtml(typedValue)}</strong>
      `;
      dropdown.appendChild(hint);
    }
  }
}


function selectFamily(family) {
  const input = document.getElementById('familySearchInput');
  const dropdown = document.getElementById('familyDropdown');

  if (input) input.value = family;
  if (dropdown) dropdown.classList.add('d-none');
}
    document.addEventListener('click', function(e) {
      const input = document.getElementById('familySearchInput');
      const dropdown = document.getElementById('familyDropdown');

      if (!input || !dropdown) return;

      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('d-none');
      }
    });


    function renderDataUpdateRequestsTable() {
  const tbody = document.getElementById('dataUpdatesTableBody');
  const countBadge = document.getElementById('dataUpdatesCount');

  if (!tbody) return;

  const list = (dataUpdateRequests || []).filter(item => {
    const status = String(item.status || '').trim();
    return status === 'بانتظار المراجعة' || status === 'بانتظار التوثيق' || status === '';
  });

  if (countBadge) {
    countBadge.textContent = list.length;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          لا توجد طلبات استكمال بانتظار المراجعة.
        </td>
      </tr>
    `;
    return;
  }


      tbody.innerHTML = list.map(item => {
        const requestId = item.update_id || item.request_id || '';
        const requestText = item.submitted_text || item.request_text || '';
        const img = item.image_file_id
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w500`
          : '';

        return `
          <tr>
            <td>${escapeHtml(item.created_at || '')}</td>
            <td class="fw-bold">${escapeHtml(item.martyr_name || '')}</td>
            <td>${escapeHtml(item.family_name || '')}</td>
            <td class="request-text-cell">
              <div>${escapeHtml(requestText)}</div>
              ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
            </td>
            <td>${statusBadge(item.status)}</td>
            <td>
              ${isPendingRequest(item.status) ? `
                <div class="d-flex gap-1 flex-wrap">
                  <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${escapeAttr(requestId)}')">
                    قبول وإضافة
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${escapeAttr(requestId)}')">
                    رفض
                  </button>
                </div>
              ` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderJoinRequestsTable() {
      const tbody = document.getElementById('joinRequestsTableBody');
      const count = document.getElementById('joinRequestsCount');

      if (!tbody) return;

      const list = joinRequests.slice();
      if (count) count.textContent = list.length;

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات انضمام.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(item => `
        <tr>
          <td>${escapeHtml(item.created_at || '')}</td>
          <td class="fw-bold">${escapeHtml(item.full_name || '')}</td>
          <td>${escapeHtml(item.family_name || '')}</td>
          <td>${escapeHtml(item.birth_year || '')}</td>
          <td>${escapeHtml(item.phone || '')}</td>
          <td class="request-text-cell">${escapeHtml(item.notes || '')}</td>
          <td>${statusBadge(item.status)}</td>
          <td>
            <div class="d-flex gap-1 flex-wrap">
              <button class="btn btn-sm btn-success" onclick="updateJoinRequestStatusFromDashboard('${escapeAttr(item.request_id)}', 'موثق')">
                قبول
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="updateJoinRequestStatusFromDashboard('${escapeAttr(item.request_id)}', 'مرفوض')">
                رفض
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    function isPendingRequest(status) {
      const value = String(status || '').trim();
      return !value || value === 'بانتظار المراجعة' || value === 'بانتظار التوثيق' || value === 'قيد المراجعة';
    }

    function approveDataUpdateFromDashboard(requestId) {
      apiRequest('approveDataUpdate', { updateId: requestId, requestId })
        .then(res => {
          showToast(res.message || 'تم قبول البيانات المستكملة.');
          refreshDashboardData(false);
          loadInitialData();
        })
        .catch(err => {
          showToast(err.message || 'تعذر قبول الطلب. تأكد من تحديث Code.gs أيضًا.');
        });
    }

    function rejectDataUpdateFromDashboard(requestId) {
      const reviewerNotes = prompt('سبب الرفض أو ملاحظات المراجع:') || '';

      apiRequest('rejectDataUpdate', { updateId: requestId, requestId, reviewerNotes })
        .then(res => {
          showToast(res.message || 'تم رفض طلب الاستكمال.');
          refreshDashboardData(false);
        })
        .catch(err => {
          showToast(err.message || 'تعذر رفض الطلب. تأكد من تحديث Code.gs أيضًا.');
        });
    }

    function updateDataRequestStatusFromDashboard(requestId, status) {
      if (status === 'موثق') {
        approveDataUpdateFromDashboard(requestId);
      } else {
        rejectDataUpdateFromDashboard(requestId);
      }
    }

    function updateJoinRequestStatusFromDashboard(requestId, status) {
      const reviewerNotes = status === 'مرفوض' ? 'تم الرفض من لوحة التحكم' : 'تم القبول من لوحة التحكم';

      apiRequest('updateJoinRequestStatus', {
        requestId,
        newStatus: status,
        reviewerNotes
      })
        .then(res => {
          showToast(res.message || 'تم تحديث حالة الطلب.');
          refreshDashboardData(false);
        })
        .catch(err => {
          showToast(err.message || 'تعذر تحديث حالة الطلب.');
        });
    }

    function getImageSrc(item) {
      if (!item) return '';

      const fileId = item.image_file_id || extractDriveFileId(item.image_url);

      if (fileId) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`;
      }

      return item.image_url || '';
    }

    function extractDriveFileId(url) {
      if (!url) return '';

      const text = String(url);

      let match = text.match(/[?&]id=([^&]+)/);
      if (match && match[1]) return match[1];

      match = text.match(/\/d\/([^/]+)/);
      if (match && match[1]) return match[1];

      match = text.match(/file\/d\/([^/]+)/);
      if (match && match[1]) return match[1];

      return '';
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));

        reader.readAsDataURL(file);
      });
    }

    function showPage(pageId) {
      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
      });

      document.getElementById(pageId).classList.add('active');

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }

    function goHome() {
  const cleanUrl = window.location.origin + window.location.pathname;

  window.history.pushState({}, '', cleanUrl);

  currentStatusFilter = 'موثق';

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.value = 'موثق';
  }

  showPage('homePage');
}

    function showToast(message) {
      document.getElementById('toastBody').textContent = message;
      const toast = new bootstrap.Toast(document.getElementById('mainToast'));
      toast.show();
    }

    function normalizeText(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function escapeAttr(value) {
      return escapeHtml(value).replaceAll('`', '&#096;');
    }
  


/* ====== Extended project behavior v3 ====== */
let siteMessages = [];
let currentDynamicMessageIndex = 0;
let publicSettings = {};
let currentRouteSilent = false;
let currentDetailsItem = null;
let currentGalleryIndex = 0;

// لا نعيد تعريف apiRequest هنا حتى لا تصبح كل عمليات الجلب مرتبطة بالسبنر العام.
// التعريف الأساسي موجود في أعلى الصفحة ويعمل بدون حجب الشاشة.
function showGlobalSpinner(show) {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (!overlay) return;
  overlay.classList.toggle('show', !!show);
}

function hideGlobalSpinner() {
  showGlobalSpinner(false);
}

onReady( () => {
  hideGlobalSpinner();
  ['dynamicMessageModal','pendingInfoModal','editMartyrModal','aboutUsModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) modals[id] = new bootstrap.Modal(el);
  });

  moveAdminButtonsToHeader();
  addDashboardSettingsTab();
  addDashboardExtraControls();
  restoreSortPreference();
  bindRoutePopState();

  setTimeout(() => {
    applyRouteFromLocation();
  }, 900);
});

function moveAdminButtonsToHeader() {
  // الأزرار أصبحت جزءًا طبيعيًا من الهيدر، لذلك لا نستخدم position absolute ولا ننقلها من مكانها.
  ['loginBtn', 'dashboardBtn', 'logoutBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const label = (btn.getAttribute('title') || btn.textContent || '').trim();
    if (label) {
      btn.title = label;
      btn.setAttribute('aria-label', label);
    }
  });
}

function maybeShowIntroModal() {
  if (siteMessages && siteMessages.length) {
    showNextDynamicMessage();
    return;
  }

  const hidden = localStorage.getItem('taldo_martyrs_intro_hidden') === '1';
  if (!hidden) {
    setTimeout(() => modals.introModal.show(), 500);
  }
}

function showNextDynamicMessage() {
  const messages = (siteMessages || []).filter(msg => {
    return localStorage.getItem('taldo_msg_hidden_' + msg.message_id) !== '1';
  });

  if (!messages.length) {
    const hidden = localStorage.getItem('taldo_martyrs_intro_hidden') === '1';
    if (!hidden) setTimeout(() => modals.introModal.show(), 400);
    return;
  }

  currentDynamicMessageIndex = 0;
  showDynamicMessage(messages[currentDynamicMessageIndex], messages);
}

function showDynamicMessage(msg, list) {
  window.__currentDynamicMessage = msg;
  window.__dynamicMessageList = list || [];

  document.getElementById('dynamicMessageTitle').textContent = msg.title || 'رسالة';
  document.getElementById('dynamicMessageBody').textContent = msg.body || '';
  document.getElementById('dynamicDontShowAgain').checked = false;

  const imageWrap = document.getElementById('dynamicMessageImageWrap');
  const img = document.getElementById('dynamicMessageImage');
  const src = msg.image_file_id
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(msg.image_file_id)}&sz=w900`
    : (msg.image_url || '');

  if (src) {
    imageWrap.classList.remove('d-none');
    img.src = src;
  } else {
    imageWrap.classList.add('d-none');
    img.removeAttribute('src');
  }

  modals.dynamicMessageModal.show();
}

function acceptDynamicMessage() {
  const msg = window.__currentDynamicMessage;
  if (msg && document.getElementById('dynamicDontShowAgain').checked) {
    localStorage.setItem('taldo_msg_hidden_' + msg.message_id, '1');
  }

  modals.dynamicMessageModal.hide();

  const list = window.__dynamicMessageList || [];
  currentDynamicMessageIndex++;
  if (list[currentDynamicMessageIndex]) {
    setTimeout(() => showDynamicMessage(list[currentDynamicMessageIndex], list), 350);
  }
}

function openAboutUsModal() {
  document.getElementById('aboutUsText').textContent =
    (publicSettings && publicSettings.about_us_text) ||
    'هذا المشروع توثيقي إنساني يهدف إلى حفظ أسماء شهداء مدينة تلدو وبياناتهم من الضياع.';
  modals.aboutUsModal.show();
}

const originalLoadInitialData = loadInitialData;
loadInitialData = function() {
  document.getElementById('loadingBox').style.display = 'block';

  apiRequest('getInitialData')
    .then(res => {
      if (!res || !res.success) {
        showToast('تعذر تحميل البيانات.');
        return;
      }

      allFamilies = res.families || [];
      statsData = res.stats || {};
      allMartyrs = res.martyrs || [];
      siteMessages = res.messages || [];
      publicSettings = res.settings || {};

      fillFamiliesSelects();
      updateStatsCards();
      renderMartyrs();

      const martyrFromUrl = getMartyrIdFromUrl();
      if (martyrFromUrl) {
        setTimeout(() => openMartyrDetails(martyrFromUrl, 'homePage', true), 250);
      } else {
        setTimeout(() => applyRouteFromLocation(), 250);
      }

      maybeShowIntroModal();

      // لا نحمل لوحة التحكم تلقائيًا عند فتح الصفحة العامة؛ هذا كان سببًا رئيسيًا في بطء التحميل.
      // سيتم تحميل لوحة التحكم فقط عند الضغط على أيقونتها.

      document.getElementById('loadingBox').style.display = 'none';
    })
    .catch(err => {
      document.getElementById('loadingBox').style.display = 'none';
      showToast(err.message || 'حدث خطأ أثناء تحميل البيانات.');
    });
};

function restoreSortPreference() {
  const savedSort = localStorage.getItem('taldo_sort_mode');
  const sortSelect = document.getElementById('sortSelect');
  if (savedSort && sortSelect) sortSelect.value = savedSort;
}

function saveSortPreference() {
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) localStorage.setItem('taldo_sort_mode', sortSelect.value || 'name');
}

function ensureCompletionFilterExists() {
  return document.getElementById('completionFilter');
}

const oldRenderMartyrs = renderMartyrs;
renderMartyrs = function(customList) {
  const container = document.getElementById('martyrsContainer');
  const search = normalizeText(document.getElementById('searchInput')?.value || '');
  const family = document.getElementById('familyFilter')?.value || '';
  const sortBy = document.getElementById('sortSelect')?.value || localStorage.getItem('taldo_sort_mode') || 'name';
  const completionFilter = document.getElementById('completionFilter')?.value || '';

  let list = customList || allMartyrs.slice();

  if (currentStatusFilter) {
    list = list.filter(item => item.verification_status === currentStatusFilter);
  }

  if (family) list = list.filter(item => item.family_name === family);

  if (completionFilter === 'needs') list = list.filter(item => isNeedsCompletion(item));
  if (completionFilter === 'complete') list = list.filter(item => !isNeedsCompletion(item));

  if (search) {
    list = list.filter(item => {
      const content = normalizeText([
        item.full_name,
        item.family_name,
        item.father_name,
        item.nickname,
        item.martyrdom_place,
        item.extra_info
      ].join(' '));
      return content.includes(search);
    });
  }

  sortMartyrList(list, sortBy);

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open fa-2x mb-3 text-primary"></i>
        <h5 class="fw-bold">لا توجد نتائج</h5>
        <p class="mb-0">جرّب تغيير البحث أو الفلاتر.</p>
      </div>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(list.length / MARTYRS_PAGE_SIZE));
  if (currentMartyrsPage > totalPages) currentMartyrsPage = totalPages;
  if (currentMartyrsPage < 1) currentMartyrsPage = 1;

  const start = (currentMartyrsPage - 1) * MARTYRS_PAGE_SIZE;
  const pageList = list.slice(start, start + MARTYRS_PAGE_SIZE);

  const contentHtml = viewMode === 'cards'
    ? `<div class="martyrs-grid">${pageList.map(renderMartyrCard).join('')}</div>`
    : `<div>${pageList.map(renderMartyrListItem).join('')}</div>`;

  container.innerHTML = contentHtml + renderMartyrsPagination(totalPages, list.length);
};

function sortMartyrList(list, sortBy) {
  list.sort((a, b) => {
    if (sortBy === 'family') return String(a.family_name || '').localeCompare(String(b.family_name || ''), 'ar');
    if (sortBy === 'newest') return String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || ''));
    if (sortBy === 'oldest') return String(a.created_at || a.updated_at || '').localeCompare(String(b.created_at || b.updated_at || ''));
    return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
  });
}

renderMartyrCard = function(item) {
  const verified = item.verification_status === 'موثق';
  const pending = item.verification_status === 'بانتظار التوثيق';
  const needsCompletion = isNeedsCompletion(item);
  const img = getImageSrc(item);
  const clickAction = pending ? "showPendingInfo()" : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;

  return `
    <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
      ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
        <div class="needs-completion-corner">يحتاج استكمال</div>
      ` : verified ? `
        <div class="verified-corner"><i class="fa-solid fa-check"></i></div>
      ` : ''}
      <div class="martyr-image-wrap">
        ${img ? `
          <img src="${escapeAttr(img)}" class="martyr-image" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
          <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
        ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
      </div>
      <div class="martyr-body">
        <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
        <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
        ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
          <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
        ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
      </div>
    </div>`;
};

renderMartyrListItem = function(item) {
  if (item.verification_status === 'بانتظار التوثيق') {
    return renderMartyrCard(item);
  }

  const verified = item.verification_status === 'موثق';

  return `
    <div class="list-item" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')">
      <div class="d-flex justify-content-between align-items-center gap-2">
        <div>
          <h6 class="fw-bold mb-1">${escapeHtml(item.full_name || '')}</h6>
          <div class="text-muted small">
            عائلة ${escapeHtml(item.family_name || '')}
            ${item.father_name ? ` - ابن ${escapeHtml(item.father_name)}` : ''}
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          ${isNeedsCompletion(item) ? `<span class="badge text-bg-warning">يحتاج استكمال</span>` : verified ? `<span class="badge badge-soft-blue">موثق</span>` : ''}
          <i class="fa-solid fa-chevron-left text-muted"></i>
        </div>
      </div>
    </div>`;
};

function showPendingInfo() {
  modals.pendingInfoModal.show();
}

function openMobileFilterModal() {
  const family = document.getElementById('familyFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  const sort = document.getElementById('sortSelect')?.value || 'name';
  const completion = document.getElementById('completionFilter')?.value || '';

  if (document.getElementById('mobileFamilyFilter')) document.getElementById('mobileFamilyFilter').value = family;
  if (document.getElementById('mobileStatusFilter')) document.getElementById('mobileStatusFilter').value = status;
  if (document.getElementById('mobileSortSelect')) document.getElementById('mobileSortSelect').value = sort;
  if (document.getElementById('mobileCompletionFilter')) document.getElementById('mobileCompletionFilter').value = completion;

  modals.mobileFilterModal.show();
}

function applyMobileFilters() {
  const family = document.getElementById('mobileFamilyFilter')?.value || '';
  const status = document.getElementById('mobileStatusFilter')?.value || '';
  const sort = document.getElementById('mobileSortSelect')?.value || 'name';
  const completion = document.getElementById('mobileCompletionFilter')?.value || '';

  if (document.getElementById('familyFilter')) document.getElementById('familyFilter').value = family;
  if (document.getElementById('statusFilter')) document.getElementById('statusFilter').value = status;
  if (document.getElementById('sortSelect')) document.getElementById('sortSelect').value = sort;
  if (document.getElementById('completionFilter')) document.getElementById('completionFilter').value = completion;

  saveSortPreference();
  modals.mobileFilterModal.hide();
  changeStatusFilter();
}

function changeStatusFilter() {
  currentStatusFilter = document.getElementById('statusFilter').value;

  if (currentStatusFilter === 'بانتظار التوثيق' && !isAdminLoggedIn) {
    resetMartyrsPageAndRender();
    return;
  }

  if (!currentStatusFilter && isAdminLoggedIn && dashboardData.length) {
    allMartyrs = dashboardData.slice();
  }

  resetMartyrsPageAndRender();
}

function updateRoute(url, state) {
  if (currentRouteSilent) return;
  try {
    window.history.pushState(state || {}, '', url);
  } catch (e) {}
}

function bindRoutePopState() {
  window.addEventListener('popstate', () => {
    currentRouteSilent = true;
    applyRouteFromLocation();
    setTimeout(() => currentRouteSilent = false, 100);
  });
}

function applyRouteFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  const martyrId = params.get('m');
  const tab = params.get('tab');
  const family = params.get('family');

  if (martyrId) {
    openMartyrDetails(martyrId, page === 'dashboard' ? 'dashboardPage' : (page === 'dataUpdates' ? 'dashboardDataUpdatesTab' : 'homePage'), true);
    return;
  }

  if (page === 'dashboard' && isAdminLoggedIn) {
    showPage('dashboardPage');
    showDashboardTab(tab || 'martyrs');
    return;
  }

  if (page === 'families') {
    showPage('familiesPage');
    return;
  }

  if (family) {
    openFamilyMartyrs(family, true);
    return;
  }

  showPage('homePage');
}

showPage = function(pageId) {
  document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  if (!currentRouteSilent) {
    if (pageId === 'homePage') updateRoute(window.location.pathname, { page: 'home' });
    else if (pageId === 'familiesPage') updateRoute(`?page=families`, { page: 'families' });
    else if (pageId === 'dashboardPage') updateRoute(`?page=dashboard`, { page: 'dashboard' });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

goHome = function() {
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.pushState({ page: 'home' }, '', cleanUrl);
  currentStatusFilter = 'موثق';

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.value = 'موثق';

  const completionFilter = document.getElementById('completionFilter');
  if (completionFilter) completionFilter.value = '';

  showPage('homePage');
  resetMartyrsPageAndRender();
};

openFamilyMartyrs = function(familyName, noRoute) {
  const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
  const list = source.filter(item => item.family_name === familyName && item.verification_status !== 'مرفوض');

  document.getElementById('familyPageTitle').textContent = `شهداء عائلة ${familyName}`;
  const container = document.getElementById('familyMartyrsContainer');

  container.innerHTML = list.length
    ? `<div class="martyrs-grid">${list.map(renderMartyrCardForFamily).join('')}</div>`
    : `<div class="empty-state">لا توجد أسماء لهذه العائلة.</div>`;

  if (!noRoute) updateRoute(`?family=${encodeURIComponent(familyName)}`, { page: 'family', family: familyName });
  showPage('familyMartyrsPage');
};

openMartyrDetails = function(martyrId, fromPage, noRoute) {
  const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
  const item = source.find(x => x.martyr_id === martyrId);
  if (!item) return;

  if (item.verification_status === 'بانتظار التوثيق' && !isAdminLoggedIn) {
    showPendingInfo();
    return;
  }

  currentDetailsItem = item;
  currentGalleryIndex = 0;
  lastPageBeforeDetails = fromPage || 'homePage';

  if (!noRoute) {
    let pageParam = 'home';
let tabParam = '';

if (fromPage === 'dashboardDataUpdatesTab') {
  pageParam = 'dashboard';
  tabParam = '&tab=dataUpdates';
} else if (fromPage === 'dashboardJoinRequestsTab') {
  pageParam = 'dashboard';
  tabParam = '&tab=joinRequests';
} else if (fromPage === 'dashboardPage') {
  pageParam = 'dashboard';
  tabParam = '&tab=martyrs';
}

updateRoute(
  `?page=${pageParam}${tabParam}&m=${encodeURIComponent(martyrId)}`,
  { page: 'details', martyrId, fromPage }
);
  }

  const canUpdate = isAllowUpdatesEnabled(item.allow_updates);

  document.getElementById('detailsContainer').innerHTML = `
    <div class="row g-4">
      <div class="col-lg-5">
        ${renderImageGallery(item)}
      </div>
      <div class="col-lg-7">
        <div class="detail-box">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h2 class="fw-bold mb-1">${escapeHtml(item.full_name || '')} ${adminEditBtn('full_name')}</h2>
              <div class="text-muted">عائلة ${escapeHtml(item.family_name || '')} ${adminEditBtn('family_name')}</div>
            </div>
            ${statusBadge(item.verification_status)}
          </div>

          <div class="row g-3">
            ${detailItemEditable('اسم الأب', item.father_name, 'father_name')}
            ${detailItemEditable('المواليد', item.birth_year, 'birth_year')}
            ${detailItemEditable('اللقب', item.nickname, 'nickname')}
            ${detailItemEditable('استشهد بـ', item.martyrdom_type, 'martyrdom_type')}
            ${item.martyrdom_type === 'المعارك' ? detailItemEditable('اسم المعركة', item.battle_name, 'battle_name') : ''}
            ${item.martyrdom_type === 'آخر' ? detailItemEditable('السبب', item.other_cause, 'other_cause') : ''}
            ${detailItemEditable('تاريخ الاستشهاد', item.martyrdom_date, 'martyrdom_date')}
            ${detailItemEditable('مكان الاستشهاد', item.martyrdom_place, 'martyrdom_place')}
          </div>

          ${item.extra_info ? `
            <hr>
            <h6 class="fw-bold">معلومات إضافية ${adminEditBtn('extra_info')}</h6>
            <p class="lh-lg mb-0">${escapeHtml(item.extra_info)}</p>
          ` : ''}

          ${item.completed_info ? `
            <div class="completed-info-box">
              <h6 class="fw-bold text-warning-emphasis mb-2">
                <i class="fa-solid fa-circle-info ms-1"></i>
                بيانات مستكملة
              </h6>
              <p class="lh-lg mb-0">${escapeHtml(item.completed_info)}</p>
            </div>
          ` : ''}

          <div class="details-action-bar">
            <button class="btn btn-primary" onclick="shareMartyr('${escapeAttr(item.martyr_id)}')">
              <i class="fa-solid fa-share-nodes ms-1"></i>
              مشاركة
            </button>
            ${canUpdate ? `
              <button class="btn btn-warning" onclick="openDataUpdateModal('${escapeAttr(item.martyr_id)}', '${escapeAttr(item.full_name || '')}')">
                <i class="fa-solid fa-pen-to-square ms-1"></i>
                استكمال بيانات
              </button>
            ` : ''}
          </div>

          ${isAdminLoggedIn ? renderAdminActions(item) : ''}
        </div>
      </div>
    </div>`;

  showPage('detailsPage');
};

function renderImageGallery(item) {
  const images = normalizeImages(item);
  if (!images.length) {
    return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
  }
  const first = images[0];
  return `
    <div class="image-gallery">
      <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
      <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>
      ${images.length > 1 ? `
        <div class="gallery-controls">
          <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
          <span class="badge text-bg-light align-self-center" id="galleryCounter">1 / ${images.length}</span>
          <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
        </div>
      ` : ''}
    </div>`;
}

function normalizeImages(item) {
  const images = [];
  if (Array.isArray(item.images)) {
    item.images.forEach(img => {
      const src = img.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000` : (img.image_url || '');
      if (src) images.push({ src });
    });
  }

  const main = getImageSrc(item);
  if (main && !images.some(img => img.src === main)) images.unshift({ src: main });
  return images;
}

function changeGalleryImage(step) {
  const images = normalizeImages(currentDetailsItem || {});
  if (!images.length) return;
  currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;
  const img = document.getElementById('galleryMainImage');
  const counter = document.getElementById('galleryCounter');
  if (img) img.src = images[currentGalleryIndex].src;
  if (counter) counter.textContent = `${currentGalleryIndex + 1} / ${images.length}`;
}

function adminEditBtn(field) {
  return isAdminLoggedIn ? `<button class="edit-field-btn" title="تعديل" onclick="event.stopPropagation(); openEditMartyrModal('${field}')"><i class="fa-solid fa-pen"></i></button>` : '';
}

function detailItemEditable(label, value, field) {
  if (!value && !isAdminLoggedIn) return '';
  return `
    <div class="col-md-6">
      <div class="p-3 rounded-4 bg-light h-100">
        <div class="text-muted small mb-1">${escapeHtml(label)} ${adminEditBtn(field)}</div>
        <div class="fw-bold">${escapeHtml(value || '-')}</div>
      </div>
    </div>`;
}

function openEditMartyrModal(focusField) {
  if (!currentDetailsItem) return;

  const form = document.getElementById('editMartyrForm');
  if (form) form.reset();
  const editImageInput = document.getElementById('editImageInput');
  if (editImageInput) editImageInput.value = '';

  document.getElementById('editMartyrId').value = currentDetailsItem.martyr_id || '';

  const fields = [
    'full_name',
    'family_name',
    'father_name',
    'birth_year',
    'nickname',
    'battle_name',
    'other_cause',
    'martyrdom_date',
    'martyrdom_place',
    'extra_info'
  ];

  fields.forEach(field => {
    const el = document.getElementById('edit_' + field);
    if (el) el.value = currentDetailsItem[field] || '';
  });

  const martyrdomType = String(currentDetailsItem.martyrdom_type || '').trim();

  document
    .querySelectorAll('#editMartyrForm input[name="martyrdom_type"]')
    .forEach(radio => {
      radio.checked = radio.value === martyrdomType;
    });

  toggleEditCauseFields(false);

  const dropdown = document.getElementById('editFamilyDropdown');
  if (dropdown) dropdown.classList.add('d-none');

  modals.editMartyrModal.show();

  setTimeout(() => {
    const focusTarget =
      document.getElementById('edit_' + focusField) ||
      document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked') ||
      document.getElementById('edit_full_name');

    focusTarget?.focus();
  }, 250);
}


async function saveMartyrEdits() {
  const form = document.getElementById('editMartyrForm');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = {
    martyr_id: document.getElementById('editMartyrId').value
  };

  const formData = Object.fromEntries(new FormData(form).entries());
  Object.assign(payload, formData);

  if (payload.martyrdom_type !== 'المعارك') {
    payload.battle_name = '';
  }

  if (payload.martyrdom_type !== 'آخر') {
    payload.other_cause = '';
  }

  const imageInput = document.getElementById('editImageInput');

  if (imageInput && imageInput.files && imageInput.files.length) {
    payload.imageFiles = await filesToPayload(imageInput.files);
  }

  const btn = document.getElementById('editMartyrSaveBtn');
  const normalBtn = `<i class="fa-solid fa-floppy-disk ms-1"></i> حفظ التعديلات`;

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

  apiRequest('updateMartyrFields', payload)
    .then(res => {
      btn.disabled = false;
      btn.innerHTML = normalBtn;

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      modals.editMartyrModal.hide();
      showToast(res.message || 'تم حفظ التعديلات.');

      if (currentDetailsItem) {
        Object.assign(currentDetailsItem, payload);
      }

      refreshDashboardData(false);
      loadInitialData();

      setTimeout(() => {
        if (payload.martyr_id) {
          openMartyrDetails(payload.martyr_id, lastPageBeforeDetails || 'dashboardPage', true);
        }
      }, 700);
    })
    .catch(err => {
      btn.disabled = false;
      btn.innerHTML = normalBtn;
      showToast(err.message || 'تعذر الحفظ.');
    });
}
  
function toggleEditCauseFields(clearHiddenValues = true) {
  const type = document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked')?.value || '';

  const battleBox = document.getElementById('editBattleNameBox');
  const otherBox = document.getElementById('editOtherCauseBox');

  const battleInput = document.getElementById('edit_battle_name');
  const otherInput = document.getElementById('edit_other_cause');

  if (battleBox) battleBox.classList.toggle('d-none', type !== 'المعارك');
  if (otherBox) otherBox.classList.toggle('d-none', type !== 'آخر');

  if (battleInput) battleInput.required = type === 'المعارك';
  if (otherInput) otherInput.required = type === 'آخر';

  if (clearHiddenValues) {
    if (type !== 'المعارك' && battleInput) battleInput.value = '';
    if (type !== 'آخر' && otherInput) otherInput.value = '';
  }
}


function handleEditFamilySearchInput() {
  const input = document.getElementById('edit_family_name');
  renderEditFamilyDropdown(input?.value || '');
}


function showEditFamilyDropdown() {
  const input = document.getElementById('edit_family_name');
  renderEditFamilyDropdown(input?.value || '');
}


function renderEditFamilyDropdown(query) {
  const dropdown = document.getElementById('editFamilyDropdown');
  if (!dropdown) return;

  const typedValue = String(query || '').trim();
  const matches = getFamilyMatches(typedValue);

  dropdown.classList.remove('d-none');
  dropdown.innerHTML = '';

  if (!typedValue && !matches.length) {
    dropdown.classList.add('d-none');
    return;
  }

  if (matches.length) {
    const title = document.createElement('div');
    title.className = 'family-suggestion-title';
    title.textContent = 'عوائل مشابهة أو مسجلة سابقًا';
    dropdown.appendChild(title);

    matches.forEach(family => {
      const option = document.createElement('div');
      option.className = 'family-option';
      option.textContent = family;
      option.onclick = function() {
        selectEditFamily(family);
      };
      dropdown.appendChild(option);
    });
  }

  if (typedValue) {
    const exactExists = allFamilies.some(family => {
      return normalizeFamilyForSearch(family) === normalizeFamilyForSearch(typedValue);
    });

    if (!exactExists) {
      const hint = document.createElement('div');
      hint.className = 'family-new-hint';
      hint.innerHTML = `
        إن لم تكن العائلة موجودة أعلاه، سيتم حفظها كعائلة جديدة باسم:
        <strong>${escapeHtml(typedValue)}</strong>
      `;
      dropdown.appendChild(hint);
    }
  }
}


function selectEditFamily(family) {
  const input = document.getElementById('edit_family_name');
  const dropdown = document.getElementById('editFamilyDropdown');

  if (input) input.value = family;
  if (dropdown) dropdown.classList.add('d-none');
}


document.addEventListener('click', function(e) {
  const input = document.getElementById('edit_family_name');
  const dropdown = document.getElementById('editFamilyDropdown');

  if (!input || !dropdown) return;

  if (!input.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.add('d-none');
  }
});
  
renderAdminActions = function(item) {
  const allowChecked = isAllowUpdatesEnabled(item.allow_updates) ? 'checked' : '';
  const needsChecked = isNeedsCompletion(item) ? 'checked' : '';

  return `
    <div class="admin-box mt-4">
      <h6 class="fw-bold mb-3"><i class="fa-solid fa-user-shield ms-1"></i> أدوات المراجعة</h6>
      <div class="row g-3">
        <div class="col-md-8">
          <textarea id="reviewerNotes" class="form-control" rows="2" placeholder="ملاحظات المراجع"></textarea>
        </div>
        <div class="col-md-4 d-grid gap-2">
          <button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')">
            <i class="fa-solid fa-check ms-1"></i> توثيق
          </button>
          <button class="btn btn-warning" onclick="verifyWithCompletionFromDetails('${escapeAttr(item.martyr_id)}')">
            <i class="fa-solid fa-circle-exclamation ms-1"></i> توثيق مع الاستكمال
          </button>
          <button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')">
            <i class="fa-solid fa-xmark ms-1"></i> رفض
          </button>
        </div>
        <div class="col-12">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="allowUpdatesSwitch" ${allowChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
            <label class="form-check-label fw-bold" for="allowUpdatesSwitch">إظهار زر استكمال البيانات</label>
          </div>
          <div class="form-check form-switch mt-2">
            <input class="form-check-input" type="checkbox" id="needsCompletionSwitch" ${needsChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
            <label class="form-check-label fw-bold" for="needsCompletionSwitch">إظهار علامة يحتاج استكمال</label>
          </div>
        </div>
      </div>
    </div>`;
};

function saveCompletionSwitches(martyrId) {
  const allow = document.getElementById('allowUpdatesSwitch')?.checked ? 'نعم' : 'لا';
  const needs = document.getElementById('needsCompletionSwitch')?.checked ? 'نعم' : 'لا';

  apiRequest('setMartyrCompletionOptions', {
    martyrId,
    allowUpdates: allow,
    needsCompletion: needs
  }).then(res => {
    showToast(res.message || 'تم حفظ الخيارات.');
    refreshDashboardData(false);
    loadInitialData();
  }).catch(err => showToast(err.message || 'تعذر حفظ الخيارات.'));
}

function verifyWithCompletionFromDetails(martyrId) {
  const notes = document.getElementById('reviewerNotes')?.value || '';
  apiRequest('verifyMartyrWithCompletion', { martyrId, reviewerNotes: notes })
    .then(res => {
      showToast(res.message || 'تم التوثيق مع طلب الاستكمال.');
      refreshDashboardData(false);
      loadInitialData();
      showPage('dashboardPage');
    })
    .catch(err => showToast(err.message || 'تعذر تحديث الحالة.'));
}

function addDashboardExtraControls() {
  const dashboardFilters = document.querySelector('#dashboardMartyrsTab .filter-card .row');
  if (dashboardFilters && !document.getElementById('dashboardSortSelect')) {
    dashboardFilters.insertAdjacentHTML('beforeend', `
      <div class="col-md-3">
        <label class="form-label fw-bold">فرز</label>
        <select class="form-select" id="dashboardSortSelect" onchange="renderDashboardTable()">
          <option value="pending-first">بانتظار التوثيق أولًا</option>
          <option value="name">أبجديًا</option>
          <option value="newest">الأحدث رفعًا</option>
          <option value="oldest">الأقدم رفعًا</option>
        </select>
      </div>`);
  }

  const updatesHeader = document.querySelector('#dashboardDataUpdatesTab .dashboard-section-header');
  if (updatesHeader && !document.getElementById('dataUpdatesControls')) {
    updatesHeader.insertAdjacentHTML('afterend', `
      <div class="dashboard-controls-row" id="dataUpdatesControls">
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label fw-bold">بحث</label>
            <input class="form-control" id="dataUpdatesSearchInput" placeholder="بحث في الطلبات..." oninput="renderDataUpdateRequestsTable()">
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold">الحالة</label>
            <select class="form-select" id="dataUpdatesStatusFilter" onchange="renderDataUpdateRequestsTable()">
              <option value="بانتظار المراجعة">بانتظار المراجعة</option>
              <option value="مقبول">مقبول</option>
              <option value="مرفوض">مرفوض</option>
              <option value="">الكل</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold">فرز</label>
            <select class="form-select" id="dataUpdatesSortSelect" onchange="renderDataUpdateRequestsTable()">
              <option value="newest">الأحدث أولًا</option>
              <option value="oldest">الأقدم أولًا</option>
              <option value="name">أبجديًا حسب اسم الشهيد</option>
            </select>
          </div>
        </div>
      </div>`);
  }
}

renderDashboardTable = function() {
  const tbody = document.getElementById('dashboardTableBody');
  if (!tbody) return;

  const search = normalizeText(document.getElementById('dashboardSearchInput').value || '');
  const status = document.getElementById('dashboardStatusFilter').value || '';
  const sortBy = document.getElementById('dashboardSortSelect')?.value || 'pending-first';

  let list = dashboardData.slice();

  if (status) list = list.filter(item => item.verification_status === status);
  if (search) {
    list = list.filter(item => normalizeText([item.full_name,item.family_name,item.father_name,item.nickname,item.martyrdom_place,item.extra_info].join(' ')).includes(search));
  }

  if (sortBy === 'name') list.sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  else if (sortBy === 'newest') list.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  else if (sortBy === 'oldest') list.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  else {
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

  tbody.innerHTML = list.map(item => {
    const img = getImageSrc(item);
    return `
      <tr>
        <td style="width:70px;">${img ? `<img src="${escapeAttr(img)}" style="width:52px;height:52px;border-radius:14px;object-fit:cover;background:#f1f3f5;">` : `<div style="width:52px;height:52px;border-radius:14px;background:#f1f3f5;display:grid;place-items:center;color:#adb5bd;"><i class="fa-solid fa-user"></i></div>`}</td>
        <td><div class="fw-bold">${escapeHtml(item.full_name || '')}</div><div class="small text-muted">${escapeHtml(item.martyrdom_place || '')}</div></td>
        <td>${escapeHtml(item.family_name || '')}</td>
        <td>${escapeHtml(item.father_name || '')}</td>
        <td>${statusBadge(item.verification_status)} ${isNeedsCompletion(item) ? '<span class="badge text-bg-warning">يحتاج استكمال</span>' : ''}</td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardPage')">عرض</button>
            <button class="btn btn-sm btn-success" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'موثق')">توثيق</button>
            <button class="btn btn-sm btn-warning" onclick="apiRequest('verifyMartyrWithCompletion',{martyrId:'${escapeAttr(item.martyr_id)}'}).then(()=>{showToast('تم التوثيق مع الاستكمال'); refreshDashboardData(false); loadInitialData();})">توثيق مع الاستكمال</button>
            <button class="btn btn-sm btn-outline-danger" onclick="quickUpdateStatus('${escapeAttr(item.martyr_id)}', 'مرفوض')">رفض</button>
          </div>
        </td>
      </tr>`;
  }).join('');
};

renderDataUpdateRequestsTable = function() {
  const tbody = document.getElementById('dataUpdatesTableBody');
  const countBadge = document.getElementById('dataUpdatesCount');
  if (!tbody) return;

  const search = normalizeText(document.getElementById('dataUpdatesSearchInput')?.value || '');
  const statusFilter = document.getElementById('dataUpdatesStatusFilter')?.value ?? 'بانتظار المراجعة';
  const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

  let list = dataUpdateRequests || [];

  if (statusFilter) list = list.filter(item => String(item.status || '').trim() === statusFilter);
  if (search) {
    list = list.filter(item => normalizeText([item.martyr_name,item.family_name,item.submitted_text,item.request_text].join(' ')).includes(search));
  }

  if (sortBy === 'oldest') list.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  else if (sortBy === 'name') list.sort((a,b)=>String(a.martyr_name||'').localeCompare(String(b.martyr_name||''),'ar'));
  else list.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));

  if (countBadge) countBadge.textContent = list.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">لا توجد طلبات مطابقة.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const requestId = item.update_id || item.request_id || '';
    const requestText = item.submitted_text || item.request_text || '';
    const img = item.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w500` : '';
    return `
      <tr>
        <td>${escapeHtml(item.created_at || '')}</td>
        <td class="fw-bold" style="cursor:pointer" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardDataUpdatesTab')">${escapeHtml(item.martyr_name || '')}</td>
        <td>${escapeHtml(item.family_name || '')}</td>
        <td class="request-text-cell"><div>${escapeHtml(requestText)}</div>${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}</td>
        <td>${statusBadge(item.status)}</td>
        <td>${isPendingRequest(item.status) ? `
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${escapeAttr(requestId)}')">قبول وإضافة</button>
            <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${escapeAttr(requestId)}')">رفض</button>
          </div>` : '-'}</td>
      </tr>`;
  }).join('');
};

function addDashboardSettingsTab() {
  const tabs = document.querySelector('.dashboard-tabs');
  if (tabs && !document.getElementById('dashSettingsTabBtn')) {
    tabs.insertAdjacentHTML('beforeend', `
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="dashSettingsTabBtn" type="button" onclick="showDashboardTab('settings')">
          <i class="fa-solid fa-gear ms-1"></i>
          الإعدادات العامة
        </button>
      </li>`);
  }

  const dash = document.getElementById('dashboardPage');
  if (dash && !document.getElementById('dashboardSettingsTab')) {
    dash.insertAdjacentHTML('beforeend', `
      <div id="dashboardSettingsTab" class="dashboard-tab-pane d-none">
        <div class="settings-card">
          <h5 class="fw-bold mb-3"><i class="fa-solid fa-bullhorn text-primary ms-1"></i> رسائل تظهر عند فتح الموقع</h5>
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label fw-bold">العنوان</label><input class="form-control" id="msgTitle"></div>
            <div class="col-md-2"><label class="form-label fw-bold">الترتيب</label><input class="form-control" id="msgOrder" value="100"></div>
            <div class="col-md-3"><label class="form-label fw-bold">الحالة</label><select class="form-select" id="msgStatus"><option value="active">مفعل</option><option value="inactive">غير مفعل</option></select></div>
            <div class="col-md-3"><label class="form-label fw-bold">صورة</label><input type="file" class="form-control" id="msgImage" accept="image/*"></div>
            <div class="col-12"><label class="form-label fw-bold">نص الرسالة</label><textarea class="form-control" id="msgBody" rows="4"></textarea></div>
            <div class="col-12"><button class="btn btn-primary" onclick="saveDashboardMessage()">حفظ الرسالة</button></div>
          </div>
          <hr>
          <div id="messagesAdminList"></div>
        </div>
        <div class="settings-card">
          <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-primary ms-1"></i> نص من نحن</h5>
          <textarea class="form-control" id="aboutUsAdminText" rows="5"></textarea>
          <button class="btn btn-primary mt-3" onclick="saveAboutUsText()">حفظ نص من نحن</button>
        </div>
      </div>`);
  }
}

const oldShowDashboardTab = showDashboardTab;
showDashboardTab = function(tabName) {
  oldShowDashboardTab(tabName);

  if (tabName === 'settings') {
    ['dashboardMartyrsTab','dashboardDataUpdatesTab','dashboardJoinRequestsTab'].forEach(id => document.getElementById(id)?.classList.add('d-none'));
    ['dashMartyrsTabBtn','dashDataUpdatesTabBtn','dashJoinTabBtn'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.getElementById('dashboardSettingsTab')?.classList.remove('d-none');
    document.getElementById('dashSettingsTabBtn')?.classList.add('active');
    renderSettingsTab();
  } else {
    document.getElementById('dashboardSettingsTab')?.classList.add('d-none');
    document.getElementById('dashSettingsTabBtn')?.classList.remove('active');
  }

  if (!currentRouteSilent && document.getElementById('dashboardPage')?.classList.contains('active')) {
    updateRoute(`?page=dashboard&tab=${encodeURIComponent(tabName)}`, { page: 'dashboard', tab: tabName });
  }
};

function renderSettingsTab() {
  const messages = (window.__adminMessages || siteMessages || []);
  const list = document.getElementById('messagesAdminList');
  const about = document.getElementById('aboutUsAdminText');
  if (about) about.value = publicSettings.about_us_text || '';

  if (!list) return;
  if (!messages.length) {
    list.innerHTML = '<div class="text-muted">لا توجد رسائل مخصصة بعد.</div>';
    return;
  }

  list.innerHTML = messages.map(msg => `
    <div class="border rounded-4 p-3 mb-2">
      <div class="d-flex justify-content-between gap-2 flex-wrap">
        <div>
          <div class="fw-bold">${escapeHtml(msg.title || '')}</div>
          <div class="small text-muted">${escapeHtml(msg.status || '')} - ترتيب: ${escapeHtml(msg.sort_order || '')}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-primary" onclick="toggleDashboardMessage('${escapeAttr(msg.message_id)}','${msg.status === 'active' ? 'inactive' : 'active'}')">
            ${msg.status === 'active' ? 'إلغاء التفعيل' : 'تفعيل'}
          </button>
        </div>
      </div>
      <div class="mt-2" style="white-space:pre-line">${escapeHtml(msg.body || '')}</div>
    </div>`).join('');
}

function saveDashboardMessage() {
  const file = document.getElementById('msgImage')?.files?.[0];
  const payload = {
    title: document.getElementById('msgTitle').value,
    body: document.getElementById('msgBody').value,
    status: document.getElementById('msgStatus').value,
    sort_order: document.getElementById('msgOrder').value
  };

  const finish = () => apiRequest('saveSiteMessage', payload).then(res => {
    showToast(res.message || 'تم حفظ الرسالة.');
    document.getElementById('msgTitle').value = '';
    document.getElementById('msgBody').value = '';
    document.getElementById('msgImage').value = '';
    refreshDashboardData(false);
    loadInitialData();
  }).catch(err => showToast(err.message || 'تعذر الحفظ.'));

  if (file) {
    fileToBase64(file).then(base64 => {
      payload.imageBase64 = base64;
      payload.imageName = file.name;
      finish();
    });
  } else finish();
}

function toggleDashboardMessage(messageId, status) {
  apiRequest('updateSiteMessageStatus', { messageId, status })
    .then(res => {
      showToast(res.message || 'تم تحديث الرسالة.');
      refreshDashboardData(false);
      loadInitialData();
    })
    .catch(err => showToast(err.message || 'تعذر تحديث الرسالة.'));
}

function saveAboutUsText() {
  const textarea = document.getElementById('aboutUsAdminText');

  if (!textarea) {
    showToast('لم يتم العثور على حقل نص من نحن.');
    return;
  }

  const value = textarea.value || '';

  apiRequest('updateSettingValue', {
    key: 'about_us_text',
    value: value,
    description: 'نص يظهر عند الضغط على زر من نحن'
  })
    .then(res => {
      if (!res || !res.success) {
        showToast(res?.message || 'تعذر حفظ نص من نحن.');
        return;
      }

      publicSettings.about_us_text = value;
      showToast(res.message || 'تم حفظ نص من نحن.');

      // اختياري لتحديث البيانات العامة فورًا بعد الحفظ
      loadInitialData();
    })
    .catch(err => {
      showToast(err.message || 'تعذر حفظ نص من نحن.');
    });
}
const oldRefreshDashboardData = refreshDashboardData;
refreshDashboardData = function(showMsg = true) {
  if (!isAdminLoggedIn) {
    showToast('يرجى تسجيل الدخول أولًا.');
    return;
  }

  apiRequest('getAdminDashboardData')
    .then(res => {
      if (!res || !res.success) {
        showToast('تعذر تحميل بيانات لوحة التحكم.');
        return;
      }

      statsData = res.stats || statsData;
      dashboardData = res.all || [];
      dataUpdateRequests = res.dataUpdates || [];
      joinRequests = res.joinRequests || [];
      window.__adminMessages = res.messages || [];
      publicSettings = res.settings || publicSettings || {};
      // لا نعيد كتابة بيانات الصفحة الرئيسية عند تحميل لوحة التحكم؛ هذا يحافظ على سرعة العرض العام.
      // allMartyrs = dashboardData.filter(x => x.verification_status !== 'مرفوض');

      updateStatsCards();
      updateDashboardStats();
      renderDashboardTable();
      renderDataUpdateRequestsTable();
      renderJoinRequestsTable();
      renderSettingsTab();

      if (showMsg) showToast('تم تحديث لوحة التحكم.');
    })
    .catch(err => {
      showToast(err.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
    });
};

async function filesToPayload(fileList) {
  const files = Array.from(fileList || []);
  const payload = [];
  for (const file of files) {
    payload.push({
      name: file.name,
      base64: await fileToBase64(file)
    });
  }
  return payload;
}

submitMartyrForm = async function() {
  const form = document.getElementById('martyrForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;

  try {
    const formData = Object.fromEntries(new FormData(form).entries());
    const imageInput = document.getElementById('imageInput');
    formData.imageFiles = await filesToPayload(imageInput?.files || []);

    apiRequest('submitMartyr', formData)
      .then(res => {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;
        if (!res.success) return showToast(res.message || 'تعذر الإرسال.');
        modals.submitModal.hide();
        modals.submitSuccessModal.show();
        setTimeout(() => modals.submitSuccessModal.hide(), 1800);
        loadInitialData();
      })
      .catch(err => {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;
        showToast(err.message || 'حدث خطأ أثناء إرسال البيانات.');
      });
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;
    showToast(error.message || 'تعذر قراءة الصور.');
  }
};

submitDataUpdateForm = async function() {
  const martyrId = document.getElementById('dataUpdateMartyrId').value;
  const martyrName = document.getElementById('dataUpdateMartyrName').value;
  const requestText = document.getElementById('dataUpdateText').value.trim();
  const imageInput = document.getElementById('dataUpdateImageInput');

  if (!requestText && (!imageInput || !imageInput.files.length)) {
    showToast('يرجى كتابة البيانات أو رفع صورة.');
    return;
  }

  const btn = document.getElementById('dataUpdateSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;

  try {
    const payload = {
      martyr_id: martyrId,
      martyr_name: martyrName,
      request_text: requestText,
      submitted_text: requestText,
      imageFiles: await filesToPayload(imageInput?.files || [])
    };

    apiRequest('submitDataUpdate', payload)
      .then(res => {
        btn.disabled = false;
        btn.innerHTML = 'إرسال للمراجعة';
        if (!res.success) return showToast(res.message || 'تعذر إرسال الطلب.');
        modals.dataUpdateModal.hide();
        showToast(res.message || 'تم إرسال الطلب.');
      })
      .catch(err => {
        btn.disabled = false;
        btn.innerHTML = 'إرسال للمراجعة';
        showToast(err.message || 'تعذر إرسال الطلب.');
      });
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = 'إرسال للمراجعة';
    showToast(error.message || 'تعذر قراءة الصور.');
  }
};


/* ===== Final fixes: admin buttons visibility + safe spinner + persistent success modal ===== */
function setButtonLoading(btn, isLoading, loadingText, normalHtml) {
  if (!btn) return;
  btn.disabled = !!isLoading;
  btn.innerHTML = isLoading
    ? `<span class="spinner-border spinner-border-sm ms-1"></span> ${loadingText || 'جار المعالجة...'}`
    : normalHtml;
}

(function ensureFinalAdminButtonBehavior() {
  const originalUpdateAdminButtons = window.updateAdminButtons;
  window.updateAdminButtons = function() {
    if (typeof originalUpdateAdminButtons === 'function') {
      originalUpdateAdminButtons();
    }

    const loginBtn = document.getElementById('loginBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn) loginBtn.classList.toggle('d-none', !!isAdminLoggedIn);
    if (dashboardBtn) dashboardBtn.classList.toggle('d-none', !isAdminLoggedIn);
    if (logoutBtn) logoutBtn.classList.toggle('d-none', !isAdminLoggedIn);

    [loginBtn, dashboardBtn, logoutBtn].forEach(btn => {
      if (!btn) return;
      btn.classList.remove('btn-danger', 'btn-outline-danger', 'btn-primary');
      btn.classList.add('btn-outline-light', 'admin-icon-btn');
    });
  };
})();

// السبنر العام يبقى متاحًا للعمليات الطويلة فقط، ولا يرتبط بكل طلبات الجلب العادية.
function showGlobalSpinner(show = true) {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (!overlay) return;

  overlay.classList.toggle('show', !!show);

  if (show) {
    clearTimeout(window.__globalSpinnerSafetyTimer);
    window.__globalSpinnerSafetyTimer = setTimeout(() => {
      hideGlobalSpinner();
    }, 25000);
  }
}

function hideGlobalSpinner() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.classList.remove('show');
  clearTimeout(window.__globalSpinnerSafetyTimer);
}

onReady( () => {
  hideGlobalSpinner();
  if (typeof updateAdminButtons === 'function') updateAdminButtons();
});

submitMartyrForm = async function() {
  const form = document.getElementById('martyrForm');
  if (!form || !form.checkValidity()) {
    if (form) form.reportValidity();
    return;
  }

  const btn = document.getElementById('submitBtn');
  const normalBtn = `<i class="fa-solid fa-paper-plane ms-1"></i> إرسال البيانات`;

  setButtonLoading(btn, true, 'جاري الإرسال...', normalBtn);
  showGlobalSpinner(true);

  try {
    const formData = Object.fromEntries(new FormData(form).entries());
    const imageInput = document.getElementById('imageInput');

    if (typeof filesToPayload === 'function') {
      formData.imageFiles = await filesToPayload(imageInput?.files || []);
    } else {
      const file = imageInput?.files && imageInput.files[0];
      if (file) {
        formData.imageBase64 = await fileToBase64(file);
        formData.imageName = file.name;
      }
    }

    const res = await apiRequest('submitMartyr', formData);

    if (!res || !res.success) {
      showToast(res?.message || 'تعذر الإرسال.');
      return;
    }

    modals.submitModal.hide();
    modals.submitSuccessModal.show();
    loadInitialData();
  } catch (err) {
    showToast(err.message || 'حدث خطأ أثناء إرسال البيانات.');
  } finally {
    setButtonLoading(btn, false, '', normalBtn);
    hideGlobalSpinner();
  }
};

submitDataUpdateForm = async function() {
  const martyrId = document.getElementById('dataUpdateMartyrId')?.value || '';
  const martyrName = document.getElementById('dataUpdateMartyrName')?.value || '';
  const requestText = document.getElementById('dataUpdateText')?.value.trim() || '';
  const imageInput = document.getElementById('dataUpdateImageInput');

  if (!requestText && (!imageInput || !imageInput.files.length)) {
    showToast('يرجى كتابة البيانات أو رفع صورة.');
    return;
  }

  const btn = document.getElementById('dataUpdateSubmitBtn');
  const normalBtn = 'إرسال للمراجعة';

  setButtonLoading(btn, true, 'جاري الإرسال...', normalBtn);
  showGlobalSpinner(true);

  try {
    const payload = {
      martyr_id: martyrId,
      martyr_name: martyrName,
      request_text: requestText,
      submitted_text: requestText,
      imageFiles: typeof filesToPayload === 'function' ? await filesToPayload(imageInput?.files || []) : []
    };

    const res = await apiRequest('submitDataUpdate', payload);

    if (!res || !res.success) {
      showToast(res?.message || 'تعذر إرسال الطلب.');
      return;
    }

    modals.dataUpdateModal.hide();
    showToast(res.message || 'تم إرسال الطلب.');
  } catch (err) {
    showToast(err.message || 'تعذر إرسال الطلب.');
  } finally {
    setButtonLoading(btn, false, '', normalBtn);
    hideGlobalSpinner();
  }
};


/* ===== Image approval mode + admin image deletion + section refresh buttons ===== */
function getUpdateRequestImages(item) {
  const images = [];

  if (!item) return images;

  if (item.image_files_json) {
    try {
      const parsed = JSON.parse(item.image_files_json);
      if (Array.isArray(parsed)) {
        parsed.forEach(img => {
          if (img && (img.image_file_id || img.image_url)) images.push(img);
        });
      }
    } catch (e) {}
  }

  if (!images.length && (item.image_file_id || item.image_url)) {
    images.push({
      image_file_id: item.image_file_id || '',
      image_url: item.image_url || ''
    });
  }

  return images;
}

function findLocalMartyrById(martyrId) {
  return (dashboardData || []).find(x => x.martyr_id === martyrId)
    || (allMartyrs || []).find(x => x.martyr_id === martyrId)
    || null;
}

function hasOldMartyrImages(martyr) {
  if (!martyr) return false;
  return normalizeImages(martyr).length > 0;
}

function approveDataUpdateFromDashboard(requestId) {
  const item = (dataUpdateRequests || []).find(req => (req.update_id || req.request_id || '') === requestId);
  const newImages = getUpdateRequestImages(item);
  const martyr = item ? findLocalMartyrById(item.martyr_id) : null;

  if (item && newImages.length && hasOldMartyrImages(martyr)) {
    const hidden = document.getElementById('approveImageModeRequestId');
    if (hidden) hidden.value = requestId;

    const appendRadio = document.getElementById('approveImageAppend');
    if (appendRadio) appendRadio.checked = true;

    modals.approveImageModeModal?.show();
    return;
  }

  approveDataUpdateWithMode(requestId, 'append');
}

function confirmApproveDataUpdateWithImageMode() {
  const requestId = document.getElementById('approveImageModeRequestId')?.value || '';
  const mode = document.querySelector('input[name="approveImageMode"]:checked')?.value || 'append';

  modals.approveImageModeModal?.hide();
  approveDataUpdateWithMode(requestId, mode);
}

function approveDataUpdateWithMode(requestId, imageMode) {
  const btn = document.getElementById('approveImageModeConfirmBtn');
  const oldHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جار القبول...`;
  }

  showGlobalSpinner(true);

  apiRequest('approveDataUpdate', { updateId: requestId, requestId, imageMode })
    .then(res => {
      if (!res || !res.success) {
        showToast(res?.message || 'تعذر قبول الطلب.');
        return;
      }

      showToast(res.message || 'تم قبول البيانات المستكملة.');
      refreshDashboardData(false);
      loadInitialData();
    })
    .catch(err => {
      showToast(err.message || 'تعذر قبول الطلب. تأكد من تحديث Code.gs أيضًا.');
    })
    .finally(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml || 'قبول وإضافة';
      }
      hideGlobalSpinner();
    });
}

normalizeImages = function(item) {
  const images = [];

  if (Array.isArray(item?.images)) {
    item.images.forEach(img => {
      const src = img.image_file_id
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000`
        : (img.image_url || '');

      if (src) {
        images.push({
          src,
          image_id: img.image_id || '',
          image_file_id: img.image_file_id || '',
          image_url: img.image_url || '',
          is_primary: img.is_primary || '',
          source_type: img.source_type || ''
        });
      }
    });
  }

  const main = getImageSrc(item);

  if (main && !images.some(img => img.src === main)) {
    images.unshift({
      src: main,
      image_id: '',
      image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
      image_url: item?.image_url || ''
    });
  }

  return images;
};

renderImageGallery = function(item) {
  const images = normalizeImages(item);

  if (!images.length) {
    return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
  }

  if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;

  const first = images[currentGalleryIndex] || images[0];

  return `
    <div class="image-gallery">
      <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
      <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

      ${images.length > 1 ? `
        <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
          <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
          <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
          <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
        </div>
      ` : ''}

      ${isAdminLoggedIn ? `
        <div class="gallery-admin-tools">
          <div class="small text-muted fw-bold mb-2">
            <i class="fa-solid fa-user-shield ms-1"></i>
            إدارة صور الشهيد
          </div>
          <div class="gallery-thumb-row">
            ${images.map((img, index) => `
              <div class="gallery-thumb-item">
                <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>`;
};

function setGalleryImageIndex(index) {
  const images = normalizeImages(currentDetailsItem || {});
  if (!images.length) return;

  currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

  const img = document.getElementById('galleryMainImage');
  const counter = document.getElementById('galleryCounter');

  if (img) img.src = images[currentGalleryIndex].src;
  if (counter) counter.textContent = `${currentGalleryIndex + 1} / ${images.length}`;

  const holder = document.querySelector('#detailsContainer .col-lg-5');
  if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
}

changeGalleryImage = function(step) {
  const images = normalizeImages(currentDetailsItem || {});
  if (!images.length) return;

  currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

  const img = document.getElementById('galleryMainImage');
  const counter = document.getElementById('galleryCounter');

  if (img) img.src = images[currentGalleryIndex].src;
  if (counter) counter.textContent = `${currentGalleryIndex + 1} / ${images.length}`;

  const holder = document.querySelector('#detailsContainer .col-lg-5');
  if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
};

function deleteMartyrImageFromDetails(index) {
  if (!isAdminLoggedIn || !currentDetailsItem) return;

  const images = normalizeImages(currentDetailsItem);
  const img = images[index];

  if (!img) return;

  if (!confirm('هل تريد حذف هذه الصورة من صفحة الشهيد؟')) return;

  showGlobalSpinner(true);

  apiRequest('deleteMartyrImage', {
    martyrId: currentDetailsItem.martyr_id,
    martyr_id: currentDetailsItem.martyr_id,
    imageId: img.image_id || '',
    image_id: img.image_id || '',
    imageFileId: img.image_file_id || '',
    image_file_id: img.image_file_id || ''
  })
    .then(res => {
      if (!res || !res.success) {
        showToast(res?.message || 'تعذر حذف الصورة.');
        return;
      }

      showToast(res.message || 'تم حذف الصورة.');

      if (Array.isArray(currentDetailsItem.images)) {
        currentDetailsItem.images = currentDetailsItem.images.filter(old => {
          if (img.image_id && old.image_id === img.image_id) return false;
          if (img.image_file_id && old.image_file_id === img.image_file_id) return false;
          return true;
        });
      }

      if (img.image_file_id && currentDetailsItem.image_file_id === img.image_file_id) {
        const next = currentDetailsItem.images && currentDetailsItem.images[0] ? currentDetailsItem.images[0] : null;
        currentDetailsItem.image_file_id = next ? next.image_file_id : '';
        currentDetailsItem.image_url = next ? next.image_url : '';
      }

      currentGalleryIndex = 0;

      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);

      loadInitialData();
      if (isAdminLoggedIn) refreshDashboardData(false);
    })
    .catch(err => {
      showToast(err.message || 'تعذر حذف الصورة.');
    })
    .finally(() => {
      hideGlobalSpinner();
    });
}

function refreshCurrentSection() {
  const active = document.querySelector('.page-section.active')?.id || 'homePage';

  if (active === 'dashboardPage') {
    refreshDashboardData(true);
    return;
  }

  if (active === 'detailsPage' && currentDetailsItem) {
    showToast('جاري تحديث صفحة الشهيد...');
    const martyrId = currentDetailsItem.martyr_id;
    Promise.resolve(loadInitialData()).then(() => {
      setTimeout(() => openMartyrDetails(martyrId, lastPageBeforeDetails || 'homePage', true), 500);
    });
    return;
  }

  loadInitialData();
  showToast('تم تحديث البيانات.');
}

function addRefreshButtonsToSections() {
  const sections = [
    ['#familiesPage > .d-flex', 'تحديث'],
    ['#familyMartyrsPage > .d-flex', 'تحديث'],
    ['#detailsPage > .d-flex', 'تحديث'],
    ['#dashboardPage > .d-flex', 'تحديث']
  ];

  sections.forEach(([selector, label]) => {
    const row = document.querySelector(selector);
    if (!row || row.querySelector('.section-refresh-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary section-refresh-btn';
    btn.type = 'button';
    btn.innerHTML = `<i class="fa-solid fa-rotate ms-1"></i>${label}`;
    btn.onclick = refreshCurrentSection;

    row.appendChild(btn);
  });
}

onReady( () => {
  addRefreshButtonsToSections();
});




(function() {
  const NEW_MARTYRDOM_TYPES = [
    { value: 'تحت التعذيب', id: 'typeTorture' },
    { value: 'معتقل', id: 'typeDetained' },
    { value: 'مفقود', id: 'typeMissing' },
    // { value: 'زلزال تركيا', id: 'typeTurkeyEarthquake' }
  ];

  onReady( () => {
    ensureNewMartyrdomFields();
    ensureEditExtraFields();

    const el = document.getElementById('imagePositionModal');
    if (el && typeof bootstrap !== 'undefined') {
      modals.imagePositionModal = new bootstrap.Modal(el);
    }
  });

  function ensureNewMartyrdomFields() {
    const typeOther = document.getElementById('typeOther');
    const row = typeOther ? typeOther.closest('.d-flex') : null;

    if (row && !document.getElementById('typeTorture')) {
      NEW_MARTYRDOM_TYPES.forEach(item => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input" type="radio" name="martyrdom_type" value="${escapeAttr(item.value)}" id="${item.id}" required onchange="toggleCauseFields()">
          <label class="form-check-label" for="${item.id}">${escapeHtml(item.value)}</label>
        `;
        row.insertBefore(div, typeOther.closest('.form-check'));
      });
    }

    const otherBox = document.getElementById('otherCauseBox');
    if (otherBox && !document.getElementById('securityBranchBox')) {
      otherBox.insertAdjacentHTML('afterend', `
        <div class="col-md-6 d-none" id="securityBranchBox">
          <label class="form-label fw-bold">بيانات الفرع الأمني</label>
          <input type="text" class="form-control" name="security_branch" placeholder="اختياري">
        </div>
        <div class="col-md-6 d-none" id="lastSeenPlaceBox">
          <label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label>
          <input type="text" class="form-control" name="last_seen_place" placeholder="اختياري">
        </div>
      `);
    }
  }

  function ensureEditExtraFields() {
    const placeField = document.getElementById('edit_martyrdom_place');
    const holder = placeField ? placeField.closest('.col-md-6') : null;
    if (holder && !document.getElementById('edit_security_branch')) {
      holder.insertAdjacentHTML('afterend', `
        <div class="col-md-6"><label class="form-label fw-bold">بيانات الفرع الأمني</label><input class="form-control" id="edit_security_branch"></div>
        <div class="col-md-6"><label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label><input class="form-control" id="edit_last_seen_place"></div>
      `);
    }
  }

  window.toggleCauseFields = function() {
    const type = document.querySelector('input[name="martyrdom_type"]:checked')?.value || '';
    const battleBox = document.getElementById('battleNameBox');
    const otherBox = document.getElementById('otherCauseBox');
    const securityBox = document.getElementById('securityBranchBox');
    const lastSeenBox = document.getElementById('lastSeenPlaceBox');

    const battleInput = document.querySelector('[name="battle_name"]');
    const otherInput = document.querySelector('[name="other_cause"]');
    const securityInput = document.querySelector('[name="security_branch"]');
    const lastSeenInput = document.querySelector('[name="last_seen_place"]');

    if (battleBox) battleBox.classList.toggle('d-none', type !== 'المعارك');
    if (otherBox) otherBox.classList.toggle('d-none', type !== 'آخر');
    if (securityBox) securityBox.classList.toggle('d-none', !(type === 'تحت التعذيب' || type === 'معتقل'));
    if (lastSeenBox) lastSeenBox.classList.toggle('d-none', type !== 'مفقود');

    if (battleInput) battleInput.required = type === 'المعارك';
    if (otherInput) otherInput.required = type === 'آخر';
    if (securityInput) securityInput.required = false;
    if (lastSeenInput) lastSeenInput.required = false;

    if (battleInput && type !== 'المعارك') battleInput.value = '';
    if (otherInput && type !== 'آخر') otherInput.value = '';
    if (securityInput && !(type === 'تحت التعذيب' || type === 'معتقل')) securityInput.value = '';
    if (lastSeenInput && type !== 'مفقود') lastSeenInput.value = '';
  };

  function getImagePositionStyle(target) {
    const x = Number(target?.position_x || target?.image_position_x || 50);
    const y = Number(target?.position_y || target?.image_position_y || 50);
    const safeX = Math.max(0, Math.min(100, isNaN(x) ? 50 : x));
    const safeY = Math.max(0, Math.min(100, isNaN(y) ? 50 : y));
    return `object-position:${safeX}% ${safeY}%;`;
  }

  function getPrimaryPositionTarget(item) {
    const images = normalizeImages(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? "showPendingInfo()"
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
    const positionStyle = getImagePositionStyle(getPrimaryPositionTarget(item));

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>`;
  };

  window.renderMartyrCardForFamily = function(item) {
    const html = renderMartyrCard(item);
    return html.replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  const previousNormalizeImages = window.normalizeImages;
  window.normalizeImages = function(item) {
    const images = [];
    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000` : (img.image_url || '');
        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50'
          });
        }
      });
    }

    const main = getImageSrc(item);
    if (main && !images.some(img => img.src === main)) {
      images.unshift({
        src: main,
        image_id: '',
        image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
        image_url: item?.image_url || '',
        position_x: item?.image_position_x || '50',
        position_y: item?.image_position_y || '50'
      });
    }

    return images;
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImages(item);
    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImagePositionStyle(first);

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImagePositionStyle(img)} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImages(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImages(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;
    const images = normalizeImages(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionX').value = img.position_x || currentDetailsItem.image_position_x || '50';
    document.getElementById('imagePositionY').value = img.position_y || currentDetailsItem.image_position_y || '50';
    document.getElementById('imagePositionPreview').src = img.src;
    updateImagePositionPreview();
    modals.imagePositionModal.show();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;
    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    preview.style.objectPosition = `${x}% ${y}%`;
  };

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;
    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const positionX = document.getElementById('imagePositionX')?.value || '50';
    const positionY = document.getElementById('imagePositionY')?.value || '50';

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX,
      positionY
    }).then(res => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع الصورة.');

      const images = normalizeImages(currentDetailsItem);
      if (Array.isArray(currentDetailsItem.images) && images[index]) {
        currentDetailsItem.images = currentDetailsItem.images.map(old => {
          const sameId = imageId && old.image_id === imageId;
          const sameFile = imageFileId && old.image_file_id === imageFileId;
          return (sameId || sameFile) ? Object.assign({}, old, { position_x: positionX, position_y: positionY }) : old;
        });
      }
      if (!imageId || currentDetailsItem.image_file_id === imageFileId) {
        currentDetailsItem.image_position_x = positionX;
        currentDetailsItem.image_position_y = positionY;
      }

      modals.imagePositionModal.hide();
      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);
      showToast(res.message || 'تم ضبط موضع ظهور الصورة.');
      loadInitialData();
      if (isAdminLoggedIn) refreshDashboardData(false);
    }).catch(err => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      showToast(err.message || 'تعذر حفظ موضع الصورة.');
    });
  };

  window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
    const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
    const item = source.find(x => x.martyr_id === martyrId);
    if (!item) return;

    if (item.verification_status === 'بانتظار التوثيق' && !isAdminLoggedIn) {
      showPendingInfo();
      return;
    }

    currentDetailsItem = item;
    currentGalleryIndex = 0;
    lastPageBeforeDetails = fromPage || 'homePage';

    if (!noRoute) {
      let pageParam = 'home';
      let tabParam = '';
      if (fromPage === 'dashboardDataUpdatesTab') {
        pageParam = 'dashboard';
        tabParam = '&tab=dataUpdates';
      } else if (fromPage === 'dashboardJoinRequestsTab') {
        pageParam = 'dashboard';
        tabParam = '&tab=joinRequests';
      } else if (fromPage === 'dashboardPage') {
        pageParam = 'dashboard';
        tabParam = '&tab=martyrs';
      }
      updateRoute(`?page=${pageParam}${tabParam}&m=${encodeURIComponent(martyrId)}`, { page: 'details', martyrId, fromPage });
    }

    const canUpdate = isAllowUpdatesEnabled(item.allow_updates);

    document.getElementById('detailsContainer').innerHTML = `
      <div class="row g-4">
        <div class="col-lg-5">${renderImageGallery(item)}</div>
        <div class="col-lg-7">
          <div class="detail-box">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 class="fw-bold mb-1">${escapeHtml(item.full_name || '')} ${adminEditBtn('full_name')}</h2>
                <div class="text-muted">عائلة ${escapeHtml(item.family_name || '')} ${adminEditBtn('family_name')}</div>
              </div>
              ${statusBadge(item.verification_status)}
            </div>
            <div class="row g-3">
              ${detailItemEditable('اسم الأب', item.father_name, 'father_name')}
              ${detailItemEditable('المواليد', item.birth_year, 'birth_year')}
              ${detailItemEditable('اللقب', item.nickname, 'nickname')}
              ${detailItemEditable('استشهد بـ', item.martyrdom_type, 'martyrdom_type')}
              ${item.martyrdom_type === 'المعارك' ? detailItemEditable('اسم المعركة', item.battle_name, 'battle_name') : ''}
              ${item.martyrdom_type === 'آخر' ? detailItemEditable('السبب', item.other_cause, 'other_cause') : ''}
              ${(item.martyrdom_type === 'تحت التعذيب' || item.martyrdom_type === 'معتقل') ? detailItemEditable('بيانات الفرع الأمني', item.security_branch, 'security_branch') : ''}
              ${item.martyrdom_type === 'مفقود' ? detailItemEditable('آخر مكان شوهد فيه', item.last_seen_place, 'last_seen_place') : ''}
              ${detailItemEditable('تاريخ الاستشهاد', item.martyrdom_date, 'martyrdom_date')}
              ${detailItemEditable('مكان الاستشهاد', item.martyrdom_place, 'martyrdom_place')}
            </div>
            ${item.extra_info ? `<hr><h6 class="fw-bold">معلومات إضافية ${adminEditBtn('extra_info')}</h6><p class="lh-lg mb-0">${escapeHtml(item.extra_info)}</p>` : ''}
            ${item.completed_info ? `
              <div class="completed-info-box">
                <h6 class="fw-bold text-warning-emphasis mb-2"><i class="fa-solid fa-circle-info ms-1"></i> بيانات مستكملة</h6>
                <p class="lh-lg mb-0">${escapeHtml(item.completed_info)}</p>
              </div>` : ''}
            <div class="details-action-bar">
              <button class="btn btn-primary" onclick="shareMartyr('${escapeAttr(item.martyr_id)}')"><i class="fa-solid fa-share-nodes ms-1"></i> مشاركة</button>
              ${canUpdate ? `<button class="btn btn-warning" onclick="openDataUpdateModal('${escapeAttr(item.martyr_id)}', '${escapeAttr(item.full_name || '')}')"><i class="fa-solid fa-pen-to-square ms-1"></i> استكمال بيانات</button>` : ''}
            </div>
            ${isAdminLoggedIn ? renderAdminActions(item) : ''}
          </div>
        </div>
      </div>`;

    showPage('detailsPage');
  };

  window.renderAdminActions = function(item) {
    const allowChecked = isAllowUpdatesEnabled(item.allow_updates) ? 'checked' : '';
    const needsChecked = isNeedsCompletion(item) ? 'checked' : '';
    const status = item.verification_status || '';

    let buttons = '';
    if (status === 'موثق') {
      buttons = `<button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')"><i class="fa-solid fa-xmark ms-1"></i> تحويل لمرفوض</button>`;
    } else if (status === 'مرفوض') {
      buttons = `<button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')"><i class="fa-solid fa-check ms-1"></i> تحويل لموثق</button>`;
    } else {
      buttons = `
        <button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')"><i class="fa-solid fa-check ms-1"></i> توثيق</button>
        <button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')"><i class="fa-solid fa-xmark ms-1"></i> رفض</button>
      `;
    }

    return `
      <div class="admin-box mt-4">
        <h6 class="fw-bold mb-3"><i class="fa-solid fa-user-shield ms-1"></i> أدوات المراجعة</h6>
        <div class="row g-3">
          <div class="col-md-8"><textarea id="reviewerNotes" class="form-control" rows="2" placeholder="ملاحظات المراجع"></textarea></div>
          <div class="col-md-4 d-grid gap-2">${buttons}</div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="allowUpdatesSwitch" ${allowChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
              <label class="form-check-label fw-bold" for="allowUpdatesSwitch">إظهار زر استكمال البيانات</label>
            </div>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="needsCompletionSwitch" ${needsChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
              <label class="form-check-label fw-bold" for="needsCompletionSwitch">إظهار علامة يحتاج استكمال</label>
            </div>
          </div>
        </div>
      </div>`;
  };

  window.openEditMartyrModal = function(focusField) {
    if (!currentDetailsItem) return;
    ensureEditExtraFields();
    const fields = ['full_name','family_name','father_name','birth_year','nickname','martyrdom_type','battle_name','other_cause','security_branch','last_seen_place','martyrdom_date','martyrdom_place','extra_info'];
    document.getElementById('editMartyrId').value = currentDetailsItem.martyr_id;
    fields.forEach(field => {
      const el = document.getElementById('edit_' + field);
      if (el) el.value = currentDetailsItem[field] || '';
    });
    modals.editMartyrModal.show();
    setTimeout(() => document.getElementById('edit_' + focusField)?.focus(), 250);
  };

  window.saveMartyrEdits = function() {
    const fields = ['full_name','family_name','father_name','birth_year','nickname','martyrdom_type','battle_name','other_cause','security_branch','last_seen_place','martyrdom_date','martyrdom_place','extra_info'];
    const payload = { martyr_id: document.getElementById('editMartyrId').value };
    fields.forEach(field => payload[field] = document.getElementById('edit_' + field)?.value || '');

    const btn = document.getElementById('editMartyrSaveBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    apiRequest('updateMartyrFields', payload)
      .then(res => {
        btn.disabled = false;
        btn.innerHTML = 'حفظ التعديلات';
        if (!res.success) return showToast(res.message || 'تعذر الحفظ.');
        modals.editMartyrModal.hide();
        showToast(res.message || 'تم الحفظ.');
        refreshDashboardData(false);
        loadInitialData();
      })
      .catch(err => {
        btn.disabled = false;
        btn.innerHTML = 'حفظ التعديلات';
        showToast(err.message || 'تعذر الحفظ.');
      });
  };
})();



(function() {
  const OLD_SHOW_PAGE = window.showPage;

  window.__taldoKeepScroll = false;
  window.__imagePositionDraft = null;

  if (typeof OLD_SHOW_PAGE === 'function') {
    window.showPage = function(pageId) {
      if (!window.__taldoKeepScroll) {
        return OLD_SHOW_PAGE.apply(this, arguments);
      }

      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
      });

      document.getElementById(pageId)?.classList.add('active');
    };
  }

  function rememberScroll() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScroll(pos) {
    if (!pos) return;
    window.scrollTo(pos.x, pos.y);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 60);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 220);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 650);
  }

  function runWithoutScrollJump(work) {
    const pos = rememberScroll();
    window.__taldoKeepScroll = true;

    const done = () => {
      restoreScroll(pos);
      setTimeout(() => {
        window.__taldoKeepScroll = false;
        restoreScroll(pos);
      }, 700);
    };

    try {
      const result = work(pos);
      if (result && typeof result.finally === 'function') {
        return result.finally(done);
      }
      done();
      return result;
    } catch (error) {
      done();
      throw error;
    }
  }

  function normalizePosition(value, fallback) {
    const n = Number(value);
    if (Number.isNaN(n)) return String(fallback || 50);
    return String(Math.max(0, Math.min(100, Math.round(n))));
  }

function getPositionValue(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    
    // الحل: استخدام currentDetailsItem فقط في صفحة التفاصيل وليس في الصفحة الرئيسية
    const current = (mode === 'detail') ? (window.currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return normalizePosition(
        source[cardKey] ||
        source[oldMainKey] ||
        '50',
        50
      );
    }

    return normalizePosition(
      source[detailKey] ||
      current[detailKey] ||
      source[oldPositionKey] ||
      current[oldPositionKey] ||
      source[oldMainKey] ||
      current[oldMainKey] ||
      '50',
      50
    );
  }

  function getImagePositionStyleByMode(target, mode) {
    const x = getPositionValue(target, mode || 'detail', 'x');
    const y = getPositionValue(target, mode || 'detail', 'y');
    return `object-position:${x}% ${y}%;`;
  }

  function getPrimaryPositionTarget(item) {
    const images = normalizeImagesWithDualPositions(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  function normalizeImagesWithDualPositions(item) {
    const images = [];

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000`
          : (img.image_url || '');

        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50',
            card_position_x: img.card_position_x || item?.card_position_x || item?.image_position_x || '50',
            card_position_y: img.card_position_y || item?.card_position_y || item?.image_position_y || '50',
            detail_position_x: img.detail_position_x || img.position_x || item?.detail_position_x || item?.image_position_x || '50',
            detail_position_y: img.detail_position_y || img.position_y || item?.detail_position_y || item?.image_position_y || '50'
          });
        }
      });
    }

    const main = getImageSrc(item);
    if (main && !images.some(img => img.src === main)) {
      images.unshift({
        src: main,
        image_id: '',
        image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
        image_url: item?.image_url || '',
        position_x: item?.image_position_x || '50',
        position_y: item?.image_position_y || '50',
        card_position_x: item?.card_position_x || item?.image_position_x || '50',
        card_position_y: item?.card_position_y || item?.image_position_y || '50',
        detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
        detail_position_y: item?.detail_position_y || item?.image_position_y || '50'
      });
    }

    return images;
  }

  window.normalizeImages = normalizeImagesWithDualPositions;

  function ensureImagePositionTabs() {
    const modal = document.getElementById('imagePositionModal');
    if (!modal || document.getElementById('imagePositionMode')) return;

    const alert = modal.querySelector('.modal-body .alert');
    if (alert) {
      alert.innerHTML = 'هذا الضبط لا يقص الصورة الأصلية، بل يحدد الجزء الذي يظهر داخل الصورة. يمكنك ضبط عرض الصورة في الصفحة الرئيسية بشكل مستقل عن عرضها في الملف الشخصي للشهيد.';
      alert.insertAdjacentHTML('afterend', `
        <input type="hidden" id="imagePositionMode" value="card">
        <ul class="nav nav-pills image-position-tabs mb-3" role="tablist">
          <li class="nav-item" role="presentation">
            <button type="button" class="nav-link active" id="imagePositionTabCard" onclick="switchImagePositionMode('card')">
              <i class="fa-solid fa-table-cells-large ms-1"></i>
              الصورة في الصفحة الرئيسية
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button type="button" class="nav-link" id="imagePositionTabDetail" onclick="switchImagePositionMode('detail')">
              <i class="fa-solid fa-id-card ms-1"></i>
              الصورة في الملف الشخصي للشهيد
            </button>
          </li>
        </ul>
      `);
    }
  }

  function storeActivePositionInDraft() {
    const draft = window.__imagePositionDraft;
    if (!draft) return;

    const mode = document.getElementById('imagePositionMode')?.value || 'card';
    draft[mode] = {
      x: document.getElementById('imagePositionX')?.value || draft[mode]?.x || '50',
      y: document.getElementById('imagePositionY')?.value || draft[mode]?.y || '50'
    };
  }

  window.switchImagePositionMode = function(mode) {
    ensureImagePositionTabs();
    storeActivePositionInDraft();

    mode = mode === 'detail' ? 'detail' : 'card';
    const draft = window.__imagePositionDraft || { card: { x: '50', y: '50' }, detail: { x: '50', y: '50' } };

    document.getElementById('imagePositionMode').value = mode;
    document.getElementById('imagePositionTabCard')?.classList.toggle('active', mode === 'card');
    document.getElementById('imagePositionTabDetail')?.classList.toggle('active', mode === 'detail');

    const previewWrap = document.querySelector('#imagePositionModal .image-position-preview-wrap');
    if (previewWrap) {
      previewWrap.classList.toggle('image-position-card-preview', mode === 'card');
      previewWrap.classList.toggle('image-position-detail-preview', mode === 'detail');
    }

    document.getElementById('imagePositionX').value = draft[mode]?.x || '50';
    document.getElementById('imagePositionY').value = draft[mode]?.y || '50';
    updateImagePositionPreview();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;

    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    preview.style.objectPosition = `${x}% ${y}%`;

    storeActivePositionInDraft();
  };

window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? 'showPendingInfo()'
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
      
    // الحل: استخراج بيانات الصورة المستهدفة أولاً بدلاً من الاعتماد على العنصر الخام
    const targetImage = getPrimaryPositionTarget(item);
    const positionStyle = getImagePositionStyleByMode(targetImage, 'card');

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>`;
  };
  window.renderMartyrCardForFamily = function(item) {
    return renderMartyrCard(item).replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImagesWithDualPositions(item);
    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImagePositionStyleByMode(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImagePositionStyleByMode(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesWithDualPositions(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesWithDualPositions(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;
    ensureImagePositionTabs();

    const images = normalizeImagesWithDualPositions(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValue(img, 'card', 'x'),
        y: getPositionValue(img, 'card', 'y')
      },
      detail: {
        x: getPositionValue(img, 'detail', 'x'),
        y: getPositionValue(img, 'detail', 'y')
      }
    };

    switchImagePositionMode('card');
    modals.imagePositionModal.show();
  };

  function updateLocalImagePositions(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY) {
    if (!currentDetailsItem) return;

    if (Array.isArray(currentDetailsItem.images)) {
      currentDetailsItem.images = currentDetailsItem.images.map((old, oldIndex) => {
        const sameId = imageId && old.image_id === imageId;
        const sameFile = imageFileId && old.image_file_id === imageFileId;
        const sameIndex = !imageId && !imageFileId && oldIndex === index;
        return (sameId || sameFile || sameIndex)
          ? Object.assign({}, old, {
              card_position_x: cardPositionX,
              card_position_y: cardPositionY,
              detail_position_x: detailPositionX,
              detail_position_y: detailPositionY,
              position_x: detailPositionX,
              position_y: detailPositionY
            })
          : old;
      });
    }

    if (!imageFileId || currentDetailsItem.image_file_id === imageFileId) {
      currentDetailsItem.card_position_x = cardPositionX;
      currentDetailsItem.card_position_y = cardPositionY;
      currentDetailsItem.detail_position_x = detailPositionX;
      currentDetailsItem.detail_position_y = detailPositionY;
      currentDetailsItem.image_position_x = detailPositionX;
      currentDetailsItem.image_position_y = detailPositionY;
    }
  }

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;
    storeActivePositionInDraft();

    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const draft = window.__imagePositionDraft || { card: { x: '50', y: '50' }, detail: { x: '50', y: '50' } };

    const cardPositionX = draft.card?.x || '50';
    const cardPositionY = draft.card?.y || '50';
    const detailPositionX = draft.detail?.x || '50';
    const detailPositionY = draft.detail?.y || '50';

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    runWithoutScrollJump(() => apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX: detailPositionX,
      positionY: detailPositionY,
      cardPositionX,
      cardPositionY,
      detailPositionX,
      detailPositionY
    }).then(res => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع الصورة.');

      updateLocalImagePositions(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY);

      modals.imagePositionModal.hide();
      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);
      renderMartyrs();
      showToast(res.message || 'تم ضبط موضع ظهور الصورة.');

      setTimeout(() => {
        loadInitialData();
        if (isAdminLoggedIn) refreshDashboardData(false);
      }, 100);
    }).catch(err => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      showToast(err.message || 'تعذر حفظ موضع الصورة.');
    }));
  };

  function mutateMartyrStatusLocally(martyrId, status) {
    [allMartyrs, dashboardData].forEach(list => {
      if (!Array.isArray(list)) return;
      const item = list.find(x => x.martyr_id === martyrId);
      if (item) item.verification_status = status;
    });

    if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
      currentDetailsItem.verification_status = status;
    }
  }

  window.updateStatusFromDetails = function(martyrId, status) {
    const notes = document.getElementById('reviewerNotes')?.value || '';

    runWithoutScrollJump(() => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: notes
    }).then(res => {
      mutateMartyrStatusLocally(martyrId, status);
      showToast(res.message || 'تم تحديث الحالة.');

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'homePage', true);
      }

      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث الحالة.');
    }));
  };

  window.quickUpdateStatus = function(martyrId, status) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    runWithoutScrollJump(() => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: ''
    }).then(res => {
      mutateMartyrStatusLocally(martyrId, status);
      showToast(res.message || 'تم تحديث الحالة.');
      renderMartyrs();
      if (typeof renderDashboardTable === 'function') renderDashboardTable();
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث الحالة.');
    }));
  };

  window.saveCompletionSwitches = function(martyrId) {
    const allow = document.getElementById('allowUpdatesSwitch')?.checked ? 'نعم' : 'لا';
    const needs = document.getElementById('needsCompletionSwitch')?.checked ? 'نعم' : 'لا';

    runWithoutScrollJump(() => apiRequest('setMartyrCompletionOptions', {
      martyrId,
      allowUpdates: allow,
      needsCompletion: needs
    }).then(res => {
      [allMartyrs, dashboardData].forEach(list => {
        if (!Array.isArray(list)) return;
        const item = list.find(x => x.martyr_id === martyrId);
        if (item) {
          item.allow_updates = allow;
          item.needs_completion = needs;
        }
      });
      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        currentDetailsItem.allow_updates = allow;
        currentDetailsItem.needs_completion = needs;
      }
      showToast(res.message || 'تم حفظ الخيارات.');
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => showToast(err.message || 'تعذر حفظ الخيارات.')));
  };

  window.verifyWithCompletionQuick = function(martyrId) {
    runWithoutScrollJump(() => apiRequest('verifyMartyrWithCompletion', { martyrId }).then(() => {
      const item = dashboardData.find(x => x.martyr_id === martyrId) || allMartyrs.find(x => x.martyr_id === martyrId);
      if (item) {
        item.verification_status = 'موثق';
        item.needs_completion = 'نعم';
        item.allow_updates = 'نعم';
      }
      showToast('تم التوثيق مع الاستكمال');
      if (typeof renderDashboardTable === 'function') renderDashboardTable();
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => showToast(err.message || 'تعذر تحديث الحالة.')));
  };

  const oldRenderDashboardTable = window.renderDashboardTable;
  window.renderDashboardTable = function() {
    if (typeof oldRenderDashboardTable !== 'function') return;
    oldRenderDashboardTable();

    document.querySelectorAll("button[onclick*='verifyMartyrWithCompletion']").forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      const match = onclick.match(/martyrId:'([^']+)'/);
      if (match && match[1]) {
        btn.setAttribute('onclick', `verifyWithCompletionQuick('${match[1]}')`);
      }
    });
  };

  onReady( ensureImagePositionTabs);
})();



(function() {
  function isYesValue(value) {
    const text = String(value || '').trim().toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
    return ['نعم', 'yes', 'true', '1', 'مفعل', 'active'].includes(text);
  }

  function safeNumber(value, fallback, min, max, decimals) {
    const n = Number(value);
    const base = Number.isNaN(n) ? fallback : n;
    const clamped = Math.max(min, Math.min(max, base));
    const factor = Math.pow(10, decimals || 0);
    return String(Math.round(clamped * factor) / factor);
  }

  function getMartyrOptionsHtml(selectedId) {
    const map = new Map();

    (dashboardData || []).concat(allMartyrs || []).forEach(item => {
      if (!item || !item.martyr_id) return;
      map.set(item.martyr_id, item.full_name || item.martyr_id);
    });

    const options = ['<option value="">رسالة عامة غير مرتبطة بشهيد</option>'];

    Array.from(map.entries())
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar'))
      .forEach(([id, name]) => {
        options.push(`<option value="${escapeAttr(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(name)}</option>`);
      });

    return options.join('');
  }

  function ensureDynamicReplyUI() {
    const body = document.querySelector('#dynamicMessageModal .modal-body');
    if (!body || document.getElementById('dynamicReplyBox')) return;

    const oldButton = body.querySelector('button[onclick="acceptDynamicMessage()"]');

    const replyBox = document.createElement('div');
    replyBox.id = 'dynamicReplyBox';
    replyBox.className = 'dynamic-reply-box d-none mt-3';
    replyBox.innerHTML = `
      <div class="small text-muted mb-2" id="dynamicReplyLinkedText"></div>
      <div class="mb-2">
        <label class="form-label fw-bold">ردك على هذه الرسالة</label>
        <textarea class="form-control" id="dynamicReplyText" rows="4" placeholder="اكتب المعلومات المتوفرة لديك هنا..."></textarea>
      </div>
      <div class="mb-2">
        <label class="form-label fw-bold">إرفاق صورة إن وجدت</label>
        <input type="file" class="form-control" id="dynamicReplyImages" accept="image/*" multiple>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-primary w-50" id="dynamicReplySubmitBtn" onclick="submitDynamicMessageReply()">
          <i class="fa-solid fa-paper-plane ms-1"></i>
          إرسال الرد
        </button>
        <button class="btn btn-outline-secondary w-50" onclick="skipDynamicMessage()">
          تخطي
        </button>
      </div>
    `;

    if (oldButton) {
      oldButton.insertAdjacentElement('beforebegin', replyBox);
      oldButton.id = 'dynamicMessageOkBtn';
    } else {
      body.appendChild(replyBox);
    }
  }

  function canReplyToMessage(msg) {
    return !!msg && (String(msg.message_type || '') === 'question' || isYesValue(msg.allow_reply));
  }

  window.showDynamicMessage = function(msg, list) {
    ensureDynamicReplyUI();

    window.__currentDynamicMessage = msg;
    window.__dynamicMessageList = list || [];

    document.getElementById('dynamicMessageTitle').textContent = msg.title || 'رسالة';
    document.getElementById('dynamicMessageBody').textContent = msg.body || '';
    document.getElementById('dynamicDontShowAgain').checked = false;

    const imageWrap = document.getElementById('dynamicMessageImageWrap');
    const img = document.getElementById('dynamicMessageImage');
    const src = msg.image_file_id
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(msg.image_file_id)}&sz=w900`
      : (msg.image_url || '');

    if (src) {
      imageWrap.classList.remove('d-none');
      img.src = src;
    } else {
      imageWrap.classList.add('d-none');
      img.removeAttribute('src');
    }

    const replyBox = document.getElementById('dynamicReplyBox');
    const okBtn = document.getElementById('dynamicMessageOkBtn');
    const replyText = document.getElementById('dynamicReplyText');
    const replyImages = document.getElementById('dynamicReplyImages');
    const linkedText = document.getElementById('dynamicReplyLinkedText');

    if (replyText) replyText.value = '';
    if (replyImages) replyImages.value = '';

    if (canReplyToMessage(msg)) {
      replyBox?.classList.remove('d-none');
      if (okBtn) okBtn.classList.add('d-none');

      if (linkedText) {
        linkedText.innerHTML = msg.martyr_id
          ? `<span class="message-linked-badge"><i class="fa-solid fa-link"></i> هذا الرد سيرسل كاستكمال بيانات للشهيد: ${escapeHtml(msg.martyr_name || '')}</span>`
          : `<span class="message-linked-badge"><i class="fa-solid fa-message"></i> هذا الرد عام وسيظهر في لوحة الإعدادات ضمن ردود هذه الرسالة</span>`;
      }
    } else {
      replyBox?.classList.add('d-none');
      if (okBtn) okBtn.classList.remove('d-none');
    }

    modals.dynamicMessageModal.show();
  };

  window.skipDynamicMessage = function() {
    modals.dynamicMessageModal.hide();

    const list = window.__dynamicMessageList || [];
    currentDynamicMessageIndex++;
    if (list[currentDynamicMessageIndex]) {
      setTimeout(() => showDynamicMessage(list[currentDynamicMessageIndex], list), 350);
    }
  };

  window.acceptDynamicMessage = function() {
    const msg = window.__currentDynamicMessage;
    if (msg && document.getElementById('dynamicDontShowAgain')?.checked) {
      localStorage.setItem('taldo_msg_hidden_' + msg.message_id, '1');
    }

    skipDynamicMessage();
  };

  window.submitDynamicMessageReply = async function() {
    const msg = window.__currentDynamicMessage;
    if (!msg) return;

    const replyText = document.getElementById('dynamicReplyText')?.value.trim() || '';
    const files = document.getElementById('dynamicReplyImages')?.files || [];

    if (!replyText && !files.length) {
      showToast('يرجى كتابة الرد أو رفع صورة.');
      return;
    }

    const btn = document.getElementById('dynamicReplySubmitBtn');
    const oldHtml = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;
    }

    try {
      const payload = {
        message_id: msg.message_id,
        message_title: msg.title || '',
        martyr_id: msg.martyr_id || '',
        martyr_name: msg.martyr_name || '',
        reply_text: replyText,
        imageFiles: typeof filesToPayload === 'function' ? await filesToPayload(files) : []
      };

      const res = await apiRequest('submitMessageReply', payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر إرسال الرد.');
        return;
      }

      showToast(res.message || 'تم إرسال الرد بنجاح.');
      modals.dynamicMessageModal.hide();

      const list = window.__dynamicMessageList || [];
      currentDynamicMessageIndex++;
      if (list[currentDynamicMessageIndex]) {
        setTimeout(() => showDynamicMessage(list[currentDynamicMessageIndex], list), 450);
      }
    } catch (error) {
      showToast(error.message || 'تعذر إرسال الرد.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml || 'إرسال الرد';
      }
    }
  };

  window.addDashboardSettingsTab = function() {
    const tabs = document.querySelector('.dashboard-tabs');
    if (tabs && !document.getElementById('dashSettingsTabBtn')) {
      tabs.insertAdjacentHTML('beforeend', `
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="dashSettingsTabBtn" type="button" onclick="showDashboardTab('settings')">
            <i class="fa-solid fa-gear ms-1"></i>
            الإعدادات العامة
          </button>
        </li>`);
    }

    const dash = document.getElementById('dashboardPage');
    if (!dash) return;

    if (!document.getElementById('dashboardSettingsTab')) {
      dash.insertAdjacentHTML('beforeend', `<div id="dashboardSettingsTab" class="dashboard-tab-pane d-none"></div>`);
    }

    const settingsTab = document.getElementById('dashboardSettingsTab');
    if (!settingsTab || settingsTab.dataset.replyVersion === '1') return;

    settingsTab.dataset.replyVersion = '1';
    settingsTab.innerHTML = `
      <div class="settings-card">
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-bullhorn text-primary ms-1"></i> رسائل تظهر عند فتح الموقع</h5>

        <div class="alert alert-info">
          يمكن أن تكون الرسالة تنبيهًا عاديًا، أو سؤالًا قابلًا للرد. إذا ربطت السؤال بشهيد محدد فسيصل رد المستخدم إلى تبويب استكمال البيانات مميزًا بأنه من ردود المستخدمين.
        </div>

        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label fw-bold">العنوان</label>
            <input class="form-control" id="msgTitle">
          </div>

          <div class="col-md-2">
            <label class="form-label fw-bold">الترتيب</label>
            <input class="form-control" id="msgOrder" value="100">
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">الحالة</label>
            <select class="form-select" id="msgStatus">
              <option value="active">مفعل</option>
              <option value="inactive">غير مفعل</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">نوع الرسالة</label>
            <select class="form-select" id="msgType" onchange="handleMessageTypeChange()">
              <option value="notice">رسالة اطلاع فقط</option>
              <option value="question">رسالة يمكن الرد عليها</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label fw-bold">ربط الرسالة بشهيد</label>
            <select class="form-select" id="msgMartyrId">
              ${getMartyrOptionsHtml('')}
            </select>
            <div class="form-text">اتركها رسالة عامة إذا لم تكن مرتبطة بشهيد.</div>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">السماح بالرد</label>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="msgAllowReply">
              <label class="form-check-label" for="msgAllowReply">مفعل</label>
            </div>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">صورة مع الرسالة</label>
            <input type="file" class="form-control" id="msgImage" accept="image/*">
          </div>

          <div class="col-12">
            <label class="form-label fw-bold">نص الرسالة</label>
            <textarea class="form-control" id="msgBody" rows="4" placeholder="مثال: هل لديك معلومات عن مواليد الشهيد فلان؟"></textarea>
          </div>

          <div class="col-12">
            <button class="btn btn-primary" onclick="saveDashboardMessage()">
              <i class="fa-solid fa-floppy-disk ms-1"></i>
              حفظ الرسالة
            </button>
          </div>
        </div>

        <hr>
        <div id="messagesAdminList"></div>
      </div>

      <div class="settings-card">
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-primary ms-1"></i> نص من نحن</h5>
        <textarea class="form-control" id="aboutUsAdminText" rows="5"></textarea>
        <button class="btn btn-primary mt-3" onclick="saveAboutUsText()">حفظ نص من نحن</button>
      </div>`;
  };

  window.handleMessageTypeChange = function() {
    const type = document.getElementById('msgType')?.value || 'notice';
    const allow = document.getElementById('msgAllowReply');
    if (allow && type === 'question') allow.checked = true;
  };

  window.renderSettingsTab = function() {
    addDashboardSettingsTab();

    const messages = (window.__adminMessages || siteMessages || []);
    const replies = (window.__messageReplies || []);
    const list = document.getElementById('messagesAdminList');
    const about = document.getElementById('aboutUsAdminText');
    const martyrSelect = document.getElementById('msgMartyrId');

    if (about) about.value = publicSettings.about_us_text || '';
    if (martyrSelect) martyrSelect.innerHTML = getMartyrOptionsHtml(martyrSelect.value || '');

    if (!list) return;

    if (!messages.length) {
      list.innerHTML = '<div class="text-muted">لا توجد رسائل مخصصة بعد.</div>';
      return;
    }

    list.innerHTML = messages.map(msg => {
      const msgReplies = replies.filter(r => r.message_id === msg.message_id);
      const isLinked = !!msg.martyr_id;
      const canViewReplies = !isLinked && canReplyToMessage(msg);

      return `
        <div class="border rounded-4 p-3 mb-2">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div>
              <div class="fw-bold">${escapeHtml(msg.title || '')}</div>
              <div class="small text-muted">
                ${escapeHtml(msg.status || '')} - ترتيب: ${escapeHtml(msg.sort_order || '')}
                - النوع: ${String(msg.message_type || 'notice') === 'question' ? 'قابلة للرد' : 'اطلاع فقط'}
              </div>
              ${isLinked ? `
                <div class="mt-1">
                  <span class="message-linked-badge"><i class="fa-solid fa-link"></i> مرتبطة بالشهيد: ${escapeHtml(msg.martyr_name || msg.martyr_id || '')}</span>
                </div>
              ` : canReplyToMessage(msg) ? `
                <div class="mt-1">
                  <span class="message-linked-badge"><i class="fa-solid fa-message"></i> رسالة عامة قابلة للرد</span>
                </div>
              ` : ''}
            </div>
            <div class="d-flex gap-1 flex-wrap">
              ${canViewReplies ? `
                <button class="btn btn-sm btn-outline-success" onclick="toggleMessageReplies('${escapeAttr(msg.message_id)}')">
                  عرض الردود (${msgReplies.length})
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline-primary" onclick="toggleDashboardMessage('${escapeAttr(msg.message_id)}','${msg.status === 'active' ? 'inactive' : 'active'}')">
                ${msg.status === 'active' ? 'إلغاء التفعيل' : 'تفعيل'}
              </button>
            </div>
          </div>

          <div class="mt-2" style="white-space:pre-line">${escapeHtml(msg.body || '')}</div>

          <div id="messageReplies_${escapeAttr(msg.message_id)}" class="d-none mt-3">
            ${renderMessageRepliesHtml(msg.message_id)}
          </div>
        </div>`;
    }).join('');
  };

  window.renderMessageRepliesHtml = function(messageId) {
    const replies = (window.__messageReplies || []).filter(r => r.message_id === messageId);

    if (!replies.length) {
      return `<div class="text-muted small">لا توجد ردود على هذه الرسالة بعد.</div>`;
    }

    return replies.map(reply => {
      const img = reply.image_file_id
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(reply.image_file_id)}&sz=w700`
        : (reply.image_url || '');

      return `
        <div class="message-reply-card">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div class="fw-bold small">${escapeHtml(reply.created_at || '')}</div>
            <span class="badge text-bg-warning">${escapeHtml(reply.status || 'بانتظار المراجعة')}</span>
          </div>
          <div class="mt-2" style="white-space:pre-line">${escapeHtml(reply.reply_text || '')}</div>
          ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
        </div>`;
    }).join('');
  };

  window.toggleMessageReplies = function(messageId) {
    const box = document.getElementById('messageReplies_' + messageId);
    if (!box) return;

    box.innerHTML = renderMessageRepliesHtml(messageId);
    box.classList.toggle('d-none');
  };

  window.saveDashboardMessage = function() {
    const file = document.getElementById('msgImage')?.files?.[0];
    const martyrSelect = document.getElementById('msgMartyrId');
    const martyrId = martyrSelect?.value || '';
    const martyrName = martyrId ? (martyrSelect.options[martyrSelect.selectedIndex]?.text || '') : '';

    const payload = {
      title: document.getElementById('msgTitle')?.value || '',
      body: document.getElementById('msgBody')?.value || '',
      status: document.getElementById('msgStatus')?.value || 'active',
      sort_order: document.getElementById('msgOrder')?.value || '100',
      message_type: document.getElementById('msgType')?.value || 'notice',
      allow_reply: document.getElementById('msgAllowReply')?.checked ? 'نعم' : 'لا',
      martyr_id: martyrId,
      martyr_name: martyrName
    };

    const finish = () => apiRequest('saveSiteMessage', payload).then(res => {
      showToast(res.message || 'تم حفظ الرسالة.');

      ['msgTitle', 'msgBody'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      const msgOrder = document.getElementById('msgOrder');
      if (msgOrder) msgOrder.value = '100';

      const msgImage = document.getElementById('msgImage');
      if (msgImage) msgImage.value = '';

      const msgType = document.getElementById('msgType');
      if (msgType) msgType.value = 'notice';

      const msgAllow = document.getElementById('msgAllowReply');
      if (msgAllow) msgAllow.checked = false;

      const msgMartyr = document.getElementById('msgMartyrId');
      if (msgMartyr) msgMartyr.value = '';

      refreshDashboardData(false);
      loadInitialData();
    }).catch(err => showToast(err.message || 'تعذر الحفظ.'));

    if (file) {
      fileToBase64(file).then(base64 => {
        payload.imageBase64 = base64;
        payload.imageName = file.name;
        finish();
      });
    } else {
      finish();
    }
  };

  const previousRefreshDashboardDataForReplies = window.refreshDashboardData;
  window.refreshDashboardData = function(showMsg = true) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    apiRequest('getAdminDashboardData')
      .then(res => {
        if (!res || !res.success) {
          showToast('تعذر تحميل بيانات لوحة التحكم.');
          return;
        }

        statsData = res.stats || statsData;
        dashboardData = res.all || [];
        dataUpdateRequests = res.dataUpdates || [];
        joinRequests = res.joinRequests || [];
        window.__adminMessages = res.messages || [];
        window.__messageReplies = res.messageReplies || [];
        publicSettings = res.settings || publicSettings || {};

        updateStatsCards();
        updateDashboardStats();
        renderDashboardTable();
        renderDataUpdateRequestsTable();
        renderJoinRequestsTable();
        renderSettingsTab();

        if (showMsg) showToast('تم تحديث لوحة التحكم.');
      })
      .catch(err => {
        showToast(err.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
      });
  };

  window.renderDataUpdateRequestsTable = function() {
    const tbody = document.getElementById('dataUpdatesTableBody');
    const countBadge = document.getElementById('dataUpdatesCount');

    if (!tbody) return;

    const search = normalizeText(document.getElementById('dataUpdatesSearchInput')?.value || '');
    const statusFilter = document.getElementById('dataUpdatesStatusFilter')?.value ?? 'بانتظار المراجعة';
    const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

    let list = (dataUpdateRequests || []).slice();

    if (statusFilter) {
      list = list.filter(item => String(item.status || '').trim() === statusFilter);
    } else {
      list = list.filter(item => String(item.status || '').trim() !== '');
    }

    if (search) {
      list = list.filter(item => {
        const content = normalizeText([
          item.created_at,
          item.martyr_name,
          item.family_name,
          item.submitted_text,
          item.request_text,
          item.status,
          item.source_type === 'message_reply' ? 'من ردود المستخدمين' : ''
        ].join(' '));

        return content.includes(search);
      });
    }

    if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    } else if (sortBy === 'name') {
      list.sort((a, b) => String(a.martyr_name || '').localeCompare(String(b.martyr_name || ''), 'ar'));
    } else {
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    if (countBadge) countBadge.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            لا توجد طلبات مطابقة للبحث أو الفلترة الحالية.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const requestId = item.update_id || item.request_id || '';
      const requestText = item.submitted_text || item.request_text || '';
      const isFromUserReply = String(item.source_type || '') === 'message_reply';
      const img = item.image_file_id
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w500`
        : '';

      return `
        <tr>
          <td>${escapeHtml(item.created_at || '')}</td>
          <td class="fw-bold" style="cursor:pointer;color:#0d6efd;" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardDataUpdatesTab')">${escapeHtml(item.martyr_name || '')}</td>
          <td>${escapeHtml(item.family_name || '')}</td>
          <td class="request-text-cell">
            ${isFromUserReply ? `<div class="user-reply-source-badge"><i class="fa-solid fa-reply"></i> من ردود المستخدمين</div>` : ''}
            <div>${escapeHtml(requestText)}</div>
            ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
          </td>
          <td>${statusBadge(item.status)}</td>
          <td>
            ${isPendingRequest(item.status) ? `
              <div class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${escapeAttr(requestId)}')">قبول وإضافة</button>
                <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${escapeAttr(requestId)}')">رفض</button>
              </div>` : '-'}
          </td>
        </tr>`;
    }).join('');
  };

  function getPositionValueFinal(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return safeNumber(source[cardKey] || source[oldMainKey] || '50', 50, 0, 100, 0);
    }

    return safeNumber(
      source[detailKey] ||
      current[detailKey] ||
      source[oldPositionKey] ||
      current[oldPositionKey] ||
      source[oldMainKey] ||
      current[oldMainKey] ||
      '50',
      50,
      0,
      100,
      0
    );
  }

  function getZoomValueFinal(target, mode) {
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    if (mode === 'card') {
      return safeNumber(source.card_zoom || current.card_zoom || '1', 1, 1, 3, 2);
    }

    return safeNumber(source.detail_zoom || current.detail_zoom || source.card_zoom || current.card_zoom || '1', 1, 1, 3, 2);
  }

  function getImageStyleFinal(target, mode) {
    const x = getPositionValueFinal(target, mode, 'x');
    const y = getPositionValueFinal(target, mode, 'y');
    const zoom = getZoomValueFinal(target, mode);

    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  function normalizeImagesWithZoom(item) {
    const images = [];

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000`
          : (img.image_url || '');

        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50',
            card_position_x: img.card_position_x || item?.card_position_x || item?.image_position_x || '50',
            card_position_y: img.card_position_y || item?.card_position_y || item?.image_position_y || '50',
            detail_position_x: img.detail_position_x || img.position_x || item?.detail_position_x || item?.image_position_x || '50',
            detail_position_y: img.detail_position_y || img.position_y || item?.detail_position_y || item?.image_position_y || '50',
            card_zoom: img.card_zoom || item?.card_zoom || '1',
            detail_zoom: img.detail_zoom || item?.detail_zoom || '1'
          });
        }
      });
    }

    const main = getImageSrc(item);

    if (main && !images.some(img => img.src === main)) {
      images.unshift({
        src: main,
        image_id: '',
        image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
        image_url: item?.image_url || '',
        position_x: item?.image_position_x || '50',
        position_y: item?.image_position_y || '50',
        card_position_x: item?.card_position_x || item?.image_position_x || '50',
        card_position_y: item?.card_position_y || item?.image_position_y || '50',
        detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
        detail_position_y: item?.detail_position_y || item?.image_position_y || '50',
        card_zoom: item?.card_zoom || '1',
        detail_zoom: item?.detail_zoom || '1'
      });
    }

    return images;
  }

  window.normalizeImages = normalizeImagesWithZoom;

  function getPrimaryPositionTargetFinal(item) {
    const images = normalizeImagesWithZoom(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? 'showPendingInfo()'
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;

    const targetImage = getPrimaryPositionTargetFinal(item);
    const positionStyle = getImageStyleFinal(targetImage, 'card');

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>`;
  };

  window.renderMartyrCardForFamily = function(item) {
    return renderMartyrCard(item).replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  function ensureImagePositionTabsAndZoom() {
    const modal = document.getElementById('imagePositionModal');
    if (!modal) return;

    const alert = modal.querySelector('.modal-body .alert');
    if (alert) {
      alert.innerHTML = 'هذا الضبط لا يقص الصورة الأصلية، بل يحدد الجزء والحجم الذي يظهر داخل الصورة. يمكنك ضبط عرض الصورة في الصفحة الرئيسية بشكل مستقل عن عرضها في الملف الشخصي للشهيد.';

      if (!document.getElementById('imagePositionMode')) {
        alert.insertAdjacentHTML('afterend', `
          <input type="hidden" id="imagePositionMode" value="card">
          <ul class="nav nav-pills image-position-tabs mb-3" role="tablist">
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link active" id="imagePositionTabCard" onclick="switchImagePositionMode('card')">
                <i class="fa-solid fa-table-cells-large ms-1"></i>
                الصورة في الصفحة الرئيسية
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" id="imagePositionTabDetail" onclick="switchImagePositionMode('detail')">
                <i class="fa-solid fa-id-card ms-1"></i>
                الصورة في الملف الشخصي للشهيد
              </button>
            </li>
          </ul>
        `);
      }
    }

    const row = modal.querySelector('.modal-body .row.g-3');
    if (row && !document.getElementById('imagePositionZoom')) {
      row.insertAdjacentHTML('beforeend', `
        <div class="col-12">
          <label class="form-label fw-bold">تكبير / تصغير الصورة</label>
          <input type="range" class="form-range" id="imagePositionZoom" min="1" max="3" step="0.05" value="1" oninput="updateImagePositionPreview()">
          <div class="d-flex justify-content-between image-zoom-preview-note">
            <span>الحجم الطبيعي</span>
            <span id="imagePositionZoomValue">1.00x</span>
            <span>تكبير</span>
          </div>
        </div>
      `);
    }
  }

  function storeActivePositionInDraftFinal() {
    const draft = window.__imagePositionDraft;
    if (!draft) return;

    const mode = document.getElementById('imagePositionMode')?.value || 'card';

    draft[mode] = {
      x: document.getElementById('imagePositionX')?.value || draft[mode]?.x || '50',
      y: document.getElementById('imagePositionY')?.value || draft[mode]?.y || '50',
      zoom: document.getElementById('imagePositionZoom')?.value || draft[mode]?.zoom || '1'
    };
  }

  window.switchImagePositionMode = function(mode) {
    ensureImagePositionTabsAndZoom();
    storeActivePositionInDraftFinal();

    mode = mode === 'detail' ? 'detail' : 'card';
    const draft = window.__imagePositionDraft || {
      card: { x: '50', y: '50', zoom: '1' },
      detail: { x: '50', y: '50', zoom: '1' }
    };

    document.getElementById('imagePositionMode').value = mode;
    document.getElementById('imagePositionTabCard')?.classList.toggle('active', mode === 'card');
    document.getElementById('imagePositionTabDetail')?.classList.toggle('active', mode === 'detail');

    const previewWrap = document.querySelector('#imagePositionModal .image-position-preview-wrap');
    if (previewWrap) {
      previewWrap.classList.toggle('image-position-card-preview', mode === 'card');
      previewWrap.classList.toggle('image-position-detail-preview', mode === 'detail');
    }

    document.getElementById('imagePositionX').value = draft[mode]?.x || '50';
    document.getElementById('imagePositionY').value = draft[mode]?.y || '50';
    document.getElementById('imagePositionZoom').value = draft[mode]?.zoom || '1';

    updateImagePositionPreview();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;

    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    const zoom = safeNumber(document.getElementById('imagePositionZoom')?.value || '1', 1, 1, 3, 2);

    preview.style.objectPosition = `${x}% ${y}%`;
    preview.style.transform = `scale(${zoom})`;
    preview.style.transformOrigin = `${x}% ${y}%`;

    const zoomValue = document.getElementById('imagePositionZoomValue');
    if (zoomValue) zoomValue.textContent = `${Number(zoom).toFixed(2)}x`;

    storeActivePositionInDraftFinal();
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImagesWithZoom(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImageStyleFinal(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImageStyleFinal(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesWithZoom(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesWithZoom(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    ensureImagePositionTabsAndZoom();

    const images = normalizeImagesWithZoom(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValueFinal(img, 'card', 'x'),
        y: getPositionValueFinal(img, 'card', 'y'),
        zoom: getZoomValueFinal(img, 'card')
      },
      detail: {
        x: getPositionValueFinal(img, 'detail', 'x'),
        y: getPositionValueFinal(img, 'detail', 'y'),
        zoom: getZoomValueFinal(img, 'detail')
      }
    };

    switchImagePositionMode('card');
    modals.imagePositionModal.show();
  };

  function updateLocalImagePositionsAndZoom(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY, cardZoom, detailZoom) {
    if (!currentDetailsItem) return;

    if (Array.isArray(currentDetailsItem.images)) {
      currentDetailsItem.images = currentDetailsItem.images.map((old, oldIndex) => {
        const sameId = imageId && old.image_id === imageId;
        const sameFile = imageFileId && old.image_file_id === imageFileId;
        const sameIndex = !imageId && !imageFileId && oldIndex === index;

        return (sameId || sameFile || sameIndex)
          ? Object.assign({}, old, {
              card_position_x: cardPositionX,
              card_position_y: cardPositionY,
              detail_position_x: detailPositionX,
              detail_position_y: detailPositionY,
              position_x: detailPositionX,
              position_y: detailPositionY,
              card_zoom: cardZoom,
              detail_zoom: detailZoom
            })
          : old;
      });
    }

    if (!imageFileId || currentDetailsItem.image_file_id === imageFileId) {
      currentDetailsItem.card_position_x = cardPositionX;
      currentDetailsItem.card_position_y = cardPositionY;
      currentDetailsItem.detail_position_x = detailPositionX;
      currentDetailsItem.detail_position_y = detailPositionY;
      currentDetailsItem.image_position_x = detailPositionX;
      currentDetailsItem.image_position_y = detailPositionY;
      currentDetailsItem.card_zoom = cardZoom;
      currentDetailsItem.detail_zoom = detailZoom;
    }
  }

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;

    storeActivePositionInDraftFinal();

    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const draft = window.__imagePositionDraft || {
      card: { x: '50', y: '50', zoom: '1' },
      detail: { x: '50', y: '50', zoom: '1' }
    };

    const cardPositionX = draft.card?.x || '50';
    const cardPositionY = draft.card?.y || '50';
    const detailPositionX = draft.detail?.x || '50';
    const detailPositionY = draft.detail?.y || '50';
    const cardZoom = draft.card?.zoom || '1';
    const detailZoom = draft.detail?.zoom || '1';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;
    }

    const request = apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX: detailPositionX,
      positionY: detailPositionY,
      cardPositionX,
      cardPositionY,
      detailPositionX,
      detailPositionY,
      cardZoom,
      detailZoom
    }).then(res => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ موضع الصورة';
      }

      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع وحجم الصورة.');

      updateLocalImagePositionsAndZoom(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY, cardZoom, detailZoom);

      modals.imagePositionModal.hide();

      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);

      renderMartyrs();
      showToast(res.message || 'تم ضبط موضع وحجم ظهور الصورة.');

      setTimeout(() => {
        loadInitialData();
        if (isAdminLoggedIn) refreshDashboardData(false);
      }, 100);
    }).catch(err => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ موضع الصورة';
      }
      showToast(err.message || 'تعذر حفظ موضع وحجم الصورة.');
    });

    if (typeof runWithoutScrollJump === 'function') {
      return runWithoutScrollJump(() => request);
    }

    return request;
  };

  onReady( () => {
    ensureDynamicReplyUI();
    addDashboardSettingsTab();
    ensureImagePositionTabsAndZoom();
  });
})();



(function() {
  'use strict';

  const CACHE_PREFIX = 'taldo_api_cache_v5:';
  const CACHE_MAX_STALE = 7 * 24 * 60 * 60 * 1000;
  const PUBLIC_ACTION_TTL = {
    getInitialData: 10 * 60 * 1000,
    getMartyrsPublicData: 5 * 60 * 1000,
    getMartyrShareData: 30 * 60 * 1000
  };
  const MUTATING_ACTIONS = new Set([
    'submitMartyr',
    'updateVerificationStatus',
    'submitDataUpdate',
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
    'deleteMartyrImage',
    'updateMartyrImagePosition',
    'setHoulaMassacreStatus'
  ]);

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }

  function cacheKey(action, data) {
    return CACHE_PREFIX + action + ':' + stableStringify(data || {});
  }

  function readCache(action, data) {
    try {
      const raw = localStorage.getItem(cacheKey(action, data));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.value) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(action, data, value) {
    if (!PUBLIC_ACTION_TTL[action] || !value || value.success === false) return;
    try {
      localStorage.setItem(cacheKey(action, data), JSON.stringify({
        savedAt: Date.now(),
        value
      }));
    } catch (error) {
      // عند امتلاء التخزين المحلي نحذف كاش المشروع فقط ثم نحاول مرة واحدة.
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(key);
        });
        localStorage.setItem(cacheKey(action, data), JSON.stringify({
          savedAt: Date.now(),
          value
        }));
      } catch (ignored) {}
    }
  }

  function clearPublicClientCache() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(key);
      });
    } catch (error) {}
  }

  function dispatchCacheUpdate(action, data, value) {
    try {
      window.dispatchEvent(new CustomEvent('taldo:api-cache-updated', {
        detail: { action, data, value }
      }));
    } catch (error) {}
  }

  const networkApiRequest = window.apiRequest;
  if (typeof networkApiRequest === 'function' && !window.__taldoCachedApiInstalled) {
    window.__taldoCachedApiInstalled = true;

    window.apiRequest = function(action, data = {}, options = {}) {
      const ttl = PUBLIC_ACTION_TTL[action] || 0;
      const forceNetwork = options && options.forceNetwork;
      const now = Date.now();
      const mustBypassPublicEdge = ttl && window.__taldoBypassPublicCacheUntil && now < window.__taldoBypassPublicCacheUntil;
      const requestData = (forceNetwork || mustBypassPublicEdge)
        ? Object.assign({}, data || {}, { __cacheBust: String(window.__taldoBypassPublicCacheUntil || now) })
        : data;
      const cached = ttl && !forceNetwork && !mustBypassPublicEdge ? readCache(action, data) : null;

      if (cached) {
        const age = now - cached.savedAt;
        const isFresh = age < ttl;
        const isUsableStale = age < CACHE_MAX_STALE;

        if (isFresh) {
          return Promise.resolve(Object.assign({}, cached.value, {
            __fromClientCache: true,
            __cacheAge: age
          }));
        }

        if (isUsableStale) {
          networkApiRequest(action, requestData)
            .then(result => {
              writeCache(action, data, result);
              dispatchCacheUpdate(action, data, result);
            })
            .catch(() => {});
          return Promise.resolve(Object.assign({}, cached.value, {
            __fromClientCache: true,
            __stale: true,
            __cacheAge: age
          }));
        }
      }

      return networkApiRequest(action, requestData).then(result => {
        writeCache(action, data, result);
        if (MUTATING_ACTIONS.has(action) && result && result.success !== false) {
          clearPublicClientCache();
          window.__taldoBypassPublicCacheUntil = Date.now() + 90 * 1000;
        }
        return result;
      });
    };

    try {
      apiRequest = window.apiRequest;
    } catch (error) {}
  }

  function normalizeFast(value) {
    if (typeof normalizeText === 'function') return normalizeText(value || '');
    return String(value || '').toLowerCase().trim();
  }

  function prepareMartyrRecord(item) {
    if (!item || item.__perfPrepared) return item;
    const searchable = [
      item.full_name,
      item.family_name,
      item.father_name,
      item.nickname,
      item.martyrdom_place,
      item.martyrdom_date,
      item.martyrdom_type,
      item.extra_info
    ].join(' ');
    item.__searchText = normalizeFast(searchable);
    item.__familyKey = item.family_name || '';
    item.__createdSort = String(item.created_at || item.updated_at || '');
    item.__perfPrepared = true;
    return item;
  }

  function prepareInitialData(res) {
    if (!res || !res.success) return res;
    (res.martyrs || []).forEach(prepareMartyrRecord);
    return res;
  }

  function applyInitialData(res) {
    if (!res || !res.success) {
      showToast('تعذر تحميل البيانات.');
      return false;
    }

    prepareInitialData(res);

    allFamilies = res.families || [];
    statsData = res.stats || {};
    allMartyrs = res.martyrs || [];
    if (typeof siteMessages !== 'undefined') siteMessages = res.messages || [];
    if (typeof publicSettings !== 'undefined') publicSettings = res.settings || {};

    fillFamiliesSelects();
    updateStatsCards();
    renderMartyrs();

    const martyrFromUrl = typeof getMartyrIdFromUrl === 'function' ? getMartyrIdFromUrl() : '';
    if (martyrFromUrl) {
      setTimeout(() => openMartyrDetails(martyrFromUrl, 'homePage', true), 120);
    } else if (typeof applyRouteFromLocation === 'function') {
      setTimeout(() => applyRouteFromLocation(), 120);
    }

    if (!window.__taldoIntroChecked && typeof maybeShowIntroModal === 'function') {
      window.__taldoIntroChecked = true;
      setTimeout(() => maybeShowIntroModal(), 250);
    }

    return true;
  }

  if (typeof window.loadInitialData === 'function') {
    window.loadInitialData = function() {
      const loadingBox = document.getElementById('loadingBox');
      if (loadingBox) loadingBox.style.display = 'block';

      return apiRequest('getInitialData')
        .then(res => {
          const ok = applyInitialData(res);
          if (loadingBox) loadingBox.style.display = 'none';

          const container = document.getElementById('martyrsContainer');
          if (container && res && res.__fromClientCache) {
            let note = document.getElementById('perfCacheNote');
            if (!note) {
              note = document.createElement('div');
              note.id = 'perfCacheNote';
              note.className = 'perf-cache-note';
              container.parentNode.insertBefore(note, container);
            }
            note.textContent = res.__stale
              ? 'تم عرض نسخة محفوظة سريعًا، وسيتم تحديثها تلقائيًا عند توفر بيانات أحدث.'
              : 'تم تحميل البيانات بسرعة من الكاش.';
            setTimeout(() => { if (note) note.remove(); }, 3500);
          }

          return ok;
        })
        .catch(err => {
          if (loadingBox) loadingBox.style.display = 'none';
          showToast(err.message || 'حدث خطأ أثناء تحميل البيانات.');
          return false;
        });
    };

    try {
      loadInitialData = window.loadInitialData;
    } catch (error) {}
  }

  window.addEventListener('taldo:api-cache-updated', event => {
    const detail = event.detail || {};
    if (detail.action === 'getInitialData' && detail.value && detail.value.success) {
      applyInitialData(detail.value);
    }
  });

  function getResponsiveDriveImage(item, size) {
    if (!item) return '';
    const fileId = item.image_file_id || (typeof extractDriveFileId === 'function' ? extractDriveFileId(item.image_url) : '');
    if (fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 900}`;
    return item.image_url || '';
  }

  if (typeof window.getImageSrc === 'function') {
    window.getImageSrc = function(item, size) {
      return getResponsiveDriveImage(item, size || 900);
    };
    try {
      getImageSrc = window.getImageSrc;
    } catch (error) {}
  }

  function getCardImageSrc(item) {
    return getResponsiveDriveImage(item, window.innerWidth <= 576 ? 320 : 420);
  }

  function getPageSize() {
    if (window.innerWidth <= 576) return 24;
    if (window.innerWidth <= 992) return 36;
    return 42;
  }

  function sortListFast(list, sortBy) {
    list.sort((a, b) => {
      if (sortBy === 'family') return String(a.family_name || '').localeCompare(String(b.family_name || ''), 'ar');
      if (sortBy === 'newest') return String(b.__createdSort || '').localeCompare(String(a.__createdSort || ''));
      if (sortBy === 'oldest') return String(a.__createdSort || '').localeCompare(String(b.__createdSort || ''));
      return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
    });
  }

  function completionFilterMatches(item, completion) {
    if (!completion) return true;
    const needs = typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : String(item.needs_completion || '').trim() === 'نعم';
    return completion === 'needs' ? needs : !needs;
  }


  function renderMartyrsPaginationPerf(totalPages, totalItems, pageSize) {
    if (totalPages <= 1) return '';

    const pages = [];
    const start = Math.max(1, currentMartyrsPage - 2);
    const end = Math.min(totalPages, currentMartyrsPage + 2);

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
      const active = page === currentMartyrsPage ? 'btn-primary' : 'btn-outline-primary';
      return `<button class="btn ${active} page-btn" onclick="goToMartyrsPage(${page})">${page}</button>`;
    }).join('');

    const from = Math.min(totalItems, (currentMartyrsPage - 1) * pageSize + 1);
    const to = Math.min(totalItems, currentMartyrsPage * pageSize);

    return `
      <div class="martyrs-pagination">
        <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage - 1})" ${currentMartyrsPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        ${buttons}
        <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage + 1})" ${currentMartyrsPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small mt-1">
          عرض ${from} - ${to} من ${totalItems}
        </div>
      </div>`;
  }

  if (typeof window.renderMartyrs === 'function') {
    window.renderMartyrs = function(customList) {
      const container = document.getElementById('martyrsContainer');
      if (!container) return;

      const search = normalizeFast(document.getElementById('searchInput')?.value || '');
      const family = document.getElementById('familyFilter')?.value || '';
      const sortBy = document.getElementById('sortSelect')?.value || 'name';
      const completion = document.getElementById('completionFilter')?.value || '';
      const pageSize = getPageSize();

      let list = customList ? customList.slice() : allMartyrs.slice();
      list.forEach(prepareMartyrRecord);

      if (currentStatusFilter) {
        list = list.filter(item => item.verification_status === currentStatusFilter);
      }

      if (family) {
        list = list.filter(item => item.__familyKey === family);
      }

      if (completion) {
        list = list.filter(item => completionFilterMatches(item, completion));
      }

      if (search) {
        list = list.filter(item => item.__searchText && item.__searchText.includes(search));
      }

      sortListFast(list, sortBy);

      if (!list.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fa-regular fa-folder-open fa-2x mb-3 text-primary"></i>
            <h5 class="fw-bold">لا توجد نتائج</h5>
            <p class="mb-0">جرّب تغيير البحث أو الفلاتر.</p>
          </div>`;
        return;
      }

      const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
      if (currentMartyrsPage > totalPages) currentMartyrsPage = totalPages;
      if (currentMartyrsPage < 1) currentMartyrsPage = 1;

      const start = (currentMartyrsPage - 1) * pageSize;
      const pageList = list.slice(start, start + pageSize);

      const contentHtml = viewMode === 'cards'
        ? `<div class="martyrs-grid">${pageList.map((item, index) => renderMartyrCard(item, index)).join('')}</div>`
        : `<div>${pageList.map(renderMartyrListItem).join('')}</div>`;

      container.innerHTML = contentHtml + renderMartyrsPagination(totalPages, list.length);
    };

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (error) {}
  }


  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function getPrimaryPositionTargetPerf(item) {
    if (!item) return {};
    const images = typeof window.normalizeImages === 'function' ? window.normalizeImages(item) : [];
    const primary = images.find(img => String(img.is_primary || '').trim() === 'نعم');
    const byFile = images.find(img => img.image_file_id && img.image_file_id === item.image_file_id);
    return primary || byFile || images[0] || item || {};
  }

  function getImageStylePerf(target, mode) {
    const prefix = mode === 'card' ? 'card' : 'detail';
    const x = clampNumber(target?.[prefix + '_position_x'] || target?.position_x || target?.image_position_x || 50, 50, 0, 100);
    const y = clampNumber(target?.[prefix + '_position_y'] || target?.position_y || target?.image_position_y || 50, 50, 0, 100);
    const zoom = clampNumber(target?.[prefix + '_zoom'] || target?.image_zoom || 1, 1, 1, 3);
    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  if (typeof window.renderMartyrCard === 'function') {
    window.renderMartyrCard = function(item, index) {
      const verified = item.verification_status === 'موثق';
      const pending = item.verification_status === 'بانتظار التوثيق';
      const needsCompletion = typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : false;
      const img = getCardImageSrc(item);
      const clickAction = pending && !isAdminLoggedIn
        ? 'showPendingInfo()'
        : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
      const targetImage = getPrimaryPositionTargetPerf(item);
      const positionStyle = getImageStylePerf(targetImage, 'card');

      const priorityAttrs = Number(index || 0) < 4
        ? 'loading="eager" fetchpriority="high"'
        : 'loading="lazy" fetchpriority="low"';

      return `
        <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
          ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
            <div class="needs-completion-corner">يحتاج استكمال</div>
          ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
          <div class="martyr-image-wrap">
            ${img ? `
              <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" width="420" height="315" decoding="async" ${priorityAttrs} onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
            ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
          </div>
          <div class="martyr-body">
            <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
            <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
            ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
              <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
            ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
          </div>
        </div>`;
    };

    try {
      renderMartyrCard = window.renderMartyrCard;
    } catch (error) {}
  }

  if (typeof window.renderMartyrListItem === 'function') {
    const originalListItem = window.renderMartyrListItem;
    window.renderMartyrListItem = function(item) {
      prepareMartyrRecord(item);
      return originalListItem(item);
    };
    try {
      renderMartyrListItem = window.renderMartyrListItem;
    } catch (error) {}
  }

  function scheduleMartyrsRender() {
    clearTimeout(window.__taldoRenderTimer);
    window.__taldoRenderTimer = setTimeout(() => {
      currentMartyrsPage = 1;
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => renderMartyrs(), { timeout: 250 });
      } else {
        requestAnimationFrame(() => renderMartyrs());
      }
    }, 120);
  }

  window.scheduleMartyrsRender = scheduleMartyrsRender;

  onReady( () => {
    const search = document.getElementById('searchInput');
    const mobileSearch = document.getElementById('mobileSearchInput');
    const family = document.getElementById('familyFilter');
    const completion = document.getElementById('completionFilter');

    if (search) search.oninput = scheduleMartyrsRender;
    if (family) family.onchange = scheduleMartyrsRender;
    if (completion) completion.onchange = scheduleMartyrsRender;

    if (mobileSearch) {
      mobileSearch.oninput = function() {
        const target = document.getElementById('searchInput');
        if (target) target.value = mobileSearch.value || '';
        scheduleMartyrsRender();
      };
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.getElementById('homePage')?.classList.contains('active')) {
        renderMartyrs();
      }
    }, 180);
  }, { passive: true });

  window.TaldoPerformanceTools = {
    clearPublicClientCache,
    getPageSize
  };
})();



(function() {
  'use strict';

  const ADMIN_CACHE_KEY = 'taldo_admin_dashboard_cache_v2';
  const ADMIN_CACHE_TTL = 2 * 60 * 1000;
  const DASH_PAGE_SIZE_DESKTOP = 45;
  const DASH_PAGE_SIZE_MOBILE = 30;
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

  onReady( () => {
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



(function() {
  'use strict';

  const ADMIN_CACHE_KEY_V4 = 'taldo_admin_dashboard_cache_v2';
  const DASH_PAGE_SIZE_DESKTOP_V4 = 32;
  const DASH_PAGE_SIZE_MOBILE_V4 = 30;
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

  onReady( () => {
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



(function() {
  'use strict';

  function driveIdFromAny(value) {
    const text = String(value || '');
    if (!text) return '';

    let match = text.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    return '';
  }

  function galleryImageKey(input) {
    if (!input) return '';

    const fileId = driveIdFromAny(input.image_file_id || '') ||
      driveIdFromAny(input.image_url || '') ||
      driveIdFromAny(input.src || '');

    if (fileId) return 'drive:' + fileId;

    const rawUrl = String(input.image_url || input.src || '').trim();
    if (!rawUrl) return '';

    try {
      const url = new URL(rawUrl, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      return 'url:' + url.toString();
    } catch (e) {
      return 'url:' + rawUrl.replace(/([?&])(sz|width|height)=[^&]+/g, '$1').replace(/[?&]$/, '');
    }
  }

  function makeGalleryImageFromRow(img, item) {
    const fileId = driveIdFromAny(img?.image_file_id || '') || driveIdFromAny(img?.image_url || '');
    const src = fileId
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`
      : (img?.image_url || '');

    if (!src) return null;

    return {
      src,
      image_id: img?.image_id || '',
      image_file_id: img?.image_file_id || fileId || '',
      image_url: img?.image_url || '',
      is_primary: img?.is_primary || '',
      source_type: img?.source_type || '',
      position_x: img?.position_x || '50',
      position_y: img?.position_y || '50',
      card_position_x: img?.card_position_x || item?.card_position_x || item?.image_position_x || '50',
      card_position_y: img?.card_position_y || item?.card_position_y || item?.image_position_y || '50',
      detail_position_x: img?.detail_position_x || img?.position_x || item?.detail_position_x || item?.image_position_x || '50',
      detail_position_y: img?.detail_position_y || img?.position_y || item?.detail_position_y || item?.image_position_y || '50',
      card_zoom: img?.card_zoom || item?.card_zoom || '1',
      detail_zoom: img?.detail_zoom || item?.detail_zoom || '1'
    };
  }

  function makeMainGalleryImage(item) {
    const mainSrc = typeof getImageSrc === 'function' ? getImageSrc(item) : '';
    if (!mainSrc) return null;

    const fileId = item?.image_file_id || driveIdFromAny(item?.image_url || '') || driveIdFromAny(mainSrc);

    return {
      src: mainSrc,
      image_id: '',
      image_file_id: fileId || '',
      image_url: item?.image_url || '',
      is_primary: 'نعم',
      source_type: 'main',
      position_x: item?.image_position_x || '50',
      position_y: item?.image_position_y || '50',
      card_position_x: item?.card_position_x || item?.image_position_x || '50',
      card_position_y: item?.card_position_y || item?.image_position_y || '50',
      detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
      detail_position_y: item?.detail_position_y || item?.image_position_y || '50',
      card_zoom: item?.card_zoom || '1',
      detail_zoom: item?.detail_zoom || '1'
    };
  }

  function mergeImageData(existing, incoming) {
    if (!existing || !incoming) return existing || incoming;

    existing.image_id = existing.image_id || incoming.image_id || '';
    existing.image_file_id = existing.image_file_id || incoming.image_file_id || '';
    existing.image_url = existing.image_url || incoming.image_url || '';
    existing.is_primary = existing.is_primary || incoming.is_primary || '';
    existing.source_type = existing.source_type || incoming.source_type || '';

    existing.position_x = existing.position_x || incoming.position_x || '50';
    existing.position_y = existing.position_y || incoming.position_y || '50';
    existing.card_position_x = existing.card_position_x || incoming.card_position_x || '50';
    existing.card_position_y = existing.card_position_y || incoming.card_position_y || '50';
    existing.detail_position_x = existing.detail_position_x || incoming.detail_position_x || '50';
    existing.detail_position_y = existing.detail_position_y || incoming.detail_position_y || '50';
    existing.card_zoom = existing.card_zoom || incoming.card_zoom || '1';
    existing.detail_zoom = existing.detail_zoom || incoming.detail_zoom || '1';

    return existing;
  }

  function normalizeImagesDedupe(item) {
    const images = [];
    const seen = new Map();

    function pushUnique(image, preferFront) {
      if (!image || !image.src) return;

      const key = galleryImageKey(image);
      if (!key) return;

      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        mergeImageData(images[existingIndex], image);
        if (preferFront && existingIndex > 0) {
          const [existing] = images.splice(existingIndex, 1);
          images.unshift(existing);
          seen.clear();
          images.forEach((img, index) => seen.set(galleryImageKey(img), index));
        }
        return;
      }

      if (preferFront) {
        images.unshift(image);
        seen.clear();
        images.forEach((img, index) => seen.set(galleryImageKey(img), index));
      } else {
        seen.set(key, images.length);
        images.push(image);
      }
    }

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => pushUnique(makeGalleryImageFromRow(img, item), false));
    }

    const mainImage = makeMainGalleryImage(item);
    if (mainImage) pushUnique(mainImage, true);

    return images;
  }

  window.normalizeImages = normalizeImagesDedupe;
  window.normalizeImagesWithZoom = normalizeImagesDedupe;
  window.normalizeImagesWithDualPositions = normalizeImagesDedupe;

  try { normalizeImages = normalizeImagesDedupe; } catch (e) {}
  try { normalizeImagesWithZoom = normalizeImagesDedupe; } catch (e) {}
  try { normalizeImagesWithDualPositions = normalizeImagesDedupe; } catch (e) {}

  window.renderImageGallery = function(item) {
    const images = normalizeImagesDedupe(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (typeof currentGalleryIndex === 'undefined') window.currentGalleryIndex = 0;
    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = typeof getImageStyleFinal === 'function'
      ? getImageStyleFinal(first, 'detail')
      : '';

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${typeof getImageStyleFinal === 'function' ? getImageStyleFinal(img, 'detail') : ''} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesDedupe(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesDedupe(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}
})();



(function () {
  'use strict';

  function cleanValue(value) {
    return (value === undefined || value === null) ? '' : String(value).trim();
  }

  function driveIdFromAny(value) {
    const text = cleanValue(value);
    if (!text) return '';

    let match = text.match(/^[a-zA-Z0-9_-]{20,}$/);
    if (match) return text;

    match = text.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    return '';
  }

  function galleryImageKey(input) {
    if (!input) return '';

    const fileId =
      driveIdFromAny(input.image_file_id) ||
      driveIdFromAny(input.image_url) ||
      driveIdFromAny(input.src);

    if (fileId) return 'drive:' + fileId;

    const rawUrl = cleanValue(input.image_url || input.src);
    if (!rawUrl) return '';

    try {
      const url = new URL(rawUrl, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      return 'url:' + url.toString();
    } catch (e) {
      return 'url:' + rawUrl
        .replace(/([?&])(sz|width|height)=[^&]+/g, '$1')
        .replace(/[?&]$/, '');
    }
  }

  function driveThumb(fileId, size) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${size || 'w1000'}`;
  }

  function makeGalleryImageFromRow(img) {
    if (!img) return null;

    const fileId = driveIdFromAny(img.image_file_id) || driveIdFromAny(img.image_url);
    const src = fileId ? driveThumb(fileId, 'w1000') : cleanValue(img.image_url);
    if (!src) return null;

    return {
      src,
      image_id: cleanValue(img.image_id),
      image_file_id: cleanValue(img.image_file_id) || fileId,
      image_url: cleanValue(img.image_url),
      is_primary: cleanValue(img.is_primary),
      source_type: cleanValue(img.source_type) || 'gallery',

      // لا نضع 50 افتراضيًا هنا؛ حتى لا تطغى القيم الافتراضية على ضبط الملف الشخصي المحفوظ.
      position_x: cleanValue(img.position_x),
      position_y: cleanValue(img.position_y),
      card_position_x: cleanValue(img.card_position_x),
      card_position_y: cleanValue(img.card_position_y),
      detail_position_x: cleanValue(img.detail_position_x) || cleanValue(img.position_x),
      detail_position_y: cleanValue(img.detail_position_y) || cleanValue(img.position_y),
      card_zoom: cleanValue(img.card_zoom),
      detail_zoom: cleanValue(img.detail_zoom)
    };
  }

  function makeMainGalleryImage(item) {
    if (!item) return null;

    const mainSrc = (typeof getImageSrc === 'function') ? getImageSrc(item) : '';
    if (!mainSrc) return null;

    const fileId =
      cleanValue(item.image_file_id) ||
      driveIdFromAny(item.image_url) ||
      driveIdFromAny(mainSrc);

    return {
      src: mainSrc,
      image_id: '',
      image_file_id: fileId,
      image_url: cleanValue(item.image_url),
      is_primary: 'نعم',
      source_type: 'main',

      position_x: cleanValue(item.image_position_x),
      position_y: cleanValue(item.image_position_y),
      card_position_x: cleanValue(item.card_position_x) || cleanValue(item.image_position_x),
      card_position_y: cleanValue(item.card_position_y) || cleanValue(item.image_position_y),
      detail_position_x: cleanValue(item.detail_position_x) || cleanValue(item.image_position_x),
      detail_position_y: cleanValue(item.detail_position_y) || cleanValue(item.image_position_y),
      card_zoom: cleanValue(item.card_zoom),
      detail_zoom: cleanValue(item.detail_zoom)
    };
  }

  function mergePriorityField(existing, incoming, field, fallback) {
    const oldValue = cleanValue(existing[field]);
    const newValue = cleanValue(incoming[field]);
    const incomingIsMain = cleanValue(incoming.source_type) === 'main' || cleanValue(incoming.is_primary) === 'نعم';

    if (!newValue) return oldValue || fallback || '';

    // عند منع التكرار: الصورة الرئيسية هي المرجع الأصح لضبط صفحة الشهيد.
    if (incomingIsMain) return newValue;

    if (!oldValue) return newValue;
    if ((fallback !== undefined && oldValue === fallback) && newValue !== fallback) return newValue;

    return oldValue;
  }

  function mergeImageData(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    existing.image_id = cleanValue(existing.image_id) || cleanValue(incoming.image_id);
    existing.image_file_id = cleanValue(existing.image_file_id) || cleanValue(incoming.image_file_id);
    existing.image_url = cleanValue(existing.image_url) || cleanValue(incoming.image_url);
    existing.is_primary = cleanValue(existing.is_primary) || cleanValue(incoming.is_primary);
    existing.source_type = cleanValue(incoming.source_type) === 'main'
      ? 'main'
      : (cleanValue(existing.source_type) || cleanValue(incoming.source_type));

    existing.position_x = mergePriorityField(existing, incoming, 'position_x', '50');
    existing.position_y = mergePriorityField(existing, incoming, 'position_y', '50');
    existing.card_position_x = mergePriorityField(existing, incoming, 'card_position_x', '50');
    existing.card_position_y = mergePriorityField(existing, incoming, 'card_position_y', '50');
    existing.detail_position_x = mergePriorityField(existing, incoming, 'detail_position_x', '50');
    existing.detail_position_y = mergePriorityField(existing, incoming, 'detail_position_y', '50');
    existing.card_zoom = mergePriorityField(existing, incoming, 'card_zoom', '1');
    existing.detail_zoom = mergePriorityField(existing, incoming, 'detail_zoom', '1');

    return existing;
  }

  function normalizeImagesFixed(item) {
    const images = [];
    const seen = new Map();

    function reindex() {
      seen.clear();
      images.forEach((img, index) => seen.set(galleryImageKey(img), index));
    }

    function pushUnique(image, preferFront) {
      if (!image || !image.src) return;

      const key = galleryImageKey(image);
      if (!key) return;

      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        mergeImageData(images[existingIndex], image);

        if (preferFront && existingIndex > 0) {
          const merged = images.splice(existingIndex, 1)[0];
          images.unshift(merged);
          reindex();
        }

        return;
      }

      if (preferFront) {
        images.unshift(image);
        reindex();
      } else {
        seen.set(key, images.length);
        images.push(image);
      }
    }

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => pushUnique(makeGalleryImageFromRow(img), false));
    }

    const mainImage = makeMainGalleryImage(item);
    if (mainImage) pushUnique(mainImage, true);

    return images.map(img => ({
      ...img,
      position_x: cleanValue(img.position_x) || cleanValue(img.detail_position_x) || '50',
      position_y: cleanValue(img.position_y) || cleanValue(img.detail_position_y) || '50',
      card_position_x: cleanValue(img.card_position_x) || '50',
      card_position_y: cleanValue(img.card_position_y) || '50',
      detail_position_x: cleanValue(img.detail_position_x) || cleanValue(img.position_x) || '50',
      detail_position_y: cleanValue(img.detail_position_y) || cleanValue(img.position_y) || '50',
      card_zoom: cleanValue(img.card_zoom) || '1',
      detail_zoom: cleanValue(img.detail_zoom) || '1'
    }));
  }

  function safeNumberLocal(value, fallback, min, max, decimals) {
    const n = Number(value);
    const base = Number.isNaN(n) ? fallback : n;
    const clamped = Math.max(min, Math.min(max, base));
    const factor = Math.pow(10, decimals || 0);
    return String(Math.round(clamped * factor) / factor);
  }

  function getPositionValueFixed(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return safeNumberLocal(
        cleanValue(source[cardKey]) ||
        cleanValue(source[oldMainKey]) ||
        cleanValue(current[cardKey]) ||
        cleanValue(current[oldMainKey]) ||
        '50',
        50,
        0,
        100,
        0
      );
    }

    return safeNumberLocal(
      cleanValue(source[detailKey]) ||
      cleanValue(current[detailKey]) ||
      cleanValue(source[oldPositionKey]) ||
      cleanValue(current[oldPositionKey]) ||
      cleanValue(source[oldMainKey]) ||
      cleanValue(current[oldMainKey]) ||
      '50',
      50,
      0,
      100,
      0
    );
  }

  function getZoomValueFixed(target, mode) {
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    if (mode === 'card') {
      return safeNumberLocal(
        cleanValue(source.card_zoom) ||
        cleanValue(current.card_zoom) ||
        '1',
        1,
        1,
        3,
        2
      );
    }

    return safeNumberLocal(
      cleanValue(source.detail_zoom) ||
      cleanValue(current.detail_zoom) ||
      cleanValue(source.card_zoom) ||
      cleanValue(current.card_zoom) ||
      '1',
      1,
      1,
      3,
      2
    );
  }

  function getImageStyleFixed(target, mode) {
    const x = getPositionValueFixed(target, mode, 'x');
    const y = getPositionValueFixed(target, mode, 'y');
    const zoom = getZoomValueFixed(target, mode);

    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  window.normalizeImages = normalizeImagesFixed;
  window.normalizeImagesWithZoom = normalizeImagesFixed;
  window.normalizeImagesWithDualPositions = normalizeImagesFixed;
  window.getImageStyleFinalFixed = getImageStyleFixed;

  try { normalizeImages = normalizeImagesFixed; } catch (e) {}
  try { normalizeImagesWithZoom = normalizeImagesFixed; } catch (e) {}
  try { normalizeImagesWithDualPositions = normalizeImagesFixed; } catch (e) {}

  window.renderImageGallery = function(item) {
    const images = normalizeImagesFixed(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (typeof currentGalleryIndex === 'undefined') window.currentGalleryIndex = 0;
    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = getImageStyleFixed(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImageStyleFixed(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesFixed(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesFixed(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    if (typeof ensureImagePositionTabsAndZoom === 'function') {
      ensureImagePositionTabsAndZoom();
    }

    const images = normalizeImagesFixed(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValueFixed(img, 'card', 'x'),
        y: getPositionValueFixed(img, 'card', 'y'),
        zoom: getZoomValueFixed(img, 'card')
      },
      detail: {
        x: getPositionValueFixed(img, 'detail', 'x'),
        y: getPositionValueFixed(img, 'detail', 'y'),
        zoom: getZoomValueFixed(img, 'detail')
      }
    };

    if (typeof switchImagePositionMode === 'function') {
      switchImagePositionMode('card');
    }

    modals.imagePositionModal.show();
  };

  try { openImagePositionModal = window.openImagePositionModal; } catch (e) {}
})();



(function() {
  if (window.__taldoAdminActionScrollLockInstalled) return;
  window.__taldoAdminActionScrollLockInstalled = true;

  const nativeScrollTo = window.__taldoNativeScrollTo || window.scrollTo.bind(window);
  window.__taldoNativeScrollTo = nativeScrollTo;

  function getScrollPos() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function parseTop(args) {
    if (!args || !args.length) return null;
    const first = args[0];
    if (first && typeof first === 'object') {
      return Number(first.top ?? first.y ?? 0);
    }
    if (args.length > 1) return Number(args[1] || 0);
    return null;
  }

  function parseLeft(args) {
    if (!args || !args.length) return null;
    const first = args[0];
    if (first && typeof first === 'object') {
      return Number(first.left ?? first.x ?? 0);
    }
    return Number(args[0] || 0);
  }

  if (!window.__taldoScrollToGuardPatched) {
    window.__taldoScrollToGuardPatched = true;

    window.scrollTo = function() {
      const state = window.__taldoAdminScrollGuard;
      const top = parseTop(arguments);

      if (state && Date.now() < state.until && state.y > 40 && Number.isFinite(top) && top <= 2) {
        const left = parseLeft(arguments);
        nativeScrollTo(Number.isFinite(left) ? left : state.x, state.y);
        return;
      }

      return nativeScrollTo.apply(window, arguments);
    };
  }

  function restoreScroll(state) {
    if (!state) return;
    nativeScrollTo(state.x, state.y);
  }

  function extendGuard(state, ms) {
    if (!state) return;
    state.until = Math.max(state.until || 0, Date.now() + (ms || 900));
  }

  function startGuard(ms) {
    const existing = window.__taldoAdminScrollGuard;
    const pos = existing && Date.now() < existing.until ? existing : getScrollPos();

    // لا حاجة لقفل السكرول عندما تكون الصفحة أصلًا في الأعلى.
    // هذا يمنع المشكلة التي كانت تحدث عند فتح لوحة التحكم:
    // يبدأ تحميل البيانات، فيلتقط القفل y=0 ثم يعيد الصفحة للأعلى مع كل محاولة سكرول.
    if (!pos || (Number(pos.y) || 0) <= 40) {
      window.__taldoAdminScrollGuard = null;
      window.__taldoKeepScroll = false;
      return { state: null, finish: function() {} };
    }

    const state = {
      x: pos.x,
      y: pos.y,
      until: Date.now() + (ms || 3200),
      userCanceled: false
    };

    window.__taldoAdminScrollGuard = state;
    window.__taldoKeepScroll = true;

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body ? document.body.style : null;
    const oldHtmlScrollBehavior = htmlStyle.scrollBehavior;
    const oldBodyScrollBehavior = bodyStyle ? bodyStyle.scrollBehavior : '';

    htmlStyle.scrollBehavior = 'auto';
    if (bodyStyle) bodyStyle.scrollBehavior = 'auto';

    const restoreSchedule = [0, 40, 120, 260, 520, 900, 1400, 2200, 3200];
    restoreSchedule.forEach(delay => {
      setTimeout(() => {
        if (window.__taldoAdminScrollGuard === state && !state.userCanceled && Date.now() < state.until + 100) {
          restoreScroll(state);
        }
      }, delay);
    });

    const interval = setInterval(() => {
      if (window.__taldoAdminScrollGuard !== state || state.userCanceled || Date.now() > state.until) {
        clearInterval(interval);
        return;
      }
      restoreScroll(state);
    }, 180);

    const finish = function(extraMs) {
      if (!state || state.userCanceled) return;
      extendGuard(state, extraMs || 900);
      restoreScroll(state);

      setTimeout(() => {
        if (window.__taldoAdminScrollGuard === state && Date.now() >= state.until) {
          window.__taldoAdminScrollGuard = null;
          window.__taldoKeepScroll = false;
          htmlStyle.scrollBehavior = oldHtmlScrollBehavior;
          if (bodyStyle) bodyStyle.scrollBehavior = oldBodyScrollBehavior;
        }
      }, (extraMs || 900) + 80);
    };

    return { state, finish };
  }

  window.__taldoRunAdminActionWithoutScrollJump = function(work, holdMs) {
    const guard = startGuard(holdMs || 3600);

    try {
      const result = typeof work === 'function' ? work() : undefined;

      if (result && typeof result.finally === 'function') {
        return result.finally(() => guard.finish(1200));
      }

      guard.finish(2200);
      return result;
    } catch (error) {
      guard.finish(1200);
      throw error;
    }
  };


  function unwrapDashboardRefreshIfNeeded() {
    const fn = window.refreshDashboardData;
    if (typeof fn === 'function' && fn.__taldoNoScrollRefreshWrapped && typeof fn.__taldoOriginal === 'function') {
      window.refreshDashboardData = fn.__taldoOriginal;
      try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
    }
  }

  unwrapDashboardRefreshIfNeeded();
  onReady( unwrapDashboardRefreshIfNeeded);
  setTimeout(unwrapDashboardRefreshIfNeeded, 0);
  setTimeout(unwrapDashboardRefreshIfNeeded, 150);

  function cancelGuardBecauseUserScrolled() {
    const state = window.__taldoAdminScrollGuard;
    if (!state || Date.now() > state.until) return;

    state.userCanceled = true;
    state.until = 0;
    window.__taldoAdminScrollGuard = null;
    window.__taldoKeepScroll = false;
  }

  ['wheel', 'touchmove'].forEach(eventName => {
    window.addEventListener(eventName, cancelGuardBecauseUserScrolled, {
      passive: true,
      capture: true
    });
  });

  window.addEventListener('keydown', function(event) {
    const scrollKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'];
    if (scrollKeys.includes(event.key)) {
      cancelGuardBecauseUserScrolled();
    }
  }, true);

  function wrapFunction(name, holdMs) {
    const original = window[name];
    if (typeof original !== 'function' || original.__taldoNoScrollWrapped) return;

    const wrapped = function() {
      const args = arguments;
      const self = this;
      return window.__taldoRunAdminActionWithoutScrollJump(function() {
        return original.apply(self, args);
      }, holdMs || 4200);
    };

    wrapped.__taldoNoScrollWrapped = true;
    wrapped.__taldoOriginal = original;
    window[name] = wrapped;

    try {
      if (name in window) {
        eval(name + ' = window["' + name + '"];');
      }
    } catch (e) {}
  }

  [
    'quickUpdateStatus',
    'verifyWithCompletionQuick',
    'updateStatusFromDetails',
    'verifyWithCompletionFromDetails',
    'approveDataUpdateFromDashboard',
    'approveDataUpdateWithMode',
    'rejectDataUpdateFromDashboard',
    'updateDataRequestStatusFromDashboard',
    'updateJoinRequestStatusFromDashboard',
    'saveCompletionSwitches'
  ].forEach(name => wrapFunction(name, 4800));

  const originalRefreshDashboardData = window.refreshDashboardData;
  if (typeof originalRefreshDashboardData === 'function' && !originalRefreshDashboardData.__taldoNoScrollRefreshWrapped) {
    const wrappedRefresh = function() {
      const args = arguments;
      const self = this;
      const active = document.getElementById('dashboardPage')?.classList.contains('active');
      if (!active) return originalRefreshDashboardData.apply(self, args);

      return window.__taldoRunAdminActionWithoutScrollJump(function() {
        return originalRefreshDashboardData.apply(self, args);
      }, 5200);
    };
    wrappedRefresh.__taldoNoScrollRefreshWrapped = true;
    wrappedRefresh.__taldoOriginal = originalRefreshDashboardData;
    window.refreshDashboardData = wrappedRefresh;
    try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
  }

  const originalRenderDashboardTable = window.renderDashboardTable;
  if (typeof originalRenderDashboardTable === 'function' && !originalRenderDashboardTable.__taldoActionButtonTypeWrapped) {
    window.renderDashboardTable = function() {
      const result = originalRenderDashboardTable.apply(this, arguments);
      document.querySelectorAll('#dashboardPage button:not([type])').forEach(btn => {
        btn.setAttribute('type', 'button');
      });
      return result;
    };
    window.renderDashboardTable.__taldoActionButtonTypeWrapped = true;
    try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
  }

  document.addEventListener('click', function(event) {
    const btn = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!btn || !document.getElementById('dashboardPage')?.contains(btn)) return;

    const action = btn.getAttribute('onclick') || '';
    if (/quickUpdateStatus|verifyWithCompletion|approveDataUpdate|rejectDataUpdate|updateDataRequestStatus|updateJoinRequestStatus/.test(action)) {
      startGuard(2600);
    }
  }, true);
})();



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

  onReady( () => {
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



(function () {
  'use strict';

  function getCurrentDetailsItemSafe() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) {
        return currentDetailsItem;
      }
    } catch (e) {}

    try {
      if (window.currentDetailsItem) return window.currentDetailsItem;
    } catch (e) {}

    return {};
  }

  function getCurrentGalleryIndexSafe() {
    try {
      if (typeof currentGalleryIndex !== 'undefined') {
        const index = Number(currentGalleryIndex);
        return Number.isFinite(index) ? index : 0;
      }
    } catch (e) {}

    try {
      const index = Number(window.currentGalleryIndex);
      return Number.isFinite(index) ? index : 0;
    } catch (e) {}

    return 0;
  }

  function setCurrentGalleryIndexSafe(index) {
    const safeIndex = Math.max(0, Number(index) || 0);

    try { window.currentGalleryIndex = safeIndex; } catch (e) {}

    try {
      if (typeof currentGalleryIndex !== 'undefined') {
        currentGalleryIndex = safeIndex;
      }
    } catch (e) {}

    return safeIndex;
  }

  function getImagesForGallery(item) {
    const source = item || getCurrentDetailsItemSafe();

    try {
      if (typeof window.normalizeImages === 'function') return window.normalizeImages(source || {});
    } catch (e) {}

    try {
      if (typeof normalizeImages === 'function') return normalizeImages(source || {});
    } catch (e) {}

    return [];
  }

  function getFixedImageStyle(img, mode) {
    try {
      if (typeof window.getImageStyleFinalFixed === 'function') {
        return window.getImageStyleFinalFixed(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    try {
      if (typeof getImageStyleFinal === 'function') {
        return getImageStyleFinal(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    try {
      if (typeof getImageStyleFixed === 'function') {
        return getImageStyleFixed(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    return '';
  }

  function renderGalleryPlaceholder() {
    return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
  }

  function getGalleryHolder() {
    return document.querySelector('#detailsContainer .col-lg-5');
  }

  function rerenderGalleryOnly() {
    const holder = getGalleryHolder();
    if (!holder) return;
    holder.innerHTML = window.renderImageGallery(getCurrentDetailsItemSafe());
  }

  window.renderImageGallery = function(item) {
    const source = item || getCurrentDetailsItemSafe();
    const images = getImagesForGallery(source);

    if (!images.length) {
      setCurrentGalleryIndexSafe(0);
      return renderGalleryPlaceholder();
    }

    let activeIndex = getCurrentGalleryIndexSafe();
    if (activeIndex >= images.length) activeIndex = 0;
    activeIndex = setCurrentGalleryIndexSafe(activeIndex);

    const first = images[activeIndex] || images[0];
    const mainStyle = getFixedImageStyle(first, 'detail');

    return `
      <div class="image-gallery">
        <div class="gallery-main-frame">
          <img id="galleryMainImage"
               src="${escapeAttr(first.src)}"
               class="gallery-main-image detail-image"
               style="${mainStyle}"
               alt=""
               onerror="this.style.display='none';this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='grid';">
        </div>
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button type="button" class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${activeIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${activeIndex + 1} / ${images.length}</span>
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <button type="button" class="gallery-thumb-crop ${index === activeIndex ? 'is-active' : ''}" onclick="setGalleryImageIndex(${index})" aria-label="عرض الصورة ${index + 1}">
                    <img src="${escapeAttr(img.src)}" alt="" style="${getFixedImageStyle(img, 'detail')}">
                  </button>
                  <button type="button" class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="event.stopPropagation(); deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = getImagesForGallery(getCurrentDetailsItemSafe());
    if (!images.length) return;

    const currentIndex = getCurrentGalleryIndexSafe();
    const nextIndex = (currentIndex + Number(step || 0) + images.length) % images.length;
    setCurrentGalleryIndexSafe(nextIndex);
    rerenderGalleryOnly();
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = getImagesForGallery(getCurrentDetailsItemSafe());
    if (!images.length) return;

    const nextIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));
    setCurrentGalleryIndexSafe(nextIndex);
    rerenderGalleryOnly();
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}
})();



(function () {
  'use strict';

  function cleanText(value) {
    return String(value || '').trim();
  }

  function extractDriveIdSafe(value) {
    const text = cleanText(value);
    if (!text) return '';

    let match = text.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    // image_file_id قد يكون المعرّف الخام نفسه وليس رابطًا.
    if (/^[A-Za-z0-9_-]{15,}$/.test(text)) return text;

    return '';
  }

  function normalizedImageUrl(value) {
    const text = cleanText(value);
    if (!text) return '';

    try {
      const url = new URL(text, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      url.searchParams.delete('export');
      return url.toString().replace(/\/$/, '');
    } catch (error) {
      return text
        .replace(/([?&])(sz|width|height|export)=[^&]+/g, '$1')
        .replace(/[?&]$/, '')
        .replace(/\/$/, '');
    }
  }

  function imageIdentity(img) {
    const fileId =
      extractDriveIdSafe(img?.image_file_id) ||
      extractDriveIdSafe(img?.image_url) ||
      extractDriveIdSafe(img?.src);

    if (fileId) return 'drive:' + fileId;

    const url = normalizedImageUrl(img?.image_url || img?.src || '');
    return url ? 'url:' + url : '';
  }

  function getCurrentDetailsItemForDelete() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) return currentDetailsItem;
    } catch (error) {}

    return window.currentDetailsItem || null;
  }

  function getImagesForDelete(item) {
    try {
      if (typeof window.normalizeImages === 'function') return window.normalizeImages(item || {});
    } catch (error) {}

    try {
      if (typeof normalizeImages === 'function') return normalizeImages(item || {});
    } catch (error) {}

    return [];
  }

  function setCurrentGalleryIndexForDelete(index) {
    const safe = Math.max(0, Number(index) || 0);
    try { window.currentGalleryIndex = safe; } catch (error) {}
    try {
      if (typeof currentGalleryIndex !== 'undefined') currentGalleryIndex = safe;
    } catch (error) {}
  }

  function rerenderGalleryAfterDelete(item) {
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder && typeof window.renderImageGallery === 'function') {
      holder.innerHTML = window.renderImageGallery(item || {});
    }
  }

  window.deleteMartyrImageFromDetails = function(index) {
    if (!isAdminLoggedIn) return;

    const item = getCurrentDetailsItemForDelete();
    if (!item) return;

    const images = getImagesForDelete(item);
    const img = images[Math.max(0, Number(index) || 0)];

    if (!img) {
      showToast('لم يتم تحديد الصورة المطلوبة.');
      return;
    }

    const selectedFileId =
      extractDriveIdSafe(img.image_file_id) ||
      extractDriveIdSafe(img.image_url) ||
      extractDriveIdSafe(img.src);

    const selectedUrl = img.image_url || img.src || '';
    const selectedKey = imageIdentity(img);

    if (!selectedFileId && !selectedUrl && !img.image_id) {
      showToast('لا يوجد معرّف صالح لهذه الصورة.');
      return;
    }

    if (!confirm('هل تريد حذف هذه الصورة من صفحة الشهيد؟')) return;

    showGlobalSpinner(true);

    apiRequest('deleteMartyrImage', {
      martyrId: item.martyr_id,
      martyr_id: item.martyr_id,
      imageId: img.image_id || '',
      image_id: img.image_id || '',
      imageFileId: selectedFileId || img.image_file_id || '',
      image_file_id: selectedFileId || img.image_file_id || '',
      imageUrl: selectedUrl,
      image_url: selectedUrl,
      src: img.src || selectedUrl || '',
      source_type: img.source_type || '',
      is_primary: img.is_primary || ''
    })
      .then(res => {
        if (!res || !res.success) {
          showToast(res?.message || 'تعذر حذف الصورة.');
          return;
        }

        showToast(res.message || 'تم حذف الصورة.');

        if (Array.isArray(item.images)) {
          item.images = item.images.filter(old => imageIdentity(old) !== selectedKey);
        }

        const currentMainKey = imageIdentity({
          image_file_id: item.image_file_id || '',
          image_url: item.image_url || '',
          src: typeof getImageSrc === 'function' ? getImageSrc(item) : ''
        });

        if (selectedKey && currentMainKey === selectedKey) {
          const next = Array.isArray(item.images) && item.images.length ? item.images[0] : null;
          item.image_file_id = next ? (extractDriveIdSafe(next.image_file_id) || extractDriveIdSafe(next.image_url) || next.image_file_id || '') : '';
          item.image_url = next ? (next.image_url || next.src || '') : '';
          item.detail_position_x = next ? (next.detail_position_x || next.position_x || '50') : '50';
          item.detail_position_y = next ? (next.detail_position_y || next.position_y || '50') : '50';
          item.card_position_x = next ? (next.card_position_x || next.position_x || '50') : '50';
          item.card_position_y = next ? (next.card_position_y || next.position_y || '50') : '50';
          item.detail_zoom = next ? (next.detail_zoom || '1') : '1';
          item.card_zoom = next ? (next.card_zoom || '1') : '1';
        }

        setCurrentGalleryIndexForDelete(0);
        rerenderGalleryAfterDelete(item);

        Promise.resolve(loadInitialData()).catch(() => {});
        if (isAdminLoggedIn && typeof refreshDashboardData === 'function') {
          Promise.resolve(refreshDashboardData(false)).catch(() => {});
        }
      })
      .catch(err => {
        showToast(err.message || 'تعذر حذف الصورة.');
      })
      .finally(() => {
        hideGlobalSpinner();
      });
  };

  try { deleteMartyrImageFromDetails = window.deleteMartyrImageFromDetails; } catch (error) {}
})();



(function() {
  function featureNormalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function featureIsTruthy(value) {
    const normalized = featureNormalize(value);
    return ['نعم', 'yes', 'true', '1', 'يحتاج', 'needs', 'بحاجه لاستكمال', 'بحاجة لاستكمال'].includes(normalized);
  }

  function featureIsNeedsCompletion(item) {
    if (typeof isNeedsCompletion === 'function') return isNeedsCompletion(item);
    return featureIsTruthy(item && item.needs_completion);
  }

  function featureVisibleSource() {
    if (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) {
      return dashboardData;
    }
    return Array.isArray(allMartyrs) ? allMartyrs : [];
  }

  function featureCountNeedsByFamily(source) {
    const map = {};
    (source || []).forEach(item => {
      if (!item) return;
      if (String(item.verification_status || '').trim() === 'مرفوض') return;

      const family = item.family_name || 'غير محدد';
      if (!map[family]) {
        map[family] = {
          family_name: family,
          needs: 0,
          total_visible: 0
        };
      }

      map[family].total_visible++;

      if (featureIsNeedsCompletion(item)) {
        map[family].needs++;
      }
    });

    return map;
  }

  function featureBuildFamilyRows() {
    const source = featureVisibleSource();
    const needsMap = featureCountNeedsByFamily(source);
    const byFamily = Array.isArray(statsData && statsData.byFamily) ? statsData.byFamily : [];
    const familyMap = {};

    byFamily.forEach(item => {
      if (!item) return;
      const family = item.family_name || 'غير محدد';

      familyMap[family] = {
        family_name: family,
        verified: Number(item.verified || 0),
        pending: Number(item.pending || 0),
        rejected: Number(item.rejected || 0),
        total: Number(item.total || 0),
        needs: Number((needsMap[family] && needsMap[family].needs) || item.needs || item.needs_completion_count || 0)
      };
    });

    Object.keys(needsMap).forEach(family => {
      if (!familyMap[family]) {
        familyMap[family] = {
          family_name: family,
          verified: 0,
          pending: 0,
          rejected: 0,
          total: needsMap[family].total_visible || 0,
          needs: needsMap[family].needs || 0
        };
      }
    });

    return Object.values(familyMap).sort((a, b) => {
      if (Number(b.needs || 0) !== Number(a.needs || 0)) return Number(b.needs || 0) - Number(a.needs || 0);
      const aTotal = Number(a.verified || 0) + Number(a.pending || 0);
      const bTotal = Number(b.verified || 0) + Number(b.pending || 0);
      return bTotal - aTotal;
    });
  }

  window.openFamiliesStatsPage = function() {
    const container = document.getElementById('familiesStatsContainer');
    if (!container) return;

    const rows = featureBuildFamilyRows();
    container.innerHTML = '';

    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">لا توجد إحصائيات بعد.</div>`;
      showPage('familiesPage');
      return;
    }

    const totalNeeds = rows.reduce((sum, item) => sum + Number(item.needs || 0), 0);

    if (isAdminLoggedIn) {
      const summary = document.createElement('div');
      summary.className = 'family-needs-summary';
      summary.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div class="fw-bold">
            <i class="fa-solid fa-circle-exclamation text-warning ms-1"></i>
            إجمالي الأسماء التي تحتاج استكمالا
          </div>
          <span class="family-needs-badge">
            <i class="fa-solid fa-list-check"></i>
            المجموع: ${totalNeeds}
          </span>
        </div>
      `;
      container.appendChild(summary);
    }

    rows.forEach(item => {
      const verifiedCount = Number(item.verified || 0);
      const pendingCount = Number(item.pending || 0);
      const needsCount = Number(item.needs || 0);
      const visibleTotal = verifiedCount + pendingCount;

      const row = document.createElement('div');
      row.className = 'family-row';
      row.onclick = function() {
        openFamilyMartyrs(item.family_name);
      };

      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <h5 class="fw-bold mb-1">عائلة ${escapeHtml(item.family_name)}</h5>
            <div class="text-muted small">إجمالي الأسماء: ${visibleTotal}</div>
          </div>

          <div class="text-end d-flex align-items-center justify-content-end gap-1 flex-wrap">
            <span class="badge badge-soft-blue me-1">موثق: ${verifiedCount}</span>
            <span class="badge text-bg-warning me-1">بانتظار: ${pendingCount}</span>
            ${isAdminLoggedIn ? `
              <span class="family-needs-badge me-1">
                <i class="fa-solid fa-circle-exclamation"></i>
                يحتاج استكمال: ${needsCount}
              </span>
            ` : ''}
            <i class="fa-solid fa-chevron-left text-muted me-2"></i>
          </div>
        </div>
      `;

      container.appendChild(row);
    });

    showPage('familiesPage');
  };

  try { openFamiliesStatsPage = window.openFamiliesStatsPage; } catch (e) {}

  window.openFamilyMartyrs = function(familyName, noRoute) {
    const source = (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) ? dashboardData : allMartyrs;
    const list = (source || []).filter(item => item.family_name === familyName && item.verification_status !== 'مرفوض');
    const needsCount = list.filter(item => featureIsNeedsCompletion(item)).length;

    const title = document.getElementById('familyPageTitle');
    if (title) {
      title.innerHTML = `
        شهداء عائلة ${escapeHtml(familyName)}
        ${isAdminLoggedIn ? `<span class="badge text-bg-warning me-2">يحتاج استكمال: ${needsCount}</span>` : ''}
      `;
    }

    const container = document.getElementById('familyMartyrsContainer');
    if (container) {
      container.innerHTML = list.length
        ? `<div class="martyrs-grid">${list.map(renderMartyrCardForFamily).join('')}</div>`
        : `<div class="empty-state">لا توجد أسماء لهذه العائلة.</div>`;
    }

    if (!noRoute && typeof updateRoute === 'function') {
      updateRoute(`?family=${encodeURIComponent(familyName)}`, { page: 'family', family: familyName });
    }

    showPage('familyMartyrsPage');
  };

  try { openFamilyMartyrs = window.openFamilyMartyrs; } catch (e) {}

  function featureExtractDriveId(value) {
    if (!value) return '';
    if (typeof extractDriveIdSafe === 'function') return extractDriveIdSafe(value);
    if (typeof extractDriveFileId === 'function') return extractDriveFileId(value);

    const text = String(value || '');
    let match = text.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return match[1];

    match = text.match(/\/d\/([^/]+)/);
    if (match && match[1]) return match[1];

    match = text.match(/file\/d\/([^/]+)/);
    if (match && match[1]) return match[1];

    return '';
  }

  function featureImageKey(img) {
    if (!img) return '';
    if (typeof imageIdentity === 'function') return imageIdentity(img);

    return String(
      img.image_id ||
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      img.image_file_id ||
      img.image_url ||
      img.src ||
      ''
    );
  }

  function featureGetGalleryImages(item) {
    if (typeof normalizeImagesFixed === 'function') return normalizeImagesFixed(item || {});
    if (typeof normalizeImagesWithDualPositions === 'function') return normalizeImagesWithDualPositions(item || {});
    if (typeof normalizeImages === 'function') return normalizeImages(item || {});
    return [];
  }

  function featureGetImageStyle(img, mode) {
    if (typeof getImageStyleFixed === 'function') return getImageStyleFixed(img, mode || 'detail');
    if (typeof getImagePositionStyleByMode === 'function') return getImagePositionStyleByMode(img, mode || 'detail');
    if (typeof getImagePositionStyle === 'function') return getImagePositionStyle(img);
    return '';
  }

  function featureIsPrimaryImage(img, item) {
    if (!img) return false;

    if (featureIsTruthy(img.is_primary)) return true;

    const imgFileId =
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      String(img.image_file_id || '');

    const itemFileId =
      featureExtractDriveId(item && item.image_file_id) ||
      featureExtractDriveId(item && item.image_url) ||
      String((item && item.image_file_id) || '');

    if (imgFileId && itemFileId && imgFileId === itemFileId) return true;

    const imgUrl = String(img.image_url || img.src || '').trim();
    const itemUrl = String((item && item.image_url) || '').trim();

    return !!imgUrl && !!itemUrl && imgUrl === itemUrl;
  }

  function featureApplyPrimaryImageLocally(item, img) {
    if (!item || !img) return;

    const selectedFileId =
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      img.image_file_id ||
      '';

    item.image_file_id = selectedFileId || item.image_file_id || '';
    item.image_url = img.image_url || img.src || item.image_url || '';

    ['position_x', 'position_y', 'card_position_x', 'card_position_y', 'detail_position_x', 'detail_position_y', 'card_zoom', 'detail_zoom'].forEach(key => {
      if (img[key]) item[key] = img[key];
    });

    if (Array.isArray(item.images)) {
      const selectedKey = featureImageKey(img);
      item.images = item.images.map(old => {
        const copy = Object.assign({}, old);
        copy.is_primary = featureImageKey(copy) === selectedKey ? 'نعم' : 'لا';
        return copy;
      });
    }

    currentGalleryIndex = 0;
  }

  async function featureCallPrimaryImageApi(payload) {
    const actions = ['setPrimaryMartyrImage', 'setMartyrPrimaryImage', 'setPrimaryImage'];
    let lastResult = null;

    for (const action of actions) {
      try {
        const res = await apiRequest(action, payload);
        lastResult = res;

        const msg = String((res && res.message) || '');
        if (res && res.success) return res;

        if (!/إجراء غير معروف|unknown action|unknown/i.test(msg)) {
          return res;
        }
      } catch (error) {
        const msg = String(error && error.message || '');
        lastResult = { success: false, message: msg };
        if (!/إجراء غير معروف|unknown action|unknown/i.test(msg)) {
          throw error;
        }
      }
    }

    return lastResult || {
      success: false,
      message: 'واجهة التعيين جاهزة، لكن يلزم إضافة دالة setPrimaryMartyrImage في Code.gs لتثبيت الصورة الرئيسية.'
    };
  }

  window.setPrimaryMartyrImageFromDetails = async function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    const images = featureGetGalleryImages(currentDetailsItem);
    const safeIndex = Math.max(0, Number(index) || 0);
    const img = images[safeIndex];

    if (!img) {
      showToast('لم يتم تحديد الصورة المطلوبة.');
      return;
    }

    if (featureIsPrimaryImage(img, currentDetailsItem)) {
      showToast('هذه الصورة معيّنة كصورة رئيسية بالفعل.');
      return;
    }

    if (!confirm('هل تريد تعيين هذه الصورة كصورة رئيسية للشهيد؟')) return;

    const selectedFileId =
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      img.image_file_id ||
      '';

    const payload = {
      martyrId: currentDetailsItem.martyr_id,
      martyr_id: currentDetailsItem.martyr_id,
      imageId: img.image_id || '',
      image_id: img.image_id || '',
      imageFileId: selectedFileId || '',
      image_file_id: selectedFileId || '',
      imageUrl: img.image_url || img.src || '',
      image_url: img.image_url || img.src || '',
      src: img.src || img.image_url || ''
    };

    showGlobalSpinner(true);

    try {
      const res = await featureCallPrimaryImageApi(payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر تعيين الصورة الرئيسية.');
        return;
      }

      featureApplyPrimaryImageLocally(currentDetailsItem, img);

      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});

      showToast(res.message || 'تم تعيين الصورة الرئيسية بنجاح.');
      if (typeof refreshDashboardData === 'function') refreshDashboardData(false);
      if (typeof loadInitialData === 'function') loadInitialData();
    } catch (error) {
      showToast(error.message || 'تعذر تعيين الصورة الرئيسية.');
    } finally {
      hideGlobalSpinner();
    }
  };

  window.renderImageGallery = function(item) {
    const images = featureGetGalleryImages(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    if (currentGalleryIndex < 0) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = featureGetImageStyle(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn && typeof openImagePositionModal === 'function' ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2">
              <i class="fa-solid fa-user-shield ms-1"></i>
              إدارة صور الشهيد
            </div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => {
                const isPrimary = featureIsPrimaryImage(img, item || {});
                return `
                  <div class="gallery-thumb-item">
                    <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${featureGetImageStyle(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                    <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="event.stopPropagation(); deleteMartyrImageFromDetails(${index})">
                      <i class="fa-solid fa-xmark"></i>
                    </button>

                    ${isPrimary ? `
                      <span class="gallery-primary-badge" title="الصورة الرئيسية">
                        <i class="fa-solid fa-star"></i>
                        رئيسية
                      </span>
                    ` : `
                      <button class="btn btn-warning gallery-primary-btn" title="تعيين كصورة رئيسية" onclick="event.stopPropagation(); setPrimaryMartyrImageFromDetails(${index})">
                        <i class="fa-solid fa-star"></i>
                      </button>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = featureGetGalleryImages(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = featureGetGalleryImages(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + Number(step || 0) + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}
})();



(function() {
  const EDIT_EXTRA_TYPES = [
    { value: 'تحت التعذيب', id: 'editTypeTorture' },
    { value: 'معتقل', id: 'editTypeDetained' },
    { value: 'مفقود', id: 'editTypeMissing' }
  ];

  function safeEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeEscapeAttr(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);
    return safeEscapeHtml(value).replaceAll('`', '&#096;');
  }

  function removeOldVisibleEditExtraFields() {
    const oldSecurity = document.getElementById('edit_security_branch');
    if (oldSecurity && !oldSecurity.closest('#editSecurityBranchBox')) {
      const holder = oldSecurity.closest('.col-md-6') || oldSecurity.parentElement;
      if (holder) holder.remove();
    }

    const oldLastSeen = document.getElementById('edit_last_seen_place');
    if (oldLastSeen && !oldLastSeen.closest('#editLastSeenPlaceBox')) {
      const holder = oldLastSeen.closest('.col-md-6') || oldLastSeen.parentElement;
      if (holder) holder.remove();
    }
  }

  function ensureEditMartyrdomFieldsRestored() {
    const editTypeOther = document.getElementById('editTypeOther');
    const row = editTypeOther ? editTypeOther.closest('.d-flex') : null;

    if (row) {
      const otherWrapper = editTypeOther.closest('.form-check');

      EDIT_EXTRA_TYPES.forEach(item => {
        if (document.getElementById(item.id)) return;

        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input" type="radio" name="martyrdom_type" value="${safeEscapeAttr(item.value)}" id="${item.id}" required onchange="toggleEditCauseFields()">
          <label class="form-check-label" for="${item.id}">${safeEscapeHtml(item.value)}</label>
        `;

        if (otherWrapper) {
          row.insertBefore(div, otherWrapper);
        } else {
          row.appendChild(div);
        }
      });
    }

    removeOldVisibleEditExtraFields();

    const editOtherBox = document.getElementById('editOtherCauseBox');

    if (editOtherBox && !document.getElementById('editSecurityBranchBox')) {
      editOtherBox.insertAdjacentHTML('afterend', `
        <div class="col-md-6 d-none" id="editSecurityBranchBox">
          <label class="form-label fw-bold">بيانات الفرع الأمني</label>
          <input type="text" class="form-control" id="edit_security_branch" name="security_branch" placeholder="اختياري">
        </div>

        <div class="col-md-6 d-none" id="editLastSeenPlaceBox">
          <label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label>
          <input type="text" class="form-control" id="edit_last_seen_place" name="last_seen_place" placeholder="اختياري">
        </div>
      `);
    }

    const securityInput = document.getElementById('edit_security_branch');
    const lastSeenInput = document.getElementById('edit_last_seen_place');

    if (securityInput) securityInput.setAttribute('name', 'security_branch');
    if (lastSeenInput) lastSeenInput.setAttribute('name', 'last_seen_place');
  }

  window.ensureEditMartyrdomFieldsRestored = ensureEditMartyrdomFieldsRestored;

  window.toggleEditCauseFields = function(clearHiddenValues = true) {
    ensureEditMartyrdomFieldsRestored();

    const type = document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked')?.value || '';

    const battleBox = document.getElementById('editBattleNameBox');
    const otherBox = document.getElementById('editOtherCauseBox');
    const securityBox = document.getElementById('editSecurityBranchBox');
    const lastSeenBox = document.getElementById('editLastSeenPlaceBox');

    const battleInput = document.getElementById('edit_battle_name');
    const otherInput = document.getElementById('edit_other_cause');
    const securityInput = document.getElementById('edit_security_branch');
    const lastSeenInput = document.getElementById('edit_last_seen_place');

    if (battleBox) battleBox.classList.toggle('d-none', type !== 'المعارك');
    if (otherBox) otherBox.classList.toggle('d-none', type !== 'آخر');

    if (securityBox) {
      securityBox.classList.toggle('d-none', !(type === 'تحت التعذيب' || type === 'معتقل'));
    }

    if (lastSeenBox) {
      lastSeenBox.classList.toggle('d-none', type !== 'مفقود');
    }

    if (battleInput) battleInput.required = type === 'المعارك';
    if (otherInput) otherInput.required = type === 'آخر';
    if (securityInput) securityInput.required = false;
    if (lastSeenInput) lastSeenInput.required = false;

    if (clearHiddenValues) {
      if (battleInput && type !== 'المعارك') battleInput.value = '';
      if (otherInput && type !== 'آخر') otherInput.value = '';
      if (securityInput && !(type === 'تحت التعذيب' || type === 'معتقل')) securityInput.value = '';
      if (lastSeenInput && type !== 'مفقود') lastSeenInput.value = '';
    }
  };

  try { toggleEditCauseFields = window.toggleEditCauseFields; } catch (e) {}

  window.openEditMartyrModal = function(focusField) {
    if (!currentDetailsItem) return;

    ensureEditMartyrdomFieldsRestored();

    const form = document.getElementById('editMartyrForm');
    if (form) form.reset();

    const editImageInput = document.getElementById('editImageInput');
    if (editImageInput) editImageInput.value = '';

    const idInput = document.getElementById('editMartyrId');
    if (idInput) idInput.value = currentDetailsItem.martyr_id || '';

    const fields = [
      'full_name',
      'family_name',
      'father_name',
      'birth_year',
      'nickname',
      'battle_name',
      'other_cause',
      'security_branch',
      'last_seen_place',
      'martyrdom_date',
      'martyrdom_place',
      'extra_info'
    ];

    fields.forEach(field => {
      const el = document.getElementById('edit_' + field);
      if (el) el.value = currentDetailsItem[field] || '';
    });

    const martyrdomType = String(currentDetailsItem.martyrdom_type || '').trim();

    document
      .querySelectorAll('#editMartyrForm input[name="martyrdom_type"]')
      .forEach(radio => {
        radio.checked = radio.value === martyrdomType;
      });

    window.toggleEditCauseFields(false);

    const dropdown = document.getElementById('editFamilyDropdown');
    if (dropdown) dropdown.classList.add('d-none');

    if (modals && !modals.editMartyrModal) {
      const modalEl = document.getElementById('editMartyrModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        modals.editMartyrModal = new bootstrap.Modal(modalEl);
      }
    }

    modals.editMartyrModal?.show();

    setTimeout(() => {
      const focusTarget =
        document.getElementById('edit_' + focusField) ||
        document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked') ||
        document.getElementById('edit_full_name');

      focusTarget?.focus();
    }, 250);
  };

  try { openEditMartyrModal = window.openEditMartyrModal; } catch (e) {}

  window.saveMartyrEdits = async function() {
    ensureEditMartyrdomFieldsRestored();

    const form = document.getElementById('editMartyrForm');

    if (!form || !form.checkValidity()) {
      if (form) form.reportValidity();
      return;
    }

    const martyrId = document.getElementById('editMartyrId')?.value || '';

    const payload = {
      martyr_id: martyrId
    };

    const formData = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, formData);

    if (payload.martyrdom_type !== 'المعارك') {
      payload.battle_name = '';
    }

    if (payload.martyrdom_type !== 'آخر') {
      payload.other_cause = '';
    }

    if (!(payload.martyrdom_type === 'تحت التعذيب' || payload.martyrdom_type === 'معتقل')) {
      payload.security_branch = '';
    }

    if (payload.martyrdom_type !== 'مفقود') {
      payload.last_seen_place = '';
    }

    const imageInput = document.getElementById('editImageInput');

    try {
      if (imageInput && imageInput.files && imageInput.files.length && typeof filesToPayload === 'function') {
        payload.imageFiles = await filesToPayload(imageInput.files);
      }
    } catch (error) {
      showToast(error.message || 'تعذر قراءة الصورة.');
      return;
    }

    const btn = document.getElementById('editMartyrSaveBtn');
    const normalHtml = `<i class="fa-solid fa-floppy-disk ms-1"></i> حفظ التعديلات`;

    if (typeof setButtonLoading === 'function') {
      setButtonLoading(btn, true, 'جاري الحفظ...', normalHtml);
    } else if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;
    }

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        Object.assign(currentDetailsItem, payload, { updated_at: new Date().toISOString() });
      }

      if (typeof updateLocalMartyr === 'function') {
        updateLocalMartyr(martyrId, Object.assign({}, payload, { updated_at: new Date().toISOString() }));
      }

      if (typeof recomputeAndRenderAfterLocalMutation === 'function') {
        recomputeAndRenderAfterLocalMutation();
      }

      modals.editMartyrModal?.hide();
      showToast(res.message || 'تم حفظ التعديلات.');

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId && typeof openMartyrDetails === 'function') {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'dashboardPage', true);
      }

      if (typeof refreshAfterMutation === 'function') {
        refreshAfterMutation();
      } else {
        if (typeof refreshDashboardData === 'function') refreshDashboardData(false);
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
      if (typeof refreshDashboardData === 'function') {
        try { refreshDashboardData(false, { forceFresh: true, useClientCache: false }); } catch (e) { refreshDashboardData(false); }
      }
    } finally {
      if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, false, '', normalHtml);
      } else if (btn) {
        btn.disabled = false;
        btn.innerHTML = normalHtml;
      }
    }
  };

  try { saveMartyrEdits = window.saveMartyrEdits; } catch (e) {}

  onReady( ensureEditMartyrdomFieldsRestored);

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    ensureEditMartyrdomFieldsRestored();
  }
})();



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
            <div>
              <div class="stat-card-label">إحصائية الموثقين</div>
              <h3 class="fw-bold mb-0" id="verifiedCount">${verified}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="card stat-card h-100">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon bg-warning-subtle text-warning">
              <i class="fa-solid fa-clock"></i>
            </div>
            <div>
              <div class="stat-card-label">إحصائية بانتظار التوثق</div>
              <h3 class="fw-bold mb-0" id="pendingCount">${pending}</h3>
            </div>
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
            <div class="text-muted">
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

  onReady( () => {
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



(function() {
  'use strict';

  function hasOpenModal() {
    return !!document.querySelector('.modal.show');
  }

  function unlockPageScroll() {
    if (hasOpenModal()) return;

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (!hasOpenModal()) backdrop.remove();
    });
  }

  document.addEventListener('hidden.bs.modal', function() {
    setTimeout(unlockPageScroll, 80);
    setTimeout(unlockPageScroll, 250);
  });

  const previousShowPage = window.showPage || (typeof showPage === 'function' ? showPage : null);
  if (typeof previousShowPage === 'function' && !previousShowPage.__scrollUnlockFinal) {
    const wrapped = function(pageId) {
      previousShowPage(pageId);
      setTimeout(unlockPageScroll, 80);
      setTimeout(unlockPageScroll, 300);
    };
    wrapped.__scrollUnlockFinal = true;
    window.showPage = wrapped;
    try { showPage = window.showPage; } catch (e) {}
  }

  function syncCompactSearchInitialValue() {
    const mobile = document.getElementById('mobileSearchInput');
    const desktop = document.getElementById('searchInput');
    if (mobile && desktop && !mobile.value && desktop.value) mobile.value = desktop.value;
  }

  onReady( function() {
    syncCompactSearchInitialValue();
    setTimeout(unlockPageScroll, 300);
    setTimeout(unlockPageScroll, 1200);
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    syncCompactSearchInitialValue();
    setTimeout(unlockPageScroll, 100);
  }
})();



(function() {
  'use strict';

  const TRUE_VALUES = new Set([
    'نعم', 'yes', 'true', '1', 'مجزرة', 'مجزره', 'شهداء المجزرة', 'شهداء المجزره',
    'houla', 'hula', 'massacre', 'الحولة', 'الحوله'
  ]);

  function normalizeHoulaValue(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function isHoulaItem(item) {
    if (!item) return false;
    const raw = item.is_houla_massacre ?? item.houla_massacre ?? item.massacre_houla ?? item.houlaMassacre ?? '';
    return TRUE_VALUES.has(normalizeHoulaValue(raw));
  }

  function getHoulaOnlyList() {
    const source = (window.isAdminLoggedIn && Array.isArray(window.dashboardData) && window.dashboardData.length)
      ? window.dashboardData
      : (window.allMartyrs || []);

    return source.filter(item => {
      if (!item || !isHoulaItem(item)) return false;
      return String(item.verification_status || '').trim() !== 'مرفوض';
    });
  }

  function getHoulaFamiliesOnly() {
    const seen = new Set();
    const families = [];

    getHoulaOnlyList().forEach(item => {
      const family = String(item.family_name || '').trim();
      if (!family || seen.has(family)) return;
      seen.add(family);
      families.push(family);
    });

    return families.sort((a, b) => a.localeCompare(b, 'ar'));
  }

  function safeHtml(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeAttr(value) {
    if (typeof window.escapeAttr === 'function') return window.escapeAttr(value);
    return safeHtml(value).replaceAll('`', '&#096;');
  }

  function fillSelectWithHoulaFamilies(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return false;

    const oldValue = select.value || '';
    const families = getHoulaFamiliesOnly();
    select.innerHTML = ['<option value="">كل عوائل شهداء المجزرة</option>']
      .concat(families.map(family => `<option value="${safeAttr(family)}">${safeHtml(family)}</option>`))
      .join('');

    if (oldValue && families.includes(oldValue)) {
      select.value = oldValue;
      return false;
    }

    if (oldValue && !families.includes(oldValue)) {
      select.value = '';
      return true;
    }

    return false;
  }

  function syncHoulaCompactSearchFromHidden() {
    const compact = document.getElementById('houlaCompactSearchInput');
    const hidden = document.getElementById('houlaSearchInput');
    if (compact && hidden && compact.value !== hidden.value) {
      compact.value = hidden.value || '';
    }
  }

  function ensureHoulaCompactFilterModal() {
    if (document.getElementById('houlaCompactFilterModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="houlaCompactFilterModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header px-4 pt-4">
              <h5 class="modal-title fw-bold">
                <i class="fa-solid fa-filter text-danger ms-2"></i>
                خيارات شهداء المجزرة
              </h5>
              <button type="button" class="btn-close ms-0" data-bs-dismiss="modal"></button>
            </div>

            <div class="modal-body px-4">
              <div class="mb-3">
                <label class="form-label fw-bold">فلترة حسب العائلة</label>
                <select id="houlaCompactFamilyFilter" class="form-select"></select>
                <div class="form-text">تظهر هنا فقط العوائل التي لديها أسماء مصنفة ضمن شهداء المجزرة.</div>
              </div>

              <div class="mb-3">
                <label class="form-label fw-bold">الحالة</label>
                <select id="houlaCompactStatusFilter" class="form-select">
                  <option value="موثق">الأسماء الموثقة</option>
                  <option value="بانتظار التوثيق">أسماء بانتظار التوثق</option>
                  <option value="">الكل</option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label fw-bold">حالة الاستكمال</label>
                <select id="houlaCompactCompletionFilter" class="form-select">
                  <option value="">الكل</option>
                  <option value="needs">يحتاج استكمال</option>
                  <option value="complete">لا يحتاج استكمال</option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label fw-bold">الفرز</label>
                <select id="houlaCompactSortSelect" class="form-select">
                  <option value="name">أبجديًا حسب الاسم</option>
                  <option value="family">أبجديًا حسب العائلة</option>
                  <option value="newest">الأحدث رفعًا</option>
                  <option value="oldest">الأقدم رفعًا</option>
                </select>
              </div>

              <div>
                <label class="form-label fw-bold">طريقة العرض</label>
                <div class="btn-group w-100">
                  <button type="button" class="btn btn-outline-primary" onclick="setHoulaViewMode('cards')">
                    <i class="fa-solid fa-grip ms-1"></i>
                    بطاقات
                  </button>
                  <button type="button" class="btn btn-outline-primary" onclick="setHoulaViewMode('list')">
                    <i class="fa-solid fa-list ms-1"></i>
                    قائمة
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-footer px-4 pb-4">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button>
              <button class="btn btn-danger" onclick="applyHoulaCompactFilters()">تطبيق</button>
            </div>
          </div>
        </div>
      </div>
    `);

    if (window.bootstrap && window.bootstrap.Modal && window.modals) {
      const el = document.getElementById('houlaCompactFilterModal');
      window.modals.houlaCompactFilterModal = new bootstrap.Modal(el);
    }
  }

  function ensureHoulaCompactSearchBar() {
    const page = document.getElementById('houlaMassacrePage');
    if (!page) return;

    const legacyFilter = page.querySelector(':scope > .filter-card');
    if (legacyFilter) legacyFilter.classList.add('houla-legacy-filter-card');

    if (!document.getElementById('houlaCompactSearchBar')) {
      const anchor = legacyFilter || document.getElementById('houlaMassacreContainer');
      const bar = document.createElement('div');
      bar.id = 'houlaCompactSearchBar';
      bar.className = 'houla-compact-search-filter';
      bar.innerHTML = `
        <input type="search" id="houlaCompactSearchInput" class="form-control" placeholder="ابحث ضمن شهداء المجزرة...">
        <button class="btn btn-danger" type="button" onclick="openHoulaCompactFilterModal()" aria-label="فلترة شهداء المجزرة">
          <i class="fa-solid fa-filter"></i>
        </button>
      `;

      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(bar, anchor);
      } else {
        page.appendChild(bar);
      }

      const input = document.getElementById('houlaCompactSearchInput');
      input.addEventListener('input', function() {
        const hidden = document.getElementById('houlaSearchInput');
        if (hidden) hidden.value = input.value || '';
        if (typeof window.resetHoulaPageAndRender === 'function') window.resetHoulaPageAndRender();
      });
    }

    ensureHoulaCompactFilterModal();
    syncHoulaCompactSearchFromHidden();
    refreshHoulaFamilyFilters(false);
  }

  function refreshHoulaFamilyFilters(shouldRerender) {
    const hiddenChanged = fillSelectWithHoulaFamilies('houlaFamilyFilter');
    fillSelectWithHoulaFamilies('houlaCompactFamilyFilter');

    if (hiddenChanged && shouldRerender && typeof window.resetHoulaPageAndRender === 'function') {
      window.resetHoulaPageAndRender();
    }
  }

  window.openHoulaCompactFilterModal = function() {
    ensureHoulaCompactSearchBar();
    refreshHoulaFamilyFilters(false);

    const pairs = [
      ['houlaFamilyFilter', 'houlaCompactFamilyFilter'],
      ['houlaStatusFilter', 'houlaCompactStatusFilter'],
      ['houlaCompletionFilter', 'houlaCompactCompletionFilter'],
      ['houlaSortSelect', 'houlaCompactSortSelect']
    ];

    pairs.forEach(([sourceId, targetId]) => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (source && target) target.value = source.value || '';
    });

    if (window.modals && window.modals.houlaCompactFilterModal) {
      window.modals.houlaCompactFilterModal.show();
      return;
    }

    if (window.bootstrap && window.bootstrap.Modal) {
      const modal = new bootstrap.Modal(document.getElementById('houlaCompactFilterModal'));
      modal.show();
    }
  };

  window.applyHoulaCompactFilters = function() {
    const pairs = [
      ['houlaCompactFamilyFilter', 'houlaFamilyFilter'],
      ['houlaCompactStatusFilter', 'houlaStatusFilter'],
      ['houlaCompactCompletionFilter', 'houlaCompletionFilter'],
      ['houlaCompactSortSelect', 'houlaSortSelect']
    ];

    pairs.forEach(([sourceId, targetId]) => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (source && target) target.value = source.value || '';
    });

    if (window.modals && window.modals.houlaCompactFilterModal) {
      window.modals.houlaCompactFilterModal.hide();
    } else {
      const el = document.getElementById('houlaCompactFilterModal');
      if (window.bootstrap && window.bootstrap.Modal && el) bootstrap.Modal.getOrCreateInstance(el).hide();
    }

    if (typeof window.resetHoulaPageAndRender === 'function') window.resetHoulaPageAndRender();
  };

  const oldOpenHoulaPage = window.openHoulaMassacrePage;
  if (typeof oldOpenHoulaPage === 'function' && !oldOpenHoulaPage.__compactFilterWrapped) {
    const wrappedOpen = function(noRoute) {
      oldOpenHoulaPage(noRoute);
      setTimeout(function() {
        ensureHoulaCompactSearchBar();
        refreshHoulaFamilyFilters(true);
      }, 30);
    };
    wrappedOpen.__compactFilterWrapped = true;
    window.openHoulaMassacrePage = wrappedOpen;
    try { openHoulaMassacrePage = window.openHoulaMassacrePage; } catch (e) {}
  }

  const oldRenderHoula = window.renderHoulaMassacrePage;
  if (typeof oldRenderHoula === 'function' && !oldRenderHoula.__compactFilterWrapped) {
    const wrappedRender = function() {
      ensureHoulaCompactSearchBar();
      refreshHoulaFamilyFilters(false);
      oldRenderHoula();
      syncHoulaCompactSearchFromHidden();
    };
    wrappedRender.__compactFilterWrapped = true;
    window.renderHoulaMassacrePage = wrappedRender;
    try { renderHoulaMassacrePage = window.renderHoulaMassacrePage; } catch (e) {}
  }

  const oldSetHoulaMassacreForMartyr = window.setHoulaMassacreForMartyr;
  if (typeof oldSetHoulaMassacreForMartyr === 'function' && !oldSetHoulaMassacreForMartyr.__familyFilterWrapped) {
    window.setHoulaMassacreForMartyr = async function(martyrId, checked) {
      await oldSetHoulaMassacreForMartyr(martyrId, checked);
      setTimeout(function() {
        refreshHoulaFamilyFilters(true);
      }, 250);
    };
    window.setHoulaMassacreForMartyr.__familyFilterWrapped = true;
    try { setHoulaMassacreForMartyr = window.setHoulaMassacreForMartyr; } catch (e) {}
  }

  onReady( function() {
    setTimeout(function() {
      ensureHoulaCompactSearchBar();
      refreshHoulaFamilyFilters(false);
    }, 350);
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(function() {
      ensureHoulaCompactSearchBar();
      refreshHoulaFamilyFilters(false);
    }, 100);
  }
})();



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

  onReady( function() {
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



(function() {
  'use strict';

  function normalizeDashboardActionHeader() {
    const header = document.querySelector('#dashboardMartyrsTab table thead th:nth-child(6)');
    if (header) header.textContent = 'إجراء';
  }

  function ensureDashboardMobileActionButtons() {
    normalizeDashboardActionHeader();

    const rows = document.querySelectorAll('#dashboardMartyrsTab tbody tr');
    rows.forEach(row => {
      const lastCell = row.querySelector('td:nth-child(6)');
      if (!lastCell) return;

      const desktopActions = lastCell.querySelector('.dashboard-desktop-actions');
      const existingMobileBtn = lastCell.querySelector('.dashboard-mobile-action-btn');
      if (existingMobileBtn) return;

      const viewBtn = desktopActions ? desktopActions.querySelector('button[onclick*="openMartyrDetails"]') : null;
      const onclickText = viewBtn ? (viewBtn.getAttribute('onclick') || '') : '';
      const match = onclickText.match(/openMartyrDetails\('([^']+)'/);
      const martyrId = match && match[1] ? match[1] : '';
      if (!martyrId || typeof window.openDashboardActionModalFinal !== 'function') return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-primary dashboard-mobile-action-btn';
      btn.textContent = 'إجراء';
      btn.onclick = function(event) {
        window.openDashboardActionModalFinal(martyrId, event);
      };
      lastCell.appendChild(btn);
    });
  }

  const previousRenderDashboardTable = window.renderDashboardTable || (typeof renderDashboardTable === 'function' ? renderDashboardTable : null);
  if (typeof previousRenderDashboardTable === 'function' && !previousRenderDashboardTable.__actionScrollHotfixWrapped) {
    window.renderDashboardTable = function() {
      const result = previousRenderDashboardTable.apply(this, arguments);
      setTimeout(ensureDashboardMobileActionButtons, 0);
      return result;
    };
    window.renderDashboardTable.__actionScrollHotfixWrapped = true;
    try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
  }

  onReady( function() {
    ensureDashboardMobileActionButtons();
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(ensureDashboardMobileActionButtons, 100);
  }
})();



/* =========================================================
   FINAL MODULAR FIXES 2026-06-01
   ========================================================= */
(function() {
  'use strict';

  function safeLSGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeLSSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function tinyHash(text) {
    let hash = 0;
    const value = String(text || '');
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function messageStorageKey(msg) {
    const rawId = String(
      (msg && (msg.message_id || msg.messageId || msg.id)) ||
      ('msg_' + tinyHash([(msg && msg.title) || '', (msg && msg.body) || '', (msg && msg.created_at) || ''].join('|')))
    ).trim();

    return 'taldo_msg_hidden_' + rawId;
  }

  window.taldoMessageStorageKey = messageStorageKey;

  window.showNextDynamicMessage = function() {
    const messages = (siteMessages || []).filter(msg => {
      return safeLSGet(messageStorageKey(msg)) !== '1';
    });

    if (!messages.length) {
      const hidden = safeLSGet('taldo_martyrs_intro_hidden') === '1';
      if (!hidden && modals && modals.introModal) {
        setTimeout(() => modals.introModal.show(), 300);
      }
      return;
    }

    currentDynamicMessageIndex = 0;
    if (typeof showDynamicMessage === 'function') {
      showDynamicMessage(messages[currentDynamicMessageIndex], messages);
    }
  };

  window.acceptDynamicMessage = function() {
    const msg = window.__currentDynamicMessage;
    if (msg && document.getElementById('dynamicDontShowAgain')?.checked) {
      safeLSSet(messageStorageKey(msg), '1');
    }

    if (modals && modals.dynamicMessageModal) {
      modals.dynamicMessageModal.hide();
    }

    const originalList = window.__dynamicMessageList || [];
    const visibleList = originalList.filter(item => safeLSGet(messageStorageKey(item)) !== '1');

    currentDynamicMessageIndex++;
    if (visibleList[currentDynamicMessageIndex]) {
      setTimeout(() => showDynamicMessage(visibleList[currentDynamicMessageIndex], visibleList), 350);
    }
  };

  try { showNextDynamicMessage = window.showNextDynamicMessage; } catch (e) {}
  try { acceptDynamicMessage = window.acceptDynamicMessage; } catch (e) {}

  function updateStickyState() {
    const selectors = ['.desktop-filter-card', '.mobile-search-filter', '.dashboard-mobile-controls'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const rect = el.getBoundingClientRect();
        const stuck = rect.top <= 12 && rect.bottom > 0;
        el.classList.toggle('is-stuck', stuck);
      });
    });
  }

  window.addEventListener('scroll', updateStickyState, { passive: true });
  window.addEventListener('resize', updateStickyState, { passive: true });
  onReady(() => setTimeout(updateStickyState, 300));

  window.TaldoTheme = {
    apply(mode) {
      const dark = mode === 'dark';
      document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
      document.documentElement.classList.toggle('theme-dark', dark);
      document.documentElement.classList.toggle('theme-light', !dark);
      document.body.classList.toggle('theme-dark', dark);
      document.body.classList.toggle('theme-light', !dark);
      document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
      safeLSSet('taldo_theme_mode', dark ? 'dark' : 'light');
      const icon = document.querySelector('#themeToggleBtn i');
      if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      const btn = document.getElementById('themeToggleBtn');
      if (btn) {
        btn.title = dark ? 'الوضع النهاري' : 'الوضع الليلي';
        btn.setAttribute('aria-label', btn.title);
      }
    },
    toggle() {
      this.apply(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
    }
  };

  function installThemeToggle() {
    const bar = document.querySelector('.top-login-bar.header-inline-actions');
    if (!bar || document.getElementById('themeToggleBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    btn.className = 'btn btn-outline-light btn-sm admin-icon-btn theme-toggle-btn';
    btn.type = 'button';
    btn.onclick = function() { window.TaldoTheme.toggle(); };
    btn.innerHTML = '<i class="fa-solid fa-moon"></i><span class="admin-btn-text">تبديل النمط</span>';
    bar.appendChild(btn);

    window.TaldoTheme.apply(safeLSGet('taldo_theme_mode') || 'light');
  }

  onReady(() => {
    installThemeToggle();
    window.TaldoTheme.apply(safeLSGet('taldo_theme_mode') || 'light');
  });

  // After classifying Houla massacre martyr, force fresh reads in this session.
  const oldSetHoula = window.setHoulaMassacreForMartyr;
  if (typeof oldSetHoula === 'function') {
    window.setHoulaMassacreForMartyr = async function(martyrId, checked) {
      window.__taldoBypassPublicCacheUntil = Date.now() + 120 * 1000;
      try {
        await oldSetHoula.call(this, martyrId, checked);
      } finally {
        window.__taldoBypassPublicCacheUntil = Date.now() + 120 * 1000;
      }
    };
    try { setHoulaMassacreForMartyr = window.setHoulaMassacreForMartyr; } catch (e) {}
  }

  // Force 30 names per page in the mobile dashboard table even if older constants remain in older blocks.
  onReady(() => {
    if (typeof window.renderDashboardTable === 'function') {
      const oldRender = window.renderDashboardTable;
      window.renderDashboardTable = function() {
        const result = oldRender.apply(this, arguments);
        setTimeout(updateStickyState, 0);
        return result;
      };
      try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
    }
  });
})();

/* =========================================================
   TALDO FINAL UX FIXES v2026-06-01-04
   1) Sticky search JS fallback
   2) Mobile dashboard: only زر إجراء
   3) Houla family filters from actual Houla list
   4) Post-render safety hooks
   ========================================================= */
(function() {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function getGlobalArray(name) {
    try {
      if (name === 'allMartyrs' && typeof allMartyrs !== 'undefined' && Array.isArray(allMartyrs)) return allMartyrs;
      if (name === 'dashboardData' && typeof dashboardData !== 'undefined' && Array.isArray(dashboardData)) return dashboardData;
    } catch (e) {}
    return Array.isArray(window[name]) ? window[name] : [];
  }

  function getAdminFlag() {
    try { return !!isAdminLoggedIn; } catch (e) { return !!window.isAdminLoggedIn; }
  }

  function safeHtml(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeAttr(value) {
    if (typeof window.escapeAttr === 'function') return window.escapeAttr(value);
    return safeHtml(value).replaceAll('`', '&#096;');
  }

  /* ---------- 1) Sticky search fallback ---------- */
  const stickySelector = [
    '.desktop-filter-card',
    '.mobile-search-filter',
    '.houla-compact-search-filter',
    '.family-compact-search-filter',
    '.join-compact-search-filter',
    '.dashboard-mobile-controls'
  ].join(',');

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const page = el.closest('.page-section');
    if (page && !page.classList.contains('active')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getStickyTop() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--taldo-sticky-top').trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 8;
  }

  function ensurePlaceholder(el) {
    if (el.__taldoStickyPlaceholder && el.__taldoStickyPlaceholder.isConnected) return el.__taldoStickyPlaceholder;
    const ph = document.createElement('div');
    ph.className = 'taldo-sticky-placeholder';
    el.parentNode.insertBefore(ph, el);
    el.__taldoStickyPlaceholder = ph;
    return ph;
  }

  function releaseFixed(el) {
    if (!el) return;
    const ph = el.__taldoStickyPlaceholder;
    el.classList.remove('taldo-fixed-search', 'is-stuck');
    el.style.removeProperty('left');
    el.style.removeProperty('right');
    el.style.removeProperty('width');
    el.style.removeProperty('top');
    if (ph) {
      ph.classList.remove('is-active');
      ph.style.removeProperty('height');
      ph.style.removeProperty('margin-bottom');
    }
  }

  function applyFixed(el, ph) {
    const sourceRect = ph.getBoundingClientRect();
    const currentRect = el.getBoundingClientRect();
    const width = sourceRect.width || currentRect.width;
    const left = sourceRect.left || currentRect.left;
    const mb = parseFloat(getComputedStyle(el).marginBottom || '0') || 0;

    ph.style.height = currentRect.height + 'px';
    ph.style.marginBottom = mb + 'px';
    ph.classList.add('is-active');

    el.classList.add('taldo-fixed-search', 'is-stuck');
    el.style.left = left + 'px';
    el.style.width = width + 'px';
    el.style.right = 'auto';
    el.style.top = getStickyTop() + 'px';
  }

  function updateStickyFixedSearch() {
    document.querySelectorAll(stickySelector).forEach(el => {
      if (!isVisible(el)) {
        releaseFixed(el);
        return;
      }

      const ph = ensurePlaceholder(el);
      const baseRect = (el.classList.contains('taldo-fixed-search') ? ph : el).getBoundingClientRect();
      const baseTop = baseRect.top + window.scrollY;
      const shouldFix = window.scrollY + getStickyTop() >= baseTop;

      if (shouldFix) applyFixed(el, ph);
      else releaseFixed(el);
    });
  }

  window.taldoRefreshStickySearch = updateStickyFixedSearch;
  window.addEventListener('scroll', updateStickyFixedSearch, { passive: true });
  window.addEventListener('resize', updateStickyFixedSearch, { passive: true });
  document.addEventListener('shown.bs.modal', () => setTimeout(updateStickyFixedSearch, 120));
  document.addEventListener('hidden.bs.modal', () => setTimeout(updateStickyFixedSearch, 120));

  /* ---------- 2) Dashboard mobile action safety ---------- */
  function extractMartyrIdFromDashboardRow(row) {
    if (!row) return '';
    const sources = [
      row.getAttribute('onclick') || '',
      row.querySelector('button[onclick*="openMartyrDetails"]')?.getAttribute('onclick') || '',
      row.querySelector('button[onclick*="openDashboardActionModalFinal"]')?.getAttribute('onclick') || ''
    ];

    for (const text of sources) {
      let match = text.match(/openMartyrDetails\(['"]([^'"]+)['"]/);
      if (match && match[1]) return match[1];
      match = text.match(/openDashboardActionModalFinal\(['"]([^'"]+)['"]/);
      if (match && match[1]) return match[1];
    }
    return '';
  }

  function normalizeDashboardMobileActions() {
    const header = document.querySelector('#dashboardMartyrsTab table thead th:nth-child(6)');
    if (header) header.textContent = 'إجراء';

    document.querySelectorAll('#dashboardMartyrsTab tbody tr').forEach(row => {
      if (row.classList.contains('dash-pagination-row')) return;
      const actionCell = row.querySelector('td:nth-child(6)');
      if (!actionCell) return;

      const firstFlex = actionCell.querySelector(':scope > .d-flex');
      if (firstFlex) firstFlex.classList.add('dashboard-desktop-actions');

      let btn = actionCell.querySelector(':scope > .dashboard-mobile-action-btn');
      if (!btn) {
        const martyrId = extractMartyrIdFromDashboardRow(row);
        if (!martyrId || typeof window.openDashboardActionModalFinal !== 'function') return;
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-primary dashboard-mobile-action-btn';
        btn.textContent = 'إجراء';
        btn.addEventListener('click', function(event) {
          event.stopPropagation();
          window.openDashboardActionModalFinal(martyrId, event);
        });
        actionCell.appendChild(btn);
      } else {
        btn.textContent = 'إجراء';
      }
    });
  }

  window.taldoNormalizeDashboardMobileActions = normalizeDashboardMobileActions;

  function wrapRenderDashboardFinal() {
    const oldRender = window.renderDashboardTable || (typeof renderDashboardTable === 'function' ? renderDashboardTable : null);
    if (typeof oldRender !== 'function' || oldRender.__taldoFinal04Wrapped) return;

    const wrapped = function() {
      const result = oldRender.apply(this, arguments);
      setTimeout(normalizeDashboardMobileActions, 0);
      setTimeout(updateStickyFixedSearch, 20);
      return result;
    };
    wrapped.__taldoFinal04Wrapped = true;
    window.renderDashboardTable = wrapped;
    try { renderDashboardTable = wrapped; } catch (e) {}
  }

  /* ---------- 3) Houla family filters from actual data ---------- */
  const houlaTrueValues = new Set([
    'نعم', 'yes', 'true', '1', 'مجزره', 'مجزرة', 'شهداء المجزره', 'شهداء المجزرة',
    'houla', 'hula', 'massacre', 'الحوله', 'الحولة'
  ]);

  function normalizeHoulaValue(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function isHoulaItemFinal(item) {
    if (!item) return false;
    const raw = item.is_houla_massacre ?? item.houla_massacre ?? item.massacre_houla ?? item.houlaMassacre ?? '';
    return houlaTrueValues.has(normalizeHoulaValue(raw));
  }

  function getHoulaSourceFinal() {
    const dashboard = getGlobalArray('dashboardData');
    const publicList = getGlobalArray('allMartyrs');
    return getAdminFlag() && dashboard.length ? dashboard : publicList;
  }

  function getHoulaFamiliesFinal() {
    const seen = new Set();
    const families = [];
    getHoulaSourceFinal().forEach(item => {
      if (!isHoulaItemFinal(item)) return;
      if (String(item.verification_status || '').trim() === 'مرفوض') return;
      const family = String(item.family_name || '').trim();
      if (!family || seen.has(family)) return;
      seen.add(family);
      families.push(family);
    });
    return families.sort((a, b) => a.localeCompare(b, 'ar'));
  }

  function fillHoulaSelectFinal(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const oldValue = select.value || '';
    const families = getHoulaFamiliesFinal();
    select.innerHTML = ['<option value="">كل عوائل شهداء المجزرة</option>']
      .concat(families.map(family => `<option value="${safeAttr(family)}">${safeHtml(family)}</option>`))
      .join('');
    if (oldValue && families.includes(oldValue)) select.value = oldValue;
  }

  function refreshHoulaFamilyFiltersFinal() {
    fillHoulaSelectFinal('houlaFamilyFilter');
    fillHoulaSelectFinal('houlaCompactFamilyFilter');
  }

  window.taldoRefreshHoulaFamilyFilters = refreshHoulaFamilyFiltersFinal;

  function wrapHoulaFunctionsFinal() {
    const oldOpen = window.openHoulaMassacrePage || (typeof openHoulaMassacrePage === 'function' ? openHoulaMassacrePage : null);
    if (typeof oldOpen === 'function' && !oldOpen.__taldoFinal04Wrapped) {
      const wrappedOpen = function() {
        const result = oldOpen.apply(this, arguments);
        setTimeout(refreshHoulaFamilyFiltersFinal, 0);
        setTimeout(refreshHoulaFamilyFiltersFinal, 120);
        setTimeout(updateStickyFixedSearch, 160);
        return result;
      };
      wrappedOpen.__taldoFinal04Wrapped = true;
      window.openHoulaMassacrePage = wrappedOpen;
      try { openHoulaMassacrePage = wrappedOpen; } catch (e) {}
    }

    const oldRender = window.renderHoulaMassacrePage || (typeof renderHoulaMassacrePage === 'function' ? renderHoulaMassacrePage : null);
    if (typeof oldRender === 'function' && !oldRender.__taldoFinal04Wrapped) {
      const wrappedRender = function() {
        refreshHoulaFamilyFiltersFinal();
        const result = oldRender.apply(this, arguments);
        setTimeout(refreshHoulaFamilyFiltersFinal, 0);
        setTimeout(updateStickyFixedSearch, 80);
        return result;
      };
      wrappedRender.__taldoFinal04Wrapped = true;
      window.renderHoulaMassacrePage = wrappedRender;
      try { renderHoulaMassacrePage = wrappedRender; } catch (e) {}
    }
  }

  function installFinalFixes() {
    wrapRenderDashboardFinal();
    wrapHoulaFunctionsFinal();
    normalizeDashboardMobileActions();
    refreshHoulaFamilyFiltersFinal();
    updateStickyFixedSearch();
  }

  ready(function() {
    installFinalFixes();
    setTimeout(installFinalFixes, 250);
    setTimeout(installFinalFixes, 900);
    setTimeout(installFinalFixes, 2200);
  });

  const observer = new MutationObserver(function(mutations) {
    let relevant = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        relevant = true;
        break;
      }
    }
    if (!relevant) return;
    window.requestAnimationFrame(function() {
      normalizeDashboardMobileActions();
      refreshHoulaFamilyFiltersFinal();
      updateStickyFixedSearch();
    });
  });

  ready(function() {
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();

/* =========================================================
   TALDO BUGFIX v2026-06-01-05
   - sticky search without modal dependency
   - hide/release sticky while modals are open
   - Houla family filter fallback from stats + actual list
   - reduce aria-hidden focus warnings by blurring before modal hide
   ========================================================= */
(function() {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function getScrollY() {
    return Math.max(
      window.scrollY || 0,
      document.documentElement ? document.documentElement.scrollTop || 0 : 0,
      document.body ? document.body.scrollTop || 0 : 0
    );
  }

  function getGlobalArraySafe(name) {
    try {
      if (name === 'allMartyrs' && typeof allMartyrs !== 'undefined' && Array.isArray(allMartyrs)) return allMartyrs;
      if (name === 'dashboardData' && typeof dashboardData !== 'undefined' && Array.isArray(dashboardData)) return dashboardData;
    } catch (e) {}
    return Array.isArray(window[name]) ? window[name] : [];
  }

  function getAdminFlagSafe() {
    try { return !!isAdminLoggedIn; } catch (e) { return !!window.isAdminLoggedIn; }
  }

  function normalizeArabic(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function safeHtmlV05(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    try { if (typeof escapeHtml === 'function') return escapeHtml(value); } catch (e) {}
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeAttrV05(value) {
    if (typeof window.escapeAttr === 'function') return window.escapeAttr(value);
    try { if (typeof escapeAttr === 'function') return escapeAttr(value); } catch (e) {}
    return safeHtmlV05(value).replaceAll('`', '&#096;');
  }

  function isModalOpen() {
    return document.body.classList.contains('modal-open') || !!document.querySelector('.modal.show');
  }

  const stickySelectorV05 = [
    '.mobile-search-filter',
    '.desktop-filter-card',
    '.houla-compact-search-filter',
    '.family-compact-search-filter',
    '.join-compact-search-filter',
    '.dashboard-mobile-controls'
  ].join(',');

  function isActiveAndVisible(el) {
    if (!el || !el.isConnected) return false;
    const page = el.closest('.page-section');
    if (page && !page.classList.contains('active')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function stickyTop() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--taldo-sticky-top').trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 8;
  }

  function ensureStickyPlaceholderV05(el) {
    if (el.__taldoStickyPlaceholderV05 && el.__taldoStickyPlaceholderV05.isConnected) return el.__taldoStickyPlaceholderV05;

    let ph = el.previousElementSibling;
    if (!ph || !ph.classList || !ph.classList.contains('taldo-sticky-placeholder')) {
      ph = document.createElement('div');
      ph.className = 'taldo-sticky-placeholder';
      el.parentNode.insertBefore(ph, el);
    }

    el.__taldoStickyPlaceholderV05 = ph;
    return ph;
  }

  function releaseStickyV05(el) {
    if (!el) return;
    el.classList.remove('taldo-fixed-search', 'is-stuck');
    ['left', 'right', 'width', 'top'].forEach(prop => el.style.removeProperty(prop));

    const ph = el.__taldoStickyPlaceholderV05 || el.__taldoStickyPlaceholder;
    if (ph) {
      ph.classList.remove('is-active');
      ph.style.removeProperty('height');
      ph.style.removeProperty('margin-bottom');
    }
  }

  function releaseAllStickyV05() {
    document.querySelectorAll(stickySelectorV05 + ', .taldo-fixed-search').forEach(releaseStickyV05);
  }

  function applyStickyV05(el, ph) {
    const phRect = ph.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const width = phRect.width || elRect.width;
    const left = phRect.left || elRect.left;
    const mb = parseFloat(getComputedStyle(el).marginBottom || '0') || 0;

    ph.style.height = elRect.height + 'px';
    ph.style.marginBottom = mb + 'px';
    ph.classList.add('is-active');

    el.classList.add('taldo-fixed-search', 'is-stuck');
    el.style.left = left + 'px';
    el.style.right = 'auto';
    el.style.width = width + 'px';
    el.style.top = stickyTop() + 'px';
  }

  function updateStickyV05() {
    if (isModalOpen()) {
      releaseAllStickyV05();
      return;
    }

    const y = getScrollY();
    const top = stickyTop();

    document.querySelectorAll(stickySelectorV05).forEach(el => {
      if (!isActiveAndVisible(el)) {
        releaseStickyV05(el);
        return;
      }

      const ph = ensureStickyPlaceholderV05(el);
      const ref = el.classList.contains('taldo-fixed-search') ? ph : el;
      const triggerTop = ref.getBoundingClientRect().top + y;
      const shouldFix = y + top >= triggerTop;

      if (shouldFix) applyStickyV05(el, ph);
      else releaseStickyV05(el);
    });
  }

  window.taldoRefreshStickySearch = updateStickyV05;
  window.taldoReleaseStickySearch = releaseAllStickyV05;

  ['scroll', 'resize', 'orientationchange'].forEach(eventName => {
    window.addEventListener(eventName, updateStickyV05, { passive: true, capture: true });
    document.addEventListener(eventName, updateStickyV05, { passive: true, capture: true });
  });

  document.addEventListener('show.bs.modal', releaseAllStickyV05, true);
  document.addEventListener('shown.bs.modal', releaseAllStickyV05, true);
  document.addEventListener('hide.bs.modal', function(event) {
    const active = document.activeElement;
    if (event.target && active && event.target.contains(active)) {
      try { active.blur(); } catch (e) {}
    }
    releaseAllStickyV05();
  }, true);
  document.addEventListener('hidden.bs.modal', function() {
    releaseAllStickyV05();
    setTimeout(updateStickyV05, 160);
  }, true);

  ready(function() {
    updateStickyV05();
    setTimeout(updateStickyV05, 300);
    setTimeout(updateStickyV05, 1000);
    setInterval(updateStickyV05, 600);
  });

  const TRUE_HOULA_VALUES_V05 = new Set([
    'نعم', 'yes', 'true', '1', 'مجزره', 'مجزرة', 'شهداء المجزره', 'شهداء المجزرة',
    'houla', 'hula', 'massacre', 'الحوله', 'الحولة'
  ]);

  function isHoulaV05(item) {
    if (!item) return false;
    const raw = item.is_houla_massacre ?? item.houla_massacre ?? item.massacre_houla ?? item.houlaMassacre ?? '';
    return TRUE_HOULA_VALUES_V05.has(normalizeArabic(raw));
  }

  function getHoulaFamiliesV05() {
    const seen = new Set();
    const families = [];

    function addFamily(family) {
      family = String(family || '').trim();
      if (!family || seen.has(family)) return;
      seen.add(family);
      families.push(family);
    }

    const source = (getAdminFlagSafe() && getGlobalArraySafe('dashboardData').length)
      ? getGlobalArraySafe('dashboardData')
      : getGlobalArraySafe('allMartyrs');

    source.forEach(item => {
      if (!isHoulaV05(item)) return;
      if (String(item.verification_status || '').trim() === 'مرفوض') return;
      addFamily(item.family_name);
    });

    try {
      const byFamily = statsData && Array.isArray(statsData.byFamily) ? statsData.byFamily : [];
      byFamily.forEach(item => {
        const count = Number(item.houla_massacre || item.houlaMassacre || item.massacre || 0);
        if (count > 0) addFamily(item.family_name);
      });
    } catch (e) {}

    return families.sort((a, b) => a.localeCompare(b, 'ar'));
  }

  function fillHoulaSelectV05(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const oldValue = select.value || '';
    const families = getHoulaFamiliesV05();

    select.innerHTML = ['<option value="">كل عوائل شهداء المجزرة</option>']
      .concat(families.map(family => `<option value="${safeAttrV05(family)}">${safeHtmlV05(family)}</option>`))
      .join('');

    if (oldValue && families.includes(oldValue)) select.value = oldValue;
  }

  function refreshHoulaFiltersV05() {
    fillHoulaSelectV05('houlaFamilyFilter');
    fillHoulaSelectV05('houlaCompactFamilyFilter');
  }

  window.taldoRefreshHoulaFamilyFilters = refreshHoulaFiltersV05;

  function wrapFunctionV05(fnName, after) {
    const current = window[fnName] || null;
    if (typeof current !== 'function' || current.__taldoV05Wrapped) return;
    const wrapped = function() {
      const result = current.apply(this, arguments);
      setTimeout(after, 0);
      setTimeout(after, 200);
      return result;
    };
    wrapped.__taldoV05Wrapped = true;
    window[fnName] = wrapped;
    try { eval(fnName + ' = wrapped'); } catch (e) {}
  }

  ready(function() {
    refreshHoulaFiltersV05();
    wrapFunctionV05('openHoulaMassacrePage', function() {
      refreshHoulaFiltersV05();
      updateStickyV05();
    });
    wrapFunctionV05('renderHoulaMassacrePage', refreshHoulaFiltersV05);
    wrapFunctionV05('renderDashboardTable', updateStickyV05);
    setTimeout(refreshHoulaFiltersV05, 500);
    setTimeout(refreshHoulaFiltersV05, 1800);
  });
})();



/* =========================================================
   TALDO HOTFIX v2026-06-02-v07
   إصلاحات ربط البحث، منع التكرار، تثبيت الشريط، صفحة العوائل، ومعاينة القص
   ========================================================= */
(function() {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function $(id) { return document.getElementById(id); }

  function getActivePageId() {
    return document.querySelector('.page-section.active')?.id || 'homePage';
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const page = el.closest('.page-section');
    if (page && !page.classList.contains('active')) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function removeDuplicateIds() {
    ['dashboardMobileSearchInput', 'dataUpdatesMobileSearchInput', 'familyCompactSearchInput'].forEach(id => {
      const nodes = Array.from(document.querySelectorAll('#' + CSS.escape(id)));
      nodes.slice(1).forEach(node => {
        const wrapper = node.closest('#dashboardMobileMartyrsControls,#dataUpdatesMobileControls,#familyCompactSearchBar,.dashboard-mobile-controls,.mobile-search-filter,.family-compact-search-filter');
        if (wrapper) wrapper.remove();
        else node.remove();
      });
    });

    // If an older family search bar still exists, remove it because the compact bar is the canonical one.
    const oldFamilyBar = $('familyMartyrsSearchBar');
    if (oldFamilyBar && $('familyCompactSearchBar')) oldFamilyBar.remove();
  }

  function syncValue(fromId, toId) {
    const from = $(fromId);
    const to = $(toId);
    if (from && to && to.value !== from.value) to.value = from.value || '';
  }

  function renderSafe(fnName) {
    try {
      if (typeof window[fnName] === 'function') window[fnName]();
    } catch (e) {}
  }

  function bindSearchInputs() {
    removeDuplicateIds();

    const homeMobile = $('mobileSearchInput');
    if (homeMobile && !homeMobile.__taldoV07Bound) {
      homeMobile.__taldoV07Bound = true;
      homeMobile.addEventListener('input', function() {
        syncValue('mobileSearchInput', 'searchInput');
        if (typeof window.resetMartyrsPageAndRender === 'function') window.resetMartyrsPageAndRender();
        else renderSafe('renderMartyrs');
      });
    }

    const homeDesktop = $('searchInput');
    if (homeDesktop && !homeDesktop.__taldoV07Bound) {
      homeDesktop.__taldoV07Bound = true;
      homeDesktop.addEventListener('input', function() {
        syncValue('searchInput', 'mobileSearchInput');
      });
    }

    const dashMobile = $('dashboardMobileSearchInput');
    if (dashMobile && !dashMobile.__taldoV07Bound) {
      dashMobile.__taldoV07Bound = true;
      dashMobile.addEventListener('input', function() {
        syncValue('dashboardMobileSearchInput', 'dashboardSearchInput');
        renderSafe('renderDashboardTable');
      });
    }

    const dashDesktop = $('dashboardSearchInput');
    if (dashDesktop && !dashDesktop.__taldoV07Bound) {
      dashDesktop.__taldoV07Bound = true;
      dashDesktop.addEventListener('input', function() {
        syncValue('dashboardSearchInput', 'dashboardMobileSearchInput');
      });
    }

    const updatesMobile = $('dataUpdatesMobileSearchInput');
    if (updatesMobile && !updatesMobile.__taldoV07Bound) {
      updatesMobile.__taldoV07Bound = true;
      updatesMobile.addEventListener('input', function() {
        syncValue('dataUpdatesMobileSearchInput', 'dataUpdatesSearchInput');
        renderSafe('renderDataUpdateRequestsTable');
      });
    }

    const updatesDesktop = $('dataUpdatesSearchInput');
    if (updatesDesktop && !updatesDesktop.__taldoV07Bound) {
      updatesDesktop.__taldoV07Bound = true;
      updatesDesktop.addEventListener('input', function() {
        syncValue('dataUpdatesSearchInput', 'dataUpdatesMobileSearchInput');
      });
    }

    const familyInput = $('familyCompactSearchInput');
    if (familyInput && !familyInput.__taldoV07Bound) {
      familyInput.__taldoV07Bound = true;
      familyInput.addEventListener('input', function() {
        if (typeof window.goToFamilyPageFinal === 'function') window.goToFamilyPageFinal(1);
        else if (typeof window.renderFamilyMartyrsPageFinal === 'function') window.renderFamilyMartyrsPageFinal();
        else if (typeof window.filterFamilyMartyrs === 'function') window.filterFamilyMartyrs();
      });
    }
  }

  function ensureFamiliesPageHasContent() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('page') !== 'families') return;
    const container = $('familiesStatsContainer');
    if (!container) return;
    if (container.children.length && container.textContent.trim()) return;
    if (typeof window.openFamiliesStatsPage === 'function') {
      window.openFamiliesStatsPage();
    }
  }

  function currentStickyCandidates() {
    const activeId = getActivePageId();
    let selectors = [];
    if (activeId === 'homePage') selectors = window.innerWidth >= 1025 ? ['#homePage > .desktop-filter-card'] : ['#homePage > .mobile-search-filter'];
    else if (activeId === 'familiesPage') selectors = ['#familiesSearchBar'];
    else if (activeId === 'familyMartyrsPage') selectors = ['#familyCompactSearchBar'];
    else if (activeId === 'dashboardPage') selectors = [
      '#dashboardMartyrsTab:not(.d-none) #dashboardMobileMartyrsControls',
      '#dashboardMartyrsTab:not(.d-none) > .desktop-filter-card',
      '#dashboardDataUpdatesTab:not(.d-none) #dataUpdatesMobileControls',
      '#dashboardDataUpdatesTab:not(.d-none) #dataUpdatesControls',
      '#dashboardJoinRequestsTab:not(.d-none) #joinCompactSearchBar'
    ];
    else selectors = ['.page-section.active .mobile-search-filter', '.page-section.active .desktop-filter-card'];
    return selectors.flatMap(sel => Array.from(document.querySelectorAll(sel))).filter(isVisible);
  }

  function releaseSticky(el) {
    if (!el) return;
    el.classList.remove('taldo-v07-fixed-search', 'taldo-fixed-search', 'is-stuck');
    ['left','right','width','top'].forEach(p => el.style.removeProperty(p));
    const ph = el.__taldoV07Placeholder;
    if (ph) {
      ph.classList.remove('is-active');
      ph.style.removeProperty('height');
      ph.style.removeProperty('margin-bottom');
    }
  }

  function releaseAllSticky() {
    document.querySelectorAll('.taldo-v07-fixed-search,.taldo-fixed-search').forEach(releaseSticky);
  }

  function ensurePlaceholder(el) {
    if (el.__taldoV07Placeholder && el.__taldoV07Placeholder.isConnected) return el.__taldoV07Placeholder;
    let ph = el.previousElementSibling;
    if (!ph || !ph.classList.contains('taldo-sticky-placeholder')) {
      ph = document.createElement('div');
      ph.className = 'taldo-sticky-placeholder';
      el.parentNode.insertBefore(ph, el);
    }
    el.__taldoV07Placeholder = ph;
    return ph;
  }

  function stickyTop() {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--taldo-sticky-top'));
    return Number.isFinite(value) ? value : 8;
  }

  function updateSticky() {
    if (document.body.classList.contains('modal-open') || document.querySelector('.modal.show')) {
      releaseAllSticky();
      return;
    }

    const candidates = new Set(currentStickyCandidates());
    document.querySelectorAll('.taldo-v07-fixed-search,.taldo-fixed-search').forEach(el => {
      if (!candidates.has(el)) releaseSticky(el);
    });

    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const top = stickyTop();

    candidates.forEach(el => {
      const ph = ensurePlaceholder(el);
      const ref = el.classList.contains('taldo-v07-fixed-search') || el.classList.contains('taldo-fixed-search') ? ph : el;
      const triggerY = ref.getBoundingClientRect().top + y;
      if (y + top < triggerY) {
        releaseSticky(el);
        return;
      }

      const refRect = ph.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const width = refRect.width || elRect.width;
      const left = refRect.left || elRect.left;
      const marginBottom = parseFloat(getComputedStyle(el).marginBottom || '0') || 0;
      ph.style.height = elRect.height + 'px';
      ph.style.marginBottom = marginBottom + 'px';
      ph.classList.add('is-active');

      el.classList.add('taldo-v07-fixed-search', 'is-stuck');
      el.style.left = left + 'px';
      el.style.right = 'auto';
      el.style.width = width + 'px';
      el.style.top = top + 'px';
    });
  }

  function fixImagePositionPreview() {
    const preview = $('imagePositionPreview');
    if (!preview) return;
    const x = $('imagePositionX')?.value || '50';
    const y = $('imagePositionY')?.value || '50';
    const zRaw = Number($('imagePositionZoom')?.value || 1);
    const zoom = Math.min(3, Math.max(1, Number.isFinite(zRaw) ? zRaw : 1));
    preview.style.objectPosition = x + '% ' + y + '%';
    preview.style.transform = 'scale(' + zoom + ')';
    preview.style.transformOrigin = x + '% ' + y + '%';
    const zv = $('imagePositionZoomValue');
    if (zv) zv.textContent = zoom.toFixed(2) + 'x';
    if (window.__imagePositionDraft) {
      const mode = $('imagePositionMode')?.value || 'card';
      window.__imagePositionDraft[mode] = { x: String(x), y: String(y), zoom: String(zoom) };
    }
  }

  const oldUpdateImagePositionPreview = window.updateImagePositionPreview;
  window.updateImagePositionPreview = function() {
    if (typeof oldUpdateImagePositionPreview === 'function') {
      try { oldUpdateImagePositionPreview.apply(this, arguments); } catch (e) {}
    }
    fixImagePositionPreview();
  };
  try { updateImagePositionPreview = window.updateImagePositionPreview; } catch (e) {}

  function afterDomWork() {
    bindSearchInputs();
    ensureFamiliesPageHasContent();
    updateSticky();
  }

  ['scroll','resize','orientationchange'].forEach(evt => {
    window.addEventListener(evt, updateSticky, { passive: true, capture: true });
    document.addEventListener(evt, updateSticky, { passive: true, capture: true });
  });
  document.addEventListener('shown.bs.modal', releaseAllSticky, true);
  document.addEventListener('hidden.bs.modal', () => setTimeout(updateSticky, 120), true);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__taldoV07DomTimer);
    window.__taldoV07DomTimer = setTimeout(afterDomWork, 60);
  });

  ready(function() {
    afterDomWork();
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(afterDomWork, 400);
    setTimeout(afterDomWork, 1200);
    setInterval(updateSticky, 700);
  });

  // Wrap route/load functions lightly so refresh on ?page=families always gets rendered content.
  const oldApplyRoute = window.applyRouteFromLocation;
  if (typeof oldApplyRoute === 'function' && !oldApplyRoute.__taldoV07Wrapped) {
    window.applyRouteFromLocation = function() {
      const result = oldApplyRoute.apply(this, arguments);
      setTimeout(ensureFamiliesPageHasContent, 160);
      setTimeout(afterDomWork, 220);
      return result;
    };
    window.applyRouteFromLocation.__taldoV07Wrapped = true;
    try { applyRouteFromLocation = window.applyRouteFromLocation; } catch (e) {}
  }

  const oldLoadInitial = window.loadInitialData;
  if (typeof oldLoadInitial === 'function' && !oldLoadInitial.__taldoV07Wrapped) {
    window.loadInitialData = function() {
      const result = oldLoadInitial.apply(this, arguments);
      Promise.resolve(result).finally(() => {
        setTimeout(ensureFamiliesPageHasContent, 200);
        setTimeout(afterDomWork, 260);
      });
      return result;
    };
    window.loadInitialData.__taldoV07Wrapped = true;
    try { loadInitialData = window.loadInitialData; } catch (e) {}
  }
})();
