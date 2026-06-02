(function() {
  'use strict';

  function normalizeDashboardActionHeader() {
    const header = document.querySelector('#dashboardMartyrsTab table thead th:nth-child(6)');
    if (header) header.textContent = 'إجراء';
  }

  function ensureDashboardMobileActionButtons() {
    normalizeDashboardActionHeader();

    const rows = document.querySelectorAll('#dashboardMartyrsTab tbody tr');
    rows.forEach(row => {
      const lastCell = row.querySelector('td:nth-child(6)');
      if (!lastCell) return;

      const desktopActions = lastCell.querySelector('.dashboard-desktop-actions');
      const existingMobileBtn = lastCell.querySelector('.dashboard-mobile-action-btn');
      if (existingMobileBtn) return;

      const viewBtn = desktopActions ? desktopActions.querySelector('button[onclick*="openMartyrDetails"]') : null;
      const onclickText = viewBtn ? (viewBtn.getAttribute('onclick') || '') : '';
      const match = onclickText.match(/openMartyrDetails\('([^']+)'/);
      const martyrId = match && match[1] ? match[1] : '';
      if (!martyrId || typeof window.openDashboardActionModalFinal !== 'function') return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-primary dashboard-mobile-action-btn';
      btn.textContent = 'إجراء';
      btn.onclick = function(event) {
        window.openDashboardActionModalFinal(martyrId, event);
      };
      lastCell.appendChild(btn);
    });
  }

  const previousRenderDashboardTable = window.renderDashboardTable || (typeof renderDashboardTable === 'function' ? renderDashboardTable : null);
  if (typeof previousRenderDashboardTable === 'function' && !previousRenderDashboardTable.__actionScrollHotfixWrapped) {
    window.renderDashboardTable = function() {
      const result = previousRenderDashboardTable.apply(this, arguments);
      setTimeout(ensureDashboardMobileActionButtons, 0);
      return result;
    };
    window.renderDashboardTable.__actionScrollHotfixWrapped = true;
    try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function() {
    ensureDashboardMobileActionButtons();
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setTimeout(ensureDashboardMobileActionButtons, 100);
  }
})();
