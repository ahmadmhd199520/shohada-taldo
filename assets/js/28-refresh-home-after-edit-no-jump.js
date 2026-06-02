(function() {
  'use strict';

  function patchLocalMartyrAfterSave(martyrId, payload) {
    function patchList(list) {
      if (!Array.isArray(list)) return;

      const item = list.find(row => String(row?.martyr_id || '') === String(martyrId || ''));

      if (!item) return;

      Object.assign(item, payload || {});
      item.updated_at = new Date().toISOString();

      item.__perfPrepared = false;
      item.__dashboardPrepared = false;

      try {
        delete item.__searchText;
        delete item.__familyKey;
        delete item.__createdSort;
        delete item.__dashboardSearch;
      } catch (e) {}
    }

    try { patchList(allMartyrs); } catch (e) {}
    try { patchList(dashboardData); } catch (e) {}

    try {
      if (currentDetailsItem && String(currentDetailsItem.martyr_id || '') === String(martyrId || '')) {
        Object.assign(currentDetailsItem, payload || {});
        currentDetailsItem.updated_at = new Date().toISOString();

        currentDetailsItem.__perfPrepared = false;
        currentDetailsItem.__dashboardPrepared = false;

        try {
          delete currentDetailsItem.__searchText;
          delete currentDetailsItem.__familyKey;
          delete currentDetailsItem.__createdSort;
          delete currentDetailsItem.__dashboardSearch;
        } catch (e) {}
      }
    } catch (e) {}
  }

  function activePageId() {
    return document.querySelector('.page-section.active')?.id || '';
  }

  function setButtonLoading(btn, loading, normalHtml) {
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

    setButtonLoading(btn, true, normalBtn);

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      if (modals.editMartyrModal) {
        modals.editMartyrModal.hide();
      }

patchLocalMartyrAfterSave(martyrId, payload);

if (activePageId() === 'homePage' && typeof renderMartyrs === 'function') {
  renderMartyrs();
}

if (activePageId() === 'dashboardPage' && typeof renderDashboardTable === 'function') {
  renderDashboardTable();
}

/*
  مهم:
  إذا كنت ما زلت داخل صفحة الشهيد عند انتهاء الحفظ،
  نعيد رسم الصفحة الداخلية نفسها من البيانات المحلية المعدلة.
*/
if (activePageId() === 'detailsPage' && typeof openMartyrDetails === 'function') {
  const detailsScroll = {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0
  };

  let fromPage = 'homePage';

  try {
    fromPage = lastPageBeforeDetails || 'homePage';
  } catch (e) {}

  openMartyrDetails(martyrId, fromPage, true);

  /*
    openMartyrDetails قد يستدعي showPage داخليًا،
    لذلك نعيد موضع صفحة الشهيد نفسها بعد إعادة الرسم.
  */
  const restoreDetailsScroll = function() {
    window.scrollTo({
      left: Number(detailsScroll.x || 0),
      top: Number(detailsScroll.y || 0),
      behavior: 'auto'
    });
  };

  restoreDetailsScroll();
  requestAnimationFrame(restoreDetailsScroll);
  setTimeout(restoreDetailsScroll, 80);
}

showToast(res.message || 'تم حفظ التعديلات.');
    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
    } finally {
      setButtonLoading(btn, false, normalBtn);
    }
  };

  try {
    saveMartyrEdits = window.saveMartyrEdits;
  } catch (e) {}
})();
