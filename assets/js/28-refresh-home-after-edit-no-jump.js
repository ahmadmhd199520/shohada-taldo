(function() {
  'use strict';

  function getActivePageAfterEditRefresh() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function getScrollAfterEditRefresh() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScrollAfterEditRefresh(pos) {
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

  function getLastPageBeforeDetailsAfterEditRefresh() {
    try {
      return lastPageBeforeDetails || 'homePage';
    } catch (e) {
      return 'homePage';
    }
  }

  function setLastPageBeforeDetailsAfterEditRefresh(value) {
    try {
      lastPageBeforeDetails = value || 'homePage';
    } catch (e) {}
  }

  function updateLocalMartyrAfterEditRefresh(martyrId, payload) {
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

  async function refreshHomeDataWithoutJump(scrollPos) {
    try {
      const res = await apiRequest('getInitialData');

      if (!res || !res.success) {
        return false;
      }

      try {
        allFamilies = res.families || allFamilies || [];
      } catch (e) {}

      try {
        statsData = res.stats || statsData || {};
      } catch (e) {}

      try {
        allMartyrs = res.martyrs || allMartyrs || [];
      } catch (e) {}

      try {
        siteMessages = res.messages || siteMessages || [];
      } catch (e) {}

      try {
        publicSettings = res.settings || publicSettings || {};
      } catch (e) {}

      try {
        if (typeof fillFamiliesSelects === 'function') {
          fillFamiliesSelects();
        }
      } catch (e) {}

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

      restoreScrollAfterEditRefresh(scrollPos);
      return true;

    } catch (e) {
      return false;
    }
  }

  function setEditSaveButtonLoadingAfterRefresh(btn, loading, normalHtml) {
    if (!btn) return;

    btn.disabled = !!loading;
    btn.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`
      : normalHtml;
  }

  /*
    هذا الملف يتجاوز دالة saveMartyrEdits السابقة.
    الفرق المهم:
    إذا انتهى الحفظ وأنت في الصفحة الرئيسية، نجلب البيانات الجديدة بهدوء
    ثم نرسم الصفحة الرئيسية بدون القفز لأعلى الصفحة.
  */
  window.saveMartyrEdits = async function() {
    const form = document.getElementById('editMartyrForm');

    if (!form || !form.checkValidity()) {
      if (form) form.reportValidity();
      return;
    }

    const fromPageBeforeSave = getLastPageBeforeDetailsAfterEditRefresh();

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

    setEditSaveButtonLoadingAfterRefresh(btn, true, normalBtn);

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      const activePageAtFinish = getActivePageAfterEditRefresh();
      const scrollAtFinish = getScrollAfterEditRefresh();

      if (modals.editMartyrModal) {
        modals.editMartyrModal.hide();
      }

      updateLocalMartyrAfterEditRefresh(payload.martyr_id, payload);

      showToast(res.message || 'تم حفظ التعديلات.');

      /*
        الحالة المهمة:
        إذا رجعت للرئيسية قبل انتهاء الحفظ،
        نحدّث بيانات الرئيسية من الخادم بدون loadInitialData وبدون قفز للأعلى.
      */
      if (activePageAtFinish === 'homePage') {
        const refreshed = await refreshHomeDataWithoutJump(scrollAtFinish);

        if (!refreshed) {
          try {
            if (typeof renderMartyrs === 'function') renderMartyrs();
            if (typeof updateStatsCards === 'function') updateStatsCards();
          } catch (e) {}

          restoreScrollAfterEditRefresh(scrollAtFinish);
        }

        setLastPageBeforeDetailsAfterEditRefresh(fromPageBeforeSave);
        return;
      }

      /*
        إذا بقيت داخل صفحة الشهيد، نحدث الصفحة نفسها.
      */
      if (activePageAtFinish === 'detailsPage') {
        if (typeof openMartyrDetails === 'function') {
          openMartyrDetails(payload.martyr_id, fromPageBeforeSave, true);
          setLastPageBeforeDetailsAfterEditRefresh(fromPageBeforeSave);
          restoreScrollAfterEditRefresh(scrollAtFinish);
        }

        return;
      }

      /*
        أي صفحة أخرى: نحدث الظاهر فقط ونحافظ على السكرول.
      */
      try {
        if (typeof renderMartyrs === 'function') renderMartyrs();
        if (typeof renderDashboardTable === 'function') renderDashboardTable();
        if (typeof updateStatsCards === 'function') updateStatsCards();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
      } catch (e) {}

      restoreScrollAfterEditRefresh(scrollAtFinish);
      setLastPageBeforeDetailsAfterEditRefresh(fromPageBeforeSave);

    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
    } finally {
      setEditSaveButtonLoadingAfterRefresh(btn, false, normalBtn);
    }
  };

  try {
    saveMartyrEdits = window.saveMartyrEdits;
  } catch (e) {}
})();
