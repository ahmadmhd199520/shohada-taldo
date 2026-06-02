(function() {
  'use strict';

  function driveIdFromAny(value) {
    const text = String(value || '');
    if (!text) return '';

    let match = text.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    return '';
  }

  function galleryImageKey(input) {
    if (!input) return '';

    const fileId = driveIdFromAny(input.image_file_id || '') ||
      driveIdFromAny(input.image_url || '') ||
      driveIdFromAny(input.src || '');

    if (fileId) return 'drive:' + fileId;

    const rawUrl = String(input.image_url || input.src || '').trim();
    if (!rawUrl) return '';

    try {
      const url = new URL(rawUrl, window.location.href);
      url.searchParams.delete('sz');
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      return 'url:' + url.toString();
    } catch (e) {
      return 'url:' + rawUrl.replace(/([?&])(sz|width|height)=[^&]+/g, '$1').replace(/[?&]$/, '');
    }
  }

  function makeGalleryImageFromRow(img, item) {
    const fileId = driveIdFromAny(img?.image_file_id || '') || driveIdFromAny(img?.image_url || '');
    const src = fileId
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`
      : (img?.image_url || '');

    if (!src) return null;

    return {
      src,
      image_id: img?.image_id || '',
      image_file_id: img?.image_file_id || fileId || '',
      image_url: img?.image_url || '',
      is_primary: img?.is_primary || '',
      source_type: img?.source_type || '',
      position_x: img?.position_x || '50',
      position_y: img?.position_y || '50',
      card_position_x: img?.card_position_x || item?.card_position_x || item?.image_position_x || '50',
      card_position_y: img?.card_position_y || item?.card_position_y || item?.image_position_y || '50',
      detail_position_x: img?.detail_position_x || img?.position_x || item?.detail_position_x || item?.image_position_x || '50',
      detail_position_y: img?.detail_position_y || img?.position_y || item?.detail_position_y || item?.image_position_y || '50',
      card_zoom: img?.card_zoom || item?.card_zoom || '1',
      detail_zoom: img?.detail_zoom || item?.detail_zoom || '1'
    };
  }

  function makeMainGalleryImage(item) {
    const mainSrc = typeof getImageSrc === 'function' ? getImageSrc(item) : '';
    if (!mainSrc) return null;

    const fileId = item?.image_file_id || driveIdFromAny(item?.image_url || '') || driveIdFromAny(mainSrc);

    return {
      src: mainSrc,
      image_id: '',
      image_file_id: fileId || '',
      image_url: item?.image_url || '',
      is_primary: 'نعم',
      source_type: 'main',
      position_x: item?.image_position_x || '50',
      position_y: item?.image_position_y || '50',
      card_position_x: item?.card_position_x || item?.image_position_x || '50',
      card_position_y: item?.card_position_y || item?.image_position_y || '50',
      detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
      detail_position_y: item?.detail_position_y || item?.image_position_y || '50',
      card_zoom: item?.card_zoom || '1',
      detail_zoom: item?.detail_zoom || '1'
    };
  }

  function mergeImageData(existing, incoming) {
    if (!existing || !incoming) return existing || incoming;

    existing.image_id = existing.image_id || incoming.image_id || '';
    existing.image_file_id = existing.image_file_id || incoming.image_file_id || '';
    existing.image_url = existing.image_url || incoming.image_url || '';
    existing.is_primary = existing.is_primary || incoming.is_primary || '';
    existing.source_type = existing.source_type || incoming.source_type || '';

    existing.position_x = existing.position_x || incoming.position_x || '50';
    existing.position_y = existing.position_y || incoming.position_y || '50';
    existing.card_position_x = existing.card_position_x || incoming.card_position_x || '50';
    existing.card_position_y = existing.card_position_y || incoming.card_position_y || '50';
    existing.detail_position_x = existing.detail_position_x || incoming.detail_position_x || '50';
    existing.detail_position_y = existing.detail_position_y || incoming.detail_position_y || '50';
    existing.card_zoom = existing.card_zoom || incoming.card_zoom || '1';
    existing.detail_zoom = existing.detail_zoom || incoming.detail_zoom || '1';

    return existing;
  }

  function normalizeImagesDedupe(item) {
    const images = [];
    const seen = new Map();

    function pushUnique(image, preferFront) {
      if (!image || !image.src) return;

      const key = galleryImageKey(image);
      if (!key) return;

      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        mergeImageData(images[existingIndex], image);
        if (preferFront && existingIndex > 0) {
          const [existing] = images.splice(existingIndex, 1);
          images.unshift(existing);
          seen.clear();
          images.forEach((img, index) => seen.set(galleryImageKey(img), index));
        }
        return;
      }

      if (preferFront) {
        images.unshift(image);
        seen.clear();
        images.forEach((img, index) => seen.set(galleryImageKey(img), index));
      } else {
        seen.set(key, images.length);
        images.push(image);
      }
    }

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => pushUnique(makeGalleryImageFromRow(img, item), false));
    }

    const mainImage = makeMainGalleryImage(item);
    if (mainImage) pushUnique(mainImage, true);

    return images;
  }

  window.normalizeImages = normalizeImagesDedupe;
  window.normalizeImagesWithZoom = normalizeImagesDedupe;
  window.normalizeImagesWithDualPositions = normalizeImagesDedupe;

  try { normalizeImages = normalizeImagesDedupe; } catch (e) {}
  try { normalizeImagesWithZoom = normalizeImagesDedupe; } catch (e) {}
  try { normalizeImagesWithDualPositions = normalizeImagesDedupe; } catch (e) {}

  window.renderImageGallery = function(item) {
    const images = normalizeImagesDedupe(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (typeof currentGalleryIndex === 'undefined') window.currentGalleryIndex = 0;
    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = typeof getImageStyleFinal === 'function'
      ? getImageStyleFinal(first, 'detail')
      : '';

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
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${typeof getImageStyleFinal === 'function' ? getImageStyleFinal(img, 'detail') : ''} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
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
    const images = normalizeImagesDedupe(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesDedupe(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}
})();
