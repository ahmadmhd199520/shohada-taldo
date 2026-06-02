(function() {
  const OLD_SHOW_PAGE = window.showPage;

  window.__taldoKeepScroll = false;
  window.__imagePositionDraft = null;

  if (typeof OLD_SHOW_PAGE === 'function') {
    window.showPage = function(pageId) {
      if (!window.__taldoKeepScroll) {
        return OLD_SHOW_PAGE.apply(this, arguments);
      }

      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
      });

      document.getElementById(pageId)?.classList.add('active');
    };
  }

  function rememberScroll() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreScroll(pos) {
    if (!pos) return;
    window.scrollTo(pos.x, pos.y);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 60);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 220);
    setTimeout(() => window.scrollTo(pos.x, pos.y), 650);
  }

  function runWithoutScrollJump(work) {
    const pos = rememberScroll();
    window.__taldoKeepScroll = true;

    const done = () => {
      restoreScroll(pos);
      setTimeout(() => {
        window.__taldoKeepScroll = false;
        restoreScroll(pos);
      }, 700);
    };

    try {
      const result = work(pos);
      if (result && typeof result.finally === 'function') {
        return result.finally(done);
      }
      done();
      return result;
    } catch (error) {
      done();
      throw error;
    }
  }

  function normalizePosition(value, fallback) {
    const n = Number(value);
    if (Number.isNaN(n)) return String(fallback || 50);
    return String(Math.max(0, Math.min(100, Math.round(n))));
  }

function getPositionValue(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    
    // الحل: استخدام currentDetailsItem فقط في صفحة التفاصيل وليس في الصفحة الرئيسية
    const current = (mode === 'detail') ? (window.currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return normalizePosition(
        source[cardKey] ||
        source[oldMainKey] ||
        '50',
        50
      );
    }

    return normalizePosition(
      source[detailKey] ||
      current[detailKey] ||
      source[oldPositionKey] ||
      current[oldPositionKey] ||
      source[oldMainKey] ||
      current[oldMainKey] ||
      '50',
      50
    );
  }

  function getImagePositionStyleByMode(target, mode) {
    const x = getPositionValue(target, mode || 'detail', 'x');
    const y = getPositionValue(target, mode || 'detail', 'y');
    return `object-position:${x}% ${y}%;`;
  }

  function getPrimaryPositionTarget(item) {
    const images = normalizeImagesWithDualPositions(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  function normalizeImagesWithDualPositions(item) {
    const images = [];

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000`
          : (img.image_url || '');

        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50',
            card_position_x: img.card_position_x || item?.card_position_x || item?.image_position_x || '50',
            card_position_y: img.card_position_y || item?.card_position_y || item?.image_position_y || '50',
            detail_position_x: img.detail_position_x || img.position_x || item?.detail_position_x || item?.image_position_x || '50',
            detail_position_y: img.detail_position_y || img.position_y || item?.detail_position_y || item?.image_position_y || '50'
          });
        }
      });
    }

    const main = getImageSrc(item);
    if (main && !images.some(img => img.src === main)) {
      images.unshift({
        src: main,
        image_id: '',
        image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
        image_url: item?.image_url || '',
        position_x: item?.image_position_x || '50',
        position_y: item?.image_position_y || '50',
        card_position_x: item?.card_position_x || item?.image_position_x || '50',
        card_position_y: item?.card_position_y || item?.image_position_y || '50',
        detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
        detail_position_y: item?.detail_position_y || item?.image_position_y || '50'
      });
    }

    return images;
  }

  window.normalizeImages = normalizeImagesWithDualPositions;

  function ensureImagePositionTabs() {
    const modal = document.getElementById('imagePositionModal');
    if (!modal || document.getElementById('imagePositionMode')) return;

    const alert = modal.querySelector('.modal-body .alert');
    if (alert) {
      alert.innerHTML = 'هذا الضبط لا يقص الصورة الأصلية، بل يحدد الجزء الذي يظهر داخل الصورة. يمكنك ضبط عرض الصورة في الصفحة الرئيسية بشكل مستقل عن عرضها في الملف الشخصي للشهيد.';
      alert.insertAdjacentHTML('afterend', `
        <input type="hidden" id="imagePositionMode" value="card">
        <ul class="nav nav-pills image-position-tabs mb-3" role="tablist">
          <li class="nav-item" role="presentation">
            <button type="button" class="nav-link active" id="imagePositionTabCard" onclick="switchImagePositionMode('card')">
              <i class="fa-solid fa-table-cells-large ms-1"></i>
              الصورة في الصفحة الرئيسية
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button type="button" class="nav-link" id="imagePositionTabDetail" onclick="switchImagePositionMode('detail')">
              <i class="fa-solid fa-id-card ms-1"></i>
              الصورة في الملف الشخصي للشهيد
            </button>
          </li>
        </ul>
      `);
    }
  }

  function storeActivePositionInDraft() {
    const draft = window.__imagePositionDraft;
    if (!draft) return;

    const mode = document.getElementById('imagePositionMode')?.value || 'card';
    draft[mode] = {
      x: document.getElementById('imagePositionX')?.value || draft[mode]?.x || '50',
      y: document.getElementById('imagePositionY')?.value || draft[mode]?.y || '50'
    };
  }

  window.switchImagePositionMode = function(mode) {
    ensureImagePositionTabs();
    storeActivePositionInDraft();

    mode = mode === 'detail' ? 'detail' : 'card';
    const draft = window.__imagePositionDraft || { card: { x: '50', y: '50' }, detail: { x: '50', y: '50' } };

    document.getElementById('imagePositionMode').value = mode;
    document.getElementById('imagePositionTabCard')?.classList.toggle('active', mode === 'card');
    document.getElementById('imagePositionTabDetail')?.classList.toggle('active', mode === 'detail');

    const previewWrap = document.querySelector('#imagePositionModal .image-position-preview-wrap');
    if (previewWrap) {
      previewWrap.classList.toggle('image-position-card-preview', mode === 'card');
      previewWrap.classList.toggle('image-position-detail-preview', mode === 'detail');
    }

    document.getElementById('imagePositionX').value = draft[mode]?.x || '50';
    document.getElementById('imagePositionY').value = draft[mode]?.y || '50';
    updateImagePositionPreview();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;

    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    preview.style.objectPosition = `${x}% ${y}%`;

    storeActivePositionInDraft();
  };

window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? 'showPendingInfo()'
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
      
    // الحل: استخراج بيانات الصورة المستهدفة أولاً بدلاً من الاعتماد على العنصر الخام
    const targetImage = getPrimaryPositionTarget(item);
    const positionStyle = getImagePositionStyleByMode(targetImage, 'card');

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>`;
  };
  window.renderMartyrCardForFamily = function(item) {
    return renderMartyrCard(item).replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImagesWithDualPositions(item);
    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImagePositionStyleByMode(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
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
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImagePositionStyleByMode(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesWithDualPositions(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesWithDualPositions(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;
    ensureImagePositionTabs();

    const images = normalizeImagesWithDualPositions(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValue(img, 'card', 'x'),
        y: getPositionValue(img, 'card', 'y')
      },
      detail: {
        x: getPositionValue(img, 'detail', 'x'),
        y: getPositionValue(img, 'detail', 'y')
      }
    };

    switchImagePositionMode('card');
    modals.imagePositionModal.show();
  };

  function updateLocalImagePositions(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY) {
    if (!currentDetailsItem) return;

    if (Array.isArray(currentDetailsItem.images)) {
      currentDetailsItem.images = currentDetailsItem.images.map((old, oldIndex) => {
        const sameId = imageId && old.image_id === imageId;
        const sameFile = imageFileId && old.image_file_id === imageFileId;
        const sameIndex = !imageId && !imageFileId && oldIndex === index;
        return (sameId || sameFile || sameIndex)
          ? Object.assign({}, old, {
              card_position_x: cardPositionX,
              card_position_y: cardPositionY,
              detail_position_x: detailPositionX,
              detail_position_y: detailPositionY,
              position_x: detailPositionX,
              position_y: detailPositionY
            })
          : old;
      });
    }

    if (!imageFileId || currentDetailsItem.image_file_id === imageFileId) {
      currentDetailsItem.card_position_x = cardPositionX;
      currentDetailsItem.card_position_y = cardPositionY;
      currentDetailsItem.detail_position_x = detailPositionX;
      currentDetailsItem.detail_position_y = detailPositionY;
      currentDetailsItem.image_position_x = detailPositionX;
      currentDetailsItem.image_position_y = detailPositionY;
    }
  }

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;
    storeActivePositionInDraft();

    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const draft = window.__imagePositionDraft || { card: { x: '50', y: '50' }, detail: { x: '50', y: '50' } };

    const cardPositionX = draft.card?.x || '50';
    const cardPositionY = draft.card?.y || '50';
    const detailPositionX = draft.detail?.x || '50';
    const detailPositionY = draft.detail?.y || '50';

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    runWithoutScrollJump(() => apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX: detailPositionX,
      positionY: detailPositionY,
      cardPositionX,
      cardPositionY,
      detailPositionX,
      detailPositionY
    }).then(res => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع الصورة.');

      updateLocalImagePositions(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY);

      modals.imagePositionModal.hide();
      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);
      renderMartyrs();
      showToast(res.message || 'تم ضبط موضع ظهور الصورة.');

      setTimeout(() => {
        loadInitialData();
        if (isAdminLoggedIn) refreshDashboardData(false);
      }, 100);
    }).catch(err => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      showToast(err.message || 'تعذر حفظ موضع الصورة.');
    }));
  };

  function mutateMartyrStatusLocally(martyrId, status) {
    [allMartyrs, dashboardData].forEach(list => {
      if (!Array.isArray(list)) return;
      const item = list.find(x => x.martyr_id === martyrId);
      if (item) item.verification_status = status;
    });

    if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
      currentDetailsItem.verification_status = status;
    }
  }

  window.updateStatusFromDetails = function(martyrId, status) {
    const notes = document.getElementById('reviewerNotes')?.value || '';

    runWithoutScrollJump(() => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: notes
    }).then(res => {
      mutateMartyrStatusLocally(martyrId, status);
      showToast(res.message || 'تم تحديث الحالة.');

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'homePage', true);
      }

      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث الحالة.');
    }));
  };

  window.quickUpdateStatus = function(martyrId, status) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    runWithoutScrollJump(() => apiRequest('updateVerificationStatus', {
      martyrId,
      newStatus: status,
      reviewerNotes: ''
    }).then(res => {
      mutateMartyrStatusLocally(martyrId, status);
      showToast(res.message || 'تم تحديث الحالة.');
      renderMartyrs();
      if (typeof renderDashboardTable === 'function') renderDashboardTable();
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => {
      showToast(err.message || 'تعذر تحديث الحالة.');
    }));
  };

  window.saveCompletionSwitches = function(martyrId) {
    const allow = document.getElementById('allowUpdatesSwitch')?.checked ? 'نعم' : 'لا';
    const needs = document.getElementById('needsCompletionSwitch')?.checked ? 'نعم' : 'لا';

    runWithoutScrollJump(() => apiRequest('setMartyrCompletionOptions', {
      martyrId,
      allowUpdates: allow,
      needsCompletion: needs
    }).then(res => {
      [allMartyrs, dashboardData].forEach(list => {
        if (!Array.isArray(list)) return;
        const item = list.find(x => x.martyr_id === martyrId);
        if (item) {
          item.allow_updates = allow;
          item.needs_completion = needs;
        }
      });
      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        currentDetailsItem.allow_updates = allow;
        currentDetailsItem.needs_completion = needs;
      }
      showToast(res.message || 'تم حفظ الخيارات.');
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => showToast(err.message || 'تعذر حفظ الخيارات.')));
  };

  window.verifyWithCompletionQuick = function(martyrId) {
    runWithoutScrollJump(() => apiRequest('verifyMartyrWithCompletion', { martyrId }).then(() => {
      const item = dashboardData.find(x => x.martyr_id === martyrId) || allMartyrs.find(x => x.martyr_id === martyrId);
      if (item) {
        item.verification_status = 'موثق';
        item.needs_completion = 'نعم';
        item.allow_updates = 'نعم';
      }
      showToast('تم التوثيق مع الاستكمال');
      if (typeof renderDashboardTable === 'function') renderDashboardTable();
      setTimeout(() => {
        refreshDashboardData(false);
        loadInitialData();
      }, 100);
    }).catch(err => showToast(err.message || 'تعذر تحديث الحالة.')));
  };

  const oldRenderDashboardTable = window.renderDashboardTable;
  window.renderDashboardTable = function() {
    if (typeof oldRenderDashboardTable !== 'function') return;
    oldRenderDashboardTable();

    document.querySelectorAll("button[onclick*='verifyMartyrWithCompletion']").forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      const match = onclick.match(/martyrId:'([^']+)'/);
      if (match && match[1]) {
        btn.setAttribute('onclick', `verifyWithCompletionQuick('${match[1]}')`);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', ensureImagePositionTabs);
})();
