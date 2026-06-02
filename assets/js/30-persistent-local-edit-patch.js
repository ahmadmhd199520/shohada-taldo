(function() {
  'use strict';

  const PATCH_LIFETIME = 5 * 60 * 1000;
  const pendingEdits = window.__taldoPendingMartyrEdits || {};

  window.__taldoPendingMartyrEdits = pendingEdits;

  function now() {
    return Date.now();
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function cleanOldPatches() {
    const current = now();

    Object.keys(pendingEdits).forEach(function(id) {
      const entry = pendingEdits[id];

      if (!entry || !entry.savedAt || current - entry.savedAt > PATCH_LIFETIME) {
        delete pendingEdits[id];
      }
    });
  }

  function normalizePatchPayload(payload) {
    const cleaned = Object.assign({}, payload || {});

    delete cleaned.imageFiles;
    delete cleaned.imageBase64;
    delete cleaned.imageName;

    cleaned.updated_at = new Date().toISOString();

    return cleaned;
  }

  function rememberEditPatch(payload) {
    if (!payload || !payload.martyr_id) return;

    pendingEdits[String(payload.martyr_id)] = {
      savedAt: now(),
      fields: normalizePatchPayload(payload)
    };
  }

  function invalidatePreparedFields(item) {
    if (!item) return;

    item.__perfPrepared = false;
    item.__dashboardPrepared = false;
    item.__requestPrepared = false;

    try {
      delete item.__searchText;
      delete item.__familyKey;
      delete item.__createdSort;
      delete item.__dashboardSearch;
      delete item.__statusKey;
      delete item.__familyLower;
    } catch (e) {}
  }

  function patchItem(item, fields) {
    if (!item || !fields) return false;

    Object.assign(item, fields);
    invalidatePreparedFields(item);

    return true;
  }

  function patchList(list) {
    if (!Array.isArray(list)) return false;

    let changed = false;

    Object.keys(pendingEdits).forEach(function(martyrId) {
      const entry = pendingEdits[martyrId];
      if (!entry || !entry.fields) return;

      const item = list.find(function(row) {
        return String(row?.martyr_id || '') === String(martyrId);
      });

      if (item) {
        patchItem(item, entry.fields);
        changed = true;
      }
    });

    return changed;
  }

  function applyPendingPatches() {
    cleanOldPatches();

    try { patchList(allMartyrs); } catch (e) {}
    try { patchList(dashboardData); } catch (e) {}

    try {
      if (currentDetailsItem && currentDetailsItem.martyr_id) {
        const entry = pendingEdits[String(currentDetailsItem.martyr_id)];
        if (entry && entry.fields) {
          patchItem(currentDetailsItem, entry.fields);
        }
      }
    } catch (e) {}
  }

  function renderVisibleAfterPatch() {
    applyPendingPatches();

    if (activePageId() === 'homePage') {
      try {
        if (typeof updateStatsCards === 'function') updateStatsCards();
      } catch (e) {}

      try {
        if (typeof renderMartyrs === 'function') renderMartyrs();
      } catch (e) {}
    }

    if (activePageId() === 'dashboardPage') {
      try {
        if (typeof renderDashboardTable === 'function') renderDashboardTable();
      } catch (e) {}

      try {
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
      } catch (e) {}
    }
  }

  const oldApiRequest =
    window.apiRequest ||
    (typeof apiRequest === 'function' ? apiRequest : null);

  if (typeof oldApiRequest === 'function' && !oldApiRequest.__taldoLocalPatchNoScroll) {
    window.apiRequest = function(action, data, options) {
      return oldApiRequest.apply(this, arguments).then(function(res) {
        if (action === 'updateMartyrFields' && res && res.success !== false) {
          rememberEditPatch(data || {});
          renderVisibleAfterPatch();

          /*
            إعادة حقن هادئة بدون أي scrollTo.
            هذه لحماية التعديل من كاش قديم يعود بعد الحفظ.
          */
          [250, 900, 1800].forEach(function(delay) {
            setTimeout(renderVisibleAfterPatch, delay);
          });
        }

        return res;
      });
    };

    window.apiRequest.__taldoLocalPatchNoScroll = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__taldoLocalPatchNoScroll) {
    window.renderMartyrs = function(customList) {
      applyPendingPatches();

      if (Array.isArray(customList)) {
        patchList(customList);
      }

      return oldRenderMartyrs.apply(this, arguments);
    };

    window.renderMartyrs.__taldoLocalPatchNoScroll = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  const oldLoadInitialData =
    window.loadInitialData ||
    (typeof loadInitialData === 'function' ? loadInitialData : null);

  if (typeof oldLoadInitialData === 'function' && !oldLoadInitialData.__taldoLocalPatchNoScroll) {
    window.loadInitialData = function() {
      const result = oldLoadInitialData.apply(this, arguments);

      [300, 1200].forEach(function(delay) {
        setTimeout(renderVisibleAfterPatch, delay);
      });

      return result;
    };

    window.loadInitialData.__taldoLocalPatchNoScroll = true;

    try {
      loadInitialData = window.loadInitialData;
    } catch (e) {}
  }

  window.addEventListener('taldo:api-cache-updated', function() {
    setTimeout(renderVisibleAfterPatch, 180);
  });

})();
