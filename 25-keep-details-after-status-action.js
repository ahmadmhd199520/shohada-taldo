(function() {
  'use strict';

  function getActivePageIdFinal() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getCurrentDetailsItemFinal() {
    try {
      return currentDetailsItem || null;
    } catch (e) {
      return null;
    }
  }

  function getLastPageBeforeDetailsFinal() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function setLastPageBeforeDetailsFinal(value) {
    try {
      lastPageBeforeDetails = value || 'homePage';
    } catch (e) {}
  }

  function updateLocalMartyrStatusFinal(martyrId, fields) {
    const updater = function(list) {
      if (!Array.isArray(list)) return;

      const item = list.find(row => String(row.martyr_id || '') === String(martyrId || ''));

      if (item) {
        Object.assign(item, fields || {});
        item.updated_at = item.updated_at || new Date().toISOString();
      }
    };

    try {
      updater(allMartyrs);
    } catch (e) {}

    try {
      updater(dashboardData);
    } catch (e) {}

    try {
      if (currentDetailsItem && String(currentDetailsItem.martyr_id || '') === String(martyrId || '')) {
        Object.assign(currentDetailsItem, fields || {});
        currentDetailsItem.updated_at = currentDetailsItem.updated_at || new Date().toISOString();
      }
    } catch (e) {}
  }

  function keepCurrentDetailsPageFinal(martyrId, fromPage) {
    const safeFromPage = fromPage || getLastPageBeforeDetailsFinal() || 'homePage';

    setLastPageBeforeDetailsFinal(safeFromPage);

    if (typeof openMartyrDetails === 'function') {
      openMartyrDetails(martyrId, safeFromPage, true);
      setLastPageBeforeDetailsFinal(safeFromPage);
      return;
    }

    if (typeof showPage === 'function') {
      showPage('detailsPage');
      setLastPageBeforeDetailsFinal(safeFromPage);
    }
  }

  function refreshDataQuietlyFinal() {
    setTimeout(function() {
      try {
        if (typeof refreshDashboardData === 'function' && isAdminLoggedIn) {
          refreshDashboardData(false, {
            forceFresh: true,
            useClientCache: false
          });
        }
      } catch (e) {}

      try {
        if (typeof renderMartyrs === 'function') renderMartyrs();
      } catch (e) {}

      try {
        if (typeof renderDashboardTable === 'function') renderDashboardTable();
      } catch (e) {}

      try {
        if (typeof updateStatsCards === 'function') updateStatsCards();
      } catch (e) {}

      try {
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
      } catch (e) {}
    }, 120);
  }

  function setDetailsActionButtonsLoadingFinal(isLoading) {
    const box = document.querySelector('#detailsPage .admin-box');
    if (!box) return;

    box.querySelectorAll('button').forEach(btn => {
      btn.disabled = !!isLoading;
    });
  }

  window.updateStatusFromDetails = function(martyrId, status) {
    if (!martyrId) {
      showToast('معرّف الشهيد غير موجود.');
      return;
    }

    const fromPage = getLastPageBeforeDetailsFinal();
    const notes = document.getElementById('reviewerNotes')?.value || '';

    setDetailsActionButtonsLoadingFinal(true);

    const runner = function() {
      return apiRequest('updateVerificationStatus', {
        martyrId,
        newStatus: status,
        reviewerNotes: notes
      })
        .then(function(res) {
          if (!res || res.success === false) {
            showToast(res?.message || 'تعذر تحديث الحالة.');
            return;
          }

          updateLocalMartyrStatusFinal(martyrId, {
            verification_status: status,
            updated_at: new Date().toISOString()
          });

          showToast(res.message || 'تم تحديث الحالة.');

          keepCurrentDetailsPageFinal(martyrId, fromPage);
          refreshDataQuietlyFinal();
        })
        .catch(function(err) {
          showToast(err.message || 'تعذر تحديث الحالة.');
        })
        .finally(function() {
          setDetailsActionButtonsLoadingFinal(false);
          setLastPageBeforeDetailsFinal(fromPage);
        });
    };

    return typeof runWithoutScrollJump === 'function'
      ? runWithoutScrollJump(runner)
      : runner();
  };

  window.verifyWithCompletionFromDetails = function(martyrId) {
    if (!martyrId) {
      showToast('معرّف الشهيد غير موجود.');
      return;
    }

    const fromPage = getLastPageBeforeDetailsFinal();
    const notes = document.getElementById('reviewerNotes')?.value || '';

    setDetailsActionButtonsLoadingFinal(true);

    const runner = function() {
      return apiRequest('verifyMartyrWithCompletion', {
        martyrId,
        reviewerNotes: notes
      })
        .then(function(res) {
          if (!res || res.success === false) {
            showToast(res?.message || 'تعذر تحديث الحالة.');
            return;
          }

          updateLocalMartyrStatusFinal(martyrId, {
            verification_status: 'موثق',
            needs_completion: 'نعم',
            allow_updates: 'نعم',
            updated_at: new Date().toISOString()
          });

          showToast(res.message || 'تم التوثيق مع طلب الاستكمال.');

          keepCurrentDetailsPageFinal(martyrId, fromPage);
          refreshDataQuietlyFinal();
        })
        .catch(function(err) {
          showToast(err.message || 'تعذر تحديث الحالة.');
        })
        .finally(function() {
          setDetailsActionButtonsLoadingFinal(false);
          setLastPageBeforeDetailsFinal(fromPage);
        });
    };

    return typeof runWithoutScrollJump === 'function'
      ? runWithoutScrollJump(runner)
      : runner();
  };

  try {
    updateStatusFromDetails = window.updateStatusFromDetails;
  } catch (e) {}

  try {
    verifyWithCompletionFromDetails = window.verifyWithCompletionFromDetails;
  } catch (e) {}
})();
