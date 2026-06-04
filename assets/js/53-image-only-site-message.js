(function() {
  const IMAGE_ONLY_TYPE = 'image_only';
  let imageOnlyOverlayIsOpen = false;
  let imageOnlyBootTimer = null;

  function normalizeArabicText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function isImageOnlyMessage(msg) {
    const type = normalizeArabicText(msg && msg.message_type);
    if (type === IMAGE_ONLY_TYPE) return true;

    // توافق احتياطي إذا حُفظت القيمة كنص عربي بالخطأ بدل value="image_only".
    return type.includes('صوره') && (
      type.includes('مجرده') ||
      type.includes('اعلام') ||
      type.includes('اشعار') ||
      type.includes('سريع')
    );
  }

  function getDriveThumbnail(fileId, size) {
    const id = String(fileId || '').trim();
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${size || 1600}` : '';
  }

  function getMessageImageSrc(msg) {
    if (!msg) return '';

    // نفضّل thumbnail بالـ file id لأن رابط uc أحيانًا لا يُعرض كصورة مباشرة في بعض الحالات.
    const imageFileId = String(msg.image_file_id || '').trim();
    if (imageFileId) return getDriveThumbnail(imageFileId, 1600);

    return String(msg.image_url || '').trim();
  }

  function getMessageImageFallbackSrc(msg) {
    if (!msg) return '';
    const imageUrl = String(msg.image_url || '').trim();
    const imageFileId = String(msg.image_file_id || '').trim();
    const thumb = imageFileId ? getDriveThumbnail(imageFileId, 1200) : '';
    return imageUrl && imageUrl !== thumb ? imageUrl : '';
  }

  function getMessageHiddenKey(msg) {
    return 'taldo_msg_hidden_' + (msg && msg.message_id ? msg.message_id : '');
  }

  function isMessageHidden(msg) {
    return !!(msg && msg.message_id && localStorage.getItem(getMessageHiddenKey(msg)) === '1');
  }

  function getVisibleMessages(list) {
    return (Array.isArray(list) ? list : [])
      .filter(msg => msg && String(msg.status || 'active').trim() !== 'inactive')
      .filter(msg => !isMessageHidden(msg));
  }


  function ensureImageOnlyCriticalStyles() {
    if (document.getElementById('taldoImageOnlyNoticeCriticalStyles')) return;

    const style = document.createElement('style');
    style.id = 'taldoImageOnlyNoticeCriticalStyles';
    style.textContent = `
      #taldoImageOnlyNoticeOverlay.taldo-image-only-notice-overlay {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 18px !important;
        background: rgba(0, 0, 0, 0.72) !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }

      #taldoImageOnlyNoticeOverlay.taldo-image-only-notice-overlay.d-none {
        display: none !important;
      }

      #taldoImageOnlyNoticeOverlay .taldo-image-only-notice-stage {
        position: relative !important;
        display: inline-block !important;
        max-width: min(94vw, 760px) !important;
        max-height: 90vh !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: transparent !important;
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        line-height: 0 !important;
        transform: none !important;
      }

      #taldoImageOnlyNoticeOverlay .taldo-image-only-notice-image {
        display: block !important;
        width: auto !important;
        height: auto !important;
        max-width: min(94vw, 760px) !important;
        max-height: 90vh !important;
        object-fit: contain !important;
        background: transparent !important;
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #taldoImageOnlyNoticeOverlay .taldo-image-only-notice-close {
        position: absolute !important;
        top: 8px !important;
        inset-inline-end: 8px !important;
        width: 34px !important;
        height: 34px !important;
        min-width: 34px !important;
        min-height: 34px !important;
        border-radius: 50% !important;
        border: 0 !important;
        background: rgba(0, 0, 0, 0.62) !important;
        color: #fff !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        font-size: 18px !important;
        cursor: pointer !important;
        z-index: 2 !important;
        box-shadow: 0 6px 16px rgba(0,0,0,.22) !important;
      }

      body.taldo-image-only-notice-open {
        overflow: hidden !important;
      }

      @media (max-width: 576px) {
        #taldoImageOnlyNoticeOverlay.taldo-image-only-notice-overlay {
          padding: 10px !important;
        }
        #taldoImageOnlyNoticeOverlay .taldo-image-only-notice-stage,
        #taldoImageOnlyNoticeOverlay .taldo-image-only-notice-image {
          max-width: 96vw !important;
          max-height: 88vh !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureImageOnlyOverlay() {
    ensureImageOnlyCriticalStyles();
    let overlay = document.getElementById('taldoImageOnlyNoticeOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'taldoImageOnlyNoticeOverlay';
    overlay.className = 'taldo-image-only-notice-overlay d-none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="taldo-image-only-notice-stage">
        <img id="taldoImageOnlyNoticeImage" class="taldo-image-only-notice-image" alt="إعلام سريع">
        <button type="button" id="taldoImageOnlyNoticeClose" class="taldo-image-only-notice-close" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`;

    document.body.appendChild(overlay);
    return overlay;
  }

  function getCurrentMessageIndex(list, msg) {
    const messages = Array.isArray(list) ? list : [];
    if (!messages.length || !msg) return -1;
    const byId = messages.findIndex(item => item && msg.message_id && item.message_id === msg.message_id);
    if (byId !== -1) return byId;
    return messages.indexOf(msg);
  }

  function continueDynamicMessages() {
    const list = Array.isArray(window.__dynamicMessageList) ? window.__dynamicMessageList : [];
    const msg = window.__currentDynamicMessage || null;
    let index = getCurrentMessageIndex(list, msg);

    if (index === -1 && typeof currentDynamicMessageIndex === 'number') {
      index = currentDynamicMessageIndex;
    }

    const nextIndex = Math.max(0, index + 1);

    try {
      currentDynamicMessageIndex = nextIndex;
    } catch (error) {
      window.currentDynamicMessageIndex = nextIndex;
    }

    const next = list[nextIndex];
    if (next) {
      setTimeout(() => window.showDynamicMessage(next, list), 250);
    } else {
      const introHidden = localStorage.getItem('taldo_martyrs_intro_hidden') === '1';
      if (!introHidden && window.modals && modals.introModal) {
        setTimeout(() => modals.introModal.show(), 250);
      }
    }
  }

  function closeImageOnlyNotice() {
    const msg = window.__currentDynamicMessage;
    if (msg && msg.message_id) {
      localStorage.setItem(getMessageHiddenKey(msg), '1');
    }

    imageOnlyOverlayIsOpen = false;
    document.body.classList.remove('taldo-image-only-notice-open');

    const overlay = document.getElementById('taldoImageOnlyNoticeOverlay');
    overlay?.classList.add('d-none');

    const img = document.getElementById('taldoImageOnlyNoticeImage');
    if (img) {
      img.removeAttribute('src');
      img.dataset.fallbackSrc = '';
      img.onerror = null;
    }

    continueDynamicMessages();
  }

  window.closeImageOnlyNotice = closeImageOnlyNotice;

  function showImageOnlyNotice(msg, list) {
    const src = getMessageImageSrc(msg);
    if (!src) return false;

    window.__currentDynamicMessage = msg;
    window.__dynamicMessageList = Array.isArray(list) ? list : getVisibleMessages(window.siteMessages || siteMessages || []);

    try {
      if (window.modals && modals.dynamicMessageModal) modals.dynamicMessageModal.hide();
    } catch (error) {}

    const overlay = ensureImageOnlyOverlay();
    const img = document.getElementById('taldoImageOnlyNoticeImage');
    const closeBtn = document.getElementById('taldoImageOnlyNoticeClose');

    if (img) {
      const fallback = getMessageImageFallbackSrc(msg);
      img.dataset.fallbackSrc = fallback || '';
      img.onerror = function() {
        const fallbackSrc = this.dataset.fallbackSrc || '';
        if (fallbackSrc && this.src !== fallbackSrc) {
          this.src = fallbackSrc;
          this.dataset.fallbackSrc = '';
        }
      };
      img.src = src;
      img.alt = msg.title || 'إعلام سريع';
    }

    if (closeBtn && closeBtn.dataset.bound !== '1') {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', closeImageOnlyNotice);
    }

    imageOnlyOverlayIsOpen = true;
    document.body.classList.add('taldo-image-only-notice-open');
    overlay.classList.remove('d-none');
    return true;
  }

  function wrapShowDynamicMessage() {
    const previous = window.showDynamicMessage;
    if (typeof previous !== 'function') return;
    if (previous.__imageOnlyWrapped === true) return;

    const wrapped = function(msg, list) {
      if (isImageOnlyMessage(msg)) {
        const shown = showImageOnlyNotice(msg, list);
        if (shown) return;
      }

      return previous.call(this, msg, list);
    };

    wrapped.__imageOnlyWrapped = true;
    wrapped.__previousShowDynamicMessage = previous;
    window.showDynamicMessage = wrapped;
  }

  function wrapShowNextDynamicMessage() {
    const previous = window.showNextDynamicMessage;
    if (typeof previous !== 'function') return;
    if (previous.__imageOnlyNextWrapped === true) return;

    const wrapped = function() {
      const rawList = Array.isArray(window.siteMessages) ? window.siteMessages : (typeof siteMessages !== 'undefined' ? siteMessages : []);
      const messages = getVisibleMessages(rawList);

      if (!messages.length) {
        return previous.call(this);
      }

      try {
        currentDynamicMessageIndex = 0;
      } catch (error) {
        window.currentDynamicMessageIndex = 0;
      }

      return window.showDynamicMessage(messages[0], messages);
    };

    wrapped.__imageOnlyNextWrapped = true;
    wrapped.__previousShowNextDynamicMessage = previous;
    window.showNextDynamicMessage = wrapped;
  }

  function findFieldWrap(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.closest('.col-md-6, .col-md-4, .col-md-3, .col-md-2, .col-12') || el.parentElement;
  }

  function ensureImageOnlyTypeOption() {
    const select = document.getElementById('msgType');
    if (!select) return;

    if (!Array.from(select.options).some(opt => opt.value === IMAGE_ONLY_TYPE)) {
      select.insertAdjacentHTML('beforeend', '<option value="image_only">صورة مجردة / إعلام سريع</option>');
    }
  }

  function applyMessageTypeUi() {
    ensureImageOnlyTypeOption();

    const type = document.getElementById('msgType')?.value || 'notice';
    const isImageOnly = type === IMAGE_ONLY_TYPE;

    const titleWrap = findFieldWrap('msgTitle');
    const bodyWrap = findFieldWrap('msgBody');
    const martyrWrap = findFieldWrap('msgMartyrId');
    const allowWrap = findFieldWrap('msgAllowReply');
    const imageInput = document.getElementById('msgImage');
    const imageWrap = findFieldWrap('msgImage');

    [titleWrap, bodyWrap, martyrWrap, allowWrap].forEach(wrap => {
      if (wrap) wrap.classList.toggle('d-none', isImageOnly);
    });

    if (imageWrap) {
      const label = imageWrap.querySelector('label');
      if (label) label.textContent = isImageOnly ? 'صورة الإعلام السريع' : 'صورة مع الرسالة';
    }

    if (imageInput) imageInput.required = isImageOnly;

    const allow = document.getElementById('msgAllowReply');
    if (allow && isImageOnly) allow.checked = false;

    const martyr = document.getElementById('msgMartyrId');
    if (martyr && isImageOnly) martyr.value = '';

    let help = document.getElementById('imageOnlyMessageHelp');
    const typeWrap = findFieldWrap('msgType');
    if (!help && typeWrap) {
      help = document.createElement('div');
      help.id = 'imageOnlyMessageHelp';
      help.className = 'col-12 d-none';
      help.innerHTML = `<div class="taldo-image-only-help">
        هذا النوع يظهر للمستخدم كصورة فقط بدون حواف أو إطار. تظهر علامة × فوق زاوية الصورة، وعند الضغط عليها لا تظهر هذه الصورة للمستخدم مرة أخرى.
      </div>`;
      typeWrap.insertAdjacentElement('afterend', help);
    }

    if (help) help.classList.toggle('d-none', !isImageOnly);
  }

  const previousHandleMessageTypeChange = window.handleMessageTypeChange;
  window.handleMessageTypeChange = function() {
    if (typeof previousHandleMessageTypeChange === 'function') previousHandleMessageTypeChange();
    applyMessageTypeUi();
  };

  const previousRenderSettingsTab = window.renderSettingsTab;
  window.renderSettingsTab = function() {
    if (typeof previousRenderSettingsTab === 'function') previousRenderSettingsTab();
    enhanceSettingsFormAfterRender();
    enhanceMessageListLabels();
  };

  function enhanceSettingsFormAfterRender() {
    ensureImageOnlyTypeOption();

    const select = document.getElementById('msgType');
    if (select && select.dataset.imageOnlyBound !== '1') {
      select.dataset.imageOnlyBound = '1';
      select.addEventListener('change', applyMessageTypeUi);
    }

    applyMessageTypeUi();
  }

  function enhanceMessageListLabels() {
    const list = document.getElementById('messagesAdminList');
    if (!list) return;

    const messages = (window.__adminMessages || siteMessages || []);
    const cards = Array.from(list.children || []);

    cards.forEach((card, index) => {
      const msg = messages[index];
      if (!isImageOnlyMessage(msg)) return;

      const meta = card.querySelector('.small.text-muted');
      if (meta) {
        meta.textContent = `${msg.status || ''} - ترتيب: ${msg.sort_order || ''} - النوع: صورة مجردة / إعلام سريع`;
      }

      if (!card.querySelector('.image-only-admin-badge')) {
        const titleBox = card.querySelector('.fw-bold');
        titleBox?.insertAdjacentHTML('afterend', `
          <div class="mt-1 image-only-admin-badge">
            <span class="message-linked-badge"><i class="fa-solid fa-image"></i> تظهر كصورة فقط عند فتح الموقع</span>
          </div>`);
      }
    });
  }

  const previousSaveDashboardMessage = window.saveDashboardMessage;
  window.saveDashboardMessage = function() {
    const type = document.getElementById('msgType')?.value || 'notice';

    if (type !== IMAGE_ONLY_TYPE) {
      if (typeof previousSaveDashboardMessage === 'function') return previousSaveDashboardMessage();
      return;
    }

    const file = document.getElementById('msgImage')?.files?.[0];
    if (!file) {
      showToast('يرجى رفع صورة للإعلام السريع.');
      return;
    }

    const title = document.getElementById('msgTitle');
    const body = document.getElementById('msgBody');
    const allow = document.getElementById('msgAllowReply');
    const martyr = document.getElementById('msgMartyrId');

    if (title && !title.value.trim()) title.value = 'إعلام سريع';
    if (body && !body.value.trim()) body.value = 'إعلام سريع بصورة';
    if (allow) allow.checked = false;
    if (martyr) martyr.value = '';

    if (typeof previousSaveDashboardMessage === 'function') return previousSaveDashboardMessage();
  };

  function bootImageOnlyFallback() {
    wrapShowDynamicMessage();
    wrapShowNextDynamicMessage();

    clearTimeout(imageOnlyBootTimer);
    imageOnlyBootTimer = setTimeout(() => {
      if (imageOnlyOverlayIsOpen) return;

      const modalIsOpen = !!document.querySelector('#dynamicMessageModal.show, #introModal.show');
      if (modalIsOpen) return;

      let list = [];
      try {
        list = getVisibleMessages(typeof siteMessages !== 'undefined' ? siteMessages : []);
      } catch (error) {
        list = [];
      }

      if (!list.length) return;
      const imageOnly = list.find(isImageOnlyMessage);
      if (!imageOnly) return;

      // احتياط: إذا انتهى تحميل البيانات قبل تركيب هذا الملف، نعرض الصورة هنا.
      showImageOnlyNotice(imageOnly, list);
    }, 1800);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureImageOnlyCriticalStyles();
    ensureImageOnlyOverlay();
    bootImageOnlyFallback();
    setTimeout(() => {
      enhanceSettingsFormAfterRender();
      enhanceMessageListLabels();
      bootImageOnlyFallback();
    }, 1200);
    setTimeout(bootImageOnlyFallback, 3500);
  });

  ensureImageOnlyCriticalStyles();

  // في حال كان الملف محملًا بعد تعريف الدوال، نلفّها مباشرة أيضًا.
  wrapShowDynamicMessage();
  wrapShowNextDynamicMessage();
})();
