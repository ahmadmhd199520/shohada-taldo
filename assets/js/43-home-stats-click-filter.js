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
    return normalizeText(
      item?.verification_status ||
      item?.status ||
      item?.verificationStatus ||
      ''
    );
  }

  function isVerifiedItem(item) {
    const status = getStatusValue(item);

    return (
      status === 'موثق' ||
      status === 'تم التوثيق' ||
      status === 'verified'
    );
  }

  function isRejectedItem(item) {
    const status = getStatusValue(item);

    return (
      status === 'مرفوض' ||
      status === 'rejected'
    );
  }

  function isPendingItem(item) {
    const status = getStatusValue(item);

    /*
      الأهم هنا:
      أي اسم ليس موثقًا وليس مرفوضًا نعتبره قيد التدقيق.
      هذا يحل مشكلة اختلاف تسمية الحالة في الشيت:
      بانتظار التوثيق / بانتظار التوثق / قيد التدقيق / فارغة...
    */
    if (!isVerifiedItem(item) && !isRejectedItem(item)) {
      return true;
    }

    return (
      status === 'بانتظار التوثيق' ||
      status === 'بانتظار التوثق' ||
      status === 'قيد التدقيق' ||
      status === 'قيد المراجعة' ||
      status === 'بانتظار المراجعة' ||
      status === 'pending'
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

  function getMainSourceListForFilter() {
    /*
      إذا كان الأدمن مسجلًا، dashboardData قد تحتوي أسماء قيد التدقيق أكثر من allMartyrs.
      أما للزوار نعتمد على allMartyrs.
    */
    try {
      if (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) {
        return dashboardData;
      }
    } catch (e) {}

    try {
      return Array.isArray(allMartyrs) ? allMartyrs : [];
    } catch (e) {
      return [];
    }
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

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__homeStatsClickFilterWrappedV2) {
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

        const source = getMainSourceListForFilter();
        allMartyrs = filterListByActiveStats(source);

        return oldRenderMartyrs.apply(this, arguments);
      } finally {
        try {
          if (originalAllMartyrs) {
            allMartyrs = originalAllMartyrs;
          }
        } catch (e) {}
      }
    };

    window.renderMartyrs.__homeStatsClickFilterWrappedV2 = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  function isVerifiedStatsCard(el) {
    const text = normalizeText(el.textContent);

    return (
      (
        text.includes('الموثق') ||
        text.includes('موثقين') ||
        text.includes('تم التوثق') ||
        text.includes('تم التحقق')
      ) &&
      !text.includes('بانتظار') &&
      !text.includes('قيد')
    );
  }

  function isPendingStatsCard(el) {
    const text = normalizeText(el.textContent);

    return (
      text.includes('بانتظار التوثيق') ||
      text.includes('بانتظار التوثق') ||
      text.includes('قيد التدقيق') ||
      text.includes('قيد التحقق') ||
      text.includes('يتم تدقيقها') ||
      text.includes('أسماء يتم تدقيقها') ||
      text.includes('تحتاج للتوثيق') ||
      text.includes('غير موثقة')
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

    /*
      مهم:
      عندما يتحول الزر إلى X نضع عليه data attribute،
      لذلك يجب التعرف عليه من هذا الوسم وليس من الأيقونة فقط.
    */
    if (btn.dataset.statsFilterCancelButton === '1') return true;

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
        btn.dataset.statsFilterCancelButton = '1';
        btn.title = 'إلغاء الفلترة';

        /*
          المطلوب: يتحول الرمز إلى X فقط.
          لا نكتب عبارة "إلغاء الفلترة" كي يبقى شكله مثل زر الفلترة.
        */
        btn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      } else {
        btn.classList.remove('stats-filter-cancel-mode');
        delete btn.dataset.statsFilterCancelButton;
        btn.title = 'إجراءات الفلترة';

        const original = originalFilterButtons.get(btn);
        if (original) btn.innerHTML = original;
      }
    });
  }

  /*
    التقاط الضغط على X قبل وصوله إلى onclick القديم الذي يفتح مودال الفلترة.
  */
  document.addEventListener('click', function(event) {
    const btn = event.target.closest?.('button');

    if (!btn) return;

    if (btn.dataset.statsFilterCancelButton === '1') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      clearStatsFilter();
      return;
    }

    if (!isFilterActive()) return;

    if (!isHomeFilterButton(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearStatsFilter();
  }, true);

  const oldUpdateStatsCards =
    window.updateStatsCards ||
    (typeof updateStatsCards === 'function' ? updateStatsCards : null);

  if (typeof oldUpdateStatsCards === 'function' && !oldUpdateStatsCards.__homeStatsClickFilterWrappedV2) {
    window.updateStatsCards = function() {
      const result = oldUpdateStatsCards.apply(this, arguments);

      setTimeout(installStatsCardsClickHandlers, 0);
      requestAnimationFrame(installStatsCardsClickHandlers);

      return result;
    };

    window.updateStatsCards.__homeStatsClickFilterWrappedV2 = true;

    try {
      updateStatsCards = window.updateStatsCards;
    } catch (e) {}
  }

  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__homeStatsClickFilterWrappedV2) {
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

    window.showPage.__homeStatsClickFilterWrappedV2 = true;

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
