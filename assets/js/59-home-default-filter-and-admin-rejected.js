(function() {
  'use strict';

  const VERIFIED_STATUS = 'موثق';
  const PENDING_STATUS = 'بانتظار التوثيق';
  const REJECTED_STATUS = 'مرفوض';
  const REJECTED_OPTION_CLASS = 'taldo-admin-rejected-status-option';

  let pendingPublicRowsLoaded = false;
  let pendingPublicRowsLoading = false;

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function statusOf(item) {
    return String(
      item?.verification_status ||
      item?.status ||
      item?.verificationStatus ||
      ''
    ).trim();
  }

  function isRejectedItem(item) {
    const status = statusOf(item);
    return status === REJECTED_STATUS || status === 'rejected';
  }

  function martyrKey(item, index) {
    return String(
      item?.martyr_id ||
      item?.id ||
      item?.row_id ||
      item?.full_name ||
      `__row_${index}`
    ).trim();
  }

  function normalizeRows(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.martyrs)) return res.martyrs;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  }

  function getStatusSelects() {
    return [
      document.getElementById('statusFilter'),
      document.getElementById('mobileStatusFilter')
    ].filter(Boolean);
  }

  function getSelectedStatus() {
    const statusFilter = document.getElementById('statusFilter');
    return statusFilter ? String(statusFilter.value || '').trim() : '';
  }

  function setStatusEverywhere(status) {
    getStatusSelects().forEach(function(select) {
      select.value = status || '';
    });

    try {
      currentStatusFilter = status || '';
    } catch (e) {}
  }

  function syncCurrentStatusFromSelect() {
    const status = getSelectedStatus();
    try {
      currentStatusFilter = status;
    } catch (e) {}
    return status;
  }

  function ensureRejectedOption(select) {
    if (!select) return;
    if (select.querySelector(`option.${REJECTED_OPTION_CLASS}`)) return;

    const option = document.createElement('option');
    option.value = REJECTED_STATUS;
    option.textContent = 'الأسماء المرفوضة';
    option.className = REJECTED_OPTION_CLASS;
    select.appendChild(option);
  }

  function removeRejectedOption(select) {
    if (!select) return;

    if (select.value === REJECTED_STATUS) {
      select.value = '';
    }

    select.querySelectorAll(`option.${REJECTED_OPTION_CLASS}`).forEach(function(option) {
      option.remove();
    });
  }

  function syncRejectedStatusOption() {
    const admin = isAdminMode();

    getStatusSelects().forEach(function(select) {
      if (admin) {
        ensureRejectedOption(select);
      } else {
        removeRejectedOption(select);
      }
    });

    if (!admin && getSelectedStatus() === REJECTED_STATUS) {
      setStatusEverywhere('');
    }
  }

  function mergePendingPublicRows(rows) {
    rows = normalizeRows(rows).filter(function(item) {
      return statusOf(item) === PENDING_STATUS;
    });

    if (!rows.length) return false;

    try {
      if (!Array.isArray(allMartyrs)) allMartyrs = [];
    } catch (e) {
      return false;
    }

    const existing = new Map();

    allMartyrs.forEach(function(item, index) {
      existing.set(martyrKey(item, index), item);
    });

    rows.forEach(function(item, index) {
      const key = martyrKey(item, index);
      if (existing.has(key)) {
        Object.assign(existing.get(key), item);
      } else {
        allMartyrs.push(item);
      }
    });

    return true;
  }

  function shouldLoadPublicPendingRows(status) {
    return !isAdminMode() && (status === '' || status === PENDING_STATUS);
  }

  function ensurePublicPendingRows(status) {
    if (!shouldLoadPublicPendingRows(status)) return;
    if (pendingPublicRowsLoaded || pendingPublicRowsLoading) return;
    if (typeof apiRequest !== 'function') return;

    pendingPublicRowsLoading = true;

    apiRequest('getMartyrsPublicData', { statusFilter: PENDING_STATUS })
      .then(function(res) {
        pendingPublicRowsLoaded = true;
        if (mergePendingPublicRows(res) && typeof window.renderMartyrs === 'function') {
          setTimeout(function() {
            window.renderMartyrs();
          }, 0);
        }
      })
      .catch(function() {})
      .finally(function() {
        pendingPublicRowsLoading = false;
      });
  }

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__homeDefaultFilterFixed) {
    window.renderMartyrs = function(customList) {
      syncRejectedStatusOption();
      const status = syncCurrentStatusFromSelect();

      const shouldHideRejected = status !== REJECTED_STATUS || !isAdminMode();
      let originalAllMartyrs = null;
      let safeCustomList = customList;

      try {
        if (shouldHideRejected) {
          if (Array.isArray(customList)) {
            safeCustomList = customList.filter(function(item) {
              return !isRejectedItem(item);
            });
          } else if (Array.isArray(allMartyrs)) {
            originalAllMartyrs = allMartyrs;
            allMartyrs = allMartyrs.filter(function(item) {
              return !isRejectedItem(item);
            });
          }
        }

        const result = oldRenderMartyrs.call(this, safeCustomList);
        ensurePublicPendingRows(status);
        return result;
      } finally {
        try {
          if (originalAllMartyrs) allMartyrs = originalAllMartyrs;
        } catch (e) {}
      }
    };

    window.renderMartyrs.__homeDefaultFilterFixed = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  const oldChangeStatusFilter =
    window.changeStatusFilter ||
    (typeof changeStatusFilter === 'function' ? changeStatusFilter : null);

  if (typeof oldChangeStatusFilter === 'function' && !oldChangeStatusFilter.__homeDefaultFilterFixed) {
    window.changeStatusFilter = function() {
      syncRejectedStatusOption();
      const status = syncCurrentStatusFromSelect();

      try {
        if (isAdminMode() && Array.isArray(dashboardData) && dashboardData.length) {
          if (status === REJECTED_STATUS) {
            allMartyrs = dashboardData.slice();
          } else if (status === '') {
            allMartyrs = dashboardData.filter(function(item) {
              return !isRejectedItem(item);
            });
          }
        }
      } catch (e) {}

      const result = oldChangeStatusFilter.apply(this, arguments);
      ensurePublicPendingRows(status);
      return result;
    };

    window.changeStatusFilter.__homeDefaultFilterFixed = true;

    try {
      changeStatusFilter = window.changeStatusFilter;
    } catch (e) {}
  }

  const oldOpenMobileFilterModal =
    window.openMobileFilterModal ||
    (typeof openMobileFilterModal === 'function' ? openMobileFilterModal : null);

  if (typeof oldOpenMobileFilterModal === 'function' && !oldOpenMobileFilterModal.__adminRejectedStatusSynced) {
    window.openMobileFilterModal = function() {
      syncRejectedStatusOption();
      return oldOpenMobileFilterModal.apply(this, arguments);
    };

    window.openMobileFilterModal.__adminRejectedStatusSynced = true;

    try {
      openMobileFilterModal = window.openMobileFilterModal;
    } catch (e) {}
  }

  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__adminRejectedStatusSynced) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);
      syncRejectedStatusOption();
      return result;
    };

    window.updateAdminButtons.__adminRejectedStatusSynced = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  function initHomeDefaultFilter() {
    syncRejectedStatusOption();

    const status = getSelectedStatus();
    if (!status) setStatusEverywhere('');

    ensurePublicPendingRows(getSelectedStatus());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initHomeDefaultFilter, 0);
      setTimeout(initHomeDefaultFilter, 700);
    });
  } else {
    setTimeout(initHomeDefaultFilter, 0);
    setTimeout(initHomeDefaultFilter, 700);
  }
})();
