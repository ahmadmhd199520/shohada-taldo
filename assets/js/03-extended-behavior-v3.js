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

document.addEventListener('DOMContentLoaded', () => {
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

document.addEventListener('DOMContentLoaded', () => {
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

document.addEventListener('DOMContentLoaded', () => {
  addRefreshButtonsToSections();
});
