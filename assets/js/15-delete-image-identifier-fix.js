(function () {
  'use strict';

  function cleanText(value) {
    return String(value || '').trim();
  }

  function extractDriveIdSafe(value) {
    const text = cleanText(value);
    if (!text) return '';

    let match = text.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    // image_file_id قد يكون المعرّف الخام نفسه وليس رابطًا.
    if (/^[A-Za-z0-9_-]{15,}$/.test(text)) return text;

    return '';
  }

  function normalizedImageUrl(value) {
    const text = cleanText(value);
    if (!text) return '';

    try {
      const url = new URL(text, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      url.searchParams.delete('export');
      return url.toString().replace(/\/$/, '');
    } catch (error) {
      return text
        .replace(/([?&])(sz|width|height|export)=[^&]+/g, '$1')
        .replace(/[?&]$/, '')
        .replace(/\/$/, '');
    }
  }

  function imageIdentity(img) {
    const fileId =
      extractDriveIdSafe(img?.image_file_id) ||
      extractDriveIdSafe(img?.image_url) ||
      extractDriveIdSafe(img?.src);

    if (fileId) return 'drive:' + fileId;

    const url = normalizedImageUrl(img?.image_url || img?.src || '');
    return url ? 'url:' + url : '';
  }

  function getCurrentDetailsItemForDelete() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) return currentDetailsItem;
    } catch (error) {}

    return window.currentDetailsItem || null;
  }

  function getImagesForDelete(item) {
    try {
      if (typeof window.normalizeImages === 'function') return window.normalizeImages(item || {});
    } catch (error) {}

    try {
      if (typeof normalizeImages === 'function') return normalizeImages(item || {});
    } catch (error) {}

    return [];
  }

  function setCurrentGalleryIndexForDelete(index) {
    const safe = Math.max(0, Number(index) || 0);
    try { window.currentGalleryIndex = safe; } catch (error) {}
    try {
      if (typeof currentGalleryIndex !== 'undefined') currentGalleryIndex = safe;
    } catch (error) {}
  }

  function rerenderGalleryAfterDelete(item) {
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder && typeof window.renderImageGallery === 'function') {
      holder.innerHTML = window.renderImageGallery(item || {});
    }
  }

  window.deleteMartyrImageFromDetails = function(index) {
    if (!isAdminLoggedIn) return;

    const item = getCurrentDetailsItemForDelete();
    if (!item) return;

    const images = getImagesForDelete(item);
    const img = images[Math.max(0, Number(index) || 0)];

    if (!img) {
      showToast('لم يتم تحديد الصورة المطلوبة.');
      return;
    }

    const selectedFileId =
      extractDriveIdSafe(img.image_file_id) ||
      extractDriveIdSafe(img.image_url) ||
      extractDriveIdSafe(img.src);

    const selectedUrl = img.image_url || img.src || '';
    const selectedKey = imageIdentity(img);

    if (!selectedFileId && !selectedUrl && !img.image_id) {
      showToast('لا يوجد معرّف صالح لهذه الصورة.');
      return;
    }

    if (!confirm('هل تريد حذف هذه الصورة من صفحة الشهيد؟')) return;

    showGlobalSpinner(true);

    apiRequest('deleteMartyrImage', {
      martyrId: item.martyr_id,
      martyr_id: item.martyr_id,
      imageId: img.image_id || '',
      image_id: img.image_id || '',
      imageFileId: selectedFileId || img.image_file_id || '',
      image_file_id: selectedFileId || img.image_file_id || '',
      imageUrl: selectedUrl,
      image_url: selectedUrl,
      src: img.src || selectedUrl || '',
      source_type: img.source_type || '',
      is_primary: img.is_primary || ''
    })
      .then(res => {
        if (!res || !res.success) {
          showToast(res?.message || 'تعذر حذف الصورة.');
          return;
        }

        showToast(res.message || 'تم حذف الصورة.');

        if (Array.isArray(item.images)) {
          item.images = item.images.filter(old => imageIdentity(old) !== selectedKey);
        }

        const currentMainKey = imageIdentity({
          image_file_id: item.image_file_id || '',
          image_url: item.image_url || '',
          src: typeof getImageSrc === 'function' ? getImageSrc(item) : ''
        });

        if (selectedKey && currentMainKey === selectedKey) {
          const next = Array.isArray(item.images) && item.images.length ? item.images[0] : null;
          item.image_file_id = next ? (extractDriveIdSafe(next.image_file_id) || extractDriveIdSafe(next.image_url) || next.image_file_id || '') : '';
          item.image_url = next ? (next.image_url || next.src || '') : '';
          item.detail_position_x = next ? (next.detail_position_x || next.position_x || '50') : '50';
          item.detail_position_y = next ? (next.detail_position_y || next.position_y || '50') : '50';
          item.card_position_x = next ? (next.card_position_x || next.position_x || '50') : '50';
          item.card_position_y = next ? (next.card_position_y || next.position_y || '50') : '50';
          item.detail_zoom = next ? (next.detail_zoom || '1') : '1';
          item.card_zoom = next ? (next.card_zoom || '1') : '1';
        }

        setCurrentGalleryIndexForDelete(0);
        rerenderGalleryAfterDelete(item);

        Promise.resolve(loadInitialData()).catch(() => {});
        if (isAdminLoggedIn && typeof refreshDashboardData === 'function') {
          Promise.resolve(refreshDashboardData(false)).catch(() => {});
        }
      })
      .catch(err => {
        showToast(err.message || 'تعذر حذف الصورة.');
      })
      .finally(() => {
        hideGlobalSpinner();
      });
  };

  try { deleteMartyrImageFromDetails = window.deleteMartyrImageFromDetails; } catch (error) {}
})();
