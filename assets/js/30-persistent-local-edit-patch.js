(function() {
  'use strict';

  const PATCH_LIFETIME = 5 * 60 * 1000;
  const pendingEdits = window.__taldoPendingMartyrEdits || {};
  window.__taldoPendingMartyrEdits = pendingEdits;

  function now() {
    return Date.now();
  }

  function getActivePagePatch() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScrollPatch() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScrollOncePatch(pos) {
    if (!pos) return;

    const x = Number(pos.x || 0);
    const y = Number(pos.y || 0);

    window.scrollTo({
      left: x,
      top: y,
      behavior: 'auto'
    });

    requestAnimationFrame(function() {
      window.scrollTo({
        left: x,
        top: y,
        behavior: 'auto'
      });
    });
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

    const martyrId = String(payload.martyr_id);

    pendingEdits[martyrId] = {
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

    try {
      patchList(allMartyrs);
    } catch (e) {}

    try {
      patchList(dashboardData);
    } catch (e) {}

    try {
      if (currentDetailsItem && currentDetailsItem.martyr_id) {
        const entry = pendingEdits[String(currentDetailsItem.martyr_id)];
        if (entry && entry.fields) {
          patchItem(currentDetailsItem, entry.fields);
        }
      }
    } catch (e) {}
  }

  function renderHomeWithoutJump() {
    /*
      مهم:
      نأخذ مكان السكرول الحالي الآن من الصفحة الرئيسية نفسها،
      وليس من لحظة بدء طلب الحفظ في صفحة الشهيد.
    */
    const currentHomeScroll = getScrollPatch();

    applyPendingPatches();

    try {
      if (typeof updateStatsCards === 'function') {
        updateStatsCards();
      }
    } catch (e) {}

    try {
      if (typeof renderMartyrs === 'function') {
        renderMartyrs();
      }
    } catch (e) {}

    restoreScrollOncePatch(currentHomeScroll);
  }

  function renderDashboardSafely() {
    applyPendingPatches();

    try {
      if (typeof renderDashboardTable === 'function') {
        renderDashboardTable();
      }
    } catch (e) {}

    try {
      if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
      }
    } catch (e) {}
  }

  function rerenderDetailsOnce(martyrId) {
    if (!martyrId) return;

    try {
      if (typeof openMartyrDetails === 'function') {
        const fromPage = typeof lastPageBeforeDetails !== 'undefined'
          ? lastPageBeforeDetails
          : 'homePage';

        const currentDetailsScroll = getScrollPatch();

        openMartyrDetails(martyrId, fromPage, true);

        restoreScrollOncePatch(currentDetailsScroll);
      }
    } catch (e) {}
  }

  /*
    نغلف apiRequest.
    أي طلب updateMartyrFields ناجح سيتم حقن تعديله محليًا.
  */
  const oldApiRequest =
    window.apiRequest ||
    (typeof apiRequest === 'function' ? apiRequest : null);

  if (typeof oldApiRequest === 'function' && !oldApiRequest.__persistentLocalEditPatchStableScroll) {
    window.apiRequest = function(action, data, options) {
      return oldApiRequest.apply(this, arguments).then(function(res) {
        if (action === 'updateMartyrFields' && res && res.success !== false) {
          rememberEditPatch(data || {});
          applyPendingPatches();

          let detailsRerendered = false;

          /*
            نعيد حقن التعديل عدة مرات، لكن بدون استخدام سكرول قديم.
            عند الرئيسية نأخذ المكان الحالي في نفس اللحظة، ثم نعيده مرة واحدة فقط.
          */
          [0, 250, 900, 1600, 2800].forEach(function(delay) {
            setTimeout(function() {
              const activeNow = getActivePagePatch();

              applyPendingPatches();

              if (activeNow === 'homePage') {
                renderHomeWithoutJump();
                return;
              }

              if (activeNow === 'dashboardPage') {
                renderDashboardSafely();
                return;
              }

              if (activeNow === 'detailsPage' && !detailsRerendered) {
                detailsRerendered = true;
                rerenderDetailsOnce(data?.martyr_id);
              }
            }, delay);
          });
        }

        return res;
      });
    };

    window.apiRequest.__persistentLocalEditPatchStableScroll = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }

  /*
    إذا loadInitialData أعاد نسخة قديمة من الكاش، نعيد حقن التعديلات بعدها
    لكن بدون إجبار السكرول على مكان قديم.
  */
  const oldLoadInitialData =
    window.loadInitialData ||
    (typeof loadInitialData === 'function' ? loadInitialData : null);

  if (typeof oldLoadInitialData === 'function' && !oldLoadInitialData.__persistentLocalEditPatchStableScroll) {
    window.loadInitialData = function() {
      const result = oldLoadInitialData.apply(this, arguments);

      [300, 1000].forEach(function(delay) {
        setTimeout(function() {
          applyPendingPatches();

          if (getActivePagePatch() === 'homePage') {
            renderHomeWithoutJump();
          }
        }, delay);
      });

      return result;
    };

    window.loadInitialData.__persistentLocalEditPatchStableScroll = true;

    try {
      loadInitialData = window.loadInitialData;
    } catch (e) {}
  }

  /*
    قبل أي رسم للرئيسية نحقن التعديل.
  */
  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__persistentLocalEditPatchStableScroll) {
    window.renderMartyrs = function(customList) {
      applyPendingPatches();

      if (Array.isArray(customList)) {
        patchList(customList);
      }

      return oldRenderMartyrs.apply(this, arguments);
    };

    window.renderMartyrs.__persistentLocalEditPatchStableScroll = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  /*
    عند الرجوع للرئيسية نحقن التعديلات بعد استقرار الرجوع.
    لا نستخدم مكان سكرول محفوظ من صفحة الشهيد.
  */
  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__persistentLocalEditPatchStableScroll) {
    window.showPage = function(pageId) {
      const result = oldShowPage.apply(this, arguments);

      if (pageId === 'homePage') {
        setTimeout(function() {
          if (getActivePagePatch() === 'homePage') {
            renderHomeWithoutJump();
          }
        }, 260);
      }

      return result;
    };

    window.showPage.__persistentLocalEditPatchStableScroll = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }

  window.addEventListener('taldo:api-cache-updated', function() {
    setTimeout(function() {
      applyPendingPatches();

      if (getActivePagePatch() === 'homePage') {
        renderHomeWithoutJump();
      }
    }, 160);
  });

})();
