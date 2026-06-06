(function() {
  function featureNormalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function featureIsTruthy(value) {
    const normalized = featureNormalize(value);
    return ['نعم', 'yes', 'true', '1', 'يحتاج', 'needs', 'بحاجه لاستكمال', 'بحاجة لاستكمال'].includes(normalized);
  }

  function featureIsNeedsCompletion(item) {
    if (typeof isNeedsCompletion === 'function') return isNeedsCompletion(item);
    return featureIsTruthy(item && item.needs_completion);
  }

  function featureVisibleSource() {
    if (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) {
      return dashboardData;
    }
    return Array.isArray(allMartyrs) ? allMartyrs : [];
  }

  function featureCountNeedsByFamily(source) {
    const map = {};
    (source || []).forEach(item => {
      if (!item) return;
      if (String(item.verification_status || '').trim() === 'مرفوض') return;

      const family = item.family_name || 'غير محدد';
      if (!map[family]) {
        map[family] = {
          family_name: family,
          needs: 0,
          total_visible: 0
        };
      }

      map[family].total_visible++;

      if (featureIsNeedsCompletion(item)) {
        map[family].needs++;
      }
    });

    return map;
  }

  function featureBuildFamilyRows() {
    const source = featureVisibleSource();
    const needsMap = featureCountNeedsByFamily(source);
    const byFamily = Array.isArray(statsData && statsData.byFamily) ? statsData.byFamily : [];
    const familyMap = {};

    byFamily.forEach(item => {
      if (!item) return;
      const family = item.family_name || 'غير محدد';

      familyMap[family] = {
        family_name: family,
        verified: Number(item.verified || 0),
        pending: Number(item.pending || 0),
        rejected: Number(item.rejected || 0),
        total: Number(item.total || 0),
        needs: Number((needsMap[family] && needsMap[family].needs) || item.needs || item.needs_completion_count || 0)
      };
    });

    Object.keys(needsMap).forEach(family => {
      if (!familyMap[family]) {
        familyMap[family] = {
          family_name: family,
          verified: 0,
          pending: 0,
          rejected: 0,
          total: needsMap[family].total_visible || 0,
          needs: needsMap[family].needs || 0
        };
      }
    });

    return Object.values(familyMap).sort((a, b) => {
      if (Number(b.needs || 0) !== Number(a.needs || 0)) return Number(b.needs || 0) - Number(a.needs || 0);
      const aTotal = Number(a.verified || 0) + Number(a.pending || 0);
      const bTotal = Number(b.verified || 0) + Number(b.pending || 0);
      return bTotal - aTotal;
    });
  }

  window.openFamiliesStatsPage = function() {
    const container = document.getElementById('familiesStatsContainer');
    if (!container) return;

    const rows = featureBuildFamilyRows();
    container.innerHTML = '';

    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">لا توجد إحصائيات بعد.</div>`;
      showPage('familiesPage');
      return;
    }

    const totalNeeds = rows.reduce((sum, item) => sum + Number(item.needs || 0), 0);

    if (isAdminLoggedIn) {
      const summary = document.createElement('div');
      summary.className = 'family-needs-summary';
      summary.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div class="fw-bold">
            <i class="fa-solid fa-circle-exclamation text-warning ms-1"></i>
            إجمالي الأسماء التي تحتاج استكمالا
          </div>
          <span class="family-needs-badge">
            <i class="fa-solid fa-list-check"></i>
            المجموع: ${totalNeeds}
          </span>
        </div>
      `;
      container.appendChild(summary);
    }

    rows.forEach(item => {
      const verifiedCount = Number(item.verified || 0);
      const pendingCount = Number(item.pending || 0);
      const needsCount = Number(item.needs || 0);
      const visibleTotal = verifiedCount + pendingCount;

      const row = document.createElement('div');
      row.className = 'family-row';
      row.onclick = function() {
        openFamilyMartyrs(item.family_name);
      };

      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
          <div>
            <h5 class="fw-bold mb-1">عائلة ${escapeHtml(item.family_name)}</h5>
            <div class="text-muted small">إجمالي الأسماء: ${visibleTotal}</div>
          </div>

          <div class="text-end d-flex align-items-center justify-content-end gap-1 flex-wrap">
            <span class="badge badge-soft-blue me-1">موثق: ${verifiedCount}</span>
            <span class="badge text-bg-warning me-1">بانتظار: ${pendingCount}</span>
            ${isAdminLoggedIn ? `
              <span class="family-needs-badge me-1">
                <i class="fa-solid fa-circle-exclamation"></i>
                يحتاج استكمال: ${needsCount}
              </span>
            ` : ''}
            <i class="fa-solid fa-chevron-left text-muted me-2"></i>
          </div>
        </div>
      `;

      container.appendChild(row);
    });

    showPage('familiesPage');
  };

  try { openFamiliesStatsPage = window.openFamiliesStatsPage; } catch (e) {}

  window.openFamilyMartyrs = function(familyName, noRoute) {
    const source = (isAdminLoggedIn && Array.isArray(dashboardData) && dashboardData.length) ? dashboardData : allMartyrs;
    const list = (source || []).filter(item => item.family_name === familyName && item.verification_status !== 'مرفوض');
    const needsCount = list.filter(item => featureIsNeedsCompletion(item)).length;

    const title = document.getElementById('familyPageTitle');
    if (title) {
      title.innerHTML = `
        شهداء عائلة ${escapeHtml(familyName)}
        ${isAdminLoggedIn ? `<span class="badge text-bg-warning me-2">يحتاج استكمال: ${needsCount}</span>` : ''}
      `;
    }

    const container = document.getElementById('familyMartyrsContainer');
    if (container) {
      container.innerHTML = list.length
        ? `<div class="martyrs-grid">${list.map(renderMartyrCardForFamily).join('')}</div>`
        : `<div class="empty-state">لا توجد أسماء لهذه العائلة.</div>`;
    }

    if (!noRoute && typeof updateRoute === 'function') {
      updateRoute(`?family=${encodeURIComponent(familyName)}`, { page: 'family', family: familyName });
    }

    showPage('familyMartyrsPage');
  };

  try { openFamilyMartyrs = window.openFamilyMartyrs; } catch (e) {}

  function featureExtractDriveId(value) {
    if (!value) return '';
    if (typeof extractDriveIdSafe === 'function') return extractDriveIdSafe(value);
    if (typeof extractDriveFileId === 'function') return extractDriveFileId(value);

    const text = String(value || '');
    let match = text.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return match[1];

    match = text.match(/\/d\/([^/]+)/);
    if (match && match[1]) return match[1];

    match = text.match(/file\/d\/([^/]+)/);
    if (match && match[1]) return match[1];

    return '';
  }

  function featureImageKey(img) {
    if (!img) return '';
    if (typeof imageIdentity === 'function') return imageIdentity(img);

    return String(
      img.image_id ||
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      img.image_file_id ||
      img.image_url ||
      img.src ||
      ''
    );
  }

  function featureGetGalleryImages(item) {
    if (typeof normalizeImagesFixed === 'function') return normalizeImagesFixed(item || {});
    if (typeof normalizeImagesWithDualPositions === 'function') return normalizeImagesWithDualPositions(item || {});
    if (typeof normalizeImages === 'function') return normalizeImages(item || {});
    return [];
  }

  function featureGetImageStyle(img, mode) {
    if (typeof getImageStyleFixed === 'function') return getImageStyleFixed(img, mode || 'detail');
    if (typeof getImagePositionStyleByMode === 'function') return getImagePositionStyleByMode(img, mode || 'detail');
    if (typeof getImagePositionStyle === 'function') return getImagePositionStyle(img);
    return '';
  }

  function featureIsPrimaryImage(img, item) {
    if (!img) return false;

    if (featureIsTruthy(img.is_primary)) return true;

    const imgFileId =
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      String(img.image_file_id || '');

    const itemFileId =
      featureExtractDriveId(item && item.image_file_id) ||
      featureExtractDriveId(item && item.image_url) ||
      String((item && item.image_file_id) || '');

    if (imgFileId && itemFileId && imgFileId === itemFileId) return true;

    const imgUrl = String(img.image_url || img.src || '').trim();
    const itemUrl = String((item && item.image_url) || '').trim();

    return !!imgUrl && !!itemUrl && imgUrl === itemUrl;
  }

function featureGetPrimaryImageSnapshot(item) {
  if (!item) return null;

  const fileId =
    featureExtractDriveId(item.image_file_id) ||
    featureExtractDriveId(item.image_url) ||
    item.image_file_id ||
    '';

  const imageUrl = String(item.image_url || '').trim();
  if (!fileId && !imageUrl) return null;

  return {
    image_id: '',
    image_file_id: fileId,
    image_url: imageUrl,
    src: fileId
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`
      : imageUrl,
    is_primary: 'لا',
    source_type: 'gallery',
    position_x: item.position_x || item.image_position_x || item.detail_position_x || '50',
    position_y: item.position_y || item.image_position_y || item.detail_position_y || '50',
    card_position_x: item.card_position_x || item.image_position_x || item.position_x || '50',
    card_position_y: item.card_position_y || item.image_position_y || item.position_y || '50',
    detail_position_x: item.detail_position_x || item.position_x || item.image_position_x || '50',
    detail_position_y: item.detail_position_y || item.position_y || item.image_position_y || '50',
    card_zoom: item.card_zoom || item.image_zoom || '1',
    detail_zoom: item.detail_zoom || item.image_zoom || '1'
  };
}

function featureEnsureImageInGallery(item, image, selectedKey) {
  if (!item || !image) return;
  if (!Array.isArray(item.images)) item.images = [];

  const imageKey = featureImageKey(image);
  if (!imageKey || imageKey === selectedKey) return;

  const exists = item.images.some(old => featureImageKey(old) === imageKey);
  if (exists) return;

  item.images.unshift(Object.assign({}, image, { is_primary: 'لا', source_type: 'gallery' }));
}

function featureSyncPrimaryImageAcrossCaches(sourceItem) {
  if (!sourceItem || !sourceItem.martyr_id) return;

  [window.allMartyrs, window.dashboardData].forEach(list => {
    if (!Array.isArray(list)) return;
    const target = list.find(row => String(row.martyr_id || '') === String(sourceItem.martyr_id || ''));
    if (!target || target === sourceItem) return;

    target.image_file_id = sourceItem.image_file_id || '';
    target.image_url = sourceItem.image_url || '';
    target.position_x = sourceItem.position_x || target.position_x || '';
    target.position_y = sourceItem.position_y || target.position_y || '';
    target.card_position_x = sourceItem.card_position_x || target.card_position_x || '';
    target.card_position_y = sourceItem.card_position_y || target.card_position_y || '';
    target.detail_position_x = sourceItem.detail_position_x || target.detail_position_x || '';
    target.detail_position_y = sourceItem.detail_position_y || target.detail_position_y || '';
    target.card_zoom = sourceItem.card_zoom || target.card_zoom || '';
    target.detail_zoom = sourceItem.detail_zoom || target.detail_zoom || '';
    target.images = Array.isArray(sourceItem.images)
      ? sourceItem.images.map(image => Object.assign({}, image))
      : target.images;
  });
}

function featureApplyPrimaryImageLocally(item, img, oldPrimaryImage) {
  if (!item || !img) return;

  const selectedFileId =
    featureExtractDriveId(img.image_file_id) ||
    featureExtractDriveId(img.image_url) ||
    featureExtractDriveId(img.src) ||
    img.image_file_id ||
    '';

  const selectedKey = featureImageKey(img);

  featureEnsureImageInGallery(item, oldPrimaryImage, selectedKey);

  item.image_file_id = selectedFileId || item.image_file_id || '';
  item.image_url = img.image_url || img.src || item.image_url || '';

  ['position_x', 'position_y', 'card_position_x', 'card_position_y', 'detail_position_x', 'detail_position_y', 'card_zoom', 'detail_zoom'].forEach(key => {
    if (img[key]) item[key] = img[key];
  });

  if (!Array.isArray(item.images)) item.images = [];

  item.images = item.images.map(old => {
    const copy = Object.assign({}, old);
    copy.is_primary = featureImageKey(copy) === selectedKey ? 'نعم' : 'لا';
    return copy;
  });

  featureSyncPrimaryImageAcrossCaches(item);
  currentGalleryIndex = 0;
}

  async function featureCallPrimaryImageApi(payload) {
    const actions = ['setPrimaryMartyrImage', 'setMartyrPrimaryImage', 'setPrimaryImage'];
    let lastResult = null;

    for (const action of actions) {
      try {
        const res = await apiRequest(action, payload);
        lastResult = res;

        const msg = String((res && res.message) || '');
        if (res && res.success) return res;

        if (!/إجراء غير معروف|unknown action|unknown/i.test(msg)) {
          return res;
        }
      } catch (error) {
        const msg = String(error && error.message || '');
        lastResult = { success: false, message: msg };
        if (!/إجراء غير معروف|unknown action|unknown/i.test(msg)) {
          throw error;
        }
      }
    }

    return lastResult || {
      success: false,
      message: 'واجهة التعيين جاهزة، لكن يلزم إضافة دالة setPrimaryMartyrImage في Code.gs لتثبيت الصورة الرئيسية.'
    };
  }

  window.setPrimaryMartyrImageFromDetails = async function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    const images = featureGetGalleryImages(currentDetailsItem);
    const safeIndex = Math.max(0, Number(index) || 0);
    const img = images[safeIndex];

    if (!img) {
      showToast('لم يتم تحديد الصورة المطلوبة.');
      return;
    }

    if (featureIsPrimaryImage(img, currentDetailsItem)) {
      showToast('هذه الصورة معيّنة كصورة رئيسية بالفعل.');
      return;
    }

    if (!confirm('هل تريد تعيين هذه الصورة كصورة رئيسية للشهيد؟')) return;

    const selectedFileId =
      featureExtractDriveId(img.image_file_id) ||
      featureExtractDriveId(img.image_url) ||
      featureExtractDriveId(img.src) ||
      img.image_file_id ||
      '';
    const oldPrimaryImage = featureGetPrimaryImageSnapshot(currentDetailsItem);

const payload = {
  martyrId: currentDetailsItem.martyr_id,
  martyr_id: currentDetailsItem.martyr_id,
  imageId: img.image_id || '',
  image_id: img.image_id || '',
  imageFileId: selectedFileId || '',
  image_file_id: selectedFileId || '',
  imageUrl: img.image_url || img.src || '',
  image_url: img.image_url || img.src || '',
  src: img.src || img.image_url || '',
  keepOldPrimary: true,
  preserveOldPrimary: true,
  previousImageFileId: oldPrimaryImage?.image_file_id || '',
  previous_image_file_id: oldPrimaryImage?.image_file_id || '',
  previousImageUrl: oldPrimaryImage?.image_url || oldPrimaryImage?.src || '',
  previous_image_url: oldPrimaryImage?.image_url || oldPrimaryImage?.src || '',
  oldPrimaryImageFileId: oldPrimaryImage?.image_file_id || '',
  old_primary_image_file_id: oldPrimaryImage?.image_file_id || '',
  oldPrimaryImageUrl: oldPrimaryImage?.image_url || oldPrimaryImage?.src || '',
  old_primary_image_url: oldPrimaryImage?.image_url || oldPrimaryImage?.src || ''
};
    showGlobalSpinner(true);

    try {
      const res = await featureCallPrimaryImageApi(payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر تعيين الصورة الرئيسية.');
        return;
      }

      featureApplyPrimaryImageLocally(currentDetailsItem, img, oldPrimaryImage);

      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});

      showToast(res.message || 'تم تعيين الصورة الرئيسية بنجاح.');
      if (typeof refreshDashboardData === 'function') refreshDashboardData(false);
      if (typeof loadInitialData === 'function') loadInitialData();
    } catch (error) {
      showToast(error.message || 'تعذر تعيين الصورة الرئيسية.');
    } finally {
      hideGlobalSpinner();
    }
  };

  window.renderImageGallery = function(item) {
    const images = featureGetGalleryImages(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    if (currentGalleryIndex < 0) currentGalleryIndex = 0;

    const first = images[currentGalleryIndex] || images[0];
    const style = featureGetImageStyle(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn && typeof openImagePositionModal === 'function' ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
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
            <div class="small text-muted fw-bold mb-2">
              <i class="fa-solid fa-user-shield ms-1"></i>
              إدارة صور الشهيد
            </div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => {
                const isPrimary = featureIsPrimaryImage(img, item || {});
                return `
                  <div class="gallery-thumb-item">
                    <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${featureGetImageStyle(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                    <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="event.stopPropagation(); deleteMartyrImageFromDetails(${index})">
                      <i class="fa-solid fa-xmark"></i>
                    </button>

                    ${isPrimary ? `
                      <span class="gallery-primary-badge" title="الصورة الرئيسية">
                        <i class="fa-solid fa-star"></i>
                        رئيسية
                      </span>
                    ` : `
                      <button class="btn btn-warning gallery-primary-btn" title="تعيين كصورة رئيسية" onclick="event.stopPropagation(); setPrimaryMartyrImageFromDetails(${index})">
                        <i class="fa-solid fa-star"></i>
                      </button>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  try { renderImageGallery = window.renderImageGallery; } catch (e) {}

  window.setGalleryImageIndex = function(index) {
    const images = featureGetGalleryImages(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { setGalleryImageIndex = window.setGalleryImageIndex; } catch (e) {}

  window.changeGalleryImage = function(step) {
    const images = featureGetGalleryImages(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + Number(step || 0) + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  try { changeGalleryImage = window.changeGalleryImage; } catch (e) {}
})();
