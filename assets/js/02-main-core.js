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

    document.addEventListener('DOMContentLoaded', () => {
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
  
