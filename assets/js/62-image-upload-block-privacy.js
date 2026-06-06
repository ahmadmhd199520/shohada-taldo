(function () {
  'use strict';

  const SETTING_KEY = 'image_upload_blocked_martyrs_json';
  const BLOCKED_UPLOAD_MESSAGE = 'لا يمكن رفع صور لهذا السجل.';

  function clean(value) {
    return String(value || '').trim();
  }

  function safeHtml(value) {
    return clean(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getSettingsObject() {
    let settings = {};

    try {
      if (typeof publicSettings !== 'undefined' && publicSettings) {
        settings = publicSettings;
      }
    } catch (error) {}

    if (window.publicSettings && typeof window.publicSettings === 'object') {
      settings = Object.assign({}, settings, window.publicSettings);
    }

    return settings || {};
  }

  function parseBlockedList(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);

    const text = clean(value);
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch (error) {}

    return text
      .split(/[\n,،;؛]+/)
      .map(clean)
      .filter(Boolean);
  }

  function getBlockedIds() {
    const settings = getSettingsObject();

    return Array.from(new Set([
      ...parseBlockedList(settings.image_upload_blocked_martyrs),
      ...parseBlockedList(settings[SETTING_KEY]),
      ...parseBlockedList(settings.image_upload_blocked_martyrs_json)
    ]));
  }

  function setBlockedIdsLocal(ids) {
    const unique = Array.from(new Set((ids || []).map(clean).filter(Boolean)));

    try {
      if (typeof publicSettings !== 'undefined') {
        publicSettings = publicSettings || {};
        publicSettings.image_upload_blocked_martyrs = unique;
        publicSettings[SETTING_KEY] = JSON.stringify(unique);
      }
    } catch (error) {}

    if (!window.publicSettings) window.publicSettings = {};
    window.publicSettings.image_upload_blocked_martyrs = unique;
    window.publicSettings[SETTING_KEY] = JSON.stringify(unique);
  }

  function clearImageBlockRelatedClientCache() {
    try {
      Object.keys(localStorage || {}).forEach(key => {
        if (
          key.indexOf('taldo_api_cache') === 0 ||
          key === 'taldo_admin_dashboard_cache_v2'
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {}
  }

  function getApiUrlForPrivacyRequest() {
    try {
      if (typeof API_URL !== 'undefined' && API_URL) return API_URL;
    } catch (error) {}

    try {
      if (window.API_URL) return window.API_URL;
    } catch (error) {}

    return '';
  }

  async function apiRequestWithTimeout(action, data, timeoutMs) {
    timeoutMs = Number(timeoutMs || 15000);

    const url = getApiUrlForPrivacyRequest();
    const payload = { action, data: data || {} };

    if (!url || typeof AbortController === 'undefined') {
      return await Promise.race([
        apiRequest(action, data || {}),
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: false,
            timeout: true,
            message: 'انتهت مهلة الاتصال بالخادم. أعد المحاولة بعد قليل.'
          }), timeoutMs);
        })
      ]);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await res.text();

      if (!res.ok) {
        return {
          success: false,
          message: 'تعذر الاتصال بالخادم. كود الخطأ: ' + res.status
        };
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        return {
          success: false,
          message: 'الخادم لم يرجع بيانات JSON صالحة.'
        };
      }
    } catch (error) {
      return {
        success: false,
        timeout: error && error.name === 'AbortError',
        message: (error && error.name === 'AbortError')
          ? 'انتهت مهلة الاتصال بالخادم. أعد المحاولة بعد قليل.'
          : (error.message || 'تعذر الاتصال بالخادم.')
      };
    } finally {
      clearTimeout(timer);
    }
  }

  function forceHideGlobalSpinner() {
    try { if (typeof hideGlobalSpinner === 'function') hideGlobalSpinner(); } catch (error) {}

    try {
      const overlay = document.getElementById('globalLoadingOverlay');
      if (overlay) overlay.classList.remove('show');
    } catch (error) {}
  }

  function normalizeBlockedFlag(value) {
    const text = clean(value).toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');

    return ['نعم', 'yes', 'true', '1', 'blocked', 'ممنوع', 'منع'].includes(text);
  }

  function getMartyrId(input) {
    if (!input) return '';
    if (typeof input === 'object') return clean(input.martyr_id || input.martyrId || input.id);
    return clean(input);
  }

  function isImageUploadBlocked(input) {
    if (input && typeof input === 'object') {
      if (normalizeBlockedFlag(input.image_upload_blocked || input.images_blocked || input.prevent_image_upload)) {
        return true;
      }
    }

    const martyrId = getMartyrId(input);
    if (!martyrId) return false;

    return getBlockedIds().includes(martyrId);
  }

  window.isMartyrImageUploadBlocked = isImageUploadBlocked;

  function findMartyrByIdSafe(martyrId) {
    martyrId = clean(martyrId);
    if (!martyrId) return null;

    const sources = [];
    try { if (Array.isArray(allMartyrs)) sources.push(allMartyrs); } catch (error) {}
    try { if (Array.isArray(dashboardData)) sources.push(dashboardData); } catch (error) {}
    try { if (window.currentDetailsItem) sources.push([window.currentDetailsItem]); } catch (error) {}
    try { if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) sources.push([currentDetailsItem]); } catch (error) {}

    for (const list of sources) {
      const item = list.find(row => clean(row && row.martyr_id) === martyrId);
      if (item) return item;
    }

    return null;
  }

  function hasAnyImage(item) {
    if (!item) return false;

    if (clean(item.image_file_id) || clean(item.image_url)) return true;

    if (Array.isArray(item.images)) {
      return item.images.some(img => img && (clean(img.image_file_id) || clean(img.image_url) || clean(img.src)));
    }

    try {
      if (typeof getImageSrc === 'function' && getImageSrc(item)) return true;
    } catch (error) {}

    try {
      if (typeof normalizeImages === 'function' && normalizeImages(item).length) return true;
    } catch (error) {}

    return false;
  }

  function blockedDetailPlaceholder() {
    return `
      <div class="detail-image-placeholder taldo-image-blocked-placeholder">
        <div>
          <span class="taldo-image-blocked-icon" aria-hidden="true"><i class="fa-solid fa-user"></i></span>
          <div class="fw-bold">رفع الصور غير متاح لهذا السجل</div>
          // <div class="small mt-2 px-3">حفاظًا على الخصوصية ومراعاةً لمشاعر ذوي الشهيدة.</div>
        </div>
      </div>`;
  }

  function blockedCardPlaceholder() {
    return `<div class="martyr-placeholder taldo-image-blocked-placeholder-card"><span class="taldo-image-blocked-icon" aria-hidden="true"><i class="fa-solid fa-user"></i></span></div>`;
  }

  function patchCardHtml(html, item) {
    if (!isImageUploadBlocked(item)) return html;

    const text = String(html || '');
    if (!text) return text;

    return text
      .replace(/<div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"><\/i><\/div>/g, blockedCardPlaceholder().replace('class="martyr-placeholder', 'style="display:none;" class="martyr-placeholder'))
      .replace(/<div class="martyr-placeholder"><i class="fa-solid fa-user"><\/i><\/div>/g, blockedCardPlaceholder());
  }

  function installRendererPatches() {
    const oldGallery = window.renderImageGallery || (typeof renderImageGallery === 'function' ? renderImageGallery : null);
    if (typeof oldGallery === 'function' && !oldGallery.__imageUploadBlockWrapped) {
      window.renderImageGallery = function (item) {
        if (isImageUploadBlocked(item) && !hasAnyImage(item)) {
          return blockedDetailPlaceholder();
        }
        return oldGallery.apply(this, arguments);
      };
      window.renderImageGallery.__imageUploadBlockWrapped = true;
      try { renderImageGallery = window.renderImageGallery; } catch (error) {}
    }

    const oldCard = window.renderMartyrCard || (typeof renderMartyrCard === 'function' ? renderMartyrCard : null);
    if (typeof oldCard === 'function' && !oldCard.__imageUploadBlockWrapped) {
      window.renderMartyrCard = function (item) {
        return patchCardHtml(oldCard.apply(this, arguments), item);
      };
      window.renderMartyrCard.__imageUploadBlockWrapped = true;
      try { renderMartyrCard = window.renderMartyrCard; } catch (error) {}
    }

    const oldFamilyCard = window.renderMartyrCardForFamily || (typeof renderMartyrCardForFamily === 'function' ? renderMartyrCardForFamily : null);
    if (typeof oldFamilyCard === 'function' && !oldFamilyCard.__imageUploadBlockWrapped) {
      window.renderMartyrCardForFamily = function (item) {
        return patchCardHtml(oldFamilyCard.apply(this, arguments), item);
      };
      window.renderMartyrCardForFamily.__imageUploadBlockWrapped = true;
      try { renderMartyrCardForFamily = window.renderMartyrCardForFamily; } catch (error) {}
    }
  }

  function getCurrentDetailsItemSafe() {
    try { if (window.currentDetailsItem) return window.currentDetailsItem; } catch (error) {}
    try { if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) return currentDetailsItem; } catch (error) {}
    return null;
  }

  function getCurrentMartyrIdSafe() {
    const item = getCurrentDetailsItemSafe();
    if (item && item.martyr_id) return item.martyr_id;
    try { return new URLSearchParams(window.location.search).get('m') || ''; } catch (error) { return ''; }
  }

  function renderAdminBlockBox(item) {
    const checked = isImageUploadBlocked(item) ? 'checked' : '';
    const martyrId = safeHtml(getMartyrId(item));

    return `
      <div class="admin-box taldo-image-block-admin-box mt-3">
        <h6 class="fw-bold mb-2">
          <i class="fa-solid fa-ban text-danger ms-1"></i>
          خصوصية الصور
        </h6>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="imageUploadBlockedSwitch" ${checked}
            onchange="setMartyrImageUploadBlockedFromDetails('${martyrId}', this.checked)">
          <label class="form-check-label fw-bold" for="imageUploadBlockedSwitch">
            منع رفع صور جديدة لهذا الشهيد
          </label>
        </div>
        <div class="small text-muted mt-2">
          عند تفعيل هذا الخيار، لن يستطيع الزوار إرسال صور لهذا السجل، وستظهر إشارة المنع مكان الصورة المؤقتة إذا لم تكن هناك صورة مرفقة.
        </div>
      </div>`;
  }

  function installAdminBoxPatch() {
    const oldAdminActions = window.renderAdminActions || (typeof renderAdminActions === 'function' ? renderAdminActions : null);
    if (typeof oldAdminActions === 'function' && !oldAdminActions.__imageUploadBlockWrapped) {
      window.renderAdminActions = function (item) {
        return String(oldAdminActions.apply(this, arguments) || '') + renderAdminBlockBox(item || {});
      };
      window.renderAdminActions.__imageUploadBlockWrapped = true;
      try { renderAdminActions = window.renderAdminActions; } catch (error) {}
    }
  }

  function updateBlockedListForId(martyrId, blocked) {
    martyrId = clean(martyrId);
    if (!martyrId) return [];

    const ids = getBlockedIds().filter(id => id !== martyrId);
    if (blocked) ids.push(martyrId);
    setBlockedIdsLocal(ids);

    [
      (() => { try { return allMartyrs; } catch (error) { return null; } })(),
      (() => { try { return dashboardData; } catch (error) { return null; } })(),
      (() => { try { return [currentDetailsItem]; } catch (error) { return null; } })()
    ].forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (item && clean(item.martyr_id) === martyrId) {
          item.image_upload_blocked = blocked ? 'نعم' : 'لا';
        }
      });
    });

    return ids;
  }

  window.setMartyrImageUploadBlockedFromDetails = async function (martyrId, blocked) {
    martyrId = clean(martyrId);
    if (!martyrId) return;

    const checkbox = document.getElementById('imageUploadBlockedSwitch');
    const label = checkbox ? document.querySelector('label[for="imageUploadBlockedSwitch"]') : null;
    const oldLabelHtml = label ? label.innerHTML : '';

    if (checkbox) checkbox.disabled = true;
    if (label) label.innerHTML = '<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...';

    // هذا الإجراء صغير، لذلك لا نستخدم السبينر العام حتى لا يحجب الصفحة إذا علّق طلب الشبكة.
    forceHideGlobalSpinner();

    try {
      const res = await apiRequestWithTimeout('setMartyrImageUploadBlocked', {
        martyrId,
        martyr_id: martyrId,
        blocked: blocked ? 'نعم' : 'لا',
        imageUploadBlocked: blocked ? 'نعم' : 'لا',
        __cacheBust: Date.now(),
        forceFresh: true
      }, 15000);

      if (!res || res.success === false) {
        if (checkbox) checkbox.checked = !blocked;
        if (typeof showToast === 'function') showToast(res?.message || 'تعذر حفظ خيار منع رفع الصور.');
        return;
      }

      updateBlockedListForId(martyrId, !!blocked);
      refreshDetailsImageBlockUi();
      patchBlockedPlaceholdersInDom();

      if (typeof showToast === 'function') {
        showToast(res.message || (blocked ? 'تم منع رفع الصور لهذا السجل.' : 'تم السماح برفع الصور لهذا السجل.'));
      }

      clearImageBlockRelatedClientCache();
      try {
        window.dispatchEvent(new CustomEvent('taldo:image-upload-block-changed', {
          detail: { martyrId, blocked: !!blocked }
        }));
      } catch (error) {}
    } catch (error) {
      if (checkbox) checkbox.checked = !blocked;
      if (typeof showToast === 'function') showToast(error.message || 'تعذر حفظ خيار منع رفع الصور.');
    } finally {
      if (checkbox) checkbox.disabled = false;
      if (label) label.innerHTML = oldLabelHtml || 'منع رفع صور جديدة لهذا الشهيد';
      forceHideGlobalSpinner();
      setTimeout(forceHideGlobalSpinner, 250);
      setTimeout(forceHideGlobalSpinner, 1000);
    }
  };

  function applyDataUpdateImageBlockState(martyrId) {
    martyrId = clean(martyrId || document.getElementById('dataUpdateMartyrId')?.value || getCurrentMartyrIdSafe());

    const blocked = isImageUploadBlocked(martyrId);
    const modal = document.getElementById('dataUpdateModal');
    const imageInput = document.getElementById('dataUpdateImageInput');
    const imageWrap = imageInput ? imageInput.closest('.mb-3') : null;
    const alertBox = modal ? modal.querySelector('.modal-body .alert') : null;
    let notice = document.getElementById('imageUploadBlockedNotice');

    if (!modal || !imageInput) return;

    if (blocked) {
      imageInput.value = '';
      imageInput.disabled = true;
      if (imageWrap) imageWrap.classList.add('d-none');

      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'imageUploadBlockedNotice';
        notice.className = 'alert alert-warning taldo-image-block-notice';
        notice.innerHTML = `<i class="fa-solid fa-ban ms-1"></i>${BLOCKED_UPLOAD_MESSAGE}`;
        if (alertBox) alertBox.insertAdjacentElement('afterend', notice);
        else modal.querySelector('.modal-body')?.prepend(notice);
      }
    } else {
      imageInput.disabled = false;
      if (imageWrap) imageWrap.classList.remove('d-none');
      if (notice) notice.remove();
    }
  }

  function installDataUpdatePatches() {
    const oldOpenDataUpdateModal = window.openDataUpdateModal || (typeof openDataUpdateModal === 'function' ? openDataUpdateModal : null);
    if (typeof oldOpenDataUpdateModal === 'function' && !oldOpenDataUpdateModal.__imageUploadBlockWrapped) {
      window.openDataUpdateModal = function (martyrId) {
        const result = oldOpenDataUpdateModal.apply(this, arguments);
        setTimeout(() => applyDataUpdateImageBlockState(martyrId), 30);
        setTimeout(() => applyDataUpdateImageBlockState(martyrId), 150);
        return result;
      };
      window.openDataUpdateModal.__imageUploadBlockWrapped = true;
      try { openDataUpdateModal = window.openDataUpdateModal; } catch (error) {}
    }

    const oldPhotoOnly = window.openPhotoOnlyUploadModal;
    if (typeof oldPhotoOnly === 'function' && !oldPhotoOnly.__imageUploadBlockWrapped) {
      window.openPhotoOnlyUploadModal = function (martyrId) {
        martyrId = clean(martyrId || getCurrentMartyrIdSafe());
        if (isImageUploadBlocked(martyrId)) {
          if (typeof showToast === 'function') showToast(BLOCKED_UPLOAD_MESSAGE);
          return;
        }
        return oldPhotoOnly.apply(this, arguments);
      };
      window.openPhotoOnlyUploadModal.__imageUploadBlockWrapped = true;
    }

    const oldSubmitDataUpdate = window.submitDataUpdateForm || (typeof submitDataUpdateForm === 'function' ? submitDataUpdateForm : null);
    if (typeof oldSubmitDataUpdate === 'function' && !oldSubmitDataUpdate.__imageUploadBlockWrapped) {
      window.submitDataUpdateForm = function () {
        const martyrId = document.getElementById('dataUpdateMartyrId')?.value || getCurrentMartyrIdSafe();
        const imageInput = document.getElementById('dataUpdateImageInput');

        if (isImageUploadBlocked(martyrId) && imageInput && imageInput.files && imageInput.files.length) {
          imageInput.value = '';
          if (typeof showToast === 'function') showToast(BLOCKED_UPLOAD_MESSAGE);
          applyDataUpdateImageBlockState(martyrId);
          return;
        }

        return oldSubmitDataUpdate.apply(this, arguments);
      };
      window.submitDataUpdateForm.__imageUploadBlockWrapped = true;
      try { submitDataUpdateForm = window.submitDataUpdateForm; } catch (error) {}
    }
  }

  function refreshDetailsImageBlockUi() {
    const item = getCurrentDetailsItemSafe();
    if (!item) return;

    const blocked = isImageUploadBlocked(item);
    const actionBar = document.querySelector('#detailsContainer .details-action-bar');
    const photoBtn = actionBar ? actionBar.querySelector('.details-photo-upload-btn') : null;
    let hint = actionBar ? actionBar.querySelector('.taldo-photo-upload-blocked-hint') : null;

    if (photoBtn) {
      photoBtn.classList.toggle('d-none', blocked);
      photoBtn.disabled = blocked;
    }

    if (blocked && actionBar && !hint) {
      hint = document.createElement('div');
      hint.className = 'alert alert-warning taldo-photo-upload-blocked-hint w-100 mb-0 py-2 small';
      hint.innerHTML = `<i class="fa-solid fa-ban ms-1"></i>${BLOCKED_UPLOAD_MESSAGE}`;
      actionBar.appendChild(hint);
    }

    if (!blocked && hint) hint.remove();

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder && blocked && !hasAnyImage(item) && !holder.querySelector('.taldo-image-blocked-placeholder')) {
      holder.innerHTML = renderImageGallery(item);
    }
    if (holder && !blocked && holder.querySelector('.taldo-image-blocked-placeholder')) {
      holder.innerHTML = renderImageGallery(item);
    }
  }

  function installDetailsPatch() {
    const oldOpenDetails = window.openMartyrDetails || (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);
    if (typeof oldOpenDetails === 'function' && !oldOpenDetails.__imageUploadBlockWrapped) {
      window.openMartyrDetails = function () {
        const result = oldOpenDetails.apply(this, arguments);
        setTimeout(refreshDetailsImageBlockUi, 40);
        requestAnimationFrame(refreshDetailsImageBlockUi);
        setTimeout(refreshDetailsImageBlockUi, 180);
        return result;
      };
      window.openMartyrDetails.__imageUploadBlockWrapped = true;
      try { openMartyrDetails = window.openMartyrDetails; } catch (error) {}
    }
  }

  function patchBlockedPlaceholdersInDom() {
    document.querySelectorAll('.martyr-card, .list-item').forEach(card => {
      let martyrId = clean(card.getAttribute('data-taldo-home-card-id'));
      if (!martyrId) {
        const onclick = clean(card.getAttribute('onclick'));
        const match = onclick.match(/openMartyrDetails\(['"]([^'"]+)/);
        if (match && match[1]) martyrId = match[1];
      }

      if (!martyrId || !isImageUploadBlocked(martyrId)) return;

      const item = findMartyrByIdSafe(martyrId);
      if (hasAnyImage(item)) return;

      card.querySelectorAll('.martyr-placeholder').forEach(placeholder => {
        if (placeholder.dataset.taldoImageBlockPatched === '1') return;

        placeholder.classList.add('taldo-image-blocked-placeholder-card');
        placeholder.innerHTML = `<span class="taldo-image-blocked-icon" aria-hidden="true"><i class="fa-solid fa-user"></i></span>`;
        placeholder.dataset.taldoImageBlockPatched = '1';
      });
    });
  }

  function installRenderRefreshHooks() {
    ['renderMartyrs', 'renderHoulaMassacrePage', 'openFamilyMartyrs'].forEach(name => {
      const fn = window[name] || (() => { try { return eval(name); } catch (error) { return null; } })();
      if (typeof fn !== 'function' || fn.__imageUploadBlockRefreshWrapped) return;

      const wrapped = function () {
        const result = fn.apply(this, arguments);
        setTimeout(patchBlockedPlaceholdersInDom, 0);
        requestAnimationFrame(patchBlockedPlaceholdersInDom);
        return result;
      };
      wrapped.__imageUploadBlockRefreshWrapped = true;
      window[name] = wrapped;
      try { eval(name + ' = window[name]'); } catch (error) {}
    });
  }

  function installAll() {
    installRendererPatches();
    installAdminBoxPatch();
    installDataUpdatePatches();
    installDetailsPatch();
    installRenderRefreshHooks();
    patchBlockedPlaceholdersInDom();
    refreshDetailsImageBlockUi();
  }

  installAll();
  document.addEventListener('DOMContentLoaded', installAll);
  setTimeout(installAll, 400);
  setTimeout(installAll, 1200);

  let imageBlockObserverQueued = false;

  function queueBlockedPlaceholderPatch() {
    if (imageBlockObserverQueued) return;
    imageBlockObserverQueued = true;

    requestAnimationFrame(function () {
      imageBlockObserverQueued = false;
      patchBlockedPlaceholdersInDom();
    });
  }

  const observer = new MutationObserver(queueBlockedPlaceholderPatch);

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
