(function() {
  'use strict';

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function isRejectedStatus(value) {
    return String(value || '').trim() === 'مرفوض';
  }

  function getMartyrIdFromCard(card) {
    if (!card) return '';

    if (card.dataset?.taldoHomeCardId) {
      return card.dataset.taldoHomeCardId;
    }

    const onclick = card.getAttribute('onclick') || '';
    const match = onclick.match(/openMartyrDetails\(['"]([^'"]+)['"]/);

    return match && match[1] ? match[1] : '';
  }

  function findMartyrById(martyrId) {
    if (!martyrId) return null;

    const lists = [];

    try {
      if (Array.isArray(dashboardData)) lists.push(dashboardData);
    } catch (e) {}

    try {
      if (Array.isArray(allMartyrs)) lists.push(allMartyrs);
    } catch (e) {}

    for (const list of lists) {
      const item = list.find(function(row) {
        return String(row?.martyr_id || '') === String(martyrId);
      });

      if (item) return item;
    }

    return null;
  }

  function markRejectedCards() {
    const cards = document.querySelectorAll(`
      .martyr-card,
      .list-item,
      [data-taldo-home-card-id]
    `);

    cards.forEach(function(card) {
      card.classList.remove('taldo-admin-rejected-card');

      if (!isAdminMode()) return;

      const martyrId = getMartyrIdFromCard(card);
      const item = findMartyrById(martyrId);

      if (!item) return;

      const status =
        item.verification_status ||
        item.status ||
        item.verificationStatus ||
        '';

      if (isRejectedStatus(status)) {
        card.classList.add('taldo-admin-rejected-card');
        card.setAttribute('data-rejected-label', 'مرفوض');
      }
    });
  }

  function scheduleMarkRejectedCards() {
    setTimeout(markRejectedCards, 0);
    requestAnimationFrame(markRejectedCards);
    setTimeout(markRejectedCards, 180);
  }

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__adminRejectedOverlayWrapped) {
    window.renderMartyrs = function() {
      const result = oldRenderMartyrs.apply(this, arguments);
      scheduleMarkRejectedCards();
      return result;
    };

    window.renderMartyrs.__adminRejectedOverlayWrapped = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  const oldOpenFamilyMartyrs =
    window.openFamilyMartyrs ||
    (typeof openFamilyMartyrs === 'function' ? openFamilyMartyrs : null);

  if (typeof oldOpenFamilyMartyrs === 'function' && !oldOpenFamilyMartyrs.__adminRejectedOverlayWrapped) {
    window.openFamilyMartyrs = function() {
      const result = oldOpenFamilyMartyrs.apply(this, arguments);
      scheduleMarkRejectedCards();
      return result;
    };

    window.openFamilyMartyrs.__adminRejectedOverlayWrapped = true;

    try {
      openFamilyMartyrs = window.openFamilyMartyrs;
    } catch (e) {}
  }

  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__adminRejectedOverlayWrapped) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);
      scheduleMarkRejectedCards();
      return result;
    };

    window.updateAdminButtons.__adminRejectedOverlayWrapped = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  const observer = new MutationObserver(function() {
    scheduleMarkRejectedCards();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      scheduleMarkRejectedCards();

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  } else {
    scheduleMarkRejectedCards();

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
