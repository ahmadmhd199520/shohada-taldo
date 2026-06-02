(function() {
  'use strict';

  function getActivePageAfterEditPatch() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScrollAfterEditPatch() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScrollAfterEditPatch(pos) {
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

  function getLastPageBeforeDetailsAfterEditPatch() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function setLastPageBeforeDetailsAfterEditPatch(value) {
    try {
      lastPageBeforeDetails = value || 'homePage';
    } catch (e) {}
  }

  function forcePrepareMartyrAgain(item) {
    if (!item) return;

    /*
      مهم جدًا:
      هذه الحقول هي سبب أن التعديلات لا تظهر مباشرة أحيانًا،
      لأن renderMartyrs السريع يعتمد عليها.
    */
    item.__perfPrepared = false;
    item.__dashboardPrepared = false;

    try {
      delete item.__searchText;
      delete item.__familyKey;
      delete item.__createdSort;
    } catch (e) {}

    try {
      if (typeof window.prepareMartyrRecord === 'function') {
        window.prepareMartyrRecord(item);
      } else if (typeof prepareMartyrRecord === 'function') {
        prepareMartyrRecord(item);
      }
    } catch (e) {}

    try {
      if (typeof prepareDashboardRecord === 'function') {
        prepareDashboardRecord(item);
      }
    } catch (e) {}
  }

  function patchOneListAfterEdit(list, martyrId, fields) {
    if (!Array.isArray(list)) return false;

    const item = list.find(row => String(row?.martyr_id || '') === String(martyrId || ''));

    if (!item) return false;

    Object.assign(item, fields || {});
    item.updated_at = new Date().toISOString();

    forcePrepareMartyrAgain(item);

    return true;
  }

  function patchCurrentDetailsAfterEdit(martyrId, fields) {
    try {
      if (currentDetailsItem && String(currentDetailsItem.martyr_id || '') === String(martyrId || '')) {
        Object.assign(currentDetailsItem, fields || {});
        currentDetailsItem.updated_at = new Date().toISOString();
        forcePrepareMartyrAgain(currentDetailsItem);
      }
    } catch (e) {}
  }

  function patchAllLocalDataAfterEdit(martyrId, fields) {
    let patchedHome = false;

    try {
      patchedHome = patchOneListAfterEdit(allMartyrs, martyrId, fields) || patchedHome;
    } catch (e) {}

    try {
      patchOneListAfterEdit(dashboardData, martyrId, fields);
    } catch (e) {}

    patchCurrentDetailsAfterEdit(martyrId, fields);

    return patchedHome;
  }

  function renderHomeAfterLocalEdit(scrollPos) {
    /*
      لا نستخدم loadInitialData هنا حتى لا نقفز للأعلى
      ولا نعتمد على getInitialData لأنه قد يرجع نسخة كاش قديمة.
    */
    try {
      if (typeof renderMartyrs === 'function') {
        renderMartyrs();
      }
    } catch (e) {}

    try {
      if (typeof updateStatsCards === 'function') {
        updateStatsCards();
      }
    } catch (e) {}

    restoreScrollAfterEditPatch(scrollPos);
  }

  function refreshAdminQuietlyAfterEdit() {
    setTimeout(function() {
      try {
        if (typeof refreshDashboardData === 'function' && isAdminLoggedIn) {
          refreshDashboardData(false, {
            forceFresh: true,
            useClientCache: false
          });
        }
      } catch (e) {}
    }, 400);
  }

  function setEditButtonLoadingPatch(btn, loading, normalHtml) {
    if (!btn) return;

    btn.disabled = !!loading;
    btn.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`
      : normalHtml;
  }

  window.saveMartyrEdits = async function() {
    const form = document.getElementById('editMartyrForm');

    if (!form || !form.checkValidity()) {
      if (form) form.reportValidity();
      return;
    }

    const fromPageBeforeSave = getLastPageBeforeDetailsAfterEditPatch();

    const martyrId = document.getElementById('editMartyrId')?.value || '';

    const payload = {
      martyr_id: martyrId
    };

    const formData = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, formData);

    if (payload.martyrdom_type !== 'المعارك') {
      payload.battle_name = '';
    }

    if (payload.martyrdom_type !== 'آخر') {
      payload.other_cause = '';
    }

    if (payload.martyrdom_type !== 'تحت التعذيب' && payload.martyrdom_type !== 'معتقل') {
      payload.security_branch = '';
    }

    if (payload.martyrdom_type !== 'مفقود') {
      payload.last_seen_place = '';
    }

    const imageInput = document.getElementById('editImageInput');

    try {
      if (imageInput && imageInput.files && imageInput.files.length) {
        if (typeof filesToPayload === 'function') {
          payload.imageFiles = await filesToPayload(imageInput.files);
        } else {
          const file = imageInput.files[0];
          payload.imageBase64 = await fileToBase64(file);
          payload.imageName = file.name;
        }
      }
    } catch (e) {
      showToast(e.message || 'تعذر قراءة الصورة.');
      return;
    }

    const btn = document.getElementById('editMartyrSaveBtn');
    const normalBtn = `<i class="fa-solid fa-floppy-disk ms-1"></i> حفظ التعديلات`;

    setEditButtonLoadingPatch(btn, true, normalBtn);

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      const activePageAtFinish = getActivePageAfterEditPatch();
      const scrollAtFinish = getScrollAfterEditPatch();

      if (modals.editMartyrModal) {
        modals.editMartyrModal.hide();
      }

      /*
        نحدّث البيانات محليًا مباشرة من الفورم نفسه،
        ولا ننتظر getInitialData لأن الكاش قد يعيد نسخة قديمة.
      */
      patchAllLocalDataAfterEdit(martyrId, payload);

      showToast(res.message || 'تم حفظ التعديلات.');

      if (activePageAtFinish === 'homePage') {
        renderHomeAfterLocalEdit(scrollAtFinish);
        setLastPageBeforeDetailsAfterEditPatch(fromPageBeforeSave);
        refreshAdminQuietlyAfterEdit();
        return;
      }

      if (activePageAtFinish === 'detailsPage') {
        if (typeof openMartyrDetails === 'function') {
          openMartyrDetails(martyrId, fromPageBeforeSave, true);
          setLastPageBeforeDetailsAfterEditPatch(fromPageBeforeSave);
          restoreScrollAfterEditPatch(scrollAtFinish);
        }

        refreshAdminQuietlyAfterEdit();
        return;
      }

      try {
        if (typeof renderMartyrs === 'function') renderMartyrs();
        if (typeof renderDashboardTable === 'function') renderDashboardTable();
        if (typeof updateStatsCards === 'function') updateStatsCards();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
      } catch (e) {}

      restoreScrollAfterEditPatch(scrollAtFinish);
      setLastPageBeforeDetailsAfterEditPatch(fromPageBeforeSave);
      refreshAdminQuietlyAfterEdit();

    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
    } finally {
      setEditButtonLoadingPatch(btn, false, normalBtn);
    }
  };

  try {
    saveMartyrEdits = window.saveMartyrEdits;
  } catch (e) {}
})();
