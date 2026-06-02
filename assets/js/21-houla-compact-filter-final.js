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
    // قراءة المتغيرات العامة بشكل مباشر دون استخدام الكلمة المفتاحية window لتفادي قيود المتغير let
    const adminActive = typeof isAdminLoggedIn !== 'undefined' ? isAdminLoggedIn : false;
    const dashList = typeof dashboardData !== 'undefined' ? dashboardData : [];
    const martyrsList = typeof allMartyrs !== 'undefined' ? allMartyrs : [];

    const source = (adminActive && Array.isArray(dashList) && dashList.length)
      ? dashList
      : (Array.isArray(martyrsList) ? martyrsList : []);

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

  document.addEventListener('DOMContentLoaded', function() {
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
