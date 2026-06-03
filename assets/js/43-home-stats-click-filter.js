(function() {
  'use strict';

  let activeStatsQuickFilter = '';
  const originalFilterButtonsHtml = new WeakMap();

  const VERIFIED_STATUS = 'موثق';
  const PENDING_STATUS = 'بانتظار التوثيق';

  const verifiedMessage = 'يتم الآن عرض أسماء الشهداء الذين تم التوثق من بياناتهم';

  const pendingMessage = 'يتم عرض أسماء الشهداء الذين يتم تدقيق بياناتهم، ستتمكن من فتح الصفحة الخاصة للشهيد بعد التوثق من صحة البيانات من فريق العمل.';

  function normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function resetPageCounters() {
    try { currentPage = 1; } catch (e) {}
    try { currentMartyrsPage = 1; } catch (e) {}
    try { martyrsCurrentPage = 1; } catch (e) {}

    try { window.currentPage = 1; } catch (e) {}
    try { window.currentMartyrsPage = 1; } catch (e) {}
    try { window.martyrsCurrentPage = 1; } catch (e) {}
  }

  function setSelectValueIfExists(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function setExistingStatusFilter(status) {
    /*
      هذه هي النقطة الأساسية:
      نستخدم فلتر المشروع الأصلي بدل فلتر جديد.
    */
    setSelectValueIfExists('statusFilter', status);
    setSelectValueIfExists('mobileStatusFilter', status);

    try {
      currentStatusFilter = status;
    } catch (e) {}

    resetPageCounters();

    if (typeof changeStatusFilter === 'function') {
      changeStatusFilter();
    } else if (typeof resetMartyrsPageAndRender === 'function') {
      resetMartyrsPageAndRender();
    } else if (typeof renderMartyrs === 'function') {
      renderMartyrs();
    }
  }

  function applyQuickStatusFilter(status) {
    activeStatsQuickFilter = status;

    if (activePageId() !== 'homePage' && typeof showPage === 'function') {
      showPage('homePage');
    }

    setExistingStatusFilter(status);

    updateFilterButtonIcon();
    markActiveStatsCard();

    if (status === VERIFIED_STATUS) {
      showToast(verifiedMessage);
    }

    if (status === PENDING_STATUS) {
      showToast(pendingMessage);
    }
  }

  function clearQuickStatusFilter() {
    activeStatsQuickFilter = '';

    setExistingStatusFilter('');

    updateFilterButtonIcon();
    markActiveStatsCard();

    showToast('تم إلغاء الفلترة، يتم الآن عرض جميع الأسماء.');
  }

  function findVerifiedStatsCard() {
    const countEl = document.getElementById('verifiedCount');

    if (countEl) {
      return countEl.closest('.stat-card, .stats-card, .home-stat-card, .dashboard-stat-card, .stat-item, .card') || countEl.parentElement;
    }

    return Array.from(document.querySelectorAll('.stat-card, .stats-card, .home-stat-card, .stat-item, .card')).find(function(card) {
      const text = normalizeText(card.textContent);
      return (
        (
          text.includes('الموثق') ||
          text.includes('تم التوثق') ||
          text.includes('موثق')
        ) &&
        !text.includes('بانتظار') &&
        !text.includes('قيد')
      );
    }) || null;
  }

  function findPendingStatsCard() {
    const countEl = document.getElementById('pendingCount');

    if (countEl) {
      return countEl.closest('.stat-card, .stats-card, .home-stat-card, .dashboard-stat-card, .stat-item, .card') || countEl.parentElement;
    }

    return Array.from(document.querySelectorAll('.stat-card, .stats-card, .home-stat-card, .stat-item, .card')).find(function(card) {
      const text = normalizeText(card.textContent);
      return (
        text.includes('بانتظار التوثيق') ||
        text.includes('بانتظار التوثق') ||
        text.includes('قيد التدقيق') ||
        text.includes('يتم تدقيقها') ||
        text.includes('أسماء يتم تدقيقها')
      );
    }) || null;
  }

  function installStatsCard(card, status) {
    if (!card || card.dataset.quickStatusFilterInstalled === '1') return;

    card.dataset.quickStatusFilterInstalled = '1';
    card.dataset.quickStatusValue = status;
    card.classList.add('home-stats-filter-card');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      applyQuickStatusFilter(status);
    }, true);

    card.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      applyQuickStatusFilter(status);
    });
  }

  function installStatsCards() {
    installStatsCard(findVerifiedStatsCard(), VERIFIED_STATUS);
    installStatsCard(findPendingStatsCard(), PENDING_STATUS);
    markActiveStatsCard();
  }

  function markActiveStatsCard() {
    document.querySelectorAll('.home-stats-filter-card').forEach(function(card) {
      card.classList.toggle(
        'home-stats-filter-active',
        activeStatsQuickFilter && card.dataset.quickStatusValue === activeStatsQuickFilter
      );
    });
  }

  function isFilterButton(btn) {
    if (!btn) return false;

    if (btn.dataset.quickStatsCancelFilter === '1') return true;

    const text = normalizeText(btn.textContent);
    const html = String(btn.innerHTML || '');

    return (
      text.includes('فلترة') ||
      text.includes('إجراءات الفلترة') ||
      html.includes('fa-filter')
    );
  }

  function getFilterButtons() {
    return Array.from(document.querySelectorAll('button')).filter(function(btn) {
      if (!isFilterButton(btn)) return false;

      return !!btn.closest('#homePage, .mobile-search-filter, .desktop-filter-card, .compact-search-bar, .search-filter-bar');
    });
  }

  function updateFilterButtonIcon() {
    getFilterButtons().forEach(function(btn) {
      if (!originalFilterButtonsHtml.has(btn)) {
        originalFilterButtonsHtml.set(btn, btn.innerHTML);
      }

      if (activeStatsQuickFilter) {
        btn.dataset.quickStatsCancelFilter = '1';
        btn.classList.add('stats-filter-cancel-mode');
        btn.title = 'إلغاء الفلترة';
        btn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;

        /*
          مهم جدًا:
          نلغي onclick القديم مؤقتًا حتى لا يفتح مودال الفلترة.
        */
        btn.dataset.oldOnclickQuickStats = btn.getAttribute('onclick') || '';
        btn.setAttribute('onclick', 'return false;');
      } else {
        delete btn.dataset.quickStatsCancelFilter;
        btn.classList.remove('stats-filter-cancel-mode');
        btn.title = 'إجراءات الفلترة';

        const originalHtml = originalFilterButtonsHtml.get(btn);
        if (originalHtml) btn.innerHTML = originalHtml;

        const oldOnclick = btn.dataset.oldOnclickQuickStats || '';

        if (oldOnclick) {
          btn.setAttribute('onclick', oldOnclick);
        } else {
          btn.removeAttribute('onclick');
        }

        delete btn.dataset.oldOnclickQuickStats;
      }
    });
  }

  /*
    نلتقط زر X قبل أي onclick قديم أو Bootstrap modal.
  */
  document.addEventListener('click', function(event) {
    const btn = event.target.closest?.('button[data-quick-stats-cancel-filter="1"]');

    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearQuickStatusFilter();
  }, true);

  const oldUpdateStatsCards =
    window.updateStatsCards ||
    (typeof updateStatsCards === 'function' ? updateStatsCards : null);

  if (typeof oldUpdateStatsCards === 'function' && !oldUpdateStatsCards.__quickStatusFilterUsingNativeFilter) {
    window.updateStatsCards = function() {
      const result = oldUpdateStatsCards.apply(this, arguments);

      setTimeout(installStatsCards, 0);
      requestAnimationFrame(installStatsCards);

      return result;
    };

    window.updateStatsCards.__quickStatusFilterUsingNativeFilter = true;

    try {
      updateStatsCards = window.updateStatsCards;
    } catch (e) {}
  }

  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__quickStatusFilterUsingNativeFilter) {
    window.showPage = function(pageId) {
      const result = oldShowPage.apply(this, arguments);

      if (pageId === 'homePage') {
        setTimeout(function() {
          installStatsCards();
          updateFilterButtonIcon();
        }, 150);
      }

      return result;
    };

    window.showPage.__quickStatusFilterUsingNativeFilter = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }

  window.clearHomeStatsStatusFilter = clearQuickStatusFilter;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(installStatsCards, 500);
      setTimeout(updateFilterButtonIcon, 700);
    });
  } else {
    setTimeout(installStatsCards, 500);
    setTimeout(updateFilterButtonIcon, 700);
  }

  setTimeout(installStatsCards, 1200);
})();
