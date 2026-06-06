(function () {
  'use strict';

  const MALE = 'ذكر';
  const FEMALE = 'أنثى';

  function clean(value) {
    return String(value || '').trim();
  }

  function normalizeArabic(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function normalizeGender(value) {
    const text = normalizeArabic(value);

    if ([
      'انثى',
      'انثي',
      'مؤنث',
      'امراه',
      'امرأه',
      'female',
      'f'
    ].includes(text)) {
      return FEMALE;
    }

    if ([
      'ذكر',
      'مذكر',
      'male',
      'm'
    ].includes(text)) {
      return MALE;
    }

    return '';
  }

  function getGenderFilterValue() {
    const desktop = document.getElementById('genderFilter');
    const mobile = document.getElementById('mobileGenderFilter');

    return clean(
      desktop?.value ||
      window.__taldoHomeGenderFilter ||
      mobile?.value ||
      ''
    );
  }

  function setGenderEverywhere(value) {
    value = clean(value);

    window.__taldoHomeGenderFilter = value;

    const desktop = document.getElementById('genderFilter');
    const mobile = document.getElementById('mobileGenderFilter');

    if (desktop) desktop.value = value;
    if (mobile) mobile.value = value;
  }

  function genderMatches(item, selectedGender) {
    if (!selectedGender) return true;

    const itemGender = normalizeGender(
      item?.gender ||
      item?.sex ||
      item?.gender_name ||
      ''
    );

    return itemGender === selectedGender;
  }

  function filterRowsByGender(rows) {
    const selectedGender = getGenderFilterValue();
    if (!selectedGender || !Array.isArray(rows)) return rows;

    return rows.filter(function (item) {
      return genderMatches(item, selectedGender);
    });
  }

  function resetPages() {
    try { currentPage = 1; } catch (error) {}
    try { currentMartyrsPage = 1; } catch (error) {}
    try { martyrsCurrentPage = 1; } catch (error) {}

    try { window.currentPage = 1; } catch (error) {}
    try { window.currentMartyrsPage = 1; } catch (error) {}
    try { window.martyrsCurrentPage = 1; } catch (error) {}
  }

  function installDesktopGenderListener() {
    const genderFilter = document.getElementById('genderFilter');
    if (!genderFilter || genderFilter.dataset.taldoGenderInstalled === '1') return;

    genderFilter.dataset.taldoGenderInstalled = '1';

    genderFilter.addEventListener('change', function () {
      setGenderEverywhere(genderFilter.value || '');
      resetPages();

      if (typeof resetMartyrsPageAndRender === 'function') {
        resetMartyrsPageAndRender();
      } else if (typeof renderMartyrs === 'function') {
        renderMartyrs();
      }
    });
  }

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__taldoGenderFilterWrapped) {
    window.renderMartyrs = function (customList) {
      const selectedGender = getGenderFilterValue();

      if (!selectedGender) {
        return oldRenderMartyrs.apply(this, arguments);
      }

      if (Array.isArray(customList)) {
        return oldRenderMartyrs.call(this, filterRowsByGender(customList));
      }

      let oldAllMartyrs = null;
      let oldDashboardData = null;

      try {
        if (Array.isArray(allMartyrs)) {
          oldAllMartyrs = allMartyrs;
          allMartyrs = filterRowsByGender(allMartyrs);
        }

        if (Array.isArray(dashboardData)) {
          oldDashboardData = dashboardData;
          dashboardData = filterRowsByGender(dashboardData);
        }

        return oldRenderMartyrs.apply(this, arguments);

      } finally {
        try {
          if (oldAllMartyrs) allMartyrs = oldAllMartyrs;
        } catch (error) {}

        try {
          if (oldDashboardData) dashboardData = oldDashboardData;
        } catch (error) {}
      }
    };

    window.renderMartyrs.__taldoGenderFilterWrapped = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (error) {}
  }

  const oldOpenMobileFilterModal =
    window.openMobileFilterModal ||
    (typeof openMobileFilterModal === 'function' ? openMobileFilterModal : null);

  if (typeof oldOpenMobileFilterModal === 'function' && !oldOpenMobileFilterModal.__taldoGenderFilterWrapped) {
    window.openMobileFilterModal = function () {
      setGenderEverywhere(getGenderFilterValue());
      return oldOpenMobileFilterModal.apply(this, arguments);
    };

    window.openMobileFilterModal.__taldoGenderFilterWrapped = true;

    try {
      openMobileFilterModal = window.openMobileFilterModal;
    } catch (error) {}
  }

  const oldApplyMobileFilters =
    window.applyMobileFilters ||
    (typeof applyMobileFilters === 'function' ? applyMobileFilters : null);

  if (typeof oldApplyMobileFilters === 'function' && !oldApplyMobileFilters.__taldoGenderFilterWrapped) {
    window.applyMobileFilters = function () {
      const mobileGender = document.getElementById('mobileGenderFilter')?.value || '';
      setGenderEverywhere(mobileGender);

      resetPages();

      return oldApplyMobileFilters.apply(this, arguments);
    };

    window.applyMobileFilters.__taldoGenderFilterWrapped = true;

    try {
      applyMobileFilters = window.applyMobileFilters;
    } catch (error) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    installDesktopGenderListener();
    setGenderEverywhere(getGenderFilterValue());
  });

  setTimeout(function () {
    installDesktopGenderListener();
    setGenderEverywhere(getGenderFilterValue());
  }, 500);
})();
