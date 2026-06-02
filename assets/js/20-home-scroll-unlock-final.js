(function() {
  'use strict';

  function hasOpenModal() {
    return !!document.querySelector('.modal.show');
  }

  function unlockPageScroll() {
    if (hasOpenModal()) return;

    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    document.documentElement.style.overflowY = '';
    document.body.style.overflowY = '';

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      if (!hasOpenModal()) backdrop.remove();
    });
  }

  document.addEventListener('hidden.bs.modal', function() {
    setTimeout(unlockPageScroll, 80);
    setTimeout(unlockPageScroll, 250);
  });

  const previousShowPage = window.showPage || (typeof showPage === 'function' ? showPage : null);
  if (typeof previousShowPage === 'function' && !previousShowPage.__scrollUnlockFinal) {
    const wrapped = function(pageId) {
      previousShowPage(pageId);
      setTimeout(unlockPageScroll, 80);
      setTimeout(unlockPageScroll, 300);
    };
    wrapped.__scrollUnlockFinal = true;
    window.showPage = wrapped;
    try { showPage = window.showPage; } catch (e) {}
  }

  function syncCompactSearchInitialValue() {
    const mobile = document.getElementById('mobileSearchInput');
    const desktop = document.getElementById('searchInput');
    if (mobile && desktop && !mobile.value && desktop.value) mobile.value = desktop.value;
  }

  document.addEventListener('DOMContentLoaded', function() {
    syncCompactSearchInitialValue();
    setTimeout(unlockPageScroll, 300);
    setTimeout(unlockPageScroll, 1200);
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    syncCompactSearchInitialValue();
    setTimeout(unlockPageScroll, 100);
  }
})();
