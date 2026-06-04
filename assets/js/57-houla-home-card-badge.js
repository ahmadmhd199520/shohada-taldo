(function() {
  const BADGE_CLASS = 'taldo-houla-home-card-badge';
  const STYLE_ID = 'taldoHoulaHomeCardBadgeStyles';

  function normalizeArabicText(value) {
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

    const raw =
      item.is_houla_massacre ??
      item.houla_massacre ??
      item.massacre_houla ??
      item.houlaMassacre ??
      item.massacre ??
      '';

    const value = normalizeArabicText(raw);

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
      'hula',
      'massacre'
    ].includes(value);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #martyrsContainer .martyr-card .${BADGE_CLASS} {
        position: absolute !important;
        top: 8px !important;
        inset-inline-end: 8px !important;
        width: 34px !important;
        height: 34px !important;
        border-radius: 50% !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 232, 236, 0.96) !important;
        color: #d02f4d !important;
        border: 1px solid rgba(208, 47, 77, 0.20) !important;
        box-shadow: 0 7px 18px rgba(208, 47, 77, 0.22) !important;
        z-index: 8 !important;
        pointer-events: none !important;
        line-height: 1 !important;
      }

      #martyrsContainer .martyr-card .${BADGE_CLASS} i {
        font-size: 1rem !important;
        line-height: 1 !important;
      }

      @media (max-width: 576px) {
        #martyrsContainer .martyr-card .${BADGE_CLASS} {
          top: 7px !important;
          inset-inline-end: 7px !important;
          width: 28px !important;
          height: 28px !important;
        }

        #martyrsContainer .martyr-card .${BADGE_CLASS} i {
          font-size: .86rem !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getMartyrCollections() {
    const collections = [];

    try {
      if (Array.isArray(window.allMartyrs)) collections.push(window.allMartyrs);
      if (Array.isArray(window.dashboardData)) collections.push(window.dashboardData);
      if (Array.isArray(window.currentMartyrs)) collections.push(window.currentMartyrs);
      if (Array.isArray(window.filteredMartyrs)) collections.push(window.filteredMartyrs);
      if (Array.isArray(window.__taldoLatestMartyrs)) collections.push(window.__taldoLatestMartyrs);
    } catch (error) {}

    try {
      if (Array.isArray(allMartyrs)) collections.push(allMartyrs);
      if (Array.isArray(dashboardData)) collections.push(dashboardData);
      if (Array.isArray(currentMartyrs)) collections.push(currentMartyrs);
      if (Array.isArray(filteredMartyrs)) collections.push(filteredMartyrs);
    } catch (error) {}

    return collections;
  }

  function buildMartyrMap() {
    const map = new Map();

    getMartyrCollections().forEach(list => {
      (Array.isArray(list) ? list : []).forEach(item => {
        if (!item || !item.martyr_id) return;
        map.set(String(item.martyr_id), item);
      });
    });

    return map;
  }

  function extractMartyrIdFromCard(card) {
    if (!card) return '';

    const dataId = card.getAttribute('data-taldo-home-card-id') || card.dataset?.taldoHomeCardId || '';
    if (dataId) return dataId;

    const onclick = card.getAttribute('onclick') || '';
    const match = onclick.match(/openMartyrDetails\(['"]([^'"]+)['"]/);
    return match && match[1] ? match[1] : '';
  }

  function applyHoulaHomeCardBadges() {
    ensureStyles();

    const container = document.getElementById('martyrsContainer');
    if (!container) return;

    const martyrMap = buildMartyrMap();
    if (!martyrMap.size) return;

    container.querySelectorAll('.martyr-card').forEach(card => {
      const martyrId = extractMartyrIdFromCard(card);
      const item = martyrId ? martyrMap.get(String(martyrId)) : null;
      const oldBadge = card.querySelector('.' + BADGE_CLASS);

      if (!isHoulaMassacreMartyr(item)) {
        oldBadge?.remove();
        return;
      }

      if (oldBadge) return;

      const badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.title = 'من شهداء مجزرة الحولة';
      badge.setAttribute('aria-label', 'من شهداء مجزرة الحولة');
      badge.innerHTML = '<i class="fa-solid fa-ribbon" aria-hidden="true"></i>';

      card.insertAdjacentElement('afterbegin', badge);
    });
  }

  function scheduleApply() {
    clearTimeout(window.__taldoHoulaHomeBadgeTimer);
    window.__taldoHoulaHomeBadgeTimer = setTimeout(applyHoulaHomeCardBadges, 80);
  }

  function wrapRenderers() {
    const renderMartyrsFn = window.renderMartyrs || (typeof renderMartyrs === 'function' ? renderMartyrs : null);
    if (typeof renderMartyrsFn === 'function' && renderMartyrsFn.__houlaHomeBadgeWrapped !== true) {
      const wrapped = function() {
        const result = renderMartyrsFn.apply(this, arguments);
        scheduleApply();
        setTimeout(applyHoulaHomeCardBadges, 300);
        return result;
      };
      wrapped.__houlaHomeBadgeWrapped = true;
      window.renderMartyrs = wrapped;
      try { renderMartyrs = wrapped; } catch (error) {}
    }
  }

  function observeHomeCards() {
    const container = document.getElementById('martyrsContainer');
    if (!container || container.dataset.houlaHomeBadgeObserver === '1') return;

    container.dataset.houlaHomeBadgeObserver = '1';
    const observer = new MutationObserver(scheduleApply);
    observer.observe(container, { childList: true, subtree: true });
  }

  function boot() {
    ensureStyles();
    wrapRenderers();
    observeHomeCards();
    applyHoulaHomeCardBadges();
    setTimeout(applyHoulaHomeCardBadges, 500);
    setTimeout(applyHoulaHomeCardBadges, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.applyHoulaHomeCardBadges = applyHoulaHomeCardBadges;
})();
