(function() {
  'use strict';

  function getActivePageIdAfterEdit() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getCurrentScrollAfterEdit() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScrollAfterEdit(pos) {
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
  }

  function getLastPageBeforeDetailsAfterEdit() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function setLastPageBeforeDetailsAfterEdit(value) {
    try {
      lastPageBeforeDetails = value || 'homePage';
    } catch (e) {}
  }

  function updateLocalMartyrAfterEdit(martyrId, payload) {
    const updateList = function(list) {
      if (!Array.isArray(list)) return;

      const item = list.find(row => String(row.martyr_id || '') === String(martyrId || ''));

      if (item) {
        Object.assign(item, payload || {});
        item.updated_at = new Date().toISOString();
      }
    };

    try {
      updateList(allMartyrs);
    } catch (e) {}

    try {
      updateList(dashboardData);
    } catch (e) {}

    try {
      if (currentDetailsItem && String(currentDetailsItem.martyr_id || '') === String(martyrId || '')) {
        Object.assign(currentDetailsItem, payload || {});
        currentDetailsItem.updated_at = new Date().toISOString();
      }
    } catch (e) {}
  }

  function quietlyRefreshVisiblePartsAfterEdit(activePageBeforeRefresh, scrollBeforeRefresh) {
    try {
      if (typeof renderMartyrs === 'function' && activePageBeforeRefresh === 'homePage') {
        renderMartyrs();
      }
    } catch (e) {}

    try {
      if (typeof renderDashboardTable === 'function') {
        renderDashboardTable();
      }
    } catch (e) {}

    try {
      if (typeof updateStatsCards === 'function') {
        updateStatsCards();
      }
    } catch (e) {}

    try {
      if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
      }
    } catch (e) {}

    restoreScrollAfterEdit(scrollBeforeRefresh);
  }

  function setEditSaveButtonLoadingAfterEdit(btn, loading, normalHtml) {
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

    const fromPageBeforeSave = getLastPageBeforeDetailsAfterEdit();

    const payload = {
      martyr_id: document.getElementById('editMartyrId')?.value || ''
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

    setEditSaveButtonLoadingAfterEdit(btn, true, normalBtn);

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      const activePageAtFinish = getActivePageIdAfterEdit();
      const scrollAtFinish = getCurrentScrollAfterEdit();

      if (modals.editMartyrModal) {
        modals.editMartyrModal.hide();
      }

      updateLocalMartyrAfterEdit(payload.martyr_id, payload);

      showToast(res.message || 'تم حفظ التعديلات.');

      /*
        مهم جدًا:
        لا نستدعي loadInitialData() هنا
        ولا نفتح صفحة الشهيد بعد الحفظ إذا كان المستخدم قد رجع للرئيسية.
        لأن هذا هو سبب القفز لأعلى الصفحة.
      */

      if (activePageAtFinish === 'detailsPage') {
        if (typeof openMartyrDetails === 'function') {
          openMartyrDetails(payload.martyr_id, fromPageBeforeSave, true);
          setLastPageBeforeDetailsAfterEdit(fromPageBeforeSave);
          restoreScrollAfterEdit(scrollAtFinish);
        }
      } else {
        quietlyRefreshVisiblePartsAfterEdit(activePageAtFinish, scrollAtFinish);
        setLastPageBeforeDetailsAfterEdit(fromPageBeforeSave);
      }

      setTimeout(function() {
        try {
          if (typeof refreshDashboardData === 'function' && isAdminLoggedIn) {
            refreshDashboardData(false, {
              forceFresh: true,
              useClientCache: false
            });
          }
        } catch (e) {}

        restoreScrollAfterEdit(scrollAtFinish);
      }, 250);

    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
    } finally {
      setEditSaveButtonLoadingAfterEdit(btn, false, normalBtn);
    }
  };

  try {
    saveMartyrEdits = window.saveMartyrEdits;
  } catch (e) {}
})();
