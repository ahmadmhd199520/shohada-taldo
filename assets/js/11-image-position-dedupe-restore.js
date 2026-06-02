(function () {
  'use strict';

  function cleanValue(value) {
    return (value === undefined || value === null) ? '' : String(value).trim();
  }

  function driveIdFromAny(value) {
    const text = cleanValue(value);
    if (!text) return '';

    let match = text.match(/^[a-zA-Z0-9_-]{20,}$/);
    if (match) return text;

    match = text.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    return '';
  }

  function galleryImageKey(input) {
    if (!input) return '';

    const fileId =
      driveIdFromAny(input.image_file_id) ||
      driveIdFromAny(input.image_url) ||
      driveIdFromAny(input.src);

    if (fileId) return 'drive:' + fileId;

    const rawUrl = cleanValue(input.image_url || input.src);
    if (!rawUrl) return '';

    try {
      const url = new URL(rawUrl, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      return 'url:' + url.toString();
    } catch (e) {
      return 'url:' + rawUrl
        .replace(/([?&])(sz|width|height)=[^&]+/g, '$1')
        .replace(/[?&]$/, '');
    }
  }

  function driveThumb(fileId, size) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${size || 'w1000'}`;
  }

  function makeGalleryImageFromRow(img) {
    if (!img) return null;

    const fileId = driveIdFromAny(img.image_file_id) || driveIdFromAny(img.image_url);
    const src = fileId ? driveThumb(fileId, 'w1000') : cleanValue(img.image_url);
    if (!src) return null;

    return {
      src,
      image_id: cleanValue(img.image_id),
      image_file_id: cleanValue(img.image_file_id) || fileId,
      image_url: cleanValue(img.image_url),
      is_primary: cleanValue(img.is_primary),
      source_type: cleanValue(img.source_type) || 'gallery',

      // لا نضع 50 افتراضيًا هنا؛ حتى لا تطغى القيم الافتراضية على ضبط الملف الشخصي المحفوظ.
      position_x: cleanValue(img.position_x),
      position_y: cleanValue(img.position_y),
      card_position_x: cleanValue(img.card_position_x),
      card_position_y: cleanValue(img.card_position_y),
      detail_position_x: cleanValue(img.detail_position_x) || cleanValue(img.position_x),
      detail_position_y: cleanValue(img.detail_position_y) || cleanValue(img.position_y),
      card_zoom: cleanValue(img.card_zoom),
      detail_zoom: cleanValue(img.detail_zoom)
    };
  }

  function makeMainGalleryImage(item) {
    if (!item) return null;

    const mainSrc = (typeof getImageSrc === 'function') ? getImageSrc(item) : '';
    if (!mainSrc) return null;

    const fileId =
      cleanValue(item.image_file_id) ||
      driveIdFromAny(item.image_url) ||
      driveIdFromAny(mainSrc);

    return {
      src: mainSrc,
      image_id: '',
      image_file_id: fileId,
      image_url: cleanValue(item.image_url),
      is_primary: 'نعم',
      source_type: 'main',

      position_x: cleanValue(item.image_position_x),
      position_y: cleanValue(item.image_position_y),
      card_position_x: cleanValue(item.card_position_x) || cleanValue(item.image_position_x),
      card_position_y: cleanValue(item.card_position_y) || cleanValue(item.image_position_y),
      detail_position_x: cleanValue(item.detail_position_x) || cleanValue(item.image_position_x),
      detail_position_y: cleanValue(item.detail_position_y) || cleanValue(item.image_position_y),
      card_zoom: cleanValue(item.card_zoom),
      detail_zoom: cleanValue(item.detail_zoom)
    };
  }

  function mergePriorityField(existing, incoming, field, fallback) {
    const oldValue = cleanValue(existing[field]);
    const newValue = cleanValue(incoming[field]);
    const incomingIsMain = cleanValue(incoming.source_type) === 'main' || cleanValue(incoming.is_primary) === 'نعم';

    if (!newValue) return oldValue || fallback || '';

    // عند منع التكرار: الصورة الرئيسية هي المرجع الأصح لضبط صفحة الشهيد.
    if (incomingIsMain) return newValue;

    if (!oldValue) return newValue;
    if ((fallback !== undefined && oldValue === fallback) && newValue !== fallback) return newValue;

    return oldValue;
  }

  function mergeImageData(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;

    existing.image_id = cleanValue(existing.image_id) || cleanValue(incoming.image_id);
    existing.image_file_id = cleanValue(existing.image_file_id) || cleanValue(incoming.image_file_id);
    existing.image_url = cleanValue(existing.image_url) || cleanValue(incoming.image_url);
    existing.is_primary = cleanValue(existing.is_primary) || cleanValue(incoming.is_primary);
    existing.source_type = cleanValue(incoming.source_type) === 'main'
      ? 'main'
      : (cleanValue(existing.source_type) || cleanValue(incoming.source_type));

    existing.position_x = mergePriorityField(existing, incoming, 'position_x', '50');
    existing.position_y = mergePriorityField(existing, incoming, 'position_y', '50');
    existing.card_position_x = mergePriorityField(existing, incoming, 'card_position_x', '50');
    existing.card_position_y = mergePriorityField(existing, incoming, 'card_position_y', '50');
    existing.detail_position_x = mergePriorityField(existing, incoming, 'detail_position_x', '50');
    existing.detail_position_y = mergePriorityField(existing, incoming, 'detail_position_y', '50');
    existing.card_zoom = mergePriorityField(existing, incoming, 'card_zoom', '1');
    existing.detail_zoom = mergePriorityField(existing, incoming, 'detail_zoom', '1');

    return existing;
  }

  function normalizeImagesFixed(item) {
    const images = [];
    const seen = new Map();

    function reindex() {
      seen.clear();
      images.forEach((img, index) => seen.set(galleryImageKey(img), index));
    }

    function pushUnique(image, preferFront) {
      if (!image || !image.src) return;

      const key = galleryImageKey(image);
      if (!key) return;

      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        mergeImageData(images[existingIndex], image);

        if (preferFront && existingIndex > 0) {
          const merged = images.splice(existingIndex, 1)[0];
          images.unshift(merged);
          reindex();
        }

        return;
      }

      if (preferFront) {
        images.unshift(image);
        reindex();
      } else {
        seen.set(key, images.length);
        images.push(image);
      }
    }

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => pushUnique(makeGalleryImageFromRow(img), false));
    }

    const mainImage = makeMainGalleryImage(item);
    if (mainImage) pushUnique(mainImage, true);

    return images.map(img => ({
      ...img,
      position_x: cleanValue(img.position_x) || cleanValue(img.detail_position_x) || '50',
      position_y: cleanValue(img.position_y) || cleanValue(img.detail_position_y) || '50',
      card_position_x: cleanValue(img.card_position_x) || '50',
      card_position_y: cleanValue(img.card_position_y) || '50',
      detail_position_x: cleanValue(img.detail_position_x) || cleanValue(img.position_x) || '50',
      detail_position_y: cleanValue(img.detail_position_y) || cleanValue(img.position_y) || '50',
      card_zoom: cleanValue(img.card_zoom) || '1',
      detail_zoom: cleanValue(img.detail_zoom) || '1'
    }));
  }

  function safeNumberLocal(value, fallback, min, max, decimals) {
    const n = Number(value);
    const base = Number.isNaN(n) ? fallback : n;
    const clamped = Math.max(min, Math.min(max, base));
    const factor = Math.pow(10, decimals || 0);
    return String(Math.round(clamped * factor) / factor);
  }

  function getPositionValueFixed(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return safeNumberLocal(
        cleanValue(source[cardKey]) ||
        cleanValue(source[oldMainKey]) ||
        cleanValue(current[cardKey]) ||
        cleanValue(current[oldMainKey]) ||
        '50',
        50,
        0,
        100,
        0
      );
    }

    return safeNumberLocal(
      cleanValue(source[detailKey]) ||
      cleanValue(current[detailKey]) ||
      cleanValue(source[oldPositionKey]) ||
      cleanValue(current[oldPositionKey]) ||
      cleanValue(source[oldMainKey]) ||
      cleanValue(current[oldMainKey]) ||
      '50',
      50,
      0,
      100,
      0
    );
  }

  function getZoomValueFixed(target, mode) {
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    if (mode === 'card') {
      return safeNumberLocal(
        cleanValue(source.card_zoom) ||
        cleanValue(current.card_zoom) ||
        '1',
        1,
        1,
        3,
        2
      );
    }

    return safeNumberLocal(
      cleanValue(source.detail_zoom) ||
      cleanValue(current.detail_zoom) ||
      cleanValue(source.card_zoom) ||
      cleanValue(current.card_zoom) ||
      '1',
      1,
      1,
      3,
      2
    );
  }

  function getImageStyleFixed(target, mode) {
    const x = getPositionValueFixed(target, mode, 'x');
    const y = getPositionValueFixed(target, mode, 'y');
    const zoom = getZoomValueFixed(target, mode);

    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  window.normalizeImages = normalizeImagesFixed;
  window.normalizeImagesWithZoom = normalizeImagesFixed;
  window.normalizeImagesWithDualPositions = normalizeImagesFixed;
  window.getImageStyleFinalFixed = getImageStyleFixed;

  try { normalizeImages = normalizeImagesFixed; } catch (e) {}
  try { normalizeImagesWithZoom = normalizeImagesFixed; } catch (e) {}
  try { normalizeImagesWithDualPositions = normalizeImagesFixed; } catch (e) {}

  window.renderImageGallery = function(item) {
    const images = normalizeImagesFixed(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (typeof currentGalleryIndex === 'undefined') window.currentGalleryIndex = 0;
    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = getImageStyleFixed(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImageStyleFixed(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesFixed(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesFixed(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    if (typeof ensureImagePositionTabsAndZoom === 'function') {
      ensureImagePositionTabsAndZoom();
    }

    const images = normalizeImagesFixed(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValueFixed(img, 'card', 'x'),
        y: getPositionValueFixed(img, 'card', 'y'),
        zoom: getZoomValueFixed(img, 'card')
      },
      detail: {
        x: getPositionValueFixed(img, 'detail', 'x'),
        y: getPositionValueFixed(img, 'detail', 'y'),
        zoom: getZoomValueFixed(img, 'detail')
      }
    };

    if (typeof switchImagePositionMode === 'function') {
      switchImagePositionMode('card');
    }

    modals.imagePositionModal.show();
  };

  try { openImagePositionModal = window.openImagePositionModal; } catch (e) {}
})();
