(function() {
  'use strict';

  function getDraftValues() {
    const draft = window.__imagePositionDraft || {
      card: { x: '50', y: '50', zoom: '1' },
      detail: { x: '50', y: '50', zoom: '1' }
    };

    return {
      cardPositionX: draft.card?.x || '50',
      cardPositionY: draft.card?.y || '50',
      detailPositionX: draft.detail?.x || '50',
      detailPositionY: draft.detail?.y || '50',
      cardZoom: draft.card?.zoom || '1',
      detailZoom: draft.detail?.zoom || '1'
    };
  }

  function setButtonLoading(btn, loading) {
    if (!btn) return;

    btn.disabled = !!loading;
    btn.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`
      : 'حفظ موضع الصورة';
  }

  function rerenderVisibleImageParts() {
    try {
      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder && currentDetailsItem && typeof renderImageGallery === 'function') {
        holder.innerHTML = renderImageGallery(currentDetailsItem);
      }
    } catch (e) {}

    try {
      if (typeof renderMartyrs === 'function') {
        renderMartyrs();
      }
    } catch (e) {}

    /*
      لا نستدعي:
      loadInitialData()
      refreshDashboardData(false)

      لأنهما سبب البطء.
    */
  }

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;

    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';

    const values = getDraftValues();

    setButtonLoading(btn, true);

    const request = apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,

      positionX: values.detailPositionX,
      positionY: values.detailPositionY,

      cardPositionX: values.cardPositionX,
      cardPositionY: values.cardPositionY,
      detailPositionX: values.detailPositionX,
      detailPositionY: values.detailPositionY,
      cardZoom: values.cardZoom,
      detailZoom: values.detailZoom
    })
      .then(function(res) {
        if (!res || res.success === false) {
          showToast(res?.message || 'تعذر حفظ موضع وحجم الصورة.');
          return;
        }

        /*
          تحديث محلي سريع، بدون تحميل كل الموقع من جديد.
        */
        if (typeof updateLocalImagePositionsAndZoom === 'function') {
          updateLocalImagePositionsAndZoom(
            index,
            imageId,
            imageFileId,
            values.cardPositionX,
            values.cardPositionY,
            values.detailPositionX,
            values.detailPositionY,
            values.cardZoom,
            values.detailZoom
          );
        } else if (typeof updateLocalImagePositions === 'function') {
          updateLocalImagePositions(
            index,
            imageId,
            imageFileId,
            values.cardPositionX,
            values.cardPositionY,
            values.detailPositionX,
            values.detailPositionY
          );
        }

        try {
          modals.imagePositionModal?.hide();
        } catch (e) {}

        rerenderVisibleImageParts();

        showToast(res.message || 'تم ضبط موضع وحجم ظهور الصورة.');
      })
      .catch(function(err) {
        showToast(err.message || 'تعذر حفظ موضع وحجم الصورة.');
      })
      .finally(function() {
        setButtonLoading(btn, false);
      });

    if (typeof runWithoutScrollJump === 'function') {
      return runWithoutScrollJump(function() {
        return request;
      });
    }

    return request;
  };

  try {
    saveImagePositionFromModal = window.saveImagePositionFromModal;
  } catch (e) {}
})();
