(function() {
  'use strict';

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function getDataUpdatePayloadBase() {
    const martyrId = document.getElementById('dataUpdateMartyrId')?.value || '';
    const martyrName = document.getElementById('dataUpdateMartyrName')?.value || '';
    const requestText = document.getElementById('dataUpdateText')?.value.trim() || '';
    const imageInput = document.getElementById('dataUpdateImageInput');

    return {
      martyrId,
      martyrName,
      requestText,
      imageInput
    };
  }

  function setDirectApprovedButtonLoading(loading) {
    const btn = document.getElementById('dataUpdateDirectApproveBtn');
    if (!btn) return;

    btn.disabled = !!loading;

    btn.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm ms-1"></span> جار النشر...`
      : `<i class="fa-solid fa-circle-check ms-1"></i> نشر كبيانات موثقة`;
  }

  async function submitDataUpdateAsApproved() {
    if (!isAdminMode()) {
      showToast('هذا الإجراء مخصص للأدمن فقط.');
      return;
    }

    const base = getDataUpdatePayloadBase();

    if (!base.martyrId) {
      showToast('تعذر تحديد الشهيد.');
      return;
    }

    if (!base.requestText && (!base.imageInput || !base.imageInput.files.length)) {
      showToast('يرجى كتابة البيانات أو رفع صورة.');
      return;
    }

    setDirectApprovedButtonLoading(true);

    try {
      if (typeof showGlobalSpinner === 'function') {
        showGlobalSpinner(true);
      }

      const payload = {
        martyr_id: base.martyrId,
        martyr_name: base.martyrName,
        request_text: base.requestText,
        submitted_text: base.requestText,
        imageMode: 'append',
        image_mode: 'append',
        admin_direct_approve: 'نعم',
        reviewer_notes: 'نشره الأدمن مباشرة كبيانات موثقة من صفحة الشهيد',
        imageFiles: typeof filesToPayload === 'function'
          ? await filesToPayload(base.imageInput?.files || [])
          : []
      };

      const res = await apiRequest('submitDataUpdateApproved', payload);

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر نشر البيانات مباشرة.');
        return;
      }

      modals.dataUpdateModal?.hide();

      showToast(res.message || 'تم نشر البيانات المستكملة مباشرة.');

      /*
        نفرغ الكاش حتى تظهر النتيجة بسرعة في صفحة الشهيد والرئيسية.
      */
      try {
        if (typeof window.clearTaldoAllClientCaches === 'function') {
          window.clearTaldoAllClientCaches();
        }
      } catch (e) {}

      try {
        if (typeof window.forceTaldoPublicFreshData === 'function') {
          window.forceTaldoPublicFreshData();
        }
      } catch (e) {}

      /*
        تحديث صفحة الشهيد الحالية إن كانت الدالة موجودة.
      */
      setTimeout(function() {
        try {
          if (typeof refreshCurrentDetailsPage === 'function') {
            refreshCurrentDetailsPage();
            return;
          }
        } catch (e) {}

        try {
          const fromPage = typeof lastPageBeforeDetails !== 'undefined'
            ? lastPageBeforeDetails
            : 'homePage';

          if (typeof openMartyrDetails === 'function') {
            openMartyrDetails(base.martyrId, fromPage, true);
          }
        } catch (e) {}
      }, 350);

    } catch (err) {
      showToast(err.message || 'تعذر نشر البيانات مباشرة.');
    } finally {
      setDirectApprovedButtonLoading(false);

      if (typeof hideGlobalSpinner === 'function') {
        hideGlobalSpinner();
      }
    }
  }

  window.submitDataUpdateAsApproved = submitDataUpdateAsApproved;

  function installDirectApprovedButton() {
    const footer = document.querySelector('#dataUpdateModal .modal-footer');
    const normalSubmitBtn = document.getElementById('dataUpdateSubmitBtn');

    if (!footer || !normalSubmitBtn) return;
    if (document.getElementById('dataUpdateDirectApproveBtn')) {
      updateDirectApprovedButtonVisibility();
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'dataUpdateDirectApproveBtn';
    btn.className = 'btn btn-success data-update-direct-approve-btn d-none';
    btn.onclick = submitDataUpdateAsApproved;
    btn.innerHTML = `<i class="fa-solid fa-circle-check ms-1"></i> نشر كبيانات موثقة`;

    footer.insertBefore(btn, normalSubmitBtn);

    updateDirectApprovedButtonVisibility();
  }

  function updateDirectApprovedButtonVisibility() {
    const btn = document.getElementById('dataUpdateDirectApproveBtn');
    if (!btn) return;

    btn.classList.toggle('d-none', !isAdminMode());
  }

  /*
    تحديث الظهور عند تسجيل الدخول/الخروج.
  */
  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__directApprovedDataUpdateWrapped) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);

      installDirectApprovedButton();
      updateDirectApprovedButtonVisibility();

      return result;
    };

    window.updateAdminButtons.__directApprovedDataUpdateWrapped = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  /*
    عند فتح مودال الاستكمال نحدث ظهور الزر.
  */
  const oldOpenDataUpdateModal =
    window.openDataUpdateModal ||
    (typeof openDataUpdateModal === 'function' ? openDataUpdateModal : null);

  if (typeof oldOpenDataUpdateModal === 'function' && !oldOpenDataUpdateModal.__directApprovedDataUpdateWrapped) {
    window.openDataUpdateModal = function() {
      const result = oldOpenDataUpdateModal.apply(this, arguments);

      setTimeout(function() {
        installDirectApprovedButton();
        updateDirectApprovedButtonVisibility();
      }, 80);

      return result;
    };

    window.openDataUpdateModal.__directApprovedDataUpdateWrapped = true;

    try {
      openDataUpdateModal = window.openDataUpdateModal;
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDirectApprovedButton);
  } else {
    installDirectApprovedButton();
  }

  setTimeout(installDirectApprovedButton, 700);
})();
