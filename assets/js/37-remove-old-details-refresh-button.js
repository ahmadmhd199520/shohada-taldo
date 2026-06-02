(function() {
  'use strict';

  function removeOldDetailsRefreshButton() {
    const detailsHeader = document.querySelector(
      '#detailsPage > .d-flex.justify-content-between.align-items-center.mb-3'
    );

    if (!detailsHeader) return;

    /*
      زر التحديث القديم يأتي غالبًا بهذا الكلاس:
      section-refresh-btn
      وهو يستدعي refreshCurrentSection.
    */
    detailsHeader.querySelectorAll('.section-refresh-btn').forEach(function(btn) {
      btn.remove();
    });

    /*
      احتياط إضافي:
      إذا تغير الكلاس وبقي onclick القديم.
    */
    detailsHeader.querySelectorAll('button[onclick*="refreshCurrentSection"]').forEach(function(btn) {
      btn.remove();
    });

    /*
      لا نحذف زر التحديث الجديد.
      الزر الجديد id="detailsRefreshBtn"
    */
  }

  function observeDetailsHeader() {
    const target = document.getElementById('detailsPage');

    if (!target) return;

    const observer = new MutationObserver(function() {
      removeOldDetailsRefreshButton();
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      removeOldDetailsRefreshButton();
      observeDetailsHeader();
    });
  } else {
    removeOldDetailsRefreshButton();
    observeDetailsHeader();
  }

  /*
    لأن الزر القديم يُضاف أحيانًا بعد تحميل الصفحة.
  */
  setTimeout(removeOldDetailsRefreshButton, 300);
  setTimeout(removeOldDetailsRefreshButton, 900);
  setTimeout(removeOldDetailsRefreshButton, 1800);
})();
