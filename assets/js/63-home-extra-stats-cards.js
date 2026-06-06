(function () {
  'use strict';

  const VERIFIED_STATUS = 'موثق';
  const PENDING_STATUS = 'بانتظار التوثيق';
  const REJECTED_STATUS = 'مرفوض';
  const SPECIAL_NEEDS_COMPLETION = 'needs_completion';
  const SPECIAL_NEEDS_IMAGE = 'needs_image';

  let activeSpecialFilter = '';
  let applyingSpecialFilter = false;
  let hintPlayed = false;
  const filterButtonOriginalHtml = new WeakMap();

  function clean(value) {
    return String(value || '').trim();
  }

  function normalizeFlag(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function isYes(value) {
    return ['نعم', 'yes', 'true', '1', 'بحاجه', 'بحاجة', 'يحتاج', 'needs', 'needed'].includes(normalizeFlag(value));
  }

  function isRejected(item) {
    const status = clean(item && (item.verification_status || item.status));
    return status === REJECTED_STATUS || status === 'rejected';
  }

  function isVerified(item) {
    return clean(item && item.verification_status) === VERIFIED_STATUS;
  }

  function getSettingsObject() {
    let settings = {};

    try {
      if (typeof publicSettings !== 'undefined' && publicSettings) settings = publicSettings;
    } catch (error) {}

    if (window.publicSettings && typeof window.publicSettings === 'object') {
      settings = Object.assign({}, settings, window.publicSettings);
    }

    return settings || {};
  }

  function parseList(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);

    const text = clean(value);
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch (error) {}

    return text.split(/[\n,،;؛]+/).map(clean).filter(Boolean);
  }

  function getBlockedIds() {
    const settings = getSettingsObject();
    return Array.from(new Set([
      ...parseList(settings.image_upload_blocked_martyrs),
      ...parseList(settings.image_upload_blocked_martyrs_json),
      ...parseList(settings.image_upload_blocked_martyrs_json)
    ]));
  }

  function isImageBlocked(item) {
    if (!item) return false;

    try {
      if (typeof window.isMartyrImageUploadBlocked === 'function') {
        return !!window.isMartyrImageUploadBlocked(item);
      }
    } catch (error) {}

    if (isYes(item.image_upload_blocked || item.images_blocked || item.prevent_image_upload)) return true;

    const martyrId = clean(item.martyr_id || item.martyrId || item.id);
    return martyrId ? getBlockedIds().includes(martyrId) : false;
  }

  function hasAnyImage(item) {
    if (!item) return false;

    if (clean(item.image_file_id) || clean(item.image_url)) return true;

    if (Array.isArray(item.images)) {
      return item.images.some(function (img) {
        if (!img) return false;
        const status = normalizeFlag(img.status || 'active');
        if (['deleted', 'inactive', 'replaced', 'محذوف', 'مستبدل'].includes(status)) return false;
        return !!(clean(img.image_file_id) || clean(img.image_url) || clean(img.src));
      });
    }

    return false;
  }

  function getRowsSource() {
    let source = [];

    try {
      if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) {
        source = dashboardData;
      }
    } catch (error) {}

    if (!source.length) {
      try {
        if (Array.isArray(allMartyrs)) source = allMartyrs;
      } catch (error) {}
    }

    return Array.isArray(source) ? source.filter(Boolean) : [];
  }

  function visibleRowsSource() {
    return getRowsSource().filter(function (item) {
      return !isRejected(item);
    });
  }

  function needsCompletion(item) {
    return isVerified(item) && isYes(item && item.needs_completion);
  }

  function needsImage(item) {
    if (!item || isRejected(item)) return false;
    if (isImageBlocked(item)) return false;
    return !hasAnyImage(item);
  }

  function getNeedsCompletionCount() {
    return visibleRowsSource().filter(needsCompletion).length;
  }

  function getNeedsImageCount() {
    return visibleRowsSource().filter(needsImage).length;
  }

  function getSpecialFilteredRows() {
    const rows = visibleRowsSource();

    if (activeSpecialFilter === SPECIAL_NEEDS_COMPLETION) {
      return rows.filter(needsCompletion);
    }

    if (activeSpecialFilter === SPECIAL_NEEDS_IMAGE) {
      return rows.filter(needsImage);
    }

    return rows;
  }

  function resetPageCounters() {
    try { currentPage = 1; } catch (error) {}
    try { currentMartyrsPage = 1; } catch (error) {}
    try { martyrsCurrentPage = 1; } catch (error) {}
    try { window.currentPage = 1; } catch (error) {}
    try { window.currentMartyrsPage = 1; } catch (error) {}
    try { window.martyrsCurrentPage = 1; } catch (error) {}
  }

  function setStatusFilterValue(value) {
    ['statusFilter', 'mobileStatusFilter'].forEach(function (id) {
      const select = document.getElementById(id);
      if (select) select.value = value || '';
    });

    try { currentStatusFilter = value || ''; } catch (error) {}
  }

  function getExtraCardHtml(type, icon, iconClass, label, countId, count) {
    return `
      <div class="col taldo-extra-stat-col">
        <button class="card stat-card w-100 text-start h-100 taldo-extra-stat-card" data-taldo-extra-stat-filter="${type}" type="button">
          <div class="card-body d-flex align-items-center gap-3">
            <div class="stat-icon ${iconClass}">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="flex-grow-1">
              <div class="stat-card-label">${label}</div>
              <h3 class="fw-bold mb-0" id="${countId}">${count}</h3>
            </div>
            <i class="fa-solid fa-chevron-left text-muted stat-action-arrow" aria-hidden="true"></i>
          </div>
        </button>
      </div>`;
  }

  function upsertExtraCards() {
    const row = document.querySelector('.home-stats-row');
    if (!row) return;

    row.querySelectorAll('.taldo-extra-stat-col').forEach(function (col) {
      col.remove();
    });

    row.insertAdjacentHTML('beforeend',
      getExtraCardHtml(
        SPECIAL_NEEDS_COMPLETION,
        'fa-clipboard-list',
        'bg-info-subtle text-info',
        'يحتاج لاستكمال',
        'needsCompletionCount',
        getNeedsCompletionCount()
      ) +
      getExtraCardHtml(
        SPECIAL_NEEDS_IMAGE,
        'fa-image',
        'bg-secondary-subtle text-secondary',
        'يحتاج لصورة',
        'needsImageCount',
        getNeedsImageCount()
      )
    );

    installExtraCardHandlers();
    markActiveExtraCards();
    runStatsScrollHintOnce();
  }

  function updateExtraCountsOnly() {
    const needsCompletionEl = document.getElementById('needsCompletionCount');
    const needsImageEl = document.getElementById('needsImageCount');

    if (needsCompletionEl) needsCompletionEl.textContent = getNeedsCompletionCount();
    if (needsImageEl) needsImageEl.textContent = getNeedsImageCount();
  }

  function installExtraCardHandlers() {
    document.querySelectorAll('[data-taldo-extra-stat-filter]').forEach(function (card) {
      if (card.dataset.taldoExtraStatsInstalled === '1') return;

      card.dataset.taldoExtraStatsInstalled = '1';
      card.classList.add('home-stats-filter-card');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        applySpecialFilter(card.dataset.taldoExtraStatFilter || '');
      }, true);

      card.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        applySpecialFilter(card.dataset.taldoExtraStatFilter || '');
      });
    });
  }

  function markActiveExtraCards() {
    document.querySelectorAll('[data-taldo-extra-stat-filter]').forEach(function (card) {
      card.classList.toggle(
        'home-stats-filter-active',
        !!activeSpecialFilter && card.dataset.taldoExtraStatFilter === activeSpecialFilter
      );
    });
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function applySpecialFilter(type) {
    if (!type) return;

    activeSpecialFilter = type;
    applyingSpecialFilter = true;

    if (activePageId() !== 'homePage' && typeof showPage === 'function') {
      showPage('homePage');
    }

    setStatusFilterValue('');
    resetPageCounters();

    try {
      if (typeof renderMartyrs === 'function') renderMartyrs();
    } catch (error) {}

    applyingSpecialFilter = false;

    upsertExtraCards();
    updateSpecialFilterButtonIcon();

    if (type === SPECIAL_NEEDS_COMPLETION && typeof showToast === 'function') {
      showToast('يتم الآن عرض الموثقين الذين يحتاجون إلى استكمال بيانات.');
    }

    if (type === SPECIAL_NEEDS_IMAGE && typeof showToast === 'function') {
      showToast('يتم الآن عرض الأسماء التي تحتاج إلى صورة، مع استثناء السجلات المحمية من رفع الصور.');
    }
  }

  function clearSpecialFilter(options) {
    options = options || {};
    if (!activeSpecialFilter) return;

    activeSpecialFilter = '';
    if (!options.keepStatus) {
      setStatusFilterValue('');
    }
    resetPageCounters();
    markActiveExtraCards();
    updateSpecialFilterButtonIcon();

    if (options.render !== false && typeof renderMartyrs === 'function') {
      renderMartyrs();
    }

    if (!options.silent && typeof showToast === 'function') {
      showToast('تم إلغاء فلترة البطاقات الإضافية.');
    }
  }

  function isFilterButton(btn) {
    if (!btn) return false;
    if (btn.dataset.taldoSpecialStatsCancel === '1') return true;

    const html = String(btn.innerHTML || '');
    const text = clean(btn.textContent).replace(/\s+/g, ' ');

    return (
      text.includes('فلترة') ||
      text.includes('إجراءات الفلترة') ||
      html.includes('fa-filter')
    );
  }

  function getFilterButtons() {
    return Array.from(document.querySelectorAll('button')).filter(function (btn) {
      if (!isFilterButton(btn)) return false;
      return !!btn.closest('#homePage, .mobile-search-filter, .desktop-filter-card, .compact-search-bar, .search-filter-bar');
    });
  }

  function updateSpecialFilterButtonIcon() {
    getFilterButtons().forEach(function (btn) {
      if (!filterButtonOriginalHtml.has(btn) && btn.dataset.taldoSpecialStatsCancel !== '1') {
        const wasQuickStatsCancel = btn.dataset.quickStatsCancelFilter === '1';
        filterButtonOriginalHtml.set(btn, wasQuickStatsCancel ? '<i class="fa-solid fa-filter"></i>' : btn.innerHTML);
      }

      if (activeSpecialFilter) {
        delete btn.dataset.quickStatsCancelFilter;
        btn.dataset.taldoSpecialStatsCancel = '1';
        btn.classList.add('stats-filter-cancel-mode');
        btn.title = 'إلغاء الفلترة';
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      } else if (btn.dataset.taldoSpecialStatsCancel === '1') {
        delete btn.dataset.taldoSpecialStatsCancel;
        btn.classList.remove('stats-filter-cancel-mode');
        btn.title = 'إجراءات الفلترة';
        const original = filterButtonOriginalHtml.get(btn);
        if (original) btn.innerHTML = original;
      }
    });
  }

function runStatsScrollHintOnce() {
  const row =
    document.querySelector('.home-stats-row') ||
    document.querySelector('.stats-row') ||
    document.querySelector('.home-stats-cards');

  if (!row) return;
  if (row.dataset.taldoScrollHintDone === '1') return;
  if (row.scrollWidth <= row.clientWidth + 10) return;

  row.dataset.taldoScrollHintDone = '1';

  const original = row.scrollLeft;

  // في RTL الاتجاه المفيد غالبًا يكون بالسالب حتى تظهر البطاقات الموجودة يسارًا
  const distance = Math.min(110, Math.max(60, row.clientWidth * 0.28));
  const target = original - distance;

  function easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function animateScroll(from, to, duration, done) {
    const start = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeInOut(progress);

      row.scrollLeft = from + (to - from) * eased;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else if (typeof done === 'function') {
        done();
      }
    }

    requestAnimationFrame(frame);
  }

  setTimeout(() => {
    row.classList.add('taldo-stats-scroll-hint');
    row.classList.add('taldo-stats-scroll-hint-fade');

    // fade in
    setTimeout(() => {
      row.classList.remove('taldo-stats-scroll-hint-fade');

      // حركة خروج ناعمة
      animateScroll(original, target, 850, () => {
        setTimeout(() => {
          // حركة رجوع ناعمة
          animateScroll(target, original, 850, () => {
            // fade out خفيف في النهاية
            row.classList.add('taldo-stats-scroll-hint-fade');

            setTimeout(() => {
              row.classList.remove('taldo-stats-scroll-hint');
              row.classList.remove('taldo-stats-scroll-hint-fade');
            }, 420);
          });
        }, 180);
      });
    }, 180);
  }, 650);
}
  document.addEventListener('click', function (event) {
    const cancelBtn = event.target.closest?.('button[data-taldo-special-stats-cancel="1"]');
    if (!cancelBtn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearSpecialFilter({ silent: false, render: true });
  }, true);

  document.addEventListener('change', function (event) {
    const target = event.target;
    if (!target || (target.id !== 'statusFilter' && target.id !== 'mobileStatusFilter')) return;
    if (applyingSpecialFilter) return;
    clearSpecialFilter({ silent: true, render: false, keepStatus: true });
  }, true);

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__taldoExtraStatsWrapped) {
    window.renderMartyrs = function (customList) {
      if (activeSpecialFilter && !customList) {
        return oldRenderMartyrs.call(this, getSpecialFilteredRows());
      }

      return oldRenderMartyrs.apply(this, arguments);
    };

    window.renderMartyrs.__taldoExtraStatsWrapped = true;
    try { renderMartyrs = window.renderMartyrs; } catch (error) {}
  }

  const oldChangeStatusFilter =
    window.changeStatusFilter ||
    (typeof changeStatusFilter === 'function' ? changeStatusFilter : null);

  if (typeof oldChangeStatusFilter === 'function' && !oldChangeStatusFilter.__taldoExtraStatsWrapped) {
    window.changeStatusFilter = function () {
      if (!applyingSpecialFilter) {
        clearSpecialFilter({ silent: true, render: false, keepStatus: true });
      }

      return oldChangeStatusFilter.apply(this, arguments);
    };

    window.changeStatusFilter.__taldoExtraStatsWrapped = true;
    try { changeStatusFilter = window.changeStatusFilter; } catch (error) {}
  }

  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__taldoExtraStatsWrapped) {
    window.showPage = function (pageId) {
      if (pageId && pageId !== 'homePage' && !applyingSpecialFilter) {
        clearSpecialFilter({ silent: true, render: false });
      }

      const result = oldShowPage.apply(this, arguments);

      if (pageId === 'homePage') {
        setTimeout(function () {
          upsertExtraCards();
          updateSpecialFilterButtonIcon();
          runStatsScrollHintOnce();
        }, 150);
      }

      return result;
    };

    window.showPage.__taldoExtraStatsWrapped = true;
    try { showPage = window.showPage; } catch (error) {}
  }

  const oldUpdateStatsCards =
    window.updateStatsCards ||
    (typeof updateStatsCards === 'function' ? updateStatsCards : null);

  if (typeof oldUpdateStatsCards === 'function' && !oldUpdateStatsCards.__taldoExtraStatsWrapped) {
    window.updateStatsCards = function () {
      const result = oldUpdateStatsCards.apply(this, arguments);
      upsertExtraCards();
      updateSpecialFilterButtonIcon();
      return result;
    };

    window.updateStatsCards.__taldoExtraStatsWrapped = true;
    try { updateStatsCards = window.updateStatsCards; } catch (error) {}
  }

  window.applyTaldoNeedsCompletionFilter = function () {
    applySpecialFilter(SPECIAL_NEEDS_COMPLETION);
  };

  window.applyTaldoNeedsImageFilter = function () {
    applySpecialFilter(SPECIAL_NEEDS_IMAGE);
  };

  window.clearTaldoHomeExtraStatsFilter = function () {
    clearSpecialFilter({ silent: false, render: true });
  };

  window.addEventListener('taldo:image-upload-block-changed', function () {
    updateExtraCountsOnly();
    if (activeSpecialFilter === SPECIAL_NEEDS_IMAGE && typeof renderMartyrs === 'function') {
      renderMartyrs();
    }
  });

  function init() {
    upsertExtraCards();
    updateSpecialFilterButtonIcon();
    setTimeout(upsertExtraCards, 400);
    setTimeout(upsertExtraCards, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
