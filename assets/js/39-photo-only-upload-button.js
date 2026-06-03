(function() {
  'use strict';

  let photoOnlyMode = false;
  let originalDataUpdateModalState = null;

  function getCurrentMartyrIdSafe() {
    try {
      if (currentDetailsItem && currentDetailsItem.martyr_id) {
        return currentDetailsItem.martyr_id;
      }
    } catch (e) {}

    try {
      return new URLSearchParams(window.location.search).get('m') || '';
    } catch (e) {
      return '';
    }
  }

  function escapeAttrPhotoBtn(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function rememberOriginalDataUpdateModalState() {
    if (originalDataUpdateModalState) return;

    const modal = document.getElementById('dataUpdateModal');
    if (!modal) return;

    const title = modal.querySelector('.modal-title');
    const alert = modal.querySelector('.modal-body .alert');
    const textArea = document.getElementById('dataUpdateText');
    const textWrap = textArea ? textArea.closest('.mb-3') : null;
    const imageInput = document.getElementById('dataUpdateImageInput');
    const imageLabel = imageInput?.closest('.mb-3')?.querySelector('.form-label');
    const imageHelp = imageInput?.closest('.mb-3')?.querySelector('.form-text');
    const submitBtn = document.getElementById('dataUpdateSubmitBtn');

    originalDataUpdateModalState = {
      titleHtml: title ? title.innerHTML : '',
      alertHtml: alert ? alert.innerHTML : '',
      textWrapDisplay: textWrap ? textWrap.style.display : '',
      textPlaceholder: textArea ? textArea.placeholder : '',
      textValue: textArea ? textArea.value : '',
      imageLabelHtml: imageLabel ? imageLabel.innerHTML : '',
      imageHelpHtml: imageHelp ? imageHelp.innerHTML : '',
      submitHtml: submitBtn ? submitBtn.innerHTML : ''
    };
  }

  function restoreDataUpdateModalNormalMode() {
    if (!originalDataUpdateModalState) return;

    photoOnlyMode = false;

    const modal = document.getElementById('dataUpdateModal');
    if (!modal) return;

    const title = modal.querySelector('.modal-title');
    const alert = modal.querySelector('.modal-body .alert');
    const textArea = document.getElementById('dataUpdateText');
    const textWrap = textArea ? textArea.closest('.mb-3') : null;
    const imageInput = document.getElementById('dataUpdateImageInput');
    const imageLabel = imageInput?.closest('.mb-3')?.querySelector('.form-label');
    const imageHelp = imageInput?.closest('.mb-3')?.querySelector('.form-text');
    const submitBtn = document.getElementById('dataUpdateSubmitBtn');

    if (title) title.innerHTML = originalDataUpdateModalState.titleHtml;
    if (alert) alert.innerHTML = originalDataUpdateModalState.alertHtml;
    if (textWrap) textWrap.style.display = originalDataUpdateModalState.textWrapDisplay || '';
    if (textArea) {
      textArea.placeholder = originalDataUpdateModalState.textPlaceholder || '';
      textArea.value = '';
    }
    if (imageLabel) imageLabel.innerHTML = originalDataUpdateModalState.imageLabelHtml;
    if (imageHelp) imageHelp.innerHTML = originalDataUpdateModalState.imageHelpHtml;
    if (submitBtn) submitBtn.innerHTML = originalDataUpdateModalState.submitHtml || 'إرسال للمراجعة';
  }

  function setDataUpdateModalPhotoOnlyMode() {
    rememberOriginalDataUpdateModalState();

    photoOnlyMode = true;

    const modal = document.getElementById('dataUpdateModal');
    if (!modal) return;

    const title = modal.querySelector('.modal-title');
    const alert = modal.querySelector('.modal-body .alert');
    const textArea = document.getElementById('dataUpdateText');
    const textWrap = textArea ? textArea.closest('.mb-3') : null;
    const imageInput = document.getElementById('dataUpdateImageInput');
    const imageLabel = imageInput?.closest('.mb-3')?.querySelector('.form-label');
    const imageHelp = imageInput?.closest('.mb-3')?.querySelector('.form-text');
    const submitBtn = document.getElementById('dataUpdateSubmitBtn');

    if (title) {
      title.innerHTML = `
        <i class="fa-solid fa-camera-retro text-danger ms-2"></i>
        رفع صورة للشهيد
      `;
    }

    if (alert) {
      alert.className = 'alert alert-danger';
      alert.innerHTML = `
        اختر صورة أو أكثر للشهيد، وستُرسل للمراجعة قبل اعتمادها ضمن صور الشهيد.
      `;
    }

    if (textArea) {
      /*
        نضع نصًا داخليًا حتى يظهر الطلب في لوحة المراجعة بشكل واضح،
        لكن نخفي خانة النص عن المستخدم لأن هذا الزر خاص بالصور فقط.
      */
      textArea.value = 'رفع صورة للشهيد فقط';
      textArea.placeholder = 'رفع صورة للشهيد فقط';
    }

    if (textWrap) {
      textWrap.style.display = 'none';
    }

    if (imageInput) {
      imageInput.value = '';
      imageInput.setAttribute('accept', 'image/*');
      imageInput.setAttribute('multiple', 'multiple');
    }

    if (imageLabel) {
      imageLabel.innerHTML = 'اختر صورة الشهيد <span class="text-danger">*</span>';
    }

    if (imageHelp) {
      imageHelp.innerHTML = 'يمكن رفع صورة واحدة أو أكثر، وستظهر في طلبات الاستكمال للمراجعة.';
    }

    if (submitBtn) {
      submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up ms-1"></i> إرسال الصورة للمراجعة`;
    }
  }

  window.openPhotoOnlyUploadModal = function(martyrId) {
    martyrId = martyrId || getCurrentMartyrIdSafe();

    if (!martyrId) {
      showToast('تعذر تحديد الشهيد.');
      return;
    }

    if (typeof openDataUpdateModal !== 'function') {
      showToast('نافذة رفع الصور غير متاحة.');
      return;
    }

    openDataUpdateModal(martyrId);

    setTimeout(setDataUpdateModalPhotoOnlyMode, 50);
  };

  /*
    نغلف إرسال طلب الاستكمال:
    إذا كان الوضع "رفع صورة فقط" نمنع الإرسال بدون صورة.
  */
  const oldSubmitDataUpdateForm =
    window.submitDataUpdateForm ||
    (typeof submitDataUpdateForm === 'function' ? submitDataUpdateForm : null);

  if (typeof oldSubmitDataUpdateForm === 'function' && !oldSubmitDataUpdateForm.__photoOnlyUploadWrapped) {
    window.submitDataUpdateForm = function() {
      if (photoOnlyMode) {
        const imageInput = document.getElementById('dataUpdateImageInput');

        if (!imageInput || !imageInput.files || !imageInput.files.length) {
          showToast('يرجى اختيار صورة أولًا.');
          return;
        }

        const textArea = document.getElementById('dataUpdateText');
        if (textArea && !textArea.value.trim()) {
          textArea.value = 'رفع صورة للشهيد فقط';
        }
      }

      return oldSubmitDataUpdateForm.apply(this, arguments);
    };

    window.submitDataUpdateForm.__photoOnlyUploadWrapped = true;

    try {
      submitDataUpdateForm = window.submitDataUpdateForm;
    } catch (e) {}
  }

  function installPhotoOnlyButton() {
    const actionBar = document.querySelector('#detailsContainer .details-action-bar');

    if (!actionBar) return;

    const martyrId = getCurrentMartyrIdSafe();

    if (!martyrId) return;

    if (actionBar.querySelector('.details-photo-upload-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn details-photo-upload-btn';
    btn.onclick = function() {
      window.openPhotoOnlyUploadModal(martyrId);
    };

    btn.innerHTML = `
      <i class="fa-solid fa-camera-retro ms-1"></i>
      رفع صورة للشهيد
    `;

    /*
      نضعه بعد زر الاستكمال إن وجد، وإلا بعد زر المشاركة.
    */
    actionBar.appendChild(btn);
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__photoOnlyUploadWrapped) {
    window.openMartyrDetails = function() {
      const result = oldOpenMartyrDetails.apply(this, arguments);

      setTimeout(installPhotoOnlyButton, 0);
      requestAnimationFrame(installPhotoOnlyButton);
      setTimeout(installPhotoOnlyButton, 120);

      return result;
    };

    window.openMartyrDetails.__photoOnlyUploadWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  document.addEventListener('hidden.bs.modal', function(event) {
    if (event.target && event.target.id === 'dataUpdateModal') {
      restoreDataUpdateModalNormalMode();
    }
  }, true);

  setTimeout(installPhotoOnlyButton, 800);
})();
