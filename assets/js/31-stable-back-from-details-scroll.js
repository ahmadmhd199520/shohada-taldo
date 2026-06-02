(function() {
  'use strict';

  const LAST_HOME_CARD_KEY = 'taldo_last_home_martyr_card_id';
  const LAST_HOME_SCROLL_FALLBACK_KEY = 'taldo_last_home_scroll_fallback';

  /*
    تنظيف مفاتيح السكرول القديمة التي كانت تحفظ أرقام بكسل
    وقد تسبب الصعود التدريجي مع كل تحديث.
  */
  try {
    sessionStorage.removeItem('taldo_home_scroll_before_details');
    sessionStorage.removeItem('taldo_home_scroll_before_details_stable');
  } catch (e) {}

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScroll() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function escapeAttrStable(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function saveHomeCardId(martyrId) {
    if (!martyrId) return;

    try {
      sessionStorage.setItem(LAST_HOME_CARD_KEY, String(martyrId));
      sessionStorage.setItem(LAST_HOME_SCROLL_FALLBACK_KEY, JSON.stringify(getScroll()));
    } catch (e) {}
  }

  function getSavedHomeCardId() {
    try {
      return sessionStorage.getItem(LAST_HOME_CARD_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getSavedFallbackScroll() {
    try {
      const saved = sessionStorage.getItem(LAST_HOME_SCROLL_FALLBACK_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  function setActivePageNoScroll(pageId) {
    document.querySelectorAll('.page-section').forEach(function(section) {
      section.classList.remove('active');
    });

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
  }

  function nativeScrollTo(x, y) {
    const fn = window.__taldoNativeScrollTo || window.scrollTo.bind(window);
    fn(Number(x || 0), Number(y || 0));
  }

  function findHomeCardById(martyrId) {
    if (!martyrId) return null;

    const cards = document.querySelectorAll('[data-taldo-home-card-id]');

    for (const card of cards) {
      if (String(card.dataset.taldoHomeCardId || '') === String(martyrId)) {
        return card;
      }
    }

    return null;
  }

  function scrollToHomeCardOrFallback() {
    const martyrId = getSavedHomeCardId();
    const card = findHomeCardById(martyrId);

    if (card) {
      const rect = card.getBoundingClientRect();
      const absoluteY = rect.top + (window.scrollY || window.pageYOffset || 0);

      /*
        نضع البطاقة في الثلث الأعلى تقريبًا، بدل الاعتماد على بكسل قديم.
      */
      const offset = Math.min(Math.round(window.innerHeight * 0.32), 230);
      const targetY = Math.max(0, absoluteY - offset);

      nativeScrollTo(0, targetY);
      return;
    }

    /*
      fallback فقط إذا لم نجد البطاقة، مثل حالة تغيّر الصفحة أو الفلاتر.
      نستخدمه مرة واحدة فقط وليس كسلوك أساسي.
    */
    const fallback = getSavedFallbackScroll();

    if (fallback && Number(fallback.y || 0) > 0) {
      nativeScrollTo(Number(fallback.x || 0), Number(fallback.y || 0));
    }
  }

  function renderHomeOnce() {
    try {
      if (typeof updateStatsCards === 'function') updateStatsCards();
    } catch (e) {}

    try {
      if (typeof renderMartyrs === 'function') renderMartyrs();
    } catch (e) {}
  }

  function patchRenderedCardHtml(html, item) {
    if (!item || !item.martyr_id || !html) return html;

    const id = escapeAttrStable(item.martyr_id);

    if (html.includes('data-taldo-home-card-id=')) {
      return html;
    }

    /*
      نضيف معرفًا للبطاقة حتى نستطيع الرجوع إليها لاحقًا.
    */
    return String(html).replace(
      /<div\s+class="([^"]*(?:martyr-card|list-item)[^"]*)"/,
      `<div data-taldo-home-card-id="${id}" class="$1"`
    );
  }

  /*
    نضيف data attribute إلى بطاقات الرئيسية وقائمة العرض.
  */
  const oldRenderMartyrCard =
    window.renderMartyrCard ||
    (typeof renderMartyrCard === 'function' ? renderMartyrCard : null);

  if (typeof oldRenderMartyrCard === 'function' && !oldRenderMartyrCard.__stableCardIdWrapped) {
    window.renderMartyrCard = function(item) {
      const html = oldRenderMartyrCard.apply(this, arguments);
      return patchRenderedCardHtml(html, item);
    };

    window.renderMartyrCard.__stableCardIdWrapped = true;

    try {
      renderMartyrCard = window.renderMartyrCard;
    } catch (e) {}
  }

  const oldRenderMartyrListItem =
    window.renderMartyrListItem ||
    (typeof renderMartyrListItem === 'function' ? renderMartyrListItem : null);

  if (typeof oldRenderMartyrListItem === 'function' && !oldRenderMartyrListItem.__stableCardIdWrapped) {
    window.renderMartyrListItem = function(item) {
      const html = oldRenderMartyrListItem.apply(this, arguments);
      return patchRenderedCardHtml(html, item);
    };

    window.renderMartyrListItem.__stableCardIdWrapped = true;

    try {
      renderMartyrListItem = window.renderMartyrListItem;
    } catch (e) {}
  }

  /*
    نلتقط الضغط على البطاقة مباشرة قبل فتح صفحة الشهيد.
    هذا أدق من الاعتماد على تغليف openMartyrDetails فقط.
  */
  document.addEventListener('click', function(event) {
    if (activePageId() !== 'homePage') return;

    const card = event.target.closest?.('[data-taldo-home-card-id], .martyr-card, .list-item');

    if (!card) return;

    let martyrId = card.dataset?.taldoHomeCardId || '';

    if (!martyrId) {
      const onclick = card.getAttribute('onclick') || '';
      const match = onclick.match(/openMartyrDetails\('([^']+)'/);
      martyrId = match && match[1] ? match[1] : '';
    }

    if (martyrId) {
      saveHomeCardId(martyrId);
    }
  }, true);

  /*
    احتياط إضافي: لو تم فتح صفحة الشهيد من دالة مباشرة.
  */
  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__stableBackCardSaveWrapped) {
    window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
      if ((fromPage === 'homePage' || activePageId() === 'homePage') && martyrId) {
        saveHomeCardId(martyrId);
      }

      return oldOpenMartyrDetails.apply(this, arguments);
    };

    window.openMartyrDetails.__stableBackCardSaveWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  function stableBackHome() {
    /*
      لا نستدعي showPage('homePage') هنا، لأنه يصعد للأعلى.
    */
    setActivePageNoScroll('homePage');

    try {
      lastPageBeforeDetails = 'homePage';
    } catch (e) {}

    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.pushState({ page: 'home' }, '', cleanUrl);
    } catch (e) {}

    renderHomeOnce();

    /*
      بعد الرندر مباشرة نبحث عن البطاقة ونذهب إليها.
      نكرر مرة واحدة فقط بعد 160ms إذا تأخر الرندر أو الصور.
    */
    requestAnimationFrame(function() {
      scrollToHomeCardOrFallback();
    });

    setTimeout(function() {
      if (activePageId() === 'homePage') {
        scrollToHomeCardOrFallback();
      }
    }, 160);
  }

  const oldGoBackFromDetails =
    window.goBackFromDetails ||
    (typeof goBackFromDetails === 'function' ? goBackFromDetails : null);

  window.goBackFromDetails = function() {
    let last = 'homePage';

    try {
      last = lastPageBeforeDetails || 'homePage';
    } catch (e) {}

    if (last === 'homePage') {
      stableBackHome();
      return;
    }

    if (typeof oldGoBackFromDetails === 'function') {
      return oldGoBackFromDetails.apply(this, arguments);
    }

    setActivePageNoScroll('homePage');
  };

  try {
    goBackFromDetails = window.goBackFromDetails;
  } catch (e) {}
})();
