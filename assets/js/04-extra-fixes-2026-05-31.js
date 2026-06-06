(function() {
  const NEW_MARTYRDOM_TYPES = [
    { value: 'تحت التعذيب', id: 'typeTorture' },
    { value: 'معتقل', id: 'typeDetained' },
    { value: 'مفقود', id: 'typeMissing' },
    // { value: 'زلزال تركيا', id: 'typeTurkeyEarthquake' }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    ensureNewMartyrdomFields();
    ensureEditExtraFields();

    const el = document.getElementById('imagePositionModal');
    if (el && typeof bootstrap !== 'undefined') {
      modals.imagePositionModal = new bootstrap.Modal(el);
    }
  });

  function ensureNewMartyrdomFields() {
    const typeOther = document.getElementById('typeOther');
    const row = typeOther ? typeOther.closest('.d-flex') : null;

    if (row && !document.getElementById('typeTorture')) {
      NEW_MARTYRDOM_TYPES.forEach(item => {
        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input" type="radio" name="martyrdom_type" value="${escapeAttr(item.value)}" id="${item.id}" required onchange="toggleCauseFields()">
          <label class="form-check-label" for="${item.id}">${escapeHtml(item.value)}</label>
        `;
        row.insertBefore(div, typeOther.closest('.form-check'));
      });
    }

    const otherBox = document.getElementById('otherCauseBox');
    if (otherBox && !document.getElementById('securityBranchBox')) {
      otherBox.insertAdjacentHTML('afterend', `
        <div class="col-md-6 d-none" id="securityBranchBox">
          <label class="form-label fw-bold">بيانات الفرع الأمني</label>
          <input type="text" class="form-control" name="security_branch" placeholder="اختياري">
        </div>
        <div class="col-md-6 d-none" id="lastSeenPlaceBox">
          <label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label>
          <input type="text" class="form-control" name="last_seen_place" placeholder="اختياري">
        </div>
      `);
    }
  }

  function ensureEditExtraFields() {
    const placeField = document.getElementById('edit_martyrdom_place');
    const holder = placeField ? placeField.closest('.col-md-6') : null;
    if (holder && !document.getElementById('edit_security_branch')) {
      holder.insertAdjacentHTML('afterend', `
        <div class="col-md-6"><label class="form-label fw-bold">بيانات الفرع الأمني</label><input class="form-control" id="edit_security_branch"></div>
        <div class="col-md-6"><label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label><input class="form-control" id="edit_last_seen_place"></div>
      `);
    }
  }

  window.toggleCauseFields = function() {
    const type = document.querySelector('input[name="martyrdom_type"]:checked')?.value || '';
    const battleBox = document.getElementById('battleNameBox');
    const otherBox = document.getElementById('otherCauseBox');
    const securityBox = document.getElementById('securityBranchBox');
    const lastSeenBox = document.getElementById('lastSeenPlaceBox');

    const battleInput = document.querySelector('[name="battle_name"]');
    const otherInput = document.querySelector('[name="other_cause"]');
    const securityInput = document.querySelector('[name="security_branch"]');
    const lastSeenInput = document.querySelector('[name="last_seen_place"]');

    if (battleBox) battleBox.classList.toggle('d-none', type !== 'المعارك');
    if (otherBox) otherBox.classList.toggle('d-none', type !== 'آخر');
    if (securityBox) securityBox.classList.toggle('d-none', !(type === 'تحت التعذيب' || type === 'معتقل'));
    if (lastSeenBox) lastSeenBox.classList.toggle('d-none', type !== 'مفقود');

    if (battleInput) battleInput.required = type === 'المعارك';
    if (otherInput) otherInput.required = type === 'آخر';
    if (securityInput) securityInput.required = false;
    if (lastSeenInput) lastSeenInput.required = false;

    if (battleInput && type !== 'المعارك') battleInput.value = '';
    if (otherInput && type !== 'آخر') otherInput.value = '';
    if (securityInput && !(type === 'تحت التعذيب' || type === 'معتقل')) securityInput.value = '';
    if (lastSeenInput && type !== 'مفقود') lastSeenInput.value = '';
  };

  function getImagePositionStyle(target) {
    const x = Number(target?.position_x || target?.image_position_x || 50);
    const y = Number(target?.position_y || target?.image_position_y || 50);
    const safeX = Math.max(0, Math.min(100, isNaN(x) ? 50 : x));
    const safeY = Math.max(0, Math.min(100, isNaN(y) ? 50 : y));
    return `object-position:${safeX}% ${safeY}%;`;
  }

  function getPrimaryPositionTarget(item) {
    const images = normalizeImages(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? "showPendingInfo()"
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
    const positionStyle = getImagePositionStyle(getPrimaryPositionTarget(item));

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
    const html = renderMartyrCard(item);
    return html.replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  const previousNormalizeImages = window.normalizeImages;
  window.normalizeImages = function(item) {
    const images = [];
    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000` : (img.image_url || '');
        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50'
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
        position_y: item?.image_position_y || '50'
      });
    }

    return images;
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImages(item);
    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImagePositionStyle(first);

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
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImagePositionStyle(img)} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImages(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImages(currentDetailsItem || {});
    if (!images.length) return;
    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;
    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;
    const images = normalizeImages(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionX').value = img.position_x || currentDetailsItem.image_position_x || '50';
    document.getElementById('imagePositionY').value = img.position_y || currentDetailsItem.image_position_y || '50';
    document.getElementById('imagePositionPreview').src = img.src;
    updateImagePositionPreview();
    modals.imagePositionModal.show();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;
    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    preview.style.objectPosition = `${x}% ${y}%`;
  };

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;
    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const positionX = document.getElementById('imagePositionX')?.value || '50';
    const positionY = document.getElementById('imagePositionY')?.value || '50';

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX,
      positionY
    }).then(res => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع الصورة.');

      const images = normalizeImages(currentDetailsItem);
      if (Array.isArray(currentDetailsItem.images) && images[index]) {
        currentDetailsItem.images = currentDetailsItem.images.map(old => {
          const sameId = imageId && old.image_id === imageId;
          const sameFile = imageFileId && old.image_file_id === imageFileId;
          return (sameId || sameFile) ? Object.assign({}, old, { position_x: positionX, position_y: positionY }) : old;
        });
      }
      if (!imageId || currentDetailsItem.image_file_id === imageFileId) {
        currentDetailsItem.image_position_x = positionX;
        currentDetailsItem.image_position_y = positionY;
      }

      modals.imagePositionModal.hide();
      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);
      showToast(res.message || 'تم ضبط موضع ظهور الصورة.');
      loadInitialData();
      if (isAdminLoggedIn) refreshDashboardData(false);
    }).catch(err => {
      btn.disabled = false;
      btn.innerHTML = 'حفظ موضع الصورة';
      showToast(err.message || 'تعذر حفظ موضع الصورة.');
    });
  };

function detailTownBadge(item) {
  const town = String(
    item?.town_name ||
    item?.town ||
    item?.village_name ||
    item?.place_name ||
    ''
  ).trim();

  if (!town) return '';

  return `
    <span class="badge taldo-detail-town-badge" title="البلدة">
      <i class="fa-solid fa-location-dot ms-1"></i>
      ${escapeHtml(town)}
    </span>`;
}

function detailStatusTownHtml(item) {
  return `
    <div class="taldo-detail-status-town">
      ${statusBadge(item.verification_status)}
      ${detailTownBadge(item)}
    </div>`;
}
  
  window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
    const source = isAdminLoggedIn && dashboardData.length ? dashboardData : allMartyrs;
    const item = source.find(x => x.martyr_id === martyrId);
    if (!item) return;

    if (item.verification_status === 'بانتظار التوثيق' && !isAdminLoggedIn) {
      showPendingInfo();
      return;
    }

    currentDetailsItem = item;
    currentGalleryIndex = 0;
    lastPageBeforeDetails = fromPage || 'homePage';

    if (!noRoute) {
      let pageParam = 'home';
      let tabParam = '';
      if (fromPage === 'dashboardDataUpdatesTab') {
        pageParam = 'dashboard';
        tabParam = '&tab=dataUpdates';
      } else if (fromPage === 'dashboardJoinRequestsTab') {
        pageParam = 'dashboard';
        tabParam = '&tab=joinRequests';
      } else if (fromPage === 'dashboardPage') {
        pageParam = 'dashboard';
        tabParam = '&tab=martyrs';
      }
      updateRoute(`?page=${pageParam}${tabParam}&m=${encodeURIComponent(martyrId)}`, { page: 'details', martyrId, fromPage });
    }

    const canUpdate = isAllowUpdatesEnabled(item.allow_updates);

    document.getElementById('detailsContainer').innerHTML = `
      <div class="row g-4">
        <div class="col-lg-5">${renderImageGallery(item)}</div>
        <div class="col-lg-7">
          <div class="detail-box">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 class="fw-bold mb-1">${escapeHtml(item.full_name || '')} ${adminEditBtn('full_name')}</h2>
                <div class="text-muted">عائلة ${escapeHtml(item.family_name || '')} ${adminEditBtn('family_name')}</div>
              </div>
              ${detailStatusTownHtml(item)}
            </div>
            <div class="row g-3">
              ${detailItemEditable('اسم الأب', item.father_name, 'father_name')}
              ${detailItemEditable('المواليد', item.birth_year, 'birth_year')}
              ${detailItemEditable('اللقب', item.nickname, 'nickname')}
              ${detailItemEditable('استشهد بـ', item.martyrdom_type, 'martyrdom_type')}
              ${item.martyrdom_type === 'المعارك' ? detailItemEditable('اسم المعركة', item.battle_name, 'battle_name') : ''}
              ${item.martyrdom_type === 'آخر' ? detailItemEditable('السبب', item.other_cause, 'other_cause') : ''}
              ${(item.martyrdom_type === 'تحت التعذيب' || item.martyrdom_type === 'معتقل') ? detailItemEditable('بيانات الفرع الأمني', item.security_branch, 'security_branch') : ''}
              ${item.martyrdom_type === 'مفقود' ? detailItemEditable('آخر مكان شوهد فيه', item.last_seen_place, 'last_seen_place') : ''}
              ${detailItemEditable('تاريخ الاستشهاد', item.martyrdom_date, 'martyrdom_date')}
              ${detailItemEditable('مكان الاستشهاد', item.martyrdom_place, 'martyrdom_place')}
            </div>
            ${item.extra_info ? `<hr><h6 class="fw-bold">معلومات إضافية ${adminEditBtn('extra_info')}</h6><p class="lh-lg mb-0">${escapeHtml(item.extra_info)}</p>` : ''}
            ${item.completed_info ? `
              <div class="completed-info-box">
                <h6 class="fw-bold text-warning-emphasis mb-2"><i class="fa-solid fa-circle-info ms-1"></i> بيانات مستكملة</h6>
                <p class="lh-lg mb-0">${escapeHtml(item.completed_info)}</p>
              </div>` : ''}
            <div class="details-action-bar">
              <button class="btn btn-primary" onclick="shareMartyr('${escapeAttr(item.martyr_id)}')"><i class="fa-solid fa-share-nodes ms-1"></i> مشاركة</button>
              ${canUpdate ? `<button class="btn btn-warning" onclick="openDataUpdateModal('${escapeAttr(item.martyr_id)}', '${escapeAttr(item.full_name || '')}')"><i class="fa-solid fa-pen-to-square ms-1"></i> استكمال بيانات</button>` : ''}
            </div>
            ${isAdminLoggedIn ? renderAdminActions(item) : ''}
          </div>
        </div>
      </div>`;

    showPage('detailsPage');
  };

  window.renderAdminActions = function(item) {
    const allowChecked = isAllowUpdatesEnabled(item.allow_updates) ? 'checked' : '';
    const needsChecked = isNeedsCompletion(item) ? 'checked' : '';
    const status = item.verification_status || '';

    let buttons = '';
    if (status === 'موثق') {
      buttons = `<button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')"><i class="fa-solid fa-xmark ms-1"></i> تحويل لمرفوض</button>`;
    } else if (status === 'مرفوض') {
      buttons = `<button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')"><i class="fa-solid fa-check ms-1"></i> تحويل لموثق</button>`;
    } else {
      buttons = `
        <button class="btn btn-success" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'موثق')"><i class="fa-solid fa-check ms-1"></i> توثيق</button>
        <button class="btn btn-outline-danger" onclick="updateStatusFromDetails('${escapeAttr(item.martyr_id)}', 'مرفوض')"><i class="fa-solid fa-xmark ms-1"></i> رفض</button>
      `;
    }

    return `
      <div class="admin-box mt-4">
        <h6 class="fw-bold mb-3"><i class="fa-solid fa-user-shield ms-1"></i> أدوات المراجعة</h6>
        <div class="row g-3">
          <div class="col-md-8"><textarea id="reviewerNotes" class="form-control" rows="2" placeholder="ملاحظات المراجع"></textarea></div>
          <div class="col-md-4 d-grid gap-2">${buttons}</div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="allowUpdatesSwitch" ${allowChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
              <label class="form-check-label fw-bold" for="allowUpdatesSwitch">إظهار زر استكمال البيانات</label>
            </div>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="needsCompletionSwitch" ${needsChecked} onchange="saveCompletionSwitches('${escapeAttr(item.martyr_id)}')">
              <label class="form-check-label fw-bold" for="needsCompletionSwitch">إظهار علامة يحتاج استكمال</label>
            </div>
          </div>
        </div>
      </div>`;
  };

  window.openEditMartyrModal = function(focusField) {
    if (!currentDetailsItem) return;
    ensureEditExtraFields();
    const fields = ['full_name','family_name','father_name','birth_year','nickname','martyrdom_type','battle_name','other_cause','security_branch','last_seen_place','martyrdom_date','martyrdom_place','extra_info'];
    document.getElementById('editMartyrId').value = currentDetailsItem.martyr_id;
    fields.forEach(field => {
      const el = document.getElementById('edit_' + field);
      if (el) el.value = currentDetailsItem[field] || '';
    });
    modals.editMartyrModal.show();
    setTimeout(() => document.getElementById('edit_' + focusField)?.focus(), 250);
  };

  window.saveMartyrEdits = function() {
    const fields = ['full_name','family_name','father_name','birth_year','nickname','martyrdom_type','battle_name','other_cause','security_branch','last_seen_place','martyrdom_date','martyrdom_place','extra_info'];
    const payload = { martyr_id: document.getElementById('editMartyrId').value };
    fields.forEach(field => payload[field] = document.getElementById('edit_' + field)?.value || '');

    const btn = document.getElementById('editMartyrSaveBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;

    apiRequest('updateMartyrFields', payload)
      .then(res => {
        btn.disabled = false;
        btn.innerHTML = 'حفظ التعديلات';
        if (!res.success) return showToast(res.message || 'تعذر الحفظ.');
        modals.editMartyrModal.hide();
        showToast(res.message || 'تم الحفظ.');
        refreshDashboardData(false);
        loadInitialData();
      })
      .catch(err => {
        btn.disabled = false;
        btn.innerHTML = 'حفظ التعديلات';
        showToast(err.message || 'تعذر الحفظ.');
      });
  };
})();
