/* =====================================================
   TALDO EXTRA PATCH v06 - 2026-06-02
   ===================================================== */

/* ── Sticky search: IntersectionObserver sentinel ── */
(function initStickyObserver() {
  function observe(el) {
    if (!el) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:1px;margin-top:-1px;pointer-events:none;';
    el.parentNode.insertBefore(sentinel, el);
    const obs = new IntersectionObserver(([entry]) => {
      el.classList.toggle('is-stuck', !entry.isIntersecting);
    }, { threshold: 1, rootMargin: '-6px 0px 0px 0px' });
    obs.observe(sentinel);
  }
  function setupAll() {
    document.querySelectorAll('.unified-search-bar, .mobile-search-filter, .desktop-filter-card')
      .forEach(el => { if (!el.__stickyObserved) { el.__stickyObserved = true; observe(el); } });
  }
  if (document.readyState !== 'loading') setTimeout(setupAll, 400);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(setupAll, 400));
  window.__reinitStickyObserver = setupAll;
})();

/* ── Filter families stats by search input ── */
window.filterFamiliesStats = function() {
  const q = (document.getElementById('familiesSearchInput')?.value || '').trim().toLowerCase();
  const rows = document.querySelectorAll('#familiesStatsContainer .family-row, #familiesStatsContainer [data-family]');
  rows.forEach(row => {
    const text = (row.textContent || '').toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
};

/* ── Filter family martyrs by search input ── */
window.filterFamilyMartyrs = function() {
  const q = (document.getElementById('familyMartyrsSearchInput')?.value || '').trim();
  const norm = q.replace(/[\u0610-\u061A\u064B-\u065F]/g, '').toLowerCase();
  const cards = document.querySelectorAll('#familyMartyrsContainer .martyr-card, #familyMartyrsContainer .list-item');
  cards.forEach(card => {
    const text = (card.textContent || '').replace(/[\u0610-\u061A\u064B-\u065F]/g, '').toLowerCase();
    card.style.display = (!norm || text.includes(norm)) ? '' : 'none';
  });
};

/* ── Reinit sticky after every page change ── */
const _origShowPage = window.showPage;
if (typeof _origShowPage === 'function') {
  window.showPage = function(id) {
    _origShowPage.call(this, id);
    setTimeout(() => { if (window.__reinitStickyObserver) window.__reinitStickyObserver(); }, 200);
  };
}

/* ── Sync dashboard mobile search inputs ── */
(function patchDashboardMobileSync() {
  function syncDash() {
    const mob = document.getElementById('dashboardMobileSearchInput');
    const desk = document.getElementById('dashboardSearchInput');
    if (mob && desk) {
      mob.addEventListener('input', () => { desk.value = mob.value; if (window.renderDashboardTable) renderDashboardTable(); });
      desk.addEventListener('input', () => { mob.value = desk.value; });
    }
    const mobUpd = document.getElementById('dataUpdatesMobileSearchInput');
    if (mobUpd) {
      mobUpd.addEventListener('input', () => { if (window.renderDashboardTable) renderDashboardTable(); });
    }
  }
  if (document.readyState !== 'loading') setTimeout(syncDash, 600);
  else document.addEventListener('DOMContentLoaded', () => setTimeout(syncDash, 600));
})();

/* ── Suppress old ensureDashboardMobileControls duplication ── */
window.ensureDashboardMobileControls = function() {
  /* no-op: controls are now baked into dashboard.html */
  if (window.__reinitStickyObserver) setTimeout(window.__reinitStickyObserver, 100);
};

