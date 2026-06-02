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

  function restoreScrollPatch(pos) {
    if (!pos) return;

    const restore = function() {
      window.scrollTo({
        left: Number(pos.x || 0),
        top: Number(pos.y || 0),
        behavior: 'auto'
      });
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 80);
    setTimeout(restore, 250);
    setTimeout(restore, 700);
    setTimeout(restore, 1200);
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

  function renderHomeSafely(scrollPos) {
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

    restoreScrollPatch(scrollPos);
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

  /*
    الأهم:
    نغلف apiRequest نفسه.
    أي دالة حفظ قديمة أو جديدة تستدعي updateMartyrFields
    سيتم التقاطها هنا بعد النجاح، حتى لو لم تكن دالة saveMartyrEdits التي عدلناها هي المنفذة فعليًا.
  */
  const oldApiRequest =
    window.apiRequest ||
    (typeof apiRequest === 'function' ? apiRequest : null);

  if (typeof oldApiRequest === 'function' && !oldApiRequest.__persistentLocalEditPatch) {
    window.apiRequest = function(action, data, options) {
      const scrollBefore = getScrollPatch();
      const activeBefore = getActivePagePatch();

      return oldApiRequest.apply(this, arguments).then(function(res) {
        if (action === 'updateMartyrFields' && res && res.success !== false) {
          rememberEditPatch(data || {});
          applyPendingPatches();

          /*
            ننتظر قليلًا لأن بعض الدوال القديمة بعد الحفظ تستدعي:
            refreshAfterMutation أو loadInitialData
            وقد تعيد بيانات قديمة من الكاش.
            لذلك نعيد تطبيق التعديل بعد عدة لحظات.
          */
          [0, 150, 400, 900, 1600, 2800].forEach(function(delay) {
            setTimeout(function() {
              const activeNow = getActivePagePatch();

              applyPendingPatches();

              if (activeNow === 'homePage' || activeBefore === 'homePage') {
                renderHomeSafely(scrollBefore);
                return;
              }

              if (activeNow === 'dashboardPage') {
                renderDashboardSafely();
                return;
              }

              if (activeNow === 'detailsPage') {
                try {
                  if (typeof openMartyrDetails === 'function' && data?.martyr_id) {
                    const fromPage = typeof lastPageBeforeDetails !== 'undefined'
                      ? lastPageBeforeDetails
                      : 'homePage';

                    openMartyrDetails(data.martyr_id, fromPage, true);
                  }
                } catch (e) {}
              }
            }, delay);
          });
        }

        return res;
      });
    };

    window.apiRequest.__persistentLocalEditPatch = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }

  /*
    إذا loadInitialData أعاد نسخة قديمة، نحقن التعديلات بعدها.
  */
  const oldLoadInitialData =
    window.loadInitialData ||
    (typeof loadInitialData === 'function' ? loadInitialData : null);

  if (typeof oldLoadInitialData === 'function' && !oldLoadInitialData.__persistentLocalEditPatch) {
    window.loadInitialData = function() {
      const scrollBefore = getScrollPatch();
      const activeBefore = getActivePagePatch();

      const result = oldLoadInitialData.apply(this, arguments);

      Promise.resolve(result).finally(function() {
        setTimeout(function() {
          applyPendingPatches();

          if (activeBefore === 'homePage' || getActivePagePatch() === 'homePage') {
            renderHomeSafely(scrollBefore);
          }
        }, 180);
      });

      return result;
    };

    window.loadInitialData.__persistentLocalEditPatch = true;

    try {
      loadInitialData = window.loadInitialData;
    } catch (e) {}
  }

  /*
    إذا renderMartyrs اشتغل من أي ملف، نحقن التعديلات قبله.
  */
  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__persistentLocalEditPatch) {
    window.renderMartyrs = function(customList) {
      applyPendingPatches();

      if (Array.isArray(customList)) {
        patchList(customList);
      }

      return oldRenderMartyrs.apply(this, arguments);
    };

    window.renderMartyrs.__persistentLocalEditPatch = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  /*
    عند الرجوع للرئيسية نعيد الرسم من البيانات المحقونة.
  */
  const oldShowPage =
    window.showPage ||
    (typeof showPage === 'function' ? showPage : null);

  if (typeof oldShowPage === 'function' && !oldShowPage.__persistentLocalEditPatch) {
    window.showPage = function(pageId) {
      const scrollBefore = getScrollPatch();

      const result = oldShowPage.apply(this, arguments);

      if (pageId === 'homePage') {
        setTimeout(function() {
          renderHomeSafely(scrollBefore);
        }, 120);
      }

      return result;
    };

    window.showPage.__persistentLocalEditPatch = true;

    try {
      showPage = window.showPage;
    } catch (e) {}
  }

  /*
    احتياط: عند تحديث كاش API نعيد حقن التعديل.
  */
  window.addEventListener('taldo:api-cache-updated', function() {
    const scrollBefore = getScrollPatch();

    setTimeout(function() {
      applyPendingPatches();

      if (getActivePagePatch() === 'homePage') {
        renderHomeSafely(scrollBefore);
      }
    }, 120);
  });

})();
