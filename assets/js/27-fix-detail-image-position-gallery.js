(function () {
  'use strict';

  function safeNumberDetailImage(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function getCurrentDetailsItemForImageFix() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) {
        return currentDetailsItem;
      }
    } catch (e) {}

    try {
      if (window.currentDetailsItem) return window.currentDetailsItem;
    } catch (e) {}

    return {};
  }

  function getCurrentGalleryIndexForImageFix() {
    try {
      if (typeof currentGalleryIndex !== 'undefined') {
        const n = Number(currentGalleryIndex);
        return Number.isFinite(n) ? n : 0;
      }
    } catch (e) {}

    try {
      const n = Number(window.currentGalleryIndex);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {}

    return 0;
  }

  function setCurrentGalleryIndexForImageFix(index) {
    const safeIndex = Math.max(0, Number(index) || 0);

    try {
      currentGalleryIndex = safeIndex;
    } catch (e) {}

    try {
      window.currentGalleryIndex = safeIndex;
    } catch (e) {}

    return safeIndex;
  }

  function getImagesForDetailImageFix(item) {
    const source = item || getCurrentDetailsItemForImageFix();

    try {
      if (typeof window.normalizeImages === 'function') {
        return window.normalizeImages(source || {});
      }
    } catch (e) {}

    try {
      if (typeof normalizeImages === 'function') {
        return normalizeImages(source || {});
      }
    } catch (e) {}

    return [];
  }

  function getDetailImageStyleForFix(img) {
    img = img || {};

    let x =
      img.detail_position_x ||
      img.position_x ||
      img.image_position_x ||
      img.card_position_x ||
      '50';

    let y =
      img.detail_position_y ||
      img.position_y ||
      img.image_position_y ||
      img.card_position_y ||
      '50';

    let zoom =
      img.detail_zoom ||
      img.card_zoom ||
      img.image_zoom ||
      '1';

    x = safeNumberDetailImage(x, 50, 0, 100);
    y = safeNumberDetailImage(y, 50, 0, 100);
    zoom = safeNumberDetailImage(zoom, 1, 1, 3);

    return [
      `object-position:${x}% ${y}%`,
      `transform:scale(${zoom})`,
      `transform-origin:${x}% ${y}%`
    ].join(';') + ';';
  }

  function renderDetailImagePlaceholderFix() {
    return `
      <div class="detail-image-placeholder">
        <div>
          <i class="fa-solid fa-user fa-4x text-secondary mb-3"></i>
          <div>لا توجد صورة مرفقة</div>
        </div>
      </div>
    `;
  }

  function rerenderDetailGalleryFix() {
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (!holder) return;

    holder.innerHTML = window.renderImageGallery(getCurrentDetailsItemForImageFix());
  }

  window.renderImageGallery = function(item) {
    const source = item || getCurrentDetailsItemForImageFix();
    const images = getImagesForDetailImageFix(source);

    if (!images.length) {
      setCurrentGalleryIndexForImageFix(0);
      return renderDetailImagePlaceholderFix();
    }

    let activeIndex = getCurrentGalleryIndexForImageFix();

    if (activeIndex >= images.length) activeIndex = 0;
    if (activeIndex < 0) activeIndex = 0;

    activeIndex = setCurrentGalleryIndexForImageFix(activeIndex);

    const activeImage = images[activeIndex] || images[0];
    const mainStyle = getDetailImageStyleForFix(activeImage);

    return `
      <div class="image-gallery">

        <div class="gallery-main-frame">
          <img
            id="galleryMainImage"
            src="${escapeAttr(activeImage.src)}"
            class="gallery-main-image detail-image"
            style="${mainStyle}"
            alt=""
            onerror="this.style.display='none'; this.parentElement.style.display='none'; this.parentElement.nextElementSibling.style.display='grid';"
          >
        </div>

        <div class="detail-image-placeholder" style="display:none;">
          <div>تعذر عرض الصورة</div>
        </div>

        ${isAdminLoggedIn && typeof openImagePositionModal === 'function' ? `
          <button
            type="button"
            class="btn btn-light image-position-btn"
            title="ضبط موضع وحجم ظهور الصورة"
            onclick="openImagePositionModal(${activeIndex})"
          >
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">
              السابق
            </button>

            <span class="badge text-bg-light align-self-center" id="galleryCounter">
              ${activeIndex + 1} / ${images.length}
            </span>

            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">
              التالي
            </button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2">
              <i class="fa-solid fa-user-shield ms-1"></i>
              إدارة صور الشهيد
            </div>

            <div class="gallery-thumb-row">
              ${images.map((img, index) => {
                const thumbStyle = getDetailImageStyleForFix(img);
                const isActive = index === activeIndex;

                return `
                  <div class="gallery-thumb-item">
                    <button
                      type="button"
                      class="gallery-thumb-crop ${isActive ? 'is-active' : ''}"
                      onclick="setGalleryImageIndex(${index})"
                      aria-label="عرض الصورة ${index + 1}"
                    >
                      <img src="${escapeAttr(img.src)}" alt="" style="${thumbStyle}">
                    </button>

                    ${typeof deleteMartyrImageFromDetails === 'function' ? `
                      <button
                        type="button"
                        class="btn btn-danger gallery-delete-btn"
                        title="حذف الصورة"
                        onclick="event.stopPropagation(); deleteMartyrImageFromDetails(${index})"
                      >
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;
  };

  try {
    renderImageGallery = window.renderImageGallery;
  } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = getImagesForDetailImageFix(getCurrentDetailsItemForImageFix());
    if (!images.length) return;

    const currentIndex = getCurrentGalleryIndexForImageFix();
    const nextIndex = (currentIndex + Number(step || 0) + images.length) % images.length;

    setCurrentGalleryIndexForImageFix(nextIndex);
    rerenderDetailGalleryFix();
  };

  try {
    changeGalleryImage = window.changeGalleryImage;
  } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = getImagesForDetailImageFix(getCurrentDetailsItemForImageFix());
    if (!images.length) return;

    const nextIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));

    setCurrentGalleryIndexForImageFix(nextIndex);
    rerenderDetailGalleryFix();
  };

  try {
    setGalleryImageIndex = window.setGalleryImageIndex;
  } catch (e) {}
})();
