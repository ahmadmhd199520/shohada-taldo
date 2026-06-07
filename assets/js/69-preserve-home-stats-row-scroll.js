(function () {
  'use strict';

  const ROW_SELECTOR = '.home-stats-row';

  function getStatsRow() {
    return document.querySelector(ROW_SELECTOR);
  }

  function rememberStatsRowScroll() {
    const row = getStatsRow();

    if (!row) {
      return null;
    }

    return {
      left: row.scrollLeft,
      top: row.scrollTop
    };
  }

  function restoreStatsRowScroll(saved) {
    if (!saved) return;

    const row = getStatsRow();

    if (!row) {
      return;
    }

    row.scrollLeft = saved.left;
    row.scrollTop = saved.top || 0;
  }

  function restoreStatsRowScrollSeveralTimes(saved) {
    if (!saved) return;

    restoreStatsRowScroll(saved);

    requestAnimationFrame(function () {
      restoreStatsRowScroll(saved);
    });

    setTimeout(function () {
      restoreStatsRowScroll(saved);
    }, 0);

    setTimeout(function () {
      restoreStatsRowScroll(saved);
    }, 80);

    setTimeout(function () {
      restoreStatsRowScroll(saved);
    }, 220);
  }

  function isStatsCardTarget(target) {
    if (!target || !target.closest) return false;

    return !!target.closest(
      '.home-stats-row .stat-card, ' +
      '.home-stats-row [data-taldo-extra-stat-filter], ' +
      '.home-stats-row button.card'
    );
  }

  document.addEventListener('click', function (event) {
    if (!isStatsCardTarget(event.target)) return;

    const saved = rememberStatsRowScroll();

    restoreStatsRowScrollSeveralTimes(saved);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!isStatsCardTarget(event.target)) return;

    const saved = rememberStatsRowScroll();

    restoreStatsRowScrollSeveralTimes(saved);
  }, true);

  window.taldoRememberHomeStatsRowScroll = rememberStatsRowScroll;
  window.taldoRestoreHomeStatsRowScroll = restoreStatsRowScrollSeveralTimes;
})();
