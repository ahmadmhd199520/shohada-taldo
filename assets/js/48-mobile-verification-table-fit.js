(function() {
  'use strict';

  const STYLE_ID = 'taldoMobileVerificationTableFitStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      @media (max-width: 576px) {
        .taldo-mobile-verification-table-wrap {
          overflow-x: hidden !important;
          max-width: 100% !important;
        }

        .taldo-mobile-verification-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: separate !important;
          border-spacing: 0 6px !important;
        }

        .taldo-mobile-verification-table th,
        .taldo-mobile-verification-table td {
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          vertical-align: middle !important;
          padding: 7px 5px !important;
          font-size: 0.72rem !important;
          line-height: 1.45 !important;
        }

        .taldo-mobile-verification-table th {
          font-size: 0.68rem !important;
          font-weight: 800 !important;
        }

        /*
          توزيع الأعمدة الأربعة على عرض شاشة الجوال
          عدّل النسب إذا احتجت لاحقًا.
        */
        .taldo-mobile-verification-table th:nth-child(1),
        .taldo-mobile-verification-table td:nth-child(1) {
          width: 38% !important;
        }

        .taldo-mobile-verification-table th:nth-child(2),
        .taldo-mobile-verification-table td:nth-child(2) {
          width: 24% !important;
        }

        .taldo-mobile-verification-table th:nth-child(3),
        .taldo-mobile-verification-table td:nth-child(3) {
          width: 20% !important;
        }

        .taldo-mobile-verification-table th:nth-child(4),
        .taldo-mobile-verification-table td:nth-child(4) {
          width: 18% !important;
        }

        .taldo-mobile-verification-table .btn,
        .taldo-mobile-verification-table button {
          white-space: normal !important;
          font-size: 0.66rem !important;
          line-height: 1.25 !important;
          padding: 4px 5px !important;
          border-radius: 8px !important;
          max-width: 100% !important;
        }

        .taldo-mobile-verification-table .badge {
          white-space: normal !important;
          font-size: 0.62rem !important;
          line-height: 1.25 !important;
          padding: 4px 5px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function tableLooksLikeVerificationTable(table) {
    if (!table) return false;

    const headerText = normalizeText(
      Array.from(table.querySelectorAll('thead th, tr:first-child th'))
        .map(th => th.textContent)
        .join(' ')
    );

    const fullText = normalizeText(table.textContent || '');

    /*
      نبحث عن جدول التوثيقات من عناوينه الشائعة.
      الشرط مرن حتى يعمل حتى لو اختلفت تسمية أحد الأعمدة.
    */
    const hasName = headerText.includes('الاسم') || fullText.includes('الاسم');
    const hasFamily = headerText.includes('العائلة') || fullText.includes('العائلة');
    const hasStatus = headerText.includes('الحالة') || fullText.includes('التوثيق') || fullText.includes('موثق');
    const hasAction = headerText.includes('إجراء') || headerText.includes('الإجراءات') || fullText.includes('تحويل');

    return hasName && hasFamily && hasStatus && hasAction;
  }

  function markVerificationTables() {
    document.querySelectorAll('#dashboardPage table, table').forEach(function(table) {
      if (!tableLooksLikeVerificationTable(table)) return;

      table.classList.add('taldo-mobile-verification-table');

      const wrapper = table.closest('.table-responsive, .table-wrapper, .dataTables_wrapper, div');
      if (wrapper) {
        wrapper.classList.add('taldo-mobile-verification-table-wrap');
      }
    });
  }

  function boot() {
    installStyle();
    markVerificationTables();
  }

  const oldShowDashboardTab =
    window.showDashboardTab ||
    (typeof showDashboardTab === 'function' ? showDashboardTab : null);

  if (typeof oldShowDashboardTab === 'function' && !oldShowDashboardTab.__mobileVerificationFitWrapped) {
    window.showDashboardTab = function() {
      const result = oldShowDashboardTab.apply(this, arguments);

      setTimeout(markVerificationTables, 120);
      setTimeout(markVerificationTables, 400);

      return result;
    };

    window.showDashboardTab.__mobileVerificationFitWrapped = true;

    try {
      showDashboardTab = window.showDashboardTab;
    } catch (e) {}
  }

  const oldRenderDashboardTable =
    window.renderDashboardTable ||
    (typeof renderDashboardTable === 'function' ? renderDashboardTable : null);

  if (typeof oldRenderDashboardTable === 'function' && !oldRenderDashboardTable.__mobileVerificationFitWrapped) {
    window.renderDashboardTable = function() {
      const result = oldRenderDashboardTable.apply(this, arguments);

      setTimeout(markVerificationTables, 120);

      return result;
    };

    window.renderDashboardTable.__mobileVerificationFitWrapped = true;

    try {
      renderDashboardTable = window.renderDashboardTable;
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  setTimeout(boot, 800);
  setTimeout(markVerificationTables, 1600);
})();
