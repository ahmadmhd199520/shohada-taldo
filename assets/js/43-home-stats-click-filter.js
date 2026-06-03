(function() {
  'use strict';

  let activeStatsFilter = '';
  const originalFilterButtons = new WeakMap();

  const verifiedMessage = 'يتم الآن عرض أسماء الشهداء الذين تم التوثق من بياناتهم';

  const pendingMessage = 'يتم عرض أسماء الشهداء الذين يتم تدقيق بياناتهم، ستتمكن من فتح الصفحة الخاصة للشهيد بعد التوثق من صحة البيانات من فريق العمل.';

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getStatusValue(item) {
    return normalizeText(item?.verification_status || item?.status || '');
  }

  function isVerifiedItem(item) {
    return getStatusValue(item) === 'موثق';
  }

  function isPendingItem(item) {
    const status = getStatusValue(item);

    return (
      status === 'بانتظار التوثيق' ||
      status === 'بانتظار التوثق' ||
      status === 'قيد التدقيق' ||
      status === 'قيد المراجعة' ||
      status === 'بانتظار المراجعة'
    );
  }

  function isFilterActive() {
    return activeStatsFilter === 'verified' || activeStatsFilter === 'pending';
  }

  function resetMartyrsPageSafe() {
    try { currentPage = 1; } catch (e) {}
    try { martyrsCurrentPage = 1; } catch (e) {}
    try { window.currentPage = 1; } catch (e) {}
    try { window.martyrsCurrentPage = 1; } catch (e) {}
  }

  function applyStatsFilter(type) {
    activeStatsFilter = type;

    resetMartyrsPageSafe();

    if (typeof showPage === 'function' && activePageId() !== 'homePage') {
      showPage('homePage');
    }

    if (typeof renderMartyrs === 'function') {
      renderMartyrs();
    }

    updateFilterButtonsState();
    updateStatsCardsState();

    if (type === 'verified') {
      showToast(verifiedMessage);
    }

    if (type === 'pending') {
      showToast(pendingMessage);
    }
  }

  function clearStatsFilter() {
    activeStatsFilter = '';

    resetMartyrsPageSafe();

    if (typeof renderMartyrs === 'function') {
      renderMartyrs();
    }

    updateFilterButtonsState();
    updateStatsCardsState();

    showToast('تم إلغاء الفلترة، يتم الآن عرض جميع الأسماء.');
  }

  function filterListByActiveStats(list) {
    if (!Array.isArray(list)) return list;

    if (activeStatsFilter === 'verified') {
      return list.filter(isVerifiedItem);
    }

    if (activeStatsFilter === 'pending') {
      return list.filter(isPendingItem);
    }

    return list;
  }

  /*
    نغلف renderMartyrs:
    إذا كان فلتر الإحصائيات مفعلًا، نجعل renderMartyrs يرى قائمة مفلترة مؤقتًا.
  */
  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__homeStatsClickFilterWrapped) {
    window.renderMartyrs = function(customList) {
      if (!isFilterActive()) {
        return oldRenderMartyrs.apply(this, arguments);
      }

      if (Array.isArray(customList)) {
        const filteredCustom = filterListByActiveStats(customList);
        return oldRenderMartyrs.call(this, filteredCustom);
      }

      let originalAllMartyrs = null;

      try {
        originalAllMartyrs = allMartyrs;

        if (Array.isArray(allMartyrs)) {
          allMartyrs = filterListByActiveStats(allMartyrs);
        }

        return oldRenderMartyrs.apply(this, arguments);
      } finally {
        try {
          if (originalAllMartyrs) {
            allMartyrs = originalAllMartyrs;
          }
        } catch (e) {}
      }
    };

    window.renderMartyrs.__homeStatsClickFilterWrapped = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  function isVerifiedStatsCard(el) {
    const text = normalizeText(el.textContent);

    return (
      text.includes('الموثق') ||
      text.includes('موثقين') ||
      text.includes('تم التوثق') ||
      text.includes('تم التحقق')
    ) && !text.includes('بانتظار');
  }

  function isPendingStatsCard(el) {
    const text = normalizeText(el.textContent);

    return (
      text.includes('بانتظار التوثيق') ||
      text.includes('بانتظار التوثق') ||
      text.includes('قيد التدقيق') ||
      text.includes('يتم تدقيقها') ||
      text.includes('أسماء يتم تدقيقها')
    );
  }

  function getPossibleStatsCards() {
    return Array.from(document.querySelectorAll(`
      .stat-card,
      .stats-card,
      .home-stat-card,
      .dashboard-stat-card,
      .stats-grid > *,
      .stats-row > *,
      .hero-stats > *,
      .quick-stats > *,
      .stat-item
    `));
  }

  function installStatsCardsClickHandlers() {
    getPossibleStatsCards().forEach(function(card) {
      if (card.dataset.homeStatsFilterInstalled === '1') return;

      if (!isVerifiedStatsCard(card) && !isPendingStatsCard(card)) return;

      card.dataset.homeStatsFilterInstalled = '1';
      card.classList.add('home-stats-filter-card');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'اضغط لتطبيق الفلتر';

      card.addEventListener('click', function(event) {
        if (isVerifiedStatsCard(card)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          applyStatsFilter('verified');
          return;
        }

        if (isPendingStatsCard(card)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          applyStatsFilter('pending');
        }
      }, true);

      card.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();

        if (isVerifiedStatsCard(card)) {
          applyStatsFilter('verified');
          return;
        }

        if (isPendingStatsCard(card)) {
          applyStatsFilter('pending');
        }
      });
    });

    updateStatsCardsState();
  }

  function updateStatsCardsState() {
    getPossibleStatsCards().forEach(function(card) {
      card.classList.remove('home-stats-filter-active');

      if (activeStatsFilter === 'verified' && isVerifiedStatsCard(card)) {
        card.classList.add('home-stats-filter-active');
      }

      if (activeStatsFilter === 'pending' && isPendingStatsCard(card)) {
        card.classList.add('home-stats-filter-active');
      }
    });
  }

  function isHomeFilterButton(btn) {
    if (!btn) return false;

    const text = normalizeText(btn.textContent);
    const html = String(btn.innerHTML || '');

    const looksLikeFilter =
      text.includes('فلترة') ||
      text.includes('إجراءات الفلترة') ||
      html.includes('fa-filter');

    if (!looksLikeFilter) return false;

    return !!btn.closest('#homePage, .mobile-search-filter, .desktop-filter-card, .compact-search-bar, .search-filter-bar');
  }

  function getFilterButtons() {
    return Array.from(document.querySelectorAll('button')).filter(isHomeFilterButton);
  }

  function updateFilterButtonsState() {
    getFilterButtons().forEach(function(btn) {
      if (!originalFilterButtons.has(btn)) {
        originalFilterButtons.set(btn, btn.innerHTML);
      }

      if (isFilterActive()) {
        btn.classList.add('stats-filter-cancel-mode');
        btn.title = 'إلغاء الفلترة';

        const isIconOnly = normalizeText(btn.textContent).length <= 2;

        btn.innerHTML = isIconOnly
          ? `<i class="fa-solid fa-xmark"></i>`
          : `<i class="fa-solid fa-xmark ms-1"></i> إلغاء الفلترة`;
      } else {
        btn.classList.remove('stats-filter-cancel-mode');
        btn.title = 'إجراءات الفلترة';

        const original = originalFilterButtons.get(btn);
        if (original) btn.innerHTML = original;
      }
    });
  }

  /*
    عند تفعيل فلتر الإحصائيات، زر الفلترة يتحول إلى إلغاء.
    نلتقط الضغط عليه قبل أن يفتح مودال الفلترة القديم.
  */
  document.addEventListener('click', function(event) {
    if (!isFilterActive()) return;

    const btn = event.target.closest?.('button');

    if (!btn || !isHomeFilterButton(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearStatsFilter();
  }, true);

  /*
    إذا تم فتح الصفحة أو أعيد رسم الإحصائيات، نعيد تثبيت الأحداث.
  */
  const oldUpdateStatsCards =
    window.updateStatsCards ||
    (typeof updateStatsCards === 'function' ? updateStatsCards : null);

  if (typeof oldUpdateStatsCards === 'function' && !oldUpdateStatsCards.__homeStatsClickFilterWrapped) {
    window.updateStatsCards = function() {
      const result = oldUpdateStatsCards.apply(this, arguments);

      setTimeout(installStatsCardsClickHandlers, 0);
      requestAnimationFrame(installStatsCardsClickHandlers);

      return result;
    };

    window.updateStatsCards.__homeStatsClickFilterWrapped = true;

    try {
      updateStatsCards = window.updateStatsCards;
    } catch (e) {}
  }

  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__homeStatsClickFilterWrapped) {
    window.showPage = function(pageId) {
      const result = oldShowPage.apply(this, arguments);

      if (pageId === 'homePage') {
        setTimeout(function() {
          installStatsCardsClickHandlers();
          updateFilterButtonsState();
        }, 120);
      }

      return result;
    };

    window.showPage.__homeStatsClickFilterWrapped = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }

  window.clearHomeStatsStatusFilter = clearStatsFilter;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(installStatsCardsClickHandlers, 500);
      setTimeout(updateFilterButtonsState, 600);
    });
  } else {
    setTimeout(installStatsCardsClickHandlers, 500);
    setTimeout(updateFilterButtonsState, 600);
  }

  setTimeout(installStatsCardsClickHandlers, 1200);
})();
