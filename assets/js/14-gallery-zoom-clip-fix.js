(function () {
  'use strict';

  function getCurrentDetailsItemSafe() {
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

  function getCurrentGalleryIndexSafe() {
    try {
      if (typeof currentGalleryIndex !== 'undefined') {
        const index = Number(currentGalleryIndex);
        return Number.isFinite(index) ? index : 0;
      }
    } catch (e) {}

    try {
      const index = Number(window.currentGalleryIndex);
      return Number.isFinite(index) ? index : 0;
    } catch (e) {}

    return 0;
  }

  function setCurrentGalleryIndexSafe(index) {
    const safeIndex = Math.max(0, Number(index) || 0);

    try { window.currentGalleryIndex = safeIndex; } catch (e) {}

    try {
      if (typeof currentGalleryIndex !== 'undefined') {
        currentGalleryIndex = safeIndex;
      }
    } catch (e) {}

    return safeIndex;
  }

  function getImagesForGallery(item) {
    const source = item || getCurrentDetailsItemSafe();

    try {
      if (typeof window.normalizeImages === 'function') return window.normalizeImages(source || {});
    } catch (e) {}

    try {
      if (typeof normalizeImages === 'function') return normalizeImages(source || {});
    } catch (e) {}

    return [];
  }

  function getFixedImageStyle(img, mode) {
    try {
      if (typeof window.getImageStyleFinalFixed === 'function') {
        return window.getImageStyleFinalFixed(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    try {
      if (typeof getImageStyleFinal === 'function') {
        return getImageStyleFinal(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    try {
      if (typeof getImageStyleFixed === 'function') {
        return getImageStyleFixed(img || {}, mode || 'detail') || '';
      }
    } catch (e) {}

    return '';
  }

  function renderGalleryPlaceholder() {
    return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
  }

  function getGalleryHolder() {
    return document.querySelector('#detailsContainer .col-lg-5');
  }

  function rerenderGalleryOnly() {
    const holder = getGalleryHolder();
    if (!holder) return;
    holder.innerHTML = window.renderImageGallery(getCurrentDetailsItemSafe());
  }

  window.renderImageGallery = function(item) {
    const source = item || getCurrentDetailsItemSafe();
    const images = getImagesForGallery(source);

    if (!images.length) {
      setCurrentGalleryIndexSafe(0);
      return renderGalleryPlaceholder();
    }

    let activeIndex = getCurrentGalleryIndexSafe();
    if (activeIndex >= images.length) activeIndex = 0;
    activeIndex = setCurrentGalleryIndexSafe(activeIndex);

    const first = images[activeIndex] || images[0];
    const mainStyle = getFixedImageStyle(first, 'detail');

    return `
      <div class="image-gallery">
        <div class="gallery-main-frame">
          <img id="galleryMainImage"
               src="${escapeAttr(first.src)}"
               class="gallery-main-image detail-image"
               style="${mainStyle}"
               alt=""
               onerror="this.style.display='none';this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='grid';">
        </div>
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button type="button" class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${activeIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${activeIndex + 1} / ${images.length}</span>
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <button type="button" class="gallery-thumb-crop ${index === activeIndex ? 'is-active' : ''}" onclick="setGalleryImageIndex(${index})" aria-label="عرض الصورة ${index + 1}">
                    <img src="${escapeAttr(img.src)}" alt="" style="${getFixedImageStyle(img, 'detail')}">
                  </button>
                  <button type="button" class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="event.stopPropagation(); deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = getImagesForGallery(getCurrentDetailsItemSafe());
    if (!images.length) return;

    const currentIndex = getCurrentGalleryIndexSafe();
    const nextIndex = (currentIndex + Number(step || 0) + images.length) % images.length;
    setCurrentGalleryIndexSafe(nextIndex);
    rerenderGalleryOnly();
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = getImagesForGallery(getCurrentDetailsItemSafe());
    if (!images.length) return;

    const nextIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));
    setCurrentGalleryIndexSafe(nextIndex);
    rerenderGalleryOnly();
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}
})();
